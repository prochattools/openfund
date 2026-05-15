import { describe, expect, it } from 'vitest';
import {
  categorizeTransactions,
  ensureSuggestionNames,
  makeDirectHistoryKey,
  sanitizeKey,
  suggestionIdentifier,
  type OfflineCategory,
  type OfflineLedgerTransaction,
} from '../../src/helpers/offline-categorization';

const categoryIndex = new Map<string, OfflineCategory>([
  ['main-income', { id: 'main-income', name: 'Inkomsten', parentId: null }],
  ['cat-gifts', { id: 'cat-gifts', name: 'Giften', parentId: 'main-income' }],
  ['main-review', { id: 'main-review', name: 'Review', parentId: null }],
  ['cat-review', { id: 'cat-review', name: 'Needs manual categorization', parentId: 'main-review' }],
]);

const reviewCategory = {
  categoryId: 'cat-review',
  categoryName: 'Needs manual categorization',
  mainCategoryId: 'main-review',
  mainCategoryName: 'Review',
};

const makeTx = (overrides: Partial<OfflineLedgerTransaction>): OfflineLedgerTransaction => ({
  source: 'Donor Naam',
  amount: 25,
  normalizedKey: 'gift voor zending',
  categoryId: null,
  categoryName: null,
  mainCategoryId: null,
  mainCategoryName: null,
  ...overrides,
});

describe('offline categorization helpers', () => {
  it('normalizes suggestion keys and identifiers', () => {
    expect(sanitizeKey('  Donor Naam  ')).toBe('donor naam');
    expect(sanitizeKey('   ')).toBeNull();
    expect(makeDirectHistoryKey(' Donor Naam ', 25)).toBe('donor naam|25');
    expect(makeDirectHistoryKey('', 25)).toBeNull();
    expect(suggestionIdentifier({
      categoryId: 'cat-gifts',
      categoryName: null,
      mainCategoryId: 'main-income',
      mainCategoryName: null,
    })).toBe('main-income::cat-gifts');
  });

  it('fills missing suggestion names from the category index', () => {
    expect(ensureSuggestionNames({
      categoryId: 'cat-gifts',
      categoryName: null,
      mainCategoryId: null,
      mainCategoryName: null,
    }, categoryIndex)).toEqual({
      categoryId: 'cat-gifts',
      categoryName: 'Giften',
      mainCategoryId: 'main-income',
      mainCategoryName: 'Inkomsten',
    });
  });

  it('auto-categorizes direct source and amount history matches', () => {
    const history = [makeTx({
      categoryId: 'cat-gifts',
      categoryName: 'Giften',
      mainCategoryId: 'main-income',
      mainCategoryName: 'Inkomsten',
    })];
    const incoming = [makeTx({ categoryId: null, categoryName: null, mainCategoryId: null, mainCategoryName: null })];

    const result = categorizeTransactions(incoming, history, categoryIndex, reviewCategory);

    expect(result.autoCategorized).toBe(1);
    expect(result.transactions[0]).toMatchObject({
      categoryId: 'cat-gifts',
      categoryName: 'Giften',
      mainCategoryId: 'main-income',
      mainCategoryName: 'Inkomsten',
      autoCategorized: true,
      needsManualCategory: false,
    });
  });

  it('suggests fallback matches but keeps them in manual review', () => {
    const history = [makeTx({
      source: 'Andere donor',
      amount: 50,
      normalizedKey: 'bankkosten',
      categoryId: 'cat-gifts',
      categoryName: 'Giften',
      mainCategoryId: 'main-income',
      mainCategoryName: 'Inkomsten',
    })];
    const incoming = [makeTx({ source: 'Nieuwe donor', amount: 10, normalizedKey: 'bankkosten' })];

    const result = categorizeTransactions(incoming, history, categoryIndex, reviewCategory);

    expect(result.autoCategorized).toBe(0);
    expect(result.transactions[0]).toMatchObject({
      categoryId: 'cat-gifts',
      categoryName: 'Giften',
      mainCategoryId: 'main-income',
      mainCategoryName: 'Inkomsten',
      autoCategorized: false,
      needsManualCategory: true,
    });
  });

  it('falls back to the configured review category when no history exists', () => {
    const result = categorizeTransactions([makeTx({})], [], categoryIndex, reviewCategory);

    expect(result).toMatchObject({ autoCategorized: 0 });
    expect(result.transactions[0]).toMatchObject({
      categoryId: 'cat-review',
      categoryName: 'Needs manual categorization',
      mainCategoryId: 'main-review',
      mainCategoryName: 'Review',
      autoCategorized: false,
      needsManualCategory: true,
    });
  });
});
