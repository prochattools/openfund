import { describe, expect, it } from 'vitest';
import {
  getReportPeriodBounds,
  readReportMonth,
  readReportYear,
  splitReportCategoryLabel,
} from '../../server/routes/reports';

describe('report route helpers', () => {
  it('reads valid report years and falls back for invalid years', () => {
    expect(readReportYear('2026')).toBe(2026);
    expect(readReportYear('1999')).toBe(new Date().getUTCFullYear());
    expect(readReportYear('2101')).toBe(new Date().getUTCFullYear());
    expect(readReportYear('abc')).toBe(new Date().getUTCFullYear());
  });

  it('reads valid months and ignores invalid months', () => {
    expect(readReportMonth('1')).toBe(1);
    expect(readReportMonth('12')).toBe(12);
    expect(readReportMonth(undefined)).toBeNull();
    expect(readReportMonth('0')).toBeNull();
    expect(readReportMonth('13')).toBeNull();
  });

  it('builds month and year period bounds in UTC', () => {
    expect(getReportPeriodBounds(2026, 4)).toEqual({
      start: new Date(Date.UTC(2026, 3, 1)),
      end: new Date(Date.UTC(2026, 4, 1)),
    });
    expect(getReportPeriodBounds(2026, null)).toEqual({
      start: new Date(Date.UTC(2026, 0, 1)),
      end: new Date(Date.UTC(2027, 0, 1)),
    });
  });

  it('splits main and subcategory labels for reports', () => {
    expect(splitReportCategoryLabel('Inkomsten — Tienden')).toEqual({ main: 'Inkomsten', sub: 'Tienden' });
    expect(splitReportCategoryLabel('Bankkosten')).toEqual({ main: 'Bankkosten', sub: 'Bankkosten' });
    expect(splitReportCategoryLabel(null)).toEqual({ main: null, sub: null });
  });
});
