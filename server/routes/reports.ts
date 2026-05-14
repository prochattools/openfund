import { Request, Response } from 'express';
import { prisma } from '../prismaClient';
import { buildPeriodReportSummary, calculateOpeningBalanceMinor } from '../services/reportingService';

const DEFAULT_USER_ID = process.env.DEFAULT_USER_ID ?? 'demo-user';

export const readReportYear = (value: unknown): number => {
  const parsed = Number(value);
  if (Number.isInteger(parsed) && parsed >= 2000 && parsed <= 2100) {
    return parsed;
  }
  return new Date().getUTCFullYear();
};

export const readReportMonth = (value: unknown): number | null => {
  if (value == null) return null;
  const parsed = Number(value);
  if (Number.isInteger(parsed) && parsed >= 1 && parsed <= 12) {
    return parsed;
  }
  return null;
};

export const splitReportCategoryLabel = (value?: string | null): { main: string | null; sub: string | null } => {
  if (!value) return { main: null, sub: null };
  const parts = value.split(' — ');
  if (parts.length <= 1) {
    const label = value.trim();
    return { main: label || null, sub: label || null };
  }
  const main = parts[0]?.trim() || null;
  const sub = parts.slice(1).join(' — ').trim() || main;
  return { main, sub };
};

export const getReportPeriodBounds = (year: number, month: number | null) => {
  const start = new Date(Date.UTC(year, month ? month - 1 : 0, 1));
  const end = month ? new Date(Date.UTC(year, month, 1)) : new Date(Date.UTC(year + 1, 0, 1));
  return { start, end };
};

const sumOpeningBalanceMinor = async (userId: string, periodStart: Date): Promise<number> => {
  const accounts = await prisma.account.findMany({
    where: { userId },
    select: { id: true },
  });

  let total = 0;

  for (const account of accounts) {
    const openingBalance = await prisma.openingBalance.findFirst({
      where: {
        accountId: account.id,
        effectiveDate: {
          lte: periodStart,
        },
      },
      orderBy: {
        effectiveDate: 'desc',
      },
    });

    const transactionsBeforePeriod = await prisma.transaction.findMany({
      where: {
        userId,
        accountId: account.id,
        date: {
          gte: openingBalance?.effectiveDate ?? new Date(Date.UTC(1970, 0, 1)),
          lt: periodStart,
        },
      },
      select: {
        amountMinor: true,
        direction: true,
      },
    });

    total += calculateOpeningBalanceMinor(openingBalance?.amountMinor ?? 0n, transactionsBeforePeriod);
  }

  return total;
};

export const getReportSummary = async (req: Request, res: Response) => {
  const userId = req.header('x-user-id') ?? DEFAULT_USER_ID;
  const year = readReportYear(req.query.year);
  const month = readReportMonth(req.query.month);
  const { start, end } = getReportPeriodBounds(year, month);

  try {
    const [transactions, openingBalanceMinor] = await Promise.all([
      prisma.transaction.findMany({
        where: {
          userId,
          date: {
            gte: start,
            lt: end,
          },
        },
        include: {
          category: true,
        },
        orderBy: {
          date: 'asc',
        },
      }),
      sumOpeningBalanceMinor(userId, start),
    ]);

    const summary = buildPeriodReportSummary(
      transactions.map((transaction) => {
        const category = splitReportCategoryLabel(transaction.category?.name ?? null);
        return {
          date: transaction.date,
          amountMinor: transaction.amountMinor,
          direction: transaction.direction,
          categoryName: category.sub,
          mainCategoryName: category.main,
        };
      }),
      { year, month },
      { openingBalanceMinor },
    );

    return res.json(summary);
  } catch (error) {
    console.error('Report summary failed', error);
    return res.status(500).json({ error: 'Het rapport kon niet worden geladen.' });
  }
};
