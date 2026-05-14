import { describe, expect, it } from 'vitest';
import { clearReviewQueue } from '../../server/services/reviewQueueService';

describe('review queue service', () => {
  it('accepts categorized suggestions without deleting imported transactions', async () => {
    const calls: any[] = [];
    const fakeTx = {
      transaction: {
        updateMany: async (args: any) => {
          calls.push(args);
          return { count: 2 };
        },
      },
    } as any;

    const cleared = await clearReviewQueue(fakeTx, 'user-1');

    expect(cleared).toBe(2);
    expect(calls).toHaveLength(1);
    expect(calls[0]).toEqual({
      where: {
        userId: 'user-1',
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
  });

  it('returns zero when there are no categorized suggestions to accept', async () => {
    const calls: any[] = [];
    const fakeTx = {
      transaction: {
        updateMany: async (args: any) => {
          calls.push(args);
          return { count: 0 };
        },
      },
    } as any;

    const cleared = await clearReviewQueue(fakeTx, 'user-empty');

    expect(cleared).toBe(0);
    expect(calls).toHaveLength(1);
    expect(calls[0].where.userId).toBe('user-empty');
  });
});