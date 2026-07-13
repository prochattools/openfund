import { Request, Response } from 'express';
import { requireAdmin } from '../auth/requestContext';
import { prisma } from '../prismaClient';
import { executeAuditedReopen, AuditedReopenError } from '../services/auditedPeriodReopenService';

export const postAuditedPeriodReopen = async (req: Request, res: Response) => {
  const actor = await requireAdmin(req, res);
  if (!actor) return;

  const periodCloseId = typeof req.params.id === 'string' ? req.params.id : '';
  if (!periodCloseId) {
    return res.status(400).json({ error: 'Periode-afsluitings-ID is verplicht.' });
  }

  const { reason } = req.body as { reason?: string };
  if (!reason || typeof reason !== 'string' || !reason.trim()) {
    return res.status(400).json({ error: 'Een heropenreden is verplicht.' });
  }

  const workspaceId = req.header('x-workspace-id') ?? req.body.workspaceId;
  if (!workspaceId || typeof workspaceId !== 'string') {
    return res.status(400).json({ error: 'Werkruimte-ID is verplicht.' });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      return executeAuditedReopen(tx, {
        actor: {
          userId: actor.userId,
          role: actor.role,
          actorId: actor.actorId,
          actorEmail: actor.actorEmail,
        },
        workspaceId,
        periodCloseId,
        reason,
      });
    });

    return res.status(200).json({
      closeId: result.closeId,
      priorStatus: result.priorStatus,
      newStatus: result.newStatus,
      reopenedAt: result.reopenedAt.toISOString(),
      revokedApprovalCount: result.revokedApprovalCount,
      affectedReportSnapshotIds: result.affectedReportSnapshotIds,
      sideEffects: result.sideEffects,
    });
  } catch (error) {
    if (error instanceof AuditedReopenError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.error('Periode kon niet heropend worden', error);
    return res.status(500).json({ error: 'Periode kon niet heropend worden.' });
  }
};
