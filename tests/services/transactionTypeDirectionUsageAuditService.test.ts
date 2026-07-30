import { describe, expect, it } from 'vitest';
import {
  buildTransactionTypeDirectionUsageAudit,
  TRANSACTION_TYPE_DIRECTION_USAGE_AUDIT_VERSION,
} from '../../server/services/transactionTypeDirectionUsageAuditService';

const input = {
  workspaceId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  types: [{ id: 'type-a' }, { id: 'type-b' }, { id: 'type-unused' }],
  historicalBookings: [
    { transactionTypeId: 'type-a', direction: 'credit' as const },
    { transactionTypeId: 'type-a', direction: 'debit' as const },
    { transactionTypeId: 'type-b', direction: 'credit' as const },
  ],
};

describe('buildTransactionTypeDirectionUsageAudit', () => {
  it('emits deterministic anonymous aggregates that reconcile exactly', () => {
    const first = buildTransactionTypeDirectionUsageAudit(input);
    const reordered = buildTransactionTypeDirectionUsageAudit({
      ...input,
      types: [...input.types].reverse(),
      historicalBookings: [...input.historicalBookings].reverse(),
    });

    expect(first.algorithmVersion).toBe(TRANSACTION_TYPE_DIRECTION_USAGE_AUDIT_VERSION);
    expect(first.reportHash).toBe(reordered.reportHash);
    expect(first.buckets).toEqual(reordered.buckets);
    expect(first.totals.historicalEvidence).toBe(3);
    expect(first.totals.bucketUsageCount).toBe(3);
    expect(first.buckets.map((bucket) => bucket.anonymousKey)).toEqual(['TYPE_01', 'TYPE_02', 'TYPE_03']);
    expect(first.buckets.map((bucket) => bucket.classification).sort()).toEqual(['mixed-direction', 'single-direction', 'unused']);
    expect(JSON.stringify(first)).not.toContain('type-a');
    expect(first.sideEffects.writesPerformed).toBe(false);
  });

  it('changes the report hash for material factual direction changes', () => {
    const first = buildTransactionTypeDirectionUsageAudit(input);
    const changed = buildTransactionTypeDirectionUsageAudit({
      ...input,
      historicalBookings: [{ transactionTypeId: 'type-a', direction: 'credit' as const }],
    });
    expect(changed.reportHash).not.toBe(first.reportHash);
  });
});
