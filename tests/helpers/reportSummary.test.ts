import { describe, expect, it } from 'vitest';
import {
  buildLocalReportSummary,
  formatEuroMinor,
  getPeriodReviewCount,
  getPeriodTransactions,
  getReportBreakdownShare,
  getReportBreakdownTotal,
  getReportCategoryLabel,
  getReportPeriodLabel,
  getReportYears,
  normalizeInitialReportPeriod,
  parseReportDate,
  toMinor,
} from '../../src/helpers/report-summary';
import type { LedgerTransaction } from '../../src/helpers/api-transaction-mapper';

const makeTx = (overrides: Partial<LedgerTransaction>): LedgerTransaction => ({
  id: 'tx-default',
  date: '2026-05-15T00:00:00.000Z',
  description: 'Test',
  amount: 0,
  direction: 'credit',
  source: 'Test',
  accountLabel: null,
  accountIdentifier: null,
  normalizedKey: 'test',
  notificationDetail: null,
  counterpartyAccount: null,
  categoryId: null,
  categoryName: null,
  mainCategoryId: null,
  mainCategoryName: null,
  ledgerMonth: 5,
  ledgerYear: 2026,
  createdAt: '2026-05-15T00:00:00.000Z',
  autoCategorized: false,
  needsManualCategory: false,
  ...overrides,
});

describe('report summary helpers', () => {
  it('formats cents as Dutch euro amounts and parses invalid dates safely', () => {
    expect(formatEuroMinor(123456)).toBe('€ 1.234,56');
    expect(parseReportDate('geen datum').toISOString()).toBe('1970-01-01T00:00:00.000Z');
    expect(toMinor(-12.345)).toBe(1235);
  });

  it('filters transactions by year and optional month', () => {
    const transactions = [
      makeTx({ id: 'may', date: '2026-05-01T00:00:00.000Z' }),
      makeTx({ id: 'june', date: '2026-06-01T00:00:00.000Z' }),
      makeTx({ id: 'old', date: '2025-05-01T00:00:00.000Z' }),
    ];

    expect(getPeriodTransactions(transactions, 2026, null).map((tx) => tx.id)).toEqual(['may', 'june']);
    expect(getPeriodTransactions(transactions, 2026, 5).map((tx) => tx.id)).toEqual(['may']);
  });

  it('chooses report category labels in priority order', () => {
    expect(getReportCategoryLabel(makeTx({ mainCategoryName: 'Inkomsten', categoryName: 'Giften' }))).toBe('Inkomsten');
    expect(getReportCategoryLabel(makeTx({ categoryName: 'Giften' }))).toBe('Giften');
    expect(getReportCategoryLabel(makeTx({ suggestedMainCategoryName: 'Voorgesteld' }))).toBe('Voorgesteld');
    expect(getReportCategoryLabel(makeTx({}))).toBe('Niet gecategoriseerd');
  });

  it('builds local report summaries with sorted category breakdowns', () => {
    const transactions = [
      makeTx({ id: 'gift-1', amount: 100.25, mainCategoryName: 'Giften' }),
      makeTx({ id: 'gift-2', amount: 50, mainCategoryName: 'Giften' }),
      makeTx({ id: 'rent', amount: -60, mainCategoryName: 'Huur' }),
      makeTx({ id: 'bank', amount: -40, mainCategoryName: 'Bankkosten' }),
      makeTx({ id: 'other-year', date: '2025-05-01T00:00:00.000Z', amount: 999, mainCategoryName: 'Oud' }),
    ];

    expect(buildLocalReportSummary(transactions, 2026, 5)).toEqual({
      period: { year: 2026, month: 5 },
      openingBalanceMinor: 0,
      closingBalanceMinor: 5025,
      incomeMinor: 15025,
      expenseMinor: 10000,
      netMinor: 5025,
      transactionCount: 4,
      incomeByCategory: [{ label: 'Giften', amountMinor: 15025, transactionCount: 2 }],
      expensesByCategory: [
        { label: 'Huur', amountMinor: 6000, transactionCount: 1 },
        { label: 'Bankkosten', amountMinor: 4000, transactionCount: 1 },
      ],
    });
  });

  it('derives available years and normalizes initial period selections', () => {
    const transactions = [
      makeTx({ date: '2026-05-01T00:00:00.000Z' }),
      makeTx({ date: '2024-05-01T00:00:00.000Z' }),
      makeTx({ date: 'geen datum' }),
    ];

    expect(getReportYears(transactions)).toEqual([2026, 2024, 1970]);
    expect(getReportYears([], new Date('2027-01-01T00:00:00.000Z'))).toEqual([2027]);
    expect(normalizeInitialReportPeriod([2026], 2025, 12)).toEqual({ year: 2025, month: 12 });
    expect(normalizeInitialReportPeriod([2026], 1999, 13)).toEqual({ year: 2026, month: null });
  });

  it('builds Dutch period labels for month and year reports', () => {
    expect(getReportPeriodLabel(2026, 5)).toBe('mei 2026');
    expect(getReportPeriodLabel(2026, null)).toBe('2026');
  });

  it('calculates report breakdown shares and period review counts', () => {
    const items = [
      { label: 'Giften', amountMinor: 7500, transactionCount: 2 },
      { label: 'Collecte', amountMinor: 2500, transactionCount: 1 },
    ];
    const transactions = [
      makeTx({ id: 'review', date: '2026-05-01T00:00:00.000Z', needsManualCategory: true }),
      makeTx({ id: 'done', date: '2026-05-02T00:00:00.000Z', needsManualCategory: false }),
      makeTx({ id: 'other-month', date: '2026-06-01T00:00:00.000Z', needsManualCategory: true }),
    ];

    expect(getReportBreakdownTotal(items)).toBe(10000);
    expect(getReportBreakdownShare(items[0], 10000)).toBe(0.75);
    expect(getReportBreakdownShare(items[0], 0)).toBe(0);
    expect(getPeriodReviewCount(transactions, 2026, 5)).toBe(1);
    expect(getPeriodReviewCount(transactions, 2026, null)).toBe(2);
  });
});
