import type { LedgerTransaction } from './api-transaction-mapper';

export type ReportBreakdownItem = {
  label: string;
  amountMinor: number;
  transactionCount: number;
};

export type ReportSummary = {
  period: { year: number; month: number | null };
  openingBalanceMinor: number;
  closingBalanceMinor: number;
  incomeMinor: number;
  expenseMinor: number;
  netMinor: number;
  transactionCount: number;
  incomeByCategory: ReportBreakdownItem[];
  expensesByCategory: ReportBreakdownItem[];
};

export const formatEuroMinor = (
  minor: number,
  formatter: Intl.NumberFormat = new Intl.NumberFormat('nl-NL', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 2,
  }),
): string => formatter.format(minor / 100);

export const parseReportDate = (value: string): Date => {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date(0) : parsed;
};

export const toMinor = (amount: number): number => Math.round(Math.abs(amount) * 100);

export const getReportCategoryLabel = (transaction: LedgerTransaction): string =>
  transaction.mainCategoryName ?? transaction.categoryName ?? transaction.suggestedMainCategoryName ?? 'Niet gecategoriseerd';

export const getPeriodTransactions = (
  transactions: LedgerTransaction[],
  year: number,
  month: number | null,
): LedgerTransaction[] =>
  transactions.filter((transaction) => {
    const date = parseReportDate(transaction.date);
    if (date.getUTCFullYear() !== year) return false;
    if (month && date.getUTCMonth() + 1 !== month) return false;
    return true;
  });

export const buildLocalReportSummary = (
  transactions: LedgerTransaction[],
  year: number,
  month: number | null,
): ReportSummary => {
  const incomeByCategory = new Map<string, ReportBreakdownItem>();
  const expensesByCategory = new Map<string, ReportBreakdownItem>();
  let incomeMinor = 0;
  let expenseMinor = 0;

  const matching = getPeriodTransactions(transactions, year, month);

  matching.forEach((transaction) => {
    const amountMinor = toMinor(transaction.amount);
    const label = getReportCategoryLabel(transaction);
    const target = transaction.amount < 0 ? expensesByCategory : incomeByCategory;
    const existing = target.get(label) ?? { label, amountMinor: 0, transactionCount: 0 };
    existing.amountMinor += amountMinor;
    existing.transactionCount += 1;
    target.set(label, existing);

    if (transaction.amount < 0) {
      expenseMinor += amountMinor;
    } else {
      incomeMinor += amountMinor;
    }
  });

  const sortItems = (items: Map<string, ReportBreakdownItem>) =>
    Array.from(items.values()).sort((a, b) => b.amountMinor - a.amountMinor || a.label.localeCompare(b.label, 'nl'));

  return {
    period: { year, month },
    incomeMinor,
    expenseMinor,
    netMinor: incomeMinor - expenseMinor,
    openingBalanceMinor: 0,
    closingBalanceMinor: incomeMinor - expenseMinor,
    transactionCount: matching.length,
    incomeByCategory: sortItems(incomeByCategory),
    expensesByCategory: sortItems(expensesByCategory),
  };
};

export const getReportYears = (
  transactions: LedgerTransaction[],
  now: Date = new Date(),
): number[] => {
  const values = Array.from(new Set(transactions.map((transaction) => parseReportDate(transaction.date).getUTCFullYear()))).sort((a, b) => b - a);
  return values.length ? values : [now.getUTCFullYear()];
};

export const normalizeInitialReportPeriod = (
  years: number[],
  initialYear?: number,
  initialMonth?: number | null,
  now: Date = new Date(),
): { year: number; month: number | null } => {
  const fallbackYear = years[0] ?? now.getUTCFullYear();
  const year = Number.isInteger(initialYear) && initialYear && initialYear > 2000 ? initialYear : fallbackYear;
  const month = Number.isInteger(initialMonth) && initialMonth && initialMonth >= 1 && initialMonth <= 12 ? initialMonth : null;

  return { year, month };
};

export const getReportPeriodLabel = (
  year: number,
  month: number | null,
  formatter: Intl.DateTimeFormat = new Intl.DateTimeFormat('nl-NL', { month: 'long', year: 'numeric' }),
): string => (month ? formatter.format(new Date(Date.UTC(year, month - 1, 1))) : String(year));

export const getReportBreakdownTotal = (items: ReportBreakdownItem[]): number =>
  items.reduce((sum, item) => sum + item.amountMinor, 0);

export const getReportBreakdownShare = (item: ReportBreakdownItem, totalMinor: number): number =>
  totalMinor > 0 ? item.amountMinor / totalMinor : 0;

export const getPeriodReviewCount = (
  transactions: LedgerTransaction[],
  year: number,
  month: number | null,
): number => getPeriodTransactions(transactions, year, month).filter((transaction) => transaction.needsManualCategory).length;
