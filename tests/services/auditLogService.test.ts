import { describe, expect, it, vi } from 'vitest';
import { createAuditLog } from '../../server/services/auditLogService';

describe('audit log service', () => {
  it('normalizes optional actor and entity fields to null', async () => {
    const create = vi.fn().mockResolvedValue({ id: 'audit-1' });
    const tx = {
      auditLog: {
        create,
      },
    };

    const result = await createAuditLog(tx as any, {
      userId: 'finance-user',
      action: 'transaction.category.updated',
      entityType: 'transaction',
    });

    expect(result).toEqual({ id: 'audit-1' });
    expect(create).toHaveBeenCalledWith({
      data: {
        userId: 'finance-user',
        actorId: null,
        actorEmail: null,
        action: 'transaction.category.updated',
        entityType: 'transaction',
        entityId: null,
        before: undefined,
        after: undefined,
        metadata: undefined,
      },
    });
  });

  it('preserves before, after, and metadata JSON payloads', async () => {
    const create = vi.fn().mockResolvedValue({ id: 'audit-2' });
    const tx = {
      auditLog: {
        create,
      },
    };

    await createAuditLog(tx as any, {
      userId: 'finance-user',
      actorId: 'ory-identity-1',
      actorEmail: 'admin@example.test',
      action: 'openingBalance.updated',
      entityType: 'openingBalance',
      entityId: 'balance-1',
      before: { amountMinor: '1000' },
      after: { amountMinor: '1500' },
      metadata: { accountIdentifier: 'NL89INGB0006369960' },
    });

    expect(create).toHaveBeenCalledWith({
      data: {
        userId: 'finance-user',
        actorId: 'ory-identity-1',
        actorEmail: 'admin@example.test',
        action: 'openingBalance.updated',
        entityType: 'openingBalance',
        entityId: 'balance-1',
        before: { amountMinor: '1000' },
        after: { amountMinor: '1500' },
        metadata: { accountIdentifier: 'NL89INGB0006369960' },
      },
    });
  });
});
