import { describe, expect, it } from 'vitest';
import {
  buildBreakdown,
  buildDashboardSummary,
  calculateMoneyFlowHeight,
  formatDashboardEuro,
  formatDashboardImportDate,
  getCategoryLabel,
  getLatestMonthKey,
  getMonthLabel,
  getTransactionDate,
  isDashboardPeriodReady,
} from '../../src/helpers/dashboard-summary';
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

describe('dashboard summary helpers', () => {
  it('uses safe dates and falls back to the provided current month when empty', () => {
    expect(getTransactionDate(makeTx({ date: 'geen datum' })).toISOString()).toBe('1970-01-01T00:00:00.000Z');
    expect(getLatestMonthKey([], new Date('2026-07-03T00:00:00.000Z'))).toBe('2026-07');
    expect(getLatestMonthKey([
      makeTx({ date: '2026-04-01T00:00:00.000Z' }),
      makeTx({ date: '2026-06-01T00:00:00.000Z' }),
    ])).toBe('2026-06');
  });

  it('builds Dutch month labels and display values for the dashboard UI', () => {
    expect(getMonthLabel('2026-05')).toBe('mei 2026');
    expect(formatDashboardEuro(1234.56)).toBe('€ 1.235');
    expect(formatDashboardImportDate(null)).toBe('nog niet afgerond');
    expect(formatDashboardImportDate('2026-05-15T12:30:00.000Z')).toContain('2026');
  });

  it('calculates money-flow bar heights and report readiness', () => {
    expect(calculateMoneyFlowHeight(50, 100)).toBe(85);
    expect(calculateMoneyFlowHeight(0, 100)).toBe(16);
    expect(calculateMoneyFlowHeight(250, 0)).toBe(42500);
    expect(isDashboardPeriodReady(3, 0)).toBe(true);
    expect(isDashboardPeriodReady(0, 0)).toBe(false);
    expect(isDashboardPeriodReady(3, 1)).toBe(false);
  });

  it('chooses category labels in the same priority order as the dashboard UI', () => {
    expect(getCategoryLabel(makeTx({ mainCategoryName: 'Inkomsten', categoryName: 'Giften' }))).toBe('Inkomsten');
    expect(getCategoryLabel(makeTx({ categoryName: 'Giften' }))).toBe('Giften');
    expect(getCategoryLabel(makeTx({ suggestedSubCategoryName: 'Bankkosten' }))).toBe('Bankkosten');
    expect(getCategoryLabel(makeTx({}))).toBe('Nog te beoordelen');
  });

  it('builds sorted income and expense breakdowns with shares', () => {
    const transactions = [
      makeTx({ id: 'gift-1', amount: 100, mainCategoryName: 'Giften' }),
      makeTx({ id: 'gift-2', amount: 50, mainCategoryName: 'Giften' }),
      makeTx({ id: 'rent', amount: -60, mainCategoryName: 'Huur' }),
      makeTx({ id: 'bank', amount: -40, mainCategoryName: 'Bankkosten' }),
    ];

    expect(buildBreakdown(transactions, 'income')).toEqual([
      { label: 'Giften', amount: 150, share: 1 },
    ]);
    expect(buildBreakdown(transactions, 'expense')).toEqual([
      { label: 'Huur', amount: 60, share: 0.6 },
      { label: 'Bankkosten', amount: 40, share: 0.4 },
    ]);
  });

  it('builds the current dashboard summary for the latest month only', () => {
    const transactions = [
      makeTx({ id: 'old', date: '2026-04-20T00:00:00.000Z', amount: 999, mainCategoryName: 'Oud' }),
      makeTx({ id: 'income', date: '2026-05-01T00:00:00.000Z', amount: 200, mainCategoryName: 'Giften', autoCategorized: true }),
      makeTx({ id: 'expense', date: '2026-05-02T00:00:00.000Z', amount: -75, mainCategoryName: 'Huur', needsManualCategory: true }),
    ];

    expect(buildDashboardSummary(transactions)).toMatchObject({
      monthKey: '2026-05',
      monthLabel: 'mei 2026',
      income: 200,
      expenses: 75,
      net: 125,
      reviewCount: 1,
      autoCategorized: 1,
      reportHref: '/reports?year=2026&month=5',
    });
  });
});
