import crypto from 'node:crypto';
import {
  BookingSource,
  Prisma,
  ReviewDecisionAction,
  WorkspaceRole,
} from '@prisma/client';
import { createAuditLog } from './auditLogService';
import type { AppRole } from '../auth/requestContext';

export const BULK_CONFIRMATION_DISABLED_MESSAGE =
  'Bulk goedkeuren is uitgeschakeld. Beoordeel elke transactie afzonderlijk met Klant, Type en Categorie.';

export const INCOMPLETE_DIMENSIONS_MESSAGE =
  'Klant, type en categorie zijn verplicht voordat een transactie financieel kan worden geboekt.';

export class ReviewDecisionError extends Error {
  statusCode: number;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = 'ReviewDecisionError';
    this.statusCode = statusCode;
  }
}

type TxClient = Prisma.TransactionClient;

export type ReviewDecisionActor = {
  userId: string;
  role?: AppRole;
  actorId?: string | null;
  actorEmail?: string | null;
};

export type AssignManualBookingInput = {
  actor: ReviewDecisionActor;
  transactionId: string;
  projectId: string;
  transactionTypeId: string;
  categoryId: string;
  reason?: string | null;
};

export type ReviewAssignmentPayload = {
  projectId?: string | null;
  transactionTypeId?: string | null;
  categoryId?: string | null;
};

export const isCompleteReviewAssignmentPayload = (
  payload: ReviewAssignmentPayload,
): payload is Required<ReviewAssignmentPayload> =>
  Boolean(payload.projectId && payload.transactionTypeId && payload.categoryId);

export const rejectUnsafeBulkConfirmation = (): never => {
  throw new ReviewDecisionError(BULK_CONFIRMATION_DISABLED_MESSAGE, 409);
};

const stableValue = (value: unknown): unknown => {
  if (value === undefined) return null;
  if (value === null) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'bigint') return value.toString();
  if (Array.isArray(value)) return value.map(stableValue);
  if (typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, entryValue]) => entryValue !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entryValue]) => [key, stableValue(entryValue)]),
    );
  }

  return value;
};

export const canonicalizeEvidence = (evidence: unknown): string =>
  JSON.stringify(stableValue(evidence));

export const hashEvidence = (evidence: unknown): string =>
  crypto.createHash('sha256').update(canonicalizeEvidence(evidence)).digest('hex');

const toInputJson = (value: unknown): Prisma.InputJsonValue =>
  JSON.parse(canonicalizeEvidence(value)) as Prisma.InputJsonValue;

const assertAdminActor = (actor: ReviewDecisionActor) => {
  if (actor.role && actor.role !== 'admin') {
    throw new ReviewDecisionError('Alleen beheerders mogen deze actie uitvoeren.', 403);
  }
};

const assertUnlockedLedger = (transaction: { ledger?: { lockedAt: Date | null } | null }) => {
  if (process.env.RECONCILIATION_LOCKS_ENABLED !== 'false' && transaction.ledger?.lockedAt) {
    throw new ReviewDecisionError(
      'Deze maand is vergrendeld. Ontgrendel de maand voordat je deze transactie wijzigt.',
      423,
    );
  }
};

const assertSameWorkspace = (
  workspaceIds: Array<string | null | undefined>,
): string => {
  const [firstWorkspaceId, ...remainingWorkspaceIds] = workspaceIds;
  if (!firstWorkspaceId || remainingWorkspaceIds.some((workspaceId) => workspaceId !== firstWorkspaceId)) {
    throw new ReviewDecisionError('Klant, type en categorie moeten bij dezelfde werkruimte horen.', 400);
  }

  return firstWorkspaceId;
};

export const assignManualBooking = async (db: TxClient, input: AssignManualBookingInput) => {
  assertAdminActor(input.actor);

  if (!isCompleteReviewAssignmentPayload(input)) {
    throw new ReviewDecisionError(INCOMPLETE_DIMENSIONS_MESSAGE, 400);
  }

  const transaction = await db.transaction.findFirst({
    where: {
      id: input.transactionId,
      userId: input.actor.userId,
    },
    include: {
      ledger: {
        select: {
          lockedAt: true,
        },
      },
      transactionBooking: true,
    },
  });

  if (!transaction) {
    throw new ReviewDecisionError('Transactie niet gevonden.', 404);
  }

  assertUnlockedLedger(transaction);

  const [project, transactionType, category] = await Promise.all([
    db.project.findUnique({ where: { id: input.projectId } }),
    db.transactionType.findUnique({ where: { id: input.transactionTypeId } }),
    db.category.findUnique({ where: { id: input.categoryId } }),
  ]);

  if (!project || !transactionType || !category) {
    throw new ReviewDecisionError(INCOMPLETE_DIMENSIONS_MESSAGE, 400);
  }

  const workspaceId = assertSameWorkspace([
    project.workspaceId,
    transactionType.workspaceId,
    category.workspaceId,
  ]);

  const membership = await db.workspaceMembership.findFirst({
    where: {
      workspaceId,
      userId: input.actor.userId,
      role: WorkspaceRole.ADMIN,
      isActive: true,
    },
  });

  if (!membership) {
    throw new ReviewDecisionError('Alleen actieve beheerders mogen deze boeking wijzigen.', 403);
  }

  const actorId = input.actor.actorId ?? input.actor.userId;
  const actorEmail = input.actor.actorEmail ?? null;
  const decidedAt = new Date();
  const beforeBooking = transaction.transactionBooking ?? null;
  const beforeProjectId = beforeBooking?.projectId ?? transaction.projectId ?? null;
  const beforeTypeId = beforeBooking?.transactionTypeId ?? transaction.transactionTypeId ?? null;
  const beforeCategoryId = beforeBooking?.categoryId ?? transaction.categoryId ?? null;

  const evidence = toInputJson({
    action: ReviewDecisionAction.ASSIGN_MANUALLY,
    actorId,
    after: {
      categoryId: category.id,
      projectId: project.id,
      transactionTypeId: transactionType.id,
    },
    before: {
      categoryId: beforeCategoryId,
      projectId: beforeProjectId,
      transactionTypeId: beforeTypeId,
    },
    reason: input.reason ?? null,
    transactionId: transaction.id,
    workspaceId,
  });
  const evidenceHash = hashEvidence(evidence);

  const booking = await db.transactionBooking.upsert({
    where: { transactionId: transaction.id },
    create: {
      workspaceId,
      transactionId: transaction.id,
      projectId: project.id,
      transactionTypeId: transactionType.id,
      categoryId: category.id,
      source: BookingSource.MANUAL,
      evidence,
      evidenceHash,
      confirmedBy: actorId,
      confirmedAt: decidedAt,
      literalProjectLabel: project.name,
      literalTypeLabel: transactionType.literalName,
      literalCategoryLabel: category.name,
    },
    update: {
      workspaceId,
      projectId: project.id,
      transactionTypeId: transactionType.id,
      categoryId: category.id,
      source: BookingSource.MANUAL,
      ruleId: null,
      historicalSourceTransactionId: null,
      historicalMatchKey: null,
      evidence,
      evidenceHash,
      confirmedBy: actorId,
      confirmedAt: decidedAt,
      literalProjectLabel: project.name,
      literalTypeLabel: transactionType.literalName,
      literalCategoryLabel: category.name,
    },
  });

  const decision = await db.reviewDecision.create({
    data: {
      workspaceId,
      transactionId: transaction.id,
      action: ReviewDecisionAction.ASSIGN_MANUALLY,
      beforeBookingId: beforeBooking?.id ?? null,
      beforeProjectId,
      beforeTypeId,
      beforeCategoryId,
      afterBookingId: booking.id,
      afterProjectId: project.id,
      afterTypeId: transactionType.id,
      afterCategoryId: category.id,
      actorId,
      actorEmail,
      reason: input.reason ?? null,
      evidence,
      evidenceHash,
      decidedAt,
    },
  });

  const updatedTransaction = await db.transaction.update({
    where: { id: transaction.id },
    data: {
      projectId: project.id,
      transactionTypeId: transactionType.id,
      categoryId: category.id,
      classificationSource: 'manual',
      classificationRuleId: null,
    },
    include: {
      category: true,
      project: true,
      transactionType: true,
      transactionBooking: true,
    },
  });

  await createAuditLog(db, {
    userId: input.actor.userId,
    actorId,
    actorEmail,
    action: 'transaction.booking.assigned',
    entityType: 'transaction',
    entityId: transaction.id,
    before: {
      bookingId: beforeBooking?.id ?? null,
      categoryId: beforeCategoryId,
      projectId: beforeProjectId,
      transactionTypeId: beforeTypeId,
    },
    after: {
      bookingId: booking.id,
      categoryId: category.id,
      projectId: project.id,
      transactionTypeId: transactionType.id,
      reviewDecisionId: decision.id,
    },
    metadata: {
      evidenceHash,
      source: 'review-decision-service',
    },
  });

  return {
    booking,
    decision,
    transaction: updatedTransaction,
  };
};
