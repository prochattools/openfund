import { Request, Response } from 'express';
import { prisma } from '../prismaClient';
import { toMinorUnits } from '../../lib/import/normalizers';
import { readRouteParam } from './routeParams';
import { getRequestActor, requireAdmin } from '../auth/requestContext';
import { createAuditLog } from '../services/auditLogService';

const LOCKS_ENABLED = process.env.RECONCILIATION_LOCKS_ENABLED !== 'false';

export const listAccounts = async (req: Request, res: Response) => {
  const { userId } = getRequestActor(req);

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
    console.error('Rekeningen konden niet worden geladen', error);
    return res.status(500).json({ error: 'Rekeningen konden niet worden geladen.' });
  }
};

export const upsertOpeningBalance = async (req: Request, res: Response) => {
  const actor = await requireAdmin(req, res);
  if (!actor) return;

  const { userId, actorId, actorEmail } = actor;
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
    return res.status(400).json({ error: 'Begindatum en bedrag zijn verplicht.' });
  }

  try {
    const response = await prisma.$transaction(async (tx) => {
      const account = await tx.account.findFirst({
        where: {
          id: accountId,
          userId,
        },
      });

      if (!account) {
        return { status: 404 as const, body: { error: 'Rekening niet gevonden.' } };
      }

      const amountMinor = toMinorUnits(amount);
      if (amountMinor == null) {
        return { status: 400 as const, body: { error: 'Bedrag is ongeldig.' } };
      }

      const effective = new Date(effectiveDate);
      if (Number.isNaN(effective.getTime())) {
        return { status: 400 as const, body: { error: 'Begindatum is ongeldig.' } };
      }

      const isoDate = new Date(Date.UTC(effective.getUTCFullYear(), effective.getUTCMonth(), effective.getUTCDate()));

      const existing = await tx.openingBalance.findUnique({
        where: {
          accountId_effectiveDate: {
            accountId: account.id,
            effectiveDate: isoDate,
          },
        },
      });

      if (existing && existing.lockedAt && LOCKS_ENABLED) {
        return { status: 423 as const, body: { error: 'Deze beginbalans is vergrendeld.' } };
      }

      const createdBy = actorEmail ?? actorId ?? 'system';

      const updated = existing
        ? await tx.openingBalance.update({
            where: { id: existing.id },
            data: {
              amountMinor,
              currency: currency ?? existing.currency,
              note: note ?? existing.note,
              createdBy,
              createdAt: new Date(),
            },
          })
        : await tx.openingBalance.create({
            data: {
              accountId: account.id,
              effectiveDate: isoDate,
              amountMinor,
              currency: currency ?? account.currency,
              note,
              createdBy,
            },
          });

      await createAuditLog(tx, {
        userId,
        actorId,
        actorEmail,
        action: existing ? 'openingBalance.updated' : 'openingBalance.created',
        entityType: 'openingBalance',
        entityId: updated.id,
        before: existing
          ? {
              amountMinor: existing.amountMinor.toString(),
              currency: existing.currency,
              effectiveDate: existing.effectiveDate.toISOString(),
              note: existing.note,
            }
          : null,
        after: {
          amountMinor: updated.amountMinor.toString(),
          currency: updated.currency,
          effectiveDate: updated.effectiveDate.toISOString(),
          note: updated.note,
        },
        metadata: {
          accountId: account.id,
          accountIdentifier: account.identifier,
        },
      });

      return {
        status: 200 as const,
        body: {
          id: updated.id,
          accountId: updated.accountId,
          amountMinor: updated.amountMinor.toString(),
          effectiveDate: updated.effectiveDate.toISOString(),
          lockedAt: updated.lockedAt ? updated.lockedAt.toISOString() : null,
        },
      };
    });

    return res.status(response.status).json(response.body);
  } catch (error) {
    console.error('Beginbalans kon niet worden opgeslagen', error);
    return res.status(500).json({ error: 'Beginbalans kon niet worden opgeslagen.' });
  }
};

export const lockOpeningBalance = async (req: Request, res: Response) => {
  const actor = await requireAdmin(req, res);
  if (!actor) return;

  const { userId, actorId, actorEmail } = actor;
  const balanceId = readRouteParam(req, 'balanceId');

  if (!balanceId) {
    return res.status(400).json({ error: 'Beginbalans id ontbreekt.' });
  }

  try {
    const response = await prisma.$transaction(async (tx) => {
      const balance = await tx.openingBalance.findFirst({
        where: {
          id: balanceId,
          account: {
            userId,
          },
        },
        include: {
          account: true,
        },
      });

      if (!balance) {
        return { status: 404 as const, body: { error: 'Beginbalans niet gevonden.' } };
      }

      if (balance.lockedAt && LOCKS_ENABLED) {
        return {
          status: 200 as const,
          body: {
            id: balance.id,
            lockedAt: balance.lockedAt.toISOString(),
          },
        };
      }

      const updated = await tx.openingBalance.update({
        where: { id: balance.id },
        data: {
          lockedAt: new Date(),
          lockedBy: actorEmail ?? actorId ?? 'system',
        },
      });

      await createAuditLog(tx, {
        userId,
        actorId,
        actorEmail,
        action: 'openingBalance.locked',
        entityType: 'openingBalance',
        entityId: balance.id,
        before: {
          lockedAt: balance.lockedAt?.toISOString() ?? null,
          lockedBy: balance.lockedBy,
        },
        after: {
          lockedAt: updated.lockedAt?.toISOString() ?? null,
          lockedBy: updated.lockedBy,
        },
        metadata: {
          accountId: balance.accountId,
          accountIdentifier: balance.account.identifier,
        },
      });

      return {
        status: 200 as const,
        body: {
          id: updated.id,
          lockedAt: updated.lockedAt ? updated.lockedAt.toISOString() : null,
        },
      };
    });

    return res.status(response.status).json(response.body);
  } catch (error) {
    console.error('Beginbalans kon niet worden vergrendeld', error);
    return res.status(500).json({ error: 'Beginbalans kon niet worden vergrendeld.' });
  }
};
