import { describe, expect, it } from 'vitest';
import { mapLedgerMeta, mapUploadSummary } from '../../src/helpers/ledger-response-mappers';

describe('ledger response mapper helpers', () => {
  it('maps ledger metadata and strips unknown fields', () => {
    const mapped = mapLedgerMeta([
      {
        id: 'ledger-1',
        month: 5,
        year: 2026,
        lockedAt: '2026-05-31T00:00:00.000Z',
        lockedBy: 'admin-1',
        lockNote: 'Afgesloten',
        ignored: 'value',
      } as any,
    ]);

    expect(mapped).toEqual([
      {
        id: 'ledger-1',
        month: 5,
        year: 2026,
        lockedAt: '2026-05-31T00:00:00.000Z',
        lockedBy: 'admin-1',
        lockNote: 'Afgesloten',
      },
    ]);
  });

  it('returns an empty ledger metadata list for missing or invalid input', () => {
    expect(mapLedgerMeta(undefined)).toEqual([]);
    expect(mapLedgerMeta(null)).toEqual([]);
  });

  it('maps server upload summary fields into client import summary fields', () => {
    expect(mapUploadSummary({
      importedCount: 10,
      autoCategorizedCount: 7,
      pendingReviewCount: 3,
      message: '10 transacties geïmporteerd',
      duplicateCount: 2,
      errorCount: 1,
      totalRows: 13,
      format: 'csv_ing',
      batchId: 'batch-1',
      errors: [{ rowNumber: 4, message: 'Ongeldige datum' }],
    })).toEqual({
      importedCount: 10,
      autoCategorized: 7,
      reviewCount: 3,
      message: '10 transacties geïmporteerd',
      duplicateCount: 2,
      errorCount: 1,
      totalRows: 13,
      format: 'csv_ing',
      batchId: 'batch-1',
      errors: [{ rowNumber: 4, message: 'Ongeldige datum' }],
    });
  });
});
