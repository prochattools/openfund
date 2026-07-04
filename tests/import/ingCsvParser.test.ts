import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseHistoricalIngCsvStatement } from '../../lib/import/ingCsvParser';

const csv = fs.readFileSync(path.resolve(__dirname, '../fixtures/historical-loading/2026-ing.csv'));

describe('ING CSV parser', () => {
  it('parses 2026 rows as statement-level partial/open and preserves raw evidence', async () => {
    const statement = await parseHistoricalIngCsvStatement(csv, {
      periodStart: new Date('2026-01-01T00:00:00.000Z'),
      periodEnd: new Date('2026-07-01T00:00:00.000Z'),
    });

    expect(statement).toMatchObject({
      coverageStatus: 'PARTIAL',
      sourceIsOpenPartial: true,
      rowCount: 2,
      periodStart: new Date('2026-01-01T00:00:00.000Z'),
      periodEnd: new Date('2026-07-01T00:00:00.000Z'),
    });
    expect(statement.rows).toHaveLength(2);
    expect(statement.rows[0]).toMatchObject({
      rowNumber: 2,
      direction: 'credit',
      amountMinor: 5000n,
      resultingBalanceMinor: 105000n,
      reference: 'FIX-2026-A',
      rawRow: expect.objectContaining({
        Date: '2026-01-01',
      }),
    });
    expect(statement.rows[1].date.toISOString()).toBe('2026-07-01T00:00:00.000Z');
    expect(statement.rows[0]).not.toHaveProperty('coverageStatus');
    expect(statement.rows[0]).not.toHaveProperty('sourceIsOpenPartial');
  });
});
