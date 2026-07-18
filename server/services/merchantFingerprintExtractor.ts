import crypto from 'node:crypto';
import type { TransactionDirection } from '@prisma/client';
import { normalizeAccountIdentifier, normalizeWhitespace } from '../../lib/import/normalizers';
import { readSuggestionRawString } from './transactionSuggestionFacts';

export const MERCHANT_FINGERPRINT_EXTRACTION_VERSION = 'merchant-fingerprint-v1';

export type MerchantFingerprintSignalType =
  | 'IBAN'
  | 'NORMALIZED_COUNTERPARTY'
  | 'PAYMENT_PURPOSE'
  | 'RECURRING_PATTERN';

export type MerchantFingerprintStrength = 'STRONG' | 'MEDIUM' | 'WEAK';

export type MerchantFingerprintSourceField =
  | 'rawRow.counterpartyIban'
  | 'transaction.counterparty'
  | 'rawRow.paymentPurpose'
  | 'transaction.reference'
  | 'transaction.recurringPatternComponents';

export type MerchantFingerprintAbstentionReason =
  | 'MISSING_VALUE'
  | 'MALFORMED_IBAN'
  | 'PLACEHOLDER_VALUE'
  | 'INSUFFICIENT_RECURRING_COMPONENTS';

export type MerchantFingerprintInput = {
  workspaceId: string;
  transactionId: string;
  date: Date;
  accountId: string | null;
  direction: TransactionDirection;
  amountMinor: bigint;
  counterparty: string | null;
  reference: string | null;
  rawRow: unknown;
};

export type ExtractedMerchantFingerprint = {
  signalType: MerchantFingerprintSignalType;
  normalizedValue: string | null;
  valueHash: string;
  strength: MerchantFingerprintStrength;
  extractionVersion: string;
  sourceField: MerchantFingerprintSourceField;
  evidenceDisplayValue: string | null;
};

export type MerchantFingerprintAbstention = {
  signalType: MerchantFingerprintSignalType;
  extractionVersion: string;
  sourceField: MerchantFingerprintSourceField;
  reason: MerchantFingerprintAbstentionReason;
};

export type MerchantFingerprintExtractionResult = {
  workspaceId: string;
  transactionId: string;
  extractionVersion: string;
  fingerprints: ExtractedMerchantFingerprint[];
  abstentions: MerchantFingerprintAbstention[];
};

const SIGNAL_ORDER: Record<MerchantFingerprintSignalType, number> = {
  IBAN: 0,
  NORMALIZED_COUNTERPARTY: 1,
  PAYMENT_PURPOSE: 2,
  RECURRING_PATTERN: 3,
};

const PLACEHOLDER_VALUES = new Set([
  '-',
  'n a',
  'na',
  'none',
  'not available',
  'onbekend',
  'unknown',
  'geen',
]);

const hashValue = (value: string): string =>
  crypto.createHash('sha256').update(value).digest('hex');

const normalizeMerchantText = (value: string): string =>
  normalizeWhitespace(
    value
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' '),
  );

const isPlaceholder = (value: string): boolean => PLACEHOLDER_VALUES.has(value);

const isValidIban = (value: string): boolean => {
  if (!/^[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}$/.test(value)) return false;

  const rearranged = `${value.slice(4)}${value.slice(0, 4)}`;
  let remainder = 0;
  for (const character of rearranged) {
    const expanded = /[A-Z]/.test(character)
      ? String(character.charCodeAt(0) - 55)
      : character;
    for (const digit of expanded) {
      remainder = (remainder * 10 + Number(digit)) % 97;
    }
  }
  return remainder === 1;
};

const maskIban = (value: string): string => {
  if (value.length <= 8) return `${value.slice(0, 2)}••${value.slice(-2)}`;
  return `${value.slice(0, 4)}${'•'.repeat(Math.max(4, value.length - 8))}${value.slice(-4)}`;
};

const abstain = (
  signalType: MerchantFingerprintSignalType,
  sourceField: MerchantFingerprintSourceField,
  reason: MerchantFingerprintAbstentionReason,
): MerchantFingerprintAbstention => ({
  signalType,
  sourceField,
  reason,
  extractionVersion: MERCHANT_FINGERPRINT_EXTRACTION_VERSION,
});

const extractIban = (
  input: MerchantFingerprintInput,
): ExtractedMerchantFingerprint | MerchantFingerprintAbstention => {
  const sourceField: MerchantFingerprintSourceField = 'rawRow.counterpartyIban';
  const rawValue = readSuggestionRawString(input.rawRow, [
    'Counterparty IBAN',
    'CounterpartyIban',
    'Counterparty account',
    'IBAN/BBAN',
  ]);
  if (!rawValue) return abstain('IBAN', sourceField, 'MISSING_VALUE');

  const normalizedValue = normalizeAccountIdentifier(rawValue);
  if (!normalizedValue) return abstain('IBAN', sourceField, 'MISSING_VALUE');
  if (!isValidIban(normalizedValue)) return abstain('IBAN', sourceField, 'MALFORMED_IBAN');

  return {
    signalType: 'IBAN',
    normalizedValue,
    valueHash: hashValue(normalizedValue),
    strength: 'STRONG',
    extractionVersion: MERCHANT_FINGERPRINT_EXTRACTION_VERSION,
    sourceField,
    evidenceDisplayValue: maskIban(normalizedValue),
  };
};

const extractCounterparty = (
  input: MerchantFingerprintInput,
): ExtractedMerchantFingerprint | MerchantFingerprintAbstention => {
  const sourceField: MerchantFingerprintSourceField = 'transaction.counterparty';
  if (!input.counterparty?.trim()) {
    return abstain('NORMALIZED_COUNTERPARTY', sourceField, 'MISSING_VALUE');
  }

  const normalizedValue = normalizeMerchantText(input.counterparty);
  if (!normalizedValue) {
    return abstain('NORMALIZED_COUNTERPARTY', sourceField, 'MISSING_VALUE');
  }
  if (isPlaceholder(normalizedValue)) {
    return abstain('NORMALIZED_COUNTERPARTY', sourceField, 'PLACEHOLDER_VALUE');
  }

  return {
    signalType: 'NORMALIZED_COUNTERPARTY',
    normalizedValue,
    valueHash: hashValue(normalizedValue),
    strength: 'MEDIUM',
    extractionVersion: MERCHANT_FINGERPRINT_EXTRACTION_VERSION,
    sourceField,
    evidenceDisplayValue: null,
  };
};

const extractPaymentPurpose = (
  input: MerchantFingerprintInput,
): ExtractedMerchantFingerprint | MerchantFingerprintAbstention => {
  const rawPurpose = readSuggestionRawString(input.rawRow, ['Notifications', 'Notification']);
  const sourceField: MerchantFingerprintSourceField = rawPurpose
    ? 'rawRow.paymentPurpose'
    : 'transaction.reference';
  const rawValue = rawPurpose ?? input.reference;
  if (!rawValue?.trim()) return abstain('PAYMENT_PURPOSE', sourceField, 'MISSING_VALUE');

  const normalizedValue = normalizeMerchantText(rawValue);
  if (!normalizedValue) return abstain('PAYMENT_PURPOSE', sourceField, 'MISSING_VALUE');
  if (isPlaceholder(normalizedValue)) {
    return abstain('PAYMENT_PURPOSE', sourceField, 'PLACEHOLDER_VALUE');
  }

  return {
    signalType: 'PAYMENT_PURPOSE',
    normalizedValue,
    valueHash: hashValue(normalizedValue),
    strength: 'WEAK',
    extractionVersion: MERCHANT_FINGERPRINT_EXTRACTION_VERSION,
    sourceField,
    evidenceDisplayValue: null,
  };
};

const extractRecurringPattern = (
  input: MerchantFingerprintInput,
): ExtractedMerchantFingerprint | MerchantFingerprintAbstention => {
  const sourceField: MerchantFingerprintSourceField = 'transaction.recurringPatternComponents';
  if (
    Number.isNaN(input.date.getTime())
    || !input.accountId?.trim()
    || input.amountMinor === 0n
  ) {
    return abstain('RECURRING_PATTERN', sourceField, 'INSUFFICIENT_RECURRING_COMPONENTS');
  }

  const normalizedValue = [
    `account:${input.accountId.trim()}`,
    `direction:${input.direction}`,
    `amount:${input.amountMinor < 0n ? -input.amountMinor : input.amountMinor}`,
    `monthDay:${input.date.getUTCDate()}`,
  ].join('|');

  return {
    signalType: 'RECURRING_PATTERN',
    normalizedValue,
    valueHash: hashValue(normalizedValue),
    strength: 'WEAK',
    extractionVersion: MERCHANT_FINGERPRINT_EXTRACTION_VERSION,
    sourceField,
    evidenceDisplayValue: null,
  };
};

export const extractMerchantFingerprints = (
  input: MerchantFingerprintInput,
): MerchantFingerprintExtractionResult => {
  if (!input.workspaceId.trim()) {
    throw new Error('workspaceId is required for merchant fingerprint extraction');
  }
  if (!input.transactionId.trim()) {
    throw new Error('transactionId is required for merchant fingerprint extraction');
  }

  const candidates = [
    extractIban(input),
    extractCounterparty(input),
    extractPaymentPurpose(input),
    extractRecurringPattern(input),
  ];

  const fingerprints = candidates
    .filter((candidate): candidate is ExtractedMerchantFingerprint => 'valueHash' in candidate)
    .sort((left, right) => SIGNAL_ORDER[left.signalType] - SIGNAL_ORDER[right.signalType]);
  const abstentions = candidates
    .filter((candidate): candidate is MerchantFingerprintAbstention => 'reason' in candidate)
    .sort((left, right) => SIGNAL_ORDER[left.signalType] - SIGNAL_ORDER[right.signalType]);

  return {
    workspaceId: input.workspaceId,
    transactionId: input.transactionId,
    extractionVersion: MERCHANT_FINGERPRINT_EXTRACTION_VERSION,
    fingerprints,
    abstentions,
  };
};
