import { describe, expect, it } from 'vitest';
import { StatementCoverageStatus } from '@prisma/client';
import {
  buildStatementReconciliationPreview,
  StatementReconciliationControlError,
  toBalancedReconciliationEvidence,
  type BookedTransactionSummary,
  type StatementReconciliationInput,
} from '../../server/services/statementReconciliationControlService';
import { assertCanClose } from '../../server/services/periodCloseService';

const makeBookedTransaction = (overrides: Partial<BookedTransactionSummary> = {}): BookedTransactionSummary => ({
  transactionId: `tx-${Math.random().toString(36).slice(2, 8)}`,
  amountMinor: 5000n,
  direction: 'credit',
  hasCompleteBooking: true,
  isUnresolved: false,
  ...overrides,
});

const balancedInput: StatementReconciliationInput = {
  workspaceId: 'workspace-1',
  accountId: 'account-1',
  accountIdentifier: 'NL89INGB0006369960',
  statementPeriodId: 'period-1',
  periodStart: new Date('2026-01-01T00:00:00Z'),
  periodEnd: new Date('2026-01-31T23:59:59Z'),
  coverageStatus: StatementCoverageStatus.COMPLETE,
  statementTotals: {
    openingBalanceMinor: 100000n,
    incomeMinor: 5000n,
    expenseMinor: 3000n,
    closingBalanceMinor: 102000n,
    transactionCount: 3,
  },
  bookedTransactions: [
    makeBookedTransaction({ amountMinor: 5000n, direction: 'credit' }),
    makeBookedTransaction({ amountMinor: 2000n, direction: 'debit' }),
    makeBookedTransaction({ amountMinor: 1000n, direction: 'debit' }),
  ],
};

describe('statement reconciliation control service', () => {
  it('returns BALANCED with close-eligible preview for exact matching totals', () => {
    const preview = buildStatementReconciliationPreview(balancedInput);

    expect(preview.status).toBe('BALANCED');
    expect(preview.closeEligibility.eligible).toBe(true);
    expect(preview.closeEligibility.reasons).toEqual([]);
    expect(preview.source).toEqual({
      openingBalanceMinor: '100000',
      incomeMinor: '5000',
      expenseMinor: '3000',
      netMinor: '2000',
      closingBalanceMinor: '102000',
      transactionCount: 3,
    });
    expect(preview.booked).toEqual({
      incomeMinor: '5000',
      expenseMinor: '3000',
      netMinor: '2000',
      transactionCount: 3,
      bookedTransactionCount: 3,
      unresolvedTransactionCount: 0,
    });
    expect(preview.differences).toEqual({
      balanceDifferenceMinor: '0',
      incomeDifferenceMinor: '0',
      expenseDifferenceMinor: '0',
      transactionCountDifference: 0,
    });
    expect(preview.validatorVersion).toBe('close-001-v1');
    expect(preview.sideEffects).toEqual({
      createsPeriodClose: false,
      createsReportSnapshot: false,
      closesPeriod: false,
    });
  });

  it('rejects opening + income - expenses != closing as StatementControlError', () => {
    expect(() => buildStatementReconciliationPreview({
      ...balancedInput,
      statementTotals: {
        openingBalanceMinor: 100000n,
        incomeMinor: 5000n,
        expenseMinor: 3000n,
        closingBalanceMinor: 999999n,
        transactionCount: 3,
      },
    })).toThrow('Opening plus inkomsten min uitgaven moet exact gelijk zijn aan het eindsaldo.');
  });

  it('returns UNBALANCED when transaction income does not match statement income', () => {
    const preview = buildStatementReconciliationPreview({
      ...balancedInput,
      bookedTransactions: [
        makeBookedTransaction({ amountMinor: 4000n, direction: 'credit' }),
        makeBookedTransaction({ amountMinor: 2000n, direction: 'debit' }),
        makeBookedTransaction({ amountMinor: 1000n, direction: 'debit' }),
      ],
    });

    expect(preview.status).toBe('UNBALANCED');
    expect(preview.differences.incomeDifferenceMinor).toBe('-1000');
    expect(preview.closeEligibility.eligible).toBe(false);
    expect(preview.closeEligibility.reasons).toContain(
      'Het inkomstenverschil is -1000 cent en moet nul zijn.',
    );
  });

  it('returns UNBALANCED when transaction expenses do not match statement expenses', () => {
    const preview = buildStatementReconciliationPreview({
      ...balancedInput,
      bookedTransactions: [
        makeBookedTransaction({ amountMinor: 5000n, direction: 'credit' }),
        makeBookedTransaction({ amountMinor: 5000n, direction: 'debit' }),
        makeBookedTransaction({ amountMinor: 1000n, direction: 'debit' }),
      ],
    });

    expect(preview.status).toBe('UNBALANCED');
    expect(preview.differences.expenseDifferenceMinor).toBe('3000');
    expect(preview.closeEligibility.eligible).toBe(false);
  });

  it('returns UNBALANCED when closing balance (net) mismatch exists', () => {
    const preview = buildStatementReconciliationPreview({
      ...balancedInput,
      bookedTransactions: [
        makeBookedTransaction({ amountMinor: 6000n, direction: 'credit' }),
        makeBookedTransaction({ amountMinor: 2000n, direction: 'debit' }),
        makeBookedTransaction({ amountMinor: 1000n, direction: 'debit' }),
      ],
    });

    expect(preview.status).toBe('UNBALANCED');
    expect(preview.differences.balanceDifferenceMinor).toBe('1000');
    expect(preview.differences.incomeDifferenceMinor).toBe('1000');
    expect(preview.closeEligibility.eligible).toBe(false);
  });

  it('returns UNBALANCED with exact transaction count difference when counts mismatch', () => {
    const preview = buildStatementReconciliationPreview({
      ...balancedInput,
      bookedTransactions: [
        makeBookedTransaction({ amountMinor: 2500n, direction: 'credit' }),
        makeBookedTransaction({ amountMinor: 2500n, direction: 'credit' }),
        makeBookedTransaction({ amountMinor: 2000n, direction: 'debit' }),
        makeBookedTransaction({ amountMinor: 1000n, direction: 'debit' }),
      ],
    });

    expect(preview.status).toBe('UNBALANCED');
    expect(preview.differences.transactionCountDifference).toBe(1);
    expect(preview.closeEligibility.eligible).toBe(false);
    expect(preview.closeEligibility.reasons).toContain(
      'Het transactieaantal verschilt met 1 en moet exact overeenkomen.',
    );
  });

  it('returns not close-eligible for partial/open coverage', () => {
    const preview = buildStatementReconciliationPreview({
      ...balancedInput,
      coverageStatus: StatementCoverageStatus.PARTIAL,
    });

    expect(preview.coverageStatus).toBe('PARTIAL');
    expect(preview.closeEligibility.eligible).toBe(false);
    expect(preview.closeEligibility.reasons).toContain(
      'Gedeeltelijke of open afschriften kunnen niet worden gesloten.',
    );
  });

  it('returns INCOMPLETE when unresolved review transactions exist', () => {
    const preview = buildStatementReconciliationPreview({
      ...balancedInput,
      bookedTransactions: [
        makeBookedTransaction({ amountMinor: 5000n, direction: 'credit', isUnresolved: true }),
        makeBookedTransaction({ amountMinor: 2000n, direction: 'debit' }),
        makeBookedTransaction({ amountMinor: 1000n, direction: 'debit' }),
      ],
    });

    expect(preview.status).toBe('INCOMPLETE');
    expect(preview.booked.unresolvedTransactionCount).toBe(1);
    expect(preview.closeEligibility.eligible).toBe(false);
    expect(preview.closeEligibility.reasons).toContain(
      'Er zijn 1 onopgeloste transacties die eerst beoordeeld moeten worden.',
    );
  });

  it('returns INCOMPLETE when booking dimensions are missing', () => {
    const preview = buildStatementReconciliationPreview({
      ...balancedInput,
      bookedTransactions: [
        makeBookedTransaction({ amountMinor: 5000n, direction: 'credit', hasCompleteBooking: false }),
        makeBookedTransaction({ amountMinor: 2000n, direction: 'debit' }),
        makeBookedTransaction({ amountMinor: 1000n, direction: 'debit' }),
      ],
    });

    expect(preview.status).toBe('INCOMPLETE');
    expect(preview.closeEligibility.eligible).toBe(false);
    expect(preview.closeEligibility.reasons).toContain(
      'Niet alle transacties hebben een volledige boeking met Klant, Type en Categorie.',
    );
  });

  it('returns exact minor-unit differences as strings', () => {
    const preview = buildStatementReconciliationPreview({
      ...balancedInput,
      bookedTransactions: [
        makeBookedTransaction({ amountMinor: 5001n, direction: 'credit' }),
        makeBookedTransaction({ amountMinor: 2999n, direction: 'debit' }),
        makeBookedTransaction({ amountMinor: 1001n, direction: 'debit' }),
      ],
    });

    expect(typeof preview.differences.balanceDifferenceMinor).toBe('string');
    expect(typeof preview.differences.incomeDifferenceMinor).toBe('string');
    expect(typeof preview.differences.expenseDifferenceMinor).toBe('string');
    expect(preview.differences.incomeDifferenceMinor).toBe('1');
    expect(preview.differences.expenseDifferenceMinor).toBe('1000');
    expect(preview.differences.balanceDifferenceMinor).toBe('-999');
  });

  it('creates no PeriodClose in any scenario', () => {
    const preview = buildStatementReconciliationPreview(balancedInput);
    expect(preview.sideEffects.createsPeriodClose).toBe(false);
    expect(preview.sideEffects.createsReportSnapshot).toBe(false);
    expect(preview.sideEffects.closesPeriod).toBe(false);
  });

  it('creates no ReportSnapshot, approval, dispatch, or booking', () => {
    const preview = buildStatementReconciliationPreview(balancedInput);
    expect(preview.sideEffects).toEqual({
      createsPeriodClose: false,
      createsReportSnapshot: false,
      closesPeriod: false,
    });
    expect(JSON.stringify(preview)).not.toContain('createReportSnapshot');
    expect(JSON.stringify(preview)).not.toContain('createsPeriodClose":true');
  });

  it('toBalancedReconciliationEvidence produces evidence accepted by assertCanClose for balanced complete preview', () => {
    const preview = buildStatementReconciliationPreview(balancedInput);
    const evidence = toBalancedReconciliationEvidence(preview);

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

    expect(() => assertCanClose(evidence!)).not.toThrow();
  });

  it('toBalancedReconciliationEvidence returns null for unbalanced preview', () => {
    const preview = buildStatementReconciliationPreview({
      ...balancedInput,
      bookedTransactions: [
        makeBookedTransaction({ amountMinor: 9000n, direction: 'credit' }),
        makeBookedTransaction({ amountMinor: 2000n, direction: 'debit' }),
        makeBookedTransaction({ amountMinor: 1000n, direction: 'debit' }),
      ],
    });

    expect(preview.status).toBe('UNBALANCED');
    expect(toBalancedReconciliationEvidence(preview)).toBeNull();
  });

  it('toBalancedReconciliationEvidence returns null for incomplete preview', () => {
    const preview = buildStatementReconciliationPreview({
      ...balancedInput,
      bookedTransactions: [
        makeBookedTransaction({ amountMinor: 5000n, direction: 'credit', isUnresolved: true }),
        makeBookedTransaction({ amountMinor: 2000n, direction: 'debit' }),
        makeBookedTransaction({ amountMinor: 1000n, direction: 'debit' }),
      ],
    });

    expect(preview.status).toBe('INCOMPLETE');
    expect(toBalancedReconciliationEvidence(preview)).toBeNull();
  });

  it('toBalancedReconciliationEvidence returns null for partial coverage even if totals match', () => {
    const preview = buildStatementReconciliationPreview({
      ...balancedInput,
      coverageStatus: StatementCoverageStatus.PARTIAL,
    });

    expect(toBalancedReconciliationEvidence(preview)).toBeNull();
  });

  it('rejects missing workspace', () => {
    expect(() => buildStatementReconciliationPreview({
      ...balancedInput,
      workspaceId: '',
    })).toThrow(StatementReconciliationControlError);
  });

  it('rejects missing account', () => {
    expect(() => buildStatementReconciliationPreview({
      ...balancedInput,
      accountId: '',
    })).toThrow(StatementReconciliationControlError);
  });

  it('rejects missing statement period id', () => {
    expect(() => buildStatementReconciliationPreview({
      ...balancedInput,
      statementPeriodId: '',
    })).toThrow(StatementReconciliationControlError);
  });

  it('rejects negative transaction count', () => {
    expect(() => buildStatementReconciliationPreview({
      ...balancedInput,
      statementTotals: {
        ...balancedInput.statementTotals,
        transactionCount: -1,
      },
    })).toThrow(StatementReconciliationControlError);
  });

  it('normalizes negative-stored debit amounts to abs before computing directional totals (signed-debit regression)', () => {
    const preview = buildStatementReconciliationPreview({
      ...balancedInput,
      bookedTransactions: [
        makeBookedTransaction({ amountMinor: 5000n, direction: 'credit' }),
        makeBookedTransaction({ amountMinor: -2000n, direction: 'debit' }),
        makeBookedTransaction({ amountMinor: -1000n, direction: 'debit' }),
      ],
    });

    expect(preview.status).toBe('BALANCED');
    expect(preview.booked.incomeMinor).toBe('5000');
    expect(preview.booked.expenseMinor).toBe('3000');
    expect(preview.booked.netMinor).toBe('2000');
    expect(preview.differences.balanceDifferenceMinor).toBe('0');
    expect(preview.differences.incomeDifferenceMinor).toBe('0');
    expect(preview.differences.expenseDifferenceMinor).toBe('0');
  });
});
