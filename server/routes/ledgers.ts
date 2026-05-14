import { Request, Response } from 'express';
import { prisma } from '../prismaClient';
import { readRouteParam } from './routeParams';
import { requireAdmin } from '../auth/requestContext';
import { createAuditLog } from '../services/auditLogService';

const LOCKS_ENABLED = process.env.RECONCILIATION_LOCKS_ENABLED !== 'false';

export const lockLedger = async (req: Request, res: Response) => {
  if (!LOCKS_ENABLED) {
    return res.status(200).json({ message: 'Vergrendelen is uitgeschakeld.' });
  }

  const actor = requireAdmin(req, res);
  if (!actor) return;

  const { userId, actorId, actorEmail } = actor;
  const ledgerId = readRouteParam(req, 'ledgerId');
  const { note } = req.body as { note?: string };

  if (!ledgerId) {
    return res.status(400).json({ error: 'Ledger id ontbreekt.' });
  }

  try {
    const response = await prisma.$transaction(async (tx) => {
      const ledger = await tx.ledger.findFirst({
        where: {
          id: ledgerId,
          userId,
        },
        include: {
          lock: true,
        },
      });

      if (!ledger) {
        return { status: 404 as const, body: { error: 'Maand niet gevonden.' } };
      }

      if (ledger.lockedAt) {
        return {
          status: 200 as const,
          body: {
            id: ledger.id,
            lockedAt: ledger.lockedAt.toISOString(),
            lockedBy: ledger.lockedBy,
            lockNote: ledger.lockNote,
          },
        };
      }

      const updated = await tx.ledger.update({
        where: { id: ledger.id },
        data: {
          lockedAt: new Date(),
          lockedBy: actorEmail ?? actorId ?? userId,
          lockNote: note ?? ledger.lockNote,
        },
      });

      await tx.ledgerLock.upsert({
        where: {
          ledgerId: ledger.id,
        },
        create: {
          ledgerId: ledger.id,
          lockedAt: updated.lockedAt ?? new Date(),
          lockedBy: updated.lockedBy,
          note: updated.lockNote,
        },
        update: {
          lockedAt: updated.lockedAt ?? new Date(),
          lockedBy: updated.lockedBy,
          note: updated.lockNote,
        },
      });

      await createAuditLog(tx, {
        userId,
        actorId,
        actorEmail,
        action: 'ledger.locked',
        entityType: 'ledger',
        entityId: ledger.id,
        before: {
          lockedAt: ledger.lockedAt?.toISOString() ?? null,
          lockedBy: ledger.lockedBy,
          lockNote: ledger.lockNote,
        },
        after: {
          lockedAt: updated.lockedAt?.toISOString() ?? null,
          lockedBy: updated.lockedBy,
          lockNote: updated.lockNote,
        },
      });

      return {
        status: 200 as const,
        body: {
          id: updated.id,
          lockedAt: updated.lockedAt ? updated.lockedAt.toISOString() : null,
          lockedBy: updated.lockedBy,
          lockNote: updated.lockNote,
        },
      };
    });

    return res.status(response.status).json(response.body);
  } catch (error) {
    console.error('Maand kon niet worden vergrendeld', error);
    return res.status(500).json({ error: 'Maand kon niet worden vergrendeld.' });
  }
};

export const unlockLedger = async (req: Request, res: Response) => {
  if (!LOCKS_ENABLED) {
    return res.status(200).json({ message: 'Vergrendelen is uitgeschakeld.' });
  }

  const actor = requireAdmin(req, res);
  if (!actor) return;

  const { userId, actorId, actorEmail } = actor;
  const ledgerId = readRouteParam(req, 'ledgerId');

  if (!ledgerId) {
    return res.status(400).json({ error: 'Ledger id ontbreekt.' });
  }

  try {
    const response = await prisma.$transaction(async (tx) => {
      const ledger = await tx.ledger.findFirst({
        where: {
          id: ledgerId,
          userId,
        },
        include: {
          lock: true,
        },
      });

      if (!ledger) {
        return { status: 404 as const, body: { error: 'Maand niet gevonden.' } };
      }

      if (!ledger.lockedAt) {
        return {
          status: 200 as const,
          body: {
            id: ledger.id,
            lockedAt: null,
          },
        };
      }

      const updated = await tx.ledger.update({
        where: { id: ledger.id },
        data: {
          lockedAt: null,
          lockedBy: null,
          lockNote: null,
        },
      });

      await tx.ledgerLock.deleteMany({
        where: {
          ledgerId: ledger.id,
        },
      });

      await createAuditLog(tx, {
        userId,
        actorId,
        actorEmail,
        action: 'ledger.unlocked',
        entityType: 'ledger',
        entityId: ledger.id,
        before: {
          lockedAt: ledger.lockedAt?.toISOString() ?? null,
          lockedBy: ledger.lockedBy,
          lockNote: ledger.lockNote,
        },
        after: {
          lockedAt: null,
          lockedBy: null,
          lockNote: null,
        },
      });

      return {
        status: 200 as const,
        body: {
          id: updated.id,
          lockedAt: null,
        },
      };
    });

    return res.status(response.status).json(response.body);
  } catch (error) {
    console.error('Maand kon niet worden ontgrendeld', error);
    return res.status(500).json({ error: 'Maand kon niet worden ontgrendeld.' });
  }
};
