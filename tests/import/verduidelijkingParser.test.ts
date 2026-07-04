import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseVerduidelijkingRows } from '../../lib/import/verduidelijkingParser';

const rows = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, '../fixtures/historical-loading/verduidelijking-rows.json'), 'utf-8'),
);

describe('verduidelijking parser', () => {
  it('parses evidence only and does not rewrite history', () => {
    const parsed = parseVerduidelijkingRows(rows);

    expect(parsed).toEqual([
      {
        rowNumber: 1,
        rawRow: rows[0],
        label: 'Fixture Project',
        referenceText: 'Reference: FIX-2025-A',
        note: 'Interpretation evidence only',
      },
      {
        rowNumber: 2,
        rawRow: rows[1],
        label: 'Fixture Expense',
        referenceText: 'Reference: FIX-2025-B',
        note: 'Do not rewrite the booking history',
      },
    ]);
  });
});

