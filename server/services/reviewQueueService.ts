import type { Prisma } from '@prisma/client';

type TxClient = Prisma.TransactionClient;

/**
 * Clear the review queue without deleting imported bank transactions.
 *
 * Older code removed every non-manual transaction, which is unsafe for a ledger
 * where the ING import is the source of truth. Clearing the queue should only
 * accept transactions that already have a category suggestion assigned.
 */
export const clearReviewQueue = async (tx: TxClient, userId: string): Promise<number> => {
  const result = await tx.transaction.updateMany({
    where: {
      userId,
      categoryId: {
        not: null,
      },
      classificationSource: {
        not: 'manual',
      },
    },
    data: {
      classificationSource: 'manual',
      classificationRuleId: null,
    },
  });

  return result.count;
};
