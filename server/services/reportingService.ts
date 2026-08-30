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

type InternalBreakdownItem = {
  label: string;
  amountMinor: bigint;
  transactionCount: number;
};

const toMinorBigInt = (value: bigint | number | string): bigint => {
  if (typeof value === 'bigint') {
    return value;
  }
  if (typeof value === 'number' && Number.isSafeInteger(value)) {
    return BigInt(value);
  }
  if (typeof value === 'string' && /^-?\d+$/.test(value.trim())) {
    return BigInt(value.trim());
  }
  return 0n;
};

const toSafeNumber = (value: bigint): number => {
  const converted = Number(value);
  if (!Number.isSafeInteger(converted)) {
    throw new Error('Rapportbedrag valt buiten het exact representeerbare numerieke bereik.');
  }
  return converted;
};

const signedMinor = (transaction: Pick<ReportTransaction, 'amountMinor' | 'direction'>): bigint => {
  const rawAmount = toMinorBigInt(transaction.amountMinor);
  const amount = rawAmount < 0n ? -rawAmount : rawAmount;
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

const sortBreakdown = (items: Map<string, InternalBreakdownItem>): ReportBreakdownItem[] =>
  Array.from(items.values())
    .sort((a, b) => (b.amountMinor === a.amountMinor
      ? a.label.localeCompare(b.label, 'nl')
      : b.amountMinor > a.amountMinor ? 1 : -1))
    .map((item) => ({ ...item, amountMinor: toSafeNumber(item.amountMinor) }));

export const buildPeriodReportSummary = (
  transactions: ReportTransaction[],
  period: { year: number; month?: number | null },
  options: { openingBalanceMinor?: bigint | number | string } = {},
): PeriodReportSummary => {
  const incomeByCategory = new Map<string, InternalBreakdownItem>();
  const expensesByCategory = new Map<string, InternalBreakdownItem>();
  let incomeMinor = 0n;
  let expenseMinor = 0n;

  const matchingTransactions = transactions.filter((transaction) => {
    const year = transaction.date.getUTCFullYear();
    const month = transaction.date.getUTCMonth() + 1;
    if (year !== period.year) return false;
    if (period.month && month !== period.month) return false;
    return true;
  });

  matchingTransactions.forEach((transaction) => {
    const rawAmount = toMinorBigInt(transaction.amountMinor);
    const amount = rawAmount < 0n ? -rawAmount : rawAmount;
    const label = getCategoryLabel(transaction);
    const target = transaction.direction === 'debit' ? expensesByCategory : incomeByCategory;
    const existing = target.get(label) ?? {
      label,
      amountMinor: 0n,
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

  const netMinor = incomeMinor - expenseMinor;

  return {
    period: {
      year: period.year,
      month: period.month ?? null,
    },
    openingBalanceMinor: toSafeNumber(toMinorBigInt(options.openingBalanceMinor ?? 0)),
    closingBalanceMinor: toSafeNumber(toMinorBigInt(options.openingBalanceMinor ?? 0) + netMinor),
    incomeMinor: toSafeNumber(incomeMinor),
    expenseMinor: toSafeNumber(expenseMinor),
    netMinor: toSafeNumber(netMinor),
    transactionCount: matchingTransactions.length,
    incomeByCategory: sortBreakdown(incomeByCategory),
    expensesByCategory: sortBreakdown(expensesByCategory),
  };
};

export const calculateOpeningBalanceMinor = (
  openingBalanceMinor: bigint | number | string | null | undefined,
  transactionsBeforePeriod: Array<Pick<ReportTransaction, 'amountMinor' | 'direction'>>,
): number => {
  const opening = toMinorBigInt(openingBalanceMinor ?? 0);
  const movement = transactionsBeforePeriod.reduce((sum, transaction) => sum + signedMinor(transaction), 0n);
  return toSafeNumber(opening + movement);
};
