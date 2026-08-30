import { NormalizedTransaction } from './types';

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

/**
 * Builds a UTC calendar date without allowing the JavaScript Date constructor
 * to roll invalid days or months into a different calendar date.
 */
export const createUtcCalendarDate = (year: number, month: number, day: number): Date | null => {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null;
  if (year < 1 || month < 1 || month > 12 || day < 1 || day > 31) return null;

  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year
    && date.getUTCMonth() + 1 === month
    && date.getUTCDate() === day
    ? date
    : null;
};

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
    return Number.isNaN(value.getTime())
      ? null
      : createUtcCalendarDate(value.getUTCFullYear(), value.getUTCMonth() + 1, value.getUTCDate());
  }

  if (typeof value === 'number') {
    const text = value.toString();
    if (/^\d{8}$/.test(text)) {
      return createUtcCalendarDate(
        Number(text.slice(0, 4)),
        Number(text.slice(4, 6)),
        Number(text.slice(6, 8)),
      );
    }
    return null;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;

    if (/^\d{8}$/.test(trimmed)) {
      return createUtcCalendarDate(
        Number(trimmed.slice(0, 4)),
        Number(trimmed.slice(4, 6)),
        Number(trimmed.slice(6, 8)),
      );
    }

    if (/^\d{2}[/-]\d{2}[/-]\d{4}$/.test(trimmed)) {
      const [day, month, year] = trimmed.replace(/-/g, '/').split('/');
      return createUtcCalendarDate(Number(year), Number(month), Number(day));
    }

    const isoDateMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})(?:$|T|\s)/);
    if (isoDateMatch) {
      return createUtcCalendarDate(
        Number(isoDateMatch[1]),
        Number(isoDateMatch[2]),
        Number(isoDateMatch[3]),
      );
    }
  }

  // Unknown textual formats are rejected rather than delegated to the
  // implementation-dependent Date parser, which can normalize invalid dates.
  return null;
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
  if (!Number.isInteger(decimals) || decimals < 0) return null;
  const input = normalizeAmountInput(value);
  if (!input) return null;

  const normalized = input.replace(/\s+/g, '');
  const sign = normalized.startsWith('-') ? -1n : 1n;
  const unsigned = normalized.replace(/^[+-]/, '');
  if (!unsigned || !/^\d[\d.,]*$/.test(unsigned)) return null;

  const hasComma = unsigned.includes(',');
  const hasDot = unsigned.includes('.');
  const commaCount = (unsigned.match(/,/g) ?? []).length;
  const dotCount = (unsigned.match(/\./g) ?? []).length;
  let integerPart = unsigned;
  let fractionPart = '';

  const isGroupedInteger = (candidate: string, separator: '.' | ','): boolean => {
    const parts = candidate.split(separator);
    return parts.length > 1
      && parts[0]!.length >= 1
      && parts[0]!.length <= 3
      && parts.slice(1).every((part) => /^\d{3}$/.test(part));
  };

  if (hasComma && hasDot) {
    const decimalSeparator = unsigned.lastIndexOf(',') > unsigned.lastIndexOf('.') ? ',' : '.';
    const groupingSeparator = decimalSeparator === ',' ? '.' : ',';
    const decimalCount = decimalSeparator === ',' ? commaCount : dotCount;
    const decimalIndex = unsigned.lastIndexOf(decimalSeparator);
    const candidateInteger = unsigned.slice(0, decimalIndex);
    fractionPart = unsigned.slice(decimalIndex + 1);
    if (
      decimalCount !== 1
      || !fractionPart.match(new RegExp(`^\\d{0,${decimals}}$`))
      || !isGroupedInteger(candidateInteger, groupingSeparator)
    ) return null;
    integerPart = candidateInteger.replace(new RegExp(`\\${groupingSeparator}`, 'g'), '');
  } else if (hasComma) {
    if (commaCount !== 1) return null;
    const decimalIndex = unsigned.indexOf(',');
    integerPart = unsigned.slice(0, decimalIndex);
    fractionPart = unsigned.slice(decimalIndex + 1);
    if (!/^\d+$/.test(integerPart) || !new RegExp(`^\\d{0,${decimals}}$`).test(fractionPart)) return null;
  } else if (hasDot) {
    if (dotCount === 1) {
      const decimalIndex = unsigned.indexOf('.');
      const candidateInteger = unsigned.slice(0, decimalIndex);
      const candidateFraction = unsigned.slice(decimalIndex + 1);
      if (new RegExp(`^\\d{0,${decimals}}$`).test(candidateFraction)) {
        integerPart = candidateInteger;
        fractionPart = candidateFraction;
      } else if (isGroupedInteger(unsigned, '.')) {
        integerPart = unsigned.replace(/\./g, '');
      } else {
        return null;
      }
    } else if (isGroupedInteger(unsigned, '.')) {
      integerPart = unsigned.replace(/\./g, '');
    } else {
      return null;
    }
  }

  if (!/^\d+$/.test(integerPart) || !/^\d*$/.test(fractionPart)) return null;
  const paddedFraction = fractionPart.padEnd(decimals, '0');
  const combined = `${integerPart || '0'}${paddedFraction || (decimals === 0 ? '' : '0'.repeat(decimals))}`;

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
