import { describe, expect, it } from 'vitest';
import { readAuditLogLimit } from '../../server/routes/audit';

describe('audit routes', () => {
  it('accepts valid positive limits up to 100', () => {
    expect(readAuditLogLimit('1')).toBe(1);
    expect(readAuditLogLimit('25')).toBe(25);
    expect(readAuditLogLimit('100')).toBe(100);
  });

  it('falls back to 25 for invalid limits', () => {
    expect(readAuditLogLimit(undefined)).toBe(25);
    expect(readAuditLogLimit('0')).toBe(25);
    expect(readAuditLogLimit('-1')).toBe(25);
    expect(readAuditLogLimit('101')).toBe(25);
    expect(readAuditLogLimit('abc')).toBe(25);
  });
});
