import { describe, expect, it } from 'vitest';
import { confirmTransactions } from '../../server/services/categorizationService';

describe('categorization service', () => {
  it('does nothing when no transaction ids are supplied', async () => {
    const fakeTx = {
      transaction: {
        updateMany: async () => {
          throw new Error('updateMany should not be called');
        },
      },
    } as any;

    const count = await confirmTransactions(fakeTx, { userId: 'user-1', transactionIds: [] });

    expect(count).toBe(0);
  });

  it('marks selected non-manual transactions as manually confirmed', async () => {
    const calls: any[] = [];
    const fakeTx = {
      transaction: {
        updateMany: async (args: any) => {
          calls.push(args);
          return { count: 2 };
        },
      },
    } as any;

    const count = await confirmTransactions(fakeTx, {
      userId: 'user-1',
      transactionIds: ['tx-1', 'tx-2'],
    });

    expect(count).toBe(2);
    expect(calls).toEqual([
      {
        where: {
          userId: 'user-1',
          id: { in: ['tx-1', 'tx-2'] },
          classificationSource: {
            not: 'manual',
          },
        },
        data: {
          classificationSource: 'manual',
        },
      },
    ]);
  });
});
