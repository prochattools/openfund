import { describe, expect, it } from 'vitest';
import { normalizeAccountKey, resolveAccountMetadata } from '../../src/helpers/account-metadata';

describe('account metadata helper', () => {
  it('normalizes account keys by removing accents, spaces, and punctuation', () => {
    expect(normalizeAccountKey(' NL89 ingb 0006 3699 60 ')).toBe('NL89INGB0006369960');
    expect(normalizeAccountKey('Vila Solidária')).toBe('VILASOLIDARIA');
  });

  it('resolves exact and embedded known account identifiers', () => {
    expect(resolveAccountMetadata('NL89 INGB 0006 3699 60')).toEqual({
      label: 'Yeshua Academy',
      identifier: 'NL89INGB0006369960',
    });
    expect(resolveAccountMetadata('rekening F 951-98948 sparen')).toEqual({
      label: 'Yeshua Academy Savings',
      identifier: 'F 951-98948',
    });
  });

  it('uses the Vila Solidária alternate label for matching text', () => {
    expect(resolveAccountMetadata('NL89INGB0006369960 Vila Solidária')).toEqual({
      label: 'Vila Solidária',
      identifier: 'NL89INGB0006369960',
    });
  });

  it('returns empty metadata for missing or unknown values', () => {
    expect(resolveAccountMetadata(null)).toEqual({ label: null, identifier: null });
    expect(resolveAccountMetadata('   ')).toEqual({ label: null, identifier: null });
    expect(resolveAccountMetadata('onbekende rekening')).toEqual({ label: null, identifier: null });
  });
});
