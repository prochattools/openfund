import { describe, expect, it, vi } from 'vitest';
import { StatementCsvImportError, importStatementCsvRows } from '../../server/services/statementCsvImportService';

const makeRow = (overrides: Partial<any> = {}) => ({
  rowNumber: 1,
  accountIdentifier: 'NL89INGB0006369960',
  accountName: 'Yeshua Academy',
  currency: 'EUR',
  date: new Date('2026-07-01T00:00:00.000Z'),
  description: 'Gift',
  counterparty: 'Person',
  paymentPurpose: 'Gift',
  normalizedPaymentPurpose: 'gift',
  amountMinor: 10000n,
  reference: null,
  normalizedDescription: 'gift',
  source: 'ING CSV',
  raw: { Account: 'NL89INGB0006369960' },
  ...overrides,
});

const rows = [
  makeRow({ rowNumber: 1, date: new Date('2026-07-01T00:00:00.000Z'), amountMinor: 10000n, description: 'A', normalizedDescription: 'a' }),
  makeRow({ rowNumber: 2, date: new Date('2026-07-01T00:00:00.000Z'), amountMinor: -300000n, description: 'B', normalizedDescription: 'b' }),
  makeRow({ rowNumber: 3, date: new Date('2026-07-02T00:00:00.000Z'), amountMinor: 11700n, description: 'C', normalizedDescription: 'c' }),
  makeRow({ rowNumber: 4, date: new Date('2026-07-03T00:00:00.000Z'), amountMinor: 15000n, description: 'D', normalizedDescription: 'd' }),
];

const persistedBankFields = (row: ReturnType<typeof makeRow>) => ({
  date: row.date,
  amountMinor: row.amountMinor,
  description: row.description,
  counterparty: row.counterparty,
  reference: row.reference,
  rawRow: row.raw,
});

const makeDb = () => ({
  account: {
    upsert: vi.fn().mockResolvedValue({ id: 'account-1' }),
  },
  ledger: {
    upsert: vi.fn().mockResolvedValue({ id: 'ledger-7' }),
  },
  transaction: {
    findMany: vi.fn(),
    updateMany: vi.fn().mockResolvedValue({ count: 2 }),
    createMany: vi.fn().mockResolvedValue({ count: 2 }),
  },
  importBatch: {
    create: vi.fn().mockResolvedValue({ id: 'batch-1' }),
  },
});

describe('statementCsvImportService', () => {
  it('preserves an existing subset and inserts only missing bank facts', async () => {
    const db = makeDb();
    db.transaction.findMany
      .mockResolvedValueOnce([
        { id: 'existing-1', ...persistedBankFields(rows[0]), ledgerId: null },
        { id: 'existing-2', ...persistedBankFields(rows[1]), ledgerId: null },
      ])
      .mockResolvedValueOnce(rows.map(persistedBankFields));

    const result = await importStatementCsvRows(db as any, {
      userId: 'user-1',
      rows,
      csvBuffer: Buffer.from('july csv'),
      filename: 'july.csv',
    });

    expect(result).toMatchObject({ importedCount: 2, duplicateCount: 2, batchId: 'batch-1', ledgerId: 'ledger-7' });
    expect(db.transaction.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: { ledgerId: 'ledger-7' } }));
    expect(db.transaction.createMany).toHaveBeenCalledTimes(1);
    const inserted = db.transaction.createMany.mock.calls[0][0].data;
    expect(inserted).toHaveLength(2);
    expect(inserted.map((row: any) => row.amountMinor)).toEqual([11700n, 15000n]);
    expect(inserted.every((row: any) => row.classificationSource === 'none')).toBe(true);
    expect(inserted.every((row: any) => row.categoryId == null)).toBe(true);
  });

  it('is idempotent when every bank fact already exists', async () => {
    const db = makeDb();
    db.transaction.findMany.mockResolvedValueOnce(rows.map((row, index) => ({
      id: `existing-${index}`,
      ...persistedBankFields(row),
      ledgerId: 'ledger-7',
    })));

    const result = await importStatementCsvRows(db as any, {
      userId: 'user-1',
      rows,
      csvBuffer: Buffer.from('july csv'),
      filename: 'july-renamed.csv',
    });

    expect(result).toMatchObject({ importedCount: 0, duplicateCount: 4, batchId: null });
    expect(db.importBatch.create).not.toHaveBeenCalled();
    expect(db.transaction.createMany).not.toHaveBeenCalled();
  });

  it('rejects an existing bank fact that is absent from the uploaded statement', async () => {
    const db = makeDb();
    db.transaction.findMany.mockResolvedValueOnce([
      { id: 'unexpected', date: new Date('2026-07-01T00:00:00.000Z'), amountMinor: 999n, ledgerId: null },
    ]);

    await expect(importStatementCsvRows(db as any, {
      userId: 'user-1',
      rows,
      csvBuffer: Buffer.from('july csv'),
      filename: 'july.csv',
    })).rejects.toMatchObject<Partial<StatementCsvImportError>>({
      code: 'STATEMENT_EXISTING_FACTS_CONFLICT',
      statusCode: 409,
    });

    expect(db.transaction.createMany).not.toHaveBeenCalled();
  });

  it('preserves multiplicity for same-day same-amount transactions', async () => {
    const duplicateRows = [
      makeRow({ rowNumber: 1, date: new Date('2026-07-05T00:00:00.000Z'), amountMinor: -6759n, description: 'Amazon A', reference: 'A' }),
      makeRow({ rowNumber: 2, date: new Date('2026-07-05T00:00:00.000Z'), amountMinor: -6759n, description: 'Amazon B', reference: 'B' }),
    ];
    const db = makeDb();
    db.transaction.findMany
      .mockResolvedValueOnce([{ id: 'existing', ...persistedBankFields(duplicateRows[0]), ledgerId: 'ledger-7' }])
      .mockResolvedValueOnce(duplicateRows.map(persistedBankFields));
    db.transaction.createMany.mockResolvedValue({ count: 1 });

    const result = await importStatementCsvRows(db as any, {
      userId: 'user-1',
      rows: duplicateRows,
      csvBuffer: Buffer.from('duplicate july csv'),
      filename: 'july.csv',
    });

    expect(result.importedCount).toBe(1);
    expect(result.duplicateCount).toBe(1);
    expect(db.transaction.createMany.mock.calls[0][0].data).toHaveLength(1);
  });

  it('imports truly identical repeated bank rows as separate occurrences', async () => {
    const duplicateRows = [
      makeRow({ rowNumber: 1, date: new Date('2026-07-06T00:00:00.000Z'), amountMinor: -6759n, description: 'Same payment', reference: 'SAME' }),
      makeRow({ rowNumber: 2, date: new Date('2026-07-06T00:00:00.000Z'), amountMinor: -6759n, description: 'Same payment', reference: 'SAME' }),
    ];
    const db = makeDb();
    db.transaction.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce(duplicateRows.map(persistedBankFields));
    db.transaction.createMany.mockResolvedValue({ count: 2 });

    const result = await importStatementCsvRows(db as any, {
      userId: 'user-1',
      rows: duplicateRows,
      csvBuffer: Buffer.from('identical repeats'),
      filename: 'july.csv',
    });

    expect(result).toMatchObject({ importedCount: 2, duplicateCount: 0 });
    const inserted = db.transaction.createMany.mock.calls[0][0].data;
    expect(inserted[0].hash).not.toBe(inserted[1].hash);
    expect(inserted[0].importFingerprint).not.toBe(inserted[1].importFingerprint);
  });

  it('rejects same-date same-amount existing data when bank identity fields changed', async () => {
    const uploaded = makeRow({
      date: new Date('2026-07-07T00:00:00.000Z'),
      amountMinor: -6759n,
      description: 'Original counterparty',
      reference: 'REF-A',
    });
    const existingChanged = makeRow({
      date: uploaded.date,
      amountMinor: uploaded.amountMinor,
      description: 'Changed counterparty',
      reference: 'REF-B',
    });
    const db = makeDb();
    db.transaction.findMany.mockResolvedValueOnce([{
      id: 'existing',
      ...persistedBankFields(existingChanged),
      ledgerId: 'ledger-7',
    }]);

    await expect(importStatementCsvRows(db as any, {
      userId: 'user-1',
      rows: [uploaded],
      csvBuffer: Buffer.from('changed identity'),
      filename: 'july.csv',
    })).rejects.toMatchObject<Partial<StatementCsvImportError>>({
      code: 'STATEMENT_EXISTING_FACTS_CONFLICT',
      statusCode: 409,
    });
    expect(db.transaction.createMany).not.toHaveBeenCalled();
  });
});
