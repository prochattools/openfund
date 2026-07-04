import type { CategorizationRule, Prisma, TransactionClassificationSource } from '@prisma/client';
import { findMatchingRule, touchRuleMatch } from './ruleEngine';
import { rejectUnsafeBulkConfirmation } from './reviewDecisionService';

/**
 * Each transaction must be either in the review queue or in the ledger, never in neither.
 * All transitions out of review should go through this helper to keep the invariant.
 */
export const confirmTransactions = async (
  _tx: Prisma.TransactionClient,
  params: { userId: string; transactionIds: string[] },
): Promise<number> => {
  if (!params.transactionIds.length) return 0;

  return rejectUnsafeBulkConfirmation();
};

export interface CategorizationCandidate {
  userId: string;
  source: string;
  normalizedDescription: string;
  description: string;
  paymentPurpose?: string | null;
  amountMinor: bigint;
  accountIdentifier: string;
  counterparty?: string | null;
  reference?: string | null;
}

/**
 * Only an explicitly configured categorization rule may produce a final category here.
 * Historical, amount-only, popularity, and fuzzy matches are suggestions and are handled
 * by the import service without becoming final bookings.
 */
export const categorizeTransaction = async (
  tx: Prisma.TransactionClient,
  candidate: CategorizationCandidate,
  options: { rules?: CategorizationRule[] } = {},
): Promise<{
  categoryId: string | null;
  classificationSource: TransactionClassificationSource;
  ruleId: string | null;
}> => {
  const rule = findMatchingRule(options.rules, {
    description: candidate.description,
    normalizedDescription: candidate.normalizedDescription,
    counterparty: candidate.counterparty,
    paymentPurpose: candidate.paymentPurpose,
    reference: candidate.reference,
    source: candidate.source,
    amountMinor: candidate.amountMinor,
  });

  if (rule) {
    await touchRuleMatch(tx, rule.id);
    return {
      categoryId: rule.categoryId,
      classificationSource: 'rule',
      ruleId: rule.id,
    };
  }

  return {
    categoryId: null,
    classificationSource: 'none',
    ruleId: null,
  };
};
