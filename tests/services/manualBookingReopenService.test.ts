import { describe, expect, it } from 'vitest';
import {
  buildLatestManualBookingReopenPlan,
  executeLatestManualBookingReopen,
  ManualBookingReopenError,
} from '../../server/services/manualBookingReopenService';

const workspaceId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const userId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

const criteria = {
  workspaceId,
  userId,
  expectedAmountMinor: 8855n,
  expectedDirection: 'credit' as const,
  expectedMerchantNeedle: 'vistaprint',
  expectedUnresolvedBefore: 34,
};

const makeDb = () => {
  const booking = {
    id: 'booking-1',
    workspaceId,
    transactionId: 'tx-1',
    projectId: 'project-wrong',
    transactionTypeId: 'type-wrong',
    categoryId: 'category-wrong',
    evidenceHash: 'booking-evidence-hash',
  };
  const transaction = {
    id: 'tx-1',
    userId,
    date: new Date('2026-03-20T00:00:00.000Z'),
    amountMinor: 8855n,
    direction: 'credit',
    counterparty: 'Vistaprint B.V.',
    description: 'Refund Vistaprint B.V.',
    reference: null,
    updatedAt: new Date('2026-08-05T17:20:00.000Z'),
    projectId: booking.projectId,
    transactionTypeId: booking.transactionTypeId,
    categoryId: booking.categoryId,
    classificationSource: 'manual',
    classificationRuleId: null,
    ledger: null,
    transactionBooking: booking as typeof booking | null,
  };
  const decisions: any[] = [{
    id: 'decision-1',
    workspaceId,
    transactionId: transaction.id,
    action: 'ASSIGN_MANUALLY',
    beforeBookingId: null,
    beforeProjectId: null,
    beforeTypeId: null,
    beforeCategoryId: null,
    afterBookingId: booking.id,
    afterProjectId: booking.projectId,
    afterTypeId: booking.transactionTypeId,
    afterCategoryId: booking.categoryId,
    actorId: userId,
    actorEmail: null,
    evidence: {},
    evidenceHash: 'decision-evidence-hash',
    decidedAt: new Date('2026-08-05T17:20:00.000Z'),
  }];
  const auditLogs: any[] = [];
  let unresolved = 34;
  let confirmedBookings = 868;

  const db: any = {
    reviewDecision: {
      findFirst: async () => decisions
        .filter((decision) => decision.action === 'ASSIGN_MANUALLY')
        .sort((left, right) => right.decidedAt.getTime() - left.decidedAt.getTime())
        .map((decision) => ({ ...decision, transaction }))
        [0] ?? null,
      findMany: async () => decisions
        .filter((decision) => decision.action === 'ASSIGN_MANUALLY')
        .sort((left, right) => right.decidedAt.getTime() - left.decidedAt.getTime())
        .map((decision) => ({ ...decision, transaction })),
      count: async ({ where }: any) => {
        if (where.transactionId) {
          return decisions.filter((decision) => decision.transactionId === where.transactionId).length;
        }
        if (where.OR) {
          return decisions.filter((decision) => where.OR.some((clause: any) =>
            clause.beforeBookingId === decision.beforeBookingId
            || clause.afterBookingId === decision.afterBookingId,
          )).length;
        }
        return decisions.length;
      },
      update: async ({ where, data }: any) => {
        const decision = decisions.find((item) => item.id === where.id);
        Object.assign(decision, data);
        return decision;
      },
      create: async ({ data }: any) => {
        const decision = { id: `decision-${decisions.length + 1}`, decidedAt: new Date(), ...data };
        decisions.push(decision);
        return decision;
      },
    },
    transaction: {
      count: async ({ where }: any) => where.transactionBooking === null ? unresolved : 902,
      update: async ({ data }: any) => {
        Object.assign(transaction, data);
        transaction.transactionBooking = null;
        unresolved += 1;
        return transaction;
      },
      findUnique: async () => transaction,
    },
    transactionBooking: {
      count: async () => confirmedBookings,
      findUnique: async () => transaction.transactionBooking,
      delete: async () => {
        const current = transaction.transactionBooking;
        transaction.transactionBooking = null;
        confirmedBookings -= 1;
        return current;
      },
    },
    auditLog: {
      create: async ({ data }: any) => {
        const row = { id: `audit-${auditLogs.length + 1}`, ...data };
        auditLogs.push(row);
        return row;
      },
    },
    $transaction: async (callback: (tx: any) => unknown) => callback(db),
  };

  return { auditLogs, booking, db, decisions, transaction };
};

describe('manual booking reopen service', () => {
  it('builds a deterministic dry-run plan for the exact latest confirmation', async () => {
    const { db } = makeDb();
    const first = await buildLatestManualBookingReopenPlan(db, criteria);
    const second = await buildLatestManualBookingReopenPlan(db, criteria);

    expect(first.planHash).toBe(second.planHash);
    expect(first.amountMinor).toBe('8855');
    expect(first.direction).toBe('credit');
    expect(first.merchantMatched).toBe(true);
    expect(first.counts).toMatchObject({
      totalTransactions: 902,
      confirmedBookingsBefore: 868,
      unresolvedBefore: 34,
      confirmedBookingsAfter: 867,
      unresolvedAfter: 35,
    });
    expect(first.sideEffects.writesPerformed).toBe(false);
  });

  it('fails closed when the latest confirmation does not match the authorized facts', async () => {
    const { db, transaction } = makeDb();
    transaction.counterparty = 'Another merchant';
    transaction.description = 'Unrelated transaction';

    await expect(buildLatestManualBookingReopenPlan(db, criteria)).rejects.toMatchObject({
      code: 'MATCHING_CONFIRMATION_NOT_FOUND',
    });
  });

  it('fails closed when the unresolved baseline changed', async () => {
    const { db } = makeDb();
    await expect(buildLatestManualBookingReopenPlan(db, {
      ...criteria,
      expectedUnresolvedBefore: 35,
    })).rejects.toMatchObject({ code: 'UNRESOLVED_COUNT_MISMATCH' });
  });

  it('returns HASH_DRIFT without writes for an unconfirmed plan hash', async () => {
    const { db, transaction } = makeDb();
    const result = await executeLatestManualBookingReopen(db, {
      ...criteria,
      actorId: userId,
      confirmedPlanHash: 'wrong-hash',
    });

    expect(result.status).toBe('HASH_DRIFT');
    expect(result.writesPerformed).toBe(false);
    expect(transaction.transactionBooking).not.toBeNull();
  });

  it('reopens exactly one transaction with an append-only compensating decision and audit log', async () => {
    const { auditLogs, db, decisions, transaction } = makeDb();
    const plan = await buildLatestManualBookingReopenPlan(db, criteria);
    const result = await executeLatestManualBookingReopen(db, {
      ...criteria,
      actorId: userId,
      actorEmail: 'admin@example.test',
      confirmedPlanHash: plan.planHash,
    });

    expect(result.status).toBe('REOPENED');
    if (result.status !== 'REOPENED') throw new Error('expected reopened');
    expect(result.counts).toEqual({ confirmedBookingsAfter: 867, unresolvedAfter: 35 });
    expect(result.sideEffects).toEqual({
      deletedBookingCount: 1,
      createdReviewDecisionCount: 1,
      changedTransactionCount: 1,
      changedSuggestionCount: 0,
      changedImportedBankFactCount: 0,
    });
    expect(transaction.transactionBooking).toBeNull();
    expect(transaction).toMatchObject({
      projectId: null,
      transactionTypeId: null,
      categoryId: null,
      classificationSource: 'none',
    });
    expect(decisions[0].afterBookingId).toBeNull();
    expect(decisions[1]).toMatchObject({
      action: 'REMOVE_BOOKING',
      beforeProjectId: 'project-wrong',
      afterProjectId: null,
    });
    expect(auditLogs).toHaveLength(1);
    expect(auditLogs[0]).toMatchObject({ action: 'transaction.booking.reopened' });
  });

  it('rejects ambiguous matching confirmations before execution', async () => {
    const { db, decisions } = makeDb();
    decisions.push({ ...decisions[0], id: 'decision-older', decidedAt: new Date('2026-08-05T16:00:00.000Z') });

    await expect(buildLatestManualBookingReopenPlan(db, criteria)).rejects.toBeInstanceOf(ManualBookingReopenError);
    await expect(buildLatestManualBookingReopenPlan(db, criteria)).rejects.toMatchObject({
      code: 'MATCHING_CONFIRMATION_AMBIGUOUS',
    });
  });
});
