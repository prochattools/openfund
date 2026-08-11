import { describe, expect, it } from 'vitest';
import { buildStatementPeriodMonthSlice } from '../../server/services/statementPeriodMonthSliceService';

const tx = (date: string, amountMinor: bigint, direction: 'credit' | 'debit') => ({
  date: new Date(`${date}T00:00:00.000Z`),
  amountMinor,
  direction,
});

describe('statementPeriodMonthSliceService', () => {
  it('preserves authoritative controls for an exact monthly source', () => {
    const slice = buildStatementPeriodMonthSlice({
      source: {
        periodStart: new Date('2026-07-01T00:00:00.000Z'),
        periodEnd: new Date('2026-07-31T00:00:00.000Z'),
        coverageStatus: 'COMPLETE',
        openingBalanceMinor: 941224n,
        incomeMinor: 1076751n,
        expenseMinor: 943315n,
        closingBalanceMinor: 1074660n,
        transactionCount: 37,
      },
      year: 2026,
      month: 7,
      transactions: [],
    });

    expect(slice).toMatchObject({
      coverageStatus: 'COMPLETE',
      openingBalanceMinor: 941224n,
      incomeMinor: 1076751n,
      expenseMinor: 943315n,
      closingBalanceMinor: 1074660n,
      transactionCount: 37,
      derivedFromMultiMonthSource: false,
    });
  });

  it('treats periodEnd 23:59:59 as same calendar end date (boundary regression)', () => {
    const slice = buildStatementPeriodMonthSlice({
      source: {
        periodStart: new Date('2026-01-01T00:00:00.000Z'),
        periodEnd: new Date('2026-01-31T23:59:59.000Z'),
        coverageStatus: 'COMPLETE',
        openingBalanceMinor: 100000n,
        incomeMinor: 8000n,
        expenseMinor: 3000n,
        closingBalanceMinor: 105000n,
        transactionCount: 3,
      },
      year: 2026,
      month: 1,
      transactions: [],
    });

    expect(slice.derivedFromMultiMonthSource).toBe(false);
    expect(slice.coverageStatus).toBe('COMPLETE');
    expect(slice.openingBalanceMinor).toBe(100000n);
    expect(slice.incomeMinor).toBe(8000n);
    expect(slice.expenseMinor).toBe(3000n);
    expect(slice.closingBalanceMinor).toBe(105000n);
    expect(slice.transactionCount).toBe(3);
  });

  it('derives a complete calendar month from a longer partial/open source', () => {
    const transactions = [
      tx('2026-01-05', 50000n, 'credit'),
      tx('2026-01-20', -20000n, 'debit'),
      tx('2026-02-02', 10000n, 'credit'),
      tx('2026-02-12', -2500n, 'debit'),
      tx('2026-02-28', -7500n, 'debit'),
      tx('2026-03-01', 100n, 'credit'),
    ];

    const slice = buildStatementPeriodMonthSlice({
      source: {
        periodStart: new Date('2026-01-01T00:00:00.000Z'),
        periodEnd: new Date('2026-03-01T00:00:00.000Z'),
        coverageStatus: 'PARTIAL',
        openingBalanceMinor: 100000n,
        incomeMinor: 60100n,
        expenseMinor: 30000n,
        closingBalanceMinor: 130100n,
        transactionCount: 6,
      },
      year: 2026,
      month: 2,
      transactions,
    });

    expect(slice.coverageStatus).toBe('COMPLETE');
    expect(slice.openingBalanceMinor).toBe(130000n);
    expect(slice.incomeMinor).toBe(10000n);
    expect(slice.expenseMinor).toBe(10000n);
    expect(slice.closingBalanceMinor).toBe(130000n);
    expect(slice.transactionCount).toBe(3);
    expect(slice.derivedFromMultiMonthSource).toBe(true);
  });

  it('keeps the trailing incomplete month partial', () => {
    const slice = buildStatementPeriodMonthSlice({
      source: {
        periodStart: new Date('2026-01-01T00:00:00.000Z'),
        periodEnd: new Date('2026-07-01T00:00:00.000Z'),
        coverageStatus: 'PARTIAL',
        openingBalanceMinor: 100000n,
        incomeMinor: 0n,
        expenseMinor: 0n,
        closingBalanceMinor: 100000n,
        transactionCount: 1,
      },
      year: 2026,
      month: 7,
      transactions: [tx('2026-07-01', 100n, 'credit')],
    });

    expect(slice.coverageStatus).toBe('PARTIAL');
    expect(slice.transactionCount).toBe(1);
    expect(slice.periodStart.toISOString().slice(0, 10)).toBe('2026-07-01');
    expect(slice.periodEnd.toISOString().slice(0, 10)).toBe('2026-07-31');
  });

  it('full interior month from multi-month source is COMPLETE', () => {
    const transactions = [
      tx('2026-01-05', 10000n, 'credit'),
      tx('2026-02-10', 5000n, 'credit'),
      tx('2026-02-28', 2000n, 'debit'),
      tx('2026-03-15', 1000n, 'credit'),
    ];

    const slice = buildStatementPeriodMonthSlice({
      source: {
        periodStart: new Date('2026-01-01T00:00:00.000Z'),
        periodEnd: new Date('2026-03-31T00:00:00.000Z'),
        coverageStatus: 'PARTIAL',
        openingBalanceMinor: 50000n,
        incomeMinor: 16000n,
        expenseMinor: 2000n,
        closingBalanceMinor: 64000n,
        transactionCount: 4,
      },
      year: 2026,
      month: 2,
      transactions,
    });

    expect(slice.coverageStatus).toBe('COMPLETE');
    expect(slice.openingBalanceMinor).toBe(60000n);
    expect(slice.incomeMinor).toBe(5000n);
    expect(slice.expenseMinor).toBe(2000n);
    expect(slice.closingBalanceMinor).toBe(63000n);
    expect(slice.transactionCount).toBe(2);
    expect(slice.derivedFromMultiMonthSource).toBe(true);
  });

  it('does not exclude last-day-of-month transactions with non-midnight timestamps', () => {
    const transactions = [
      tx('2026-01-31', 3000n, 'debit'),
    ];

    const slice = buildStatementPeriodMonthSlice({
      source: {
        periodStart: new Date('2026-01-01T00:00:00.000Z'),
        periodEnd: new Date('2026-01-31T23:59:59.000Z'),
        coverageStatus: 'COMPLETE',
        openingBalanceMinor: 10000n,
        incomeMinor: 0n,
        expenseMinor: 3000n,
        closingBalanceMinor: 7000n,
        transactionCount: 1,
      },
      year: 2026,
      month: 1,
      transactions,
    });

    expect(slice.derivedFromMultiMonthSource).toBe(false);
    expect(slice.transactionCount).toBe(1);
    expect(slice.expenseMinor).toBe(3000n);
  });
});
