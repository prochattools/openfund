import type { Account, Ledger, Prisma, PrismaClient } from '@prisma/client';
import { prisma } from '../prismaClient';
import { toMinorUnits } from '../../lib/import/normalizers';

export class LedgerMismatchError extends Error {
  constructor(
    message: string,
    public readonly details: {
      accountId: string;
      month: number;
      year: number;
      differenceMinor: bigint;
      computedBalanceMinor: bigint;
      statementBalanceMinor: bigint;
    },
  ) {
    super(message);
    this.name = 'LedgerMismatchError';
  }
}

export class MissingOpeningBalanceError extends Error {
  constructor(
    message: string,
    public readonly details: {
      accountId: string;
      month: number;
      year: number;
    },
  ) {
    super(message);
    this.name = 'MissingOpeningBalanceError';
  }
}

type ReconciliationParams = {
  userId: string;
  accountId: string;
  month?: number;
  year?: number;
  start?: string;
  end?: string;
};

type ReconciliationResult = {
  account: {
    id: string;
    name: string;
    identifier: string;
    currency: string;
  };
  period: {
    start: string;
    end: string;
    month: number;
    year: number;
  };
  ledger: {
    id: string | null;
    lockedAt: string | null;
    lockedBy: string | null;
  };
  openingBalance: {
    amountMinor: string;
    effectiveDate: string | null;
  };
  computedEndBalanceMinor: string;
  statementEndBalanceMinor: string | null;
  differenceMinor: string | null;
  status: 'balanced' | 'unreconciled' | 'unknown';
  totals: {
    creditMinor: string;
    debitMinor: string;
  };
  missingDates: string[];
  duplicateIndicators: Array<{
    date: string;
    description: string;
    amountMinor: string;
    occurrences: number;
  }>;
  transactions: Array<{
    id: string;
    date: string;
    description: string;
    amountMinor: string;
    runningBalanceMinor: string;
    currency: string;
    reference: string | null;
  }>;
};

const toUTCDate = (value: string | number | Date): Date => {
  if (value instanceof Date) return value;
  if (typeof value === 'number') return new Date(value);
  return new Date(value);
};

const truncateToUTC = (date: Date): Date =>
  new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));

const resolvePeriod = (params: ReconciliationParams): { start: Date; end: Date; month: number; year: number } => {
  if (params.start && params.end) {
    const startDate = truncateToUTC(new Date(params.start));
    const endDate = truncateToUTC(new Date(params.end));
    const month = startDate.getUTCMonth() + 1;
    const year = startDate.getUTCFullYear();
    return { start: startDate, end: endDate, month, year };
  }

  const month = params.month ?? new Date().getUTCMonth() + 1;
  const year = params.year ?? new Date().getUTCFullYear();
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 0));
  return { start, end, month, year };
};

const formatISODate = (date: Date): string => date.toISOString();

export const extractStatementBalance = (rawRow: Prisma.JsonValue | null | undefined): bigint | null => {
  if (!rawRow || typeof rawRow !== 'object' || Array.isArray(rawRow)) {
    return null;
  }

  const row = rawRow as Record<string, unknown>;
  const columns =
    row.columns && typeof row.columns === 'object' && !Array.isArray(row.columns)
      ? (row.columns as Record<string, unknown>)
      : null;
  const candidates = [
    row['Resulting balance'],
    columns?.['Resulting balance'],
    row['resulting balance'],
    columns?.['resulting balance'],
    row['Saldo'],
    columns?.Saldo,
    row['Balance'],
    columns?.Balance,
  ];

  for (const candidate of candidates) {
    const minor = toMinorUnits(candidate as string | number | undefined);
    if (minor != null) {
      return minor;
    }
  }

  return null;
};

const dateRange = (start: Date, end: Date): string[] => {
  const result: string[] = [];
  const cursor = new Date(start);
  while (cursor <= end) {
    result.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return result;
};

type PrismaClientOrTx = PrismaClient | Prisma.TransactionClient;

type PeriodContext = {
  account: Account;
  ledger: Pick<Ledger, 'id' | 'lockedAt' | 'lockedBy' | 'lockNote'> & {
    lock: {
      lockedAt: Date;
      lockedBy: string | null;
      note: string | null;
    } | null;
  } | null;
  openingAmount: bigint;
  openingDate: Date | null;
  transactions: Array<{
    id: string;
    date: Date;
    description: string;
    amountMinor: bigint;
    currency: string;
    normalizedKey: string;
    reference: string | null;
    rawRow: Prisma.JsonValue | null;
  }>;
};

const loadPeriodContext = async (
  client: PrismaClientOrTx,
  params: ReconciliationParams,
  start: Date,
  end: Date,
): Promise<PeriodContext> => {
  const account = await client.account.findFirst({
    where: {
      id: params.accountId,
      userId: params.userId,
    },
  });

  if (!account) {
    throw new Error('Account not found');
  }

  const ledger = await client.ledger.findUnique({
    where: {
      userId_month_year: {
        userId: params.userId,
        month: start.getUTCMonth() + 1,
        year: start.getUTCFullYear(),
      },
    },
    select: {
      id: true,
      lockedAt: true,
      lockedBy: true,
      lockNote: true,
      lock: {
        select: {
          lockedAt: true,
          lockedBy: true,
          note: true,
        },
      },
    },
  });

  const openings = await client.openingBalance.findMany({
    where: {
      accountId: account.id,
      effectiveDate: {
        lte: end,
      },
    },
    orderBy: {
      effectiveDate: 'asc',
    },
  });

  let openingAmount: bigint = 0n;
  let openingDate: Date | null = null;

  openings.forEach((item) => {
    if (item.effectiveDate.getTime() <= start.getTime()) {
      openingAmount = item.amountMinor;
      openingDate = item.effectiveDate;
    }
  });

  const transactions = await client.transaction.findMany({
    where: {
      userId: params.userId,
      accountId: account.id,
      date: {
        gte: start,
        lte: end,
      },
    },
    orderBy: {
      date: 'asc',
    },
    select: {
      id: true,
      date: true,
      description: true,
      amountMinor: true,
      currency: true,
      normalizedKey: true,
      reference: true,
      rawRow: true,
    },
  });

  return {
    account,
    ledger,
    openingAmount,
    openingDate,
    transactions,
  };
};

export const computeReconciliation = async (
  params: ReconciliationParams,
  client: PrismaClientOrTx = prisma,
): Promise<ReconciliationResult> => {
  const { start, end, month, year } = resolvePeriod(params);

  const context = await loadPeriodContext(client, params, start, end);

  let runningBalance = context.openingAmount;
  let statementBalance: bigint | null = null;
  let totalCredits = 0n;
  let totalDebits = 0n;

  const duplicateMap = new Map<string, { count: number; description: string; amount: bigint; date: string }>();

  const runningTransactions = context.transactions.map((tx) => {
    runningBalance += tx.amountMinor;

    if (tx.amountMinor >= 0n) {
      totalCredits += tx.amountMinor;
    } else {
      totalDebits += tx.amountMinor * -1n;
    }

    const candidate = extractStatementBalance(tx.rawRow);
    if (candidate != null) {
      statementBalance = candidate;
    }

    const dateKey = tx.date.toISOString().slice(0, 10);
    const duplicateKey = `${dateKey}|${tx.normalizedKey}|${tx.amountMinor.toString()}`;
    const existingDup = duplicateMap.get(duplicateKey);
    if (existingDup) {
      existingDup.count += 1;
    } else {
      duplicateMap.set(duplicateKey, {
        count: 1,
        description: tx.description,
        amount: tx.amountMinor,
        date: dateKey,
      });
    }

    return {
      id: tx.id,
      date: tx.date.toISOString(),
      description: tx.description,
      amountMinor: tx.amountMinor.toString(),
      runningBalanceMinor: runningBalance.toString(),
      currency: tx.currency,
      reference: tx.reference ?? null,
    };
  });

  const missingDates = dateRange(start, end).filter((iso) =>
    !context.transactions.some((tx) => tx.date.toISOString().startsWith(iso)),
  );

  const duplicateIndicators = Array.from(duplicateMap.values())
    .filter((entry) => entry.count > 1)
    .map((entry) => ({
      date: entry.date,
      description: entry.description,
      amountMinor: entry.amount.toString(),
      occurrences: entry.count,
    }));

  const difference = statementBalance != null ? runningBalance - statementBalance : null;

  let status: 'balanced' | 'unreconciled' | 'unknown' = 'unknown';
  if (statementBalance != null) {
    status = difference === 0n ? 'balanced' : 'unreconciled';
  }

  return {
    account: {
      id: context.account.id,
      name: context.account.name,
      identifier: context.account.identifier,
      currency: context.account.currency,
    },
    period: {
      start: formatISODate(start),
      end: formatISODate(end),
      month,
      year,
    },
    ledger: {
      id: context.ledger?.id ?? null,
      lockedAt: context.ledger?.lock?.lockedAt
        ? context.ledger.lock.lockedAt.toISOString()
        : context.ledger?.lockedAt
        ? context.ledger.lockedAt.toISOString()
        : null,
      lockedBy: context.ledger?.lock?.lockedBy ?? context.ledger?.lockedBy ?? null,
    },
    openingBalance: {
      amountMinor: context.openingAmount.toString(),
      effectiveDate: context.openingDate ? context.openingDate.toISOString() : null,
    },
    computedEndBalanceMinor: runningBalance.toString(),
    statementEndBalanceMinor: statementBalance?.toString() ?? null,
    differenceMinor: difference?.toString() ?? null,
    status,
    totals: {
      creditMinor: totalCredits.toString(),
      debitMinor: totalDebits.toString(),
    },
    missingDates,
    duplicateIndicators,
    transactions: runningTransactions,
  };
};

export const validateLedgerBalance = async (
  client: PrismaClientOrTx,
  params: {
    userId: string;
    accountId: string;
    month: number;
    year: number;
    toleranceMinor?: bigint;
  },
): Promise<{
  status: 'reconciled' | 'unknown';
  differenceMinor: bigint | null;
  computedBalanceMinor: bigint | null;
  statementBalanceMinor: bigint | null;
}> => {
  const tolerance = params.toleranceMinor ?? 1n;
  const start = new Date(Date.UTC(params.year, params.month - 1, 1));
  const end = new Date(Date.UTC(params.year, params.month, 0));

  const context = await loadPeriodContext(client, params, start, end);

  if (!context.openingDate) {
    throw new MissingOpeningBalanceError('Opening balance required before import', {
      accountId: params.accountId,
      month: params.month,
      year: params.year,
    });
  }

  if (!context.transactions.length) {
    return {
      status: 'unknown',
      differenceMinor: null,
      computedBalanceMinor: null,
      statementBalanceMinor: null,
    };
  }

  let statementBalance: bigint | null = null;
  let totalCredits = 0n;
  let totalDebits = 0n;

  context.transactions.forEach((tx) => {
    if (tx.amountMinor >= 0n) {
      totalCredits += tx.amountMinor;
    } else {
      totalDebits += tx.amountMinor * -1n;
    }
    const candidate = extractStatementBalance(tx.rawRow);
    if (candidate != null) {
      statementBalance = candidate;
    }
  });

  if (statementBalance == null) {
    return {
      status: 'unknown',
      differenceMinor: null,
      computedBalanceMinor: null,
      statementBalanceMinor: null,
    };
  }

  const computed = context.openingAmount + totalCredits - totalDebits;
  const difference = computed - statementBalance;

  if (difference < -tolerance || difference > tolerance) {
    throw new LedgerMismatchError('Ledger balance does not match bank statement', {
      accountId: params.accountId,
      month: params.month,
      year: params.year,
      differenceMinor: difference,
      computedBalanceMinor: computed,
      statementBalanceMinor: statementBalance,
    });
  }

  return {
    status: 'reconciled',
    differenceMinor: difference,
    computedBalanceMinor: computed,
    statementBalanceMinor: statementBalance,
  };
};
