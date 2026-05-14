import { describe, expect, it } from 'vitest';
import { categorizeTransaction, confirmTransactions, type CategorizationCandidate } from '../../server/services/categorizationService';

const candidate: CategorizationCandidate = {
  userId: 'user-1',
  source: 'ing-csv',
  normalizedDescription: 'huur kerkzaal',
  description: 'Huur kerkzaal',
  amountMinor: -12500n,
  accountIdentifier: 'NL89INGB0006369960',
  counterparty: 'Verhuurder',
  reference: 'INV-1',
};

const makeCategorizationTx = ({
  findFirstResults = [],
  findManyResult = [],
}: {
  findFirstResults?: Array<{ categoryId: string | null } | null>;
  findManyResult?: Array<{ categoryId: string | null }>;
}) => {
  const findFirstCalls: any[] = [];
  const findManyCalls: any[] = [];
  const queuedFindFirstResults = [...findFirstResults];

  return {
    tx: {
      transaction: {
        findFirst: async (args: any) => {
          findFirstCalls.push(args);
          return queuedFindFirstResults.shift() ?? null;
        },
        findMany: async (args: any) => {
          findManyCalls.push(args);
          return findManyResult;
        },
      },
    } as any,
    findFirstCalls,
    findManyCalls,
  };
};

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


  it('uses exact source and amount history before broader matching', async () => {
    const { tx, findFirstCalls, findManyCalls } = makeCategorizationTx({
      findFirstResults: [{ categoryId: 'cat-rent' }],
    });

    const result = await categorizeTransaction(tx, candidate);

    expect(result).toEqual({
      categoryId: 'cat-rent',
      classificationSource: 'history',
      ruleId: null,
    });
    expect(findFirstCalls).toHaveLength(1);
    expect(findFirstCalls[0].where).toMatchObject({
      userId: 'user-1',
      source: 'ing-csv',
      categoryId: { not: null },
    });
    expect(findManyCalls).toHaveLength(0);
  });

  it('falls back to normalized description history when exact source history is missing', async () => {
    const { tx, findFirstCalls } = makeCategorizationTx({
      findFirstResults: [null, { categoryId: 'cat-housing' }],
    });

    const result = await categorizeTransaction(tx, candidate);

    expect(result).toEqual({
      categoryId: 'cat-housing',
      classificationSource: 'history',
      ruleId: null,
    });
    expect(findFirstCalls).toHaveLength(2);
    expect(findFirstCalls[1].where).toMatchObject({
      userId: 'user-1',
      normalizedKey: 'huur kerkzaal',
      categoryId: { not: null },
    });
  });

  it('uses a popular historical category only after at least three matches', async () => {
    const { tx } = makeCategorizationTx({
      findFirstResults: [null, null],
      findManyResult: [
        { categoryId: 'cat-general' },
        { categoryId: 'cat-general' },
        { categoryId: 'cat-general' },
        { categoryId: 'cat-other' },
      ],
    });

    const result = await categorizeTransaction(tx, candidate);

    expect(result).toEqual({
      categoryId: 'cat-general',
      classificationSource: 'history',
      ruleId: null,
    });
  });

  it('returns none when there is no strong enough history match', async () => {
    const { tx } = makeCategorizationTx({
      findFirstResults: [null, null],
      findManyResult: [{ categoryId: 'cat-general' }, { categoryId: 'cat-general' }],
    });

    const result = await categorizeTransaction(tx, candidate);

    expect(result).toEqual({
      categoryId: null,
      classificationSource: 'none',
      ruleId: null,
    });
  });