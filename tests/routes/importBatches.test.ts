import { describe, expect, it } from 'vitest';
import { readImportBatchLimit, serializeImportBatchSummary } from '../../server/routes/importBatches';

describe('import batch routes', () => {
  it('accepts valid positive limits up to 100', () => {
    expect(readImportBatchLimit('1')).toBe(1);
    expect(readImportBatchLimit('25')).toBe(25);
    expect(readImportBatchLimit('100')).toBe(100);
  });

  it('falls back to 25 for invalid limits', () => {
    expect(readImportBatchLimit(undefined)).toBe(25);
    expect(readImportBatchLimit('0')).toBe(25);
    expect(readImportBatchLimit('-1')).toBe(25);
    expect(readImportBatchLimit('101')).toBe(25);
    expect(readImportBatchLimit('abc')).toBe(25);
  });

  it('serializes import batch history rows with review counts and timestamps', () => {
    expect(serializeImportBatchSummary({
      id: 'batch-1',
      filename: 'ing.csv',
      fileType: 'csv_ing',
      status: 'completed',
      totalRows: 10,
      importedRows: 8,
      duplicateRows: 1,
      errorRows: 1,
      fileSizeBytes: 1024,
      fileSha256: 'abc123',
      originalFile: Buffer.from('csv'),
      autoCategorizedRows: 5,
      startedAt: new Date('2026-05-15T10:00:00.000Z'),
      completedAt: new Date('2026-05-15T10:01:00.000Z'),
    })).toEqual({
      id: 'batch-1',
      filename: 'ing.csv',
      fileType: 'csv_ing',
      status: 'completed',
      totalRows: 10,
      importedRows: 8,
      duplicateRows: 1,
      errorRows: 1,
      fileSizeBytes: 1024,
      fileSha256: 'abc123',
      hasOriginalFile: true,
      autoCategorizedRows: 5,
      reviewRows: 3,
      startedAt: '2026-05-15T10:00:00.000Z',
      completedAt: '2026-05-15T10:01:00.000Z',
    });
  });

  it('does not expose negative review counts when auto categorization exceeds imports', () => {
    expect(serializeImportBatchSummary({
      id: 'batch-2',
      filename: 'ing.csv',
      fileType: null,
      status: 'completed',
      totalRows: 1,
      importedRows: 1,
      duplicateRows: 0,
      errorRows: 0,
      fileSizeBytes: null,
      fileSha256: null,
      originalFile: null,
      autoCategorizedRows: 2,
      startedAt: new Date('2026-05-15T10:00:00.000Z'),
      completedAt: null,
    })).toMatchObject({
      hasOriginalFile: false,
      reviewRows: 0,
      completedAt: null,
    });
  });
});
