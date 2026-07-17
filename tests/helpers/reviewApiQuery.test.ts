import { describe, expect, it } from 'vitest';
import { buildReviewQueryString } from '../../src/libs/api';

describe('review API query construction', () => {
  it('uses documented pagination defaults and omits inactive filters', () => {
    expect(buildReviewQueryString()).toBe('page=1&pageSize=25');
  });

  it('includes active pagination and review filters', () => {
    const query = new URLSearchParams(buildReviewQueryString({
      page: 3,
      pageSize: 50,
      confidence: 'red',
      direction: 'debit',
      projectId: 'project 1',
      categoryId: 'category/1',
      state: 'incomplete',
    }));

    expect(Object.fromEntries(query.entries())).toEqual({
      page: '3',
      pageSize: '50',
      confidence: 'red',
      direction: 'debit',
      projectId: 'project 1',
      categoryId: 'category/1',
      state: 'incomplete',
    });
  });

  it('omits null filters and the all-state sentinel', () => {
    expect(buildReviewQueryString({
      page: 2,
      pageSize: 100,
      confidence: null,
      direction: null,
      projectId: null,
      categoryId: null,
      state: 'all',
    })).toBe('page=2&pageSize=100');
  });
});
