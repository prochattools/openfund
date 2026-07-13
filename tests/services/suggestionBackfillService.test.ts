import { describe, expect, it } from 'vitest';
import {
  backfillHistorySuggestions,
  buildSuggestionBackfillPlan,
  type SuggestionBackfillHistory,
  type SuggestionBackfillTransaction,
} from '../../server/services/suggestionBackfillService';

const unresolved: SuggestionBackfillTransaction = {
  id: 'target-1',
  date: new Date('2026-06-01T00:00:00.000Z'),
  accountId: 'account-1',
  direction: 'credit',
  amountMinor: 5000n,
  counterparty: 'Stichting Alpha',
  reference: 'Gift YA juni',
  description: 'Maandelijkse gift',
  rawRow: {
    'Counterparty IBAN': 'NL11BANK0123456789',
    Notifications: 'Gift YA juni',
  },
};

const approvedHistory: SuggestionBackfillHistory = {
  ...unresolved,
  id: 'history-1',
  date: new Date('2025-06-01T00:00:00.000Z'),
  transactionBooking: {
    id: 'booking-1',
    projectId: 'project-ya',
    transactionTypeId: 'type-gift-in',
    categoryId: 'category-gifts',
    evidenceHash: 'booking-hash-1',
  },
};

const makeDb = () => {
  const calls = {
    updateMany: [] as any[],
    createMany: [] as any[],
    transactionCallbacks: 0,
    bookingWrites: 0,
  };
  const transaction = {
    findMany: async (args: any) =>
      args.where.transactionBooking === null ? [unresolved] : [approvedHistory],
  };
  const categorizationSuggestion = {
    updateMany: async (args: any) => {
      calls.updateMany.push(args);
      return { count: 2 };
    },
    createMany: async (args: any) => {
      calls.createMany.push(args);
      return { count: args.data.length };
    },
  };
  const tx = { transaction, categorizationSuggestion };
  const db = {
    workspaceMembership: {
      findFirst: async () => ({ workspaceId: 'workspace-1' }),
    },
    transaction,
    categorizationSuggestion,
    $transaction: async (callback: (client: any) => Promise<any>) => {
      calls.transactionCallbacks += 1;
      return callback(tx);
    },
  };
  return { db: db as any, calls };
};

describe('suggestion backfill service', () => {
  it('builds complete ranked suggestions without side effects', () => {
    const plan = buildSuggestionBackfillPlan({
      unresolvedTransactions: [unresolved],
      approvedHistory: [approvedHistory],
    });

    expect(plan).toMatchObject({
      unresolvedTransactionCount: 1,
      compatibleHistoryCount: 1,
      completeRankOneCount: 1,
      uncoveredTransactionCount: 0,
      plannedSuggestionCount: 1,
      sideEffects: {
        writesPerformed: false,
        createsTransactionBooking: false,
        closesPeriod: false,
        mutatesBankFacts: false,
      },
    });
    expect(plan.suggestions[0]).toMatchObject({
      transactionId: 'target-1',
      rank: 1,
      projectId: 'project-ya',
      transactionTypeId: 'type-gift-in',
      categoryId: 'category-gifts',
    });
  });

  it('defaults to dry-run and performs zero writes', async () => {
    const { db, calls } = makeDb();

    const result = await backfillHistorySuggestions(db, { userId: 'user-1' });

    expect(result).toMatchObject({
      status: 'DRY_RUN_COMPLETE',
      dryRun: true,
      writesPerformed: false,
      completeRankOneCount: 1,
      createdSuggestionCount: 0,
      expiredSuggestionCount: 0,
    });
    expect(calls.transactionCallbacks).toBe(0);
    expect(calls.updateMany).toHaveLength(0);
    expect(calls.createMany).toHaveLength(0);
    expect(calls.bookingWrites).toBe(0);
  });

  it('requires environment permission and explicit confirmation for execution', async () => {
    const blocked = makeDb();
    const blockedResult = await backfillHistorySuggestions(blocked.db, {
      userId: 'user-1',
      execute: true,
      executionAllowed: false,
      confirmBackfill: true,
    });
    expect(blockedResult.status).toBe('EXECUTION_NOT_ALLOWED');
    expect(blocked.calls.transactionCallbacks).toBe(0);

    const unconfirmed = makeDb();
    const unconfirmedResult = await backfillHistorySuggestions(unconfirmed.db, {
      userId: 'user-1',
      execute: true,
      executionAllowed: true,
      confirmBackfill: false,
    });
    expect(unconfirmedResult.status).toBe('CONFIRMATION_REQUIRED');
    expect(unconfirmed.calls.transactionCallbacks).toBe(0);
  });

  it('expires stale pending suggestions even when an unresolved transaction has no candidate', async () => {
    const calls = {
      updateMany: [] as any[],
      createMany: [] as any[],
    };
    const incompatibleHistory = {
      ...approvedHistory,
      direction: 'debit' as const,
    };
    const transaction = {
      findMany: async (args: any) =>
        args.where.transactionBooking === null ? [unresolved] : [incompatibleHistory],
    };
    const categorizationSuggestion = {
      updateMany: async (args: any) => {
        calls.updateMany.push(args);
        return { count: 1 };
      },
      createMany: async (args: any) => {
        calls.createMany.push(args);
        return { count: args.data.length };
      },
    };
    const tx = { transaction, categorizationSuggestion };
    const db = {
      workspaceMembership: {
        findFirst: async () => ({ workspaceId: 'workspace-1' }),
      },
      transaction,
      categorizationSuggestion,
      $transaction: async (callback: (client: any) => Promise<any>) => callback(tx),
    } as any;

    const result = await backfillHistorySuggestions(db, {
      userId: 'user-1',
      execute: true,
      executionAllowed: true,
      confirmBackfill: true,
    });

    expect(result).toMatchObject({
      status: 'CREATED',
      completeRankOneCount: 0,
      uncoveredTransactionCount: 1,
      expiredSuggestionCount: 1,
      createdSuggestionCount: 0,
      writesPerformed: true,
    });
    expect(calls.updateMany[0]).toMatchObject({
      where: {
        workspaceId: 'workspace-1',
        transactionId: { in: ['target-1'] },
        status: 'PENDING',
      },
    });
    expect(calls.createMany).toHaveLength(0);
  });

  it('expires only pending suggestions and creates suggestions without bookings', async () => {
    const { db, calls } = makeDb();

    const result = await backfillHistorySuggestions(db, {
      userId: 'user-1',
      execute: true,
      executionAllowed: true,
      confirmBackfill: true,
    });

    expect(result).toMatchObject({
      status: 'CREATED',
      dryRun: false,
      writesPerformed: true,
      expiredSuggestionCount: 2,
      createdSuggestionCount: 1,
      sideEffects: {
        createsCategorizationSuggestion: true,
        expiresPendingSuggestion: true,
        createsTransactionBooking: false,
        closesPeriod: false,
        mutatesBankFacts: false,
      },
    });
    expect(calls.transactionCallbacks).toBe(1);
    expect(calls.updateMany[0]).toMatchObject({
      where: {
        workspaceId: 'workspace-1',
        transactionId: { in: ['target-1'] },
        status: 'PENDING',
      },
      data: { status: 'EXPIRED' },
    });
    expect(calls.createMany[0].data[0]).toMatchObject({
      workspaceId: 'workspace-1',
      transactionId: 'target-1',
      projectId: 'project-ya',
      transactionTypeId: 'type-gift-in',
      categoryId: 'category-gifts',
      rank: 1,
      status: 'PENDING',
    });
    expect(calls.bookingWrites).toBe(0);
  });
});
