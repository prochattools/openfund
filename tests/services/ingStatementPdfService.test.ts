import { describe, expect, it } from 'vitest';
import { parseIngStatementPdfText, IngStatementPdfError } from '../../server/services/ingStatementPdfService';

// Sanitized June 2026 fixture matching the real ING English-layout PDF structure.
// Values are public accounting figures, not PII.
const ENGLISH_JUNE_FIXTURE = `Statement business account
At ING.nl you will find the answers to most of your questions.
Rather have personal contact? Please visit ing.nl/contact
Yeshua Academy
Industrieweg 9
2254 AE VOORSCHOTEN
Period
01/06/2026 till 30/06/2026
Account number
NL89 INGB 0006 3699 60
Opening balance (EUR)
9,390.82
Total in (EUR)
13,057.98
Closing balance (EUR)
9,412.24
Total out (EUR)
13,036.56
Date Name / Description / Notification Type Amount (EUR)
`;

// Synthetic Dutch-layout fixture (backward compat)
const DUTCH_FIXTURE = `Bankafschrift
Rekeningnummer: NL89 INGB 0006 3699 60
Afschriftperiode: 01/06/2026 t/m 30/06/2026
Beginsaldo EUR 9.390,82
Totaal bij EUR 13.057,98
Totaal af EUR 13.036,56
Eindsaldo EUR 9.412,24
`;

describe('ingStatementPdfService', () => {
  describe('English ING layout', () => {
    it('parses June 2026 English fixture correctly', () => {
      const result = parseIngStatementPdfText(ENGLISH_JUNE_FIXTURE);
      expect(result.bankAccountIdentifier).toBe('NL89INGB0006369960');
      expect(result.periodStart).toEqual(new Date('2026-06-01T00:00:00.000Z'));
      expect(result.periodEnd).toEqual(new Date('2026-06-30T00:00:00.000Z'));
      expect(result.openingBalanceMinor).toBe(939082n);
      expect(result.incomeMinor).toBe(1305798n);
      expect(result.expenseMinor).toBe(1303656n);
      expect(result.closingBalanceMinor).toBe(941224n);
    });

    it('balance arithmetic holds: opening + income - expense == closing', () => {
      const result = parseIngStatementPdfText(ENGLISH_JUNE_FIXTURE);
      expect(result.openingBalanceMinor + result.incomeMinor - result.expenseMinor).toBe(result.closingBalanceMinor);
    });
  });

  describe('error cases', () => {
    it('throws IngStatementPdfError on empty text', () => {
      expect(() => parseIngStatementPdfText('')).toThrow(IngStatementPdfError);
    });

    it('throws with IBAN message when IBAN is missing', () => {
      const text = ENGLISH_JUNE_FIXTURE.replace(/NL89 INGB 0006 3699 60/, '');
      expect(() => parseIngStatementPdfText(text)).toThrow('Het rekeningnummer kon niet uit het PDF-bankafschrift worden gelezen.');
    });

    it('throws with period message when period is missing', () => {
      const text = ENGLISH_JUNE_FIXTURE.replace('01/06/2026 till 30/06/2026', '');
      expect(() => parseIngStatementPdfText(text)).toThrow('De afschriftperiode kon niet uit het PDF-bankafschrift worden gelezen.');
    });

    it('rejects an impossible calendar day instead of allowing Date.UTC rollover', () => {
      const text = ENGLISH_JUNE_FIXTURE.replace('01/06/2026 till 30/06/2026', '01/06/2026 till 31/06/2026');
      expect(() => parseIngStatementPdfText(text)).toThrow('Datum kon niet uit het PDF-bankafschrift worden gelezen');
    });

    it('throws with opening balance message when opening balance is missing', () => {
      // Remove the label and value lines
      const text = ENGLISH_JUNE_FIXTURE.replace('Opening balance (EUR)\n9,390.82\n', '');
      expect(() => parseIngStatementPdfText(text)).toThrow('Het openingssaldo kon niet uit het PDF-bankafschrift worden gelezen.');
    });

    it('throws with income message when total in is missing', () => {
      const text = ENGLISH_JUNE_FIXTURE.replace('Total in (EUR)\n13,057.98\n', '');
      expect(() => parseIngStatementPdfText(text)).toThrow('Het totaal aan inkomsten kon niet uit het PDF-bankafschrift worden gelezen.');
    });

    it('throws with expense message when total out is missing', () => {
      const text = ENGLISH_JUNE_FIXTURE.replace('Total out (EUR)\n13,036.56\n', '');
      expect(() => parseIngStatementPdfText(text)).toThrow('Het totaal aan uitgaven kon niet uit het PDF-bankafschrift worden gelezen.');
    });

    it('throws with closing balance message when closing balance is missing', () => {
      const text = ENGLISH_JUNE_FIXTURE.replace('Closing balance (EUR)\n9,412.24\n', '');
      expect(() => parseIngStatementPdfText(text)).toThrow('Het eindsaldo kon niet uit het PDF-bankafschrift worden gelezen.');
    });

    it('throws with balance mismatch message when arithmetic does not reconcile', () => {
      // Tweak opening balance so it no longer reconciles
      const text = ENGLISH_JUNE_FIXTURE.replace('9,390.82', '9,391.00');
      expect(() => parseIngStatementPdfText(text)).toThrow('De saldi in het PDF-bankafschrift sluiten niet exact aan');
    });
  });

  describe('Dutch layout backward compat', () => {
    it('parses Dutch fixture and produces the same results', () => {
      const result = parseIngStatementPdfText(DUTCH_FIXTURE);
      expect(result.bankAccountIdentifier).toBe('NL89INGB0006369960');
      expect(result.periodStart).toEqual(new Date('2026-06-01T00:00:00.000Z'));
      expect(result.periodEnd).toEqual(new Date('2026-06-30T00:00:00.000Z'));
      expect(result.openingBalanceMinor).toBe(939082n);
      expect(result.incomeMinor).toBe(1305798n);
      expect(result.expenseMinor).toBe(1303656n);
      expect(result.closingBalanceMinor).toBe(941224n);
    });
  });
});
