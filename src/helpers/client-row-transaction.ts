import { resolveAccountMetadata } from './account-metadata';
import { normaliseDescription, parseAmount, parseDateString, sanitizeNotification } from './client-import-normalizers';
import type { LedgerTransaction } from './api-transaction-mapper';

export type ParsedRow = {
  [key: string]: string | undefined;
  date?: string;
  Date?: string;
  transactionDate?: string;
  description?: string;
  Description?: string;
  memo?: string;
  amount?: string;
  Amount?: string;
  transactionAmount?: string;
  source?: string;
  Source?: string;
  merchant?: string;
  'Name / Description'?: string;
  Counterparty?: string;
  'Counter Party'?: string;
  'Debit/credit'?: string;
  'Debit Credit'?: string;
  'Amount (EUR)'?: string;
  'Booking date'?: string;
  Notifications?: string;
  notifications?: string;
};

export type PreparedLedgerTransaction = Omit<
  LedgerTransaction,
  'categoryId' | 'categoryName' | 'mainCategoryId' | 'mainCategoryName' | 'autoCategorized' | 'needsManualCategory'
>;

export const createLedgerId = (): string =>
  typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `gen-${Date.now()}-${Math.random()}`;

export const buildTransactionFromRow = (
  row: ParsedRow,
  createId: () => string = createLedgerId,
  now: () => Date = () => new Date(),
): PreparedLedgerTransaction | null => {
  const rawDate = row.date ?? row.Date ?? row.transactionDate ?? row['Booking date'] ?? row['Date'];
  const rawDescription =
    row['Name / Description'] ?? row.description ?? row.Description ?? row.memo ?? row['Description'];
  const rawAmount = row['Amount (EUR)'] ?? row.amount ?? row.Amount ?? row.transactionAmount ?? row['Amount'];
  const rawSource =
    row.Counterparty ?? row['Counter Party'] ?? row.source ?? row.Source ?? row.merchant ?? rawDescription;
  const rawDebitCredit = row['Debit/credit'] ?? row['Debit Credit'];
  const notificationDetail = sanitizeNotification(row.Notifications ?? row.notifications);
  const counterpartyAccountRaw = row.Counterparty ?? row['Counter Party'];
  const counterpartyAccount = typeof counterpartyAccountRaw === 'string' ? counterpartyAccountRaw.trim() : null;

  if (!rawDate || !rawDescription || !rawAmount) {
    return null;
  }

  const parsedDate = parseDateString(String(rawDate));
  const amount = parseAmount(String(rawAmount), rawDebitCredit);

  if (!parsedDate || amount === null) {
    return null;
  }

  const normalizedKey = normaliseDescription(String(rawDescription));
  const sourceValue = (rawSource ?? rawDescription).trim();
  const { label: accountLabel, identifier: accountIdentifier } = resolveAccountMetadata(rawSource ?? rawDescription);

  return {
    id: createId(),
    date: parsedDate.toISOString(),
    description: String(rawDescription).trim(),
    amount,
    direction: amount >= 0 ? 'credit' : 'debit',
    source: sourceValue,
    accountLabel: accountLabel ?? null,
    accountIdentifier: accountLabel ? accountIdentifier ?? sourceValue : null,
    normalizedKey,
    notificationDetail,
    counterpartyAccount: counterpartyAccount ?? null,
    ledgerMonth: parsedDate.getUTCMonth() + 1,
    ledgerYear: parsedDate.getUTCFullYear(),
    createdAt: now().toISOString(),
  };
};
