import { describe, expect, it } from 'vitest';
import {
  extractMerchantFingerprints,
  MERCHANT_FINGERPRINT_EXTRACTION_VERSION,
  type MerchantFingerprintInput,
} from '../../server/services/merchantFingerprintExtractor';
import { buildImportFingerprint } from '../../server/services/transactionFingerprint';

const baseInput: MerchantFingerprintInput = {
  workspaceId: 'workspace-1',
  transactionId: 'transaction-1',
  date: new Date('2026-06-15T00:00:00.000Z'),
  accountId: 'account-1',
  direction: 'credit',
  amountMinor: 5000n,
  counterparty: '  Stichting ÁLpha  ',
  reference: 'Gift YA juni',
  rawRow: {
    'Counterparty IBAN': 'NL91 ABNA 0417 1643 00',
    Notifications: '  Gift YA juni  ',
  },
};

const fingerprint = (
  result: ReturnType<typeof extractMerchantFingerprints>,
  signalType: string,
) => result.fingerprints.find((item) => item.signalType === signalType);

const abstention = (
  result: ReturnType<typeof extractMerchantFingerprints>,
  signalType: string,
) => result.abstentions.find((item) => item.signalType === signalType);

describe('merchant fingerprint extractor', () => {
  it('extracts normalized IBAN evidence with a deterministic hash and masked display', () => {
    const result = extractMerchantFingerprints(baseInput);
    const iban = fingerprint(result, 'IBAN');

    expect(iban).toMatchObject({
      normalizedValue: 'NL91ABNA0417164300',
      strength: 'STRONG',
      extractionVersion: MERCHANT_FINGERPRINT_EXTRACTION_VERSION,
      sourceField: 'rawRow.counterpartyIban',
      evidenceDisplayValue: 'NL91••••••••••4300',
    });
    expect(iban?.valueHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('abstains on malformed IBAN evidence', () => {
    const result = extractMerchantFingerprints({
      ...baseInput,
      rawRow: { 'Counterparty IBAN': 'NL00INVALID' },
    });

    expect(fingerprint(result, 'IBAN')).toBeUndefined();
    expect(abstention(result, 'IBAN')).toMatchObject({ reason: 'MALFORMED_IBAN' });
  });

  it('normalizes counterparty text and abstains for empty or placeholder values', () => {
    const extracted = fingerprint(extractMerchantFingerprints(baseInput), 'NORMALIZED_COUNTERPARTY');
    expect(extracted).toMatchObject({
      normalizedValue: 'stichting alpha',
      strength: 'MEDIUM',
      evidenceDisplayValue: null,
    });

    const empty = extractMerchantFingerprints({ ...baseInput, counterparty: '   ' });
    expect(abstention(empty, 'NORMALIZED_COUNTERPARTY')?.reason).toBe('MISSING_VALUE');

    const placeholder = extractMerchantFingerprints({ ...baseInput, counterparty: 'Onbekend' });
    expect(abstention(placeholder, 'NORMALIZED_COUNTERPARTY')?.reason).toBe('PLACEHOLDER_VALUE');
  });

  it('extracts payment purpose from direct and nested supported raw-row shapes', () => {
    const direct = fingerprint(extractMerchantFingerprints(baseInput), 'PAYMENT_PURPOSE');
    const nested = fingerprint(extractMerchantFingerprints({
      ...baseInput,
      rawRow: {
        'Counterparty IBAN': 'NL91ABNA0417164300',
        columns: { Notification: 'Gift YA juni' },
      },
    }), 'PAYMENT_PURPOSE');

    expect(direct).toMatchObject({
      normalizedValue: 'gift ya juni',
      strength: 'WEAK',
      sourceField: 'rawRow.paymentPurpose',
    });
    expect(nested?.valueHash).toBe(direct?.valueHash);
  });

  it('uses the immutable reference fallback and abstains when purpose is missing', () => {
    const fallback = fingerprint(extractMerchantFingerprints({
      ...baseInput,
      reference: 'REF maandgift',
      rawRow: { 'Counterparty IBAN': 'NL91ABNA0417164300' },
    }), 'PAYMENT_PURPOSE');
    expect(fallback).toMatchObject({
      normalizedValue: 'ref maandgift',
      sourceField: 'transaction.reference',
    });

    const missing = extractMerchantFingerprints({
      ...baseInput,
      reference: null,
      rawRow: { 'Counterparty IBAN': 'NL91ABNA0417164300' },
    });
    expect(abstention(missing, 'PAYMENT_PURPOSE')?.reason).toBe('MISSING_VALUE');
  });

  it('returns deterministic hashes, extraction version, and stable signal ordering', () => {
    const first = extractMerchantFingerprints(baseInput);
    const second = extractMerchantFingerprints({ ...baseInput });

    expect(second).toEqual(first);
    expect(first.extractionVersion).toBe(MERCHANT_FINGERPRINT_EXTRACTION_VERSION);
    expect(first.fingerprints.map((item) => item.signalType)).toEqual([
      'IBAN',
      'NORMALIZED_COUNTERPARTY',
      'PAYMENT_PURPOSE',
      'RECURRING_PATTERN',
    ]);
    expect(first.fingerprints.every((item) => item.valueHash.match(/^[a-f0-9]{64}$/))).toBe(true);
  });

  it('does not mutate the supplied transaction or raw-row object', () => {
    const rawRow = {
      'Counterparty IBAN': 'NL91 ABNA 0417 1643 00',
      columns: { Notifications: 'Gift YA juni' },
    };
    const input = { ...baseInput, rawRow };
    const before = JSON.stringify(rawRow);

    extractMerchantFingerprints(input);

    expect(JSON.stringify(rawRow)).toBe(before);
    expect(input.rawRow).toBe(rawRow);
  });

  it('keeps merchant fingerprints semantically separate from import fingerprints', () => {
    const merchantIban = fingerprint(extractMerchantFingerprints(baseInput), 'IBAN');
    const importFingerprint = buildImportFingerprint({
      accountIdentifier: 'NL89INGB0006369960',
      date: baseInput.date,
      amountMinor: baseInput.amountMinor,
      description: 'Maandelijkse gift',
      counterparty: baseInput.counterparty,
      reference: baseInput.reference,
      raw: baseInput.rawRow as Record<string, unknown>,
    });

    expect(merchantIban?.valueHash).not.toBe(importFingerprint);
  });

  it('does not emit unsupported creditor or card signals and never marks weak evidence strong', () => {
    const result = extractMerchantFingerprints({
      ...baseInput,
      rawRow: {
        ...baseInput.rawRow as Record<string, unknown>,
        'Creditor identifier': 'NL98ZZZ123456780000',
        'Card descriptor': 'CARD-1234',
      },
    });

    expect(result.fingerprints.map((item) => item.signalType)).not.toContain('CREDITOR_IDENTIFIER');
    expect(result.fingerprints.map((item) => item.signalType)).not.toContain('CARD_DESCRIPTOR');
    expect(fingerprint(result, 'PAYMENT_PURPOSE')?.strength).toBe('WEAK');
    expect(fingerprint(result, 'RECURRING_PATTERN')?.strength).toBe('WEAK');
  });

  it('extracts deterministic recurring-pattern inputs without assigning a merchant', () => {
    const recurring = fingerprint(extractMerchantFingerprints(baseInput), 'RECURRING_PATTERN');

    expect(recurring).toMatchObject({
      normalizedValue: 'account:account-1|direction:credit|amount:5000|monthDay:15',
      strength: 'WEAK',
      sourceField: 'transaction.recurringPatternComponents',
      evidenceDisplayValue: null,
    });
    expect(JSON.stringify(recurring)).not.toContain('merchantId');
  });

  it('abstains from recurring input when deterministic components are incomplete', () => {
    const result = extractMerchantFingerprints({ ...baseInput, accountId: null });
    expect(fingerprint(result, 'RECURRING_PATTERN')).toBeUndefined();
    expect(abstention(result, 'RECURRING_PATTERN')?.reason).toBe('INSUFFICIENT_RECURRING_COMPONENTS');
  });

  it('requires workspace and transaction context without performing a lookup', () => {
    expect(() => extractMerchantFingerprints({ ...baseInput, workspaceId: '  ' }))
      .toThrow('workspaceId is required');
    expect(() => extractMerchantFingerprints({ ...baseInput, transactionId: '' }))
      .toThrow('transactionId is required');
  });
});
