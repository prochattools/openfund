import crypto from 'crypto';
import { normalizeAccountIdentifier, normalizeWhitespace } from '../../lib/import/normalizers';

const sanitizeText = (value: string | null | undefined): string => {
  if (!value) return '';
  return normalizeWhitespace(value).toLowerCase();
};

const sanitizeAccount = (value: string | null | undefined): string => {
  if (!value) return '';
  return normalizeAccountIdentifier(value);
};

const normalizeRawValue = (value: unknown): unknown => {
  if (typeof value === 'string') return sanitizeText(value);
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) return value.map(normalizeRawValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right, 'en'))
        .map(([key, nested]) => [key.toLowerCase(), normalizeRawValue(nested)]),
    );
  }
  return value ?? null;
};

const readNotificationField = (raw: Record<string, unknown> | null | undefined, key: string): string | null => {
  if (!raw) return null;
  const value = raw[key];
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number') {
    return value.toString();
  }
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const nested = value as Record<string, unknown>;
    if ('columns' in nested && typeof nested.columns === 'object' && nested.columns) {
      const columns = nested.columns as Record<string, unknown>;
      if (typeof columns[key] === 'string') {
        return columns[key] as string;
      }
    }
  }
  return null;
};

const extractNotifications = (raw: Record<string, unknown> | null | undefined): string | null => {
  if (!raw) return null;
  const direct =
    readNotificationField(raw, 'Notifications') ??
    readNotificationField(raw, 'Notification') ??
    readNotificationField(raw, 'notifications');

  if (direct) {
    return direct;
  }

  if ('columns' in raw && typeof raw.columns === 'object' && raw.columns && !Array.isArray(raw.columns)) {
    const columns = raw.columns as Record<string, unknown>;
    const value = columns['Notifications'] ?? columns['Notification'];
    if (typeof value === 'string') {
      return value;
    }
  }

  return null;
};

const extractRawSourceFields = (raw: Record<string, unknown> | null | undefined): string => {
  if (!raw) return '';
  const columns = raw.columns && typeof raw.columns === 'object' && !Array.isArray(raw.columns)
    ? raw.columns as Record<string, unknown>
    : {};
  const flattened = { ...raw, ...columns };
  const identityKeys = new Set([
    'account',
    'amount (eur)',
    'counterparty',
    'date',
    'debit/credit',
    'name / description',
    'notification',
    'notifications',
    'reference',
  ]);
  const entries = Object.entries(flattened)
    .filter(([key]) => key !== 'columns' && !identityKeys.has(key.trim().toLowerCase()))
    .sort(([left], [right]) => left.localeCompare(right, 'en'))
    .map(([key, value]) => [key.trim().toLowerCase(), normalizeRawValue(value)]);
  return JSON.stringify(entries);
};

export type ImportFingerprintInput = {
  accountIdentifier: string;
  date: Date;
  amountMinor: bigint;
  description: string;
  counterparty?: string | null;
  reference?: string | null;
  raw?: Record<string, unknown> | null;
};

export type BankFactIdentityInput = ImportFingerprintInput;

const assertOccurrence = (occurrence: number): void => {
  if (!Number.isInteger(occurrence) || occurrence < 1) {
    throw new Error('Bank fact occurrence must be a positive integer.');
  }
};

export const buildBankFactIdentity = ({
  accountIdentifier,
  date,
  amountMinor,
  description,
  counterparty,
  reference,
  raw,
}: BankFactIdentityInput): string => JSON.stringify({
  account: sanitizeAccount(accountIdentifier),
  date: date.toISOString(),
  amountMinor: amountMinor.toString(),
  description: sanitizeText(description),
  counterparty: sanitizeText(counterparty),
  reference: sanitizeText(reference),
  notifications: sanitizeText(extractNotifications(raw)),
  sourceFields: extractRawSourceFields(raw),
});

export const buildBankFactHash = ({
  userId,
  occurrence = 1,
  ...input
}: BankFactIdentityInput & { userId: string; occurrence?: number }): string => {
  assertOccurrence(occurrence);
  return crypto
    .createHash('sha256')
    .update(`${userId}|${buildBankFactIdentity(input)}|${occurrence}`)
    .digest('hex');
};

/**
 * Fingerprint format used by transactions imported before the bank-fact
 * identity format was introduced. Keep this available for read-only lookup
 * compatibility; new writes must continue using buildImportFingerprint.
 */
export const buildLegacyImportFingerprint = ({
  accountIdentifier,
  date,
  amountMinor,
  description,
  counterparty,
  reference,
  raw,
}: ImportFingerprintInput): string => {
  const base = [
    sanitizeAccount(accountIdentifier),
    date.toISOString(),
    amountMinor.toString(),
    sanitizeText(description),
    sanitizeText(counterparty),
    sanitizeText(reference),
    sanitizeText(extractNotifications(raw) ?? null),
  ].join('|');

  return crypto.createHash('sha256').update(base).digest('hex');
};

export const buildImportFingerprint = ({
  accountIdentifier,
  date,
  amountMinor,
  description,
  counterparty,
  reference,
  raw,
  occurrence = 1,
}: ImportFingerprintInput & { occurrence?: number }): string => {
  assertOccurrence(occurrence);
  return crypto
    .createHash('sha256')
    .update(`${buildBankFactIdentity({ accountIdentifier, date, amountMinor, description, counterparty, reference, raw })}|${occurrence}`)
    .digest('hex');
};
