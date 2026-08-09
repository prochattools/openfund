import { describe, it, expect } from 'vitest';
import {
  formatDutchMonthYear,
  formatReportSubject,
  formatReportTitle,
} from '../../server/utils/dutchPeriodFormatter';

describe('formatDutchMonthYear', () => {
  it('returns Januari 2026 for month 1', () => {
    expect(formatDutchMonthYear(2026, 1)).toBe('Januari 2026');
  });

  it('returns Juni 2026 for month 6', () => {
    expect(formatDutchMonthYear(2026, 6)).toBe('Juni 2026');
  });

  it('returns December 2026 for month 12', () => {
    expect(formatDutchMonthYear(2026, 12)).toBe('December 2026');
  });

  it('returns Augustus 2025 for month 8', () => {
    expect(formatDutchMonthYear(2025, 8)).toBe('Augustus 2025');
  });

  it('throws for invalid month 0', () => {
    expect(() => formatDutchMonthYear(2026, 0)).toThrow();
  });

  it('throws for invalid month 13', () => {
    expect(() => formatDutchMonthYear(2026, 13)).toThrow();
  });
});

describe('formatReportSubject', () => {
  it('returns correct subject for June 2026', () => {
    expect(formatReportSubject(2026, 6)).toBe('Maandrapport Juni 2026');
  });

  it('returns correct subject for January 2026', () => {
    expect(formatReportSubject(2026, 1)).toBe('Maandrapport Januari 2026');
  });
});

describe('formatReportTitle', () => {
  it('returns correct HTML title for June 2026', () => {
    expect(formatReportTitle(2026, 6)).toBe('Financieel Rapport — Juni 2026');
  });

  it('returns correct HTML title for December 2026', () => {
    expect(formatReportTitle(2026, 12)).toBe('Financieel Rapport — December 2026');
  });
});
