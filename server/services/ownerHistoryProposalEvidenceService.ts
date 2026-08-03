import crypto from 'node:crypto';
import type { Prisma, PrismaClient, TransactionDirection } from '@prisma/client';
import {
  HISTORY_SUGGESTION_ALGORITHM_VERSION,
  rankHistorySuggestions,
  type ApprovedHistoryBooking,
  type RankedHistorySuggestion,
} from './historySuggestionService';
import { compareHistoricalFactualDirections } from './historicalDirectionCompatibilityService';

export const OWNER_HISTORY_PROPOSAL_VERSION = 'owner-history-proposal-v2';
export const OWNER_HISTORY_PRODUCER_KEY = 'owner-history';
export const OWNER_HISTORY_PRODUCER_VERSION = 'v2';
export const OWNER_HISTORY_RANK_PERSISTENCE = 'RANK_1_ONLY';

export type OwnerHistoryEvidenceDisqualificationReason =
  | 'INCOMPLETE_TRIPLE'
  | 'CROSS_WORKSPACE'
  | 'INACTIVE_OR_UNAUTHORIZED_TRIPLE'
  | 'MISSING_SOURCE_DIRECTION';

export type OwnerHistoryEvidenceEntry = {
  bookingId: string;
  transactionId: string;
  workspaceId: string;
  projectId: string;
  transactionTypeId: string;
  categoryId: string;
  direction: TransactionDirection;
  evidenceHash: string;
  sourceFactHash: string;
};

export type OwnerHistoryProposedSuggestion = {
  transactionId: string;
  rank1: RankedHistorySuggestion;
  allRanks: RankedHistorySuggestion[];
};

export type OwnerHistoryProposalPlan = {
  algorithmVersion: string;
  workspaceId: string;
  planHash: string;
  sideEffects: {
    writesPerformed: false;
    createsTransactionBooking: false;
    createsReviewDecision: false;
    requiresAdministratorApproval: true;
  };
  provenanceProof: {
    evidenceBookingsLoadedFromSource: 'HISTORICAL';
    reviewDecisionRequired: false;
    qualifiesUnderConfirmedHistoryEligibilityService: false;
    exclusionReason: 'MISSING_REVIEW_DECISION';
  };
  counts: {
    evidenceCandidates: number;
    disqualifiedIncomplete: number;
    disqualifiedCrossWorkspace: number;
    disqualifiedInactiveOrUnauthorizedTriple: number;
    disqualifiedMissingSourceDirection: number;
    eligibleEvidence: number;
    openTransactions: number;
    covered: number;
    uncovered: number;
    abstainedWeak: number;
    abstainedMissingTargetDirection: number;
    abstainedNoFactualDirectionMatch: number;
    abstainedNoRankedCandidate: number;
    abstained: number;
  };
  matcherDistribution: Record<string, number>;
  confidenceDistribution: Record<string, number>;
  persistence: {
    producerKey: typeof OWNER_HISTORY_PRODUCER_KEY;
    producerVersion: typeof OWNER_HISTORY_PRODUCER_VERSION;
    rankPersistence: typeof OWNER_HISTORY_RANK_PERSISTENCE;
    existingOwnedSuggestionCount: number;
    plannedCreateCount: number;
    plannedExpirationCount: number;
    ownershipStateHash: string;
  };
  proposals: OwnerHistoryProposedSuggestion[];
};

export type OwnerHistoryProposalExecutionResult = {
  status:
    | 'DRY_RUN_COMPLETE'
    | 'CONFIRMATION_REQUIRED'
    | 'EXECUTION_NOT_ALLOWED'
    | 'HASH_DRIFT'
    | 'CREATED';
  dryRun: boolean;
  writesPerformed: boolean;
  expiredSuggestionCount: number;
  createdSuggestionCount: number;
  plan: OwnerHistoryProposalPlan;
  sideEffects: {
    createsCategorizationSuggestion: boolean;
    expiresPendingSuggestion: boolean;
    createsTransactionBooking: false;
    createsReviewDecision: false;
    mutatesBankFacts: false;
  };
};

type OwnerHistoryDb = Pick<
  PrismaClient,
  'transactionBooking' | 'transaction' | 'categorizationSuggestion' | '$transaction'
>;

const stableValue = (value: unknown): unknown => {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'bigint') return value.toString();
  if (Array.isArray(value)) return value.map(stableValue);
  if (typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([k, v]) => [k, stableValue(v)]),
    );
  }
  return value;
};

const digest = (value: unknown): string => crypto.createHash('sha256').update(JSON.stringify(stableValue(value))).digest('hex');

const hashPlan = (input: {
  workspaceId: string;
  counts: OwnerHistoryProposalPlan['counts'];
  evidence: OwnerHistoryEvidenceEntry[];
  targets: Array<{ id: string; date: Date; direction: TransactionDirection | null | undefined; amountMinor: bigint; accountId: string | null; counterparty: string | null; description: string }>;
  persistence: OwnerHistoryProposalPlan['persistence'];
  proposals: OwnerHistoryProposedSuggestion[];
}): string => {
  const payload = {
    algorithmVersion: OWNER_HISTORY_PROPOSAL_VERSION,
    workspaceScopeHash: digest({ workspaceId: input.workspaceId }),
    counts: input.counts,
    persistence: input.persistence,
    evidence: input.evidence.map((entry) => ({
      evidenceHash: entry.evidenceHash,
      sourceFactHash: entry.sourceFactHash,
      direction: entry.direction,
      transactionId: entry.transactionId,
    })).sort((a, b) => a.evidenceHash.localeCompare(b.evidenceHash)),
    targets: input.targets.map((target) => ({ targetFactHash: digest(target), direction: target.direction })).sort((a, b) => a.targetFactHash.localeCompare(b.targetFactHash)),
    proposals: input.proposals.map((proposal) => ({
      transactionId: proposal.transactionId,
      candidate: {
        rank: proposal.rank1.rank,
        projectId: proposal.rank1.projectId,
        transactionTypeId: proposal.rank1.transactionTypeId,
        categoryId: proposal.rank1.categoryId,
        matcher: proposal.rank1.matcher,
        confidence: proposal.rank1.confidence,
        scoreBasisPoints: proposal.rank1.scoreBasisPoints,
        evidenceHash: proposal.rank1.evidenceHash,
      },
    })).sort((a, b) => a.transactionId.localeCompare(b.transactionId)),
  };
  return digest(payload);
};

export const buildOwnerHistoryProposalPlan = async (
  db: OwnerHistoryDb,
  input: { workspaceId: string; userId: string },
): Promise<OwnerHistoryProposalPlan> => {
  const { workspaceId, userId } = input;

  const rawBookings = await db.transactionBooking.findMany({
    where: { workspaceId, source: 'HISTORICAL' },
    select: {
      id: true,
      workspaceId: true,
      projectId: true,
      transactionTypeId: true,
      categoryId: true,
      evidenceHash: true,
      project: { select: { workspaceId: true, isActive: true } },
      transactionType: { select: { workspaceId: true, isActive: true } },
      category: { select: { workspaceId: true, isActive: true } },
      transaction: {
        select: {
          id: true,
          date: true,
          direction: true,
          amountMinor: true,
          counterparty: true,
          description: true,
          accountId: true,
        },
      },
    },
  });

  let disqualifiedIncomplete = 0;
  let disqualifiedCrossWorkspace = 0;
  let disqualifiedInactiveOrUnauthorizedTriple = 0;
  let disqualifiedMissingSourceDirection = 0;

  const evidenceEntries: OwnerHistoryEvidenceEntry[] = [];
  const approvedHistory: ApprovedHistoryBooking[] = [];

  for (const booking of rawBookings) {
    if (!booking.projectId || !booking.transactionTypeId || !booking.categoryId) {
      disqualifiedIncomplete += 1;
      continue;
    }
    if (
      booking.workspaceId !== workspaceId
      || booking.project.workspaceId !== workspaceId
      || booking.transactionType.workspaceId !== workspaceId
      || booking.category.workspaceId !== workspaceId
    ) {
      disqualifiedCrossWorkspace += 1;
      continue;
    }
    if (!booking.project.isActive || !booking.transactionType.isActive || !booking.category.isActive) {
      disqualifiedInactiveOrUnauthorizedTriple += 1;
      continue;
    }
    const compatibility = compareHistoricalFactualDirections(booking.transaction.direction, 'credit');
    if (compatibility.reason === 'MISSING_SOURCE_DIRECTION') {
      disqualifiedMissingSourceDirection += 1;
      continue;
    }

    const entry: OwnerHistoryEvidenceEntry = {
      bookingId: booking.id,
      transactionId: booking.transaction.id,
      workspaceId: booking.workspaceId,
      projectId: booking.projectId,
      transactionTypeId: booking.transactionTypeId,
      categoryId: booking.categoryId,
      direction: booking.transaction.direction,
      evidenceHash: booking.evidenceHash,
      sourceFactHash: digest({
        transactionId: booking.transaction.id,
        date: booking.transaction.date,
        direction: booking.transaction.direction,
        amountMinor: booking.transaction.amountMinor,
        accountId: booking.transaction.accountId,
        counterparty: booking.transaction.counterparty,
        description: booking.transaction.description,
      }),
    };
    evidenceEntries.push(entry);

    approvedHistory.push({
      bookingId: booking.id,
      transactionId: booking.transaction.id,
      date: booking.transaction.date,
      accountId: booking.transaction.accountId,
      direction: booking.transaction.direction,
      amountMinor: booking.transaction.amountMinor,
      counterparty: booking.transaction.counterparty,
      counterpartyIban: null,
      description: booking.transaction.description,
      paymentPurpose: null,
      projectId: booking.projectId,
      transactionTypeId: booking.transactionTypeId,
      categoryId: booking.categoryId,
      bookingEvidenceHash: booking.evidenceHash,
    });
  }

  const openTransactions = await db.transaction.findMany({
    where: {
      userId,
      transactionBooking: null,
    },
    select: {
      id: true,
      date: true,
      direction: true,
      amountMinor: true,
      counterparty: true,
      description: true,
      accountId: true,
      rawRow: true,
    },
  });

  const proposals: OwnerHistoryProposedSuggestion[] = [];
  let abstainedWeak = 0;
  let abstainedMissingTargetDirection = 0;
  let abstainedNoFactualDirectionMatch = 0;
  let abstainedNoRankedCandidate = 0;

  for (const tx of openTransactions) {
    const targetCompatibility = compareHistoricalFactualDirections('credit', tx.direction);
    if (targetCompatibility.reason === 'MISSING_TARGET_DIRECTION') {
      abstainedMissingTargetDirection += 1;
      continue;
    }
    const matchingDirectionEvidence = approvedHistory.filter((history) =>
      compareHistoricalFactualDirections(history.direction, tx.direction).compatible,
    );
    if (!matchingDirectionEvidence.length) {
      abstainedNoFactualDirectionMatch += 1;
      continue;
    }
    const ranked = rankHistorySuggestions(
      {
        transactionId: tx.id,
        date: tx.date,
        accountId: tx.accountId,
        direction: tx.direction,
        amountMinor: tx.amountMinor,
        counterparty: tx.counterparty,
        counterpartyIban: null,
        description: tx.description,
        paymentPurpose: null,
      },
      matchingDirectionEvidence,
      { algorithmVersion: OWNER_HISTORY_PROPOSAL_VERSION, workspaceId },
    );

    if (!ranked.length) {
      abstainedNoRankedCandidate += 1;
      continue;
    }

    const rank1 = ranked[0]!;
    if (rank1.matcher === 'DIRECTION_DEFAULT') {
      abstainedWeak += 1;
      continue;
    }

    proposals.push({ transactionId: tx.id, rank1, allRanks: ranked });
  }

  const abstained = abstainedWeak
    + abstainedMissingTargetDirection
    + abstainedNoFactualDirectionMatch
    + abstainedNoRankedCandidate;

  const counts: OwnerHistoryProposalPlan['counts'] = {
    evidenceCandidates: rawBookings.length,
    disqualifiedIncomplete,
    disqualifiedCrossWorkspace,
    disqualifiedInactiveOrUnauthorizedTriple,
    disqualifiedMissingSourceDirection,
    eligibleEvidence: evidenceEntries.length,
    openTransactions: openTransactions.length,
    covered: proposals.length,
    uncovered: abstained,
    abstainedWeak,
    abstainedMissingTargetDirection,
    abstainedNoFactualDirectionMatch,
    abstainedNoRankedCandidate,
    abstained,
  };

  const matcherDistribution: Record<string, number> = {};
  const confidenceDistribution: Record<string, number> = {};
  for (const proposal of proposals) {
    matcherDistribution[proposal.rank1.matcher] = (matcherDistribution[proposal.rank1.matcher] ?? 0) + 1;
    confidenceDistribution[proposal.rank1.confidence] = (confidenceDistribution[proposal.rank1.confidence] ?? 0) + 1;
  }

  const proposedTransactionIds = proposals.map((proposal) => proposal.transactionId);
  const existingOwnedSuggestions = proposedTransactionIds.length === 0
    ? []
    : await db.categorizationSuggestion.findMany({
        where: {
          workspaceId,
          transactionId: { in: proposedTransactionIds },
          producerKey: OWNER_HISTORY_PRODUCER_KEY,
          producerVersion: OWNER_HISTORY_PRODUCER_VERSION,
        },
        select: { id: true, transactionId: true, evidenceHash: true, status: true },
      });
  const desiredEvidenceKeys = new Set(proposals.map((proposal) => `${proposal.transactionId}|${proposal.rank1.evidenceHash}`));
  const existingEvidenceKeys = new Set(existingOwnedSuggestions.map((suggestion) => `${suggestion.transactionId}|${suggestion.evidenceHash}`));
  const persistence: OwnerHistoryProposalPlan['persistence'] = {
    producerKey: OWNER_HISTORY_PRODUCER_KEY,
    producerVersion: OWNER_HISTORY_PRODUCER_VERSION,
    rankPersistence: OWNER_HISTORY_RANK_PERSISTENCE,
    existingOwnedSuggestionCount: existingOwnedSuggestions.length,
    plannedCreateCount: proposals.filter((proposal) => !existingEvidenceKeys.has(`${proposal.transactionId}|${proposal.rank1.evidenceHash}`)).length,
    plannedExpirationCount: existingOwnedSuggestions.filter((suggestion) => suggestion.status === 'PENDING' && !desiredEvidenceKeys.has(`${suggestion.transactionId}|${suggestion.evidenceHash}`)).length,
    ownershipStateHash: digest(existingOwnedSuggestions.map((suggestion) => ({ id: suggestion.id, transactionId: suggestion.transactionId, evidenceHash: suggestion.evidenceHash, status: suggestion.status })).sort((a, b) => a.id.localeCompare(b.id))),
  };

  return {
    algorithmVersion: OWNER_HISTORY_PROPOSAL_VERSION,
    workspaceId,
    planHash: hashPlan({ workspaceId, counts, evidence: evidenceEntries, targets: openTransactions, persistence, proposals }),
    sideEffects: {
      writesPerformed: false,
      createsTransactionBooking: false,
      createsReviewDecision: false,
      requiresAdministratorApproval: true,
    },
    provenanceProof: {
      evidenceBookingsLoadedFromSource: 'HISTORICAL',
      reviewDecisionRequired: false,
      qualifiesUnderConfirmedHistoryEligibilityService: false,
      exclusionReason: 'MISSING_REVIEW_DECISION',
    },
    counts,
    matcherDistribution,
    confidenceDistribution,
    persistence,
    proposals,
  };
};

const baseDryRunResult = (plan: OwnerHistoryProposalPlan): OwnerHistoryProposalExecutionResult => ({
  status: 'DRY_RUN_COMPLETE',
  dryRun: true,
  writesPerformed: false,
  expiredSuggestionCount: 0,
  createdSuggestionCount: 0,
  plan,
  sideEffects: {
    createsCategorizationSuggestion: false,
    expiresPendingSuggestion: false,
    createsTransactionBooking: false,
    createsReviewDecision: false,
    mutatesBankFacts: false,
  },
});

export const executeOwnerHistoryProposalPlan = async (
  db: OwnerHistoryDb,
  input: {
    workspaceId: string;
    userId: string;
    execute: boolean;
    executionAllowed: boolean;
    confirmedPlanHash?: string | null;
  },
): Promise<OwnerHistoryProposalExecutionResult> => {
  const plan = await buildOwnerHistoryProposalPlan(db, { workspaceId: input.workspaceId, userId: input.userId });

  if (!input.execute) return baseDryRunResult(plan);

  if (!input.executionAllowed) {
    return { ...baseDryRunResult(plan), status: 'EXECUTION_NOT_ALLOWED', dryRun: false };
  }

  if (!input.confirmedPlanHash) {
    return { ...baseDryRunResult(plan), status: 'CONFIRMATION_REQUIRED', dryRun: false };
  }

  if (input.confirmedPlanHash !== plan.planHash) {
    return { ...baseDryRunResult(plan), status: 'HASH_DRIFT', dryRun: false };
  }

  return db.$transaction(async (tx) => {
    // Recompute inside transaction to detect drift
    const currentPlan = await buildOwnerHistoryProposalPlan(
      tx as unknown as OwnerHistoryDb,
      { workspaceId: input.workspaceId, userId: input.userId },
    );

    if (currentPlan.planHash !== input.confirmedPlanHash) {
      return {
        ...baseDryRunResult(currentPlan),
        status: 'HASH_DRIFT' as const,
        dryRun: false,
      };
    }

    const transactionIds = currentPlan.proposals.map((p) => p.transactionId);
    const desiredEvidenceKeys = new Set(
      currentPlan.proposals.map((proposal) => `${proposal.transactionId}|${proposal.rank1.evidenceHash}`),
    );
    const existingSuggestions = transactionIds.length === 0
      ? []
      : await (tx as unknown as OwnerHistoryDb).categorizationSuggestion.findMany({
          where: {
            workspaceId: input.workspaceId,
            transactionId: { in: transactionIds },
            producerKey: OWNER_HISTORY_PRODUCER_KEY,
            producerVersion: OWNER_HISTORY_PRODUCER_VERSION,
          },
          select: { id: true, transactionId: true, evidenceHash: true, status: true },
        });
    const existingEvidenceKeys = new Set(existingSuggestions.map((suggestion) => `${suggestion.transactionId}|${suggestion.evidenceHash}`));
    const stalePendingSuggestionIds = existingSuggestions
      .filter((suggestion) => suggestion.status === 'PENDING' && !desiredEvidenceKeys.has(`${suggestion.transactionId}|${suggestion.evidenceHash}`))
      .map((suggestion) => suggestion.id);
    const resolvedAt = new Date();

    const expired = stalePendingSuggestionIds.length === 0
      ? { count: 0 }
      : await (tx as unknown as OwnerHistoryDb).categorizationSuggestion.updateMany({
          where: {
            id: { in: stalePendingSuggestionIds },
          },
          data: { status: 'EXPIRED', resolvedAt },
        });

    const createData: Prisma.CategorizationSuggestionCreateManyInput[] = currentPlan.proposals.flatMap((proposal) =>
      existingEvidenceKeys.has(`${proposal.transactionId}|${proposal.rank1.evidenceHash}`) ? [] : [{
        workspaceId: input.workspaceId,
        transactionId: proposal.transactionId,
        projectId: proposal.rank1.projectId,
        transactionTypeId: proposal.rank1.transactionTypeId,
        categoryId: proposal.rank1.categoryId,
        confidence: proposal.rank1.confidence,
        matcher: proposal.rank1.matcher,
        rank: 1,
        scoreBasisPoints: proposal.rank1.scoreBasisPoints,
        evidence: proposal.rank1.evidence as unknown as Prisma.InputJsonValue,
        evidenceHash: proposal.rank1.evidenceHash,
        producerKey: OWNER_HISTORY_PRODUCER_KEY,
        producerVersion: OWNER_HISTORY_PRODUCER_VERSION,
        planHash: currentPlan.planHash,
        status: 'PENDING' as const,
      }],
    );

    const created = createData.length === 0
      ? { count: 0 }
      : await (tx as unknown as OwnerHistoryDb).categorizationSuggestion.createMany({
          data: createData,
          skipDuplicates: true,
        });

    return {
      status: 'CREATED' as const,
      dryRun: false,
      writesPerformed: created.count > 0 || expired.count > 0,
      expiredSuggestionCount: expired.count,
      createdSuggestionCount: created.count,
      plan: currentPlan,
      sideEffects: {
        createsCategorizationSuggestion: created.count > 0,
        expiresPendingSuggestion: expired.count > 0,
        createsTransactionBooking: false,
        createsReviewDecision: false,
        mutatesBankFacts: false,
      },
    };
  });
};
