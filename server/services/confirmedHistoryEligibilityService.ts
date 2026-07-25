import type {
  BookingSource,
  PrismaClient,
  ReviewDecisionAction,
  SuggestionStatus,
  TransactionDirection,
} from '@prisma/client';
import type { ApprovedHistoryBooking } from './historySuggestionService';
import { hashEvidence } from './reviewDecisionService';
import { toHistorySuggestionFacts } from './transactionSuggestionFacts';

const ELIGIBLE_ACTIONS = new Set<ReviewDecisionAction>([
  'ACCEPT_SUGGESTION',
  'ASSIGN_MANUALLY',
  'CHANGE_BOOKING',
]);

export const CONFIRMED_HISTORY_ELIGIBILITY_VERSION = 'confirmed-history-v1';

export type ConfirmedHistoryExclusionReason =
  | 'CROSS_WORKSPACE'
  | 'MISSING_CURRENT_BOOKING'
  | 'INCOMPLETE_DIMENSIONS'
  | 'MISSING_BOOKING_PROVENANCE'
  | 'MISSING_REVIEW_DECISION'
  | 'REMOVED_BY_LATEST_DECISION'
  | 'LATEST_DECISION_NOT_ELIGIBLE'
  | 'CURRENT_BOOKING_SUPERSEDED'
  | 'DIMENSION_MISMATCH'
  | 'MISSING_DECISION_PROVENANCE'
  | 'SUGGESTION_NOT_CONFIRMED';

export type ConfirmedHistoryDecision = {
  id: string;
  workspaceId: string;
  transactionId: string;
  suggestionId: string | null;
  action: ReviewDecisionAction;
  afterBookingId: string | null;
  afterProjectId: string | null;
  afterTypeId: string | null;
  afterCategoryId: string | null;
  actorId: string;
  evidenceHash: string;
  decidedAt: Date;
  suggestion: {
    workspaceId: string;
    status: SuggestionStatus;
  } | null;
};

export type ConfirmedHistoryCandidate = {
  id: string;
  userId: string;
  date: Date;
  accountId: string | null;
  direction: TransactionDirection;
  amountMinor: bigint;
  counterparty: string | null;
  reference: string | null;
  description: string;
  rawRow: unknown;
  ledger: { lockedAt: Date | null } | null;
  transactionBooking: {
    id: string;
    workspaceId: string;
    projectId: string;
    transactionTypeId: string;
    categoryId: string;
    source: BookingSource;
    evidenceHash: string;
    confirmedBy: string | null;
    confirmedAt: Date;
    project: { workspaceId: string };
    transactionType: { workspaceId: string };
    category: { workspaceId: string };
  } | null;
  reviewDecisions: ConfirmedHistoryDecision[];
};

export type ConfirmedHistoryProvenance = {
  eligibilityVersion: string;
  workspaceId: string;
  transactionId: string;
  bookingId: string;
  reviewDecisionId: string;
  reviewAction: ReviewDecisionAction;
  actorId: string;
  bookingSource: BookingSource;
  bookingEvidenceHash: string;
  decisionEvidenceHash: string;
  confirmedAt: string;
  decidedAt: string;
  projectId: string;
  transactionTypeId: string;
  categoryId: string;
  ledgerLockedAt: string | null;
  provenanceHash: string;
};

export type EligibleConfirmedHistoryBooking = ApprovedHistoryBooking & {
  confirmedHistory: ConfirmedHistoryProvenance;
};

export type ConfirmedHistoryExclusion = {
  transactionId: string;
  reason: ConfirmedHistoryExclusionReason;
};

export type ConfirmedHistoryEligibilityResult = {
  eligibilityVersion: string;
  workspaceId: string;
  eligibleHistory: EligibleConfirmedHistoryBooking[];
  exclusions: ConfirmedHistoryExclusion[];
  sideEffects: {
    writesPerformed: false;
    createsTransactionBooking: false;
    createsCategorizationSuggestion: false;
    mutatesBankFacts: false;
    mutatesPeriodState: false;
    invokesExternalModel: false;
  };
};

const nonEmpty = (value: string | null | undefined): value is string =>
  typeof value === 'string' && value.trim().length > 0;

const latestDecision = (decisions: ConfirmedHistoryDecision[]): ConfirmedHistoryDecision | null =>
  [...decisions].sort((left, right) => {
    const timeDifference = right.decidedAt.getTime() - left.decidedAt.getTime();
    return timeDifference || right.id.localeCompare(left.id);
  })[0] ?? null;

const exclusion = (
  transactionId: string,
  reason: ConfirmedHistoryExclusionReason,
): ConfirmedHistoryExclusion => ({ transactionId, reason });

export const evaluateConfirmedHistoryEligibility = (input: {
  workspaceId: string;
  candidates: ConfirmedHistoryCandidate[];
}): ConfirmedHistoryEligibilityResult => {
  const eligibleHistory: EligibleConfirmedHistoryBooking[] = [];
  const exclusions: ConfirmedHistoryExclusion[] = [];

  for (const candidate of [...input.candidates].sort((left, right) => {
    const dateDifference = left.date.getTime() - right.date.getTime();
    return dateDifference || left.id.localeCompare(right.id);
  })) {
    const booking = candidate.transactionBooking;
    if (!booking) {
      exclusions.push(exclusion(candidate.id, 'MISSING_CURRENT_BOOKING'));
      continue;
    }
    if (
      booking.workspaceId !== input.workspaceId
      || booking.project.workspaceId !== input.workspaceId
      || booking.transactionType.workspaceId !== input.workspaceId
      || booking.category.workspaceId !== input.workspaceId
      || candidate.reviewDecisions.some((decision) => decision.workspaceId !== input.workspaceId)
    ) {
      exclusions.push(exclusion(candidate.id, 'CROSS_WORKSPACE'));
      continue;
    }
    if (!nonEmpty(booking.projectId) || !nonEmpty(booking.transactionTypeId) || !nonEmpty(booking.categoryId)) {
      exclusions.push(exclusion(candidate.id, 'INCOMPLETE_DIMENSIONS'));
      continue;
    }
    if (!nonEmpty(booking.confirmedBy) || !booking.confirmedAt || !nonEmpty(booking.evidenceHash)) {
      exclusions.push(exclusion(candidate.id, 'MISSING_BOOKING_PROVENANCE'));
      continue;
    }

    const decision = latestDecision(candidate.reviewDecisions);
    if (!decision) {
      exclusions.push(exclusion(candidate.id, 'MISSING_REVIEW_DECISION'));
      continue;
    }
    if (decision.action === 'REMOVE_BOOKING') {
      exclusions.push(exclusion(candidate.id, 'REMOVED_BY_LATEST_DECISION'));
      continue;
    }
    if (!ELIGIBLE_ACTIONS.has(decision.action)) {
      exclusions.push(exclusion(candidate.id, 'LATEST_DECISION_NOT_ELIGIBLE'));
      continue;
    }
    if (decision.afterBookingId !== booking.id) {
      exclusions.push(exclusion(candidate.id, 'CURRENT_BOOKING_SUPERSEDED'));
      continue;
    }
    if (
      decision.afterProjectId !== booking.projectId
      || decision.afterTypeId !== booking.transactionTypeId
      || decision.afterCategoryId !== booking.categoryId
    ) {
      exclusions.push(exclusion(candidate.id, 'DIMENSION_MISMATCH'));
      continue;
    }
    if (!nonEmpty(decision.actorId) || !decision.decidedAt || !nonEmpty(decision.evidenceHash)) {
      exclusions.push(exclusion(candidate.id, 'MISSING_DECISION_PROVENANCE'));
      continue;
    }
    if (decision.action === 'ACCEPT_SUGGESTION') {
      if (
        !decision.suggestion
        || decision.suggestion.workspaceId !== input.workspaceId
        || decision.suggestion.status !== 'ACCEPTED'
      ) {
        exclusions.push(exclusion(candidate.id, 'SUGGESTION_NOT_CONFIRMED'));
        continue;
      }
    }

    const provenanceWithoutHash = {
      eligibilityVersion: CONFIRMED_HISTORY_ELIGIBILITY_VERSION,
      workspaceId: input.workspaceId,
      transactionId: candidate.id,
      bookingId: booking.id,
      reviewDecisionId: decision.id,
      reviewAction: decision.action,
      actorId: decision.actorId,
      bookingSource: booking.source,
      bookingEvidenceHash: booking.evidenceHash,
      decisionEvidenceHash: decision.evidenceHash,
      confirmedAt: booking.confirmedAt.toISOString(),
      decidedAt: decision.decidedAt.toISOString(),
      projectId: booking.projectId,
      transactionTypeId: booking.transactionTypeId,
      categoryId: booking.categoryId,
      ledgerLockedAt: candidate.ledger?.lockedAt?.toISOString() ?? null,
    };

    eligibleHistory.push({
      ...toHistorySuggestionFacts(candidate),
      bookingId: booking.id,
      projectId: booking.projectId,
      transactionTypeId: booking.transactionTypeId,
      categoryId: booking.categoryId,
      bookingEvidenceHash: booking.evidenceHash,
      confirmedHistory: {
        ...provenanceWithoutHash,
        provenanceHash: hashEvidence(provenanceWithoutHash),
      },
    });
  }

  return {
    eligibilityVersion: CONFIRMED_HISTORY_ELIGIBILITY_VERSION,
    workspaceId: input.workspaceId,
    eligibleHistory,
    exclusions: exclusions.sort((left, right) =>
      left.transactionId.localeCompare(right.transactionId) || left.reason.localeCompare(right.reason)),
    sideEffects: {
      writesPerformed: false,
      createsTransactionBooking: false,
      createsCategorizationSuggestion: false,
      mutatesBankFacts: false,
      mutatesPeriodState: false,
      invokesExternalModel: false,
    },
  };
};

type ConfirmedHistoryDb = Pick<PrismaClient, 'transaction'>;

export const loadConfirmedHistoryEligibility = async (
  db: ConfirmedHistoryDb,
  input: {
    workspaceId: string;
    userId: string;
    maximumRows?: number;
    notBefore?: Date;
    notAfter?: Date;
  },
): Promise<ConfirmedHistoryEligibilityResult> => {
  const maximumRows = input.maximumRows == null
    ? undefined
    : Math.max(1, Math.min(1000, Math.floor(input.maximumRows)));
  const candidates = await db.transaction.findMany({
    where: {
      userId: input.userId,
      transactionBooking: { is: { workspaceId: input.workspaceId } },
      ...(input.notBefore || input.notAfter
        ? {
            date: {
              ...(input.notBefore ? { gte: input.notBefore } : {}),
              ...(input.notAfter ? { lte: input.notAfter } : {}),
            },
          }
        : {}),
    },
    orderBy: maximumRows ? [{ date: 'desc' }, { id: 'desc' }] : [{ date: 'asc' }, { id: 'asc' }],
    ...(maximumRows ? { take: maximumRows } : {}),
    select: {
      id: true,
      userId: true,
      date: true,
      accountId: true,
      direction: true,
      amountMinor: true,
      counterparty: true,
      reference: true,
      description: true,
      rawRow: true,
      ledger: { select: { lockedAt: true } },
      transactionBooking: {
        select: {
          id: true,
          workspaceId: true,
          projectId: true,
          transactionTypeId: true,
          categoryId: true,
          source: true,
          evidenceHash: true,
          confirmedBy: true,
          confirmedAt: true,
          project: { select: { workspaceId: true } },
          transactionType: { select: { workspaceId: true } },
          category: { select: { workspaceId: true } },
        },
      },
      reviewDecisions: {
        orderBy: [{ decidedAt: 'desc' }, { id: 'desc' }],
        select: {
          id: true,
          workspaceId: true,
          transactionId: true,
          suggestionId: true,
          action: true,
          afterBookingId: true,
          afterProjectId: true,
          afterTypeId: true,
          afterCategoryId: true,
          actorId: true,
          evidenceHash: true,
          decidedAt: true,
          suggestion: { select: { workspaceId: true, status: true } },
        },
      },
    },
  });

  return evaluateConfirmedHistoryEligibility({
    workspaceId: input.workspaceId,
    candidates: candidates as unknown as ConfirmedHistoryCandidate[],
  });
};
