import type { LedgerTransaction } from './api-transaction-mapper';
import {
  getReviewEvidenceSummary,
} from './review-page';
import type {
  EvidenceRichReviewResponse,
  ReviewCategoryOption,
  ReviewProjectOption,
  ReviewTransactionTypeOption,
} from '@/libs/api';

export type ReviewMergeResult = {
  transactions: LedgerTransaction[];
  categories: ReviewCategoryOption[];
  projects: ReviewProjectOption[];
  transactionTypes: ReviewTransactionTypeOption[];
};

const normalizeConfidence = (value: string | null | undefined): LedgerTransaction['suggestionConfidence'] => {
  switch ((value ?? '').toLowerCase()) {
    case 'exact':
    case 'exact_fallback':
      return 'exact';
    case 'rule':
      return 'rule';
    case 'description':
      return 'description';
    case 'account':
      return 'account';
    case 'overall':
      return 'overall';
    case 'fuzzy':
      return 'fuzzy';
    case 'default':
    case 'review':
      return 'review';
    default:
      return null;
  }
};

export const mergeLedgerWithReview = (
  transactions: LedgerTransaction[],
  response: EvidenceRichReviewResponse | null,
): ReviewMergeResult => {
  if (!response) {
    return {
      transactions,
      categories: [],
      projects: [],
      transactionTypes: [],
    };
  }

  const reviewByTransactionId = new Map(
    response.transactions.map((item) => [item.transactionId, item]),
  );
  const mergedTransactions = transactions.map((transaction) => {
    const review = reviewByTransactionId.get(transaction.id);
    if (!review) return transaction;

    const rankOne = review.alternatives.find((alternative) => alternative.rank === 1)
      ?? review.alternatives[0]
      ?? null;
    const proposal = review.proposed;

    return {
      ...transaction,
      categoryId: transaction.categoryId,
      categoryName: transaction.categoryName,
      mainCategoryId: transaction.mainCategoryId,
      mainCategoryName: transaction.mainCategoryName,
      needsManualCategory: true,
      autoCategorized: false,
      reviewProposal: proposal,
      reviewAlternatives: review.alternatives,
      reviewReason: rankOne?.reason ?? review.reason ?? review.evidence.reason,
      reviewEvidenceSummary: getReviewEvidenceSummary(review),
      reviewConfidence: rankOne?.confidence ?? null,
      reviewConfidenceLabel: rankOne?.confidenceLabel ?? null,
      suggestionConfidence: normalizeConfidence(rankOne?.confidence),
      suggestedMainCategoryName: transaction.suggestedMainCategoryName,
      suggestedSubCategoryName: proposal?.categoryLabel
        ?? transaction.suggestedSubCategoryName,
    } satisfies LedgerTransaction;
  });

  return {
    transactions: mergedTransactions,
    categories: response.categories,
    projects: response.projects,
    transactionTypes: response.transactionTypes,
  };
};
