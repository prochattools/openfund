import { parseDate, toMinorUnits, applyDebitCredit, normalizeWhitespace, extractReference } from './normalizers';
import type { HistoricalDirection } from './historicalControls';

export type HistoricalWorkbookRow = Record<string, unknown>;

export type ParsedHistoricalWorkbookRow = {
  rowNumber: number;
  date: Date;
  accountIdentifier: string | null;
  counterparty: string | null;
  code: string | null;
  direction: HistoricalDirection;
  amountMinor: bigint;
  resultingBalanceMinor: bigint | null;
  customerLabel: string | null;
  typeLabel: string | null;
  categoryLabel: string | null;
  paymentPurpose: string | null;
  normalizedPaymentPurpose: string;
  rawRow: HistoricalWorkbookRow;
  reference: string | null;
};

const toText = (value: unknown): string | null => {
  if (value == null) return null;
  const text = normalizeWhitespace(String(value));
  return text.length ? text : null;
};

const parseSignedAmount = (row: HistoricalWorkbookRow): bigint | null => {
  const debitCredit = toText(row['Debit/credit']);
  const amount = toMinorUnits(row['Amount (EUR)'] ?? row['Bedrag']);
  return applyDebitCredit(amount, debitCredit);
};

export const parseHistoricalWorkbookRows = (rows: HistoricalWorkbookRow[]): ParsedHistoricalWorkbookRow[] =>
  rows.map((row, index) => {
    const rowNumber = index + 2;
    const date = parseDate(row.Date);
    if (!date) {
      throw new Error(`Invalid workbook date at row ${rowNumber}`);
    }
    const amountMinor = parseSignedAmount(row);
    if (amountMinor == null) {
      throw new Error(`Invalid workbook amount at row ${rowNumber}`);
    }
    const paymentPurpose = toText(row.Notifications ?? row.Notification);
    return {
      rowNumber,
      date,
      accountIdentifier: toText(row.Account),
      counterparty: toText(row.Counterparty),
      code: toText(row.Code),
      direction: (toText(row['Debit/credit'])?.toLowerCase() === 'debit' ? 'debit' : 'credit'),
      amountMinor,
      resultingBalanceMinor: row['Resulting balance'] == null ? null : toMinorUnits(row['Resulting balance']),
      customerLabel: toText(row.Klant),
      typeLabel: toText(row.Type),
      categoryLabel: toText(row.Category),
      paymentPurpose: paymentPurpose ?? null,
      normalizedPaymentPurpose: paymentPurpose ? paymentPurpose.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim() : '',
      rawRow: row,
      reference: extractReference(paymentPurpose ?? undefined),
    };
  });

