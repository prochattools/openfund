import { parseString } from 'fast-csv';
import { applyDebitCredit, extractReference, parseDate, toMinorUnits, normalizeWhitespace } from './normalizers';
import type { HistoricalDirection } from './historicalControls';

export type ParsedIngCsvRow = {
  rowNumber: number;
  date: Date;
  direction: HistoricalDirection;
  amountMinor: bigint;
  resultingBalanceMinor: bigint | null;
  accountIdentifier: string | null;
  counterparty: string | null;
  code: string | null;
  paymentPurpose: string | null;
  normalizedPaymentPurpose: string;
  rawRow: Record<string, unknown>;
  coverageStatus: 'COMPLETE' | 'PARTIAL';
  sourceIsOpenPartial: boolean;
  reference: string | null;
};

const REQUIRED_HEADERS = ['Date', 'Name / Description', 'Account', 'Debit/credit', 'Amount (EUR)'];

const toText = (value: unknown): string | null => {
  if (value == null) return null;
  const text = normalizeWhitespace(String(value));
  return text.length ? text : null;
};

export const parseHistoricalIngCsv = (buffer: Buffer) =>
  new Promise<ParsedIngCsvRow[]>((resolve, reject) => {
    const rows: ParsedIngCsvRow[] = [];
    let headersChecked = false;

    const parser = parseString(buffer.toString('utf-8'), { headers: true, delimiter: ';', trim: true })
      .on('headers', (headers: string[]) => {
        headersChecked = true;
        const missing = REQUIRED_HEADERS.filter((header) => !headers.includes(header));
        if (missing.length) {
          reject(new Error(`Missing ING columns: ${missing.join(', ')}`));
          parser.destroy();
        }
      })
      .on('data', (row: Record<string, string>) => {
        const rowNumber = rows.length + 2;
        if (!row || Object.values(row).every((value) => value == null || value === '')) return;
        const date = parseDate(row.Date);
        if (!date) throw new Error(`Invalid or missing transaction date at row ${rowNumber}`);
        const amount = applyDebitCredit(toMinorUnits(row['Amount (EUR)']), row['Debit/credit']);
        if (amount == null) throw new Error(`Invalid or missing amount at row ${rowNumber}`);
        const paymentPurpose = toText(row['Notifications'] ?? row['Notification']);
        const coverageStatus = date <= new Date(Date.UTC(2026, 6, 1)) ? 'PARTIAL' : 'COMPLETE';
        rows.push({
          rowNumber,
          date,
          direction: row['Debit/credit']?.trim().toLowerCase() === 'debit' ? 'debit' : 'credit',
          amountMinor: amount,
          resultingBalanceMinor: row['Resulting balance'] == null ? null : toMinorUnits(row['Resulting balance']),
          accountIdentifier: toText(row.Account),
          counterparty: toText(row.Counterparty),
          code: toText(row.Code),
          paymentPurpose,
          normalizedPaymentPurpose: paymentPurpose ? paymentPurpose.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim() : '',
          rawRow: row,
          coverageStatus,
          sourceIsOpenPartial: coverageStatus === 'PARTIAL',
          reference: extractReference(paymentPurpose ?? undefined),
        });
      })
      .on('end', () => {
        if (!headersChecked) {
          reject(new Error('Missing ING columns: Date, Name / Description, Account, Debit/credit, Amount (EUR)'));
          return;
        }
        resolve(rows);
      })
      .on('error', reject);
  });

