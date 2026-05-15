import { describe, expect, it } from 'vitest';
import {
  deriveMainCategoryId,
  distinctFrom,
  firstNonEmpty,
  slugify,
  splitCategoryLabel,
} from '../../src/helpers/category-labels';

describe('category label helpers', () => {
  it('slugifies category names and derives stable main category ids', () => {
    expect(slugify(' Inkomsten & Giften! ')).toBe('inkomsten-giften');
    expect(deriveMainCategoryId('Inkomsten & Giften!')).toBe('main:inkomsten-giften');
    expect(deriveMainCategoryId('!!!')).toBeNull();
    expect(deriveMainCategoryId(null)).toBeNull();
  });

  it('splits main and subcategory labels while preserving nested sub labels', () => {
    expect(splitCategoryLabel('Inkomsten — Giften — Zending')).toEqual({
      main: 'Inkomsten',
      sub: 'Giften — Zending',
    });
    expect(splitCategoryLabel('Bankkosten')).toEqual({ main: 'Bankkosten', sub: 'Bankkosten' });
    expect(splitCategoryLabel('   ')).toEqual({ main: null, sub: null });
    expect(splitCategoryLabel(null)).toEqual({ main: null, sub: null });
  });

  it('returns the first non-empty trimmed value', () => {
    expect(firstNonEmpty([null, ' ', '  Giften  ', 'Overig'])).toBe('Giften');
    expect(firstNonEmpty([undefined, '', '   '])).toBeNull();
  });

  it('returns distinct values only when they differ from the comparison value', () => {
    expect(distinctFrom('Giften', 'Inkomsten')).toBe('Giften');
    expect(distinctFrom(' Giften ', 'Giften')).toBeNull();
    expect(distinctFrom(null, 'Giften')).toBeNull();
  });
});
