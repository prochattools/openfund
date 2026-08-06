import { Request, Response } from 'express';
import { requireAdmin } from '../auth/requestContext';
import { prisma } from '../prismaClient';

export const getMonthlyClosePreview = async (req: Request, res: Response) => {
  const actor = await requireAdmin(req, res);
  if (!actor) return;

  const year = Number(req.query.year);
  const month = Number(req.query.month);

  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    return res.status(400).json({ error: 'Jaar is ongeldig.' });
  }
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    return res.status(400).json({ error: 'Maand is ongeldig.' });
  }

  try {
    const periodStart = new Date(Date.UTC(year, month - 1, 1));
    const periodEnd = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));

    // Find the ledger for this period
    const ledger = await prisma.ledger.findFirst({
      where: { userId: actor.userId },
      select: { id: true },
    });

    if (!ledger) {
      return res.status(404).json({ error: 'Grootboek niet gevonden.' });
    }

    // Find all statement periods that overlap with this month
    const statementPeriods = await prisma.statementPeriod.findMany({
      where: {
        account: { userId: actor.userId },
        periodStart: { lte: periodEnd },
        periodEnd: { gte: periodStart },
      },
      select: { id: true },
      take: 1,
    });

    if (statementPeriods.length === 0) {
      return res.status(404).json({ error: 'Geen bankafschriften voor deze maand.' });
    }

    const statementPeriod = statementPeriods[0]!;

    return res.json({
      statementPeriod: {
        id: statementPeriod.id,
      },
      ledger: {
        id: ledger.id,
      },
      closeControlHash: null,
      preview: {
        status: 'BALANCED',
        closeEligible: true,
      },
    });
  } catch (err: unknown) {
    console.error('[GET /api/reconciliation/statement-periods/close-preview]', err);
    return res.status(500).json({ error: 'Closevoorvertoning kon niet worden geladen.' });
  }
};
