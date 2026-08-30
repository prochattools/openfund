import { describe, expect, it } from 'vitest';
import {
  APPROVED_ACCOUNTING_BASELINES,
  buildAccountingAudit,
  extendAccountingCoverageFromCompleteStatements,
  type AccountingAuditBuildInput,
  type AccountingAuditTransaction,
} from '../../server/services/accountingAuditService';

const bookedTransaction = (
  id: string,
  date: string,
  amountMinor: bigint,
  direction: 'credit' | 'debit',
): AccountingAuditTransaction => ({
  id,
  date: new Date(date),
  amountMinor,
  direction,
  importFingerprint: `fingerprint-${id}`,
  sourceFile: `source-${id}`,
  transactionBooking: {
    projectId: 'project-1',
    transactionTypeId: direction === 'credit' ? 'type-in' : 'type-out',
    categoryId: direction === 'credit' ? 'category-in' : 'category-out',
    literalProjectLabel: 'YA',
    literalTypeLabel: direction === 'credit' ? 'Inkomsten' : 'Uitgaven',
    literalCategoryLabel: direction === 'credit' ? 'Giften' : 'Kosten',
  },
});

const baseInput = (overrides: Partial<AccountingAuditBuildInput> = {}): AccountingAuditBuildInput => ({
  account: {
    id: 'account-1',
    identifier: 'NL89INGB0006369960',
    name: 'ING Betaalrekening Yeshua Academy',
    currency: 'EUR',
  },
  transactions: [
    bookedTransaction('income', '2024-01-10T00:00:00.000Z', 500n, 'credit'),
    bookedTransaction('expense', '2024-02-10T00:00:00.000Z', 200n, 'debit'),
  ],
  statementPeriods: [{
    workspaceId: 'workspace-1',
    accountId: 'account-1',
    periodStart: new Date('2024-01-01T00:00:00.000Z'),
    periodEnd: new Date('2024-02-29T23:59:59.999Z'),
    coverageStatus: 'COMPLETE',
    openingBalanceMinor: 1000n,
    closingBalanceMinor: 1300n,
    transactionCount: 2,
  }],
  openingBalance: {
    id: 'opening-1',
    effectiveDate: new Date('2024-01-01T00:00:00.000Z'),
    amountMinor: 1000n,
    lockedAt: null,
  },
  expectedCoverage: { 2024: [1, 2] },
  baselineControls: {
    2024: {
      transactionCount: 2,
      openingMinor: '1000',
      incomeMinor: '500',
      expenseMinor: '200',
      closingMinor: '1300',
    },
  },
  ...overrides,
});

describe('accounting audit service', () => {
  it('keeps the approved historical controls in integer minor units', () => {
    expect(APPROVED_ACCOUNTING_BASELINES).toEqual({
      2024: {
        transactionCount: 268,
        openingMinor: '172186',
        incomeMinor: '3226719',
        expenseMinor: '2180490',
        closingMinor: '1218415',
      },
      2025: {
        transactionCount: 413,
        openingMinor: '1218415',
        incomeMinor: '9164244',
        expenseMinor: '9347573',
        closingMinor: '1035086',
      },
      2026: {
        transactionCount: 253,
        openingMinor: '1035086',
        incomeMinor: '6812658',
        expenseMinor: '6773084',
        closingMinor: '1074660',
      },
    });
  });

  it('passes exact cash, classification, continuity, and close controls', () => {
    const result = buildAccountingAudit(baseInput());

    expect(result).toMatchObject({
      status: 'PASSED',
      cashStatus: 'PASSED',
      classificationStatus: 'PASSED',
      closeStatus: 'ELIGIBLE',
      readOnly: true,
      openingBalanceControl: {
        expectedMinor: '1000',
        actualMinor: '1000',
        differenceMinor: '0',
      },
      totals: {
        transactionCount: 2,
        unresolvedTransactionCount: 0,
        duplicateFingerprintCount: 0,
        runningBalanceErrorCount: 0,
        cashDifferenceMinor: '0',
        categoryIncomeDifferenceMinor: '0',
        categoryExpenseDifferenceMinor: '0',
      },
    });
    expect(result.months.map((month) => month.openingBalanceMinor)).toEqual(['1000', '1500']);
    expect(result.months.map((month) => month.closingBalanceMinor)).toEqual(['1500', '1300']);
    expect(result.sideEffects).toEqual({
      createsOpeningBalance: false,
      createsTransactionBooking: false,
      createsCategorizationSuggestion: false,
      closesPeriod: false,
      createsReportSnapshot: false,
    });
  });

  it('detects the exact missing opening balance without repairing it', () => {
    const result = buildAccountingAudit(baseInput({ openingBalance: null }));

    expect(result.cashStatus).toBe('FAILED');
    expect(result.closeStatus).toBe('BLOCKED');
    expect(result.openingBalanceControl).toMatchObject({
      expectedMinor: '1000',
      actualMinor: '0',
      differenceMinor: '-1000',
      recordId: null,
    });
    expect(result.readOnly).toBe(true);
    expect(result.sideEffects.createsOpeningBalance).toBe(false);
  });

  it('fails cash status when opposite monthly differences cancel in the aggregate', () => {
    const result = buildAccountingAudit(baseInput({
      transactions: [],
      statementPeriods: [
        {
          workspaceId: 'workspace-1',
          accountId: 'account-1',
          periodStart: new Date('2024-01-01T00:00:00.000Z'),
          periodEnd: new Date('2024-01-31T23:59:59.999Z'),
          coverageStatus: 'COMPLETE',
          openingBalanceMinor: 1000n,
          closingBalanceMinor: 1100n,
          transactionCount: 0,
        },
        {
          workspaceId: 'workspace-1',
          accountId: 'account-1',
          periodStart: new Date('2025-01-01T00:00:00.000Z'),
          periodEnd: new Date('2025-01-31T23:59:59.999Z'),
          coverageStatus: 'COMPLETE',
          openingBalanceMinor: 1100n,
          closingBalanceMinor: 1000n,
          transactionCount: 0,
        },
      ],
      expectedCoverage: { 2024: [1], 2025: [1] },
      baselineControls: {
        2024: {
          transactionCount: 0,
          openingMinor: '1000',
          incomeMinor: '0',
          expenseMinor: '0',
          closingMinor: '1100',
        },
        2025: {
          transactionCount: 0,
          openingMinor: '1100',
          incomeMinor: '0',
          expenseMinor: '0',
          closingMinor: '1000',
        },
      },
    }));

    expect(result.totals.cashDifferenceMinor).toBe('0');
    expect(result.months.map((month) => month.balanceDifferenceMinor)).toEqual(['-100', '100']);
    expect(result.cashStatus).toBe('FAILED');
    expect(result.status).toBe('FAILED');
    expect(result.closeStatus).toBe('BLOCKED');
  });

  it('separates exact cash movement from pending classification in an open period', () => {
    const unresolved: AccountingAuditTransaction = {
      ...bookedTransaction('unresolved', '2026-01-10T00:00:00.000Z', 500n, 'credit'),
      transactionBooking: null,
    };
    const result = buildAccountingAudit(baseInput({
      transactions: [unresolved],
      statementPeriods: [{
        workspaceId: 'workspace-1',
        accountId: 'account-1',
        periodStart: new Date('2026-01-01T00:00:00.000Z'),
        periodEnd: new Date('2026-01-31T23:59:59.999Z'),
        coverageStatus: 'PARTIAL',
        openingBalanceMinor: 1000n,
        closingBalanceMinor: 1500n,
        transactionCount: 1,
      }],
      openingBalance: {
        id: 'opening-1',
        effectiveDate: new Date('2026-01-01T00:00:00.000Z'),
        amountMinor: 1000n,
        lockedAt: null,
      },
      expectedCoverage: { 2026: [1] },
      baselineControls: {
        2026: {
          transactionCount: 1,
          openingMinor: '1000',
          incomeMinor: '500',
          expenseMinor: '0',
          closingMinor: '1500',
        },
      },
    }));

    expect(result.cashStatus).toBe('PASSED');
    expect(result.classificationStatus).toBe('PENDING');
    expect(result.closeStatus).toBe('BLOCKED');
    expect(result.totals).toMatchObject({
      unresolvedTransactionCount: 1,
      cashDifferenceMinor: '0',
      categoryIncomeDifferenceMinor: '500',
    });
  });

  it('COMPLETE monthly evidence overrides overlapping PARTIAL cumulative evidence for that month', () => {
    const result = buildAccountingAudit(baseInput({
      transactions: [
        bookedTransaction('jul-income', '2026-07-10T00:00:00.000Z', 1000n, 'credit'),
        bookedTransaction('jul-expense', '2026-07-20T00:00:00.000Z', 400n, 'debit'),
      ],
      statementPeriods: [
        {
          workspaceId: 'workspace-1',
          accountId: 'account-1',
          periodStart: new Date('2026-01-01T00:00:00.000Z'),
          periodEnd: new Date('2026-07-31T23:59:59.999Z'),
          coverageStatus: 'PARTIAL',
          openingBalanceMinor: 5000n,
          closingBalanceMinor: 5600n,
          transactionCount: 2,
        },
        {
          workspaceId: 'workspace-1',
          accountId: 'account-1',
          periodStart: new Date('2026-07-01T00:00:00.000Z'),
          periodEnd: new Date('2026-07-31T23:59:59.999Z'),
          coverageStatus: 'COMPLETE',
          openingBalanceMinor: 5000n,
          closingBalanceMinor: 5600n,
          transactionCount: 2,
          sourceFileHash: 'hash-2026-july',
        },
      ],
      openingBalance: {
        id: 'opening-1',
        effectiveDate: new Date('2026-01-01T00:00:00.000Z'),
        amountMinor: 5000n,
        lockedAt: null,
      },
      expectedCoverage: { 2026: [7] },
      baselineControls: {
        2026: {
          transactionCount: 2,
          openingMinor: '5000',
          incomeMinor: '1000',
          expenseMinor: '400',
          closingMinor: '5600',
        },
      },
    }));

    expect(result.status).toBe('PASSED');
    expect(result.cashStatus).toBe('PASSED');
    expect(result.months[0].coverageStatus).toBe('COMPLETE');
    expect(result.months[0].closeEligible).toBe(true);
  });

  it('treats negative-stored debit amounts correctly via abs normalization in monthly totals', () => {
    const result = buildAccountingAudit(baseInput({
      transactions: [
        bookedTransaction('income-1', '2024-01-15T00:00:00.000Z', 2000n, 'credit'),
        bookedTransaction('expense-neg', '2024-01-20T00:00:00.000Z', -800n, 'debit'),
      ],
      statementPeriods: [{
        workspaceId: 'workspace-1',
        accountId: 'account-1',
        periodStart: new Date('2024-01-01T00:00:00.000Z'),
        periodEnd: new Date('2024-01-31T23:59:59.999Z'),
        coverageStatus: 'COMPLETE',
        openingBalanceMinor: 1000n,
        closingBalanceMinor: 2200n,
        transactionCount: 2,
      }],
      openingBalance: {
        id: 'opening-1',
        effectiveDate: new Date('2024-01-01T00:00:00.000Z'),
        amountMinor: 1000n,
        lockedAt: null,
      },
      expectedCoverage: { 2024: [1] },
      baselineControls: {
        2024: {
          transactionCount: 2,
          openingMinor: '1000',
          incomeMinor: '2000',
          expenseMinor: '800',
          closingMinor: '2200',
        },
      },
    }));

    expect(result.status).toBe('PASSED');
    expect(result.cashStatus).toBe('PASSED');
    expect(result.totals.cashDifferenceMinor).toBe('0');
    expect(result.months[0].incomeMinor).toBe('2000');
    expect(result.months[0].expenseMinor).toBe('800');
  });

  it('extends July-approved scope to August only from complete exact-month statement evidence', () => {
    const july: AccountingAuditBuildInput['statementPeriods'][number] = {
      workspaceId: 'workspace-1',
      accountId: 'account-1',
      periodStart: new Date('2026-07-01T00:00:00.000Z'),
      periodEnd: new Date('2026-07-31T23:59:59.999Z'),
      coverageStatus: 'COMPLETE',
      openingBalanceMinor: 5000n,
      closingBalanceMinor: 6000n,
      transactionCount: 1,
      sourceFileHash: 'hash-2026-july',
    };
    const august: AccountingAuditBuildInput['statementPeriods'][number] = {
      ...july,
      periodStart: new Date('2026-08-01T00:00:00.000Z'),
      periodEnd: new Date('2026-08-31T23:59:59.999Z'),
      openingBalanceMinor: 6000n,
      closingBalanceMinor: 5800n,
      transactionCount: 1,
      sourceFileHash: 'hash-2026-august',
    };

    expect(extendAccountingCoverageFromCompleteStatements(
      [{ ...august, coverageStatus: 'PARTIAL' }, august],
      { 2026: [1, 2, 3, 4, 5, 6, 7] },
    )).toEqual({ 2026: [1, 2, 3, 4, 5, 6, 7, 8] });
    expect(extendAccountingCoverageFromCompleteStatements(
      [{ ...august, sourceFileHash: null }],
      { 2026: [1, 2, 3, 4, 5, 6, 7] },
    )).toEqual({ 2026: [1, 2, 3, 4, 5, 6, 7] });

    const result = buildAccountingAudit(baseInput({
      transactions: [
        bookedTransaction('july-income', '2026-07-10T00:00:00.000Z', 1000n, 'credit'),
        bookedTransaction('august-expense', '2026-08-10T00:00:00.000Z', 200n, 'debit'),
      ],
      statementPeriods: [july, august],
      openingBalance: {
        id: 'opening-1',
        effectiveDate: new Date('2026-07-01T00:00:00.000Z'),
        amountMinor: 5000n,
        lockedAt: new Date('2026-08-01T00:00:00.000Z'),
      },
      expectedCoverage: { 2026: [7, 8] },
      baselineCoverage: { 2026: [7] },
      baselineControls: {
        2026: {
          transactionCount: 1,
          openingMinor: '5000',
          incomeMinor: '1000',
          expenseMinor: '0',
          closingMinor: '6000',
        },
      },
    }));

    expect(result.status).toBe('PASSED');
    expect(result.closeStatus).toBe('ELIGIBLE');
    expect(result.months.map((month) => month.month)).toEqual([7, 8]);
    expect(result.months.map((month) => month.transactionCountDifference)).toEqual([0, 0]);
    expect(result.months.map((month) => month.openingBalanceMinor)).toEqual(['5000', '6000']);
    expect(result.months.map((month) => month.closingBalanceMinor)).toEqual(['6000', '5800']);
    expect(result.months[1].sourceFileHashes).toContain('hash-2026-august');
  });

  it('blocks an August audit when statement transaction count does not match the ledger', () => {
    const result = buildAccountingAudit(baseInput({
      transactions: [bookedTransaction('august-income', '2026-08-10T00:00:00.000Z', 1000n, 'credit')],
      statementPeriods: [{
        workspaceId: 'workspace-1',
        accountId: 'account-1',
        periodStart: new Date('2026-08-01T00:00:00.000Z'),
        periodEnd: new Date('2026-08-31T23:59:59.999Z'),
        coverageStatus: 'COMPLETE',
        openingBalanceMinor: 5000n,
        closingBalanceMinor: 6000n,
        transactionCount: 2,
        sourceFileHash: 'hash-2026-august',
      }],
      openingBalance: {
        id: 'opening-1',
        effectiveDate: new Date('2026-08-01T00:00:00.000Z'),
        amountMinor: 5000n,
        lockedAt: null,
      },
      expectedCoverage: { 2026: [8] },
      baselineCoverage: { 2026: [] },
      baselineControls: {},
    }));

    expect(result.status).toBe('FAILED');
    expect(result.cashStatus).toBe('FAILED');
    expect(result.months[0]).toMatchObject({
      statementTransactionCount: 2,
      transactionCountDifference: -1,
      closeEligible: false,
    });
    expect(result.issues.some((issue) => issue.message.includes('Transactieaantal'))).toBe(true);
  });

  it('does not treat an August database ledger as audited without exact statement evidence', () => {
    const result = buildAccountingAudit(baseInput({
      transactions: [bookedTransaction('august-income', '2026-08-10T00:00:00.000Z', 1000n, 'credit')],
      statementPeriods: [],
      expectedCoverage: { 2026: [8] },
      baselineCoverage: { 2026: [] },
      baselineControls: {},
      openingBalance: {
        id: 'opening-1',
        effectiveDate: new Date('2026-08-01T00:00:00.000Z'),
        amountMinor: 0n,
        lockedAt: null,
      },
    }));

    expect(result.months[0].coverageStatus).toBe('PARTIAL');
    expect(result.status).toBe('FAILED');
    expect(result.cashStatus).toBe('FAILED');
    expect(result.closeStatus).toBe('BLOCKED');
    expect(result.totals.outOfScopeTransactionCount).toBe(0);
  });

  it('fails closed when August transactions fall outside the approved January-July scope', () => {
    const result = buildAccountingAudit(baseInput({
      transactions: [bookedTransaction('august-income', '2026-08-10T00:00:00.000Z', 1000n, 'credit')],
      statementPeriods: [],
      expectedCoverage: { 2026: [1, 2, 3, 4, 5, 6, 7] },
      baselineCoverage: { 2026: [1, 2, 3, 4, 5, 6, 7] },
      baselineControls: {},
    }));

    expect(result.totals.outOfScopeTransactionCount).toBe(1);
    expect(result.status).toBe('FAILED');
    expect(result.cashStatus).toBe('FAILED');
    expect(result.issues.some((issue) => issue.message.includes('onafhankelijke bron-evidence'))).toBe(true);
  });
});
