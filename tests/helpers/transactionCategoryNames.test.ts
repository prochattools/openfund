import { describe, expect, it } from 'vitest';
import { deriveCategoryNames } from '../../src/helpers/transaction-category-names';

describe('transaction category name helper', () => {
  it('prefers explicit main category and derives a distinct subcategory', () => {
    expect(deriveCategoryNames({
      mainCategoryName: 'Inkomsten',
      categoryName: 'Inkomsten — Giften',
    })).toEqual({
      mainName: 'Inkomsten',
      subName: 'Giften',
      suggestedMainName: 'Inkomsten',
      suggestedSubName: 'Giften',
      rawMainName: null,
      rawSubName: null,
    });
  });

  it('falls back through suggested and raw category labels', () => {
    expect(deriveCategoryNames({
      suggestedSubCategoryName: 'Uitgaven — Bankkosten',
      rawCategoryName: 'Uitgaven — Overig',
    })).toEqual({
      mainName: 'Uitgaven',
      subName: 'Bankkosten',
      suggestedMainName: 'Uitgaven',
      suggestedSubName: 'Bankkosten',
      rawMainName: null,
      rawSubName: 'Overig',
    });
  });

  it('keeps nested subcategory labels after the first separator', () => {
    expect(deriveCategoryNames({
      categoryName: 'Projecten — Zending — India',
    })).toMatchObject({
      mainName: 'Projecten',
      subName: 'Zending — India',
      suggestedMainName: 'Projecten',
      suggestedSubName: 'Zending — India',
    });
  });

  it('returns null fields for empty category data', () => {
    expect(deriveCategoryNames({})).toEqual({
      mainName: null,
      subName: null,
      suggestedMainName: null,
      suggestedSubName: null,
      rawMainName: null,
      rawSubName: null,
    });
  });
});
