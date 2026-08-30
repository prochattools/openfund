import { describe, expect, it } from 'vitest';
import { buildPeriodReportSummary, calculateOpeningBalanceMinor } from '../../server/services/reportingService';

describe('reporting service', () => {
  it('builds monthly income and expense summaries by category', () => {
    const summary = buildPeriodReportSummary(
      [
        {
          date: new Date('2026-04-01T00:00:00.000Z'),
          amountMinor: 10000n,
          direction: 'credit',
          mainCategoryName: 'Giften',
        },
        {
          date: new Date('2026-04-02T00:00:00.000Z'),
          amountMinor: 2500n,
          direction: 'debit',
          mainCategoryName: 'Administratie',
        },
        {
          date: new Date('2026-05-01T00:00:00.000Z'),
          amountMinor: 5000n,
          direction: 'credit',
          mainCategoryName: 'Giften',
        },
      ],
      { year: 2026, month: 4 },
      { openingBalanceMinor: 42000 },
    );

    expect(summary.transactionCount).toBe(2);
    expect(summary.openingBalanceMinor).toBe(42000);
    expect(summary.incomeMinor).toBe(10000);
    expect(summary.expenseMinor).toBe(2500);
    expect(summary.netMinor).toBe(7500);
    expect(summary.closingBalanceMinor).toBe(49500);
    expect(summary.incomeByCategory).toEqual([
      { label: 'Giften', amountMinor: 10000, transactionCount: 1 },
    ]);
    expect(summary.expensesByCategory).toEqual([
      { label: 'Administratie', amountMinor: 2500, transactionCount: 1 },
    ]);
  });

  it('builds yearly summaries when no month is provided', () => {
    const summary = buildPeriodReportSummary(
      [
        {
          date: new Date('2026-01-01T00:00:00.000Z'),
          amountMinor: 10000,
          direction: 'credit',
          categoryName: 'Giften',
        },
        {
          date: new Date('2026-12-31T00:00:00.000Z'),
          amountMinor: '4000',
          direction: 'debit',
          categoryName: 'Projecten',
        },
      ],
      { year: 2026 },
    );

    expect(summary.period).toEqual({ year: 2026, month: null });
    expect(summary.openingBalanceMinor).toBe(0);
    expect(summary.incomeMinor).toBe(10000);
    expect(summary.expenseMinor).toBe(4000);
    expect(summary.netMinor).toBe(6000);
    expect(summary.closingBalanceMinor).toBe(6000);
  });

  it('calculates opening balance from previous movement', () => {
    const opening = calculateOpeningBalanceMinor(100000, [
      { amountMinor: 25000, direction: 'credit' },
      { amountMinor: 10000, direction: 'debit' },
    ]);

    expect(opening).toBe(115000);
  });

  it('falls back through category, project, and uncategorized labels', () => {
    const summary = buildPeriodReportSummary(
      [
        {
          date: new Date('2026-04-01T00:00:00.000Z'),
          amountMinor: 1000,
          direction: 'credit',
          mainCategoryName: ' ',
          categoryName: 'Giften',
        },
        {
          date: new Date('2026-04-02T00:00:00.000Z'),
          amountMinor: 2000,
          direction: 'credit',
          categoryName: ' ',
          projectName: 'Zending',
        },
        {
          date: new Date('2026-04-03T00:00:00.000Z'),
          amountMinor: 3000,
          direction: 'credit',
        },
      ],
      { year: 2026, month: 4 },
    );

    expect(summary.incomeByCategory).toEqual([
      { label: 'Niet gecategoriseerd', amountMinor: 3000, transactionCount: 1 },
      { label: 'Zending', amountMinor: 2000, transactionCount: 1 },
      { label: 'Giften', amountMinor: 1000, transactionCount: 1 },
    ]);
  });

  it('sorts equal breakdown totals by Dutch label order', () => {
    const summary = buildPeriodReportSummary(
      [
        {
          date: new Date('2026-04-01T00:00:00.000Z'),
          amountMinor: 1000,
          direction: 'debit',
          mainCategoryName: 'Zorg',
        },
        {
          date: new Date('2026-04-02T00:00:00.000Z'),
          amountMinor: 1000,
          direction: 'debit',
          mainCategoryName: 'Administratie',
        },
      ],
      { year: 2026, month: 4 },
    );

    expect(summary.expensesByCategory.map((item) => item.label)).toEqual(['Administratie', 'Zorg']);
  });

  it('returns a balanced empty report when no transactions match the period', () => {
    const summary = buildPeriodReportSummary(
      [
        {
          date: new Date('2026-03-31T00:00:00.000Z'),
          amountMinor: 5000,
          direction: 'credit',
          categoryName: 'Giften',
        },
      ],
      { year: 2026, month: 4 },
      { openingBalanceMinor: '12500' },
    );

    expect(summary).toEqual({
      period: { year: 2026, month: 4 },
      openingBalanceMinor: 12500,
      closingBalanceMinor: 12500,
      incomeMinor: 0,
      expenseMinor: 0,
      netMinor: 0,
      transactionCount: 0,
      incomeByCategory: [],
      expensesByCategory: [],
    });
  });

  it('treats non-numeric report amounts as zero instead of crashing', () => {
    const summary = buildPeriodReportSummary(
      [
        {
          date: new Date('2026-04-01T00:00:00.000Z'),
          amountMinor: 'geen bedrag',
          direction: 'credit',
          categoryName: 'Giften',
        },
      ],
      { year: 2026, month: 4 },
    );

    expect(summary.transactionCount).toBe(1);
    expect(summary.incomeMinor).toBe(0);
    expect(summary.incomeByCategory).toEqual([
      { label: 'Giften', amountMinor: 0, transactionCount: 1 },
    ]);
  });

  it('sums large minor-unit values with integer arithmetic before the safe API conversion', () => {
    const summary = buildPeriodReportSummary(
      [
        {
          date: new Date('2026-04-01T00:00:00.000Z'),
          amountMinor: 9007199254740000n,
          direction: 'credit',
          categoryName: 'Giften',
        },
        {
          date: new Date('2026-04-02T00:00:00.000Z'),
          amountMinor: 500n,
          direction: 'credit',
          categoryName: 'Giften',
        },
      ],
      { year: 2026, month: 4 },
    );

    expect(summary.incomeMinor).toBe(9007199254740500);
    expect(summary.incomeByCategory[0]?.amountMinor).toBe(9007199254740500);
  });
});
