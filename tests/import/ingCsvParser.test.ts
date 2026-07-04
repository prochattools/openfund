import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseHistoricalIngCsv } from '../../lib/import/ingCsvParser';

const csv = fs.readFileSync(path.resolve(__dirname, '../fixtures/historical-loading/2026-ing.csv'));

describe('ING CSV parser', () => {
  it('parses 2026 rows as open/partial and preserves raw evidence', async () => {
    const rows = await parseHistoricalIngCsv(csv);

    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      rowNumber: 2,
      coverageStatus: 'PARTIAL',
      sourceIsOpenPartial: true,
      direction: 'credit',
      amountMinor: 5000n,
      resultingBalanceMinor: 105000n,
      reference: 'FIX-2026-A',
    });
    expect(rows[1].date.toISOString()).toBe('2026-07-01T00:00:00.000Z');
  });
});

