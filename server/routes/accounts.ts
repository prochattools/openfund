import { Request, Response } from 'express';
import { prisma } from '../prismaClient';
import { toMinorUnits } from '../../lib/import/normalizers';
import { readRouteParam } from './routeParams';
import { getRequestActor, requireAdmin } from '../auth/requestContext';

const DEFAULT_USER_ID = process.env.DEFAULT_USER_ID ?? 'demo-user';
const LOCKS_ENABLED = process.env.RECONCILIATION_LOCKS_ENABLED !== 'false';

export const listAccounts = async (req: Request, res: Response) => {
  const userId = req.header('x-user-id') ?? DEFAULT_USER_ID;

  try {
    const accounts = await prisma.account.findMany({
      where: { userId },
      orderBy: { name: 'asc' },
    });

    const balances = await prisma.openingBalance.findMany({
      where: {
        accountId: {
          in: accounts.map((account) => account.id),
        },
      },
      orderBy: {
        effectiveDate: 'desc',
      },
    });

    const latestBalanceByAccount = new Map<string, typeof balances[0]>();
    balances.forEach((balance) => {
      if (!latestBalanceByAccount.has(balance.accountId)) {
        latestBalanceByAccount.set(balance.accountId, balance);
      }
    });

    return res.json(
      accounts.map((account) => {
        const balance = latestBalanceByAccount.get(account.id);
        return {
          id: account.id,
          name: account.name,
          identifier: account.identifier,
          currency: account.currency,
          hasOpeningBalance: Boolean(balance),
          openingBalance: balance
            ? {
                id: balance.id,
                amountMinor: balance.amountMinor.toString(),
                effectiveDate: balance.effectiveDate.toISOString(),
                lockedAt: balance.lockedAt ? balance.lockedAt.toISOString() : null,
              }
            : null,
        };
      }),
    );
  } catch (error) {
    console.error('listAccounts failed', error);
    return res.status(500).json({ error: 'Failed to load accounts' });
  }
};

export const upsertOpeningBalance = async (req: Request, res: Response) => {
  const userId = req.header('x-user-id') ?? DEFAULT_USER_ID;
  const accountId = readRouteParam(req, 'accountId');

  if (!accountId) {
    return res.status(400).json({ error: 'Account id ontbreekt.' });
  }
  const { effectiveDate, amount, currency, note } = req.body as {
    effectiveDate?: string;
    amount?: number | string;
    currency?: string;
    note?: string;
  };

  if (!effectiveDate || amount == null) {
    return res.status(400).json({ error: 'effectiveDate and amount are required' });
  }

  try {
    const account = await prisma.account.findFirst({
      where: {
        id: accountId,
        userId,
      },
    });

    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }

    const amountMinor = toMinorUnits(amount);
    if (amountMinor == null) {
      return res.status(400).json({ error: 'Invalid amount' });
    }

    const effective = new Date(effectiveDate);
    if (Number.isNaN(effective.getTime())) {
      return res.status(400).json({ error: 'Invalid effective date' });
    }

    const isoDate = new Date(Date.UTC(effective.getUTCFullYear(), effective.getUTCMonth(), effective.getUTCDate()));

    const existing = await prisma.openingBalance.findUnique({
      where: {
        accountId_effectiveDate: {
          accountId: account.id,
          effectiveDate: isoDate,
        },
      },
    });

    if (existing && existing.lockedAt && LOCKS_ENABLED) {
      return res.status(423).json({ error: 'Opening balance is locked' });
    }

    const createdBy = req.header('x-user-email') ?? req.header('x-user-id') ?? 'system';

    const updated = existing
      ? await prisma.openingBalance.update({
          where: { id: existing.id },
          data: {
            amountMinor,
            currency: currency ?? existing.currency,
            note: note ?? existing.note,
            createdBy,
            createdAt: new Date(),
          },
        })
      : await prisma.openingBalance.create({
          data: {
            accountId: account.id,
            effectiveDate: isoDate,
            amountMinor,
            currency: currency ?? account.currency,
            note,
            createdBy,
          },
        });

    return res.json({
      id: updated.id,
      accountId: updated.accountId,
      amountMinor: updated.amountMinor.toString(),
      effectiveDate: updated.effectiveDate.toISOString(),
      lockedAt: updated.lockedAt ? updated.lockedAt.toISOString() : null,
    });
  } catch (error) {
    console.error('upsertOpeningBalance failed', error);
    return res.status(500).json({ error: 'Failed to save opening balance' });
  }
};

export const lockOpeningBalance = async (req: Request, res: Response) => {
  const userId = req.header('x-user-id') ?? DEFAULT_USER_ID;
  const balanceId = readRouteParam(req, 'balanceId');

  if (!balanceId) {
    return res.status(400).json({ error: 'Beginbalans id ontbreekt.' });
  }

  try {
    const balance = await prisma.openingBalance.findFirst({
      where: {
        id: balanceId,
        account: {
          userId,
        },
      },
    });

    if (!balance) {
      return res.status(404).json({ error: 'Opening balance not found' });
    }

    if (balance.lockedAt && LOCKS_ENABLED) {
      return res.status(200).json({
        id: balance.id,
        lockedAt: balance.lockedAt.toISOString(),
      });
    }

    const updated = await prisma.openingBalance.update({
      where: { id: balance.id },
      data: {
        lockedAt: new Date(),
        lockedBy: req.header('x-user-id') ?? 'system',
      },
    });

    return res.json({
      id: updated.id,
      lockedAt: updated.lockedAt ? updated.lockedAt.toISOString() : null,
    });
  } catch (error) {
    console.error('lockOpeningBalance failed', error);
    return res.status(500).json({ error: 'Failed to lock opening balance' });
  }
};
