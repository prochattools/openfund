import type { MonthlyReconciliationResult } from './monthlyReconciliationService';

export type YearlyBaselineControl = {
  transactionCount: number;
  openingMinor: string;
  incomeMinor: string;
  expenseMinor: string;
  closingMinor: string;
};

export type MonthlyAuditExpectedCoverage = Record<number, number[]>;

export type MonthlyAuditIssue = {
  year: number;
  month: number;
  message: string;
};

export type MonthlyAuditYearSummary = {
  year: number;
  monthCount: number;
  transactionCount: number;
  openingBalanceMinor: string;
  incomeMinor: string;
  expenseMinor: string;
  closingBalanceMinor: string;
};

export type MonthlyReconciliationAuditInput = {
  months: MonthlyReconciliationResult[];
  expectedCoverage: MonthlyAuditExpectedCoverage;
  validatorVersion?: string;
  baselineControls?: Record<number, YearlyBaselineControl>;
};

export type MonthlyReconciliationAuditResult = {
  status: 'PASSED' | 'FAILED';
  validatorVersion: string;
  monthCount: number;
  issues: MonthlyAuditIssue[];
  yearSummaries: MonthlyAuditYearSummary[];
};

const toMinor = (value: string | bigint | number): bigint => BigInt(value);

const addIssue = (issues: MonthlyAuditIssue[], year: number, month: number, message: string) => {
  issues.push({ year, month, message });
};

export const auditMonthlyReconciliations = (
  input: MonthlyReconciliationAuditInput,
): MonthlyReconciliationAuditResult => {
  const validatorVersion = input.validatorVersion ?? 'monthly-reconciliation-audit-v1';
  const issues: MonthlyAuditIssue[] = [];
  const sortedMonths = [...input.months].sort((left, right) => {
    if (left.year !== right.year) return left.year - right.year;
    return left.month - right.month;
  });

  const byYear = new Map<number, MonthlyReconciliationResult[]>();
  for (const month of sortedMonths) {
    const expectedMonths = input.expectedCoverage[month.year];
    if (!expectedMonths?.includes(month.month)) {
      addIssue(issues, month.year, month.month, 'Maand valt buiten de verwachte scope.');
    }
    const partialCoverage = month.coverageStatus !== 'COMPLETE';
    if (!partialCoverage && (month.status !== 'BALANCED' || !month.closeEligible)) {
      addIssue(issues, month.year, month.month, 'Maand is niet balancerend en afsluitbaar.');
    }
    if (month.duplicateFingerprintCount !== 0) {
      addIssue(issues, month.year, month.month, 'Dubbele importvingerafdrukken aanwezig.');
    }
    if (month.runningBalanceErrorCount !== 0) {
      addIssue(issues, month.year, month.month, 'Running-balance fouten aanwezig.');
    }
    if (month.unresolvedTransactionCount !== 0) {
      addIssue(issues, month.year, month.month, 'Onopgeloste transacties aanwezig.');
    }
    if (month.balanceDifferenceMinor !== '0') {
      addIssue(issues, month.year, month.month, 'Maandsaldo sluit niet exact.');
    }
    if (month.categoryIncomeDifferenceMinor !== '0') {
      addIssue(issues, month.year, month.month, 'Categorie-inkomsten sluiten niet exact.');
    }
    if (month.categoryExpenseDifferenceMinor !== '0') {
      addIssue(issues, month.year, month.month, 'Categorie-uitgaven sluiten niet exact.');
    }

    const yearMonths = byYear.get(month.year) ?? [];
    yearMonths.push(month);
    byYear.set(month.year, yearMonths);
  }

  for (const [year, months] of byYear.entries()) {
    const expectedMonths = [...(input.expectedCoverage[year] ?? [])].sort((a, b) => a - b);
    const observedMonths = months.map((month) => month.month).sort((a, b) => a - b);
    for (const expectedMonth of expectedMonths) {
      if (!observedMonths.includes(expectedMonth)) {
        addIssue(issues, year, expectedMonth, 'Verwachte maand ontbreekt in audit-scope.');
      }
    }

    const ordered = [...months].sort((left, right) => left.month - right.month);
    for (let index = 1; index < ordered.length; index += 1) {
      const previous = ordered[index - 1];
      const current = ordered[index];
      if (toMinor(previous.closingBalanceMinor) !== toMinor(current.openingBalanceMinor)) {
        addIssue(
          issues,
          current.year,
          current.month,
          'Maandketen is gebroken tussen opeenvolgende maanden.',
        );
      }
    }
  }

  const yearSummaries: MonthlyAuditYearSummary[] = Array.from(byYear.entries())
    .sort(([leftYear], [rightYear]) => leftYear - rightYear)
    .map(([year, months]) => {
      const ordered = [...months].sort((left, right) => left.month - right.month);
      const openingBalanceMinor = ordered[0] ? ordered[0].openingBalanceMinor : '0';
      const closingBalanceMinor = ordered[ordered.length - 1] ? ordered[ordered.length - 1].closingBalanceMinor : '0';
      const incomeMinor = ordered.reduce((total, month) => total + toMinor(month.incomeMinor), 0n);
      const expenseMinor = ordered.reduce((total, month) => total + toMinor(month.expenseMinor), 0n);
      const transactionCount = ordered.reduce((total, month) => total + month.transactionCount, 0);

      return {
        year,
        monthCount: ordered.length,
        transactionCount,
        openingBalanceMinor: openingBalanceMinor.toString(),
        incomeMinor: incomeMinor.toString(),
        expenseMinor: expenseMinor.toString(),
        closingBalanceMinor: closingBalanceMinor.toString(),
      };
    });

  for (const summary of yearSummaries) {
    const expectedMonths = input.expectedCoverage[summary.year] ?? [];
    if (summary.monthCount !== expectedMonths.length) {
      addIssue(
        issues,
        summary.year,
        0,
        'Jaarlijkse maanddekking wijkt af van de verwachte scope.',
      );
    }

    // Enforce baseline controls if provided
    const baseline = input.baselineControls?.[summary.year];
    if (baseline) {
      if (summary.transactionCount !== baseline.transactionCount) {
        addIssue(
          issues,
          summary.year,
          0,
          `Jaarlijkse transactietellingen wijken af: verwacht ${baseline.transactionCount}, aangetroffen ${summary.transactionCount}.`,
        );
      }
      if (summary.openingBalanceMinor !== baseline.openingMinor) {
        addIssue(
          issues,
          summary.year,
          0,
          `Jaarlijkse openingssaldo wijkt af: verwacht ${baseline.openingMinor}, aangetroffen ${summary.openingBalanceMinor}.`,
        );
      }
      if (summary.incomeMinor !== baseline.incomeMinor) {
        addIssue(
          issues,
          summary.year,
          0,
          `Jaarlijkse inkomsten wijken af: verwacht ${baseline.incomeMinor}, aangetroffen ${summary.incomeMinor}.`,
        );
      }
      if (summary.expenseMinor !== baseline.expenseMinor) {
        addIssue(
          issues,
          summary.year,
          0,
          `Jaarlijkse uitgaven wijken af: verwacht ${baseline.expenseMinor}, aangetroffen ${summary.expenseMinor}.`,
        );
      }
      if (summary.closingBalanceMinor !== baseline.closingMinor) {
        addIssue(
          issues,
          summary.year,
          0,
          `Jaarlijkse sluitingssaldo wijkt af: verwacht ${baseline.closingMinor}, aangetroffen ${summary.closingBalanceMinor}.`,
        );
      }
    }
  }

  const status = issues.length === 0 ? 'PASSED' : 'FAILED';

  return {
    status,
    validatorVersion,
    monthCount: sortedMonths.length,
    issues,
    yearSummaries,
  };
};
