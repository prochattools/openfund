import { describe, expect, it } from 'vitest';
import { clearReviewQueue } from '../../server/services/reviewQueueService';
import { BULK_CONFIRMATION_DISABLED_MESSAGE } from '../../server/services/reviewDecisionService';

describe('review queue service', () => {
  it('rejects bulk review clearing without mutating transactions', async () => {
    const calls: any[] = [];
    const fakeTx = {
      transaction: {
        updateMany: async (args: any) => {
          calls.push(args);
          throw new Error('updateMany should not be called');
        },
      },
    } as any;

    await expect(clearReviewQueue(fakeTx, 'user-1')).rejects.toMatchObject({
      message: BULK_CONFIRMATION_DISABLED_MESSAGE,
      statusCode: 409,
    });

    expect(calls).toHaveLength(0);
  });
});
