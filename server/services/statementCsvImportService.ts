import { Prisma } from '@prisma/client';
import { buildTransactionHash } from '../../lib/import/dedupe';
import type { ParsedRowSuccess } from '../../lib/import/types';
import { buildImportFingerprint } from './transactionFingerprint';
import { hashSourceContent } from './statementControlService';

export class StatementCsvImportError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode = 409,
  ) {
    super(message);
    this.name = 'StatementCsvImportError';
  }
}

export type StatementCsvImportResult = {
  importedCount: number;
  duplicateCount: number;
  batchId: string | null;
  ledgerId: string;
};

type Tx = Prisma.TransactionClient;

const dayAmountKey = (date: Date, amountMinor: bigint): string =>
  `${date.toISOString().slice(0, 10)}|${amountMinor.toString()}`;

const periodBounds = (rows: ParsedRowSuccess[]) => {
  const times = rows.map((row) => row.date.getTime());
  const min = new Date(Math.min(...times));
  const year = min.getUTCFullYear();
  const month = min.getUTCMonth() + 1;
  return {
    year,
    month,
    start: new Date(Date.UTC(year, month - 1, 1)),
    endExclusive: new Date(Date.UTC(year, month, 1)),
  };
};

/**
 * Imports only immutable bank facts for a verified monthly statement CSV.
 * Categorization is deliberately not performed here: project/type/category remain a
 * separate editable workflow after the bank transaction exists.
 */
export const importStatementCsvRows = async (
  db: Tx,
  params: {
    userId: string;
    rows: ParsedRowSuccess[];
    csvBuffer: Buffer;
    filename: string;
  },
): Promise<StatementCsvImportResult> => {
  if (params.rows.length === 0) {
    throw new StatementCsvImportError('De CSV bevat geen geldige transacties.', 'STATEMENT_CSV_EMPTY', 422);
  }

  const accountIdentifiers = [...new Set(params.rows.map((row) => row.accountIdentifier))];
  if (accountIdentifiers.length !== 1) {
    throw new StatementCsvImportError('De CSV moet precies één bankrekening bevatten.', 'STATEMENT_CSV_MULTIPLE_ACCOUNTS', 422);
  }

  const accountIdentifier = accountIdentifiers[0];
  const representative = params.rows[0];
  const account = await db.account.upsert({
    where: { userId_identifier: { userId: params.userId, identifier: accountIdentifier } },
    update: { name: representative.accountName ?? accountIdentifier },
    create: {
      userId: params.userId,
      identifier: accountIdentifier,
      name: representative.accountName ?? accountIdentifier,
      currency: representative.currency,
    },
  });

  const period = periodBounds(params.rows);
  if (params.rows.some((row) => row.date.getUTCFullYear() !== period.year || row.date.getUTCMonth() + 1 !== period.month)) {
    throw new StatementCsvImportError('De CSV moet precies één kalendermaand bevatten.', 'STATEMENT_CSV_MULTIPLE_MONTHS', 422);
  }

  const ledger = await db.ledger.upsert({
    where: { userId_month_year: { userId: params.userId, month: period.month, year: period.year } },
    update: {},
    create: { userId: params.userId, month: period.month, year: period.year },
  });

  const existing = await db.transaction.findMany({
    where: {
      userId: params.userId,
      accountId: account.id,
      date: { gte: period.start, lt: period.endExclusive },
    },
    select: { id: true, date: true, amountMinor: true, ledgerId: true },
  });

  const remainingExisting = new Map<string, number>();
  for (const row of existing) {
    const key = dayAmountKey(row.date, row.amountMinor);
    remainingExisting.set(key, (remainingExisting.get(key) ?? 0) + 1);
  }

  const missingRows: ParsedRowSuccess[] = [];
  for (const row of params.rows) {
    const key = dayAmountKey(row.date, row.amountMinor);
    const remaining = remainingExisting.get(key) ?? 0;
    if (remaining > 0) {
      remainingExisting.set(key, remaining - 1);
    } else {
      missingRows.push(row);
    }
  }

  if ([...remainingExisting.values()].some((count) => count > 0)) {
    throw new StatementCsvImportError('De bestaande banktransacties horen niet bij deze CSV. Er zijn geen bankgegevens gewijzigd.', 'STATEMENT_EXISTING_FACTS_CONFLICT', 409);
  }

  if (existing.some((row) => !row.ledgerId)) {
    await db.transaction.updateMany({
      where: {
        userId: params.userId,
        accountId: account.id,
        date: { gte: period.start, lt: period.endExclusive },
        ledgerId: null,
      },
      data: { ledgerId: ledger.id },
    });
  }

  if (missingRows.length === 0) {
    return {
      importedCount: 0,
      duplicateCount: params.rows.length,
      batchId: null,
      ledgerId: ledger.id,
    };
  }

  const batch = await db.importBatch.create({
    data: {
      userId: params.userId,
      filename: params.filename,
      fileType: 'csv_ing_statement',
      fileSizeBytes: params.csvBuffer.length,
      fileSha256: hashSourceContent(params.csvBuffer),
      status: 'completed',
      totalRows: params.rows.length,
      importedRows: missingRows.length,
      duplicateRows: params.rows.length - missingRows.length,
      errorRows: 0,
      autoCategorizedRows: 0,
      completedAt: new Date(),
    },
  });

  const records = missingRows.map((row) => ({
    userId: params.userId,
    accountId: account.id,
    ledgerId: ledger.id,
    importBatchId: batch.id,
    date: row.date,
    description: row.description,
    normalizedKey: row.normalizedDescription,
    amountMinor: row.amountMinor,
    currency: row.currency,
    direction: row.amountMinor < 0n ? 'debit' as const : 'credit' as const,
    source: row.source,
    counterparty: row.counterparty,
    reference: row.reference,
    hash: buildTransactionHash({
      userId: params.userId,
      accountIdentifier: row.accountIdentifier,
      date: row.date,
      normalizedDescription: row.normalizedDescription,
      amountMinor: row.amountMinor,
      reference: row.reference,
    }),
    sourceFile: params.filename,
    rawRow: row.raw as Prisma.InputJsonValue,
    classificationSource: 'none' as const,
    importFingerprint: buildImportFingerprint({
      accountIdentifier: row.accountIdentifier,
      date: row.date,
      amountMinor: row.amountMinor,
      description: row.description,
      counterparty: row.counterparty,
      reference: row.reference,
      raw: row.raw,
    }),
  }));

  const created = await db.transaction.createMany({ data: records, skipDuplicates: true });

  const finalRows = await db.transaction.findMany({
    where: {
      userId: params.userId,
      accountId: account.id,
      date: { gte: period.start, lt: period.endExclusive },
    },
    select: { date: true, amountMinor: true },
  });
  const expectedCounts = new Map<string, number>();
  const actualCounts = new Map<string, number>();
  for (const row of params.rows) {
    const key = dayAmountKey(row.date, row.amountMinor);
    expectedCounts.set(key, (expectedCounts.get(key) ?? 0) + 1);
  }
  for (const row of finalRows) {
    const key = dayAmountKey(row.date, row.amountMinor);
    actualCounts.set(key, (actualCounts.get(key) ?? 0) + 1);
  }
  const exact = expectedCounts.size === actualCounts.size
    && [...expectedCounts.entries()].every(([key, count]) => actualCounts.get(key) === count);
  if (!exact) {
    throw new StatementCsvImportError('De CSV-import heeft niet exact geconvergeerd naar de geüploade banktransacties.', 'STATEMENT_IMPORT_CONVERGENCE_FAILED', 409);
  }

  return {
    importedCount: created.count,
    duplicateCount: params.rows.length - created.count,
    batchId: batch.id,
    ledgerId: ledger.id,
  };
};
