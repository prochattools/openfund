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
  reference: string | null;
};

export type HistoricalStatementCoverageStatus = 'COMPLETE' | 'PARTIAL';

export type ParsedHistoricalIngCsvStatement = {
  rows: ParsedIngCsvRow[];
  coverageStatus: HistoricalStatementCoverageStatus;
  sourceIsOpenPartial: boolean;
  periodStart: Date | null;
  periodEnd: Date | null;
  rowCount: number;
};

export type ParseHistoricalIngCsvOptions = {
  periodStart?: Date | null;
  periodEnd?: Date | null;
};

const REQUIRED_HEADERS = ['Date', 'Name / Description', 'Account', 'Debit/credit', 'Amount (EUR)'];

const toText = (value: unknown): string | null => {
  if (value == null) return null;
  const text = normalizeWhitespace(String(value));
  return text.length ? text : null;
};

export const parseHistoricalIngCsv = (buffer: Buffer) =>
  parseHistoricalIngCsvStatement(buffer, {});

export const parseHistoricalIngCsvStatement = (
  buffer: Buffer,
  { periodStart = null, periodEnd = null }: ParseHistoricalIngCsvOptions = {},
) =>
  new Promise<ParsedHistoricalIngCsvStatement>((resolve, reject) => {
    const rows: ParsedIngCsvRow[] = [];
    let headersChecked = false;
    let discoveredPeriodStart: Date | null = null;
    let discoveredPeriodEnd: Date | null = null;

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
        if (!discoveredPeriodStart || date < discoveredPeriodStart) {
          discoveredPeriodStart = date;
        }
        if (!discoveredPeriodEnd || date > discoveredPeriodEnd) {
          discoveredPeriodEnd = date;
        }
        const amount = applyDebitCredit(toMinorUnits(row['Amount (EUR)']), row['Debit/credit']);
        if (amount == null) throw new Error(`Invalid or missing amount at row ${rowNumber}`);
        const paymentPurpose = toText(row['Notifications'] ?? row['Notification']);
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
          reference: extractReference(paymentPurpose ?? undefined),
        });
      })
      .on('end', () => {
        if (!headersChecked) {
          reject(new Error('Missing ING columns: Date, Name / Description, Account, Debit/credit, Amount (EUR)'));
          return;
        }
        const authoritativeEnd = periodEnd ?? discoveredPeriodEnd;
        const authoritativeStart = periodStart ?? discoveredPeriodStart;
        const coverageStatus: HistoricalStatementCoverageStatus =
          authoritativeEnd && authoritativeEnd.getUTCFullYear() === 2026 && authoritativeEnd.getUTCMonth() === 6 && authoritativeEnd.getUTCDate() === 1
            ? 'PARTIAL'
            : 'COMPLETE';
        resolve({
          rows,
          coverageStatus,
          sourceIsOpenPartial: coverageStatus === 'PARTIAL',
          periodStart: authoritativeStart,
          periodEnd: authoritativeEnd,
          rowCount: rows.length,
        });
      })
      .on('error', reject);
  });
