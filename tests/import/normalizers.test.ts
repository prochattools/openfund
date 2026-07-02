import { describe, expect, it } from 'vitest';
import {
  toMinorUnits,
  applyDebitCredit,
  parseDate,
  normalizeDescription,
  normalizeAccountIdentifier,
  buildNormalizedTransaction,
  extractReference,
  toISODateString,
} from '../../lib/import/normalizers';

describe('normalizers', () => {
  it('converts amounts with comma decimal separator to minor units', () => {
    expect(toMinorUnits('1.234,56')).toEqual(123456n);
    expect(toMinorUnits('1234.56')).toEqual(123456n);
    expect(toMinorUnits('-12,3')).toEqual(-1230n);
  });

  it('applies debit/credit markers to signed amounts', () => {
    const base = toMinorUnits('250')!;
    expect(applyDebitCredit(base, 'Credit')).toEqual(25000n);
    expect(applyDebitCredit(base, 'Debit')).toEqual(-25000n);
    expect(applyDebitCredit(-25000n, 'Debit')).toEqual(-25000n);
    expect(applyDebitCredit(-25000n, 'Credit')).toEqual(25000n);
  });

  it('parses YYYYMMDD, DD/MM/YYYY, Date objects, and ISO dates into UTC dates', () => {
    const iso = parseDate('20250109');
    expect(iso?.toISOString()).toEqual('2025-01-09T00:00:00.000Z');

    const alt = parseDate('09/01/2025');
    expect(alt?.toISOString()).toEqual('2025-01-09T00:00:00.000Z');

    const dateObject = parseDate(new Date('2025-01-09T14:30:00.000Z'));
    expect(dateObject?.toISOString()).toEqual('2025-01-09T00:00:00.000Z');

    const isoText = parseDate('2025-01-09');
    expect(isoText?.toISOString()).toEqual('2025-01-09T00:00:00.000Z');
  });

  it('normalizes descriptions and account identifiers consistently', () => {
    expect(normalizeDescription('Community Outreach Supplies!')).toEqual('community outreach supplies');
    expect(normalizeAccountIdentifier('NL89 ingb 0006 369960')).toEqual('NL89INGB0006369960');
  });

  it('extracts references and ISO date strings for import metadata', () => {
    expect(extractReference('Naam: Test; Reference: ABC-123 ; Omschrijving: Gift')).toEqual('ABC-123');
    expect(extractReference('Geen reference')).toBeNull();
    expect(toISODateString(new Date('2026-05-14T22:30:00.000Z'))).toBe('2026-05-14');
  });

  it('builds a normalized transaction from a valid raw row', () => {
    const normalized = buildNormalizedTransaction({
      rowNumber: 7,
      accountIdentifier: ' NL89 ingb 0006 369960 ',
      accountName: 'Betaalrekening',
      currency: 'EUR',
      date: '20260514',
      description: '  Gift   voor   zending! ',
      counterparty: ' Donor Naam ',
      paymentPurpose: '  Tienden   voor   Yeshua Academy ',
      amount: '1.234,56',
      debitCredit: 'Credit',
      reference: ' REF-123 ',
      source: 'ing_csv',
      raw: { Date: '20260514' },
    });

    expect(normalized).toEqual({
      rowNumber: 7,
      result: {
        accountIdentifier: 'NL89INGB0006369960',
        accountName: 'Betaalrekening',
        currency: 'EUR',
        date: new Date('2026-05-14T00:00:00.000Z'),
        description: 'Gift voor zending!',
        counterparty: 'Donor Naam',
        paymentPurpose: 'Tienden voor Yeshua Academy',
        normalizedPaymentPurpose: 'tienden voor yeshua academy',
        amountMinor: 123456n,
        reference: 'REF-123',
        normalizedDescription: 'gift voor zending',
        source: 'ing_csv',
        raw: { Date: '20260514' },
      },
    });
  });

  it('returns row-level errors for missing required normalized fields', () => {
    const base = {
      rowNumber: 3,
      accountIdentifier: 'NL89INGB0006369960',
      date: '20260514',
      description: 'Gift',
      amount: '10,00',
      source: 'ing_csv',
      raw: {},
    };

    expect(buildNormalizedTransaction({ ...base, accountIdentifier: '   ' })).toEqual({
      rowNumber: 3,
      error: 'Missing account identifier',
    });
    expect(buildNormalizedTransaction({ ...base, date: 'geen datum' })).toEqual({
      rowNumber: 3,
      error: 'Invalid or missing transaction date',
    });
    expect(buildNormalizedTransaction({ ...base, description: '   ' })).toEqual({
      rowNumber: 3,
      error: 'Missing description',
    });
    expect(buildNormalizedTransaction({ ...base, amount: 'geen bedrag' })).toEqual({
      rowNumber: 3,
      error: 'Invalid or missing amount',
    });
  });
});