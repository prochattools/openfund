import { describe, expect, it } from 'vitest';
import {
  assignManualBooking,
  BULK_CONFIRMATION_DISABLED_MESSAGE,
  canonicalizeEvidence,
  hashEvidence,
  INCOMPLETE_DIMENSIONS_MESSAGE,
  isCompleteReviewAssignmentPayload,
  rejectUnsafeBulkConfirmation,
  ReviewDecisionError,
} from '../../server/services/reviewDecisionService';

const workspaceId = '00000000-0000-4000-8000-000000000001';

const makeDb = (overrides: Record<string, any> = {}) => {
  const calls: any[] = [];
  const project = overrides.project ?? {
    id: 'project-1',
    workspaceId,
    name: 'Yeshua Academy',
  };
  const transactionType = overrides.transactionType ?? {
    id: 'type-1',
    workspaceId,
    literalName: 'Schenking in',
  };
  const category = overrides.category ?? {
    id: 'cat-1',
    workspaceId,
    name: 'Giften',
  };
  const transaction = overrides.transaction ?? {
    id: 'tx-1',
    userId: 'user-1',
    projectId: null,
    transactionTypeId: null,
    categoryId: null,
    classificationSource: 'none',
    classificationRuleId: null,
    ledger: null,
    transactionBooking: null,
  };

  const db = {
    transaction: {
      findFirst: async (args: any) => {
        calls.push({ model: 'transaction', method: 'findFirst', args });
        return transaction;
      },
      update: async (args: any) => {
        calls.push({ model: 'transaction', method: 'update', args });
        return {
          ...transaction,
          ...args.data,
          category,
          project,
          transactionType,
          transactionBooking: { id: 'booking-1' },
        };
      },
    },
    project: {
      findUnique: async (args: any) => {
        calls.push({ model: 'project', method: 'findUnique', args });
        return project;
      },
    },
    transactionType: {
      findUnique: async (args: any) => {
        calls.push({ model: 'transactionType', method: 'findUnique', args });
        return transactionType;
      },
    },
    category: {
      findUnique: async (args: any) => {
        calls.push({ model: 'category', method: 'findUnique', args });
        return category;
      },
    },
    workspaceMembership: {
      findFirst: async (args: any) => {
        calls.push({ model: 'workspaceMembership', method: 'findFirst', args });
        return overrides.membership === undefined ? { id: 'membership-1' } : overrides.membership;
      },
    },
    transactionBooking: {
      upsert: async (args: any) => {
        calls.push({ model: 'transactionBooking', method: 'upsert', args });
        return {
          id: 'booking-1',
          ...args.create,
          ...args.update,
        };
      },
    },
    reviewDecision: {
      create: async (args: any) => {
        calls.push({ model: 'reviewDecision', method: 'create', args });
        return {
          id: 'decision-1',
          ...args.data,
        };
      },
    },
    auditLog: {
      create: async (args: any) => {
        calls.push({ model: 'auditLog', method: 'create', args });
        return {
          id: 'audit-1',
          ...args.data,
        };
      },
    },
  } as any;

  return { calls, db };
};

describe('review decision service', () => {
  it('canonicalizes and hashes evidence with stable key ordering', () => {
    const left = { after: { categoryId: 'cat-1', projectId: 'project-1' }, action: 'ASSIGN' };
    const right = { action: 'ASSIGN', after: { projectId: 'project-1', categoryId: 'cat-1' } };

    expect(canonicalizeEvidence(left)).toBe(canonicalizeEvidence(right));
    expect(hashEvidence(left)).toBe(hashEvidence(right));
    expect(hashEvidence(left)).toHaveLength(64);
  });

  it('detects complete and incomplete review assignment payloads', () => {
    expect(isCompleteReviewAssignmentPayload({
      projectId: 'project-1',
      transactionTypeId: 'type-1',
      categoryId: 'cat-1',
    })).toBe(true);
    expect(isCompleteReviewAssignmentPayload({
      transactionTypeId: 'type-1',
      categoryId: 'cat-1',
    })).toBe(false);
  });

  it('assigns a manual booking, writes a review decision, and mirrors legacy fields', async () => {
    const { calls, db } = makeDb();

    const result = await assignManualBooking(db, {
      actor: {
        userId: 'user-1',
        role: 'admin',
        actorId: 'actor-1',
        actorEmail: 'finance@example.test',
      },
      transactionId: 'tx-1',
      projectId: 'project-1',
      transactionTypeId: 'type-1',
      categoryId: 'cat-1',
      reason: 'Beoordeling afgerond',
    });

    const bookingCall = calls.find((call) => call.model === 'transactionBooking');
    const decisionCall = calls.find((call) => call.model === 'reviewDecision');
    const transactionUpdateCall = calls.find((call) => call.model === 'transaction' && call.method === 'update');
    const auditCall = calls.find((call) => call.model === 'auditLog');

    expect(result.booking.id).toBe('booking-1');
    expect(result.decision.id).toBe('decision-1');
    expect(bookingCall.args.where).toEqual({ transactionId: 'tx-1' });
    expect(bookingCall.args.create).toMatchObject({
      workspaceId,
      transactionId: 'tx-1',
      projectId: 'project-1',
      transactionTypeId: 'type-1',
      categoryId: 'cat-1',
      source: 'MANUAL',
      confirmedBy: 'actor-1',
      literalProjectLabel: 'Yeshua Academy',
      literalTypeLabel: 'Schenking in',
      literalCategoryLabel: 'Giften',
    });
    expect(decisionCall.args.data).toMatchObject({
      workspaceId,
      transactionId: 'tx-1',
      action: 'ASSIGN_MANUALLY',
      afterBookingId: 'booking-1',
      afterProjectId: 'project-1',
      afterTypeId: 'type-1',
      afterCategoryId: 'cat-1',
      actorId: 'actor-1',
      actorEmail: 'finance@example.test',
      reason: 'Beoordeling afgerond',
    });
    expect(transactionUpdateCall.args.data).toEqual({
      projectId: 'project-1',
      transactionTypeId: 'type-1',
      categoryId: 'cat-1',
      classificationSource: 'manual',
      classificationRuleId: null,
    });
    expect(auditCall.args.data.action).toBe('transaction.booking.assigned');
  });

  it('rejects viewer actors before writing', async () => {
    const { calls, db } = makeDb();

    await expect(assignManualBooking(db, {
      actor: { userId: 'user-1', role: 'viewer' },
      transactionId: 'tx-1',
      projectId: 'project-1',
      transactionTypeId: 'type-1',
      categoryId: 'cat-1',
    })).rejects.toMatchObject({ statusCode: 403 });

    expect(calls).toHaveLength(0);
  });

  it('allows audited recategorization in a financially reconciled/locked ledger', async () => {
    const { calls, db } = makeDb({
      transaction: {
        id: 'tx-locked',
        userId: 'user-1',
        projectId: 'project-old',
        transactionTypeId: 'type-old',
        categoryId: 'cat-old',
        ledger: { lockedAt: new Date('2026-05-31T00:00:00.000Z') },
        transactionBooking: {
          id: 'booking-old',
          projectId: 'project-old',
          transactionTypeId: 'type-old',
          categoryId: 'cat-old',
        },
      },
    });

    const result = await assignManualBooking(db, {
      actor: { userId: 'user-1', role: 'admin', actorId: 'actor-1' },
      transactionId: 'tx-locked',
      projectId: 'project-1',
      transactionTypeId: 'type-1',
      categoryId: 'cat-1',
      reason: 'Correctie categorie',
    });

    expect(result.booking.id).toBe('booking-1');
    const bookingCall = calls.find((call) => call.model === 'transactionBooking');
    const decisionCall = calls.find((call) => call.model === 'reviewDecision');
    const transactionUpdateCall = calls.find((call) => call.model === 'transaction' && call.method === 'update');
    expect(bookingCall.args.update).toMatchObject({
      projectId: 'project-1',
      transactionTypeId: 'type-1',
      categoryId: 'cat-1',
    });
    expect(decisionCall.args.data).toMatchObject({
      beforeProjectId: 'project-old',
      beforeTypeId: 'type-old',
      beforeCategoryId: 'cat-old',
      afterProjectId: 'project-1',
      afterTypeId: 'type-1',
      afterCategoryId: 'cat-1',
      reason: 'Correctie categorie',
    });
    expect(transactionUpdateCall.args.data).not.toHaveProperty('amountMinor');
    expect(transactionUpdateCall.args.data).not.toHaveProperty('direction');
    expect(transactionUpdateCall.args.data).not.toHaveProperty('bankDate');
  });

  it('rejects cross-workspace dimensions', async () => {
    const { db } = makeDb({
      category: {
        id: 'cat-other',
        workspaceId: 'other-workspace',
        name: 'Andere categorie',
      },
    });

    await expect(assignManualBooking(db, {
      actor: { userId: 'user-1', role: 'admin' },
      transactionId: 'tx-1',
      projectId: 'project-1',
      transactionTypeId: 'type-1',
      categoryId: 'cat-other',
    })).rejects.toMatchObject({ statusCode: 400 });
  });

  it('rejects unsafe bulk confirmation with the Dutch explanation', () => {
    expect(() => rejectUnsafeBulkConfirmation()).toThrow(ReviewDecisionError);
    expect(() => rejectUnsafeBulkConfirmation()).toThrow(BULK_CONFIRMATION_DISABLED_MESSAGE);
  });

  it('rejects missing dimensions with the Dutch explanation', async () => {
    const { db } = makeDb();

    await expect(assignManualBooking(db, {
      actor: { userId: 'user-1', role: 'admin' },
      transactionId: 'tx-1',
      projectId: 'project-1',
      transactionTypeId: 'type-1',
      categoryId: '',
    })).rejects.toMatchObject({
      message: INCOMPLETE_DIMENSIONS_MESSAGE,
      statusCode: 400,
    });
  });
});
