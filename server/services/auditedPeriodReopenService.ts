import type { Prisma } from '@prisma/client';
import { PeriodCloseStatus } from '@prisma/client';
import { createAuditLog } from './auditLogService';
import { canonicalizeEvidence, hashEvidence } from './reviewDecisionService';

type TxClient = Prisma.TransactionClient;

export class AuditedReopenError extends Error {
  statusCode: number;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = 'AuditedReopenError';
    this.statusCode = statusCode;
  }
}

export type AuditedReopenActor = {
  userId: string;
  role?: string;
  actorId?: string | null;
  actorEmail?: string | null;
};

export type AuditedReopenInput = {
  actor: AuditedReopenActor;
  workspaceId: string;
  periodCloseId: string;
  reason: string;
};

export type AuditedReopenResult = {
  closeId: string;
  priorStatus: string;
  newStatus: string;
  reopenedAt: Date;
  revokedApprovalCount: number;
  affectedReportSnapshotIds: string[];
  sideEffects: {
    updatesPeriodClose: true;
    writesAuditLog: true;
    revokesReportApprovals: boolean;
    createsReportSnapshot: false;
    createsTransactionBooking: false;
    dispatchesReport: false;
  };
};

const assertAdminActor = (actor: AuditedReopenActor) => {
  if (actor.role && actor.role !== 'admin') {
    throw new AuditedReopenError(
      'Alleen beheerders mogen een periode heropenen.',
      403,
    );
  }
};

const assertNonEmptyReason = (reason: string) => {
  const trimmed = reason.trim();
  if (!trimmed) {
    throw new AuditedReopenError('Een heropenreden is verplicht.');
  }
};

export const executeAuditedReopen = async (
  db: TxClient,
  input: AuditedReopenInput,
): Promise<AuditedReopenResult> => {
  assertAdminActor(input.actor);
  assertNonEmptyReason(input.reason);

  const periodClose = await db.periodClose.findFirst({
    where: {
      id: input.periodCloseId,
      workspaceId: input.workspaceId,
    },
    include: {
      reportSnapshotLinks: {
        select: { reportSnapshotId: true },
      },
    },
  });

  if (!periodClose) {
    throw new AuditedReopenError('Periode-afsluiting niet gevonden.', 404);
  }

  if (periodClose.status !== PeriodCloseStatus.CLOSED) {
    throw new AuditedReopenError(
      `Alleen gesloten periodes kunnen heropend worden. Status is ${periodClose.status}.`,
      409,
    );
  }

  const priorStatus = periodClose.status;
  const reopenedAt = new Date();
  const reason = input.reason.trim();

  // Update the close record
  const reopenedClose = await db.periodClose.update({
    where: { id: input.periodCloseId },
    data: {
      status: PeriodCloseStatus.REOPENED,
      reopenedBy: input.actor.actorId ?? input.actor.userId,
      reopenedAt,
      reopenReason: reason,
    },
  });

  // Find and revoke active approvals for linked report snapshots
  const linkedSnapshotIds = periodClose.reportSnapshotLinks.map((link) => link.reportSnapshotId);
  let revokedApprovalCount = 0;
  const affectedReportSnapshotIds: string[] = [];

  if (linkedSnapshotIds.length > 0) {
    // Find all active approvals for these snapshots
    const activeApprovals = await db.reportApproval.findMany({
      where: {
        reportSnapshotId: { in: linkedSnapshotIds },
        revokedAt: null,
      },
      select: { id: true, reportSnapshotId: true },
    });

    if (activeApprovals.length > 0) {
      // Revoke them
      await db.reportApproval.updateMany({
        where: {
          id: { in: activeApprovals.map((a) => a.id) },
        },
        data: {
          revokedBy: input.actor.actorId ?? input.actor.userId,
          revokedAt: reopenedAt,
          revokeReason: `Periode heropend: ${reason}`,
        },
      });

      revokedApprovalCount = activeApprovals.length;
      affectedReportSnapshotIds.push(
        ...Array.from(new Set(activeApprovals.map((a) => a.reportSnapshotId))),
      );
    }
  }

  // Write audit log
  await createAuditLog(db, {
    userId: input.actor.userId,
    actorId: input.actor.actorId ?? input.actor.userId,
    actorEmail: input.actor.actorEmail ?? null,
    action: 'period.close.reopened',
    entityType: 'periodClose',
    entityId: input.periodCloseId,
    before: toInputJson({ status: priorStatus }),
    after: toInputJson({
      status: PeriodCloseStatus.REOPENED,
      reopenedAt,
      reopenReason: reason,
    }),
    metadata: toInputJson({
      source: 'audited-reopen-service',
      linkedReportSnapshotCount: linkedSnapshotIds.length,
      revokedApprovalCount,
    }),
  });

  return {
    closeId: reopenedClose.id,
    priorStatus,
    newStatus: reopenedClose.status,
    reopenedAt,
    revokedApprovalCount,
    affectedReportSnapshotIds,
    sideEffects: {
      updatesPeriodClose: true,
      writesAuditLog: true,
      revokesReportApprovals: revokedApprovalCount > 0,
      createsReportSnapshot: false,
      createsTransactionBooking: false,
      dispatchesReport: false,
    },
  };
};

const toInputJson = (value: unknown): Prisma.InputJsonValue =>
  JSON.parse(canonicalizeEvidence(value)) as Prisma.InputJsonValue;
