import { describe, expect, it, vi } from 'vitest';
import { PeriodCloseStatus, ReportKind, ReportLineKind } from '@prisma/client';
import {
  generateMonthlyReportSnapshot,
  generateYearlyReportSnapshot,
  generateLiveMonthlyReportSnapshot,
  classifyReportLines,
  classifyReportLinePresentation,
  computePresentationTotals,
  ReportSnapshotError,
  type MonthlyReportActor,
} from '../../server/services/reportSnapshotService';

// ─── Shared fixtures ──────────────────────────────────────────────────────────

const adminActor: MonthlyReportActor = {
  userId: 'user-1',
  role: 'admin',
  actorId: 'actor-1',
};

const viewerActor: MonthlyReportActor = {
  userId: 'user-2',
  role: 'viewer',
  actorId: 'actor-2',
};

const closedClose = {
  id: 'close-jan-2026',
  workspaceId: 'workspace-1',
  status: PeriodCloseStatus.CLOSED,
  periodStart: new Date('2026-01-01T00:00:00Z'),
  periodEnd: new Date('2026-01-31T23:59:59Z'),
  openingBalanceMinor: 1000000n,
  incomeMinor: 250000n,
  expenseMinor: 100000n,
  netMinor: 150000n,
  closingBalanceMinor: 1150000n,
  transactionCount: 5,
  classificationHash: 'hash-class-1',
  sourceDataHash: 'hash-source-1',
};

const reopenedClose = {
  ...closedClose,
  id: 'close-feb-2026',
  status: PeriodCloseStatus.REOPENED,
  periodStart: new Date('2026-02-01T00:00:00Z'),
  periodEnd: new Date('2026-02-28T23:59:59Z'),
};

const bookings = [
  {
    projectId: 'project-ya',
    transactionTypeId: 'type-schenking',
    categoryId: 'cat-giften-in',
    literalProjectLabel: 'YA',
    literalTypeLabel: 'Schenking',
    literalCategoryLabel: 'Giften in',
    transaction: { amountMinor: 100000n, direction: 'credit' },
  },
  {
    projectId: 'project-ya',
    transactionTypeId: 'type-schenking',
    categoryId: 'cat-giften-in',
    literalProjectLabel: 'YA',
    literalTypeLabel: 'Schenking',
    literalCategoryLabel: 'Giften in',
    transaction: { amountMinor: 100000n, direction: 'credit' },
  },
  {
    projectId: 'project-ya',
    transactionTypeId: 'type-schenking',
    categoryId: 'cat-giften-in',
    literalProjectLabel: 'YA',
    literalTypeLabel: 'Schenking',
    literalCategoryLabel: 'Giften in',
    transaction: { amountMinor: 50000n, direction: 'credit' },
  },
  {
    projectId: 'project-ya',
    transactionTypeId: 'type-algemeen',
    categoryId: 'cat-kosten-uit',
    literalProjectLabel: 'YA',
    literalTypeLabel: 'Algemeen',
    literalCategoryLabel: 'Administratiekosten uit',
    transaction: { amountMinor: 60000n, direction: 'debit' },
  },
  {
    projectId: 'project-ya',
    transactionTypeId: 'type-algemeen',
    categoryId: 'cat-kosten-uit',
    literalProjectLabel: 'YA',
    literalTypeLabel: 'Algemeen',
    literalCategoryLabel: 'Administratiekosten uit',
    transaction: { amountMinor: -40000n, direction: 'debit' },
  },
];

const febBookings = [
  {
    projectId: 'project-ya',
    transactionTypeId: 'type-schenking',
    categoryId: 'cat-giften-in',
    literalProjectLabel: 'YA',
    literalTypeLabel: 'Schenking',
    literalCategoryLabel: 'Giften in',
    transaction: { amountMinor: 100000n, direction: 'credit' },
  },
  {
    projectId: 'project-ya',
    transactionTypeId: 'type-schenking',
    categoryId: 'cat-giften-in',
    literalProjectLabel: 'YA',
    literalTypeLabel: 'Schenking',
    literalCategoryLabel: 'Giften in',
    transaction: { amountMinor: 100000n, direction: 'credit' },
  },
  {
    projectId: 'project-ya',
    transactionTypeId: 'type-schenking',
    categoryId: 'cat-giften-in',
    literalProjectLabel: 'YA',
    literalTypeLabel: 'Schenking',
    literalCategoryLabel: 'Giften in',
    transaction: { amountMinor: 100000n, direction: 'credit' },
  },
  {
    projectId: 'project-ya',
    transactionTypeId: 'type-algemeen',
    categoryId: 'cat-kosten-uit',
    literalProjectLabel: 'YA',
    literalTypeLabel: 'Algemeen',
    literalCategoryLabel: 'Administratiekosten uit',
    transaction: { amountMinor: 100000n, direction: 'debit' },
  },
  {
    projectId: 'project-ya',
    transactionTypeId: 'type-algemeen',
    categoryId: 'cat-kosten-uit',
    literalProjectLabel: 'YA',
    literalTypeLabel: 'Algemeen',
    literalCategoryLabel: 'Administratiekosten uit',
    transaction: { amountMinor: 50000n, direction: 'debit' },
  },
  {
    projectId: 'project-ya',
    transactionTypeId: 'type-algemeen',
    categoryId: 'cat-kosten-uit',
    literalProjectLabel: 'YA',
    literalTypeLabel: 'Algemeen',
    literalCategoryLabel: 'Administratiekosten uit',
    transaction: { amountMinor: 0n, direction: 'debit' },
  },
  {
    projectId: 'project-ya',
    transactionTypeId: 'type-algemeen',
    categoryId: 'cat-kosten-uit',
    literalProjectLabel: 'YA',
    literalTypeLabel: 'Algemeen',
    literalCategoryLabel: 'Administratiekosten uit',
    transaction: { amountMinor: 0n, direction: 'debit' },
  },
  {
    projectId: 'project-ya',
    transactionTypeId: 'type-algemeen',
    categoryId: 'cat-kosten-uit',
    literalProjectLabel: 'YA',
    literalTypeLabel: 'Algemeen',
    literalCategoryLabel: 'Administratiekosten uit',
    transaction: { amountMinor: 0n, direction: 'debit' },
  },
];

// ─── Mock DB builder ──────────────────────────────────────────────────────────

const makeDb = (opts: {
  findFirstClose?: ReturnType<typeof closedClose['constructor']> | null;
  findManyCloses?: typeof closedClose[];
  findFirstSnapshot?: { version: number } | null;
  bookings?: typeof bookings;
  createdSnapshot?: { id: string; snapshotHash: string; generatedAt: Date } | null;
} = {}) => {
  const calls: string[] = [];

  const db = {
    periodClose: {
      findFirst: async (args: any) => {
        calls.push('periodClose.findFirst');
        if (opts.findFirstClose !== undefined) return opts.findFirstClose;
        // Default: return a closed close if status filter is CLOSED
        if (args?.where?.status === 'CLOSED') return closedClose;
        return null;
      },
      findMany: async (_args: any) => {
        calls.push('periodClose.findMany');
        return opts.findManyCloses ?? [closedClose];
      },
    },
    transactionBooking: {
      findMany: async (_args: any) => {
        calls.push('transactionBooking.findMany');
        if (opts.bookings) return opts.bookings;
        return _args?.where?.transaction?.OR?.length > 1
          ? [...bookings, ...febBookings]
          : bookings;
      },
    },
    reportSnapshot: {
      findFirst: async (_args: any) => {
        calls.push('reportSnapshot.findFirst');
        return opts.findFirstSnapshot ?? null;
      },
      create: async (args: any) => {
        calls.push('reportSnapshot.create');
        const hash = opts.createdSnapshot?.snapshotHash ?? 'deterministic-hash-123abc456def7890abcd1234567890abcdef1234567890abcdef1234567890ab';
        return {
          id: opts.createdSnapshot?.id ?? 'snapshot-1',
          snapshotHash: hash,
          generatedAt: opts.createdSnapshot?.generatedAt ?? new Date('2026-07-05T10:00:00Z'),
          ...args.data,
        };
      },
    },
    _calls: calls,
  } as any;

  return db;
};

// ─── REPORT-001: Monthly report snapshot ─────────────────────────────────────

describe('monthly report snapshot', () => {
  it('generates a monthly snapshot from one closed period', async () => {
    const db = makeDb();
    const result = await generateMonthlyReportSnapshot(db, {
      actor: adminActor,
      workspaceId: 'workspace-1',
      year: 2026,
      month: 1,
    });

    expect(result.kind).toBe(ReportKind.MONTHLY);
    expect(result.year).toBe(2026);
    expect(result.month).toBe(1);
    expect(result.version).toBe(1);
    expect(result.openingBalanceMinor).toBe('1000000');
    expect(result.incomeMinor).toBe('250000');
    expect(result.expenseMinor).toBe('100000');
    expect(result.netMinor).toBe('150000');
    expect(result.closingBalanceMinor).toBe('1150000');
    expect(result.transactionCount).toBe(5);
    expect(result.periodCloseIds).toContain('close-jan-2026');
    expect(result.snapshotHash).toHaveLength(64);
    expect(result.generatedBy).toBe('actor-1');
    expect(result.sideEffects.createsReportSnapshot).toBe(true);
    expect(result.sideEffects.createsReportApproval).toBe(false);
    expect(result.sideEffects.createsReportArtifact).toBe(false);
    expect(result.sideEffects.dispatchesReport).toBe(false);
  });

  it('increments version when a prior snapshot exists for the same month', async () => {
    const db = makeDb({ findFirstSnapshot: { version: 3 } });
    const result = await generateMonthlyReportSnapshot(db, {
      actor: adminActor,
      workspaceId: 'workspace-1',
      year: 2026,
      month: 1,
    });

    expect(result.version).toBe(4);
  });

  it('rejects an open or reopened period close', async () => {
    // Simulate the close returned by findMany having REOPENED status
    const db = makeDb({
      findManyCloses: [reopenedClose as any],
      findFirstClose: reopenedClose as any,
    });

    await expect(
      generateMonthlyReportSnapshot(db, {
        actor: adminActor,
        workspaceId: 'workspace-1',
        year: 2026,
        month: 1,
        periodCloseIds: ['close-feb-2026'],
      }),
    ).rejects.toThrow(ReportSnapshotError);
  });

  it('rejects when no closed period is found for the month', async () => {
    const db = makeDb({ findFirstClose: null });

    await expect(
      generateMonthlyReportSnapshot(db, {
        actor: adminActor,
        workspaceId: 'workspace-1',
        year: 2026,
        month: 3,
      }),
    ).rejects.toThrow(ReportSnapshotError);
  });

  it('rejects viewer actors with a Dutch error', async () => {
    const db = makeDb();

    await expect(
      generateMonthlyReportSnapshot(db, {
        actor: viewerActor,
        workspaceId: 'workspace-1',
        year: 2026,
        month: 1,
      }),
    ).rejects.toThrow(ReportSnapshotError);

    await expect(
      generateMonthlyReportSnapshot(db, {
        actor: viewerActor,
        workspaceId: 'workspace-1',
        year: 2026,
        month: 1,
      }),
    ).rejects.toThrow(/beheerders/);
  });

  it('preserves literal Klant/Type/Category labels from bookings', async () => {
    const db = makeDb();
    const result = await generateMonthlyReportSnapshot(db, {
      actor: adminActor,
      workspaceId: 'workspace-1',
      year: 2026,
      month: 1,
    });

    const incomeLine = result.lines.find((l) => l.direction === 'credit');
    expect(incomeLine?.literalProjectLabel).toBe('YA');
    expect(incomeLine?.literalTypeLabel).toBe('Schenking');
    expect(incomeLine?.literalCategoryLabel).toBe('Giften in');

    const expenseLine = result.lines.find((l) => l.direction === 'debit');
    expect(expenseLine?.literalProjectLabel).toBe('YA');
    expect(expenseLine?.literalTypeLabel).toBe('Algemeen');
    expect(expenseLine?.literalCategoryLabel).toBe('Administratiekosten uit');
  });

  it('totals reconcile to period close totals', async () => {
    const db = makeDb();
    const result = await generateMonthlyReportSnapshot(db, {
      actor: adminActor,
      workspaceId: 'workspace-1',
      year: 2026,
      month: 1,
    });

    // Income = sum of credit lines
    const creditSum = result.lines
      .filter((l) => l.direction === 'credit')
      .reduce((acc, l) => acc + BigInt(l.amountMinor), 0n);
    expect(creditSum.toString()).toBe(result.incomeMinor);

    // Expense = sum of debit lines
    const debitSum = result.lines
      .filter((l) => l.direction === 'debit')
      .reduce((acc, l) => acc + BigInt(l.amountMinor), 0n);
    expect(debitSum.toString()).toBe(result.expenseMinor);
  });

  it('snapshot hash is deterministic for same inputs', async () => {
    const db1 = makeDb();
    const db2 = makeDb();

    const r1 = await generateMonthlyReportSnapshot(db1, {
      actor: adminActor,
      workspaceId: 'workspace-1',
      year: 2026,
      month: 1,
      periodCloseIds: ['close-jan-2026'],
    });
    const r2 = await generateMonthlyReportSnapshot(db2, {
      actor: adminActor,
      workspaceId: 'workspace-1',
      year: 2026,
      month: 1,
      periodCloseIds: ['close-jan-2026'],
    });

    // Both snapshots use the same inputs; both hashes come from createReportSnapshot
    // which produces a deterministic hash — both will produce the same hash
    expect(r1.snapshotHash).toBe(r2.snapshotHash);
  });

  it('does not create approvals, artifacts, or dispatches', async () => {
    const db = makeDb();
    const result = await generateMonthlyReportSnapshot(db, {
      actor: adminActor,
      workspaceId: 'workspace-1',
      year: 2026,
      month: 1,
    });

    expect(result.sideEffects.createsReportApproval).toBe(false);
    expect(result.sideEffects.createsReportArtifact).toBe(false);
    expect(result.sideEffects.dispatchesReport).toBe(false);
    // Verify db was never called for approval/dispatch
    expect(db._calls).not.toContain('reportApproval.create');
    expect(db._calls).not.toContain('reportDispatch.create');
  });
});

// ─── REPORT-002: Yearly report snapshot ──────────────────────────────────────

describe('yearly report snapshot', () => {
  const closedFeb = {
    ...closedClose,
    id: 'close-feb-2026',
    status: PeriodCloseStatus.CLOSED,
    periodStart: new Date('2026-02-01T00:00:00Z'),
    periodEnd: new Date('2026-02-28T23:59:59Z'),
    openingBalanceMinor: 1150000n,
    incomeMinor: 300000n,
    expenseMinor: 150000n,
    netMinor: 150000n,
    closingBalanceMinor: 1300000n,
    transactionCount: 8,
  };

  it('generates a yearly snapshot from multiple closed months', async () => {
    const db = makeDb({
      findManyCloses: [closedClose, closedFeb],
    });
    const result = await generateYearlyReportSnapshot(db, {
      actor: adminActor,
      workspaceId: 'workspace-1',
      year: 2026,
    });

    expect(result.kind).toBe(ReportKind.YEARLY);
    expect(result.year).toBe(2026);
    expect(result.month).toBeNull();
    expect(result.transactionCount).toBe(13); // 5 + 8
    expect(result.incomeMinor).toBe('550000'); // 250000 + 300000
    expect(result.expenseMinor).toBe('250000'); // 100000 + 150000
    expect(result.netMinor).toBe('300000');
    expect(result.openingBalanceMinor).toBe('1000000'); // opening of first month
    expect(result.periodCloseIds).toHaveLength(2);
  });

  it('chains yearly closes independently for each bank account', async () => {
    const januaryAccountA = {
      ...closedClose,
      id: 'close-jan-account-a',
      statementPeriod: { accountId: 'account-a' },
    };
    const februaryAccountB = {
      ...closedFeb,
      id: 'close-feb-account-b',
      statementPeriod: { accountId: 'account-b' },
      openingBalanceMinor: 2000000n,
      closingBalanceMinor: 2150000n,
    };
    const db = makeDb({ findManyCloses: [januaryAccountA, februaryAccountB] });

    await expect(generateYearlyReportSnapshot(db, {
      actor: adminActor,
      workspaceId: 'workspace-1',
      year: 2026,
    })).resolves.toMatchObject({
      periodCloseIds: ['close-jan-account-a', 'close-feb-account-b'],
    });
  });

  it('opening + income - expenses = closing exactly', async () => {
    const db = makeDb({ findManyCloses: [closedClose, closedFeb] });
    const result = await generateYearlyReportSnapshot(db, {
      actor: adminActor,
      workspaceId: 'workspace-1',
      year: 2026,
    });

    const computed =
      BigInt(result.openingBalanceMinor) +
      BigInt(result.incomeMinor) -
      BigInt(result.expenseMinor);
    expect(computed.toString()).toBe(result.closingBalanceMinor);
  });

  it('reports missing open months', async () => {
    // Only January is closed; months 2-12 are missing
    const db = makeDb({ findManyCloses: [closedClose] });
    const result = await generateYearlyReportSnapshot(db, {
      actor: adminActor,
      workspaceId: 'workspace-1',
      year: 2026,
    });

    expect(result.missingMonths).toBeDefined();
    expect(result.missingMonths).toContain(2);
    expect(result.missingMonths).toContain(12);
    expect(result.missingMonths).not.toContain(1); // January IS closed
  });

  it('rejects when no closed periods exist for the year', async () => {
    const db = makeDb({ findManyCloses: [] });

    await expect(
      generateYearlyReportSnapshot(db, {
        actor: adminActor,
        workspaceId: 'workspace-1',
        year: 2025,
      }),
    ).rejects.toThrow(ReportSnapshotError);
  });

  it('rejects reopened closes in explicit list', async () => {
    const db = makeDb({ findManyCloses: [reopenedClose as any] });

    await expect(
      generateYearlyReportSnapshot(db, {
        actor: adminActor,
        workspaceId: 'workspace-1',
        year: 2026,
        periodCloseIds: ['close-feb-2026'],
      }),
    ).rejects.toThrow(ReportSnapshotError);
  });

  it('preserves literal labels in yearly report lines', async () => {
    const db = makeDb({ findManyCloses: [closedClose] });
    const result = await generateYearlyReportSnapshot(db, {
      actor: adminActor,
      workspaceId: 'workspace-1',
      year: 2026,
    });

    const line = result.lines[0];
    expect(line.literalProjectLabel).toBeTruthy();
    expect(line.literalTypeLabel).toBeTruthy();
    expect(line.literalCategoryLabel).toBeTruthy();
  });

  it('snapshot hash is deterministic', async () => {
    const db1 = makeDb({ findManyCloses: [closedClose] });
    const db2 = makeDb({ findManyCloses: [closedClose] });

    const r1 = await generateYearlyReportSnapshot(db1, {
      actor: adminActor,
      workspaceId: 'workspace-1',
      year: 2026,
      periodCloseIds: ['close-jan-2026'],
    });
    const r2 = await generateYearlyReportSnapshot(db2, {
      actor: adminActor,
      workspaceId: 'workspace-1',
      year: 2026,
      periodCloseIds: ['close-jan-2026'],
    });

    expect(r1.snapshotHash).toBe(r2.snapshotHash);
  });

  it('does not create approvals, artifacts, or dispatches', async () => {
    const db = makeDb({ findManyCloses: [closedClose] });
    const result = await generateYearlyReportSnapshot(db, {
      actor: adminActor,
      workspaceId: 'workspace-1',
      year: 2026,
    });

    expect(result.sideEffects.createsReportApproval).toBe(false);
    expect(result.sideEffects.createsReportArtifact).toBe(false);
    expect(result.sideEffects.dispatchesReport).toBe(false);
  });
});

// ─── REPORT-001b: Live monthly report snapshot ──────────────────────────────

describe('live monthly report snapshot', () => {
  const statement = {
    id: 'statement-aug-2026',
    accountId: 'account-1',
    coverageStatus: 'COMPLETE',
    openingBalanceMinor: 100000n,
    incomeMinor: 5000n,
    expenseMinor: 3000n,
    netMinor: 2000n,
    closingBalanceMinor: 102000n,
    transactionCount: 2,
  };
  const transactions = [
    { id: 'tx-income', amountMinor: 5000n, direction: 'credit', importFingerprint: 'fp-income' },
    { id: 'tx-expense', amountMinor: -3000n, direction: 'debit', importFingerprint: 'fp-expense' },
  ];
  const liveBookings = [
    {
      transactionId: 'tx-income',
      projectId: 'project-ya',
      transactionTypeId: 'type-gift',
      categoryId: 'category-income',
      literalProjectLabel: 'YA',
      literalTypeLabel: 'Schenking',
      literalCategoryLabel: 'Giften in',
      transaction: { amountMinor: 5000n, direction: 'credit' },
    },
    {
      transactionId: 'tx-expense',
      projectId: 'project-ya',
      transactionTypeId: 'type-cost',
      categoryId: 'category-expense',
      literalProjectLabel: 'YA',
      literalTypeLabel: 'Algemeen',
      literalCategoryLabel: 'Administratiekosten uit',
      transaction: { amountMinor: -3000n, direction: 'debit' },
    },
  ];

  const makeLiveDb = (overrides: { statement?: typeof statement | null; transactions?: typeof transactions } = {}) => {
    const db = {
      bankStatement: {
        findFirst: vi.fn().mockResolvedValue(overrides.statement === undefined ? statement : overrides.statement),
      },
      transaction: {
        findMany: vi.fn().mockResolvedValue(overrides.transactions ?? transactions),
      },
      transactionBooking: {
        findMany: vi.fn().mockResolvedValue(liveBookings),
      },
      reportSnapshot: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockImplementation(async (args: any) => ({
          id: 'live-snapshot-1',
          snapshotHash: 'a'.repeat(64),
          generatedAt: new Date('2026-09-01T10:00:00Z'),
          ...args.data,
        })),
      },
    } as any;
    return db;
  };

  const reconciliation = {
    bankStatementId: statement.id,
    accountId: statement.accountId,
    openingBalanceMinor: statement.openingBalanceMinor,
    incomeMinor: statement.incomeMinor,
    expenseMinor: statement.expenseMinor,
    netMinor: statement.netMinor,
    closingBalanceMinor: statement.closingBalanceMinor,
    transactionCount: statement.transactionCount,
  };

  it('uses complete bank evidence, isolates the statement account, and preserves exact live totals', async () => {
    const db = makeLiveDb();
    const result = await generateLiveMonthlyReportSnapshot(db, {
      actor: adminActor,
      workspaceId: 'workspace-1',
      year: 2026,
      month: 8,
      reconciliation,
    });

    expect(db.transaction.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ accountId: 'account-1' }),
    }));
    expect(result.openingBalanceMinor).toBe('100000');
    expect(result.incomeMinor).toBe('5000');
    expect(result.expenseMinor).toBe('3000');
    expect(result.netMinor).toBe('2000');
    expect(result.closingBalanceMinor).toBe('102000');
    expect(result.transactionCount).toBe(2);
    expect(result.lines.find((line) => line.direction === 'debit')?.amountMinor).toBe(3000n);
    expect(db.reportSnapshot.create.mock.calls[0][0].data.periodCloseLinks).toBeUndefined();
  });

  it('rejects reconciliation totals that do not match the authoritative statement and ledger', async () => {
    const db = makeLiveDb();

    await expect(generateLiveMonthlyReportSnapshot(db, {
      actor: adminActor,
      workspaceId: 'workspace-1',
      year: 2026,
      month: 8,
      reconciliation: { ...reconciliation, incomeMinor: 5001n },
    })).rejects.toThrow(/gereconcilieerde bankgegevens/);
    expect(db.reportSnapshot.create).not.toHaveBeenCalled();
  });

  it('rejects missing evidence and duplicate import fingerprints', async () => {
    await expect(generateLiveMonthlyReportSnapshot(makeLiveDb({ statement: null }), {
      actor: adminActor,
      workspaceId: 'workspace-1',
      year: 2026,
      month: 8,
      reconciliation,
    })).rejects.toThrow(/Geen bankafschrift/);

    const duplicateTransactions = [
      transactions[0],
      { ...transactions[1], importFingerprint: 'fp-income' },
    ];
    await expect(generateLiveMonthlyReportSnapshot(makeLiveDb({ transactions: duplicateTransactions }), {
      actor: adminActor,
      workspaceId: 'workspace-1',
      year: 2026,
      month: 8,
      reconciliation,
    })).rejects.toThrow(/dubbele importvingerafdrukken/);
  });
});

// ─── REPORT-003: Operating vs transfer presentation ───────────────────────────

describe('report presentation classes', () => {
  const baseOperating = {
    lineKind: ReportLineKind.CATEGORY,
    projectId: 'p1',
    transactionTypeId: 'tt1',
    categoryId: 'c1',
    literalProjectLabel: 'YA',
    literalTypeLabel: 'Schenking',
    literalCategoryLabel: 'Giften in',
    direction: 'credit' as const,
    amountMinor: 100000n,
    transactionCount: 2,
    sortOrder: 1,
  };

  it('classifies normal operating transactions as OPERATING', () => {
    expect(classifyReportLinePresentation('Schenking', 'Giften in')).toBe('OPERATING');
    expect(classifyReportLinePresentation('Algemeen', 'Administratiekosten')).toBe('OPERATING');
    expect(classifyReportLinePresentation('Ondersteuning', 'Ondersteuning behoeftigen')).toBe('OPERATING');
  });

  it('classifies Spaarrekening/kruispost as TRANSFER', () => {
    expect(classifyReportLinePresentation('Spaarrekening', 'Spaarrekening')).toBe('TRANSFER');
    expect(classifyReportLinePresentation('kruispost', 'overboeking')).toBe('TRANSFER');
    expect(classifyReportLinePresentation('Algemeen', 'Spaarrekening storting')).toBe('TRANSFER');
  });

  it('classifies borg/waarborgsom as DEPOSIT', () => {
    expect(classifyReportLinePresentation('Borg', 'waarborgsom betaling')).toBe('DEPOSIT');
    expect(classifyReportLinePresentation('Algemeen', 'storting depot')).toBe('DEPOSIT');
  });

  it('classifies teruggave/terugboeking as REFUND', () => {
    expect(classifyReportLinePresentation('Algemeen', 'teruggave btw')).toBe('REFUND');
    expect(classifyReportLinePresentation('Algemeen', 'terugboeking')).toBe('REFUND');
    expect(classifyReportLinePresentation('Algemeen', 'stornering')).toBe('REFUND');
  });

  it('operating subtotal excludes transfer/deposit/refund lines', () => {
    const lines = [
      { ...baseOperating, amountMinor: 100000n, transactionCount: 2 },
      {
        ...baseOperating,
        categoryId: 'c2',
        literalTypeLabel: 'Spaarrekening',
        literalCategoryLabel: 'Spaarrekening',
        amountMinor: 50000n,
        transactionCount: 1,
        sortOrder: 2,
      },
    ];
    const classified = classifyReportLines(lines);
    const totals = computePresentationTotals(classified);

    expect(totals.operating.incomeMinor).toBe('100000');
    expect(totals.grand.incomeMinor).toBe('150000');
    expect(totals.operating.transactionCount).toBe(2);
    expect(totals.grand.transactionCount).toBe(3);
  });

  it('grand total includes all money - no euro disappears from reports', () => {
    const lines = [
      { ...baseOperating, amountMinor: 100000n, transactionCount: 2 },
      {
        ...baseOperating,
        categoryId: 'c2',
        literalTypeLabel: 'Spaarrekening',
        literalCategoryLabel: 'Spaarrekening',
        amountMinor: 50000n,
        transactionCount: 1,
        sortOrder: 2,
      },
      {
        ...baseOperating,
        categoryId: 'c3',
        literalCategoryLabel: 'teruggave',
        amountMinor: 20000n,
        transactionCount: 1,
        sortOrder: 3,
      },
      {
        ...baseOperating,
        categoryId: 'c4',
        literalCategoryLabel: 'Administratiekosten',
        direction: 'debit' as const,
        amountMinor: 30000n,
        transactionCount: 1,
        sortOrder: 4,
      },
    ];

    const classified = classifyReportLines(lines);
    const totals = computePresentationTotals(classified);

    expect(totals.grand.incomeMinor).toBe('170000'); // 100000 + 50000 + 20000
    expect(totals.grand.expenseMinor).toBe('30000');
    expect(totals.grand.netMinor).toBe('140000');
  });

  it('transfer and refund lines remain drilldown-visible in classified lines', () => {
    const lines = [
      { ...baseOperating },
      {
        ...baseOperating,
        categoryId: 'c2',
        literalTypeLabel: 'Spaarrekening',
        literalCategoryLabel: 'Spaarrekening',
        amountMinor: 50000n,
        sortOrder: 2,
      },
    ];
    const classified = classifyReportLines(lines);

    const transferLine = classified.find((l) => l.presentation === 'TRANSFER');
    expect(transferLine).toBeDefined();
    expect(transferLine?.amountMinor).toBe(50000n);
    expect(transferLine?.literalCategoryLabel).toBe('Spaarrekening');
  });

  it('null labels default to OPERATING (safe fallback)', () => {
    expect(classifyReportLinePresentation(null, null)).toBe('OPERATING');
    expect(classifyReportLinePresentation(undefined, undefined)).toBe('OPERATING');
  });
});
