import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseHistoricalWorkbookRows } from '../../lib/import/historicalWorkbookParser';

const fixture = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, '../fixtures/historical-loading/2025-workbook-rows.json'), 'utf-8'),
);

describe('historical workbook parser', () => {
  it('uses raw Date and preserves literal labels', () => {
    const rows = parseHistoricalWorkbookRows(fixture);

    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      date: new Date('2025-07-01T00:00:00.000Z'),
      customerLabel: 'FR',
      typeLabel: 'Schenking',
      categoryLabel: 'Fixture Income',
      amountMinor: 20000n,
      direction: 'credit',
      resultingBalanceMinor: 130000n,
    });
  });

  it('keeps helper dates as non-authoritative evidence only', () => {
    const rows = parseHistoricalWorkbookRows(fixture);
    expect(rows[0].rawRow.Jaartal).toBe('2024');
    expect(rows[0].date.toISOString()).toBe('2025-07-01T00:00:00.000Z');
  });
});

