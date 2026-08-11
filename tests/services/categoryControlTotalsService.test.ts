import { describe, expect, it } from 'vitest';
import { StatementCoverageStatus } from '@prisma/client';
import {
  buildCategoryControlTotals,
  buildCloseControlPreview,
  toCombinedReconciliationEvidence,
  type CategoryControlTransactionInput,
  type CategoryControlTotalsInput,
} from '../../server/services/categoryControlTotalsService';
import {
  buildStatementReconciliationPreview,
  type BookedTransactionSummary,
  type StatementReconciliationInput,
} from '../../server/services/statementReconciliationControlService';
import { assertCanClose } from '../../server/services/periodCloseService';

const makeCategoryTransaction = (
  overrides: Partial<CategoryControlTransactionInput> = {},
): CategoryControlTransactionInput => ({
  transactionId: `tx-${Math.random().toString(36).slice(2, 8)}`,
  amountMinor: 5000n,
  direction: 'credit',
  hasCompleteBooking: true,
  isUnresolved: false,
  projectId: 'p1',
  transactionTypeId: 't1',
  categoryId: 'c1',
  literalProjectLabel: 'Klant A',
  literalTypeLabel: 'Inkomsten',
  literalCategoryLabel: 'Donaties',
  ...overrides,
});

const balancedCategoryInput: CategoryControlTotalsInput = {
  workspaceId: 'workspace-1',
  accountId: 'account-1',
  accountIdentifier: 'NL89INGB0006369960',
  periodStart: new Date('2026-01-01T00:00:00Z'),
  periodEnd: new Date('2026-01-31T23:59:59Z'),
  statementIncomeMinor: 8000n,
  statementExpenseMinor: 3000n,
  statementTransactionCount: 3,
  transactions: [
    makeCategoryTransaction({ amountMinor: 5000n, direction: 'credit', projectId: 'p1', literalProjectLabel: 'Klant A' }),
    makeCategoryTransaction({ amountMinor: 3000n, direction: 'credit', projectId: 'p2', literalProjectLabel: 'Klant B' }),
    makeCategoryTransaction({ amountMinor: 3000n, direction: 'debit', projectId: 'p1', literalProjectLabel: 'Klant A', literalTypeLabel: 'Uitgaven', literalCategoryLabel: 'Huur' }),
  ],
};

describe('category control totals service', () => {
  it('returns BALANCED when category income and expense exactly match statement totals', () => {
    const result = buildCategoryControlTotals(balancedCategoryInput);

    expect(result.status).toBe('BALANCED');
    expect(result.source.incomeMinor).toBe('8000');
    expect(result.source.expenseMinor).toBe('3000');
    expect(result.source.transactionCount).toBe(3);
    expect(result.category.incomeMinor).toBe('8000');
    expect(result.category.expenseMinor).toBe('3000');
    expect(result.category.transactionCount).toBe(3);
    expect(result.differences.categoryIncomeDifferenceMinor).toBe('0');
    expect(result.differences.categoryExpenseDifferenceMinor).toBe('0');
    expect(result.differences.transactionCountDifference).toBe(0);
    expect(result.closeEligibility.categoryControlsEligible).toBe(true);
    expect(result.closeEligibility.reasons).toEqual([]);
  });

  it('returns INCOMPLETE when a transaction has no booking', () => {
    const result = buildCategoryControlTotals({
      ...balancedCategoryInput,
      transactions: [
        makeCategoryTransaction({ amountMinor: 5000n, direction: 'credit' }),
        makeCategoryTransaction({ amountMinor: 3000n, direction: 'credit', hasCompleteBooking: false, projectId: null, transactionTypeId: null, categoryId: null }),
        makeCategoryTransaction({ amountMinor: 3000n, direction: 'debit' }),
      ],
    });

    expect(result.status).toBe('INCOMPLETE');
    expect(result.missingDimensions.missingBookingCount).toBe(1);
    expect(result.closeEligibility.categoryControlsEligible).toBe(false);
    expect(result.closeEligibility.reasons).toContain(
      'Niet alle transacties hebben een volledige boeking met Klant, Type en Categorie.',
    );
  });

  it('returns INCOMPLETE when a transaction is missing a project (Klant)', () => {
    const result = buildCategoryControlTotals({
      ...balancedCategoryInput,
      transactions: [
        makeCategoryTransaction({ amountMinor: 5000n, direction: 'credit' }),
        makeCategoryTransaction({ amountMinor: 3000n, direction: 'credit', hasCompleteBooking: false, projectId: null }),
        makeCategoryTransaction({ amountMinor: 3000n, direction: 'debit' }),
      ],
    });

    expect(result.status).toBe('INCOMPLETE');
    expect(result.missingDimensions.missingProjectCount).toBe(1);
    expect(result.closeEligibility.reasons).toContain('1 transactie(s) missen een Klant.');
  });

  it('returns INCOMPLETE when a transaction is missing a transaction type (Type)', () => {
    const result = buildCategoryControlTotals({
      ...balancedCategoryInput,
      transactions: [
        makeCategoryTransaction({ amountMinor: 5000n, direction: 'credit' }),
        makeCategoryTransaction({ amountMinor: 3000n, direction: 'credit', hasCompleteBooking: false, transactionTypeId: null }),
        makeCategoryTransaction({ amountMinor: 3000n, direction: 'debit' }),
      ],
    });

    expect(result.status).toBe('INCOMPLETE');
    expect(result.missingDimensions.missingTransactionTypeCount).toBe(1);
    expect(result.closeEligibility.reasons).toContain('1 transactie(s) missen een Type.');
  });

  it('returns INCOMPLETE when a transaction is missing a category (Categorie)', () => {
    const result = buildCategoryControlTotals({
      ...balancedCategoryInput,
      transactions: [
        makeCategoryTransaction({ amountMinor: 5000n, direction: 'credit' }),
        makeCategoryTransaction({ amountMinor: 3000n, direction: 'credit', hasCompleteBooking: false, categoryId: null }),
        makeCategoryTransaction({ amountMinor: 3000n, direction: 'debit' }),
      ],
    });

    expect(result.status).toBe('INCOMPLETE');
    expect(result.missingDimensions.missingCategoryCount).toBe(1);
    expect(result.closeEligibility.reasons).toContain('1 transactie(s) missen een Categorie.');
  });

  it('returns UNBALANCED when category income does not match statement income', () => {
    const result = buildCategoryControlTotals({
      ...balancedCategoryInput,
      transactions: [
        makeCategoryTransaction({ amountMinor: 4000n, direction: 'credit' }),
        makeCategoryTransaction({ amountMinor: 3000n, direction: 'credit' }),
        makeCategoryTransaction({ amountMinor: 3000n, direction: 'debit' }),
      ],
    });

    expect(result.status).toBe('UNBALANCED');
    expect(result.differences.categoryIncomeDifferenceMinor).toBe('-1000');
    expect(result.closeEligibility.categoryControlsEligible).toBe(false);
    expect(result.closeEligibility.reasons).toContain(
      'Het categorieïnkomstenverschil is -1000 cent en moet nul zijn.',
    );
  });

  it('returns UNBALANCED when category expenses do not match statement expenses', () => {
    const result = buildCategoryControlTotals({
      ...balancedCategoryInput,
      transactions: [
        makeCategoryTransaction({ amountMinor: 8000n, direction: 'credit' }),
        makeCategoryTransaction({ amountMinor: 5000n, direction: 'debit' }),
        makeCategoryTransaction({ amountMinor: 3000n, direction: 'debit' }),
      ],
    });

    expect(result.status).toBe('UNBALANCED');
    expect(result.differences.categoryExpenseDifferenceMinor).toBe('5000');
    expect(result.closeEligibility.categoryControlsEligible).toBe(false);
    expect(result.closeEligibility.reasons).toContain(
      'Het categorieuitgavenverschil is 5000 cent en moet nul zijn.',
    );
  });

  it('returns UNBALANCED when transaction count does not match statement count', () => {
    const result = buildCategoryControlTotals({
      ...balancedCategoryInput,
      statementTransactionCount: 5,
    });

    expect(result.status).toBe('UNBALANCED');
    expect(result.differences.transactionCountDifference).toBe(-2);
    expect(result.closeEligibility.categoryControlsEligible).toBe(false);
    expect(result.closeEligibility.reasons).toContain(
      'Het geboekte aantal verschilt met -2 van het afschriftaantal.',
    );
  });

  it('preserves literal Klant, Type, and Category labels from TransactionBooking', () => {
    const result = buildCategoryControlTotals({
      ...balancedCategoryInput,
      statementIncomeMinor: 5000n,
      statementExpenseMinor: 0n,
      statementTransactionCount: 1,
      transactions: [
        makeCategoryTransaction({
          amountMinor: 5000n,
          direction: 'credit',
          literalProjectLabel: 'Stichting Yeshua',
          literalTypeLabel: 'Giften',
          literalCategoryLabel: 'Donaties algemeen',
        }),
      ],
    });

    expect(result.lines[0].literalProjectLabel).toBe('Stichting Yeshua');
    expect(result.lines[0].literalTypeLabel).toBe('Giften');
    expect(result.lines[0].literalCategoryLabel).toBe('Donaties algemeen');
  });

  it('returns lines sorted deterministically by project, type, category, direction', () => {
    const result = buildCategoryControlTotals({
      ...balancedCategoryInput,
      statementIncomeMinor: 6000n,
      statementExpenseMinor: 5000n,
      statementTransactionCount: 4,
      transactions: [
        makeCategoryTransaction({ amountMinor: 3000n, direction: 'credit', projectId: 'p2', transactionTypeId: 't1', categoryId: 'c1', literalProjectLabel: 'Klant B', literalTypeLabel: 'Inkomsten', literalCategoryLabel: 'Donaties' }),
        makeCategoryTransaction({ amountMinor: 3000n, direction: 'credit', projectId: 'p1', transactionTypeId: 't1', categoryId: 'c1', literalProjectLabel: 'Klant A', literalTypeLabel: 'Inkomsten', literalCategoryLabel: 'Donaties' }),
        makeCategoryTransaction({ amountMinor: 2000n, direction: 'debit', projectId: 'p1', transactionTypeId: 't2', categoryId: 'c2', literalProjectLabel: 'Klant A', literalTypeLabel: 'Uitgaven', literalCategoryLabel: 'Huur' }),
        makeCategoryTransaction({ amountMinor: 3000n, direction: 'debit', projectId: 'p1', transactionTypeId: 't2', categoryId: 'c3', literalProjectLabel: 'Klant A', literalTypeLabel: 'Uitgaven', literalCategoryLabel: 'Materiaal' }),
      ],
    });

    expect(result.lines.length).toBe(4);
    expect(result.lines[0].literalProjectLabel).toBe('Klant A');
    expect(result.lines[0].literalCategoryLabel).toBe('Donaties');
    expect(result.lines[1].literalProjectLabel).toBe('Klant A');
    expect(result.lines[1].literalCategoryLabel).toBe('Huur');
    expect(result.lines[2].literalProjectLabel).toBe('Klant A');
    expect(result.lines[2].literalCategoryLabel).toBe('Materiaal');
    expect(result.lines[3].literalProjectLabel).toBe('Klant B');
  });

  it('returns exact minor-unit strings for all financial values', () => {
    const result = buildCategoryControlTotals(balancedCategoryInput);

    expect(typeof result.source.incomeMinor).toBe('string');
    expect(typeof result.source.expenseMinor).toBe('string');
    expect(typeof result.category.incomeMinor).toBe('string');
    expect(typeof result.category.expenseMinor).toBe('string');
    expect(typeof result.differences.categoryIncomeDifferenceMinor).toBe('string');
    expect(typeof result.differences.categoryExpenseDifferenceMinor).toBe('string');
    for (const line of result.lines) {
      expect(typeof line.incomeMinor).toBe('string');
      expect(typeof line.expenseMinor).toBe('string');
    }
  });

  it('creates no PeriodClose, ReportSnapshot, booking, or audit mutation', () => {
    const result = buildCategoryControlTotals(balancedCategoryInput);

    expect(result.sideEffects).toEqual({
      createsPeriodClose: false,
      createsReportSnapshot: false,
      closesPeriod: false,
    });
  });

  it('returns correct validator version', () => {
    const result = buildCategoryControlTotals(balancedCategoryInput);
    expect(result.validatorVersion).toBe('close-002-v1');
  });

  it('returns INCOMPLETE when unresolved review transactions exist', () => {
    const result = buildCategoryControlTotals({
      ...balancedCategoryInput,
      transactions: [
        makeCategoryTransaction({ amountMinor: 5000n, direction: 'credit' }),
        makeCategoryTransaction({ amountMinor: 3000n, direction: 'credit', isUnresolved: true, hasCompleteBooking: false, projectId: null, transactionTypeId: null, categoryId: null }),
        makeCategoryTransaction({ amountMinor: 3000n, direction: 'debit' }),
      ],
    });

    expect(result.status).toBe('INCOMPLETE');
    expect(result.missingDimensions.unresolvedTransactionCount).toBe(1);
    expect(result.closeEligibility.categoryControlsEligible).toBe(false);
    expect(result.closeEligibility.reasons).toContain(
      'Er zijn 1 onopgeloste transacties die eerst beoordeeld moeten worden.',
    );
  });

  it('normalizes negative-stored debit amounts to abs before computing directional totals (signed-debit regression)', () => {
    const result = buildCategoryControlTotals({
      ...balancedCategoryInput,
      statementIncomeMinor: 5000n,
      statementExpenseMinor: 3000n,
      statementTransactionCount: 2,
      transactions: [
        makeCategoryTransaction({ amountMinor: 5000n, direction: 'credit' }),
        makeCategoryTransaction({ amountMinor: -3000n, direction: 'debit', literalTypeLabel: 'Uitgaven', literalCategoryLabel: 'Huur' }),
      ],
    });

    expect(result.status).toBe('BALANCED');
    expect(result.category.incomeMinor).toBe('5000');
    expect(result.category.expenseMinor).toBe('3000');
    expect(result.differences.categoryIncomeDifferenceMinor).toBe('0');
    expect(result.differences.categoryExpenseDifferenceMinor).toBe('0');
  });

  it('groups transactions by exact dimension triple and direction', () => {
    const result = buildCategoryControlTotals({
      ...balancedCategoryInput,
      statementIncomeMinor: 10000n,
      statementExpenseMinor: 0n,
      statementTransactionCount: 3,
      transactions: [
        makeCategoryTransaction({ amountMinor: 3000n, direction: 'credit', projectId: 'p1', transactionTypeId: 't1', categoryId: 'c1', literalProjectLabel: 'Klant A', literalTypeLabel: 'Inkomsten', literalCategoryLabel: 'Donaties' }),
        makeCategoryTransaction({ amountMinor: 4000n, direction: 'credit', projectId: 'p1', transactionTypeId: 't1', categoryId: 'c1', literalProjectLabel: 'Klant A', literalTypeLabel: 'Inkomsten', literalCategoryLabel: 'Donaties' }),
        makeCategoryTransaction({ amountMinor: 3000n, direction: 'credit', projectId: 'p2', transactionTypeId: 't1', categoryId: 'c1', literalProjectLabel: 'Klant B', literalTypeLabel: 'Inkomsten', literalCategoryLabel: 'Donaties' }),
      ],
    });

    expect(result.lines.length).toBe(2);
    const klantA = result.lines.find((l) => l.literalProjectLabel === 'Klant A');
    expect(klantA!.incomeMinor).toBe('7000');
    expect(klantA!.transactionCount).toBe(2);
    const klantB = result.lines.find((l) => l.literalProjectLabel === 'Klant B');
    expect(klantB!.incomeMinor).toBe('3000');
    expect(klantB!.transactionCount).toBe(1);
  });
});

describe('combined close control preview', () => {
  const makeBalancedStatementInput: StatementReconciliationInput = {
    workspaceId: 'workspace-1',
    accountId: 'account-1',
    accountIdentifier: 'NL89INGB0006369960',
    statementPeriodId: 'period-1',
    periodStart: new Date('2026-01-01T00:00:00Z'),
    periodEnd: new Date('2026-01-31T23:59:59Z'),
    coverageStatus: StatementCoverageStatus.COMPLETE,
    statementTotals: {
      openingBalanceMinor: 100000n,
      incomeMinor: 8000n,
      expenseMinor: 3000n,
      closingBalanceMinor: 105000n,
      transactionCount: 3,
    },
    bookedTransactions: [
      { transactionId: 'tx-1', amountMinor: 5000n, direction: 'credit' as const, hasCompleteBooking: true, isUnresolved: false },
      { transactionId: 'tx-2', amountMinor: 3000n, direction: 'credit' as const, hasCompleteBooking: true, isUnresolved: false },
      { transactionId: 'tx-3', amountMinor: 3000n, direction: 'debit' as const, hasCompleteBooking: true, isUnresolved: false },
    ],
  };

  it('returns BALANCED combined status when both controls are balanced', () => {
    const statementPreview = buildStatementReconciliationPreview(makeBalancedStatementInput);
    const categoryResult = buildCategoryControlTotals(balancedCategoryInput);
    const combined = buildCloseControlPreview(statementPreview, categoryResult);

    expect(combined.combinedStatus).toBe('BALANCED');
    expect(combined.combinedCloseEligible).toBe(true);
    expect(combined.combinedReasons).toEqual([]);
  });

  it('returns INCOMPLETE combined status when statement is incomplete', () => {
    const statementPreview = buildStatementReconciliationPreview({
      ...makeBalancedStatementInput,
      bookedTransactions: [
        { transactionId: 'tx-1', amountMinor: 5000n, direction: 'credit' as const, hasCompleteBooking: true, isUnresolved: false },
        { transactionId: 'tx-2', amountMinor: 3000n, direction: 'credit' as const, hasCompleteBooking: false, isUnresolved: true },
        { transactionId: 'tx-3', amountMinor: 3000n, direction: 'debit' as const, hasCompleteBooking: true, isUnresolved: false },
      ],
    });
    const categoryResult = buildCategoryControlTotals(balancedCategoryInput);
    const combined = buildCloseControlPreview(statementPreview, categoryResult);

    expect(combined.combinedStatus).toBe('INCOMPLETE');
    expect(combined.combinedCloseEligible).toBe(false);
  });

  it('returns INCOMPLETE combined status when category controls have missing bookings', () => {
    const statementPreview = buildStatementReconciliationPreview(makeBalancedStatementInput);
    const categoryResult = buildCategoryControlTotals({
      ...balancedCategoryInput,
      transactions: [
        makeCategoryTransaction({ amountMinor: 5000n, direction: 'credit' }),
        makeCategoryTransaction({ amountMinor: 3000n, direction: 'credit', hasCompleteBooking: false, projectId: null, transactionTypeId: null, categoryId: null }),
        makeCategoryTransaction({ amountMinor: 3000n, direction: 'debit' }),
      ],
    });
    const combined = buildCloseControlPreview(statementPreview, categoryResult);

    expect(combined.combinedStatus).toBe('INCOMPLETE');
    expect(combined.combinedCloseEligible).toBe(false);
  });

  it('returns UNBALANCED combined status when category income differs', () => {
    const statementPreview = buildStatementReconciliationPreview(makeBalancedStatementInput);
    const categoryResult = buildCategoryControlTotals({
      ...balancedCategoryInput,
      transactions: [
        makeCategoryTransaction({ amountMinor: 4000n, direction: 'credit' }),
        makeCategoryTransaction({ amountMinor: 3000n, direction: 'credit' }),
        makeCategoryTransaction({ amountMinor: 3000n, direction: 'debit' }),
      ],
    });
    const combined = buildCloseControlPreview(statementPreview, categoryResult);

    expect(combined.combinedStatus).toBe('UNBALANCED');
    expect(combined.combinedCloseEligible).toBe(false);
  });

  it('returns not close-eligible for partial/open statements', () => {
    const statementPreview = buildStatementReconciliationPreview({
      ...makeBalancedStatementInput,
      coverageStatus: StatementCoverageStatus.PARTIAL,
    });
    const categoryResult = buildCategoryControlTotals(balancedCategoryInput);
    const combined = buildCloseControlPreview(statementPreview, categoryResult);

    expect(combined.combinedCloseEligible).toBe(false);
    expect(combined.combinedReasons).toContain(
      'Gedeeltelijke of open afschriften kunnen niet worden gesloten.',
    );
  });

  it('toCombinedReconciliationEvidence produces evidence accepted by assertCanClose for balanced complete combined preview', () => {
    const statementPreview = buildStatementReconciliationPreview(makeBalancedStatementInput);
    const categoryResult = buildCategoryControlTotals(balancedCategoryInput);
    const combined = buildCloseControlPreview(statementPreview, categoryResult);
    const evidence = toCombinedReconciliationEvidence(combined);

    expect(evidence).not.toBeNull();
    expect(evidence!.status).toBe('BALANCED');
    expect(evidence!.coverageStatus).toBe('COMPLETE');
    expect(evidence!.balanceDifferenceMinor).toBe(0n);
    expect(evidence!.categoryIncomeDifferenceMinor).toBe(0n);
    expect(evidence!.categoryExpenseDifferenceMinor).toBe(0n);
    expect(evidence!.runningBalanceErrorCount).toBe(0);
    expect(evidence!.transactionCount).toBe(3);
    expect(evidence!.bookedTransactionCount).toBe(3);
    expect(evidence!.unresolvedTransactionCount).toBe(0);
    expect(evidence!.validatorVersion).toBe('close-001-v1+close-002-v1');

    expect(() => assertCanClose(evidence!)).not.toThrow();
  });

  it('toCombinedReconciliationEvidence returns null when category differences are non-zero', () => {
    const statementPreview = buildStatementReconciliationPreview(makeBalancedStatementInput);
    const categoryResult = buildCategoryControlTotals({
      ...balancedCategoryInput,
      transactions: [
        makeCategoryTransaction({ amountMinor: 4000n, direction: 'credit' }),
        makeCategoryTransaction({ amountMinor: 3000n, direction: 'credit' }),
        makeCategoryTransaction({ amountMinor: 3000n, direction: 'debit' }),
      ],
    });
    const combined = buildCloseControlPreview(statementPreview, categoryResult);
    const evidence = toCombinedReconciliationEvidence(combined);

    expect(evidence).toBeNull();
  });

  it('toCombinedReconciliationEvidence returns null when statement is unbalanced', () => {
    const statementPreview = buildStatementReconciliationPreview({
      ...makeBalancedStatementInput,
      bookedTransactions: [
        { transactionId: 'tx-1', amountMinor: 9000n, direction: 'credit' as const, hasCompleteBooking: true, isUnresolved: false },
        { transactionId: 'tx-2', amountMinor: 3000n, direction: 'credit' as const, hasCompleteBooking: true, isUnresolved: false },
        { transactionId: 'tx-3', amountMinor: 3000n, direction: 'debit' as const, hasCompleteBooking: true, isUnresolved: false },
      ],
    });
    const categoryResult = buildCategoryControlTotals(balancedCategoryInput);
    const combined = buildCloseControlPreview(statementPreview, categoryResult);
    const evidence = toCombinedReconciliationEvidence(combined);

    expect(evidence).toBeNull();
  });

  it('toCombinedReconciliationEvidence returns null for partial coverage even if totals match', () => {
    const statementPreview = buildStatementReconciliationPreview({
      ...makeBalancedStatementInput,
      coverageStatus: StatementCoverageStatus.PARTIAL,
    });
    const categoryResult = buildCategoryControlTotals(balancedCategoryInput);
    const combined = buildCloseControlPreview(statementPreview, categoryResult);
    const evidence = toCombinedReconciliationEvidence(combined);

    expect(evidence).toBeNull();
  });
});
