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
        { id: 'existing-1', date: rows[0].date, amountMinor: rows[0].amountMinor, ledgerId: null },
        { id: 'existing-2', date: rows[1].date, amountMinor: rows[1].amountMinor, ledgerId: null },
      ])
      .mockResolvedValueOnce(rows.map((row) => ({ date: row.date, amountMinor: row.amountMinor })));

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
      date: row.date,
      amountMinor: row.amountMinor,
      ledgerId: 'ledger-7',
    })));

    const result = await importStatementCsvRows(db as any, {
      userId: 'user-1',
      rows,
      csvBuffer: Buffer.from('july csv'),
      filename: 'july.csv',
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
      .mockResolvedValueOnce([{ id: 'existing', date: duplicateRows[0].date, amountMinor: -6759n, ledgerId: 'ledger-7' }])
      .mockResolvedValueOnce(duplicateRows.map((row) => ({ date: row.date, amountMinor: row.amountMinor })));
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
});
