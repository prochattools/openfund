import type { TransactionDirection } from '@prisma/client';
import type { HistorySuggestionFacts } from './historySuggestionService';

export type SuggestionFactTransaction = {
  id: string;
  date: Date;
  accountId: string | null;
  direction: TransactionDirection;
  amountMinor: bigint;
  counterparty: string | null;
  reference: string | null;
  description: string;
  rawRow: unknown;
};

type RawRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is RawRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export const readSuggestionRawString = (
  rawRow: unknown,
  keys: string[],
): string | null => {
  if (!isRecord(rawRow)) return null;
  const columns = isRecord(rawRow.columns) ? rawRow.columns : null;
  for (const key of keys) {
    const direct = rawRow[key];
    if (typeof direct === 'string' && direct.trim()) return direct.trim();
    const nested = columns?.[key];
    if (typeof nested === 'string' && nested.trim()) return nested.trim();
  }
  return null;
};

export const toHistorySuggestionFacts = (
  transaction: SuggestionFactTransaction,
): HistorySuggestionFacts => ({
  transactionId: transaction.id,
  date: transaction.date,
  accountId: transaction.accountId,
  direction: transaction.direction,
  amountMinor: transaction.amountMinor,
  counterparty: transaction.counterparty,
  counterpartyIban: readSuggestionRawString(transaction.rawRow, [
    'Counterparty IBAN',
    'CounterpartyIban',
    'Counterparty account',
    'IBAN/BBAN',
  ]),
  description: transaction.description,
  paymentPurpose: readSuggestionRawString(transaction.rawRow, ['Notifications', 'Notification'])
    ?? transaction.reference,
});
