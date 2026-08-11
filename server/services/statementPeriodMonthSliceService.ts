import type { StatementCoverageStatus } from '@prisma/client';

export type StatementPeriodSliceTransaction = {
  date: Date;
  amountMinor: bigint | string | number;
  direction: 'credit' | 'debit';
};

export type StatementPeriodSliceSource = {
  periodStart: Date;
  periodEnd: Date;
  coverageStatus: StatementCoverageStatus;
  openingBalanceMinor: bigint | string | number;
  incomeMinor: bigint | string | number;
  expenseMinor: bigint | string | number;
  closingBalanceMinor: bigint | string | number;
  transactionCount: number;
};

export type StatementPeriodMonthSlice = {
  periodStart: Date;
  periodEnd: Date;
  coverageStatus: StatementCoverageStatus;
  openingBalanceMinor: bigint;
  incomeMinor: bigint;
  expenseMinor: bigint;
  closingBalanceMinor: bigint;
  transactionCount: number;
  sourcePeriodStart: Date;
  sourcePeriodEnd: Date;
  sourceCoverageStatus: StatementCoverageStatus;
  derivedFromMultiMonthSource: boolean;
};

const toBigInt = (value: bigint | string | number): bigint => BigInt(value);
const abs = (value: bigint): bigint => (value < 0n ? -value : value);

export const calendarMonthBounds = (year: number, month: number) => ({
  start: new Date(Date.UTC(year, month - 1, 1)),
  end: new Date(Date.UTC(year, month, 0)),
});

const toUTCDate = (d: Date): number => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());

export const statementPeriodFullyCoversMonth = (
  periodStart: Date,
  periodEnd: Date,
  year: number,
  month: number,
): boolean => {
  const bounds = calendarMonthBounds(year, month);
  return toUTCDate(periodStart) <= bounds.start.getTime() && toUTCDate(periodEnd) >= bounds.end.getTime();
};

export const buildStatementPeriodMonthSlice = (params: {
  source: StatementPeriodSliceSource;
  year: number;
  month: number;
  transactions: StatementPeriodSliceTransaction[];
}): StatementPeriodMonthSlice => {
  const bounds = calendarMonthBounds(params.year, params.month);
  const source = params.source;
  const exactMonth = toUTCDate(source.periodStart) === bounds.start.getTime()
    && toUTCDate(source.periodEnd) === bounds.end.getTime();

  if (exactMonth) {
    return {
      periodStart: bounds.start,
      periodEnd: bounds.end,
      coverageStatus: source.coverageStatus,
      openingBalanceMinor: toBigInt(source.openingBalanceMinor),
      incomeMinor: toBigInt(source.incomeMinor),
      expenseMinor: toBigInt(source.expenseMinor),
      closingBalanceMinor: toBigInt(source.closingBalanceMinor),
      transactionCount: source.transactionCount,
      sourcePeriodStart: source.periodStart,
      sourcePeriodEnd: source.periodEnd,
      sourceCoverageStatus: source.coverageStatus,
      derivedFromMultiMonthSource: false,
    };
  }

  const fullyCovered = statementPeriodFullyCoversMonth(source.periodStart, source.periodEnd, params.year, params.month);
  const sorted = [...params.transactions].sort((a, b) => a.date.getTime() - b.date.getTime());
  let opening = toBigInt(source.openingBalanceMinor);
  let income = 0n;
  let expense = 0n;
  let transactionCount = 0;

  const sourceStartDate = toUTCDate(source.periodStart);
  const sourceEndDate = toUTCDate(source.periodEnd);
  const monthStartDate = bounds.start.getTime();
  const monthEndDate = bounds.end.getTime();

  for (const tx of sorted) {
    const txDate = toUTCDate(tx.date);
    if (txDate < sourceStartDate || txDate > sourceEndDate) continue;
    const amount = abs(toBigInt(tx.amountMinor));
    const delta = tx.direction === 'credit' ? amount : -amount;
    if (txDate < monthStartDate) {
      opening += delta;
      continue;
    }
    if (txDate > monthEndDate) continue;
    if (tx.direction === 'credit') income += amount;
    else expense += amount;
    transactionCount += 1;
  }

  return {
    periodStart: bounds.start,
    periodEnd: bounds.end,
    coverageStatus: fullyCovered ? 'COMPLETE' : 'PARTIAL',
    openingBalanceMinor: opening,
    incomeMinor: income,
    expenseMinor: expense,
    closingBalanceMinor: opening + income - expense,
    transactionCount,
    sourcePeriodStart: source.periodStart,
    sourcePeriodEnd: source.periodEnd,
    sourceCoverageStatus: source.coverageStatus,
    derivedFromMultiMonthSource: true,
  };
};
