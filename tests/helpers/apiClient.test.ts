import { describe, expect, it } from 'vitest';
import {
  buildLimitQuery,
  buildReconciliationQuery,
  buildReportSummaryQuery,
  encodeApiPathSegment,
} from '../../src/helpers/api-client';

describe('API client query helpers', () => {
  it('encodes dynamic API path segments safely', () => {
    expect(encodeApiPathSegment('plain-id')).toBe('plain-id');
    expect(encodeApiPathSegment('id/with/slashes')).toBe('id%2Fwith%2Fslashes');
    expect(encodeApiPathSegment('regel met spatie')).toBe('regel%20met%20spatie');
  });

  it('builds limit query strings for list endpoints', () => {
    expect(buildLimitQuery(25)).toBe('limit=25');
    expect(buildLimitQuery(100)).toBe('limit=100');
  });

  it('builds report summary query strings with optional month', () => {
    expect(buildReportSummaryQuery({ year: 2026 })).toBe('year=2026');
    expect(buildReportSummaryQuery({ year: 2026, month: 5 })).toBe('year=2026&month=5');
    expect(buildReportSummaryQuery({ year: 2026, month: null })).toBe('year=2026');
  });

  it('builds reconciliation query strings with optional period fields', () => {
    expect(buildReconciliationQuery({ accountId: 'acc-1' })).toBe('accountId=acc-1');
    expect(buildReconciliationQuery({
      accountId: 'acc-1',
      month: 5,
      year: 2026,
      start: '2026-05-01',
      end: '2026-06-01',
    })).toBe('accountId=acc-1&month=5&year=2026&start=2026-05-01&end=2026-06-01');
  });
});
