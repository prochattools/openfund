export type HistoricalDirection = 'credit' | 'debit';

export type HistoricalTransactionLike = {
  amountMinor: bigint;
  direction: HistoricalDirection;
  resultingBalanceMinor?: bigint | null;
  rawRow?: Record<string, unknown>;
};

export type HistoricalControlTotals = {
  openingBalanceMinor: bigint;
  incomeMinor: bigint;
  expenseMinor: bigint;
  closingBalanceMinor: bigint;
  transactionCount: number;
  creditCount: number;
  debitCount: number;
};

export type HistoricalControlCheck = {
  valid: boolean;
  rowNumber?: number;
  expectedBalanceMinor?: bigint;
  actualBalanceMinor?: bigint;
  message?: string;
};

const toBigInt = (value: bigint | number | null | undefined): bigint => BigInt(value ?? 0);

export const cashDeltaMinor = (row: HistoricalTransactionLike): bigint => {
  const absoluteAmount = toBigInt(row.amountMinor);
  return row.direction === 'debit'
    ? (absoluteAmount < 0n ? absoluteAmount : -absoluteAmount)
    : (absoluteAmount < 0n ? -absoluteAmount : absoluteAmount);
};

export const computeHistoricalTotals = (rows: HistoricalTransactionLike[]): HistoricalControlTotals => {
  const openingBalanceMinor = rows.length && rows[0]?.resultingBalanceMinor != null
    ? toBigInt(rows[0].resultingBalanceMinor) - cashDeltaMinor(rows[0])
    : 0n;

  let incomeMinor = 0n;
  let expenseMinor = 0n;
  let closingBalanceMinor = openingBalanceMinor;
  let creditCount = 0;
  let debitCount = 0;

  for (const row of rows) {
    const delta = cashDeltaMinor(row);
    closingBalanceMinor += delta;
    if (row.direction === 'credit') {
      creditCount += 1;
      incomeMinor += delta >= 0n ? delta : -delta;
    } else {
      debitCount += 1;
      expenseMinor += delta >= 0n ? delta : -delta;
    }
  }

  return {
    openingBalanceMinor,
    incomeMinor,
    expenseMinor,
    closingBalanceMinor,
    transactionCount: rows.length,
    creditCount,
    debitCount,
  };
};

export const checkRunningBalanceContinuity = (
  rows: Array<{ rowNumber: number; amountMinor: bigint; direction?: HistoricalDirection; resultingBalanceMinor?: bigint | null }>,
): HistoricalControlCheck[] => {
  const checks: HistoricalControlCheck[] = [];
  let previousBalance: bigint | null = null;

  rows.forEach((row, index) => {
    const actual = row.resultingBalanceMinor == null ? null : toBigInt(row.resultingBalanceMinor);
    const direction: HistoricalDirection = row.direction ?? (row.amountMinor < 0n ? 'debit' : 'credit');
    const delta = cashDeltaMinor({ amountMinor: row.amountMinor, direction });
    if (index === 0) {
      previousBalance = actual;
      checks.push({
        valid: actual != null,
        rowNumber: row.rowNumber,
        expectedBalanceMinor: actual ?? undefined,
        actualBalanceMinor: actual ?? undefined,
        message: actual == null ? 'Missing resulting balance' : undefined,
      });
      return;
    }

    const expected = (previousBalance ?? 0n) + delta;
    const valid = actual != null && actual === expected;
    checks.push({
      valid,
      rowNumber: row.rowNumber,
      expectedBalanceMinor: expected,
      actualBalanceMinor: actual ?? undefined,
      message: valid ? undefined : 'Running balance continuity failed',
    });
    previousBalance = actual ?? expected;
  });

  return checks;
};

export const assertHelperDateColumnsRejected = (row: Record<string, unknown>) => {
  const helperKeys = ['Jaartal', 'Maand1', 'Maand', 'Dag', 'Datum'];
  const present = helperKeys.filter((key) => row[key] != null && String(row[key]).trim().length > 0);
  return present;
};
