import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../lib/import/csv_ING', () => ({
  parseIngCsv: vi.fn(),
}));
vi.mock('../../server/services/ingStatementPdfService', () => ({
  extractIngStatementPdfControls: vi.fn(),
  IngStatementPdfError: class IngStatementPdfError extends Error { statusCode = 422; },
}));
vi.mock('../../server/services/importService', () => ({
  processImportBufferWithClient: vi.fn(),
}));
vi.mock('../../server/services/statementControlService', () => ({
  hashSourceContent: vi.fn((buffer: Buffer) => `sha:${buffer.toString('utf8')}`),
  storeSourceFile: vi.fn(),
  acceptBankStatement: vi.fn(),
}));

import { parseIngCsv } from '../../lib/import/csv_ING';
import { extractIngStatementPdfControls } from '../../server/services/ingStatementPdfService';
import { processImportBufferWithClient } from '../../server/services/importService';
import { acceptBankStatement, storeSourceFile } from '../../server/services/statementControlService';
import { importMonthlyStatementPackage } from '../../server/services/monthlyStatementPackageService';

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

const makeDb = () => ({
  account: { findUnique: vi.fn().mockResolvedValue({ id: 'account-1' }) },
  bankStatement: { findFirst: vi.fn().mockResolvedValue(null) },
  transaction: {
    count: vi.fn().mockResolvedValue(2),
    findMany: vi.fn().mockResolvedValue(rows.map((row) => ({ date: row.date, amountMinor: row.amountMinor }))),
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
  it('backfills evidence when existing transactions match immutable bank date+amount facts', async () => {
    const db = makeDb();
    const result = await importMonthlyStatementPackage({
      db: db as any,
      userId: 'user-1', workspaceId: 'workspace-1', expectedMonthKey: '2026-06',
      csv: { buffer: Buffer.from('csv'), filename: 'june.csv', mediaType: 'text/csv' },
      pdf: { buffer: Buffer.from('pdf'), filename: 'june.pdf', mediaType: 'application/pdf' },
    });

    expect(result.status).toBe('EVIDENCE_BACKFILLED');
    expect(processImportBufferWithClient).not.toHaveBeenCalled();
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

  it('blocks historical backfill when immutable bank date+amount facts differ', async () => {
    const db = makeDb();
    db.transaction.findMany.mockResolvedValue([{ date: rows[0].date, amountMinor: 999n }, { date: rows[1].date, amountMinor: -200n }]);
    await expect(importMonthlyStatementPackage({
      db: db as any,
      userId: 'user-1', workspaceId: 'workspace-1', expectedMonthKey: '2026-06',
      csv: { buffer: Buffer.from('csv'), filename: 'june.csv', mediaType: 'text/csv' },
      pdf: { buffer: Buffer.from('pdf'), filename: 'june.pdf', mediaType: 'application/pdf' },
    })).rejects.toMatchObject({ code: 'EXISTING_LEDGER_MISMATCH', statusCode: 409 });
    expect(storeSourceFile).not.toHaveBeenCalled();
  });
});
