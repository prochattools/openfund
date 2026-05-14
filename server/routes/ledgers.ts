import { Request, Response } from 'express';
import { prisma } from '../prismaClient';
import { readRouteParam } from './routeParams';

const DEFAULT_USER_ID = process.env.DEFAULT_USER_ID ?? 'demo-user';
const LOCKS_ENABLED = process.env.RECONCILIATION_LOCKS_ENABLED !== 'false';

export const lockLedger = async (req: Request, res: Response) => {
  if (!LOCKS_ENABLED) {
    return res.status(200).json({ message: 'Locks disabled' });
  }

  const userId = req.header('x-user-id') ?? DEFAULT_USER_ID;
  const ledgerId = readRouteParam(req, 'ledgerId');
  const { note } = req.body as { note?: string };

  if (!ledgerId) {
    return res.status(400).json({ error: 'Ledger id ontbreekt.' });
  }

  try {
    const ledger = await prisma.ledger.findFirst({
      where: {
        id: ledgerId,
        userId,
      },
      include: {
        lock: true,
      },
    });

    if (!ledger) {
      return res.status(404).json({ error: 'Ledger not found' });
    }

    if (ledger.lockedAt) {
      return res.json({
        id: ledger.id,
        lockedAt: ledger.lockedAt.toISOString(),
        lockedBy: ledger.lockedBy,
        lockNote: ledger.lockNote,
      });
    }

    const updated = await prisma.ledger.update({
      where: { id: ledger.id },
      data: {
        lockedAt: new Date(),
        lockedBy: userId,
        lockNote: note ?? ledger.lockNote,
      },
    });

    await prisma.ledgerLock.upsert({
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

    return res.json({
      id: updated.id,
      lockedAt: updated.lockedAt ? updated.lockedAt.toISOString() : null,
      lockedBy: updated.lockedBy,
      lockNote: updated.lockNote,
    });
  } catch (error) {
    console.error('lockLedger failed', error);
    return res.status(500).json({ error: 'Failed to lock ledger' });
  }
};

export const unlockLedger = async (req: Request, res: Response) => {
  if (!LOCKS_ENABLED) {
    return res.status(200).json({ message: 'Locks disabled' });
  }

  const userId = req.header('x-user-id') ?? DEFAULT_USER_ID;
  const ledgerId = readRouteParam(req, 'ledgerId');

  if (!ledgerId) {
    return res.status(400).json({ error: 'Ledger id ontbreekt.' });
  }

  try {
    const ledger = await prisma.ledger.findFirst({
      where: {
        id: ledgerId,
        userId,
      },
      include: {
        lock: true,
      },
    });

    if (!ledger) {
      return res.status(404).json({ error: 'Ledger not found' });
    }

    if (!ledger.lockedAt) {
      return res.json({
        id: ledger.id,
        lockedAt: null,
      });
    }

    const updated = await prisma.ledger.update({
      where: { id: ledger.id },
      data: {
        lockedAt: null,
        lockedBy: null,
        lockNote: null,
      },
    });

    await prisma.ledgerLock.deleteMany({
      where: {
        ledgerId: ledger.id,
      },
    });

    return res.json({
      id: updated.id,
      lockedAt: null,
    });
  } catch (error) {
    console.error('unlockLedger failed', error);
    return res.status(500).json({ error: 'Failed to unlock ledger' });
  }
};
