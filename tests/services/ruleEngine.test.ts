import { describe, expect, it, vi } from 'vitest';
import { applyRuleToTransactions, findMatchingRule, matchesRule, type RuleCondition } from '../../server/services/ruleEngine';
import type { CategorizationRule } from '@prisma/client';

const baseContext = {
  description: 'Hr MPH Likkel, Mw DD Likkel-Koning',
  normalizedDescription: 'hr mph likkel, mw dd likkel-koning',
  counterparty: 'NL00INGB0123456789',
  reference: 'Payment reference',
  source: 'ING',
  amountMinor: 200000n,
};

const makeRule = (overrides: Partial<CategorizationRule> & { conditions?: RuleCondition[] | null }): CategorizationRule => ({
  id: 'rule-1',
  userId: 'user-1',
  importBatchId: null,
  ledgerId: null,
  categoryId: 'cat-1',
  label: 'Test',
  pattern: null,
  matchType: null,
  matchField: null,
  conditions: overrides.conditions ?? null,
  priority: 100,
  isActive: true,
  createdBy: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  lastMatchedAt: null,
  ...overrides,
}) as CategorizationRule;

describe('rule engine', () => {
  it('matches single description contains condition', () => {
    const rule = makeRule({
      conditions: [{ field: 'description', matchType: 'contains', value: 'Likkel' }],
    });

    expect(matchesRule(rule, baseContext)).toBe(true);
  });

  it('matches combined description and amount conditions', () => {
    const rule = makeRule({
      conditions: [
        { field: 'description', matchType: 'contains', value: 'Likkel' },
        { field: 'amount', matchType: 'equals', value: '2000' },
      ],
    });

    expect(matchesRule(rule, baseContext)).toBe(true);
  });

  it('does not match when amount differs', () => {
    const rule = makeRule({
      conditions: [
        { field: 'description', matchType: 'contains', value: 'Likkel' },
        { field: 'amount', matchType: 'equals', value: '1500' },
      ],
    });

    expect(matchesRule(rule, baseContext)).toBe(false);
  });

  it('supports legacy pattern and match field rules', () => {
    const legacyRule = makeRule({
      pattern: 'Likkel',
      matchType: 'contains' as any,
      matchField: 'description' as any,
      conditions: null,
    });

    expect(matchesRule(legacyRule, baseContext)).toBe(true);
  });

  it('supports safe regex conditions and rejects invalid regex patterns', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const validRegex = makeRule({
      conditions: [{ field: 'reference', matchType: 'regex', value: '^Payment' }],
    });
    const invalidRegex = makeRule({
      conditions: [{ field: 'reference', matchType: 'regex', value: '[' }],
    });

    try {
      expect(matchesRule(validRegex, baseContext)).toBe(true);
      expect(matchesRule(invalidRegex, baseContext)).toBe(false);
      expect(warn).toHaveBeenCalledOnce();
    } finally {
      warn.mockRestore();
    }
  });

  it('returns the first active matching rule and skips inactive rules', () => {
    const inactiveMatch = makeRule({
      id: 'inactive',
      isActive: false,
      categoryId: 'cat-inactive',
      conditions: [{ field: 'description', matchType: 'contains', value: 'Likkel' }],
    });
    const activeMatch = makeRule({
      id: 'active',
      categoryId: 'cat-active',
      conditions: [{ field: 'description', matchType: 'contains', value: 'Likkel' }],
    });

    expect(findMatchingRule([inactiveMatch, activeMatch], baseContext)?.id).toBe('active');
  });
});


  it('does not apply a rule when no transaction ids are selected', async () => {
    const fakeTx = {
      categorizationRule: {
        findFirst: async () => {
          throw new Error('findFirst should not be called');
        },
      },
    } as any;

    await expect(applyRuleToTransactions(fakeTx, {
      userId: 'user-1',
      ruleId: 'rule-1',
      transactionIds: [],
    })).resolves.toBe(0);
  });

  it('applies a rule to selected transactions and confirms them', async () => {
    const calls: any[] = [];
    const fakeTx = {
      categorizationRule: {
        findFirst: async (args: any) => {
          calls.push(['findRule', args]);
          return makeRule({ id: 'rule-1', categoryId: 'cat-rent', conditions: [] });
        },
        update: async (args: any) => {
          calls.push(['touchRule', args]);
          return {};
        },
      },
      transaction: {
        updateMany: async (args: any) => {
          calls.push(['updateTransactions', args]);
          return { count: 2 };
        },
      },
    } as any;

    const count = await applyRuleToTransactions(fakeTx, {
      userId: 'user-1',
      ruleId: 'rule-1',
      transactionIds: ['tx-1', 'tx-2'],
    });

    expect(count).toBe(2);
    expect(calls).toEqual([
      ['findRule', { where: { id: 'rule-1', userId: 'user-1' } }],
      ['updateTransactions', {
        where: { id: { in: ['tx-1', 'tx-2'] }, userId: 'user-1' },
        data: { categoryId: 'cat-rent', classificationRuleId: 'rule-1' },
      }],
      ['updateTransactions', {
        where: {
          userId: 'user-1',
          id: { in: ['tx-1', 'tx-2'] },
          classificationSource: { not: 'manual' },
        },
        data: { classificationSource: 'manual' },
      }],
      ['touchRule', {
        where: { id: 'rule-1' },
        data: { lastMatchedAt: expect.any(Date) },
      }],
    ]);
  });