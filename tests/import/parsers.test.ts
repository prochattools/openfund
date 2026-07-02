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

  it('keeps valid ING CSV rows and reports invalid rows without crashing', async () => {
    const csv = [
      'Date;Name / Description;Account;Counterparty;Debit/credit;Amount (EUR);Notifications',
      '20260514;Gift voor zending;NL89INGB0006369960;Donor Naam;Credit;25,00;Reference: GIFT-1',
      'geen datum;Ongeldige datum;NL89INGB0006369960;Donor Naam;Debit;10,00;',
      '',
    ].join('\n');

    const result = await parseIngCsv(Buffer.from(csv, 'utf-8'));

    expect(result.format).toBe('csv_ing');
    expect(result.successes).toHaveLength(1);
    expect(result.errors).toHaveLength(1);
    expect(result.successes[0]).toMatchObject({
      accountIdentifier: 'NL89INGB0006369960',
      description: 'Gift voor zending',
      amountMinor: 2500n,
      paymentPurpose: 'Reference: GIFT-1',
      normalizedPaymentPurpose: 'reference gift1',
      reference: 'GIFT-1',
      source: 'ing_csv',
    });
    expect(result.errors[0]).toMatchObject({
      rowNumber: 3,
      message: 'Invalid or missing transaction date',
    });
  });

  it('returns a workbook row error when the configured sheet is missing', () => {
    const result = parseInitialWorkbook(Buffer.from([]), { sheetName: 'bestaat niet' });

    expect(result).toEqual({
      successes: [],
      errors: [
        {
          rowNumber: 0,
          message: 'Sheet "bestaat niet" not found',
          raw: null,
        },
      ],
      format: 'xlsx_initial',
    });
  });
});