import { Prisma } from '@prisma/client';
import { parseIngCsv } from '../../lib/import/csv_ING';
import { normalizeAccountIdentifier } from '../../lib/import/normalizers';
import { processImportBufferWithClient } from './importService';
import {
  acceptBankStatement,
  hashSourceContent,
  storeSourceFile,
} from './statementControlService';
import {
  extractIngStatementPdfControls,
  IngStatementPdfError,
} from './ingStatementPdfService';

export class MonthlyStatementPackageError extends Error {
  statusCode: number;
  code: string;

  constructor(message: string, code: string, statusCode = 422) {
    super(message);
    this.name = 'MonthlyStatementPackageError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

type Tx = Prisma.TransactionClient;

export type MonthlyStatementPackageInput = {
  db: Tx;
  userId: string;
  workspaceId: string;
  expectedMonthKey?: string | null;
  csv: { buffer: Buffer; filename: string; mediaType: string };
  pdf: { buffer: Buffer; filename: string; mediaType: string };
};

export type MonthlyStatementPackageResult = {
  status: 'IMPORTED' | 'EVIDENCE_BACKFILLED' | 'ALREADY_IMPORTED';
  importedCount: number;
  duplicateCount: number;
  transactionCount: number;
  periodStart: Date;
  periodEnd: Date;
  accountIdentifier: string;
  bankStatementId: string;
  batchId: string | null;
};

const abs = (value: bigint): bigint => (value < 0n ? -value : value);

const monthKey = (date: Date): string => `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;

const nextDay = (date: Date): Date => new Date(Date.UTC(
  date.getUTCFullYear(),
  date.getUTCMonth(),
  date.getUTCDate() + 1,
));

const sameInstant = (a: Date, b: Date): boolean => a.getTime() === b.getTime();

const bankFactKey = (date: Date, amountMinor: bigint): string =>
  `${date.toISOString().slice(0, 10)}|${amountMinor.toString()}`;

const expectedBankFacts = (rows: Awaited<ReturnType<typeof parseIngCsv>>['successes']): string[] =>
  rows.map((row) => bankFactKey(row.date, row.amountMinor)).sort();

const classifyExistingTransactions = async (
  db: Tx,
  params: {
    userId: string;
    accountId: string;
    periodStart: Date;
    periodEnd: Date;
    expected: string[];
  },
): Promise<'NONE' | 'SUBSET' | 'EXACT'> => {
  const transactions = await db.transaction.findMany({
    where: {
      userId: params.userId,
      accountId: params.accountId,
      date: { gte: params.periodStart, lt: nextDay(params.periodEnd) },
    },
    select: { date: true, amountMinor: true },
  });
  if (transactions.length === 0) return 'NONE';

  const remaining = new Map<string, number>();
  for (const key of params.expected) remaining.set(key, (remaining.get(key) ?? 0) + 1);
  for (const row of transactions) {
    const key = bankFactKey(row.date, row.amountMinor);
    const available = remaining.get(key) ?? 0;
    if (available <= 0) {
      throw new MonthlyStatementPackageError(
        'De bestaande transacties voor deze maand bevatten bankboekingen die niet voorkomen in de geüploade CSV. De bankgegevens zijn niet gewijzigd.',
        'EXISTING_LEDGER_MISMATCH',
        409,
      );
    }
    remaining.set(key, available - 1);
  }
  return transactions.length === params.expected.length ? 'EXACT' : 'SUBSET';
};

export const importMonthlyStatementPackage = async ({
  db,
  userId,
  workspaceId,
  expectedMonthKey,
  csv,
  pdf,
}: MonthlyStatementPackageInput): Promise<MonthlyStatementPackageResult> => {
  if (!csv.buffer.length) throw new MonthlyStatementPackageError('Het CSV-bestand is leeg.', 'EMPTY_CSV', 400);
  if (!pdf.buffer.length) throw new MonthlyStatementPackageError('Het PDF-bankafschrift is leeg.', 'EMPTY_PDF', 400);

  const parsed = await parseIngCsv(csv.buffer);
  if (parsed.errors.length > 0 || parsed.successes.length === 0) {
    throw new MonthlyStatementPackageError(
      parsed.errors[0]?.message ?? 'De CSV bevat geen geldige ING-transacties.',
      'INVALID_CSV',
      422,
    );
  }

  let controls;
  try {
    controls = await extractIngStatementPdfControls(pdf.buffer);
  } catch (error) {
    if (error instanceof IngStatementPdfError) {
      throw new MonthlyStatementPackageError(error.message, 'INVALID_PDF', error.statusCode);
    }
    throw error;
  }

  const accounts = [...new Set(parsed.successes.map((row) => normalizeAccountIdentifier(row.accountIdentifier)))];
  if (accounts.length !== 1) {
    throw new MonthlyStatementPackageError('De CSV bevat transacties van meerdere bankrekeningen.', 'MULTIPLE_CSV_ACCOUNTS');
  }
  const csvAccount = accounts[0];
  const pdfAccount = normalizeAccountIdentifier(controls.bankAccountIdentifier);
  if (csvAccount !== pdfAccount) {
    throw new MonthlyStatementPackageError(
      'De CSV en PDF horen niet bij hetzelfde bankafschrift. Controleer het rekeningnummer.',
      'ACCOUNT_MISMATCH',
    );
  }

  for (const row of parsed.successes) {
    if (row.date < controls.periodStart || row.date > controls.periodEnd) {
      throw new MonthlyStatementPackageError(
        'De CSV bevat transacties buiten de afschriftperiode van het PDF-bankafschrift.',
        'PERIOD_MISMATCH',
      );
    }
  }

  const months = [...new Set(parsed.successes.map((row) => monthKey(row.date)))];
  if (months.length !== 1 || monthKey(controls.periodStart) !== monthKey(controls.periodEnd) || months[0] !== monthKey(controls.periodStart)) {
    throw new MonthlyStatementPackageError('De CSV en PDF moeten samen precies één kalendermaand vertegenwoordigen.', 'MONTH_MISMATCH');
  }
  const actualMonthKey = monthKey(controls.periodStart);
  if (expectedMonthKey && expectedMonthKey !== actualMonthKey) {
    throw new MonthlyStatementPackageError(
      `De geselecteerde maand (${expectedMonthKey}) komt niet overeen met het bankafschrift (${actualMonthKey}).`,
      'SELECTED_MONTH_MISMATCH',
      422,
    );
  }

  const incomeMinor = parsed.successes.reduce((sum, row) => sum + (row.amountMinor > 0n ? row.amountMinor : 0n), 0n);
  const expenseMinor = parsed.successes.reduce((sum, row) => sum + (row.amountMinor < 0n ? abs(row.amountMinor) : 0n), 0n);
  if (incomeMinor !== controls.incomeMinor) {
    throw new MonthlyStatementPackageError(
      `De CSV-inkomsten (${incomeMinor}) komen niet overeen met het PDF-bankafschrift (${controls.incomeMinor}).`,
      'INCOME_MISMATCH',
    );
  }
  if (expenseMinor !== controls.expenseMinor) {
    throw new MonthlyStatementPackageError(
      `De CSV-uitgaven (${expenseMinor}) komen niet overeen met het PDF-bankafschrift (${controls.expenseMinor}).`,
      'EXPENSE_MISMATCH',
    );
  }

  const account = await db.account.findUnique({
    where: { userId_identifier: { userId, identifier: csvAccount } },
  });
  const csvSha = hashSourceContent(csv.buffer);
  const pdfSha = hashSourceContent(pdf.buffer);

  if (account) {
    const existingStatement = await db.bankStatement.findFirst({
      where: {
        workspaceId,
        accountId: account.id,
        periodStart: controls.periodStart,
        periodEnd: controls.periodEnd,
      },
      include: { sourceFile: true, supportingPdfFile: true },
    });
    if (existingStatement) {
      const exactEvidence = existingStatement.sourceFile.sha256 === csvSha
        && existingStatement.supportingPdfFile?.sha256 === pdfSha
        && existingStatement.openingBalanceMinor === controls.openingBalanceMinor
        && existingStatement.incomeMinor === controls.incomeMinor
        && existingStatement.expenseMinor === controls.expenseMinor
        && existingStatement.closingBalanceMinor === controls.closingBalanceMinor
        && existingStatement.transactionCount === parsed.successes.length;
      if (!exactEvidence) {
        throw new MonthlyStatementPackageError(
          'Voor deze rekening en maand bestaat al ander bankafschriftbewijs. Bestaande bankwaarheid wordt niet overschreven.',
          'STATEMENT_CONFLICT',
          409,
        );
      }
      return {
        status: 'ALREADY_IMPORTED',
        importedCount: 0,
        duplicateCount: parsed.successes.length,
        transactionCount: parsed.successes.length,
        periodStart: controls.periodStart,
        periodEnd: controls.periodEnd,
        accountIdentifier: csvAccount,
        bankStatementId: existingStatement.id,
        batchId: existingStatement.importBatchId,
      };
    }
  }

  const expected = expectedBankFacts(parsed.successes);
  let importSummary: Awaited<ReturnType<typeof processImportBufferWithClient>> | null = null;
  let resolvedAccount = account;
  let status: MonthlyStatementPackageResult['status'] = 'IMPORTED';

  if (resolvedAccount) {
    const coverage = await classifyExistingTransactions(db, {
      userId,
      accountId: resolvedAccount.id,
      periodStart: controls.periodStart,
      periodEnd: controls.periodEnd,
      expected,
    });
    if (coverage === 'EXACT') {
      status = 'EVIDENCE_BACKFILLED';
    }
    // SUBSET intentionally continues through the normal duplicate-aware importer.
    // This is how a historical partial month (for example the first five July rows)
    // gains only the missing transactions from the complete monthly export.
  }

  if (status === 'IMPORTED') {
    importSummary = await processImportBufferWithClient(db, {
      buffer: csv.buffer,
      filename: csv.filename,
      userId,
      allowLockedLedgerCompletion: true,
    });
    resolvedAccount = await db.account.findUnique({
      where: { userId_identifier: { userId, identifier: csvAccount } },
    });
    if (!resolvedAccount) {
      throw new MonthlyStatementPackageError('De geïmporteerde bankrekening kon niet worden teruggevonden.', 'ACCOUNT_NOT_FOUND', 500);
    }
    const finalCoverage = await classifyExistingTransactions(db, {
      userId,
      accountId: resolvedAccount.id,
      periodStart: controls.periodStart,
      periodEnd: controls.periodEnd,
      expected,
    });
    if (finalCoverage !== 'EXACT') {
      throw new MonthlyStatementPackageError(
        'Na import komt de transactieset nog niet exact overeen met het volledige maandbestand. De bankafschriftgegevens zijn niet opgeslagen.',
        'POST_IMPORT_MISMATCH',
        409,
      );
    }
  }

  if (!resolvedAccount) {
    throw new MonthlyStatementPackageError('De bankrekening kon niet worden gevonden.', 'ACCOUNT_NOT_FOUND', 404);
  }

  const csvSource = await storeSourceFile(db, {
    workspaceId,
    filename: csv.filename,
    mediaType: csv.mediaType || 'text/csv',
    content: csv.buffer,
    uploadedBy: userId,
  });
  const pdfSource = await storeSourceFile(db, {
    workspaceId,
    filename: pdf.filename,
    mediaType: pdf.mediaType || 'application/pdf',
    content: pdf.buffer,
    uploadedBy: userId,
  });

  const statement = await acceptBankStatement(db, {
    workspaceId,
    accountId: resolvedAccount.id,
    sourceFileId: csvSource.id,
    supportingPdfFileId: pdfSource.id,
    importBatchId: importSummary?.batchId ?? null,
    periodStart: controls.periodStart,
    periodEnd: controls.periodEnd,
    coverageStatus: 'COMPLETE',
    currency: 'EUR',
    openingBalanceMinor: controls.openingBalanceMinor,
    incomeMinor: controls.incomeMinor,
    expenseMinor: controls.expenseMinor,
    closingBalanceMinor: controls.closingBalanceMinor,
    transactionCount: parsed.successes.length,
    bankAccountIdentifier: csvAccount,
    acceptedBy: userId,
    acceptedAt: new Date(),
    periods: [{
      accountId: resolvedAccount.id,
      periodStart: controls.periodStart,
      periodEnd: controls.periodEnd,
      coverageStatus: 'COMPLETE',
      openingBalanceMinor: controls.openingBalanceMinor,
      incomeMinor: controls.incomeMinor,
      expenseMinor: controls.expenseMinor,
      closingBalanceMinor: controls.closingBalanceMinor,
      transactionCount: parsed.successes.length,
    }],
  });

  const ledger = await db.ledger.findFirst({
    where: {
      userId,
      year: controls.periodStart.getUTCFullYear(),
      month: controls.periodStart.getUTCMonth() + 1,
    },
  });
  if (ledger) {
    await db.ledger.update({
      where: { id: ledger.id },
      data: {
        lockedAt: ledger.lockedAt ?? new Date(),
        lockNote: ledger.lockNote ?? 'Bank facts locked after automatic statement reconciliation; classification remains editable.',
      },
    });
  }

  return {
    status,
    importedCount: importSummary?.importedCount ?? 0,
    duplicateCount: importSummary?.duplicateCount ?? (status === 'EVIDENCE_BACKFILLED' ? parsed.successes.length : 0),
    transactionCount: parsed.successes.length,
    periodStart: controls.periodStart,
    periodEnd: controls.periodEnd,
    accountIdentifier: csvAccount,
    bankStatementId: statement.id,
    batchId: importSummary?.batchId ?? null,
  };
};




export type MonthlyStatementEvidenceInput = {
  db: Tx;
  userId: string;
  workspaceId: string;
  expectedMonthKey?: string | null;
  csv?: { buffer: Buffer; filename: string; mediaType: string } | null;
  pdf?: { buffer: Buffer; filename: string; mediaType: string } | null;
};

export type MonthlyStatementEvidenceResult = {
  status: MonthlyStatementPackageResult['status'] | 'CSV_IMPORTED' | 'CSV_STAGED' | 'PDF_STAGED';
  importedCount: number;
  duplicateCount: number;
  transactionCount: number | null;
  periodStart: Date;
  periodEnd: Date;
  accountIdentifier: string;
  bankStatementId: string | null;
  batchId: string | null;
};

type StoredSourceCandidate = {
  id: string;
  filename: string;
  mediaType: string;
  content: Uint8Array;
  sha256: string;
};

type CsvInspection = {
  parsed: Awaited<ReturnType<typeof parseIngCsv>>;
  accountIdentifier: string;
  actualMonthKey: string;
  periodStart: Date;
  periodEnd: Date;
  incomeMinor: bigint;
  expenseMinor: bigint;
  expectedFacts: string[];
};

const calendarMonthBounds = (key: string): { periodStart: Date; periodEnd: Date } => {
  const [yearRaw, monthRaw] = key.split('-');
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const periodStart = new Date(Date.UTC(year, month - 1, 1));
  const periodEnd = new Date(Date.UTC(year, month, 0));
  return { periodStart, periodEnd };
};

const assertExpectedMonth = (expectedMonthKey: string | null | undefined, actualMonthKey: string) => {
  if (expectedMonthKey && expectedMonthKey !== actualMonthKey) {
    throw new MonthlyStatementPackageError(
      `De geselecteerde maand (${expectedMonthKey}) komt niet overeen met het bankafschrift (${actualMonthKey}).`,
      'SELECTED_MONTH_MISMATCH',
      422,
    );
  }
};

const inspectCsvEvidence = async (
  csv: NonNullable<MonthlyStatementEvidenceInput['csv']>,
  expectedMonthKey?: string | null,
): Promise<CsvInspection> => {
  if (!csv.buffer.length) throw new MonthlyStatementPackageError('Het CSV-bestand is leeg.', 'EMPTY_CSV', 400);
  const parsed = await parseIngCsv(csv.buffer);
  if (parsed.errors.length > 0 || parsed.successes.length === 0) {
    throw new MonthlyStatementPackageError(
      parsed.errors[0]?.message ?? 'De CSV bevat geen geldige ING-transacties.',
      'INVALID_CSV',
      422,
    );
  }
  const accounts = [...new Set(parsed.successes.map((row) => normalizeAccountIdentifier(row.accountIdentifier)))];
  if (accounts.length !== 1) {
    throw new MonthlyStatementPackageError('De CSV bevat transacties van meerdere bankrekeningen.', 'MULTIPLE_CSV_ACCOUNTS');
  }
  const months = [...new Set(parsed.successes.map((row) => monthKey(row.date)))];
  if (months.length !== 1) {
    throw new MonthlyStatementPackageError('De CSV moet precies één kalendermaand vertegenwoordigen.', 'CSV_MONTH_MISMATCH');
  }
  const actualMonthKey = months[0];
  assertExpectedMonth(expectedMonthKey, actualMonthKey);
  const { periodStart, periodEnd } = calendarMonthBounds(actualMonthKey);
  const incomeMinor = parsed.successes.reduce((sum, row) => sum + (row.amountMinor > 0n ? row.amountMinor : 0n), 0n);
  const expenseMinor = parsed.successes.reduce((sum, row) => sum + (row.amountMinor < 0n ? abs(row.amountMinor) : 0n), 0n);
  return {
    parsed,
    accountIdentifier: accounts[0],
    actualMonthKey,
    periodStart,
    periodEnd,
    incomeMinor,
    expenseMinor,
    expectedFacts: expectedBankFacts(parsed.successes),
  };
};

const inspectPdfEvidence = async (
  pdf: NonNullable<MonthlyStatementEvidenceInput['pdf']>,
  expectedMonthKey?: string | null,
) => {
  if (!pdf.buffer.length) throw new MonthlyStatementPackageError('Het PDF-bankafschrift is leeg.', 'EMPTY_PDF', 400);
  let controls;
  try {
    controls = await extractIngStatementPdfControls(pdf.buffer);
  } catch (error) {
    if (error instanceof IngStatementPdfError) {
      throw new MonthlyStatementPackageError(error.message, 'INVALID_PDF', error.statusCode);
    }
    throw error;
  }
  if (monthKey(controls.periodStart) !== monthKey(controls.periodEnd)) {
    throw new MonthlyStatementPackageError('Het PDF-bankafschrift moet precies één kalendermaand vertegenwoordigen.', 'PDF_MONTH_MISMATCH');
  }
  const actualMonthKey = monthKey(controls.periodStart);
  assertExpectedMonth(expectedMonthKey, actualMonthKey);
  return {
    controls,
    accountIdentifier: normalizeAccountIdentifier(controls.bankAccountIdentifier),
    actualMonthKey,
  };
};

const getUnlinkedSourceCandidates = async (db: Tx, workspaceId: string): Promise<StoredSourceCandidate[]> =>
  db.sourceFile.findMany({
    where: {
      workspaceId,
      sourceStatements: { none: {} },
      supportingStatements: { none: {} },
    },
    select: { id: true, filename: true, mediaType: true, content: true, sha256: true },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });

const findMatchingStagedPdf = async (
  db: Tx,
  workspaceId: string,
  csvInspection: CsvInspection,
): Promise<NonNullable<MonthlyStatementEvidenceInput['pdf']> | null> => {
  const candidates = await getUnlinkedSourceCandidates(db, workspaceId);
  for (const candidate of candidates) {
    if (!candidate.filename.toLowerCase().endsWith('.pdf') && candidate.mediaType.toLowerCase() !== 'application/pdf') continue;
    try {
      const pdf = {
        buffer: Buffer.from(candidate.content),
        filename: candidate.filename,
        mediaType: candidate.mediaType,
      };
      const inspected = await inspectPdfEvidence(pdf, csvInspection.actualMonthKey);
      if (
        inspected.accountIdentifier === csvInspection.accountIdentifier
        && inspected.controls.incomeMinor === csvInspection.incomeMinor
        && inspected.controls.expenseMinor === csvInspection.expenseMinor
      ) return pdf;
    } catch {
      // An unrelated staged file is ignored; the explicitly uploaded file still receives precise errors.
    }
  }
  return null;
};

const findMatchingStagedCsv = async (
  db: Tx,
  workspaceId: string,
  pdfInspection: Awaited<ReturnType<typeof inspectPdfEvidence>>,
): Promise<NonNullable<MonthlyStatementEvidenceInput['csv']> | null> => {
  const candidates = await getUnlinkedSourceCandidates(db, workspaceId);
  for (const candidate of candidates) {
    if (!candidate.filename.toLowerCase().endsWith('.csv') && !candidate.mediaType.toLowerCase().includes('csv')) continue;
    try {
      const csv = {
        buffer: Buffer.from(candidate.content),
        filename: candidate.filename,
        mediaType: candidate.mediaType,
      };
      const inspected = await inspectCsvEvidence(csv, pdfInspection.actualMonthKey);
      if (
        inspected.accountIdentifier === pdfInspection.accountIdentifier
        && inspected.incomeMinor === pdfInspection.controls.incomeMinor
        && inspected.expenseMinor === pdfInspection.controls.expenseMinor
      ) return csv;
    } catch {
      // Ignore unrelated staged evidence.
    }
  }
  return null;
};

const existingStatementForSource = async (db: Tx, workspaceId: string, sourceFileId: string) =>
  db.bankStatement.findFirst({
    where: {
      workspaceId,
      OR: [{ sourceFileId }, { supportingPdfFileId: sourceFileId }],
    },
  });

const alreadyImportedEvidenceResult = (statement: {
  id: string;
  importBatchId: string | null;
  transactionCount: number;
  periodStart: Date;
  periodEnd: Date;
  bankAccountIdentifier: string;
}): MonthlyStatementEvidenceResult => ({
  status: 'ALREADY_IMPORTED',
  importedCount: 0,
  duplicateCount: statement.transactionCount,
  transactionCount: statement.transactionCount,
  periodStart: statement.periodStart,
  periodEnd: statement.periodEnd,
  accountIdentifier: statement.bankAccountIdentifier,
  bankStatementId: statement.id,
  batchId: statement.importBatchId,
});

export const importMonthlyStatementEvidence = async ({
  db,
  userId,
  workspaceId,
  expectedMonthKey,
  csv,
  pdf,
}: MonthlyStatementEvidenceInput): Promise<MonthlyStatementEvidenceResult> => {
  if (!csv && !pdf) {
    throw new MonthlyStatementPackageError('Selecteer een CSV-bestand, een PDF-bankafschrift of beide.', 'STATEMENT_FILE_REQUIRED', 400);
  }

  if (csv && pdf) {
    return importMonthlyStatementPackage({ db, userId, workspaceId, expectedMonthKey, csv, pdf });
  }

  if (csv) {
    const inspected = await inspectCsvEvidence(csv, expectedMonthKey);
    const storedCsv = await storeSourceFile(db, {
      workspaceId,
      filename: csv.filename,
      mediaType: csv.mediaType || 'text/csv',
      content: csv.buffer,
      uploadedBy: userId,
    });
    const linked = await existingStatementForSource(db, workspaceId, storedCsv.id);
    if (linked) return alreadyImportedEvidenceResult(linked);

    let resolvedAccount = await db.account.findUnique({
      where: { userId_identifier: { userId, identifier: inspected.accountIdentifier } },
    });
    let importSummary: Awaited<ReturnType<typeof processImportBufferWithClient>> | null = null;
    let coverage: 'NONE' | 'SUBSET' | 'EXACT' = 'NONE';

    if (resolvedAccount) {
      coverage = await classifyExistingTransactions(db, {
        userId,
        accountId: resolvedAccount.id,
        periodStart: inspected.periodStart,
        periodEnd: inspected.periodEnd,
        expected: inspected.expectedFacts,
      });
    }
    if (coverage !== 'EXACT') {
      importSummary = await processImportBufferWithClient(db, {
        buffer: csv.buffer,
        filename: csv.filename,
        userId,
        allowLockedLedgerCompletion: true,
      });
      resolvedAccount = await db.account.findUnique({
        where: { userId_identifier: { userId, identifier: inspected.accountIdentifier } },
      });
      if (!resolvedAccount) {
        throw new MonthlyStatementPackageError('De geïmporteerde bankrekening kon niet worden teruggevonden.', 'ACCOUNT_NOT_FOUND', 500);
      }
      const finalCoverage = await classifyExistingTransactions(db, {
        userId,
        accountId: resolvedAccount.id,
        periodStart: inspected.periodStart,
        periodEnd: inspected.periodEnd,
        expected: inspected.expectedFacts,
      });
      if (finalCoverage !== 'EXACT') {
        throw new MonthlyStatementPackageError('Na CSV-import is de maand nog niet volledig. Er zijn geen bankafschriftcontroles opgeslagen.', 'POST_IMPORT_MISMATCH', 409);
      }
    }

    const stagedPdf = await findMatchingStagedPdf(db, workspaceId, inspected);
    if (stagedPdf) {
      return importMonthlyStatementPackage({ db, userId, workspaceId, expectedMonthKey, csv, pdf: stagedPdf });
    }

    return {
      status: importSummary?.importedCount ? 'CSV_IMPORTED' : 'CSV_STAGED',
      importedCount: importSummary?.importedCount ?? 0,
      duplicateCount: importSummary?.duplicateCount ?? inspected.parsed.successes.length,
      transactionCount: inspected.parsed.successes.length,
      periodStart: inspected.periodStart,
      periodEnd: inspected.periodEnd,
      accountIdentifier: inspected.accountIdentifier,
      bankStatementId: null,
      batchId: importSummary?.batchId ?? null,
    };
  }

  const inspectedPdf = await inspectPdfEvidence(pdf!, expectedMonthKey);
  const storedPdf = await storeSourceFile(db, {
    workspaceId,
    filename: pdf!.filename,
    mediaType: pdf!.mediaType || 'application/pdf',
    content: pdf!.buffer,
    uploadedBy: userId,
  });
  const linked = await existingStatementForSource(db, workspaceId, storedPdf.id);
  if (linked) return alreadyImportedEvidenceResult(linked);

  const stagedCsv = await findMatchingStagedCsv(db, workspaceId, inspectedPdf);
  if (stagedCsv) {
    return importMonthlyStatementPackage({ db, userId, workspaceId, expectedMonthKey, csv: stagedCsv, pdf: pdf! });
  }

  return {
    status: 'PDF_STAGED',
    importedCount: 0,
    duplicateCount: 0,
    transactionCount: null,
    periodStart: inspectedPdf.controls.periodStart,
    periodEnd: inspectedPdf.controls.periodEnd,
    accountIdentifier: inspectedPdf.accountIdentifier,
    bankStatementId: null,
    batchId: null,
  };
};
