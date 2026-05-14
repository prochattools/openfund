import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';
import { parseIngCsv } from '../../lib/import/csv_ING';
import { parseInitialWorkbook } from '../../lib/import/xlsx';

const csvPath = path.resolve(__dirname, '../../sheets/NL89INGB0006369960_2025-06-01_2025-06-30.csv');
const xlsxPath = path.resolve(__dirname, '../../sheets/Overzicht_Yeshua_Academy_Jun_2025.xlsx');

describe('statement parsers', () => {
  it('normalizes ING CSV rows', async () => {
    const buffer = fs.readFileSync(csvPath);
    const result = await parseIngCsv(buffer);

    expect(result.successes.length).toBeGreaterThan(0);
    expect(result.errors).toHaveLength(0);

    const tx = result.successes[0]!;
    expect(tx.accountIdentifier).toEqual('NL89INGB0006369960');
    expect(tx.amountMinor).toBeTypeOf('bigint');
    expect(tx.date.toISOString()).toMatch(/^2025-/);
  });

  it('rejects non-ING CSV files with missing required columns', async () => {
    const buffer = Buffer.from('foo;bar\n1;2\n', 'utf-8');

    await expect(parseIngCsv(buffer)).rejects.toThrow(/Missing ING columns/);
  });

  it('extracts transactions from the initial XLSX workbook', () => {
    const buffer = fs.readFileSync(xlsxPath);
    const result = parseInitialWorkbook(buffer, { sheetName: 'transacties 2025' });

    expect(result.successes.length).toBeGreaterThan(0);
    const tx = result.successes[0]!;

    expect(tx.accountIdentifier).toEqual('NL89INGB0006369960');
    expect(tx.amountMinor).toBeTypeOf('bigint');
    expect(tx.source).toEqual('xlsx_initial');
  });
});
