export type ReportTransaction = {
  date: Date;
  amountMinor: bigint | number | string;
  direction: 'credit' | 'debit';
  categoryName?: string | null;
  mainCategoryName?: string | null;
  projectName?: string | null;
};

export type ReportBreakdownItem = {
  label: string;
  amountMinor: number;
  transactionCount: number;
};

export type PeriodReportSummary = {
  period: {
    year: number;
    month: number | null;
  };
  openingBalanceMinor: number;
  closingBalanceMinor: number;
  incomeMinor: number;
  expenseMinor: number;
  netMinor: number;
  transactionCount: number;
  incomeByCategory: ReportBreakdownItem[];
  expensesByCategory: ReportBreakdownItem[];
};

const toMinorNumber = (value: bigint | number | string): number => {
  if (typeof value === 'bigint') {
    return Number(value);
  }
  if (typeof value === 'number') {
    return value;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const signedMinor = (transaction: Pick<ReportTransaction, 'amountMinor' | 'direction'>): number => {
  const amount = Math.abs(toMinorNumber(transaction.amountMinor));
  return transaction.direction === 'debit' ? -amount : amount;
};

const getCategoryLabel = (transaction: ReportTransaction): string => {
  return (
    transaction.mainCategoryName?.trim() ||
    transaction.categoryName?.trim() ||
    transaction.projectName?.trim() ||
    'Niet gecategoriseerd'
  );
};

const sortBreakdown = (items: Map<string, ReportBreakdownItem>) =>
  Array.from(items.values()).sort((a, b) => b.amountMinor - a.amountMinor || a.label.localeCompare(b.label, 'nl'));

export const buildPeriodReportSummary = (
  transactions: ReportTransaction[],
  period: { year: number; month?: number | null },
  options: { openingBalanceMinor?: bigint | number | string } = {},
): PeriodReportSummary => {
  const incomeByCategory = new Map<string, ReportBreakdownItem>();
  const expensesByCategory = new Map<string, ReportBreakdownItem>();
  let incomeMinor = 0;
  let expenseMinor = 0;

  const matchingTransactions = transactions.filter((transaction) => {
    const year = transaction.date.getUTCFullYear();
    const month = transaction.date.getUTCMonth() + 1;
    if (year !== period.year) return false;
    if (period.month && month !== period.month) return false;
    return true;
  });

  matchingTransactions.forEach((transaction) => {
    const amount = Math.abs(toMinorNumber(transaction.amountMinor));
    const label = getCategoryLabel(transaction);
    const target = transaction.direction === 'debit' ? expensesByCategory : incomeByCategory;
    const existing = target.get(label) ?? {
      label,
      amountMinor: 0,
      transactionCount: 0,
    };
    existing.amountMinor += amount;
    existing.transactionCount += 1;
    target.set(label, existing);

    if (transaction.direction === 'debit') {
      expenseMinor += amount;
    } else {
      incomeMinor += amount;
    }
  });

  const openingBalanceMinor = toMinorNumber(options.openingBalanceMinor ?? 0);
  const netMinor = incomeMinor - expenseMinor;

  return {
    period: {
      year: period.year,
      month: period.month ?? null,
    },
    openingBalanceMinor,
    closingBalanceMinor: openingBalanceMinor + netMinor,
    incomeMinor,
    expenseMinor,
    netMinor,
    transactionCount: matchingTransactions.length,
    incomeByCategory: sortBreakdown(incomeByCategory),
    expensesByCategory: sortBreakdown(expensesByCategory),
  };
};

export const calculateOpeningBalanceMinor = (
  openingBalanceMinor: bigint | number | string | null | undefined,
  transactionsBeforePeriod: Array<Pick<ReportTransaction, 'amountMinor' | 'direction'>>,
): number => {
  const opening = toMinorNumber(openingBalanceMinor ?? 0);
  const movement = transactionsBeforePeriod.reduce((sum, transaction) => sum + signedMinor(transaction), 0);
  return opening + movement;
};
