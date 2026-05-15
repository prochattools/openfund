import type { LedgerTransaction } from './api-transaction-mapper';

export type LedgerSummary = {
  total: number;
  reviewCount: number;
  autoCategorized: number;
  totalAmount: number;
};

export const buildLedgerSummary = (transactions: LedgerTransaction[]): LedgerSummary => {
  const reviewCount = transactions.filter((tx) => tx.needsManualCategory).length;
  const autoCategorized = transactions.filter(
    (tx) => tx.classificationSource === 'history' || tx.classificationSource === 'rule',
  ).length;
  const totalAmount = transactions.reduce((acc, tx) => acc + tx.amount, 0);

  return {
    total: transactions.length,
    reviewCount,
    autoCategorized,
    totalAmount,
  };
};

export const filterReviewTransactions = (transactions: LedgerTransaction[]): LedgerTransaction[] =>
  transactions.filter((tx) => tx.needsManualCategory);
