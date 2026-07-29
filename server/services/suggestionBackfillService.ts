import type { Prisma, PrismaClient, TransactionDirection } from '@prisma/client';
import {
  HISTORY_SUGGESTION_ALGORITHM_VERSION,
  rankHistorySuggestions,
  type ApprovedHistoryBooking,
  type RankedHistorySuggestion,
} from './historySuggestionService';
import { toHistorySuggestionFacts } from './transactionSuggestionFacts';
import {
  loadConfirmedHistoryEligibility,
  type EligibleConfirmedHistoryBooking,
} from './confirmedHistoryEligibilityService';
import {
  DETERMINISTIC_HISTORY_RETRIEVAL_VERSION,
  retrieveDeterministicConfirmedHistory,
  type DeterministicHistoryRetrievalResult,
} from './deterministicHistoryRetrievalService';
import {
  buildDeterministicRetrievalEvidence,
  type DeterministicRetrievalEvidenceResult,
} from './deterministicRetrievalEvidenceService';
import {
  buildRestrictedRetrievalCandidates,
  loadRestrictedDimensionRecords,
  type RestrictedRetrievalCandidateResult,
} from './restrictedRetrievalCandidateService';
import {
  buildDeterministicDecision,
  type DeterministicDecisionResult,
} from './deterministicDecisionService';
import {
  orchestrateDeterministicDecision,
  type DeterministicOrchestrationResult,
} from './deterministicDecisionOrchestrationService';
import { hashEvidence } from './reviewDecisionService';

export type SuggestionBackfillTransaction = {
  id: string;
  date: Date;
  accountId: string | null;
  direction: TransactionDirection;
  amountMinor: bigint;
  counterparty: string | null;
  reference: string | null;
  description: string;
  rawRow: unknown;
};

export type SuggestionBackfillHistory = SuggestionBackfillTransaction & {
  transactionBooking: {
    id: string;
    projectId: string;
    transactionTypeId: string;
    categoryId: string;
    evidenceHash: string;
  };
};

export type PlannedSuggestion = RankedHistorySuggestion & {
  transactionId: string;
};

export type SuggestionBackfillPlan = {
  algorithmVersion: string;
  unresolvedTransactionCount: number;
  compatibleHistoryCount: number;
  completeRankOneCount: number;
  uncoveredTransactionCount: number;
  plannedSuggestionCount: number;
  matcherDistribution: Record<string, number>;
  confidenceDistribution: Record<string, number>;
  suggestions: PlannedSuggestion[];
  sideEffects: {
    writesPerformed: false;
    createsTransactionBooking: false;
    closesPeriod: false;
    mutatesBankFacts: false;
  };
};

export type SuggestionBackfillResult = Omit<SuggestionBackfillPlan, 'sideEffects'> & {
  dryRun: boolean;
  writesPerformed: boolean;
  expiredSuggestionCount: number;
  createdSuggestionCount: number;
  status:
    | 'DRY_RUN_COMPLETE'
    | 'CREATED'
    | 'EXECUTION_NOT_ALLOWED'
    | 'CONFIRMATION_REQUIRED'
    | 'WORKSPACE_NOT_FOUND';
  sideEffects: {
    createsCategorizationSuggestion: boolean;
    expiresPendingSuggestion: boolean;
    createsTransactionBooking: false;
    closesPeriod: false;
    mutatesBankFacts: false;
  };
};

type SuggestionBackfillDb = Pick<
  PrismaClient,
  | 'workspaceMembership'
  | 'transaction'
  | 'project'
  | 'transactionType'
  | 'category'
  | 'categorizationSuggestion'
  | '$transaction'
>;

export type SuggestionBackfillInput = {
  userId: string;
  execute?: boolean;
  executionAllowed?: boolean;
  confirmBackfill?: boolean;
  algorithmVersion?: string;
};

export type ReadOnlyPhase4PipelineResult = {
  retrieval: DeterministicHistoryRetrievalResult;
  evidence: DeterministicRetrievalEvidenceResult;
  candidates: RestrictedRetrievalCandidateResult;
  decision: DeterministicDecisionResult;
  orchestration: DeterministicOrchestrationResult;
};

const toHistory = (transaction: SuggestionBackfillHistory): ApprovedHistoryBooking => ({
  ...toHistorySuggestionFacts(transaction),
  bookingId: transaction.transactionBooking.id,
  projectId: transaction.transactionBooking.projectId,
  transactionTypeId: transaction.transactionBooking.transactionTypeId,
  categoryId: transaction.transactionBooking.categoryId,
  bookingEvidenceHash: transaction.transactionBooking.evidenceHash,
});

const increment = (distribution: Record<string, number>, key: string) => {
  distribution[key] = (distribution[key] ?? 0) + 1;
};

export const buildSuggestionBackfillPlan = (input: {
  unresolvedTransactions: SuggestionBackfillTransaction[];
  approvedHistory: SuggestionBackfillHistory[];
  algorithmVersion?: string;
}): SuggestionBackfillPlan => {
  const algorithmVersion = input.algorithmVersion ?? HISTORY_SUGGESTION_ALGORITHM_VERSION;
  const history = input.approvedHistory.map(toHistory);
  const suggestions: PlannedSuggestion[] = [];
  const matcherDistribution: Record<string, number> = {};
  const confidenceDistribution: Record<string, number> = {};
  let completeRankOneCount = 0;

  for (const transaction of [...input.unresolvedTransactions].sort((left, right) => {
    const dateDifference = left.date.getTime() - right.date.getTime();
    return dateDifference || left.id.localeCompare(right.id);
  })) {
    const ranked = rankHistorySuggestions(toHistorySuggestionFacts(transaction), history, { algorithmVersion, limit: 3 });
    if (ranked[0]) completeRankOneCount += 1;
    for (const candidate of ranked) {
      increment(matcherDistribution, candidate.matcher);
      increment(confidenceDistribution, candidate.confidence);
      suggestions.push({ transactionId: transaction.id, ...candidate });
    }
  }

  return {
    algorithmVersion,
    unresolvedTransactionCount: input.unresolvedTransactions.length,
    compatibleHistoryCount: input.approvedHistory.length,
    completeRankOneCount,
    uncoveredTransactionCount: input.unresolvedTransactions.length - completeRankOneCount,
    plannedSuggestionCount: suggestions.length,
    matcherDistribution,
    confidenceDistribution,
    suggestions,
    sideEffects: {
      writesPerformed: false,
      createsTransactionBooking: false,
      closesPeriod: false,
      mutatesBankFacts: false,
    },
  };
};

type ReadOnlyPhase4PipelineDb = Pick<PrismaClient, 'project' | 'transactionType' | 'category'>;

const buildReadOnlyPhase4PipelineFromEvidence = async (input: {
  db: ReadOnlyPhase4PipelineDb;
  workspaceId: string;
  target: ReturnType<typeof toHistorySuggestionFacts>;
  retrieval: DeterministicHistoryRetrievalResult;
  evidence: DeterministicRetrievalEvidenceResult;
}): Promise<ReadOnlyPhase4PipelineResult> => {
  const records = await loadRestrictedDimensionRecords(input.db, {
    workspaceId: input.workspaceId,
    evidence: input.evidence,
  });
  const candidates = buildRestrictedRetrievalCandidates({
    workspaceId: input.workspaceId,
    evidence: input.evidence,
    ...records,
  });
  const transactionFactHash = hashEvidence({
    transactionId: input.target.transactionId,
    date: input.target.date,
    accountId: input.target.accountId,
    direction: input.target.direction,
    amountMinor: input.target.amountMinor,
  });
  const decision = buildDeterministicDecision({
    workspaceId: input.workspaceId,
    transactionFactHash,
    retrieval: input.retrieval,
    evidence: input.evidence,
    candidates,
  });
  const orchestration = orchestrateDeterministicDecision({
    workspaceId: input.workspaceId,
    targetTransactionId: input.target.transactionId,
    transactionFactHash,
    decision,
  });
  return { retrieval: input.retrieval, evidence: input.evidence, candidates, decision, orchestration };
};

export const buildReadOnlyPhase4Pipeline = async (input: {
  db: ReadOnlyPhase4PipelineDb;
  workspaceId: string;
  transaction: SuggestionBackfillTransaction;
  eligibleHistory: EligibleConfirmedHistoryBooking[];
}): Promise<ReadOnlyPhase4PipelineResult> => {
  const target = toHistorySuggestionFacts(input.transaction);
  const retrieval = retrieveDeterministicConfirmedHistory({
    workspaceId: input.workspaceId,
    target,
    eligibleHistory: input.eligibleHistory,
  });
  const evidence = buildDeterministicRetrievalEvidence({
    workspaceId: input.workspaceId,
    target,
    eligibleHistory: input.eligibleHistory,
    retrieval,
  });
  return buildReadOnlyPhase4PipelineFromEvidence({
    db: input.db,
    workspaceId: input.workspaceId,
    target,
    retrieval,
    evidence,
  });
};

const buildSuggestionBackfillPlanFromEligibleHistory = async (input: {
  db: ReadOnlyPhase4PipelineDb;
  workspaceId: string;
  unresolvedTransactions: SuggestionBackfillTransaction[];
  eligibleHistory: EligibleConfirmedHistoryBooking[];
}): Promise<SuggestionBackfillPlan> => {
  const suggestions: PlannedSuggestion[] = [];
  const matcherDistribution: Record<string, number> = {};
  const confidenceDistribution: Record<string, number> = {};
  let completeRankOneCount = 0;

  for (const transaction of [...input.unresolvedTransactions].sort((left, right) => {
    const dateDifference = left.date.getTime() - right.date.getTime();
    return dateDifference || left.id.localeCompare(right.id);
  })) {
    const target = toHistorySuggestionFacts(transaction);
    const retrieval = retrieveDeterministicConfirmedHistory({
      workspaceId: input.workspaceId,
      target,
      eligibleHistory: input.eligibleHistory,
    });
    const evidence = buildDeterministicRetrievalEvidence({
      workspaceId: input.workspaceId,
      target,
      eligibleHistory: input.eligibleHistory,
      retrieval,
    });
    if (evidence.status !== 'MATCHED') continue;

    let transactionHasValidCandidate = false;
    for (const explained of evidence.candidates) {
      const candidateEvidence = { ...evidence, candidates: [explained] };
      const { orchestration } = await buildReadOnlyPhase4PipelineFromEvidence({
        db: input.db,
        workspaceId: input.workspaceId,
        target,
        retrieval,
        evidence: candidateEvidence,
      });
      if (orchestration.status !== 'MATCHED' || !orchestration.finalDecision) continue;

      const candidate = explained.candidate;
      if (
        orchestration.finalDecision.dimensions.project.selectedCandidateId !== candidate.projectId
        || orchestration.finalDecision.dimensions.transactionType.selectedCandidateId !== candidate.transactionTypeId
        || orchestration.finalDecision.dimensions.category.selectedCandidateId !== candidate.categoryId
      ) continue;

      transactionHasValidCandidate = true;
      increment(matcherDistribution, candidate.matcher);
      increment(confidenceDistribution, candidate.confidence);
      suggestions.push({ transactionId: transaction.id, ...candidate });
    }
    if (transactionHasValidCandidate) completeRankOneCount += 1;
  }

  return {
    algorithmVersion: DETERMINISTIC_HISTORY_RETRIEVAL_VERSION,
    unresolvedTransactionCount: input.unresolvedTransactions.length,
    compatibleHistoryCount: input.eligibleHistory.length,
    completeRankOneCount,
    uncoveredTransactionCount: input.unresolvedTransactions.length - completeRankOneCount,
    plannedSuggestionCount: suggestions.length,
    matcherDistribution,
    confidenceDistribution,
    suggestions,
    sideEffects: {
      writesPerformed: false,
      createsTransactionBooking: false,
      closesPeriod: false,
      mutatesBankFacts: false,
    },
  };
};

const loadPlan = async (
  db: Pick<PrismaClient, 'transaction' | 'project' | 'transactionType' | 'category'>,
  userId: string,
  workspaceId: string,
  algorithmVersion: string,
): Promise<{
  plan: SuggestionBackfillPlan;
  unresolvedTransactionIds: string[];
}> => {
  const [unresolvedTransactions, eligibility] = await Promise.all([
    db.transaction.findMany({
      where: { userId, transactionBooking: null },
      orderBy: [{ date: 'asc' }, { id: 'asc' }],
      select: {
        id: true,
        date: true,
        accountId: true,
        direction: true,
        amountMinor: true,
        counterparty: true,
        reference: true,
        description: true,
        rawRow: true,
      },
    }),
    loadConfirmedHistoryEligibility(db, { workspaceId, userId }),
  ]);

  return {
    plan: await buildSuggestionBackfillPlanFromEligibleHistory({
      db,
      workspaceId,
      unresolvedTransactions: unresolvedTransactions as SuggestionBackfillTransaction[],
      eligibleHistory: eligibility.eligibleHistory,
    }),
    unresolvedTransactionIds: unresolvedTransactions.map((transaction) => transaction.id),
  };
};

const baseResult = (
  plan: SuggestionBackfillPlan,
  status: SuggestionBackfillResult['status'],
  dryRun: boolean,
  writesPerformed = false,
  expiredSuggestionCount = 0,
  createdSuggestionCount = 0,
): SuggestionBackfillResult => ({
  ...plan,
  status,
  dryRun,
  writesPerformed,
  expiredSuggestionCount,
  createdSuggestionCount,
  sideEffects: {
    createsCategorizationSuggestion: createdSuggestionCount > 0,
    expiresPendingSuggestion: expiredSuggestionCount > 0,
    createsTransactionBooking: false,
    closesPeriod: false,
    mutatesBankFacts: false,
  },
});

export const backfillHistorySuggestions = async (
  db: SuggestionBackfillDb,
  input: SuggestionBackfillInput,
): Promise<SuggestionBackfillResult> => {
  const algorithmVersion = input.algorithmVersion ?? HISTORY_SUGGESTION_ALGORITHM_VERSION;
  const membership = await db.workspaceMembership.findFirst({
    where: {
      userId: input.userId,
      isActive: true,
      workspace: { isActive: true },
    },
    orderBy: { createdAt: 'asc' },
    select: { workspaceId: true },
  });
  const execute = input.execute === true;
  if (!membership) {
    return baseResult(buildSuggestionBackfillPlan({
      unresolvedTransactions: [],
      approvedHistory: [],
      algorithmVersion,
    }), 'WORKSPACE_NOT_FOUND', !execute);
  }

  const loaded = await loadPlan(db, input.userId, membership.workspaceId, algorithmVersion);
  const plan = loaded.plan;
  if (!execute) return baseResult(plan, 'DRY_RUN_COMPLETE', true);
  if (input.executionAllowed !== true) return baseResult(plan, 'EXECUTION_NOT_ALLOWED', false);
  if (input.confirmBackfill !== true) return baseResult(plan, 'CONFIRMATION_REQUIRED', false);

  return db.$transaction(async (tx) => {
    const current = await loadPlan(tx, input.userId, membership.workspaceId, algorithmVersion);
    const currentPlan = current.plan;
    const transactionIds = Array.from(new Set(current.unresolvedTransactionIds));
    const resolvedAt = new Date();
    const expired = transactionIds.length === 0
      ? { count: 0 }
      : await tx.categorizationSuggestion.updateMany({
          where: {
            workspaceId: membership.workspaceId,
            transactionId: { in: transactionIds },
            status: 'PENDING',
          },
          data: { status: 'EXPIRED', resolvedAt },
        });

    const createData: Prisma.CategorizationSuggestionCreateManyInput[] = currentPlan.suggestions.map((suggestion) => ({
      workspaceId: membership.workspaceId,
      transactionId: suggestion.transactionId,
      projectId: suggestion.projectId,
      transactionTypeId: suggestion.transactionTypeId,
      categoryId: suggestion.categoryId,
      confidence: suggestion.confidence,
      matcher: suggestion.matcher,
      rank: suggestion.rank,
      scoreBasisPoints: suggestion.scoreBasisPoints,
      evidence: suggestion.evidence as unknown as Prisma.InputJsonValue,
      evidenceHash: suggestion.evidenceHash,
      status: 'PENDING',
    }));
    const created = createData.length === 0
      ? { count: 0 }
      : await tx.categorizationSuggestion.createMany({ data: createData });

    return baseResult(
      currentPlan,
      'CREATED',
      false,
      created.count > 0 || expired.count > 0,
      expired.count,
      created.count,
    );
  });
};
