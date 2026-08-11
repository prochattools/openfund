import type { StatementCoverageStatus } from '@prisma/client';
import { assertStatementTotals, type StatementTotalsInput } from './statementControlService';
import type { BalancedReconciliationEvidence } from './periodCloseService';

export class StatementReconciliationControlError extends Error {
  statusCode: number;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = 'StatementReconciliationControlError';
    this.statusCode = statusCode;
  }
}

export type ReconciliationPreviewStatus = 'BALANCED' | 'UNBALANCED' | 'INCOMPLETE';

export type StatementReconciliationSourceTotals = {
  openingBalanceMinor: string;
  incomeMinor: string;
  expenseMinor: string;
  netMinor: string;
  closingBalanceMinor: string;
  transactionCount: number;
};

export type StatementReconciliationBookedTotals = {
  incomeMinor: string;
  expenseMinor: string;
  netMinor: string;
  transactionCount: number;
  bookedTransactionCount: number;
  unresolvedTransactionCount: number;
};

export type StatementReconciliationDifferences = {
  balanceDifferenceMinor: string;
  incomeDifferenceMinor: string;
  expenseDifferenceMinor: string;
  transactionCountDifference: number;
};

export type StatementReconciliationCloseEligibility = {
  eligible: boolean;
  reasons: string[];
};

export type StatementReconciliationPreview = {
  periodStart: string;
  periodEnd: string;
  accountId: string;
  accountIdentifier: string | null;
  coverageStatus: StatementCoverageStatus;
  source: StatementReconciliationSourceTotals;
  booked: StatementReconciliationBookedTotals;
  differences: StatementReconciliationDifferences;
  status: ReconciliationPreviewStatus;
  closeEligibility: StatementReconciliationCloseEligibility;
  validatorVersion: string;
  sideEffects: {
    createsPeriodClose: false;
    createsReportSnapshot: false;
    closesPeriod: false;
  };
};

export type StatementReconciliationInput = {
  workspaceId: string;
  accountId: string;
  accountIdentifier?: string | null;
  statementPeriodId: string;
  periodStart: Date;
  periodEnd: Date;
  coverageStatus: StatementCoverageStatus;
  statementTotals: StatementTotalsInput & { transactionCount: number };
  bookedTransactions: BookedTransactionSummary[];
};

export type BookedTransactionSummary = {
  transactionId: string;
  amountMinor: bigint | number;
  direction: 'credit' | 'debit';
  hasCompleteBooking: boolean;
  isUnresolved: boolean;
};

const VALIDATOR_VERSION = 'close-001-v1';

const toBigInt = (value: bigint | number): bigint => BigInt(value);

const computeBookedTotals = (transactions: BookedTransactionSummary[]) => {
  let incomeMinor = 0n;
  let expenseMinor = 0n;
  let bookedCount = 0;
  let unresolvedCount = 0;

  for (const tx of transactions) {
    const rawAmount = toBigInt(tx.amountMinor);
    const amount = rawAmount < 0n ? -rawAmount : rawAmount;
    if (tx.direction === 'credit') {
      incomeMinor += amount;
    } else {
      expenseMinor += amount;
    }
    if (tx.hasCompleteBooking) {
      bookedCount += 1;
    }
    if (tx.isUnresolved) {
      unresolvedCount += 1;
    }
  }

  return {
    incomeMinor,
    expenseMinor,
    netMinor: incomeMinor - expenseMinor,
    transactionCount: transactions.length,
    bookedTransactionCount: bookedCount,
    unresolvedTransactionCount: unresolvedCount,
  };
};

const toISODateString = (date: Date): string => date.toISOString().slice(0, 10);

export const buildStatementReconciliationPreview = (
  input: StatementReconciliationInput,
): StatementReconciliationPreview => {
  if (!input.workspaceId) {
    throw new StatementReconciliationControlError('Werkruimte ontbreekt.');
  }
  if (!input.accountId) {
    throw new StatementReconciliationControlError('Rekening ontbreekt.');
  }
  if (!input.statementPeriodId) {
    throw new StatementReconciliationControlError('Afschriftperiode ontbreekt.');
  }

  const sourceTotals = assertStatementTotals(input.statementTotals);
  const sourceTransactionCount = input.statementTotals.transactionCount;

  if (!Number.isInteger(sourceTransactionCount) || sourceTransactionCount < 0) {
    throw new StatementReconciliationControlError(
      'Het aantal brontransacties moet een geldig niet-negatief geheel getal zijn.',
    );
  }

  const booked = computeBookedTotals(input.bookedTransactions);

  const balanceDifference = booked.netMinor - sourceTotals.netMinor;
  const incomeDifference = booked.incomeMinor - sourceTotals.incomeMinor;
  const expenseDifference = booked.expenseMinor - sourceTotals.expenseMinor;
  const transactionCountDifference = booked.transactionCount - sourceTransactionCount;

  const closeReasons: string[] = [];
  let status: ReconciliationPreviewStatus;

  if (input.coverageStatus !== 'COMPLETE') {
    closeReasons.push('Gedeeltelijke of open afschriften kunnen niet worden gesloten.');
  }

  if (booked.unresolvedTransactionCount > 0) {
    closeReasons.push(
      `Er zijn ${booked.unresolvedTransactionCount} onopgeloste transacties die eerst beoordeeld moeten worden.`,
    );
  }

  const hasMissingBookings = booked.bookedTransactionCount < booked.transactionCount;
  if (hasMissingBookings) {
    closeReasons.push(
      'Niet alle transacties hebben een volledige boeking met Klant, Type en Categorie.',
    );
  }

  const isBalanceDifferenceZero = balanceDifference === 0n;
  const isIncomeDifferenceZero = incomeDifference === 0n;
  const isExpenseDifferenceZero = expenseDifference === 0n;
  const isCountDifferenceZero = transactionCountDifference === 0;

  if (!isBalanceDifferenceZero) {
    closeReasons.push(
      `Het saldoverschil is ${balanceDifference.toString()} cent en moet nul zijn.`,
    );
  }
  if (!isIncomeDifferenceZero) {
    closeReasons.push(
      `Het inkomstenverschil is ${incomeDifference.toString()} cent en moet nul zijn.`,
    );
  }
  if (!isExpenseDifferenceZero) {
    closeReasons.push(
      `Het uitgavenverschil is ${expenseDifference.toString()} cent en moet nul zijn.`,
    );
  }
  if (!isCountDifferenceZero) {
    closeReasons.push(
      `Het transactieaantal verschilt met ${transactionCountDifference} en moet exact overeenkomen.`,
    );
  }

  const allTotalsMatch =
    isBalanceDifferenceZero &&
    isIncomeDifferenceZero &&
    isExpenseDifferenceZero &&
    isCountDifferenceZero;

  if (booked.unresolvedTransactionCount > 0 || hasMissingBookings) {
    status = 'INCOMPLETE';
  } else if (!allTotalsMatch) {
    status = 'UNBALANCED';
  } else {
    status = 'BALANCED';
  }

  return {
    periodStart: toISODateString(input.periodStart),
    periodEnd: toISODateString(input.periodEnd),
    accountId: input.accountId,
    accountIdentifier: input.accountIdentifier ?? null,
    coverageStatus: input.coverageStatus,
    source: {
      openingBalanceMinor: sourceTotals.openingBalanceMinor.toString(),
      incomeMinor: sourceTotals.incomeMinor.toString(),
      expenseMinor: sourceTotals.expenseMinor.toString(),
      netMinor: sourceTotals.netMinor.toString(),
      closingBalanceMinor: sourceTotals.closingBalanceMinor.toString(),
      transactionCount: sourceTransactionCount,
    },
    booked: {
      incomeMinor: booked.incomeMinor.toString(),
      expenseMinor: booked.expenseMinor.toString(),
      netMinor: booked.netMinor.toString(),
      transactionCount: booked.transactionCount,
      bookedTransactionCount: booked.bookedTransactionCount,
      unresolvedTransactionCount: booked.unresolvedTransactionCount,
    },
    differences: {
      balanceDifferenceMinor: balanceDifference.toString(),
      incomeDifferenceMinor: incomeDifference.toString(),
      expenseDifferenceMinor: expenseDifference.toString(),
      transactionCountDifference,
    },
    status,
    closeEligibility: {
      eligible: closeReasons.length === 0,
      reasons: closeReasons,
    },
    validatorVersion: VALIDATOR_VERSION,
    sideEffects: {
      createsPeriodClose: false,
      createsReportSnapshot: false,
      closesPeriod: false,
    },
  };
};

export const toBalancedReconciliationEvidence = (
  preview: StatementReconciliationPreview,
): BalancedReconciliationEvidence | null => {
  if (preview.status !== 'BALANCED') return null;
  if (preview.coverageStatus !== 'COMPLETE') return null;
  if (preview.differences.balanceDifferenceMinor !== '0') return null;
  if (preview.differences.incomeDifferenceMinor !== '0') return null;
  if (preview.differences.expenseDifferenceMinor !== '0') return null;
  if (preview.differences.transactionCountDifference !== 0) return null;
  if (preview.booked.unresolvedTransactionCount !== 0) return null;
  if (preview.booked.bookedTransactionCount !== preview.booked.transactionCount) return null;

  return {
    status: 'BALANCED',
    coverageStatus: preview.coverageStatus,
    balanceDifferenceMinor: 0n,
    categoryIncomeDifferenceMinor: 0n,
    categoryExpenseDifferenceMinor: 0n,
    runningBalanceErrorCount: 0,
    transactionCount: preview.source.transactionCount,
    bookedTransactionCount: preview.booked.bookedTransactionCount,
    unresolvedTransactionCount: 0,
    validatorVersion: preview.validatorVersion,
  };
};
