/**
 * REPORT-005: Report approval and dispatch.
 *
 * Approval:
 *   - Requires administrator action after snapshot and artifact generation.
 *   - Stores reportSnapshotId, approvedBy, approvedAt, snapshotHash.
 *   - Rejects stale snapshot hash.
 *   - Rejects revoked approvals.
 *   - Dispatch preparation requires an active (non-revoked) approval.
 *
 * Dispatch:
 *   - prepareDispatch: metadata-only mode (no provider call). Status PENDING.
 *   - executeDispatch: sends via injected provider after all guards pass.
 *     Updates status to SENT or FAILED.
 *   - Blocked when approval is revoked (e.g. after period reopen via CLOSE-004).
 */

import type { Prisma } from '@prisma/client';
import { DispatchStatus, PeriodCloseStatus } from '@prisma/client';
import { hashEvidence } from './reviewDecisionService';
import { approveReportSnapshot, createReportDispatch } from './periodCloseService';
import type { ReportEmailProvider } from './reportEmailProvider';

export class ReportApprovalError extends Error {
  statusCode: number;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = 'ReportApprovalError';
    this.statusCode = statusCode;
  }
}

type TxClient = Prisma.TransactionClient;

// ─── Input / result types ─────────────────────────────────────────────────────

export type ApprovalActor = {
  userId: string;
  role?: string;
  actorId?: string | null;
};

export type ApproveSnapshotInput = {
  actor: ApprovalActor;
  workspaceId: string;
  reportSnapshotId: string;
  /** The caller supplies the expected snapshotHash to detect staleness. */
  expectedSnapshotHash: string;
};

export type ApproveSnapshotResult = {
  approvalId: string;
  reportSnapshotId: string;
  approvedBy: string;
  approvedAt: Date;
  snapshotHash: string;
  sideEffects: {
    createsReportApproval: true;
    dispatchesReport: false;
    sendsEmail: false;
  };
};

export type PrepareDispatchInput = {
  actor: ApprovalActor;
  workspaceId: string;
  reportSnapshotId: string;
  reportApprovalId: string;
  deliveryKey: string;
  fromAddress: string;
  subject: string;
  recipients: Array<{ email: string; name: string | null }>;
  recipientHash: string;
  /** Hash of the content that would be sent (artifact sha256s combined). */
  contentHash: string;
};

export type PrepareDispatchResult = {
  dispatchId: string;
  reportSnapshotId: string;
  reportApprovalId: string;
  status: 'PENDING';
  recipientHash: string;
  contentHash: string;
  sideEffects: {
    createsReportDispatch: true;
    sendsEmail: false;
    callsExternalProvider: false;
  };
};

export type ExecuteDispatchInput = {
  actor: ApprovalActor;
  workspaceId: string;
  reportSnapshotId: string;
  reportApprovalId: string;
  dispatchId: string;
  fromAddress: string;
  subject: string;
  recipients: Array<{ email: string; name?: string | null }>;
  contentHash: string;
  html: string;
  provider: ReportEmailProvider;
  attachments?: Array<{ filename: string; content: Buffer }>;
};

export type ExecuteDispatchResult = {
  dispatchId: string;
  status: 'SENT' | 'FAILED';
  providerMessageId: string | null;
  errorMessage: string | null;
  sideEffects: {
    sendsEmail: boolean;
    callsExternalProvider: boolean;
  };
};

// ─── Guards ───────────────────────────────────────────────────────────────────

const assertAdminActor = (actor: ApprovalActor, action: string) => {
  if (actor.role && actor.role !== 'admin') {
    throw new ReportApprovalError(
      `Alleen beheerders mogen ${action}.`,
      403,
    );
  }
};

// ─── REPORT-005: Approve snapshot ────────────────────────────────────────────

/**
 * Approve a report snapshot.
 *
 * Rejects if:
 *   - The actor is not an admin.
 *   - The snapshot does not exist in the workspace.
 *   - The snapshotHash does not match the stored hash (stale data).
 *   - An active (non-revoked) approval with the same hash already exists.
 *   - Any linked period close is in REOPENED status (approval would be stale).
 */
export const approveSnapshot = async (
  db: TxClient,
  input: ApproveSnapshotInput,
): Promise<ApproveSnapshotResult> => {
  assertAdminActor(input.actor, 'rapporten goedkeuren');

  const snapshot = await db.reportSnapshot.findFirst({
    where: {
      id: input.reportSnapshotId,
      workspaceId: input.workspaceId,
    },
    include: {
      periodCloseLinks: {
        include: {
          periodClose: {
            select: { id: true, status: true },
          },
        },
      },
    },
  });

  if (!snapshot) {
    throw new ReportApprovalError(
      'Rapportage-snapshot niet gevonden in werkruimte.',
      404,
    );
  }

  // Reject stale hash
  if (snapshot.snapshotHash !== input.expectedSnapshotHash) {
    throw new ReportApprovalError(
      'De opgegeven snapshot-hash is verouderd. Haal de snapshot opnieuw op voordat u goedkeurt.',
      409,
    );
  }

  // Reject if any linked period close is reopened
  const reopenedLinks = snapshot.periodCloseLinks.filter(
    (link) => link.periodClose.status === PeriodCloseStatus.REOPENED,
  );
  if (reopenedLinks.length > 0) {
    const ids = reopenedLinks.map((l) => l.periodClose.id).join(', ');
    throw new ReportApprovalError(
      `De gekoppelde periode-afsluiting(en) zijn heropend: ${ids}. ` +
      `Sluit de periode(s) opnieuw af voordat u het rapport goedkeurt.`,
      409,
    );
  }

  // Reject duplicate active approval for same hash (idempotency guard)
  const existingActiveApproval = await db.reportApproval.findFirst({
    where: {
      reportSnapshotId: input.reportSnapshotId,
      snapshotHash: snapshot.snapshotHash,
      revokedAt: null,
    },
  });
  if (existingActiveApproval) {
    throw new ReportApprovalError(
      'Er bestaat al een actieve goedkeuring voor deze snapshot-hash.',
      409,
    );
  }

  const actorId = input.actor.actorId ?? input.actor.userId;
  const approval = await approveReportSnapshot(db, {
    reportSnapshotId: input.reportSnapshotId,
    approvedBy: actorId,
  });

  return {
    approvalId: approval.id,
    reportSnapshotId: input.reportSnapshotId,
    approvedBy: actorId,
    approvedAt: approval.approvedAt,
    snapshotHash: approval.snapshotHash,
    sideEffects: {
      createsReportApproval: true,
      dispatchesReport: false,
      sendsEmail: false,
    },
  };
};

// ─── REPORT-005: Prepare dispatch ────────────────────────────────────────────

/**
 * Prepare a dispatch metadata record (PENDING status).
 *
 * Rejects if:
 *   - The actor is not an admin.
 *   - The snapshot does not exist in the workspace.
 *   - The approval does not belong to the snapshot.
 *   - The approval is revoked (e.g. after period reopen).
 *   - No recipients are supplied.
 *
 * Does NOT send email. Does NOT call any external provider.
 * Dispatch status is always PENDING after this call.
 *
 * The deliveryKey and recipientHash are pre-computed by the caller, ensuring
 * a single canonical normalization point.
 */
export const prepareDispatch = async (
  db: TxClient,
  input: PrepareDispatchInput,
): Promise<PrepareDispatchResult> => {
  assertAdminActor(input.actor, 'rapporten verzenden');

  if (!input.recipients.length) {
    throw new ReportApprovalError('Rapportverzending vereist minimaal één ontvanger.', 400);
  }

  // Verify snapshot belongs to workspace
  const snapshot = await db.reportSnapshot.findFirst({
    where: {
      id: input.reportSnapshotId,
      workspaceId: input.workspaceId,
    },
    select: { id: true, snapshotHash: true },
  });
  if (!snapshot) {
    throw new ReportApprovalError('Rapportage-snapshot niet gevonden in werkruimte.', 404);
  }

  // Verify approval is active (not revoked)
  const approval = await db.reportApproval.findFirst({
    where: {
      id: input.reportApprovalId,
      reportSnapshotId: input.reportSnapshotId,
      revokedAt: null,
    },
  });
  if (!approval) {
    throw new ReportApprovalError(
      'Een actieve goedkeuring is vereist voordat het rapport kan worden verzonden. ' +
      'De goedkeuring is niet gevonden of is ingetrokken.',
      409,
    );
  }

  const actorId = input.actor.actorId ?? input.actor.userId;

  const dispatch = await createReportDispatch(db, {
    reportSnapshotId: input.reportSnapshotId,
    reportApprovalId: input.reportApprovalId,
    deliveryKey: input.deliveryKey,
    fromAddress: input.fromAddress,
    subject: input.subject,
    recipients: input.recipients,
    recipientHash: input.recipientHash,
    contentHash: input.contentHash,
    sentBy: actorId,
  });

  return {
    dispatchId: dispatch.id,
    reportSnapshotId: input.reportSnapshotId,
    reportApprovalId: input.reportApprovalId,
    status: 'PENDING',
    recipientHash: input.recipientHash,
    contentHash: input.contentHash,
    sideEffects: {
      createsReportDispatch: true,
      sendsEmail: false,
      callsExternalProvider: false,
    },
  };
};

// ─── REPORT-005: Execute dispatch (real send) ───────────────────────────────

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const normalizeRecipientEmails = (
  recipients: Array<{ email: string; name?: string | null }>,
): string[] => {
  return recipients
    .map((r) => r.email.trim().toLowerCase())
    .filter((e) => EMAIL_REGEX.test(e));
};

/**
 * Execute a real email dispatch via the injected provider.
 *
 * Guards:
 *   - Admin actor required.
 *   - Snapshot must exist in workspace.
 *   - Approval must be active (not revoked).
 *   - Dispatch must exist and be in PENDING status.
 *   - Recipients must be non-empty and valid.
 *   - fromAddress and subject required.
 *   - contentHash required.
 *
 * On success: updates dispatch status to SENT.
 * On failure: updates dispatch status to FAILED with sanitized error.
 */
export const executeDispatch = async (
  db: TxClient,
  input: ExecuteDispatchInput,
): Promise<ExecuteDispatchResult> => {
  assertAdminActor(input.actor, 'rapporten verzenden');

  if (!input.fromAddress) {
    throw new ReportApprovalError('Afzenderadres is verplicht.', 400);
  }
  if (!input.subject) {
    throw new ReportApprovalError('Onderwerp is verplicht.', 400);
  }
  if (!input.contentHash) {
    throw new ReportApprovalError('Content-hash is verplicht.', 400);
  }
  if (!input.recipients.length) {
    throw new ReportApprovalError('Rapportverzending vereist minimaal één ontvanger.', 400);
  }

  const normalizedEmails = normalizeRecipientEmails(input.recipients);
  if (!normalizedEmails.length) {
    throw new ReportApprovalError('Geen geldige e-mailadressen opgegeven.', 400);
  }

  // Verify snapshot belongs to workspace
  const snapshot = await db.reportSnapshot.findFirst({
    where: {
      id: input.reportSnapshotId,
      workspaceId: input.workspaceId,
    },
    select: { id: true },
  });
  if (!snapshot) {
    throw new ReportApprovalError('Rapportage-snapshot niet gevonden in werkruimte.', 404);
  }

  // Verify approval is active (not revoked)
  const approval = await db.reportApproval.findFirst({
    where: {
      id: input.reportApprovalId,
      reportSnapshotId: input.reportSnapshotId,
      revokedAt: null,
    },
  });
  if (!approval) {
    throw new ReportApprovalError(
      'Een actieve goedkeuring is vereist voordat het rapport kan worden verzonden. ' +
      'De goedkeuring is niet gevonden of is ingetrokken.',
      409,
    );
  }

  // Verify dispatch exists and is PENDING
  const dispatch = await db.reportDispatch.findFirst({
    where: {
      id: input.dispatchId,
      reportSnapshotId: input.reportSnapshotId,
      reportApprovalId: input.reportApprovalId,
      status: DispatchStatus.PENDING,
    },
  });
  if (!dispatch) {
    throw new ReportApprovalError(
      'Dispatch niet gevonden of niet in PENDING-status.',
      409,
    );
  }

  // Execute provider call
  const result = await input.provider.send({
    from: input.fromAddress,
    to: normalizedEmails,
    subject: input.subject,
    html: input.html,
    attachments: input.attachments,
  });

  // Update dispatch status
  const newStatus = result.success ? DispatchStatus.SENT : DispatchStatus.FAILED;
  await db.reportDispatch.update({
    where: { id: input.dispatchId },
    data: {
      status: newStatus,
      providerMessageId: result.providerMessageId,
      sentAt: result.success ? new Date() : null,
      errorMessage: result.errorMessage,
    },
  });

  return {
    dispatchId: input.dispatchId,
    status: newStatus as 'SENT' | 'FAILED',
    providerMessageId: result.providerMessageId,
    errorMessage: result.errorMessage,
    sideEffects: {
      sendsEmail: result.success,
      callsExternalProvider: true,
    },
  };
};
