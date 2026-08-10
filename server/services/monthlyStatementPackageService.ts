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

const assertExactExistingTransactions = async (
  db: Tx,
  params: {
    userId: string;
    accountId: string;
    periodStart: Date;
    periodEnd: Date;
    expected: string[];
  },
) => {
  const transactions = await db.transaction.findMany({
    where: {
      userId: params.userId,
      accountId: params.accountId,
      date: { gte: params.periodStart, lt: nextDay(params.periodEnd) },
    },
    select: { date: true, amountMinor: true },
  });
  const actual = transactions.map((row) => bankFactKey(row.date, row.amountMinor)).sort();
  if (actual.length !== params.expected.length || actual.some((value, index) => value !== params.expected[index])) {
    throw new MonthlyStatementPackageError(
      'De bestaande transacties voor deze maand komen niet exact overeen met de geldbedragen en boekingsdata in de geüploade CSV. De bankgegevens zijn niet gewijzigd.',
      'EXISTING_LEDGER_MISMATCH',
      409,
    );
  }
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
    const existingCount = await db.transaction.count({
      where: {
        userId,
        accountId: resolvedAccount.id,
        date: { gte: controls.periodStart, lt: nextDay(controls.periodEnd) },
      },
    });
    if (existingCount > 0) {
      await assertExactExistingTransactions(db, {
        userId,
        accountId: resolvedAccount.id,
        periodStart: controls.periodStart,
        periodEnd: controls.periodEnd,
        expected,
      });
      status = 'EVIDENCE_BACKFILLED';
    }
  }

  if (status === 'IMPORTED') {
    importSummary = await processImportBufferWithClient(db, {
      buffer: csv.buffer,
      filename: csv.filename,
      userId,
    });
    resolvedAccount = await db.account.findUnique({
      where: { userId_identifier: { userId, identifier: csvAccount } },
    });
    if (!resolvedAccount) {
      throw new MonthlyStatementPackageError('De geïmporteerde bankrekening kon niet worden teruggevonden.', 'ACCOUNT_NOT_FOUND', 500);
    }
    await assertExactExistingTransactions(db, {
      userId,
      accountId: resolvedAccount.id,
      periodStart: controls.periodStart,
      periodEnd: controls.periodEnd,
      expected,
    });
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
