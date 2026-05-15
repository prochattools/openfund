import { describe, expect, it } from 'vitest';
import { normalizeRuleResponse, sortRules, type RuleSummary } from '../../src/helpers/rule-summaries';

const makeRule = (overrides: Partial<RuleSummary>): RuleSummary => ({
  id: 'rule-1',
  label: 'Regel',
  pattern: 'gift',
  matchType: 'contains',
  matchField: 'description',
  categoryId: 'cat-gift',
  categoryName: 'Inkomsten — Giften',
  mainCategoryId: 'main:inkomsten',
  mainCategoryName: 'Inkomsten',
  conditions: null,
  priority: 100,
  isActive: true,
  createdAt: '2026-05-01T00:00:00.000Z',
  updatedAt: '2026-05-01T00:00:00.000Z',
  ...overrides,
});

describe('rule summary helpers', () => {
  it('normalizes API rule responses with category-derived main metadata', () => {
    const normalized = normalizeRuleResponse({
      id: 'rule-1',
      label: 'Giften',
      pattern: 'gift',
      matchType: 'contains',
      matchField: 'description',
      categoryId: 'cat-gift',
      category: { name: 'Inkomsten — Giften' },
      conditions: [{ field: 'description', matchType: 'contains', value: 'gift' }],
      priority: 250,
      isActive: true,
      createdAt: '2026-05-01T00:00:00.000Z',
      updatedAt: '2026-05-02T00:00:00.000Z',
    });

    expect(normalized).toEqual({
      id: 'rule-1',
      label: 'Giften',
      pattern: 'gift',
      matchType: 'contains',
      matchField: 'description',
      categoryId: 'cat-gift',
      categoryName: 'Inkomsten — Giften',
      mainCategoryId: 'main:inkomsten',
      mainCategoryName: 'Inkomsten',
      conditions: [{ field: 'description', matchType: 'contains', value: 'gift' }],
      priority: 250,
      isActive: true,
      createdAt: '2026-05-01T00:00:00.000Z',
      updatedAt: '2026-05-02T00:00:00.000Z',
    });
  });

  it('normalizes missing category and non-array conditions safely', () => {
    const normalized = normalizeRuleResponse({
      id: 'rule-2',
      label: 'Onvolledig',
      pattern: null,
      matchType: null,
      matchField: null,
      categoryId: 'cat-unknown',
      category: null,
      conditions: { not: 'an array' },
      priority: 0,
      isActive: false,
      createdAt: '2026-05-01T00:00:00.000Z',
      updatedAt: '2026-05-01T00:00:00.000Z',
    });

    expect(normalized.categoryName).toBeNull();
    expect(normalized.mainCategoryId).toBeNull();
    expect(normalized.mainCategoryName).toBeNull();
    expect(normalized.conditions).toBeNull();
  });

  it('sorts rules by priority first and newest update second', () => {
    const olderHigh = makeRule({ id: 'older-high', priority: 200, updatedAt: '2026-05-01T00:00:00.000Z' });
    const newerHigh = makeRule({ id: 'newer-high', priority: 200, updatedAt: '2026-05-03T00:00:00.000Z' });
    const lower = makeRule({ id: 'lower', priority: 50, updatedAt: '2026-05-05T00:00:00.000Z' });

    expect([lower, olderHigh, newerHigh].sort(sortRules).map((rule) => rule.id)).toEqual([
      'newer-high',
      'older-high',
      'lower',
    ]);
  });
});
