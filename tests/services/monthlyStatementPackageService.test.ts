import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../lib/import/csv_ING', () => ({
  parseIngCsv: vi.fn(),
}));
vi.mock('../../server/services/ingStatementPdfService', () => ({
  extractIngStatementPdfControls: vi.fn(),
  IngStatementPdfError: class IngStatementPdfError extends Error { statusCode = 422; },
}));
vi.mock('../../server/services/statementCsvImportService', () => ({
  importStatementCsvRows: vi.fn(),
  StatementCsvImportError: class StatementCsvImportError extends Error {
    code = 'STATEMENT_IMPORT_FAILED';
    statusCode = 409;
  },
}));
vi.mock('../../server/services/statementControlService', () => ({
  hashSourceContent: vi.fn((buffer: Buffer) => `sha:${buffer.toString('utf8')}`),
  storeSourceFile: vi.fn(),
  acceptBankStatement: vi.fn(),
}));

import { parseIngCsv } from '../../lib/import/csv_ING';
import { extractIngStatementPdfControls } from '../../server/services/ingStatementPdfService';
import { importStatementCsvRows } from '../../server/services/statementCsvImportService';
import { acceptBankStatement, storeSourceFile } from '../../server/services/statementControlService';
import {
  finalizeStagedMonthlyStatement,
  importMonthlyStatementEvidence,
  importMonthlyStatementPackage,
} from '../../server/services/monthlyStatementPackageService';

const rows = [
  { accountIdentifier: 'NL89INGB0006369960', date: new Date('2026-06-03T00:00:00.000Z'), amountMinor: 500n, description: 'A', counterparty: 'A', reference: null, raw: {} },
  { accountIdentifier: 'NL89INGB0006369960', date: new Date('2026-06-04T00:00:00.000Z'), amountMinor: -200n, description: 'B', counterparty: 'B', reference: null, raw: {} },
];
const controls = {
  bankAccountIdentifier: 'NL89INGB0006369960',
  periodStart: new Date('2026-06-01T00:00:00.000Z'),
  periodEnd: new Date('2026-06-30T00:00:00.000Z'),
  openingBalanceMinor: 1000n,
  incomeMinor: 500n,
  expenseMinor: 200n,
  closingBalanceMinor: 1300n,
};

const persistedRow = (row: typeof rows[number]) => ({
  date: row.date,
  amountMinor: row.amountMinor,
  description: row.description,
  counterparty: row.counterparty,
  reference: row.reference,
  rawRow: row.raw,
});

const makeDb = () => ({
  account: { findUnique: vi.fn().mockResolvedValue({ id: 'account-1' }) },
  bankStatement: { findFirst: vi.fn().mockResolvedValue(null) },
  transaction: {
    count: vi.fn().mockResolvedValue(2),
    findMany: vi.fn().mockResolvedValue(rows.map(persistedRow)),
  },
  ledger: { findFirst: vi.fn().mockResolvedValue({ id: 'ledger-1', lockedAt: new Date() }), update: vi.fn() },
});

beforeEach(() => {
  vi.clearAllMocks();
  (parseIngCsv as ReturnType<typeof vi.fn>).mockResolvedValue({ successes: rows, errors: [] });
  (extractIngStatementPdfControls as ReturnType<typeof vi.fn>).mockResolvedValue(controls);
  (storeSourceFile as ReturnType<typeof vi.fn>)
    .mockResolvedValueOnce({ id: 'csv-source' })
    .mockResolvedValueOnce({ id: 'pdf-source' });
  (acceptBankStatement as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'statement-1' });
});

describe('monthly statement package historical backfill', () => {
  it('backfills evidence when existing transactions match the complete immutable bank facts', async () => {
    const db = makeDb();
    const result = await importMonthlyStatementPackage({
      db: db as any,
      userId: 'user-1', workspaceId: 'workspace-1', expectedMonthKey: '2026-06',
      csv: { buffer: Buffer.from('csv'), filename: 'june.csv', mediaType: 'text/csv' },
      pdf: { buffer: Buffer.from('pdf'), filename: 'june.pdf', mediaType: 'application/pdf' },
    });

    expect(result.status).toBe('EVIDENCE_BACKFILLED');
    expect(importStatementCsvRows).not.toHaveBeenCalled();
    expect(storeSourceFile).toHaveBeenCalledTimes(2);
    expect(acceptBankStatement).toHaveBeenCalledTimes(1);
  });

  it('rejects files that do not match the selected administration month', async () => {
    const db = makeDb();
    await expect(importMonthlyStatementPackage({
      db: db as any,
      userId: 'user-1', workspaceId: 'workspace-1', expectedMonthKey: '2026-07',
      csv: { buffer: Buffer.from('csv'), filename: 'june.csv', mediaType: 'text/csv' },
      pdf: { buffer: Buffer.from('pdf'), filename: 'june.pdf', mediaType: 'application/pdf' },
    })).rejects.toMatchObject({ code: 'SELECTED_MONTH_MISMATCH', statusCode: 422 });
    expect(storeSourceFile).not.toHaveBeenCalled();
  });

  it('blocks historical backfill when immutable bank facts differ', async () => {
    const db = makeDb();
    db.transaction.findMany.mockResolvedValue([
      persistedRow({ ...rows[0], amountMinor: 999n }),
      persistedRow(rows[1]),
    ]);
    await expect(importMonthlyStatementPackage({
      db: db as any,
      userId: 'user-1', workspaceId: 'workspace-1', expectedMonthKey: '2026-06',
      csv: { buffer: Buffer.from('csv'), filename: 'june.csv', mediaType: 'text/csv' },
      pdf: { buffer: Buffer.from('pdf'), filename: 'june.pdf', mediaType: 'application/pdf' },
    })).rejects.toMatchObject({ code: 'EXISTING_LEDGER_MISMATCH', statusCode: 409 });
    expect(storeSourceFile).not.toHaveBeenCalled();
  });

  it('does not treat matching files on a partial statement as complete evidence', async () => {
    const db = makeDb();
    db.bankStatement.findFirst.mockResolvedValue({
      id: 'partial-statement',
      sourceFile: { sha256: 'sha:csv' },
      supportingPdfFile: { sha256: 'sha:pdf' },
      coverageStatus: 'PARTIAL',
      openingBalanceMinor: controls.openingBalanceMinor,
      incomeMinor: controls.incomeMinor,
      expenseMinor: controls.expenseMinor,
      closingBalanceMinor: controls.closingBalanceMinor,
      transactionCount: rows.length,
      importBatchId: null,
    });

    await expect(importMonthlyStatementPackage({
      db: db as any,
      userId: 'user-1', workspaceId: 'workspace-1', expectedMonthKey: '2026-06',
      csv: { buffer: Buffer.from('csv'), filename: 'june.csv', mediaType: 'text/csv' },
      pdf: { buffer: Buffer.from('pdf'), filename: 'june.pdf', mediaType: 'application/pdf' },
    })).rejects.toMatchObject({ code: 'STATEMENT_CONFLICT', statusCode: 409 });
    expect(storeSourceFile).not.toHaveBeenCalled();
  });
});




describe('monthly statement package partial completion and staged evidence', () => {
  it('completes a partial historical month instead of treating an exact subset as a conflict', async () => {
    const db = makeDb();
    db.transaction.findMany
      .mockResolvedValueOnce([persistedRow(rows[0])])
      .mockResolvedValueOnce(rows.map(persistedRow));
    (importStatementCsvRows as ReturnType<typeof vi.fn>).mockResolvedValue({
      importedCount: 1,
      duplicateCount: 1,
      batchId: 'batch-1',
    });

    const result = await importMonthlyStatementPackage({
      db: db as any,
      userId: 'user-1', workspaceId: 'workspace-1', expectedMonthKey: '2026-06',
      csv: { buffer: Buffer.from('csv'), filename: 'june.csv', mediaType: 'text/csv' },
      pdf: { buffer: Buffer.from('pdf'), filename: 'june.pdf', mediaType: 'application/pdf' },
    });

    expect(result.status).toBe('IMPORTED');
    expect(importStatementCsvRows).toHaveBeenCalledWith(db, expect.objectContaining({
      userId: 'user-1',
      rows,
      filename: 'june.csv',
    }));
    expect(result.importedCount).toBe(1);
    expect(acceptBankStatement).toHaveBeenCalledTimes(1);
  });

  it('accepts CSV-only, imports/dedupes transactions, and stages evidence until PDF arrives', async () => {
    const db = makeDb() as any;
    db.sourceFile = { findMany: vi.fn().mockResolvedValue([]) };
    db.bankStatement.findFirst.mockResolvedValue(null);
    db.transaction.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce(rows.map(persistedRow));
    (importStatementCsvRows as ReturnType<typeof vi.fn>).mockResolvedValue({
      importedCount: 2,
      duplicateCount: 0,
      batchId: 'batch-csv',
    });
    (storeSourceFile as ReturnType<typeof vi.fn>).mockReset().mockResolvedValue({ id: 'csv-source' });

    const result = await importMonthlyStatementEvidence({
      db,
      userId: 'user-1', workspaceId: 'workspace-1', expectedMonthKey: '2026-06',
      csv: { buffer: Buffer.from('csv'), filename: 'june.csv', mediaType: 'text/csv' },
      pdf: null,
    });

    expect(result.status).toBe('CSV_IMPORTED');
    expect(result.importedCount).toBe(2);
    expect(result.bankStatementId).toBeNull();
  });

  it('accepts PDF-only and stages it until the matching CSV arrives', async () => {
    const db = makeDb() as any;
    db.sourceFile = { findMany: vi.fn().mockResolvedValue([]) };
    db.bankStatement.findFirst.mockResolvedValue(null);
    (storeSourceFile as ReturnType<typeof vi.fn>).mockReset().mockResolvedValue({ id: 'pdf-source' });

    const result = await importMonthlyStatementEvidence({
      db,
      userId: 'user-1', workspaceId: 'workspace-1', expectedMonthKey: '2026-06',
      csv: null,
      pdf: { buffer: Buffer.from('pdf'), filename: 'june.pdf', mediaType: 'application/pdf' },
    });

    expect(result.status).toBe('PDF_STAGED');
    expect(result.importedCount).toBe(0);
    expect(result.bankStatementId).toBeNull();
  });

  it('finalizes a matching staged CSV and PDF in a fresh transaction', async () => {
    const db = makeDb() as any;
    const stagedFiles = [
      { id: 'csv-source', filename: 'june.csv', mediaType: 'text/csv', content: Buffer.from('csv'), sha256: 'sha:csv' },
      { id: 'pdf-source', filename: 'june.pdf', mediaType: 'application/pdf', content: Buffer.from('pdf'), sha256: 'sha:pdf' },
    ];
    db.sourceFile = { findMany: vi.fn().mockResolvedValue(stagedFiles) };
    db.bankStatement.findFirst.mockResolvedValue(null);
    db.transaction.findMany.mockResolvedValue(rows.map(persistedRow));
    (storeSourceFile as ReturnType<typeof vi.fn>)
      .mockReset()
      .mockResolvedValueOnce({ id: 'csv-source' })
      .mockResolvedValueOnce({ id: 'pdf-source' });

    const result = await finalizeStagedMonthlyStatement({
      db,
      userId: 'user-1', workspaceId: 'workspace-1', expectedMonthKey: '2026-06',
    });

    expect(result?.status).toBe('EVIDENCE_BACKFILLED');
    expect(importStatementCsvRows).not.toHaveBeenCalled();
    expect(acceptBankStatement).toHaveBeenCalledTimes(1);
  });
});
