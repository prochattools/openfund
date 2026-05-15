import { describe, expect, it } from 'vitest';
import { parseCsvFile } from '../../src/helpers/client-csv-parser';

const makeFile = (content: string, name = 'transactions.csv') =>
  new File([content], name, { type: 'text/csv' });

describe('client CSV parser helper', () => {
  it('parses comma-separated CSV files and trims headers', async () => {
    const rows = await parseCsvFile(makeFile(' Date , Description , Amount \n20260515,Gift,25.00\n'));

    expect(rows).toEqual([
      {
        Date: '20260515',
        Description: 'Gift',
        Amount: '25.00',
      },
    ]);
  });

  it('falls back to semicolon-separated CSV files when comma parsing yields no rows', async () => {
    const rows = await parseCsvFile(makeFile('Date;Description;Amount\n20260515;Gift;25,00\n'));

    expect(rows).toEqual([
      {
        Date: '20260515',
        Description: 'Gift',
        Amount: '25,00',
      },
    ]);
  });

  it('skips empty lines', async () => {
    const rows = await parseCsvFile(makeFile('Date,Description,Amount\n\n20260515,Gift,25.00\n\n'));

    expect(rows).toHaveLength(1);
  });
});
