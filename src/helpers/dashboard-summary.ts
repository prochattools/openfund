import type { LedgerTransaction } from './api-transaction-mapper';

export type DashboardBreakdownItem = {
  label: string;
  amount: number;
  share: number;
};

export type DashboardSummary = {
  monthKey: string;
  monthLabel: string;
  monthTransactions: LedgerTransaction[];
  income: number;
  expenses: number;
  net: number;
  reviewCount: number;
  autoCategorized: number;
  incomeBreakdown: DashboardBreakdownItem[];
  expenseBreakdown: DashboardBreakdownItem[];
  reportHref: string;
};

const dashboardEuroFormatter = new Intl.NumberFormat('nl-NL', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
});

export const formatDashboardEuro = (value: number): string => dashboardEuroFormatter.format(value);

export const formatDashboardImportDate = (value: string | null): string => {
  if (!value) return 'nog niet afgerond';
  return new Date(value).toLocaleString('nl-NL');
};

export const calculateMoneyFlowHeight = (value: number, max: number, maxHeight = 170, minHeight = 16): number => {
  const safeMax = Math.max(max, 1);
  return Math.max((value / safeMax) * maxHeight, minHeight);
};

export const isDashboardPeriodReady = (total: number, reviewCount: number): boolean => total > 0 && reviewCount === 0;

export const getTransactionDate = (transaction: LedgerTransaction): Date => {
  const date = new Date(transaction.date);
  return Number.isNaN(date.getTime()) ? new Date(0) : date;
};

export const getLatestMonthKey = (
  transactions: LedgerTransaction[],
  now: Date = new Date(),
): string => {
  if (!transactions.length) {
    return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
  }

  const latest = transactions.reduce((current, transaction) => {
    const nextDate = getTransactionDate(transaction);
    return nextDate.getTime() > current.getTime() ? nextDate : current;
  }, getTransactionDate(transactions[0]!));

  return `${latest.getUTCFullYear()}-${String(latest.getUTCMonth() + 1).padStart(2, '0')}`;
};

export const getMonthLabel = (
  monthKey: string,
  formatter: Intl.DateTimeFormat = new Intl.DateTimeFormat('nl-NL', { month: 'long', year: 'numeric' }),
): string => {
  const [year, month] = monthKey.split('-').map(Number);
  return formatter.format(new Date(Date.UTC(year ?? 1970, (month ?? 1) - 1, 1)));
};

export const getCategoryLabel = (transaction: LedgerTransaction): string =>
  transaction.mainCategoryName ??
  transaction.categoryName ??
  transaction.suggestedMainCategoryName ??
  transaction.suggestedSubCategoryName ??
  'Nog te beoordelen';

export const buildBreakdown = (
  transactions: LedgerTransaction[],
  direction: 'income' | 'expense',
  limit = 5,
): DashboardBreakdownItem[] => {
  const filtered = transactions.filter((transaction) =>
    direction === 'income' ? transaction.amount > 0 : transaction.amount < 0,
  );
  const totals = new Map<string, number>();

  filtered.forEach((transaction) => {
    const label = getCategoryLabel(transaction);
    const amount = Math.abs(transaction.amount);
    totals.set(label, (totals.get(label) ?? 0) + amount);
  });

  const total = Array.from(totals.values()).reduce((sum, amount) => sum + amount, 0);

  return Array.from(totals.entries())
    .map(([label, amount]) => ({
      label,
      amount,
      share: total > 0 ? amount / total : 0,
    }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, limit);
};

export const buildDashboardSummary = (
  transactions: LedgerTransaction[],
  options: {
    now?: Date;
    monthFormatter?: Intl.DateTimeFormat;
  } = {},
): DashboardSummary => {
  const monthKey = getLatestMonthKey(transactions, options.now);
  const monthTransactions = transactions.filter((transaction) => {
    const date = getTransactionDate(transaction);
    const key = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
    return key === monthKey;
  });

  const income = monthTransactions
    .filter((transaction) => transaction.amount > 0)
    .reduce((sum, transaction) => sum + transaction.amount, 0);
  const expenses = monthTransactions
    .filter((transaction) => transaction.amount < 0)
    .reduce((sum, transaction) => sum + Math.abs(transaction.amount), 0);
  const reviewCount = monthTransactions.filter((transaction) => transaction.needsManualCategory).length;
  const autoCategorized = monthTransactions.filter((transaction) => transaction.autoCategorized).length;

  return {
    monthKey,
    monthLabel: getMonthLabel(monthKey, options.monthFormatter),
    monthTransactions,
    income,
    expenses,
    net: income - expenses,
    reviewCount,
    autoCategorized,
    incomeBreakdown: buildBreakdown(monthTransactions, 'income'),
    expenseBreakdown: buildBreakdown(monthTransactions, 'expense'),
    reportHref: `/reports?year=${monthKey.slice(0, 4)}&month=${Number(monthKey.slice(5, 7))}`,
  };
};
