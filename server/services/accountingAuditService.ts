import type { PrismaClient, StatementCoverageStatus, TransactionDirection } from '@prisma/client';
import {
  auditMonthlyReconciliations,
  type MonthlyAuditExpectedCoverage,
  type YearlyBaselineControl,
} from './monthlyReconciliationAuditService';
import {
  buildMonthlyReconciliation,
  type MonthlyReconciliationResult,
  type MonthlyReconciliationTransactionInput,
} from './monthlyReconciliationService';

export const ACCOUNTING_AUDIT_VERSION = 'accounting-audit-v1';
export const DEFAULT_ACCOUNTING_ACCOUNT_IDENTIFIER = 'NL89INGB0006369960';

export const APPROVED_ACCOUNTING_BASELINES: Record<number, YearlyBaselineControl> = {
  2024: {
    transactionCount: 268,
    openingMinor: '172186',
    incomeMinor: '3226719',
    expenseMinor: '2180490',
    closingMinor: '1218415',
  },
  2025: {
    transactionCount: 413,
    openingMinor: '1218415',
    incomeMinor: '9164244',
    expenseMinor: '9347573',
    closingMinor: '1035086',
  },
  2026: {
    transactionCount: 221,
    openingMinor: '1035086',
    incomeMinor: '5878408',
    expenseMinor: '6129769',
    closingMinor: '783725',
  },
};

export const APPROVED_ACCOUNTING_COVERAGE: MonthlyAuditExpectedCoverage = {
  2024: Array.from({ length: 12 }, (_, index) => index + 1),
  2025: Array.from({ length: 12 }, (_, index) => index + 1),
  2026: Array.from({ length: 7 }, (_, index) => index + 1),
};

type AccountingAuditDb = Pick<
  PrismaClient,
  'account' | 'openingBalance' | 'statementPeriod' | 'transaction'
>;

export type AccountingAuditTransaction = {
  id: string;
  date: Date;
  amountMinor: bigint;
  direction: TransactionDirection;
  importFingerprint: string | null;
  sourceFile: string | null;
  transactionBooking: {
    projectId: string;
    transactionTypeId: string;
    categoryId: string;
    literalProjectLabel: string;
    literalTypeLabel: string;
    literalCategoryLabel: string;
  } | null;
};

export type AccountingAuditStatementPeriod = {
  workspaceId: string;
  accountId: string;
  periodStart: Date;
  periodEnd: Date;
  coverageStatus: StatementCoverageStatus;
  openingBalanceMinor: bigint;
  closingBalanceMinor: bigint;
};

export type AccountingAuditBuildInput = {
  account: {
    id: string;
    identifier: string;
    name: string;
    currency: string;
  };
  transactions: AccountingAuditTransaction[];
  statementPeriods: AccountingAuditStatementPeriod[];
  openingBalance: {
    id: string;
    effectiveDate: Date;
    amountMinor: bigint;
    lockedAt: Date | null;
  } | null;
  expectedCoverage?: MonthlyAuditExpectedCoverage;
  baselineControls?: Record<number, YearlyBaselineControl>;
  validatorVersion?: string;
};

export type AccountingAuditStatus = 'PASSED' | 'FAILED' | 'BLOCKED';

export type AccountingAuditResult = {
  status: AccountingAuditStatus;
  cashStatus: 'PASSED' | 'FAILED';
  classificationStatus: 'PASSED' | 'PENDING';
  closeStatus: 'ELIGIBLE' | 'BLOCKED';
  validatorVersion: string;
  readOnly: true;
  account: {
    id: string;
    identifier: string;
    name: string;
    currency: string;
  };
  openingBalanceControl: {
    expectedMinor: string;
    actualMinor: string;
    differenceMinor: string;
    recordId: string | null;
    effectiveDate: string | null;
    locked: boolean;
  };
  totals: {
    transactionCount: number;
    unresolvedTransactionCount: number;
    duplicateFingerprintCount: number;
    runningBalanceErrorCount: number;
    cashDifferenceMinor: string;
    categoryIncomeDifferenceMinor: string;
    categoryExpenseDifferenceMinor: string;
  };
  months: MonthlyReconciliationResult[];
  yearSummaries: ReturnType<typeof auditMonthlyReconciliations>['yearSummaries'];
  issues: ReturnType<typeof auditMonthlyReconciliations>['issues'];
  sideEffects: {
    createsOpeningBalance: false;
    createsTransactionBooking: false;
    createsCategorizationSuggestion: false;
    closesPeriod: false;
    createsReportSnapshot: false;
  };
};

const monthKey = (year: number, month: number): string => `${year}-${String(month).padStart(2, '0')}`;

const getYearPeriod = (
  periods: AccountingAuditStatementPeriod[],
  year: number,
): AccountingAuditStatementPeriod | null => {
  const matches = periods
    .filter((period) => period.periodStart.getUTCFullYear() === year)
    .sort((left, right) => left.periodStart.getTime() - right.periodStart.getTime());
  if (matches.length === 0) return null;

  const first = matches[0]!;
  const last = matches[matches.length - 1]!;
  return {
    ...first,
    periodEnd: last.periodEnd,
    closingBalanceMinor: last.closingBalanceMinor,
    coverageStatus: matches.some((period) => period.coverageStatus === 'PARTIAL')
      ? 'PARTIAL'
      : first.coverageStatus,
  };
};

const groupTransactions = (transactions: AccountingAuditTransaction[]) => {
  const grouped = new Map<string, AccountingAuditTransaction[]>();
  for (const transaction of transactions) {
    const key = monthKey(transaction.date.getUTCFullYear(), transaction.date.getUTCMonth() + 1);
    const items = grouped.get(key) ?? [];
    items.push(transaction);
    grouped.set(key, items);
  }
  return grouped;
};

const sumMinor = (values: string[]): string =>
  values.reduce((total, value) => total + BigInt(value), 0n).toString();

export const buildAccountingAudit = (input: AccountingAuditBuildInput): AccountingAuditResult => {
  const expectedCoverage = input.expectedCoverage ?? APPROVED_ACCOUNTING_COVERAGE;
  const baselineControls = input.baselineControls ?? APPROVED_ACCOUNTING_BASELINES;
  const validatorVersion = input.validatorVersion ?? ACCOUNTING_AUDIT_VERSION;
  const grouped = groupTransactions(input.transactions);
  const years = Object.keys(expectedCoverage).map(Number).sort((left, right) => left - right);
  const openPeriodYears = input.statementPeriods
    .filter((period) => period.coverageStatus === 'PARTIAL')
    .map((period) => period.periodStart.getUTCFullYear());

  const firstYear = years[0];
  const expectedOpening = firstYear == null ? 0n : BigInt(baselineControls[firstYear]?.openingMinor ?? 0);
  const actualOpening = input.openingBalance?.amountMinor ?? 0n;
  let previousClosing: bigint | null = null;
  const months: MonthlyReconciliationResult[] = [];

  for (const year of years) {
    const yearPeriod = getYearPeriod(input.statementPeriods, year);
    const expectedMonths = [...(expectedCoverage[year] ?? [])].sort((left, right) => left - right);
    const finalMonth = expectedMonths[expectedMonths.length - 1] ?? null;

    for (const month of expectedMonths) {
      const transactions = grouped.get(monthKey(year, month)) ?? [];
      const openingMinor = previousClosing ?? actualOpening;
      const isPartialMonth = yearPeriod?.coverageStatus === 'PARTIAL'
        && yearPeriod.periodEnd.getUTCMonth() + 1 === month;
      const isFinalMonth = finalMonth === month;

      const result = buildMonthlyReconciliation({
        workspaceId: yearPeriod?.workspaceId ?? 'unknown-workspace',
        accountId: input.account.id,
        year,
        month,
        importedTransactions: transactions.map((transaction): MonthlyReconciliationTransactionInput => ({
          transactionId: transaction.id,
          date: transaction.date,
          amountMinor: transaction.amountMinor,
          direction: transaction.direction,
          resultingBalanceMinor: null,
          rawRow: null,
          importFingerprint: transaction.importFingerprint,
          duplicateFingerprint: transaction.importFingerprint,
          projectId: transaction.transactionBooking?.projectId ?? null,
          transactionTypeId: transaction.transactionBooking?.transactionTypeId ?? null,
          categoryId: transaction.transactionBooking?.categoryId ?? null,
          literalProjectLabel: transaction.transactionBooking?.literalProjectLabel ?? null,
          literalTypeLabel: transaction.transactionBooking?.literalTypeLabel ?? null,
          literalCategoryLabel: transaction.transactionBooking?.literalCategoryLabel ?? null,
          unresolved: transaction.transactionBooking == null,
          sourceFileHash: transaction.sourceFile,
        })),
        statementEvidence: {
          coverageStatus: isPartialMonth ? 'PARTIAL' : 'COMPLETE',
          openingBalanceMinor: openingMinor,
          closingBalanceMinor: isFinalMonth ? yearPeriod?.closingBalanceMinor ?? null : null,
          sourceFileHashes: Array.from(new Set(transactions.map((transaction) => transaction.sourceFile).filter((value): value is string => Boolean(value)))),
          periodStart: new Date(Date.UTC(year, month - 1, 1)),
          periodEnd: isPartialMonth && yearPeriod
            ? yearPeriod.periodEnd
            : new Date(Date.UTC(year, month, 0, 23, 59, 59, 999)),
        },
        validatorVersion: `${validatorVersion}-monthly`,
      });

      months.push(result);
      previousClosing = BigInt(result.closingBalanceMinor);
    }
  }

  const strictAudit = auditMonthlyReconciliations({
    months,
    expectedCoverage,
    baselineControls,
    validatorVersion,
    allowUnresolvedForPartial: true,
    openPeriodYears,
  });

  const openingDifference = actualOpening - expectedOpening;
  const duplicateFingerprintCount = months.reduce((total, month) => total + month.duplicateFingerprintCount, 0);
  const runningBalanceErrorCount = months.reduce((total, month) => total + month.runningBalanceErrorCount, 0);
  const unresolvedTransactionCount = months.reduce((total, month) => total + month.unresolvedTransactionCount, 0);
  const cashDifferenceMinor = sumMinor(months.map((month) => month.balanceDifferenceMinor));
  const categoryIncomeDifferenceMinor = sumMinor(months.map((month) => month.categoryIncomeDifferenceMinor));
  const categoryExpenseDifferenceMinor = sumMinor(months.map((month) => month.categoryExpenseDifferenceMinor));

  const everyMonthlyCashDifferenceIsZero = months.every(
    (month) => month.balanceDifferenceMinor === '0',
  );
  const expectedCoverageIsComplete = strictAudit.yearSummaries.length === years.length
    && strictAudit.yearSummaries.every(
      (summary) => summary.monthCount === (expectedCoverage[summary.year]?.length ?? 0),
    );
  const yearlyBaselinesMatch = strictAudit.yearSummaries.every((summary) => {
    const baseline = baselineControls[summary.year];
    if (!baseline) return true;
    return summary.transactionCount === baseline.transactionCount
      && summary.openingBalanceMinor === baseline.openingMinor
      && summary.incomeMinor === baseline.incomeMinor
      && summary.expenseMinor === baseline.expenseMinor
      && summary.closingBalanceMinor === baseline.closingMinor;
  });
  const cashStatus = openingDifference === 0n
    && everyMonthlyCashDifferenceIsZero
    && expectedCoverageIsComplete
    && yearlyBaselinesMatch
    && duplicateFingerprintCount === 0
    && runningBalanceErrorCount === 0
      ? 'PASSED'
      : 'FAILED';
  const classificationStatus = unresolvedTransactionCount === 0
    && categoryIncomeDifferenceMinor === '0'
    && categoryExpenseDifferenceMinor === '0'
      ? 'PASSED'
      : 'PENDING';
  const closeStatus = cashStatus === 'PASSED'
    && classificationStatus === 'PASSED'
    && months.every((month) => month.coverageStatus === 'COMPLETE' && month.closeEligible)
      ? 'ELIGIBLE'
      : 'BLOCKED';

  return {
    status: cashStatus === 'PASSED' && strictAudit.status === 'PASSED' ? 'PASSED' : 'FAILED',
    cashStatus,
    classificationStatus,
    closeStatus,
    validatorVersion,
    readOnly: true,
    account: input.account,
    openingBalanceControl: {
      expectedMinor: expectedOpening.toString(),
      actualMinor: actualOpening.toString(),
      differenceMinor: openingDifference.toString(),
      recordId: input.openingBalance?.id ?? null,
      effectiveDate: input.openingBalance?.effectiveDate.toISOString() ?? null,
      locked: Boolean(input.openingBalance?.lockedAt),
    },
    totals: {
      transactionCount: months.reduce((total, month) => total + month.transactionCount, 0),
      unresolvedTransactionCount,
      duplicateFingerprintCount,
      runningBalanceErrorCount,
      cashDifferenceMinor,
      categoryIncomeDifferenceMinor,
      categoryExpenseDifferenceMinor,
    },
    months,
    yearSummaries: strictAudit.yearSummaries,
    issues: strictAudit.issues,
    sideEffects: {
      createsOpeningBalance: false,
      createsTransactionBooking: false,
      createsCategorizationSuggestion: false,
      closesPeriod: false,
      createsReportSnapshot: false,
    },
  };
};

export const getAccountingAudit = async (
  db: AccountingAuditDb,
  options: { userId: string; accountIdentifier?: string },
): Promise<AccountingAuditResult | null> => {
  const accountIdentifier = options.accountIdentifier
    ?? process.env.ACCOUNTING_AUDIT_ACCOUNT_IDENTIFIER?.trim()
    ?? DEFAULT_ACCOUNTING_ACCOUNT_IDENTIFIER;
  const account = await db.account.findUnique({
    where: {
      userId_identifier: {
        userId: options.userId,
        identifier: accountIdentifier,
      },
    },
    select: { id: true, identifier: true, name: true, currency: true },
  });
  if (!account) return null;

  const start = new Date('2024-01-01T00:00:00.000Z');
  const end = new Date('2027-01-01T00:00:00.000Z');
  const [transactions, statementPeriods, openingBalance] = await Promise.all([
    db.transaction.findMany({
      where: { userId: options.userId, accountId: account.id, date: { gte: start, lt: end } },
      orderBy: [{ date: 'asc' }, { id: 'asc' }],
      select: {
        id: true,
        date: true,
        amountMinor: true,
        direction: true,
        importFingerprint: true,
        sourceFile: true,
        transactionBooking: {
          select: {
            projectId: true,
            transactionTypeId: true,
            categoryId: true,
            literalProjectLabel: true,
            literalTypeLabel: true,
            literalCategoryLabel: true,
          },
        },
      },
    }),
    db.statementPeriod.findMany({
      where: { accountId: account.id, periodStart: { gte: start, lt: end } },
      orderBy: [{ periodStart: 'asc' }, { periodEnd: 'asc' }],
      select: {
        workspaceId: true,
        accountId: true,
        periodStart: true,
        periodEnd: true,
        coverageStatus: true,
        openingBalanceMinor: true,
        closingBalanceMinor: true,
      },
    }),
    db.openingBalance.findFirst({
      where: { accountId: account.id, effectiveDate: { lte: start } },
      orderBy: { effectiveDate: 'desc' },
      select: { id: true, effectiveDate: true, amountMinor: true, lockedAt: true },
    }),
  ]);

  return buildAccountingAudit({
    account,
    transactions,
    statementPeriods,
    openingBalance,
  });
};
