import type { StatementCoverageStatus } from '@prisma/client';
import type { StatementReconciliationPreview } from './statementReconciliationControlService';
import type { BalancedReconciliationEvidence } from './periodCloseService';

export type CategoryControlStatus = 'BALANCED' | 'UNBALANCED' | 'INCOMPLETE';

export type CategoryControlLine = {
  projectId: string | null;
  literalProjectLabel: string | null;
  transactionTypeId: string | null;
  literalTypeLabel: string | null;
  categoryId: string | null;
  literalCategoryLabel: string | null;
  direction: 'credit' | 'debit';
  incomeMinor: string;
  expenseMinor: string;
  transactionCount: number;
};

export type CategoryControlDifferences = {
  categoryIncomeDifferenceMinor: string;
  categoryExpenseDifferenceMinor: string;
  transactionCountDifference: number;
};

export type CategoryControlMissingDimensions = {
  missingProjectCount: number;
  missingTransactionTypeCount: number;
  missingCategoryCount: number;
  missingBookingCount: number;
  unresolvedTransactionCount: number;
};

export type CategoryControlCloseEligibility = {
  categoryControlsEligible: boolean;
  reasons: string[];
};

export type CategoryControlTotalsResult = {
  periodStart: string;
  periodEnd: string;
  accountId: string;
  accountIdentifier: string | null;
  source: {
    incomeMinor: string;
    expenseMinor: string;
    transactionCount: number;
  };
  category: {
    incomeMinor: string;
    expenseMinor: string;
    transactionCount: number;
  };
  differences: CategoryControlDifferences;
  lines: CategoryControlLine[];
  missingDimensions: CategoryControlMissingDimensions;
  status: CategoryControlStatus;
  closeEligibility: CategoryControlCloseEligibility;
  validatorVersion: string;
  sideEffects: {
    createsPeriodClose: false;
    createsReportSnapshot: false;
    closesPeriod: false;
  };
};

export type CategoryControlTransactionInput = {
  transactionId: string;
  amountMinor: bigint | number;
  direction: 'credit' | 'debit';
  hasCompleteBooking: boolean;
  isUnresolved: boolean;
  projectId: string | null;
  transactionTypeId: string | null;
  categoryId: string | null;
  literalProjectLabel: string | null;
  literalTypeLabel: string | null;
  literalCategoryLabel: string | null;
};

export type CategoryControlTotalsInput = {
  workspaceId: string;
  accountId: string;
  accountIdentifier?: string | null;
  periodStart: Date;
  periodEnd: Date;
  statementIncomeMinor: bigint | number;
  statementExpenseMinor: bigint | number;
  statementTransactionCount: number;
  transactions: CategoryControlTransactionInput[];
};

const VALIDATOR_VERSION = 'close-002-v1';

const toBigInt = (value: bigint | number): bigint => BigInt(value);

const toISODateString = (date: Date): string => date.toISOString().slice(0, 10);

type LineKey = string;

type LineAccumulator = {
  projectId: string | null;
  literalProjectLabel: string | null;
  transactionTypeId: string | null;
  literalTypeLabel: string | null;
  categoryId: string | null;
  literalCategoryLabel: string | null;
  direction: 'credit' | 'debit';
  incomeMinor: bigint;
  expenseMinor: bigint;
  transactionCount: number;
};

const makeLineKey = (tx: CategoryControlTransactionInput): LineKey =>
  [
    tx.projectId ?? '',
    tx.transactionTypeId ?? '',
    tx.categoryId ?? '',
    tx.direction,
  ].join('\x00');

const compareLine = (a: CategoryControlLine, b: CategoryControlLine): number => {
  const projectCmp = (a.literalProjectLabel ?? '').localeCompare(b.literalProjectLabel ?? '');
  if (projectCmp !== 0) return projectCmp;

  const typeCmp = (a.literalTypeLabel ?? '').localeCompare(b.literalTypeLabel ?? '');
  if (typeCmp !== 0) return typeCmp;

  const categoryCmp = (a.literalCategoryLabel ?? '').localeCompare(b.literalCategoryLabel ?? '');
  if (categoryCmp !== 0) return categoryCmp;

  if (a.direction < b.direction) return -1;
  if (a.direction > b.direction) return 1;

  return 0;
};

export const buildCategoryControlTotals = (
  input: CategoryControlTotalsInput,
): CategoryControlTotalsResult => {
  const statementIncome = toBigInt(input.statementIncomeMinor);
  const statementExpense = toBigInt(input.statementExpenseMinor);

  let categoryIncome = 0n;
  let categoryExpense = 0n;
  let bookedCount = 0;
  let unresolvedCount = 0;
  let missingProjectCount = 0;
  let missingTransactionTypeCount = 0;
  let missingCategoryCount = 0;
  let missingBookingCount = 0;

  const lineMap = new Map<LineKey, LineAccumulator>();

  for (const tx of input.transactions) {
    const rawAmount = toBigInt(tx.amountMinor);
    const amount = rawAmount < 0n ? -rawAmount : rawAmount;

    if (tx.hasCompleteBooking) {
      bookedCount += 1;
      if (tx.direction === 'credit') {
        categoryIncome += amount;
      } else {
        categoryExpense += amount;
      }

      const key = makeLineKey(tx);
      const existing = lineMap.get(key);
      if (existing) {
        if (tx.direction === 'credit') {
          existing.incomeMinor += amount;
        } else {
          existing.expenseMinor += amount;
        }
        existing.transactionCount += 1;
      } else {
        lineMap.set(key, {
          projectId: tx.projectId,
          literalProjectLabel: tx.literalProjectLabel,
          transactionTypeId: tx.transactionTypeId,
          literalTypeLabel: tx.literalTypeLabel,
          categoryId: tx.categoryId,
          literalCategoryLabel: tx.literalCategoryLabel,
          direction: tx.direction,
          incomeMinor: tx.direction === 'credit' ? amount : 0n,
          expenseMinor: tx.direction === 'debit' ? amount : 0n,
          transactionCount: 1,
        });
      }
    } else {
      missingBookingCount += 1;
      if (!tx.projectId) missingProjectCount += 1;
      if (!tx.transactionTypeId) missingTransactionTypeCount += 1;
      if (!tx.categoryId) missingCategoryCount += 1;
    }

    if (tx.isUnresolved) {
      unresolvedCount += 1;
    }
  }

  const categoryIncomeDifference = categoryIncome - statementIncome;
  const categoryExpenseDifference = categoryExpense - statementExpense;
  const transactionCountDifference = bookedCount - input.statementTransactionCount;

  const closeReasons: string[] = [];
  let status: CategoryControlStatus;

  if (unresolvedCount > 0) {
    closeReasons.push(
      `Er zijn ${unresolvedCount} onopgeloste transacties die eerst beoordeeld moeten worden.`,
    );
  }

  if (missingBookingCount > 0) {
    closeReasons.push(
      'Niet alle transacties hebben een volledige boeking met Klant, Type en Categorie.',
    );
  }

  if (missingProjectCount > 0) {
    closeReasons.push(`${missingProjectCount} transactie(s) missen een Klant.`);
  }

  if (missingTransactionTypeCount > 0) {
    closeReasons.push(`${missingTransactionTypeCount} transactie(s) missen een Type.`);
  }

  if (missingCategoryCount > 0) {
    closeReasons.push(`${missingCategoryCount} transactie(s) missen een Categorie.`);
  }

  const isIncomeDifferenceZero = categoryIncomeDifference === 0n;
  const isExpenseDifferenceZero = categoryExpenseDifference === 0n;
  const isCountDifferenceZero = transactionCountDifference === 0;

  if (!isIncomeDifferenceZero) {
    closeReasons.push(
      `Het categorieïnkomstenverschil is ${categoryIncomeDifference.toString()} cent en moet nul zijn.`,
    );
  }

  if (!isExpenseDifferenceZero) {
    closeReasons.push(
      `Het categorieuitgavenverschil is ${categoryExpenseDifference.toString()} cent en moet nul zijn.`,
    );
  }

  if (!isCountDifferenceZero) {
    closeReasons.push(
      `Het geboekte aantal verschilt met ${transactionCountDifference} van het afschriftaantal.`,
    );
  }

  if (unresolvedCount > 0 || missingBookingCount > 0) {
    status = 'INCOMPLETE';
  } else if (!isIncomeDifferenceZero || !isExpenseDifferenceZero || !isCountDifferenceZero) {
    status = 'UNBALANCED';
  } else {
    status = 'BALANCED';
  }

  const lines: CategoryControlLine[] = Array.from(lineMap.values())
    .map((acc) => ({
      projectId: acc.projectId,
      literalProjectLabel: acc.literalProjectLabel,
      transactionTypeId: acc.transactionTypeId,
      literalTypeLabel: acc.literalTypeLabel,
      categoryId: acc.categoryId,
      literalCategoryLabel: acc.literalCategoryLabel,
      direction: acc.direction,
      incomeMinor: acc.incomeMinor.toString(),
      expenseMinor: acc.expenseMinor.toString(),
      transactionCount: acc.transactionCount,
    }))
    .sort(compareLine);

  return {
    periodStart: toISODateString(input.periodStart),
    periodEnd: toISODateString(input.periodEnd),
    accountId: input.accountId,
    accountIdentifier: input.accountIdentifier ?? null,
    source: {
      incomeMinor: statementIncome.toString(),
      expenseMinor: statementExpense.toString(),
      transactionCount: input.statementTransactionCount,
    },
    category: {
      incomeMinor: categoryIncome.toString(),
      expenseMinor: categoryExpense.toString(),
      transactionCount: bookedCount,
    },
    differences: {
      categoryIncomeDifferenceMinor: categoryIncomeDifference.toString(),
      categoryExpenseDifferenceMinor: categoryExpenseDifference.toString(),
      transactionCountDifference,
    },
    lines,
    missingDimensions: {
      missingProjectCount,
      missingTransactionTypeCount,
      missingCategoryCount,
      missingBookingCount,
      unresolvedTransactionCount: unresolvedCount,
    },
    status,
    closeEligibility: {
      categoryControlsEligible: closeReasons.length === 0,
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

export type CombinedCloseControlPreview = {
  statementReconciliation: StatementReconciliationPreview;
  categoryControls: CategoryControlTotalsResult;
  combinedStatus: CategoryControlStatus;
  combinedCloseEligible: boolean;
  combinedReasons: string[];
};

export const buildCloseControlPreview = (
  statementReconciliation: StatementReconciliationPreview,
  categoryControls: CategoryControlTotalsResult,
): CombinedCloseControlPreview => {
  const combinedReasons: string[] = [];

  if (!statementReconciliation.closeEligibility.eligible) {
    combinedReasons.push(...statementReconciliation.closeEligibility.reasons);
  }
  if (!categoryControls.closeEligibility.categoryControlsEligible) {
    for (const reason of categoryControls.closeEligibility.reasons) {
      if (!combinedReasons.includes(reason)) {
        combinedReasons.push(reason);
      }
    }
  }

  let combinedStatus: CategoryControlStatus;
  if (
    statementReconciliation.status === 'INCOMPLETE' ||
    categoryControls.status === 'INCOMPLETE'
  ) {
    combinedStatus = 'INCOMPLETE';
  } else if (
    statementReconciliation.status === 'UNBALANCED' ||
    categoryControls.status === 'UNBALANCED'
  ) {
    combinedStatus = 'UNBALANCED';
  } else {
    combinedStatus = 'BALANCED';
  }

  const combinedCloseEligible = combinedReasons.length === 0;

  return {
    statementReconciliation,
    categoryControls,
    combinedStatus,
    combinedCloseEligible,
    combinedReasons,
  };
};

export const toCombinedReconciliationEvidence = (
  combined: CombinedCloseControlPreview,
): BalancedReconciliationEvidence | null => {
  if (combined.combinedStatus !== 'BALANCED') return null;
  if (!combined.combinedCloseEligible) return null;

  const preview = combined.statementReconciliation;
  const category = combined.categoryControls;

  if (preview.coverageStatus !== 'COMPLETE') return null;
  if (preview.differences.balanceDifferenceMinor !== '0') return null;
  if (preview.differences.incomeDifferenceMinor !== '0') return null;
  if (preview.differences.expenseDifferenceMinor !== '0') return null;
  if (preview.differences.transactionCountDifference !== 0) return null;
  if (preview.booked.unresolvedTransactionCount !== 0) return null;
  if (preview.booked.bookedTransactionCount !== preview.booked.transactionCount) return null;

  if (category.differences.categoryIncomeDifferenceMinor !== '0') return null;
  if (category.differences.categoryExpenseDifferenceMinor !== '0') return null;
  if (category.differences.transactionCountDifference !== 0) return null;
  if (category.missingDimensions.unresolvedTransactionCount !== 0) return null;
  if (category.missingDimensions.missingBookingCount !== 0) return null;

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
    validatorVersion: `${preview.validatorVersion}+${category.validatorVersion}`,
  };
};
