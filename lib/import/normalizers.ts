import { NormalizedTransaction } from './types';

const DECIMAL_SEPARATOR_REGEX = /[.,]/;
const NON_NUMERIC_REGEX = /[^0-9]/g;

export const normalizeWhitespace = (value: string): string =>
  value.replace(/\s+/g, ' ').trim();

export const normalizeDescription = (value: string): string =>
  normalizeWhitespace(value)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

export const normalizeCounterparty = (value: string | null | undefined): string | null => {
  if (!value) return null;
  const trimmed = normalizeWhitespace(value);
  return trimmed.length ? trimmed : null;
};

export const normalizeAccountIdentifier = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Z0-9]/gi, '')
    .toUpperCase();

const ensureString = (value: unknown): string | null => {
  if (value == null) return null;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length ? trimmed : null;
  }
  if (typeof value === 'number') {
    return value.toString();
  }
  return null;
};

export const parseDate = (value: unknown): Date | null => {
  if (value == null) return null;

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : new Date(Date.UTC(
      value.getUTCFullYear(),
      value.getUTCMonth(),
      value.getUTCDate(),
    ));
  }

  if (typeof value === 'number') {
    const text = value.toString();
    if (text.length === 8) {
      const year = Number(text.slice(0, 4));
      const month = Number(text.slice(4, 6)) - 1;
      const day = Number(text.slice(6, 8));
      return new Date(Date.UTC(year, month, day));
    }
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;

    if (/^\d{8}$/.test(trimmed)) {
      const year = Number(trimmed.slice(0, 4));
      const month = Number(trimmed.slice(4, 6)) - 1;
      const day = Number(trimmed.slice(6, 8));
      return new Date(Date.UTC(year, month, day));
    }

    if (/^\d{2}[/-]\d{2}[/-]\d{4}$/.test(trimmed)) {
      const [day, month, year] = trimmed.replace(/-/g, '/').split('/');
      return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
    }

    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      const [year, month, day] = trimmed.split('-');
      return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
    }
  }

  const attempt = new Date(String(value));
  return Number.isNaN(attempt.getTime())
    ? null
    : new Date(Date.UTC(
        attempt.getUTCFullYear(),
        attempt.getUTCMonth(),
        attempt.getUTCDate(),
      ));
};

const normalizeAmountInput = (value: unknown): string | null => {
  if (value == null) return null;
  if (typeof value === 'number') {
    return value.toString();
  }
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
};

export const toMinorUnits = (value: unknown, decimals = 2): bigint | null => {
  const input = normalizeAmountInput(value);
  if (!input) return null;

  let normalized = input.replace(/\s+/g, '');

  if (normalized.includes(',') && normalized.includes('.')) {
    normalized = normalized.replace(/\./g, '');
  }

  const sign = normalized.startsWith('-') ? -1n : 1n;
  const unsigned = normalized.replace(/^[+-]/, '');

  let integerPart = unsigned;
  let fractionPart = '';

  const separatorMatch = unsigned.match(DECIMAL_SEPARATOR_REGEX);
  if (separatorMatch) {
    const separatorIndex = separatorMatch.index ?? unsigned.length;
    integerPart = unsigned.slice(0, separatorIndex);
    fractionPart = unsigned.slice(separatorIndex + 1);
  }

  integerPart = integerPart.replace(NON_NUMERIC_REGEX, '');
  fractionPart = fractionPart.replace(NON_NUMERIC_REGEX, '').slice(0, decimals);

  if (!integerPart && !fractionPart) {
    return null;
  }

  const paddedFraction = fractionPart.padEnd(decimals, '0');
  const combined = `${integerPart || '0'}${paddedFraction}`;

  try {
    return BigInt(combined) * sign;
  } catch {
    return null;
  }
};

export const applyDebitCredit = (
  amountMinor: bigint | null,
  debitCredit: string | null | undefined,
): bigint | null => {
  if (amountMinor == null) return null;
  if (!debitCredit) return amountMinor;
  const normalized = debitCredit.trim().toLowerCase();
  if (normalized === 'debit' && amountMinor > 0) {
    return amountMinor * -1n;
  }
  if (normalized === 'credit' && amountMinor < 0) {
    return amountMinor * -1n;
  }
  return amountMinor;
};

export const extractReference = (value: string | null | undefined): string | null => {
  if (!value) return null;
  const match = value.match(/Reference:\s*([^;]+)/i);
  if (match && match[1]) {
    return normalizeWhitespace(match[1]);
  }
  return null;
};

export const toISODateString = (date: Date): string => date.toISOString().split('T')[0]!;

export const deriveDirection = (amountMinor: bigint): 'credit' | 'debit' =>
  amountMinor >= 0n ? 'credit' : 'debit';

export type BuildNormalizedOptions = {
  rowNumber: number;
  accountIdentifier: string | null | undefined;
  accountName?: string | null;
  currency?: string | null;
  date: unknown;
  description: unknown;
  counterparty?: unknown;
  paymentPurpose?: unknown;
  amount: unknown;
  debitCredit?: unknown;
  reference?: unknown;
  source: string;
  raw: Record<string, unknown>;
};

export const buildNormalizedTransaction = ({
  rowNumber,
  accountIdentifier,
  accountName,
  currency,
  date,
  description,
  counterparty,
  paymentPurpose,
  amount,
  debitCredit,
  reference,
  source,
  raw,
}: BuildNormalizedOptions): { result: NormalizedTransaction; rowNumber: number } | { error: string; rowNumber: number } => {
  const rawAccount = ensureString(accountIdentifier);
  const accountId = rawAccount ? normalizeAccountIdentifier(rawAccount) : null;
  if (!accountId) {
    return { error: 'Missing account identifier', rowNumber };
  }

  const parsedDate = parseDate(date);
  if (!parsedDate) {
    return { error: 'Invalid or missing transaction date', rowNumber };
  }

  const descriptionText = ensureString(description);
  if (!descriptionText) {
    return { error: 'Missing description', rowNumber };
  }

  const amountMinor = applyDebitCredit(toMinorUnits(amount), ensureString(debitCredit));
  if (amountMinor == null) {
    return { error: 'Invalid or missing amount', rowNumber };
  }

  const normalizedDescription = normalizeDescription(descriptionText);
  if (!normalizedDescription) {
    return { error: 'Description could not be normalized', rowNumber };
  }

  const paymentPurposeText = ensureString(paymentPurpose);
  const normalizedPaymentPurpose = paymentPurposeText
    ? normalizeDescription(paymentPurposeText)
    : '';

  return {
    rowNumber,
    result: {
      accountIdentifier: accountId,
      accountName: accountName ?? null,
      currency: ensureString(currency) ?? 'EUR',
      date: parsedDate,
      description: normalizeWhitespace(descriptionText),
      counterparty: normalizeCounterparty(ensureString(counterparty)),
      paymentPurpose: paymentPurposeText ? normalizeWhitespace(paymentPurposeText) : null,
      normalizedPaymentPurpose,
      amountMinor,
      reference: normalizeCounterparty(ensureString(reference)),
      normalizedDescription,
      source,
      raw,
    },
  };
};
