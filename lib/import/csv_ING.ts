import { parseString } from 'fast-csv';
import { buildNormalizedTransaction, extractReference } from './normalizers';
import type { ParseResult, ParsedRowSuccess, ParsedRowError } from './types';

const ING_DELIMITER = ';';
const REQUIRED_ING_COLUMNS = [
  'Date',
  'Name / Description',
  'Account',
  'Debit/credit',
  'Amount (EUR)',
];

export const parseIngCsv = (buffer: Buffer): Promise<ParseResult> =>
  new Promise((resolve, reject) => {
    const successes: ParsedRowSuccess[] = [];
    const errors: ParsedRowError[] = [];

    let rowNumber = 1;
    let fatalError = false;

    const stream = parseString(buffer.toString('utf-8'), {
      headers: true,
      delimiter: ING_DELIMITER,
      trim: true,
    })
      .on('headers', (headers: string[]) => {
        const missing = REQUIRED_ING_COLUMNS.filter((column) => !headers.includes(column));
        if (missing.length) {
          fatalError = true;
          reject(new Error(`Missing ING columns: ${missing.join(', ')}`));
          stream.destroy();
        }
      })
      .on('error', (error) => {
        if (!fatalError) {
          reject(error);
        }
      })
      .on('data', (row: Record<string, string>) => {
        rowNumber += 1;

        if (!row || Object.values(row).every((value) => value == null || value === '')) {
          return;
        }

        const paymentPurpose = row['Notifications'] ?? row['Notification'] ?? null;
        const reference = extractReference(paymentPurpose);
        const result = buildNormalizedTransaction({
          rowNumber,
          accountIdentifier: row['Account'],
          accountName: row['Account'] ?? null,
          currency: 'EUR',
          date: row['Date'],
          description: row['Name / Description'],
          counterparty: row['Counterparty'],
          paymentPurpose,
          amount: row['Amount (EUR)'],
          debitCredit: row['Debit/credit'],
          reference,
          source: 'ing_csv',
          raw: row,
        });

        if ('error' in result) {
          errors.push({
            rowNumber,
            message: result.error,
            raw: row,
          });
          return;
        }

        successes.push({
          ...result.result,
          rowNumber,
        });
      })
      .on('end', () => {
        resolve({
          successes,
          errors,
          format: 'csv_ing',
        });
      });
  });
