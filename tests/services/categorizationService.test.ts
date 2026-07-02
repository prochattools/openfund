import { describe, expect, it } from 'vitest';
import type { CategorizationRule } from '@prisma/client';
import {
  categorizeTransaction,
  confirmTransactions,
  type CategorizationCandidate,
} from '../../server/services/categorizationService';

const candidate: CategorizationCandidate = {
  userId: 'user-1',
  source: 'ing_csv',
  normalizedDescription: 'hr mph likkel mw dd likkel koning',
  description: 'Hr MPH Likkel, Mw DD Likkel-Koning',
  paymentPurpose: 'Maandelijkse vergoeding voor kerkelijke werkzaamheden',
  amountMinor: -200000n,
  accountIdentifier: 'NL89INGB0006369960',
  counterparty: 'NL23INGB0004909067',
  reference: null,
};

const makeRule = (): CategorizationRule => ({
  id: 'rule-payment-purpose',
  userId: 'user-1',
  importBatchId: null,
  ledgerId: null,
  categoryId: 'cat-maandelijkse-vergoeding',
  label: 'Maandelijkse vergoeding',
  pattern: null,
  matchType: null,
  matchField: null,
  conditions: [
    { field: 'counterparty', matchType: 'equals', value: 'NL23INGB0004909067' },
    { field: 'paymentPurpose', matchType: 'contains', value: 'kerkelijke werkzaamheden' },
  ],
  priority: 100,
  isActive: true,
  createdBy: 'admin-1',
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  lastMatchedAt: null,
}) as CategorizationRule;

describe('categorization service', () => {
  it('does nothing when no transaction ids are supplied', async () => {
    const fakeTx = {
      transaction: {
        updateMany: async () => {
          throw new Error('updateMany should not be called');
        },
      },
    } as any;

    await expect(confirmTransactions(fakeTx, {
      userId: 'user-1',
      transactionIds: [],
    })).resolves.toBe(0);
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

    await expect(confirmTransactions(fakeTx, {
      userId: 'user-1',
      transactionIds: ['tx-1', 'tx-2'],
    })).resolves.toBe(2);

    expect(calls).toEqual([
      {
        where: {
          userId: 'user-1',
          id: { in: ['tx-1', 'tx-2'] },
          classificationSource: { not: 'manual' },
        },
        data: { classificationSource: 'manual' },
      },
    ]);
  });

  it('does not inspect transaction history or choose a popular category without an approved rule', async () => {
    const fakeTx = {
      transaction: {
        findFirst: async () => {
          throw new Error('transaction history must not be queried');
        },
        findMany: async () => {
          throw new Error('category popularity must not be queried');
        },
      },
    } as any;

    await expect(categorizeTransaction(fakeTx, candidate)).resolves.toEqual({
      categoryId: null,
      classificationSource: 'none',
      ruleId: null,
    });
  });

  it('finalizes an explicitly approved rule using counterparty and payment-purpose evidence', async () => {
    const updates: any[] = [];
    const fakeTx = {
      categorizationRule: {
        update: async (args: any) => {
          updates.push(args);
          return null;
        },
      },
    } as any;

    await expect(categorizeTransaction(fakeTx, candidate, {
      rules: [makeRule()],
    })).resolves.toEqual({
      categoryId: 'cat-maandelijkse-vergoeding',
      classificationSource: 'rule',
      ruleId: 'rule-payment-purpose',
    });

    expect(updates).toHaveLength(1);
    expect(updates[0]).toMatchObject({
      where: { id: 'rule-payment-purpose' },
    });
  });
});
