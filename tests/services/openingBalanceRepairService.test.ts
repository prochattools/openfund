import { describe, expect, it } from 'vitest';
import {
  APPROVED_OPENING_BALANCE_DATE,
  APPROVED_OPENING_BALANCE_MINOR,
  repairApprovedOpeningBalance,
} from '../../server/services/openingBalanceRepairService';

const account = {
  id: 'account-1',
  identifier: 'NL89INGB0006369960',
  name: 'ING Betaalrekening Yeshua Academy',
  currency: 'EUR',
};

const makeDb = (options: {
  existing?: null | { id: string; amountMinor: bigint; effectiveDate: Date; lockedAt: Date | null };
} = {}) => {
  const calls = {
    createOpeningBalance: [] as any[],
    createAuditLog: [] as any[],
    transactions: 0,
  };
  let existing = options.existing ?? null;
  const tx = {
    account: {
      findUnique: async () => account,
    },
    openingBalance: {
      findUnique: async () => existing,
      create: async (args: any) => {
        calls.createOpeningBalance.push(args);
        existing = {
          id: 'opening-created',
          amountMinor: args.data.amountMinor,
          effectiveDate: args.data.effectiveDate,
          lockedAt: null,
        };
        return existing;
      },
    },
    auditLog: {
      create: async (args: any) => {
        calls.createAuditLog.push(args);
        return { id: 'audit-1', ...args.data };
      },
    },
  };
  const db = {
    ...tx,
    $transaction: async (callback: (client: any) => Promise<any>) => {
      calls.transactions += 1;
      return callback(tx);
    },
  };
  return { db: db as any, calls };
};

describe('opening balance repair service', () => {
  it('defaults to dry-run and performs zero writes', async () => {
    const { db, calls } = makeDb();

    const result = await repairApprovedOpeningBalance(db, { userId: 'user-1' });

    expect(result).toMatchObject({
      status: 'WOULD_CREATE',
      dryRun: true,
      writesPerformed: false,
      approvedControl: {
        effectiveDate: APPROVED_OPENING_BALANCE_DATE.toISOString(),
        amountMinor: APPROVED_OPENING_BALANCE_MINOR.toString(),
        currency: 'EUR',
      },
    });
    expect(calls.transactions).toBe(0);
    expect(calls.createOpeningBalance).toHaveLength(0);
    expect(calls.createAuditLog).toHaveLength(0);
  });

  it('is idempotent when the approved balance already exists', async () => {
    const { db, calls } = makeDb({
      existing: {
        id: 'opening-existing',
        amountMinor: APPROVED_OPENING_BALANCE_MINOR,
        effectiveDate: APPROVED_OPENING_BALANCE_DATE,
        lockedAt: new Date('2024-01-02T00:00:00.000Z'),
      },
    });

    const result = await repairApprovedOpeningBalance(db, {
      userId: 'user-1',
      execute: true,
      executionAllowed: true,
      confirmApprovedControl: true,
    });

    expect(result).toMatchObject({
      status: 'ALREADY_CORRECT',
      dryRun: false,
      writesPerformed: false,
      existing: { locked: true, amountMinor: '172186' },
    });
    expect(calls.transactions).toBe(0);
  });

  it('reports a conflicting amount and never overwrites it', async () => {
    const { db, calls } = makeDb({
      existing: {
        id: 'opening-conflict',
        amountMinor: 100n,
        effectiveDate: APPROVED_OPENING_BALANCE_DATE,
        lockedAt: null,
      },
    });

    const result = await repairApprovedOpeningBalance(db, {
      userId: 'user-1',
      execute: true,
      executionAllowed: true,
      confirmApprovedControl: true,
    });

    expect(result.status).toBe('CONFLICT');
    expect(result.writesPerformed).toBe(false);
    expect(calls.createOpeningBalance).toHaveLength(0);
  });

  it('requires both an execution gate and explicit approved-control confirmation', async () => {
    const first = makeDb();
    const blocked = await repairApprovedOpeningBalance(first.db, {
      userId: 'user-1',
      execute: true,
      executionAllowed: false,
      confirmApprovedControl: true,
    });
    expect(blocked.status).toBe('EXECUTION_NOT_ALLOWED');
    expect(first.calls.transactions).toBe(0);

    const second = makeDb();
    const unconfirmed = await repairApprovedOpeningBalance(second.db, {
      userId: 'user-1',
      execute: true,
      executionAllowed: true,
      confirmApprovedControl: false,
    });
    expect(unconfirmed.status).toBe('CONFIRMATION_REQUIRED');
    expect(second.calls.transactions).toBe(0);
  });

  it('treats a concurrent unique-key winner as idempotent success', async () => {
    let openingReadCount = 0;
    const concurrentRecord = {
      id: 'opening-concurrent',
      amountMinor: APPROVED_OPENING_BALANCE_MINOR,
      effectiveDate: APPROVED_OPENING_BALANCE_DATE,
      lockedAt: null,
    };
    const db = {
      account: {
        findUnique: async () => account,
      },
      openingBalance: {
        findUnique: async () => {
          openingReadCount += 1;
          return openingReadCount === 1 ? null : concurrentRecord;
        },
      },
      $transaction: async () => {
        throw Object.assign(new Error('Unique constraint race'), { code: 'P2002' });
      },
    } as any;

    const result = await repairApprovedOpeningBalance(db, {
      userId: 'user-1',
      execute: true,
      executionAllowed: true,
      confirmApprovedControl: true,
    });

    expect(result).toMatchObject({
      status: 'ALREADY_CORRECT',
      dryRun: false,
      writesPerformed: false,
      existing: {
        id: 'opening-concurrent',
        amountMinor: '172186',
      },
    });
    expect(openingReadCount).toBe(2);
  });

  it('creates exactly one approved balance and audit event inside one transaction', async () => {
    const { db, calls } = makeDb();

    const result = await repairApprovedOpeningBalance(db, {
      userId: 'user-1',
      actorId: 'actor-1',
      actorEmail: 'admin@example.test',
      execute: true,
      executionAllowed: true,
      confirmApprovedControl: true,
    });

    expect(result).toMatchObject({
      status: 'CREATED',
      dryRun: false,
      writesPerformed: true,
      sideEffects: {
        createsOpeningBalance: true,
        createsAuditLog: true,
        createsTransactionBooking: false,
        closesPeriod: false,
      },
    });
    expect(calls.transactions).toBe(1);
    expect(calls.createOpeningBalance).toHaveLength(1);
    expect(calls.createOpeningBalance[0].data).toMatchObject({
      accountId: 'account-1',
      effectiveDate: APPROVED_OPENING_BALANCE_DATE,
      amountMinor: APPROVED_OPENING_BALANCE_MINOR,
      currency: 'EUR',
      createdBy: 'admin@example.test',
    });
    expect(calls.createAuditLog).toHaveLength(1);
    expect(calls.createAuditLog[0].data).toMatchObject({
      action: 'opening-balance.approved-control-created',
      entityType: 'OpeningBalance',
      entityId: 'opening-created',
      userId: 'user-1',
    });
  });
});
