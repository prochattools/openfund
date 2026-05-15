import { describe, expect, it } from 'vitest';
import {
  readBoundedInteger,
  readListLimit,
  readNullableBoundedInteger,
  readOptionalNumber,
  readOptionalString,
} from '../../server/routes/queryParams';

describe('query param route helpers', () => {
  it('reads bounded integers within the configured range', () => {
    expect(readBoundedInteger('1', { fallback: 10, min: 1, max: 12 })).toBe(1);
    expect(readBoundedInteger('12', { fallback: 10, min: 1, max: 12 })).toBe(12);
    expect(readBoundedInteger(7, { fallback: 10, min: 1, max: 12 })).toBe(7);
  });

  it('falls back for missing, fractional, and out-of-range bounded integers', () => {
    expect(readBoundedInteger(undefined, { fallback: 10, min: 1, max: 12 })).toBe(10);
    expect(readBoundedInteger('1.5', { fallback: 10, min: 1, max: 12 })).toBe(10);
    expect(readBoundedInteger('0', { fallback: 10, min: 1, max: 12 })).toBe(10);
    expect(readBoundedInteger('13', { fallback: 10, min: 1, max: 12 })).toBe(10);
    expect(readBoundedInteger('abc', { fallback: 10, min: 1, max: 12 })).toBe(10);
  });

  it('keeps the shared list limit contract at 1 through 100 with fallback 25', () => {
    expect(readListLimit('1')).toBe(1);
    expect(readListLimit('100')).toBe(100);
    expect(readListLimit('0')).toBe(25);
    expect(readListLimit('101')).toBe(25);
  });

  it('reads nullable bounded integers for optional bounded values like report months', () => {
    expect(readNullableBoundedInteger('1', { min: 1, max: 12 })).toBe(1);
    expect(readNullableBoundedInteger('12', { min: 1, max: 12 })).toBe(12);
    expect(readNullableBoundedInteger(undefined, { min: 1, max: 12 })).toBeNull();
    expect(readNullableBoundedInteger('', { min: 1, max: 12 })).toBeNull();
    expect(readNullableBoundedInteger('0', { min: 1, max: 12 })).toBeNull();
    expect(readNullableBoundedInteger('13', { min: 1, max: 12 })).toBeNull();
  });

  it('reads optional finite numbers for routes like reconciliation', () => {
    expect(readOptionalNumber('5')).toBe(5);
    expect(readOptionalNumber(2026)).toBe(2026);
    expect(readOptionalNumber(undefined)).toBeUndefined();
    expect(readOptionalNumber('')).toBeUndefined();
    expect(readOptionalNumber('abc')).toBeUndefined();
  });

  it('reads optional trimmed-present strings for routes like reconciliation', () => {
    expect(readOptionalString('2026-05-01')).toBe('2026-05-01');
    expect(readOptionalString('')).toBeUndefined();
    expect(readOptionalString('   ')).toBeUndefined();
    expect(readOptionalString(['2026-05-01'])).toBeUndefined();
  });
});
