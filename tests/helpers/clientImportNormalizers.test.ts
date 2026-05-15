import { describe, expect, it } from 'vitest';
import {
  normaliseDescription,
  parseAmount,
  parseDateString,
  sanitizeNotification,
} from '../../src/helpers/client-import-normalizers';

describe('client import normalizer helpers', () => {
  it('normalises descriptions for client-side duplicate detection', () => {
    expect(normaliseDescription('  Gift, voor   Zending! ')).toBe('gift voor zending');
  });

  it('parses ING-style, Dutch, and ISO date strings', () => {
    expect(parseDateString('20260515')?.toISOString()).toBe('2026-05-15T00:00:00.000Z');
    expect(parseDateString('15/05/2026')?.toISOString()).toBe('2026-05-15T00:00:00.000Z');
    expect(parseDateString('15-05-2026')?.toISOString()).toBe('2026-05-15T00:00:00.000Z');
    expect(parseDateString('2026-05-15')?.toISOString()).toBe('2026-05-15T00:00:00.000Z');
    expect(parseDateString('geen datum')).toBeNull();
  });

  it('parses Dutch and US amount strings with debit/credit indicators', () => {
    expect(parseAmount('€ 1.234,56')).toBe(1234.56);
    expect(parseAmount('1,234.56')).toBe(1234.56);
    expect(parseAmount('1.234', 'Credit')).toBe(1234);
    expect(parseAmount('25,50', 'Debit')).toBe(-25.5);
    expect(parseAmount('25,50', 'af')).toBe(-25.5);
    expect(parseAmount('geen bedrag')).toBeNull();
  });

  it('sanitizes notification text and removes ING name prefixes', () => {
    expect(sanitizeNotification('Name: Donor Naam')).toBe('Donor Naam');
    expect(sanitizeNotification('  Kenmerk gift 123  ')).toBe('Kenmerk gift 123');
    expect(sanitizeNotification('   ')).toBeNull();
    expect(sanitizeNotification(null)).toBeNull();
  });
});
