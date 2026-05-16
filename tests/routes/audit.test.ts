import { describe, expect, it } from 'vitest';
import { readAuditLogLimit, serializeAuditLogEntry } from '../../server/routes/audit';

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

  it('serializes audit log entries with ISO timestamps', () => {
    expect(serializeAuditLogEntry({
      id: 'audit-1',
      actorId: 'actor-1',
      actorEmail: 'finance@example.test',
      action: 'transaction.category.updated',
      entityType: 'transaction',
      entityId: 'tx-1',
      before: { categoryId: null },
      after: { categoryId: 'cat-1' },
      metadata: { source: 'review' },
      createdAt: new Date('2026-05-15T10:00:00.000Z'),
    })).toEqual({
      id: 'audit-1',
      actorId: 'actor-1',
      actorEmail: 'finance@example.test',
      action: 'transaction.category.updated',
      entityType: 'transaction',
      entityId: 'tx-1',
      before: { categoryId: null },
      after: { categoryId: 'cat-1' },
      metadata: { source: 'review' },
      createdAt: '2026-05-15T10:00:00.000Z',
    });
  });
});
