import {
  Prisma,
  PrismaClient,
  ReviewDecisionAction,
} from '@prisma/client';
import { createAuditLog } from './auditLogService';
import { canonicalizeEvidence, hashEvidence } from './reviewDecisionService';

export const MANUAL_BOOKING_REOPEN_VERSION = 'manual-booking-reopen-v1';

export class ManualBookingReopenError extends Error {
  code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'ManualBookingReopenError';
    this.code = code;
  }
}

type ReadDb = PrismaClient | Prisma.TransactionClient;

export type ManualBookingReopenCriteria = {
  workspaceId: string;
  userId: string;
  expectedAmountMinor: bigint;
  expectedDirection: 'credit' | 'debit';
  expectedMerchantNeedle: string;
  expectedUnresolvedBefore: number;
};

export type ManualBookingReopenPlan = {
  version: typeof MANUAL_BOOKING_REOPEN_VERSION;
  planHash: string;
  workspaceId: string;
  userId: string;
  transactionId: string;
  bookingId: string;
  originalDecisionId: string;
  originalDecisionEvidenceHash: string;
  bookingEvidenceHash: string;
  transactionDate: string;
  amountMinor: string;
  direction: 'credit' | 'debit';
  merchantMatched: true;
  decisionCountForTransaction: 1;
  bookingReferenceDecisionCount: 1;
  counts: {
    totalTransactions: number;
    confirmedBookingsBefore: number;
    unresolvedBefore: number;
    confirmedBookingsAfter: number;
    unresolvedAfter: number;
  };
  sideEffects: {
    writesPerformed: false;
    deletesCurrentBooking: true;
    createsCompensatingReviewDecision: true;
    resetsTransactionClassification: true;
    mutatesImportedBankFacts: false;
    mutatesSuggestions: false;
  };
};

const toInputJson = (value: unknown): Prisma.InputJsonValue =>
  JSON.parse(canonicalizeEvidence(value)) as Prisma.InputJsonValue;

const normalize = (value: string | null | undefined): string =>
  (value ?? '').normalize('NFKC').trim().toLowerCase();

const decisionMatchesCriteria = (
  decision: NonNullable<Awaited<ReturnType<ReadDb['reviewDecision']['findFirst']>>>,
  criteria: ManualBookingReopenCriteria,
): boolean => {
  const transaction = (decision as any).transaction;
  const merchantHaystack = normalize([
    transaction.counterparty,
    transaction.description,
    transaction.reference,
  ].filter(Boolean).join(' '));
  const merchantNeedle = normalize(criteria.expectedMerchantNeedle);

  return transaction.amountMinor === criteria.expectedAmountMinor
    && transaction.direction === criteria.expectedDirection
    && Boolean(merchantNeedle)
    && merchantHaystack.includes(merchantNeedle);
};

export const buildLatestManualBookingReopenPlan = async (
  db: ReadDb,
  criteria: ManualBookingReopenCriteria,
): Promise<ManualBookingReopenPlan> => {
  const candidateDecisions = await db.reviewDecision.findMany({
    where: {
      workspaceId: criteria.workspaceId,
      action: ReviewDecisionAction.ASSIGN_MANUALLY,
      transaction: {
        userId: criteria.userId,
        amountMinor: criteria.expectedAmountMinor,
        direction: criteria.expectedDirection,
      },
    },
    orderBy: [{ decidedAt: 'desc' }, { id: 'desc' }],
    include: {
      transaction: {
        include: {
          ledger: { select: { lockedAt: true } },
          transactionBooking: true,
        },
      },
    },
  });

  const matchingDecisions = candidateDecisions.filter((decision) =>
    decisionMatchesCriteria(decision as any, criteria)
    && Boolean(decision.transaction.transactionBooking)
    && decision.afterBookingId === decision.transaction.transactionBooking?.id,
  );

  if (matchingDecisions.length === 0) {
    throw new ManualBookingReopenError(
      'MATCHING_CONFIRMATION_NOT_FOUND',
      'No current booked confirmation matches the explicitly authorized amount, direction, and merchant.',
    );
  }
  if (matchingDecisions.length !== 1) {
    throw new ManualBookingReopenError(
      'MATCHING_CONFIRMATION_AMBIGUOUS',
      'More than one current booked confirmation matches the authorized facts.',
    );
  }

  const latestDecision = matchingDecisions[0]!;
  const transaction = latestDecision.transaction;
  const booking = transaction.transactionBooking;

  if (!booking || latestDecision.afterBookingId !== booking.id) {
    throw new ManualBookingReopenError(
      'CURRENT_BOOKING_NOT_FOUND',
      'The latest confirmation no longer points to the transaction current booking.',
    );
  }

  if (process.env.RECONCILIATION_LOCKS_ENABLED !== 'false' && transaction.ledger?.lockedAt) {
    throw new ManualBookingReopenError(
      'LEDGER_LOCKED',
      'The transaction ledger is locked and cannot be reopened.',
    );
  }

  if (
    latestDecision.beforeBookingId
    || latestDecision.beforeProjectId
    || latestDecision.beforeTypeId
    || latestDecision.beforeCategoryId
  ) {
    throw new ManualBookingReopenError(
      'NONEMPTY_BEFORE_STATE',
      'The latest confirmation replaced an earlier classification and cannot use the one-off reopen path.',
    );
  }

  const [decisionCountForTransaction, bookingReferenceDecisionCount, totalTransactions, confirmedBookingsBefore, unresolvedBefore] = await Promise.all([
    db.reviewDecision.count({
      where: { workspaceId: criteria.workspaceId, transactionId: transaction.id },
    }),
    db.reviewDecision.count({
      where: {
        OR: [
          { beforeBookingId: booking.id },
          { afterBookingId: booking.id },
        ],
      },
    }),
    db.transaction.count({ where: { userId: criteria.userId } }),
    db.transactionBooking.count({
      where: { transaction: { userId: criteria.userId } },
    }),
    db.transaction.count({
      where: { userId: criteria.userId, transactionBooking: null },
    }),
  ]);

  if (decisionCountForTransaction !== 1) {
    throw new ManualBookingReopenError(
      'MULTIPLE_TRANSACTION_DECISIONS',
      'The transaction has more than one review decision and requires the future full edit-history feature.',
    );
  }

  if (bookingReferenceDecisionCount !== 1) {
    throw new ManualBookingReopenError(
      'BOOKING_HAS_MULTIPLE_DECISION_REFERENCES',
      'The current booking has unexpected review-decision references and cannot be safely removed.',
    );
  }

  if (unresolvedBefore !== criteria.expectedUnresolvedBefore) {
    throw new ManualBookingReopenError(
      'UNRESOLVED_COUNT_MISMATCH',
      `Expected ${criteria.expectedUnresolvedBefore} unresolved transactions but found ${unresolvedBefore}.`,
    );
  }

  const hashPayload = {
    version: MANUAL_BOOKING_REOPEN_VERSION,
    workspaceId: criteria.workspaceId,
    userId: criteria.userId,
    transactionId: transaction.id,
    bookingId: booking.id,
    originalDecisionId: latestDecision.id,
    originalDecisionEvidenceHash: latestDecision.evidenceHash,
    bookingEvidenceHash: booking.evidenceHash,
    decidedAt: latestDecision.decidedAt,
    transactionUpdatedAt: transaction.updatedAt,
    amountMinor: transaction.amountMinor,
    direction: transaction.direction,
    unresolvedBefore,
    confirmedBookingsBefore,
  };

  return {
    version: MANUAL_BOOKING_REOPEN_VERSION,
    planHash: hashEvidence(hashPayload),
    workspaceId: criteria.workspaceId,
    userId: criteria.userId,
    transactionId: transaction.id,
    bookingId: booking.id,
    originalDecisionId: latestDecision.id,
    originalDecisionEvidenceHash: latestDecision.evidenceHash,
    bookingEvidenceHash: booking.evidenceHash,
    transactionDate: transaction.date.toISOString(),
    amountMinor: transaction.amountMinor.toString(),
    direction: transaction.direction,
    merchantMatched: true,
    decisionCountForTransaction: 1,
    bookingReferenceDecisionCount: 1,
    counts: {
      totalTransactions,
      confirmedBookingsBefore,
      unresolvedBefore,
      confirmedBookingsAfter: confirmedBookingsBefore - 1,
      unresolvedAfter: unresolvedBefore + 1,
    },
    sideEffects: {
      writesPerformed: false,
      deletesCurrentBooking: true,
      createsCompensatingReviewDecision: true,
      resetsTransactionClassification: true,
      mutatesImportedBankFacts: false,
      mutatesSuggestions: false,
    },
  };
};

export type ExecuteManualBookingReopenInput = ManualBookingReopenCriteria & {
  actorId: string;
  actorEmail?: string | null;
  confirmedPlanHash: string;
};

export const executeLatestManualBookingReopen = async (
  db: PrismaClient,
  input: ExecuteManualBookingReopenInput,
) => {
  const outerPlan = await buildLatestManualBookingReopenPlan(db, input);
  if (outerPlan.planHash !== input.confirmedPlanHash) {
    return { status: 'HASH_DRIFT' as const, writesPerformed: false, plan: outerPlan };
  }

  return db.$transaction(async (tx) => {
    const plan = await buildLatestManualBookingReopenPlan(tx, input);
    if (plan.planHash !== input.confirmedPlanHash) {
      return { status: 'HASH_DRIFT' as const, writesPerformed: false, plan };
    }

    const booking = await tx.transactionBooking.findUnique({
      where: { id: plan.bookingId },
    });
    if (!booking) {
      throw new ManualBookingReopenError('CURRENT_BOOKING_NOT_FOUND', 'The current booking disappeared before execution.');
    }

    await tx.reviewDecision.update({
      where: { id: plan.originalDecisionId },
      data: { afterBookingId: null },
    });

    const evidence = toInputJson({
      action: ReviewDecisionAction.REMOVE_BOOKING,
      actorId: input.actorId,
      after: {
        bookingId: null,
        categoryId: null,
        projectId: null,
        transactionTypeId: null,
      },
      before: {
        bookingId: booking.id,
        categoryId: booking.categoryId,
        projectId: booking.projectId,
        transactionTypeId: booking.transactionTypeId,
      },
      originalDecisionId: plan.originalDecisionId,
      reason: 'Owner-requested correction of the latest confirmed counter-transaction.',
      transactionId: plan.transactionId,
      workspaceId: input.workspaceId,
    });
    const evidenceHash = hashEvidence(evidence);

    const reversalDecision = await tx.reviewDecision.create({
      data: {
        workspaceId: input.workspaceId,
        transactionId: plan.transactionId,
        action: ReviewDecisionAction.REMOVE_BOOKING,
        beforeBookingId: null,
        beforeProjectId: booking.projectId,
        beforeTypeId: booking.transactionTypeId,
        beforeCategoryId: booking.categoryId,
        afterBookingId: null,
        afterProjectId: null,
        afterTypeId: null,
        afterCategoryId: null,
        actorId: input.actorId,
        actorEmail: input.actorEmail ?? null,
        reason: 'Owner-requested correction of the latest confirmed counter-transaction.',
        evidence,
        evidenceHash,
      },
    });

    await tx.transactionBooking.delete({ where: { id: booking.id } });
    await tx.transaction.update({
      where: { id: plan.transactionId },
      data: {
        projectId: null,
        transactionTypeId: null,
        categoryId: null,
        classificationSource: 'none',
        classificationRuleId: null,
      },
    });

    await createAuditLog(tx, {
      userId: input.userId,
      actorId: input.actorId,
      actorEmail: input.actorEmail ?? null,
      action: 'transaction.booking.reopened',
      entityType: 'transaction',
      entityId: plan.transactionId,
      before: {
        bookingId: booking.id,
        categoryId: booking.categoryId,
        projectId: booking.projectId,
        transactionTypeId: booking.transactionTypeId,
      },
      after: {
        bookingId: null,
        categoryId: null,
        projectId: null,
        transactionTypeId: null,
        reviewDecisionId: reversalDecision.id,
      },
      metadata: {
        confirmedPlanHash: input.confirmedPlanHash,
        originalDecisionId: plan.originalDecisionId,
        source: MANUAL_BOOKING_REOPEN_VERSION,
      },
    });

    const [bookingAfter, transactionAfter, unresolvedAfter, confirmedBookingsAfter] = await Promise.all([
      tx.transactionBooking.findUnique({ where: { id: booking.id } }),
      tx.transaction.findUnique({ where: { id: plan.transactionId } }),
      tx.transaction.count({ where: { userId: input.userId, transactionBooking: null } }),
      tx.transactionBooking.count({ where: { transaction: { userId: input.userId } } }),
    ]);

    if (
      bookingAfter
      || !transactionAfter
      || transactionAfter.projectId
      || transactionAfter.transactionTypeId
      || transactionAfter.categoryId
      || transactionAfter.classificationSource !== 'none'
      || unresolvedAfter !== plan.counts.unresolvedAfter
      || confirmedBookingsAfter !== plan.counts.confirmedBookingsAfter
    ) {
      throw new ManualBookingReopenError(
        'POSTCONDITION_FAILED',
        'The reopen postconditions did not match the confirmed plan.',
      );
    }

    return {
      status: 'REOPENED' as const,
      writesPerformed: true,
      plan,
      reversalDecisionId: reversalDecision.id,
      counts: {
        confirmedBookingsAfter,
        unresolvedAfter,
      },
      sideEffects: {
        deletedBookingCount: 1,
        createdReviewDecisionCount: 1,
        changedTransactionCount: 1,
        changedSuggestionCount: 0,
        changedImportedBankFactCount: 0,
      },
    };
  });
};
