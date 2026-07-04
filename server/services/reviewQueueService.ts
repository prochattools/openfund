import type { Prisma } from '@prisma/client';
import { rejectUnsafeBulkConfirmation } from './reviewDecisionService';

type TxClient = Prisma.TransactionClient;

/**
 * Bulk clearing the review queue is no longer a financial mutation.
 *
 * MODEL-003 requires every transaction to be reviewed through an explicit
 * ReviewDecision and TransactionBooking write. Keeping this helper preserves
 * the existing route boundary while preventing silent manual truth creation.
 */
export const clearReviewQueue = async (_tx: TxClient, _userId: string): Promise<number> => {
  return rejectUnsafeBulkConfirmation();
};
