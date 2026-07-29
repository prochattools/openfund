import crypto from 'node:crypto';
import type { Prisma, PrismaClient, TransactionDirection } from '@prisma/client';
import {
  HISTORY_SUGGESTION_ALGORITHM_VERSION,
  rankHistorySuggestions,
  type ApprovedHistoryBooking,
  type RankedHistorySuggestion,
} from './historySuggestionService';

export const OWNER_HISTORY_PROPOSAL_VERSION = 'owner-history-proposal-v1';

export type OwnerHistoryEvidenceDisqualificationReason =
  | 'INCOMPLETE_TRIPLE'
  | 'CROSS_WORKSPACE'
  | 'DIRECTION_CONFLICT_WITHIN_TYPE';

export type OwnerHistoryEvidenceEntry = {
  bookingId: string;
  transactionId: string;
  workspaceId: string;
  projectId: string;
  transactionTypeId: string;
  categoryId: string;
  direction: TransactionDirection;
  evidenceHash: string;
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
    disqualifiedDirectionConflict: number;
    eligibleEvidence: number;
    openTransactions: number;
    covered: number;
    uncovered: number;
    abstainedWeak: number;
  };
  matcherDistribution: Record<string, number>;
  confidenceDistribution: Record<string, number>;
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

const hashPlan = (counts: OwnerHistoryProposalPlan['counts'], proposals: OwnerHistoryProposedSuggestion[]): string => {
  const payload = {
    counts,
    evidenceHashes: proposals
      .map((p) => p.rank1.evidenceHash)
      .sort(),
  };
  return crypto
    .createHash('sha256')
    .update(JSON.stringify(stableValue(payload)))
    .digest('hex');
};

export const buildOwnerHistoryProposalPlan = async (
  db: OwnerHistoryDb,
  input: { workspaceId: string },
): Promise<OwnerHistoryProposalPlan> => {
  const { workspaceId } = input;

  const rawBookings = await db.transactionBooking.findMany({
    where: { workspaceId, source: 'HISTORICAL' },
    select: {
      id: true,
      workspaceId: true,
      projectId: true,
      transactionTypeId: true,
      categoryId: true,
      evidenceHash: true,
      transaction: {
        select: {
          id: true,
          date: true,
          direction: true,
          amountMinor: true,
          counterparty: true,
          description: true,
          accountId: true,
          rawRow: true,
          reviewDecisions: { select: { id: true }, take: 1 },
        },
      },
    },
  });

  let disqualifiedIncomplete = 0;
  let disqualifiedDirectionConflict = 0;

  const directionByTypeId = new Map<string, Set<TransactionDirection>>();
  for (const booking of rawBookings) {
    if (!booking.projectId || !booking.transactionTypeId || !booking.categoryId) {
      disqualifiedIncomplete += 1;
      continue;
    }
    const set = directionByTypeId.get(booking.transactionTypeId) ?? new Set<TransactionDirection>();
    set.add(booking.transaction.direction);
    directionByTypeId.set(booking.transactionTypeId, set);
  }

  const conflictingTypeIds = new Set<string>(
    [...directionByTypeId.entries()]
      .filter(([, directions]) => directions.size > 1)
      .map(([typeId]) => typeId),
  );

  const evidenceEntries: OwnerHistoryEvidenceEntry[] = [];
  const approvedHistory: ApprovedHistoryBooking[] = [];

  for (const booking of rawBookings) {
    if (!booking.projectId || !booking.transactionTypeId || !booking.categoryId) {
      continue;
    }
    if (conflictingTypeIds.has(booking.transactionTypeId)) {
      disqualifiedDirectionConflict += 1;
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

  for (const tx of openTransactions) {
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
      approvedHistory,
      { algorithmVersion: HISTORY_SUGGESTION_ALGORITHM_VERSION, workspaceId },
    );

    if (!ranked.length) continue;

    const rank1 = ranked[0]!;
    if (rank1.matcher === 'DIRECTION_DEFAULT') {
      abstainedWeak += 1;
      continue;
    }

    proposals.push({ transactionId: tx.id, rank1, allRanks: ranked });
  }

  const counts: OwnerHistoryProposalPlan['counts'] = {
    evidenceCandidates: rawBookings.length,
    disqualifiedIncomplete,
    disqualifiedDirectionConflict,
    eligibleEvidence: evidenceEntries.length,
    openTransactions: openTransactions.length,
    covered: proposals.length,
    uncovered: openTransactions.length - proposals.length - abstainedWeak,
    abstainedWeak,
  };

  const matcherDistribution: Record<string, number> = {};
  const confidenceDistribution: Record<string, number> = {};
  for (const proposal of proposals) {
    matcherDistribution[proposal.rank1.matcher] = (matcherDistribution[proposal.rank1.matcher] ?? 0) + 1;
    confidenceDistribution[proposal.rank1.confidence] = (confidenceDistribution[proposal.rank1.confidence] ?? 0) + 1;
  }

  return {
    algorithmVersion: OWNER_HISTORY_PROPOSAL_VERSION,
    workspaceId,
    planHash: hashPlan(counts, proposals),
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
    execute: boolean;
    executionAllowed: boolean;
    confirmedPlanHash?: string | null;
  },
): Promise<OwnerHistoryProposalExecutionResult> => {
  const plan = await buildOwnerHistoryProposalPlan(db, { workspaceId: input.workspaceId });

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
      { workspaceId: input.workspaceId },
    );

    if (currentPlan.planHash !== input.confirmedPlanHash) {
      return {
        ...baseDryRunResult(currentPlan),
        status: 'HASH_DRIFT' as const,
        dryRun: false,
      };
    }

    const transactionIds = currentPlan.proposals.map((p) => p.transactionId);
    const resolvedAt = new Date();

    const expired = transactionIds.length === 0
      ? { count: 0 }
      : await (tx as unknown as OwnerHistoryDb).categorizationSuggestion.updateMany({
          where: {
            workspaceId: input.workspaceId,
            transactionId: { in: transactionIds },
            status: 'PENDING',
          },
          data: { status: 'EXPIRED', resolvedAt },
        });

    const createData: Prisma.CategorizationSuggestionCreateManyInput[] = currentPlan.proposals.flatMap((proposal) =>
      proposal.allRanks.map((ranked) => ({
        workspaceId: input.workspaceId,
        transactionId: proposal.transactionId,
        projectId: ranked.projectId,
        transactionTypeId: ranked.transactionTypeId,
        categoryId: ranked.categoryId,
        confidence: ranked.confidence,
        matcher: ranked.matcher,
        rank: ranked.rank,
        scoreBasisPoints: ranked.scoreBasisPoints,
        evidence: ranked.evidence as unknown as Prisma.InputJsonValue,
        evidenceHash: ranked.evidenceHash,
        status: 'PENDING' as const,
      })),
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
