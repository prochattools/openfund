import type { MerchantRetrievalAnchor } from './merchantRetrievalAnchor';
import {
  CONFIRMED_HISTORY_ELIGIBILITY_VERSION,
  type EligibleConfirmedHistoryBooking,
} from './confirmedHistoryEligibilityService';
import {
  evaluateHistoryScoreComponents,
  type HistoryScoreComponents,
  type HistorySuggestionFacts,
} from './historySuggestionService';
import {
  DETERMINISTIC_HISTORY_RETRIEVAL_VERSION,
  type DeterministicHistoryRetrievalCandidate,
  type DeterministicHistoryRetrievalResult,
} from './deterministicHistoryRetrievalService';
import { hashEvidence } from './reviewDecisionService';

export const DETERMINISTIC_RETRIEVAL_EVIDENCE_VERSION = 'deterministic-retrieval-evidence-v1';
export const MATERIAL_CONFLICT_SCORE_RATIO_PERCENT = 90;
export const MATERIAL_CONFLICT_MINIMUM_SCORE_BASIS_POINTS = 3000;

export type RetrievalEvidenceDimension = 'PROJECT' | 'TRANSACTION_TYPE' | 'CATEGORY';
export type RetrievalEvidenceStatus = 'SUPPORTED' | 'ABSENT' | 'INSUFFICIENT' | 'CONFLICTED';
export type RetrievalEvidenceCode =
  | 'EXACT_IBAN'
  | 'EXACT_COUNTERPARTY'
  | 'EXACT_DESCRIPTION'
  | 'EXACT_PAYMENT_PURPOSE'
  | 'TOKEN_SIMILARITY'
  | 'SAME_ACCOUNT'
  | 'EXACT_AMOUNT'
  | 'RECURRING_MONTH'
  | 'RECENCY'
  | 'MERCHANT_ANCHOR'
  | 'FREQUENCY';

export type RetrievalEvidenceReference = {
  historyTransactionId: string;
  bookingId: string;
  reviewDecisionId: string;
  provenanceHash: string;
  bookingEvidenceHash: string;
  decisionEvidenceHash: string;
  scoreBasisPoints: number;
};

export type RetrievalDimensionAlternative = {
  valueId: string;
  supportCount: number;
  supportScoreBasisPoints: number;
  strongestEvidence: RetrievalEvidenceReference[];
  evidenceHash: string;
  material: boolean;
};

export type RetrievalDimensionEvidence = {
  dimension: RetrievalEvidenceDimension;
  selectedValueId: string;
  status: RetrievalEvidenceStatus;
  supportCount: number;
  supportScoreBasisPoints: number;
  componentCodes: RetrievalEvidenceCode[];
  componentScores: HistoryScoreComponents & { frequencyBasisPoints: number };
  supportingEvidence: RetrievalEvidenceReference[];
  conflictingEvidence: RetrievalDimensionAlternative[];
  materialConflict: boolean;
  evidenceHash: string;
};

export type RetrievalCandidateEvidence = {
  evidenceVersion: typeof DETERMINISTIC_RETRIEVAL_EVIDENCE_VERSION;
  candidate: DeterministicHistoryRetrievalCandidate;
  dimensions: {
    project: RetrievalDimensionEvidence;
    transactionType: RetrievalDimensionEvidence;
    category: RetrievalDimensionEvidence;
  };
  evidenceStatus: 'SUPPORTED' | 'INSUFFICIENT' | 'MATERIAL_CONFLICT';
  evidenceHash: string;
};

export type DeterministicRetrievalEvidenceResult = {
  evidenceVersion: typeof DETERMINISTIC_RETRIEVAL_EVIDENCE_VERSION;
  scorerVersion: typeof DETERMINISTIC_HISTORY_RETRIEVAL_VERSION;
  eligibilityVersion: typeof CONFIRMED_HISTORY_ELIGIBILITY_VERSION;
  workspaceId: string;
  targetTransactionId: string;
  status: 'MATCHED' | 'ABSTAINED';
  abstentionReason:
    | DeterministicHistoryRetrievalResult['abstentionReason']
    | 'INSUFFICIENT_EVIDENCE'
    | 'MATERIAL_CONFLICT';
  candidates: RetrievalCandidateEvidence[];
  materialConflictRule: {
    version: typeof DETERMINISTIC_RETRIEVAL_EVIDENCE_VERSION;
    scoreRatioPercent: typeof MATERIAL_CONFLICT_SCORE_RATIO_PERCENT;
    minimumCompetingScoreBasisPoints: typeof MATERIAL_CONFLICT_MINIMUM_SCORE_BASIS_POINTS;
  };
  evidenceHash: string;
  sideEffects: DeterministicHistoryRetrievalResult['sideEffects'];
};

type ScoredRecord = {
  record: EligibleConfirmedHistoryBooking;
  components: HistoryScoreComponents;
};

type DimensionAccessor = {
  dimension: RetrievalEvidenceDimension;
  value: (record: EligibleConfirmedHistoryBooking) => string;
};

const DIMENSIONS: Record<'project' | 'transactionType' | 'category', DimensionAccessor> = {
  project: { dimension: 'PROJECT', value: (record) => record.projectId },
  transactionType: { dimension: 'TRANSACTION_TYPE', value: (record) => record.transactionTypeId },
  category: { dimension: 'CATEGORY', value: (record) => record.categoryId },
};

const reference = (item: ScoredRecord): RetrievalEvidenceReference => ({
  historyTransactionId: item.record.transactionId,
  bookingId: item.record.bookingId,
  reviewDecisionId: item.record.confirmedHistory.reviewDecisionId,
  provenanceHash: item.record.confirmedHistory.provenanceHash,
  bookingEvidenceHash: item.record.bookingEvidenceHash,
  decisionEvidenceHash: item.record.confirmedHistory.decisionEvidenceHash,
  scoreBasisPoints: item.components.historyScoreBasisPoints,
});

const sortScored = (left: ScoredRecord, right: ScoredRecord): number =>
  right.components.historyScoreBasisPoints - left.components.historyScoreBasisPoints
  || right.record.date.getTime() - left.record.date.getTime()
  || left.record.transactionId.localeCompare(right.record.transactionId);

const aggregateScore = (items: ScoredRecord[]): number => {
  if (items.length === 0) return 0;
  const strongest = [...items].sort(sortScored)[0]!.components.historyScoreBasisPoints;
  return Math.min(10000, strongest + Math.min(800, Math.max(0, items.length - 1) * 100));
};

const componentCodes = (
  components: HistoryScoreComponents,
  frequencyBasisPoints: number,
): RetrievalEvidenceCode[] => [
  ...(components.exactIbanBasisPoints > 0 ? ['EXACT_IBAN' as const] : []),
  ...(components.exactCounterpartyBasisPoints > 0 ? ['EXACT_COUNTERPARTY' as const] : []),
  ...(components.exactDescriptionBasisPoints > 0 ? ['EXACT_DESCRIPTION' as const] : []),
  ...(components.exactPurposeBasisPoints > 0 ? ['EXACT_PAYMENT_PURPOSE' as const] : []),
  ...(components.tokenSimilarityContributionBasisPoints > 0 ? ['TOKEN_SIMILARITY' as const] : []),
  ...(components.sameAccountBasisPoints > 0 ? ['SAME_ACCOUNT' as const] : []),
  ...(components.exactAmountBasisPoints > 0 ? ['EXACT_AMOUNT' as const] : []),
  ...(components.recurringMonthBasisPoints > 0 ? ['RECURRING_MONTH' as const] : []),
  ...(components.recencyBasisPoints > 0 ? ['RECENCY' as const] : []),
  ...(components.merchantAnchorBasisPoints > 0 ? ['MERCHANT_ANCHOR' as const] : []),
  ...(frequencyBasisPoints > 0 ? ['FREQUENCY' as const] : []),
];

const dimensionEvidence = (input: {
  accessor: DimensionAccessor;
  selectedValueId: string;
  scoredRecords: ScoredRecord[];
  minimumScoreBasisPoints: number;
}): RetrievalDimensionEvidence => {
  const groups = new Map<string, ScoredRecord[]>();
  for (const item of input.scoredRecords) {
    const value = input.accessor.value(item.record);
    groups.set(value, [...(groups.get(value) ?? []), item]);
  }

  const supporting = [...(groups.get(input.selectedValueId) ?? [])].sort(sortScored);
  const supportScoreBasisPoints = aggregateScore(supporting);
  const strongestComponents = supporting[0]?.components ?? {
    exactIbanBasisPoints: 0,
    exactCounterpartyBasisPoints: 0,
    exactDescriptionBasisPoints: 0,
    exactPurposeBasisPoints: 0,
    tokenSimilarityBasisPoints: 0,
    tokenSimilarityContributionBasisPoints: 0,
    sameAccountBasisPoints: 0,
    exactAmountBasisPoints: 0,
    recurringMonthBasisPoints: 0,
    recencyBasisPoints: 0,
    merchantAnchorBasisPoints: 0,
    historyScoreBasisPoints: 0,
    exactIbanMatched: false,
  };
  const frequencyBasisPoints = Math.min(800, Math.max(0, supporting.length - 1) * 100);

  const conflictingEvidence = [...groups.entries()]
    .filter(([value]) => value !== input.selectedValueId)
    .map(([valueId, items]) => {
      const sorted = [...items].sort(sortScored);
      const supportScore = aggregateScore(sorted);
      const material = supportScore >= Math.max(
        MATERIAL_CONFLICT_MINIMUM_SCORE_BASIS_POINTS,
        Math.ceil((supportScoreBasisPoints * MATERIAL_CONFLICT_SCORE_RATIO_PERCENT) / 100),
      );
      const base = {
        valueId,
        supportCount: sorted.length,
        supportScoreBasisPoints: supportScore,
        strongestEvidence: sorted.slice(0, 5).map(reference),
        material,
      };
      return { ...base, evidenceHash: hashEvidence(base) };
    })
    .sort((left, right) =>
      right.supportScoreBasisPoints - left.supportScoreBasisPoints
      || right.supportCount - left.supportCount
      || left.valueId.localeCompare(right.valueId));

  const materialConflict = conflictingEvidence.some((item) => item.material);
  const status: RetrievalEvidenceStatus = supporting.length === 0
    ? 'ABSENT'
    : supportScoreBasisPoints < input.minimumScoreBasisPoints
      ? 'INSUFFICIENT'
      : materialConflict
        ? 'CONFLICTED'
        : 'SUPPORTED';
  const base = {
    dimension: input.accessor.dimension,
    selectedValueId: input.selectedValueId,
    status,
    supportCount: supporting.length,
    supportScoreBasisPoints,
    componentCodes: componentCodes(strongestComponents, frequencyBasisPoints),
    componentScores: { ...strongestComponents, frequencyBasisPoints },
    supportingEvidence: supporting.slice(0, 5).map(reference),
    conflictingEvidence,
    materialConflict,
  };
  return { ...base, evidenceHash: hashEvidence(base) };
};

export const buildDeterministicRetrievalEvidence = (input: {
  workspaceId: string;
  target: HistorySuggestionFacts;
  eligibleHistory: EligibleConfirmedHistoryBooking[];
  retrieval: DeterministicHistoryRetrievalResult;
  merchantAnchor?: MerchantRetrievalAnchor | null;
  merchantAnchorEnabled?: boolean;
}): DeterministicRetrievalEvidenceResult => {
  if (input.retrieval.scorerVersion !== DETERMINISTIC_HISTORY_RETRIEVAL_VERSION) {
    throw new Error('Only deterministic-history-retrieval-v1 candidates may be explained.');
  }
  if (input.retrieval.workspaceId !== input.workspaceId) {
    throw new Error('Retrieval evidence workspace does not match the authorized workspace.');
  }
  for (const record of input.eligibleHistory) {
    if (record.confirmedHistory.eligibilityVersion !== CONFIRMED_HISTORY_ELIGIBILITY_VERSION) {
      throw new Error('Only confirmed-history-v1 records may contribute retrieval evidence.');
    }
    if (record.confirmedHistory.workspaceId !== input.workspaceId) {
      throw new Error('Cross-workspace confirmed history may not contribute retrieval evidence.');
    }
  }

  const notBefore = new Date(input.target.date.getTime() - input.retrieval.bounds.lookbackDays * 86400000);
  const bounded = input.eligibleHistory
    .filter((record) =>
      record.transactionId !== input.target.transactionId
      && record.date.getTime() <= input.target.date.getTime()
      && record.date.getTime() >= notBefore.getTime()
      && record.direction === input.target.direction)
    .sort((left, right) =>
      right.date.getTime() - left.date.getTime()
      || right.transactionId.localeCompare(left.transactionId))
    .slice(0, input.retrieval.bounds.maximumHistoryRows);
  const scoredRecords = bounded.map((record) => ({
    record,
    components: evaluateHistoryScoreComponents(input.target, record, {
      workspaceId: input.workspaceId,
      merchantAnchor: input.merchantAnchor,
      merchantAnchorEnabled: input.merchantAnchorEnabled,
    }),
  }));

  const candidates = input.retrieval.candidates.map((candidate) => {
    const dimensions = {
      project: dimensionEvidence({
        accessor: DIMENSIONS.project,
        selectedValueId: candidate.projectId,
        scoredRecords,
        minimumScoreBasisPoints: input.retrieval.bounds.minimumScoreBasisPoints,
      }),
      transactionType: dimensionEvidence({
        accessor: DIMENSIONS.transactionType,
        selectedValueId: candidate.transactionTypeId,
        scoredRecords,
        minimumScoreBasisPoints: input.retrieval.bounds.minimumScoreBasisPoints,
      }),
      category: dimensionEvidence({
        accessor: DIMENSIONS.category,
        selectedValueId: candidate.categoryId,
        scoredRecords,
        minimumScoreBasisPoints: input.retrieval.bounds.minimumScoreBasisPoints,
      }),
    };
    const evidenceStatus = Object.values(dimensions).some((item) => item.materialConflict)
      ? 'MATERIAL_CONFLICT' as const
      : Object.values(dimensions).some((item) => item.status === 'ABSENT' || item.status === 'INSUFFICIENT')
        ? 'INSUFFICIENT' as const
        : 'SUPPORTED' as const;
    const base = {
      evidenceVersion: DETERMINISTIC_RETRIEVAL_EVIDENCE_VERSION as typeof DETERMINISTIC_RETRIEVAL_EVIDENCE_VERSION,
      candidate,
      dimensions,
      evidenceStatus,
    };
    return { ...base, evidenceHash: hashEvidence(base) };
  });

  const top = candidates[0];
  const abstentionReason = input.retrieval.status === 'ABSTAINED'
    ? input.retrieval.abstentionReason
    : top?.evidenceStatus === 'MATERIAL_CONFLICT'
      ? 'MATERIAL_CONFLICT' as const
      : top?.evidenceStatus === 'INSUFFICIENT'
        ? 'INSUFFICIENT_EVIDENCE' as const
        : null;
  const status = abstentionReason ? 'ABSTAINED' as const : 'MATCHED' as const;
  const resultWithoutHash = {
    evidenceVersion: DETERMINISTIC_RETRIEVAL_EVIDENCE_VERSION as typeof DETERMINISTIC_RETRIEVAL_EVIDENCE_VERSION,
    scorerVersion: DETERMINISTIC_HISTORY_RETRIEVAL_VERSION as typeof DETERMINISTIC_HISTORY_RETRIEVAL_VERSION,
    eligibilityVersion: CONFIRMED_HISTORY_ELIGIBILITY_VERSION as typeof CONFIRMED_HISTORY_ELIGIBILITY_VERSION,
    workspaceId: input.workspaceId,
    targetTransactionId: input.target.transactionId,
    status,
    abstentionReason,
    candidates,
    materialConflictRule: {
      version: DETERMINISTIC_RETRIEVAL_EVIDENCE_VERSION as typeof DETERMINISTIC_RETRIEVAL_EVIDENCE_VERSION,
      scoreRatioPercent: MATERIAL_CONFLICT_SCORE_RATIO_PERCENT as typeof MATERIAL_CONFLICT_SCORE_RATIO_PERCENT,
      minimumCompetingScoreBasisPoints: MATERIAL_CONFLICT_MINIMUM_SCORE_BASIS_POINTS as typeof MATERIAL_CONFLICT_MINIMUM_SCORE_BASIS_POINTS,
    },
    sideEffects: input.retrieval.sideEffects,
  };
  return { ...resultWithoutHash, evidenceHash: hashEvidence(resultWithoutHash) };
};
