import { StatementCoverageStatus } from '@prisma/client';

type BigIntLike = bigint | number | string;

export type MonthlyReconciliationDirection = 'credit' | 'debit';

export type MonthlyReconciliationTransactionInput = {
  transactionId: string;
  date: Date | string;
  amountMinor: BigIntLike;
  direction: MonthlyReconciliationDirection;
  resultingBalanceMinor?: BigIntLike | null;
  rawRow?: Record<string, unknown> | null;
  importFingerprint?: string | null;
  duplicateFingerprint?: string | null;
  projectId?: string | null;
  transactionTypeId?: string | null;
  categoryId?: string | null;
  literalProjectLabel?: string | null;
  literalTypeLabel?: string | null;
  literalCategoryLabel?: string | null;
  unresolved?: boolean | null;
  sourceFileHash?: string | null;
};

export type MonthlyReconciliationStatementEvidence = {
  coverageStatus: StatementCoverageStatus;
  openingBalanceMinor?: BigIntLike | null;
  closingBalanceMinor?: BigIntLike | null;
  sourceFileHashes?: string[];
  periodStart?: Date | string | null;
  periodEnd?: Date | string | null;
};

export type MonthlyReconciliationLine = {
  lineKind: 'CATEGORY' | 'SUBCATEGORY';
  groupKey: string;
  direction: MonthlyReconciliationDirection;
  projectId: string | null;
  transactionTypeId: string | null;
  categoryId: string | null;
  literalProjectLabel: string | null;
  literalTypeLabel: string | null;
  literalCategoryLabel: string | null;
  amountMinor: string;
  transactionCount: number;
  sortOrder: number;
};

export type MonthlyReconciliationResult = {
  workspaceId: string;
  accountId: string;
  year: number;
  month: number;
  periodStart: string;
  periodEnd: string;
  coverageStatus: StatementCoverageStatus;
  openingBalanceMinor: string;
  incomeMinor: string;
  expenseMinor: string;
  netMinor: string;
  closingBalanceMinor: string;
  transactionCount: number;
  bookedTransactionCount: number;
  unresolvedTransactionCount: number;
  duplicateFingerprintCount: number;
  runningBalanceErrorCount: number;
  categoryIncomeDifferenceMinor: string;
  categoryExpenseDifferenceMinor: string;
  balanceDifferenceMinor: string;
  status: 'BALANCED' | 'UNBALANCED' | 'INCOMPLETE';
  closeEligible: boolean;
  reasons: string[];
  categoryLines: MonthlyReconciliationLine[];
  subcategoryLines: MonthlyReconciliationLine[];
  sourceFileHashes: string[];
  validatorVersion: string;
  monthChainErrorCount: number;
};

export type MonthlyReconciliationInput = {
  workspaceId: string;
  accountId: string;
  year: number;
  month: number;
  importedTransactions: MonthlyReconciliationTransactionInput[];
  statementEvidence: MonthlyReconciliationStatementEvidence;
  previousMonthClosingBalanceMinor?: BigIntLike | null;
  nextMonthOpeningBalanceMinor?: BigIntLike | null;
  validatorVersion?: string;
};

const DEFAULT_VALIDATOR_VERSION = 'monthly-reconciliation-v1';

const toMinor = (value: BigIntLike | null | undefined): bigint => BigInt(value ?? 0);

const parseMinorAmount = (value: unknown): bigint | null => {
  if (value == null) return null;
  if (typeof value === 'bigint') return value;
  if (typeof value === 'number' && Number.isFinite(value)) {
    return BigInt(Math.round(value * 100));
  }
  if (typeof value !== 'string') return null;

  const normalized = value.trim();
  if (!normalized) return null;

  if (/^\d+(?:\.\d{3})*(?:,\d{1,2})?$/.test(normalized)) {
    const compact = normalized.replace(/\./g, '').replace(',', '.');
    const parsed = Number(compact);
    return Number.isFinite(parsed) ? BigInt(Math.round(parsed * 100)) : null;
  }

  if (/^\d+(?:,\d{1,2})?$/.test(normalized)) {
    const compact = normalized.replace(',', '.');
    const parsed = Number(compact);
    return Number.isFinite(parsed) ? BigInt(Math.round(parsed * 100)) : null;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? BigInt(Math.round(parsed * 100)) : null;
};

const extractRunningBalanceMinor = (rawRow: Record<string, unknown> | null | undefined): bigint | null => {
  if (!rawRow || typeof rawRow !== 'object' || Array.isArray(rawRow)) {
    return null;
  }

  const columns = rawRow.columns && typeof rawRow.columns === 'object' && !Array.isArray(rawRow.columns)
    ? (rawRow.columns as Record<string, unknown>)
    : null;

  const candidates = [
    rawRow['Resulting balance'],
    columns?.['Resulting balance'],
    rawRow['resulting balance'],
    columns?.['resulting balance'],
    rawRow['Saldo'],
    columns?.Saldo,
    rawRow['Balance'],
    columns?.Balance,
  ];

  for (const candidate of candidates) {
    const minor = parseMinorAmount(candidate);
    if (minor != null) {
      return minor;
    }
  }

  return null;
};

const toDate = (value: Date | string): Date => (value instanceof Date ? value : new Date(value));

const isoDate = (value: Date | string | null | undefined): string => {
  if (!value) return '';
  return toDate(value).toISOString();
};

const moneyToString = (value: bigint): string => value.toString();

const txSort = (left: MonthlyReconciliationTransactionInput, right: MonthlyReconciliationTransactionInput): number => {
  const leftDate = toDate(left.date).getTime();
  const rightDate = toDate(right.date).getTime();
  if (leftDate !== rightDate) return leftDate - rightDate;
  return left.transactionId.localeCompare(right.transactionId, 'en');
};

const isBooked = (transaction: MonthlyReconciliationTransactionInput): boolean =>
  Boolean(
    transaction.projectId &&
      transaction.transactionTypeId &&
      transaction.categoryId &&
      !transaction.unresolved,
  );

const lineKey = (
  lineKind: 'CATEGORY' | 'SUBCATEGORY',
  transaction: MonthlyReconciliationTransactionInput,
  direction: MonthlyReconciliationDirection,
): string => {
  if (lineKind === 'CATEGORY') {
    return [lineKind, transaction.categoryId ?? '', direction].join('\x00');
  }
  return [
    lineKind,
    transaction.projectId ?? '',
    transaction.transactionTypeId ?? '',
    transaction.categoryId ?? '',
    direction,
  ].join('\x00');
};

const lineLabels = (transaction: MonthlyReconciliationTransactionInput) => ({
  projectId: transaction.projectId ?? null,
  transactionTypeId: transaction.transactionTypeId ?? null,
  categoryId: transaction.categoryId ?? null,
  literalProjectLabel: transaction.literalProjectLabel ?? null,
  literalTypeLabel: transaction.literalTypeLabel ?? null,
  literalCategoryLabel: transaction.literalCategoryLabel ?? null,
});

const buildLines = (
  transactions: MonthlyReconciliationTransactionInput[],
  lineKind: 'CATEGORY' | 'SUBCATEGORY',
): MonthlyReconciliationLine[] => {
  const groups = new Map<string, MonthlyReconciliationLine>();

  for (const transaction of transactions) {
    if (!isBooked(transaction)) continue;

    const direction = transaction.direction;
    const key = lineKey(lineKind, transaction, direction);
    const amountMinor = toMinor(transaction.amountMinor);
    const absAmount = amountMinor < 0n ? -amountMinor : amountMinor;
    const existing = groups.get(key);
    if (existing) {
      existing.amountMinor = moneyToString(BigInt(existing.amountMinor) + absAmount);
      existing.transactionCount += 1;
      continue;
    }

    const labels = lineLabels(transaction);
    groups.set(key, {
      lineKind,
      groupKey: key,
      direction,
      ...labels,
      amountMinor: moneyToString(absAmount),
      transactionCount: 1,
      sortOrder: 0,
    });
  }

  return Array.from(groups.values())
    .sort((left, right) => {
      const leftLabels = [
        left.literalProjectLabel ?? '',
        left.literalTypeLabel ?? '',
        left.literalCategoryLabel ?? '',
        left.direction,
      ].join('\x00');
      const rightLabels = [
        right.literalProjectLabel ?? '',
        right.literalTypeLabel ?? '',
        right.literalCategoryLabel ?? '',
        right.direction,
      ].join('\x00');
      return leftLabels.localeCompare(rightLabels, 'nl');
    })
    .map((line, index) => ({ ...line, sortOrder: index + 1 }));
};

const sumByDirection = (
  transactions: MonthlyReconciliationTransactionInput[],
  direction: MonthlyReconciliationDirection,
): bigint => {
  let total = 0n;
  for (const transaction of transactions) {
    if (transaction.direction === direction) {
      const amount = toMinor(transaction.amountMinor);
      const absAmount = amount < 0n ? -amount : amount;
      total += absAmount;
    }
  }
  return total;
};

const addReason = (reasons: string[], reason: string) => {
  if (!reasons.includes(reason)) {
    reasons.push(reason);
  }
};

export const buildMonthlyReconciliation = (
  input: MonthlyReconciliationInput,
): MonthlyReconciliationResult => {
  if (!input.workspaceId) {
    throw new Error('Werkruimte ontbreekt.');
  }
  if (!input.accountId) {
    throw new Error('Rekening ontbreekt.');
  }
  if (!Number.isInteger(input.year) || input.year < 2000) {
    throw new Error('Ongeldig jaar.');
  }
  if (!Number.isInteger(input.month) || input.month < 1 || input.month > 12) {
    throw new Error('Ongeldige maand.');
  }

  const validatorVersion = input.validatorVersion ?? DEFAULT_VALIDATOR_VERSION;
  const transactions = [...input.importedTransactions].sort(txSort);
  const reasons: string[] = [];

  const sourceFileHashes = Array.from(
    new Set(
      [
        ...(input.statementEvidence.sourceFileHashes ?? []),
        ...transactions.map((transaction) => transaction.sourceFileHash ?? '').filter(Boolean),
      ],
    ),
  ).sort();

  const incomeMinor = sumByDirection(transactions, 'credit');
  const expenseMinor = sumByDirection(transactions, 'debit');
  const netMinor = incomeMinor - expenseMinor;
  const transactionCount = transactions.length;

  let duplicateFingerprintCount = 0;
  const seenFingerprints = new Set<string>();
  const repeatedFingerprints = new Set<string>();

  let runningBalanceErrorCount = 0;
  let derivedOpeningBalanceMinor: bigint | null = null;
  let derivedClosingBalanceMinor: bigint | null = null;
  let previousBalanceMinor: bigint | null = null;

  let bookedTransactionCount = 0;
  let unresolvedTransactionCount = 0;

  for (const [index, transaction] of transactions.entries()) {
    const amountMinor = toMinor(transaction.amountMinor);
    const absAmount = amountMinor < 0n ? -amountMinor : amountMinor;
    const delta = transaction.direction === 'credit' ? absAmount : -absAmount;
    const actualBalanceMinor = transaction.resultingBalanceMinor == null
      ? extractRunningBalanceMinor(transaction.rawRow)
      : toMinor(transaction.resultingBalanceMinor);

    // Per-transaction balances are often unreliable. Only use them if they're explicitly provided
    // (not extracted from raw rows). Skip running balance checks when resultingBalanceMinor is null,
    // which signals that source evidence is not per-transaction.
    const hasReliableBalance = transaction.resultingBalanceMinor != null;

    if (index === 0) {
      if (hasReliableBalance && actualBalanceMinor != null) {
        derivedOpeningBalanceMinor = actualBalanceMinor - delta;
        previousBalanceMinor = actualBalanceMinor;
      } else if (input.statementEvidence.openingBalanceMinor != null) {
        derivedOpeningBalanceMinor = toMinor(input.statementEvidence.openingBalanceMinor);
      }
    } else if (hasReliableBalance && actualBalanceMinor != null && previousBalanceMinor != null) {
      const expected = previousBalanceMinor + delta;
      if (expected !== actualBalanceMinor) {
        runningBalanceErrorCount += 1;
      }
      previousBalanceMinor = actualBalanceMinor;
    } else if (hasReliableBalance && (actualBalanceMinor == null || previousBalanceMinor == null)) {
      runningBalanceErrorCount += 1;
      previousBalanceMinor = actualBalanceMinor ?? previousBalanceMinor;
    }

    const fingerprint = transaction.importFingerprint ?? transaction.duplicateFingerprint ?? null;
    if (fingerprint) {
      if (seenFingerprints.has(fingerprint)) {
        repeatedFingerprints.add(fingerprint);
      }
      seenFingerprints.add(fingerprint);
    }

    if (isBooked(transaction)) {
      bookedTransactionCount += 1;
    } else {
      unresolvedTransactionCount += 1;
    }
  }

  duplicateFingerprintCount = repeatedFingerprints.size;

  // For opening: use provided statement evidence, or derive from first transaction if we have reliable balances
  const openingBalanceMinor = input.statementEvidence.openingBalanceMinor != null
    ? toMinor(input.statementEvidence.openingBalanceMinor)
    : derivedOpeningBalanceMinor ?? 0n;

  // For closing: use provided statement evidence (for month 12 in full-year splits),
  // or derive from running balance chain, or calculate from formula
  const closingBalanceMinor = input.statementEvidence.closingBalanceMinor != null
    ? toMinor(input.statementEvidence.closingBalanceMinor)
    : previousBalanceMinor ?? (openingBalanceMinor + netMinor);
  const expectedClosingMinor = openingBalanceMinor + netMinor;

  const statementOpeningMinor = input.statementEvidence.openingBalanceMinor != null
    ? toMinor(input.statementEvidence.openingBalanceMinor)
    : null;
  const statementClosingMinor = input.statementEvidence.closingBalanceMinor != null
    ? toMinor(input.statementEvidence.closingBalanceMinor)
    : null;

  if (statementOpeningMinor != null && statementOpeningMinor !== openingBalanceMinor) {
    addReason(reasons, 'Bron-openingssaldo wijkt af van het afgeleide maand-openingssaldo.');
  }

  if (statementClosingMinor != null && statementClosingMinor !== closingBalanceMinor) {
    addReason(reasons, 'Bron-eindsaldo wijkt af van het afgeleide maand-eindsaldo.');
  }

  const categoryLines = buildLines(transactions, 'CATEGORY');
  const subcategoryLines = buildLines(transactions, 'SUBCATEGORY');

  const categoryCreditMinor = categoryLines
    .filter((line) => line.direction === 'credit')
    .reduce((total, line) => total + toMinor(line.amountMinor), 0n);
  const categoryDebitMinor = categoryLines
    .filter((line) => line.direction === 'debit')
    .reduce((total, line) => total + toMinor(line.amountMinor), 0n);

  const categoryIncomeDifferenceMinor = incomeMinor - categoryCreditMinor;
  const categoryExpenseDifferenceMinor = expenseMinor - categoryDebitMinor;
  const balanceDifferenceMinor = expectedClosingMinor - closingBalanceMinor;

  if (input.statementEvidence.coverageStatus !== StatementCoverageStatus.COMPLETE) {
    addReason(reasons, 'Gedeeltelijke of open afschriften kunnen niet worden gesloten.');
  }
  if (unresolvedTransactionCount > 0) {
    addReason(reasons, 'Er zijn nog handmatige reviewtransacties open.');
  }
  if (duplicateFingerprintCount > 0) {
    addReason(reasons, 'Dubbele importvingerafdrukken zijn aanwezig.');
  }
  if (runningBalanceErrorCount > 0) {
    addReason(reasons, 'Running-balance controles bevatten fouten.');
  }
  if (categoryIncomeDifferenceMinor !== 0n) {
    addReason(reasons, 'Categorie-inkomsten wijken af van de broninkomsten.');
  }
  if (categoryExpenseDifferenceMinor !== 0n) {
    addReason(reasons, 'Categorie-uitgaven wijken af van de bronuitgaven.');
  }
  if (balanceDifferenceMinor !== 0n) {
    addReason(reasons, 'Openingssaldo plus inkomsten min uitgaven wijkt af van het eindsaldo.');
  }

  const monthChainErrorCount = [
    input.previousMonthClosingBalanceMinor != null && toMinor(input.previousMonthClosingBalanceMinor) !== openingBalanceMinor,
    input.nextMonthOpeningBalanceMinor != null && toMinor(input.nextMonthOpeningBalanceMinor) !== closingBalanceMinor,
  ].filter(Boolean).length;

  if (monthChainErrorCount > 0) {
    addReason(reasons, 'Maandketen is niet continu.');
  }

  let status: MonthlyReconciliationResult['status'] = 'BALANCED';
  if (
    input.statementEvidence.coverageStatus !== StatementCoverageStatus.COMPLETE ||
    unresolvedTransactionCount > 0
  ) {
    status = 'INCOMPLETE';
  } else if (
    duplicateFingerprintCount > 0 ||
    runningBalanceErrorCount > 0 ||
    categoryIncomeDifferenceMinor !== 0n ||
    categoryExpenseDifferenceMinor !== 0n ||
    balanceDifferenceMinor !== 0n ||
    monthChainErrorCount > 0
  ) {
    status = 'UNBALANCED';
  }

  const closeEligible = status === 'BALANCED';

  return {
    workspaceId: input.workspaceId,
    accountId: input.accountId,
    year: input.year,
    month: input.month,
    periodStart: isoDate(input.statementEvidence.periodStart ?? new Date(Date.UTC(input.year, input.month - 1, 1))),
    periodEnd: isoDate(input.statementEvidence.periodEnd ?? new Date(Date.UTC(input.year, input.month, 0, 23, 59, 59, 999))),
    coverageStatus: input.statementEvidence.coverageStatus,
    openingBalanceMinor: moneyToString(openingBalanceMinor),
    incomeMinor: moneyToString(incomeMinor),
    expenseMinor: moneyToString(expenseMinor),
    netMinor: moneyToString(netMinor),
    closingBalanceMinor: moneyToString(closingBalanceMinor),
    transactionCount,
    bookedTransactionCount,
    unresolvedTransactionCount,
    duplicateFingerprintCount,
    runningBalanceErrorCount,
    categoryIncomeDifferenceMinor: moneyToString(categoryIncomeDifferenceMinor),
    categoryExpenseDifferenceMinor: moneyToString(categoryExpenseDifferenceMinor),
    balanceDifferenceMinor: moneyToString(balanceDifferenceMinor),
    status,
    closeEligible,
    reasons,
    categoryLines,
    subcategoryLines,
    sourceFileHashes,
    validatorVersion,
    monthChainErrorCount,
  };
};
