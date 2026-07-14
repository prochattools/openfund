import { describe, expect, it } from 'vitest';
import { mergeCategoriesWithServer, mergeFlatReviewCategories } from '../../src/helpers/server-category-merge';

describe('server category merge helper', () => {
  it('returns the current categories unchanged when there are no server transactions', () => {
    const current = [{ id: 'cat-review', name: 'Review', parentId: null, color: '#f90' }];

    expect(mergeCategoriesWithServer(current, [])).toBe(current);
  });

  it('creates main and subcategories from server transaction labels', () => {
    const merged = mergeCategoriesWithServer(
      [{ id: 'cat-review', name: 'Review', parentId: null, color: '#f90' }],
      [
        {
          categoryId: 'cat-gifts',
          categoryName: 'Inkomsten — Giften',
        },
      ],
      ['#111111', '#222222', '#333333'],
    );

    expect(merged).toEqual([
      { id: 'cat-review', name: 'Review', parentId: null, color: '#f90' },
      { id: 'main:inkomsten', name: 'Inkomsten', parentId: null, color: '#222222' },
      { id: 'cat-gifts', name: 'Giften', parentId: 'main:inkomsten', color: '#333333' },
    ]);
  });

  it('updates existing category parent metadata without losing color', () => {
    const merged = mergeCategoriesWithServer(
      [
        { id: 'main:inkomsten', name: 'Inkomsten', parentId: null, color: '#111111' },
        { id: 'cat-gifts', name: 'Giften', parentId: null, color: '#222222' },
      ],
      [
        {
          categoryId: 'cat-gifts',
          categoryName: 'Inkomsten — Giften',
        },
      ],
    );

    expect(merged).toEqual([
      { id: 'main:inkomsten', name: 'Inkomsten', parentId: null, color: '#111111' },
      { id: 'cat-gifts', name: 'Giften', parentId: 'main:inkomsten', color: '#222222' },
    ]);
  });

  it('uses suggested and raw labels when final category labels are missing', () => {
    const merged = mergeCategoriesWithServer(
      [],
      [
        {
          categoryId: 'cat-bank',
          suggestedSubCategoryName: 'Uitgaven — Bankkosten',
          rawCategoryName: 'Uitgaven — Administratie',
        },
      ],
      ['#111111', '#222222'],
    );

    expect(merged).toEqual([
      { id: 'main:uitgaven', name: 'Uitgaven', parentId: null, color: '#111111' },
      { id: 'cat-bank', name: 'Bankkosten', parentId: 'main:uitgaven', color: '#222222' },
    ]);
  });

  it('preserves client display metadata when merging flat review categories', () => {
    expect(mergeFlatReviewCategories(
      [{ id: 'cat-gifts', name: 'Old label', parentId: 'legacy-parent', color: '#111111' }],
      [{ id: 'cat-gifts', name: 'Giften' }],
    )).toEqual([
      { id: 'cat-gifts', name: 'Giften', parentId: 'legacy-parent', color: '#111111' },
    ]);
  });

  it('adds new flat review categories without fabricating a parent', () => {
    expect(mergeFlatReviewCategories([], [{ id: 'cat-gifts', name: 'Giften' }])).toEqual([
      { id: 'cat-gifts', name: 'Giften', parentId: null },
    ]);
  });
});
