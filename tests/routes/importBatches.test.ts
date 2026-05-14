import { describe, expect, it } from 'vitest';
import { readImportBatchLimit } from '../../server/routes/importBatches';

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
});
