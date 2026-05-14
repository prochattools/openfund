import { describe, expect, it } from 'vitest';
import { readRouteParam } from '../../server/routes/routeParams';

const makeRequest = (params: Record<string, string | string[] | undefined>) => ({ params }) as any;

describe('route param helper', () => {
  it('reads a normal string route parameter', () => {
    expect(readRouteParam(makeRequest({ id: 'abc-123' }), 'id')).toBe('abc-123');
  });

  it('returns the first non-empty value when Express provides an array', () => {
    expect(readRouteParam(makeRequest({ id: ['abc-123', 'ignored'] }), 'id')).toBe('abc-123');
  });

  it('returns null for missing or blank parameters', () => {
    expect(readRouteParam(makeRequest({}), 'id')).toBeNull();
    expect(readRouteParam(makeRequest({ id: '' }), 'id')).toBeNull();
    expect(readRouteParam(makeRequest({ id: '   ' }), 'id')).toBeNull();
    expect(readRouteParam(makeRequest({ id: [] }), 'id')).toBeNull();
  });
});
