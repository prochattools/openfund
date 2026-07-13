import { Request, Response } from 'express';
import { requireAdmin } from '../auth/requestContext';
import { prisma } from '../prismaClient';
import { executeStrictPeriodClose, StrictPeriodCloseError } from '../services/strictPeriodCloseService';
import { PeriodCloseError } from '../services/periodCloseService';
import { StatementReconciliationControlError } from '../services/statementReconciliationControlService';

export const postStrictPeriodClose = async (req: Request, res: Response) => {
  const actor = await requireAdmin(req, res);
  if (!actor) return;

  const statementPeriodId = typeof req.params.id === 'string' ? req.params.id : '';
  if (!statementPeriodId) {
    return res.status(400).json({ error: 'Afschriftperiode-ID is verplicht.' });
  }

  const { ledgerId, expectedCloseControlHash, confirmed } = req.body as {
    ledgerId?: string;
    expectedCloseControlHash?: string | null;
    confirmed?: boolean;
  };

  if (!ledgerId || typeof ledgerId !== 'string') {
    return res.status(400).json({ error: 'Grootboek-ID is verplicht.' });
  }

  const workspaceId = req.header('x-workspace-id') ?? req.body.workspaceId;
  if (!workspaceId || typeof workspaceId !== 'string') {
    return res.status(400).json({ error: 'Werkruimte-ID is verplicht.' });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      return executeStrictPeriodClose(tx, {
        actor: {
          userId: actor.userId,
          role: actor.role,
          actorId: actor.actorId,
          actorEmail: actor.actorEmail,
        },
        workspaceId,
        ledgerId,
        statementPeriodId,
        expectedCloseControlHash: expectedCloseControlHash ?? null,
        confirmed: confirmed === true,
      });
    });

    return res.status(201).json({
      closeId: result.closeId,
      version: result.version,
      statementPeriodId: result.statementPeriodId,
      ledgerId: result.ledgerId,
      periodStart: result.periodStart,
      periodEnd: result.periodEnd,
      closeControlHash: result.closeControlHash,
      combinedStatus: result.combinedPreview.combinedStatus,
      combinedCloseEligible: result.combinedPreview.combinedCloseEligible,
      sideEffects: result.sideEffects,
    });
  } catch (error) {
    if (error instanceof StrictPeriodCloseError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    if (error instanceof PeriodCloseError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    if (error instanceof StatementReconciliationControlError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.error('Periode kon niet worden gesloten', error);
    return res.status(500).json({ error: 'Periode kon niet worden gesloten.' });
  }
};
