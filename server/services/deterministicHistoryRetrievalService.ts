import type { MerchantRetrievalAnchor } from './merchantRetrievalAnchor';
import {
  HISTORY_SUGGESTION_ALGORITHM_VERSION,
  HISTORY_SUGGESTION_COMPONENT_WEIGHTS,
  evaluateHistoryScoreComponents,
  rankHistorySuggestions,
  type HistoryScoreComponents,
  type HistorySuggestionFacts,
  type RankedHistorySuggestion,
} from './historySuggestionService';
import {
  CONFIRMED_HISTORY_ELIGIBILITY_VERSION,
  type EligibleConfirmedHistoryBooking,
} from './confirmedHistoryEligibilityService';
import { hashEvidence } from './reviewDecisionService';

export const DETERMINISTIC_HISTORY_RETRIEVAL_VERSION = 'deterministic-history-retrieval-v1';
export const DEFAULT_HISTORY_RETRIEVAL_BOUNDS = Object.freeze({
  maximumHistoryRows: 500,
  maximumCandidates: 3,
  lookbackDays: 1825,
  minimumScoreBasisPoints: 3000,
});

export type DeterministicHistoryRetrievalAbstentionReason =
  | 'NO_ELIGIBLE_HISTORY'
  | 'NO_SCORE_ABOVE_THRESHOLD';

export class DeterministicHistoryRetrievalError extends Error {
  constructor(
    public readonly code: 'invalid_eligibility_version' | 'cross_workspace_history',
    message: string,
  ) {
    super(message);
    this.name = 'DeterministicHistoryRetrievalError';
  }
}

export type DeterministicHistoryRetrievalCandidate = RankedHistorySuggestion & {
  scorerVersion: typeof DETERMINISTIC_HISTORY_RETRIEVAL_VERSION;
  eligibilityVersion: typeof CONFIRMED_HISTORY_ELIGIBILITY_VERSION;
  historyTransactionId: string;
  bookingId: string;
  reviewDecisionId: string;
  componentScores: HistoryScoreComponents & {
    frequencyBasisPoints: number;
  };
  privacySafeEvidence: {
    matchedHistoryCount: number;
    provenanceHashes: string[];
    bookingEvidenceHashes: string[];
    decisionEvidenceHashes: string[];
    exactIbanMatchEvidenceHashes: string[];
    merchantAnchorState: string;
    merchantAnchorEvidenceHash: string;
    merchantAnchorEvaluationHash: string;
    merchantAnchorSupportingEvidenceCount: number;
    merchantAnchorConflictingEvidenceCount: number;
  };
  retrievalHash: string;
};

export type DeterministicHistoryRetrievalResult = {
  scorerVersion: typeof DETERMINISTIC_HISTORY_RETRIEVAL_VERSION;
  eligibilityVersion: typeof CONFIRMED_HISTORY_ELIGIBILITY_VERSION;
  workspaceId: string;
  targetTransactionId: string;
  status: 'MATCHED' | 'ABSTAINED';
  abstentionReason: DeterministicHistoryRetrievalAbstentionReason | null;
  bounds: {
    maximumHistoryRows: number;
    maximumCandidates: number;
    lookbackDays: number;
    minimumScoreBasisPoints: number;
    eligibleHistoryRowsSupplied: number;
    eligibleHistoryRowsConsidered: number;
    historyRowsTruncated: boolean;
  };
  weights: typeof HISTORY_SUGGESTION_COMPONENT_WEIGHTS;
  candidates: DeterministicHistoryRetrievalCandidate[];
  retrievalHash: string;
  sideEffects: {
    writesPerformed: false;
    createsTransactionBooking: false;
    createsCategorizationSuggestion: false;
    mutatesBankFacts: false;
    mutatesReviewDecisions: false;
    mutatesPeriodState: false;
    mutatesLedgerRecords: false;
    invokesExternalModel: false;
  };
};

const boundedInteger = (
  value: number | undefined,
  fallback: number,
  minimum: number,
  maximum: number,
): number => {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(minimum, Math.min(maximum, Math.floor(value!)));
};

const safeEvidenceFor = (
  target: HistorySuggestionFacts,
  candidate: RankedHistorySuggestion,
  records: EligibleConfirmedHistoryBooking[],
  components: HistoryScoreComponents,
) => {
  const matched = candidate.evidence.matchedHistoricalTransactionIds
    .map((id) => records.find((record) => record.transactionId === id))
    .filter((record): record is EligibleConfirmedHistoryBooking => Boolean(record));
  return {
    matchedHistoryCount: matched.length,
    provenanceHashes: matched.map((record) => record.confirmedHistory.provenanceHash),
    bookingEvidenceHashes: matched.map((record) => record.bookingEvidenceHash),
    decisionEvidenceHashes: matched.map((record) => record.confirmedHistory.decisionEvidenceHash),
    exactIbanMatchEvidenceHashes: components.exactIbanMatched && matched[0]
      ? [hashEvidence({
          scorerVersion: DETERMINISTIC_HISTORY_RETRIEVAL_VERSION,
          targetTransactionId: target.transactionId,
          historyTransactionId: matched[0].transactionId,
          bookingEvidenceHash: matched[0].bookingEvidenceHash,
          provenanceHash: matched[0].confirmedHistory.provenanceHash,
          signal: 'EXACT_IBAN_MATCH',
        })]
      : [],
    merchantAnchorState: candidate.evidence.merchantAnchor.state,
    merchantAnchorEvidenceHash: candidate.evidence.merchantAnchor.evidenceHash,
    merchantAnchorEvaluationHash: candidate.evidence.merchantAnchor.evaluationHash,
    merchantAnchorSupportingEvidenceCount: candidate.evidence.merchantAnchor.supportingEvidenceCount,
    merchantAnchorConflictingEvidenceCount: candidate.evidence.merchantAnchor.conflictingEvidenceCount,
  };
};

export const retrieveDeterministicConfirmedHistory = (input: {
  workspaceId: string;
  target: HistorySuggestionFacts;
  eligibleHistory: EligibleConfirmedHistoryBooking[];
  merchantAnchor?: MerchantRetrievalAnchor | null;
  merchantAnchorEnabled?: boolean;
  maximumHistoryRows?: number;
  maximumCandidates?: number;
  lookbackDays?: number;
  minimumScoreBasisPoints?: number;
}): DeterministicHistoryRetrievalResult => {
  for (const record of input.eligibleHistory) {
    if (record.confirmedHistory.eligibilityVersion !== CONFIRMED_HISTORY_ELIGIBILITY_VERSION) {
      throw new DeterministicHistoryRetrievalError(
        'invalid_eligibility_version',
        'Only confirmed-history-v1 records may be scored.',
      );
    }
    if (record.confirmedHistory.workspaceId !== input.workspaceId) {
      throw new DeterministicHistoryRetrievalError(
        'cross_workspace_history',
        'Confirmed history from another workspace is not allowed.',
      );
    }
  }

  const maximumHistoryRows = boundedInteger(
    input.maximumHistoryRows,
    DEFAULT_HISTORY_RETRIEVAL_BOUNDS.maximumHistoryRows,
    1,
    1000,
  );
  const maximumCandidates = boundedInteger(
    input.maximumCandidates,
    DEFAULT_HISTORY_RETRIEVAL_BOUNDS.maximumCandidates,
    1,
    3,
  );
  const lookbackDays = boundedInteger(
    input.lookbackDays,
    DEFAULT_HISTORY_RETRIEVAL_BOUNDS.lookbackDays,
    30,
    3650,
  );
  const minimumScoreBasisPoints = boundedInteger(
    input.minimumScoreBasisPoints,
    DEFAULT_HISTORY_RETRIEVAL_BOUNDS.minimumScoreBasisPoints,
    0,
    10000,
  );
  const notBefore = new Date(input.target.date.getTime() - (lookbackDays * 86400000));
  const compatibleWindow = input.eligibleHistory
    .filter((record) =>
      record.transactionId !== input.target.transactionId
      && record.date.getTime() <= input.target.date.getTime()
      && record.date.getTime() >= notBefore.getTime())
    .sort((left, right) => {
      const dateDifference = right.date.getTime() - left.date.getTime();
      return dateDifference || right.transactionId.localeCompare(left.transactionId);
    });
  const boundedHistory = compatibleWindow.slice(0, maximumHistoryRows);
  const ranked = rankHistorySuggestions(input.target, boundedHistory, {
    algorithmVersion: HISTORY_SUGGESTION_ALGORITHM_VERSION,
    limit: maximumCandidates,
    workspaceId: input.workspaceId,
    merchantAnchor: input.merchantAnchor,
    merchantAnchorEnabled: input.merchantAnchorEnabled,
  }).filter((candidate) => candidate.scoreBasisPoints >= minimumScoreBasisPoints);

  const candidates: DeterministicHistoryRetrievalCandidate[] = ranked.map((candidate) => {
    const strongest = boundedHistory.find(
      (record) => record.transactionId === candidate.evidence.matchedHistoricalTransactionIds[0],
    );
    if (!strongest) {
      throw new Error('Deterministic retrieval candidate is missing its strongest confirmed-history record.');
    }
    const componentScores = evaluateHistoryScoreComponents(input.target, strongest, {
      workspaceId: input.workspaceId,
      merchantAnchor: input.merchantAnchor,
      merchantAnchorEnabled: input.merchantAnchorEnabled,
    });
    const frequencyBasisPoints = Math.max(0, candidate.scoreBasisPoints - componentScores.historyScoreBasisPoints);
    const privacySafeEvidence = safeEvidenceFor(input.target, candidate, boundedHistory, componentScores);
    const base = {
      ...candidate,
      scorerVersion: DETERMINISTIC_HISTORY_RETRIEVAL_VERSION as typeof DETERMINISTIC_HISTORY_RETRIEVAL_VERSION,
      eligibilityVersion: CONFIRMED_HISTORY_ELIGIBILITY_VERSION as typeof CONFIRMED_HISTORY_ELIGIBILITY_VERSION,
      historyTransactionId: strongest.transactionId,
      bookingId: strongest.bookingId,
      reviewDecisionId: strongest.confirmedHistory.reviewDecisionId,
      componentScores: {
        ...componentScores,
        frequencyBasisPoints,
      },
      privacySafeEvidence,
    };
    return {
      ...base,
      retrievalHash: hashEvidence(base),
    };
  });

  const status = candidates.length > 0 ? 'MATCHED' as const : 'ABSTAINED' as const;
  const abstentionReason = status === 'MATCHED'
    ? null
    : boundedHistory.length === 0
      ? 'NO_ELIGIBLE_HISTORY' as const
      : 'NO_SCORE_ABOVE_THRESHOLD' as const;
  const resultWithoutHash = {
    scorerVersion: DETERMINISTIC_HISTORY_RETRIEVAL_VERSION as typeof DETERMINISTIC_HISTORY_RETRIEVAL_VERSION,
    eligibilityVersion: CONFIRMED_HISTORY_ELIGIBILITY_VERSION as typeof CONFIRMED_HISTORY_ELIGIBILITY_VERSION,
    workspaceId: input.workspaceId,
    targetTransactionId: input.target.transactionId,
    status,
    abstentionReason,
    bounds: {
      maximumHistoryRows,
      maximumCandidates,
      lookbackDays,
      minimumScoreBasisPoints,
      eligibleHistoryRowsSupplied: input.eligibleHistory.length,
      eligibleHistoryRowsConsidered: boundedHistory.length,
      historyRowsTruncated: compatibleWindow.length > boundedHistory.length,
    },
    weights: HISTORY_SUGGESTION_COMPONENT_WEIGHTS,
    candidates,
    sideEffects: {
      writesPerformed: false as const,
      createsTransactionBooking: false as const,
      createsCategorizationSuggestion: false as const,
      mutatesBankFacts: false as const,
      mutatesReviewDecisions: false as const,
      mutatesPeriodState: false as const,
      mutatesLedgerRecords: false as const,
      invokesExternalModel: false as const,
    },
  };
  return {
    ...resultWithoutHash,
    retrievalHash: hashEvidence(resultWithoutHash),
  };
};
