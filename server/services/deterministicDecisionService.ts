import {
  CONFIRMED_HISTORY_ELIGIBILITY_VERSION,
} from './confirmedHistoryEligibilityService';
import {
  DETERMINISTIC_HISTORY_RETRIEVAL_VERSION,
  type DeterministicHistoryRetrievalResult,
} from './deterministicHistoryRetrievalService';
import {
  DETERMINISTIC_RETRIEVAL_EVIDENCE_VERSION,
  type DeterministicRetrievalEvidenceResult,
  type RetrievalDimensionEvidence,
} from './deterministicRetrievalEvidenceService';
import {
  RESTRICTED_RETRIEVAL_CANDIDATE_VERSION,
  type RestrictedCandidateDimension,
  type RestrictedRetrievalCandidate,
  type RestrictedRetrievalCandidateResult,
} from './restrictedRetrievalCandidateService';
import { hashEvidence } from './reviewDecisionService';

export const DETERMINISTIC_DECISION_VERSION = 'deterministic-decision-v1';

export type DeterministicDecisionStatus = 'PROPOSED' | 'ABSTAINED' | 'CONFLICTED' | 'INCOMPLETE';
export type DeterministicDecisionDimensionStatus = 'SELECTED' | 'ABSTAINED' | 'CONFLICTED' | 'INCOMPLETE';
export type DeterministicDecisionAbstentionReason =
  | 'NO_ELIGIBLE_HISTORY'
  | 'NO_SCORE_ABOVE_THRESHOLD'
  | 'MATERIAL_CONFLICT'
  | 'INSUFFICIENT_EVIDENCE'
  | 'NO_VALID_PROJECT_CANDIDATE'
  | 'NO_VALID_TRANSACTION_TYPE_CANDIDATE'
  | 'NO_VALID_CATEGORY_CANDIDATE'
  | 'STALE_RETRIEVAL'
  | 'STALE_EVIDENCE'
  | 'STALE_CANDIDATES'
  | 'INCOMPLETE_DECISION';

export type DeterministicDecisionExpectedIdentity = {
  retrievalHash?: string;
  evidenceHash?: string;
  candidateSetHash?: string;
};

export type DeterministicDecisionDimension = {
  dimension: RestrictedCandidateDimension;
  status: DeterministicDecisionDimensionStatus;
  selectedCandidateId: string | null;
  selectedCandidateRank: number | null;
  allowedCandidateIds: string[];
  supportingEvidenceCount: number;
  conflictingEvidenceCount: number;
  componentScores: RetrievalDimensionEvidence['componentScores'] | null;
  retrievalHash: string | null;
  evidenceHash: string | null;
  candidateHash: string | null;
  candidateSetHash: string;
  provenanceHashes: string[];
  confidence: {
    calibration: 'UNCALIBRATED';
    scoreBasisPoints: number | null;
    label: string | null;
  };
  reason: DeterministicDecisionAbstentionReason | null;
  dimensionHash: string;
};

export type DeterministicDecisionResult = {
  decisionVersion: typeof DETERMINISTIC_DECISION_VERSION;
  eligibilityVersion: typeof CONFIRMED_HISTORY_ELIGIBILITY_VERSION;
  scorerVersion: typeof DETERMINISTIC_HISTORY_RETRIEVAL_VERSION;
  evidenceVersion: typeof DETERMINISTIC_RETRIEVAL_EVIDENCE_VERSION;
  candidateVersion: typeof RESTRICTED_RETRIEVAL_CANDIDATE_VERSION;
  workspaceId: string;
  targetTransactionId: string;
  transactionFactHash: string | null;
  status: DeterministicDecisionStatus;
  abstentionReason: DeterministicDecisionAbstentionReason | null;
  dimensions: {
    project: DeterministicDecisionDimension;
    transactionType: DeterministicDecisionDimension;
    category: DeterministicDecisionDimension;
  };
  replayIdentity: {
    retrievalHash: string;
    evidenceHash: string;
    candidateSetHash: string;
    weightsHash: string;
    boundsHash: string;
  };
  decisionHash: string;
  sideEffects: {
    readOnly: true;
    previewOnly: true;
    createsTransactionBooking: false;
    createsCategorizationSuggestion: false;
    mutatesBankFacts: false;
    mutatesReviewDecisions: false;
    mutatesPeriodState: false;
    mutatesLedgerRecords: false;
    persistsDecision: false;
    invokesExternalModel: false;
  };
};

export class DeterministicDecisionError extends Error {
  constructor(
    public readonly code: 'workspace_mismatch' | 'version_mismatch' | 'stale_retrieval' | 'stale_evidence' | 'stale_candidates',
    message: string,
  ) {
    super(message);
    this.name = 'DeterministicDecisionError';
  }
}

const selectCandidate = (
  candidates: RestrictedRetrievalCandidate[],
  selectedId: string | null,
): RestrictedRetrievalCandidate | null => {
  if (!selectedId) return null;
  const selected = candidates.find((candidate) => candidate.candidateId === selectedId) ?? null;
  if (!selected || !selected.active || !selected.directionCompatible) return null;
  return selected;
};

const mapUpstreamReason = (input: {
  retrieval: DeterministicHistoryRetrievalResult;
  evidence: DeterministicRetrievalEvidenceResult;
  candidates: RestrictedRetrievalCandidateResult;
}): DeterministicDecisionAbstentionReason | null => {
  if (input.retrieval.status === 'ABSTAINED') return input.retrieval.abstentionReason;
  if (input.evidence.abstentionReason === 'MATERIAL_CONFLICT') return 'MATERIAL_CONFLICT';
  if (input.evidence.abstentionReason === 'INSUFFICIENT_EVIDENCE') return 'INSUFFICIENT_EVIDENCE';
  return input.candidates.abstentionReason;
};

const buildDimension = (input: {
  dimension: RestrictedCandidateDimension;
  candidates: RestrictedRetrievalCandidate[];
  evidence: RetrievalDimensionEvidence | null;
  candidateSetHash: string;
  upstreamReason: DeterministicDecisionAbstentionReason | null;
}): DeterministicDecisionDimension => {
  const orderedCandidates = [...input.candidates].sort((left, right) =>
    left.rank - right.rank || left.candidateId.localeCompare(right.candidateId));
  const selectedId = input.evidence?.selectedValueId ?? null;
  const selected = selectCandidate(orderedCandidates, selectedId);
  const materialConflict = input.evidence?.materialConflict === true || input.upstreamReason === 'MATERIAL_CONFLICT';
  const reason = materialConflict
    ? 'MATERIAL_CONFLICT' as const
    : input.upstreamReason
      ?? (!selected ? 'INCOMPLETE_DECISION' as const : null);
  const status: DeterministicDecisionDimensionStatus = materialConflict
    ? 'CONFLICTED'
    : selected
      ? 'SELECTED'
      : input.candidates.length === 0
        ? 'ABSTAINED'
        : 'INCOMPLETE';
  const base: Omit<DeterministicDecisionDimension, 'dimensionHash'> = {
    dimension: input.dimension,
    status,
    selectedCandidateId: selected?.candidateId ?? null,
    selectedCandidateRank: selected?.rank ?? null,
    allowedCandidateIds: orderedCandidates.map((candidate) => candidate.candidateId),
    supportingEvidenceCount: selected?.supportingEvidenceCount ?? input.evidence?.supportCount ?? 0,
    conflictingEvidenceCount: selected?.conflictingEvidenceCount
      ?? input.evidence?.conflictingEvidence.reduce((total, item) => total + item.supportCount, 0)
      ?? 0,
    componentScores: input.evidence?.componentScores ?? null,
    retrievalHash: selected?.retrievalHash ?? null,
    evidenceHash: selected?.evidenceHash ?? input.evidence?.evidenceHash ?? null,
    candidateHash: selected?.candidateHash ?? null,
    candidateSetHash: input.candidateSetHash,
    provenanceHashes: selected?.provenanceHashes ?? [],
    confidence: {
      calibration: 'UNCALIBRATED',
      scoreBasisPoints: input.evidence?.supportScoreBasisPoints ?? null,
      label: null,
    },
    reason,
  };
  return { ...base, dimensionHash: hashEvidence(base) };
};

export const buildDeterministicDecision = (input: {
  workspaceId: string;
  transactionFactHash?: string | null;
  retrieval: DeterministicHistoryRetrievalResult;
  evidence: DeterministicRetrievalEvidenceResult;
  candidates: RestrictedRetrievalCandidateResult;
  expectedIdentity?: DeterministicDecisionExpectedIdentity;
}): DeterministicDecisionResult => {
  if (
    input.retrieval.workspaceId !== input.workspaceId
    || input.evidence.workspaceId !== input.workspaceId
    || input.candidates.workspaceId !== input.workspaceId
  ) {
    throw new DeterministicDecisionError('workspace_mismatch', 'Decision inputs do not match the authorized workspace.');
  }
  if (
    input.retrieval.targetTransactionId !== input.evidence.targetTransactionId
    || input.retrieval.targetTransactionId !== input.candidates.targetTransactionId
  ) {
    throw new DeterministicDecisionError('version_mismatch', 'Decision inputs do not describe the same transaction.');
  }
  if (
    input.retrieval.scorerVersion !== DETERMINISTIC_HISTORY_RETRIEVAL_VERSION
    || input.retrieval.eligibilityVersion !== CONFIRMED_HISTORY_ELIGIBILITY_VERSION
    || input.evidence.evidenceVersion !== DETERMINISTIC_RETRIEVAL_EVIDENCE_VERSION
    || input.evidence.scorerVersion !== DETERMINISTIC_HISTORY_RETRIEVAL_VERSION
    || input.evidence.eligibilityVersion !== CONFIRMED_HISTORY_ELIGIBILITY_VERSION
    || input.candidates.candidateVersion !== RESTRICTED_RETRIEVAL_CANDIDATE_VERSION
    || input.candidates.evidenceVersion !== DETERMINISTIC_RETRIEVAL_EVIDENCE_VERSION
    || input.candidates.scorerVersion !== DETERMINISTIC_HISTORY_RETRIEVAL_VERSION
    || input.candidates.eligibilityVersion !== CONFIRMED_HISTORY_ELIGIBILITY_VERSION
  ) {
    throw new DeterministicDecisionError('version_mismatch', 'Decision input versions are incompatible.');
  }
  if (input.evidence.evidenceHash === '' || input.candidates.candidateSetHash === '' || input.retrieval.retrievalHash === '') {
    throw new DeterministicDecisionError('version_mismatch', 'Decision input hashes are required.');
  }
  if (input.expectedIdentity?.retrievalHash && input.expectedIdentity.retrievalHash !== input.retrieval.retrievalHash) {
    throw new DeterministicDecisionError('stale_retrieval', 'Retrieval identity is stale.');
  }
  if (input.expectedIdentity?.evidenceHash && input.expectedIdentity.evidenceHash !== input.evidence.evidenceHash) {
    throw new DeterministicDecisionError('stale_evidence', 'Evidence identity is stale.');
  }
  if (input.expectedIdentity?.candidateSetHash && input.expectedIdentity.candidateSetHash !== input.candidates.candidateSetHash) {
    throw new DeterministicDecisionError('stale_candidates', 'Candidate identity is stale.');
  }

  const topEvidence = input.evidence.candidates[0] ?? null;
  const upstreamReason = mapUpstreamReason(input);
  const dimensions = {
    project: buildDimension({
      dimension: 'PROJECT',
      candidates: input.candidates.projectCandidates,
      evidence: topEvidence?.dimensions.project ?? null,
      candidateSetHash: input.candidates.candidateSetHash,
      upstreamReason,
    }),
    transactionType: buildDimension({
      dimension: 'TRANSACTION_TYPE',
      candidates: input.candidates.transactionTypeCandidates,
      evidence: topEvidence?.dimensions.transactionType ?? null,
      candidateSetHash: input.candidates.candidateSetHash,
      upstreamReason,
    }),
    category: buildDimension({
      dimension: 'CATEGORY',
      candidates: input.candidates.categoryCandidates,
      evidence: topEvidence?.dimensions.category ?? null,
      candidateSetHash: input.candidates.candidateSetHash,
      upstreamReason,
    }),
  };
  const dimensionValues = Object.values(dimensions);
  const abstentionReason = upstreamReason
    ?? (dimensionValues.every((dimension) => dimension.status === 'SELECTED') ? null : 'INCOMPLETE_DECISION');
  const status: DeterministicDecisionStatus = abstentionReason === 'MATERIAL_CONFLICT'
    ? 'CONFLICTED'
    : abstentionReason === 'INCOMPLETE_DECISION'
      ? 'INCOMPLETE'
      : abstentionReason
        ? 'ABSTAINED'
        : 'PROPOSED';
  const replayIdentity = {
    retrievalHash: input.retrieval.retrievalHash,
    evidenceHash: input.evidence.evidenceHash,
    candidateSetHash: input.candidates.candidateSetHash,
    weightsHash: hashEvidence(input.retrieval.weights),
    boundsHash: hashEvidence({ retrieval: input.retrieval.bounds, candidates: input.candidates.bounds }),
  };
  const base = {
    decisionVersion: DETERMINISTIC_DECISION_VERSION as typeof DETERMINISTIC_DECISION_VERSION,
    eligibilityVersion: CONFIRMED_HISTORY_ELIGIBILITY_VERSION as typeof CONFIRMED_HISTORY_ELIGIBILITY_VERSION,
    scorerVersion: DETERMINISTIC_HISTORY_RETRIEVAL_VERSION as typeof DETERMINISTIC_HISTORY_RETRIEVAL_VERSION,
    evidenceVersion: DETERMINISTIC_RETRIEVAL_EVIDENCE_VERSION as typeof DETERMINISTIC_RETRIEVAL_EVIDENCE_VERSION,
    candidateVersion: RESTRICTED_RETRIEVAL_CANDIDATE_VERSION as typeof RESTRICTED_RETRIEVAL_CANDIDATE_VERSION,
    workspaceId: input.workspaceId,
    targetTransactionId: input.retrieval.targetTransactionId,
    transactionFactHash: input.transactionFactHash ?? null,
    status,
    abstentionReason,
    dimensions,
    replayIdentity,
    sideEffects: {
      readOnly: true as const,
      previewOnly: true as const,
      createsTransactionBooking: false as const,
      createsCategorizationSuggestion: false as const,
      mutatesBankFacts: false as const,
      mutatesReviewDecisions: false as const,
      mutatesPeriodState: false as const,
      mutatesLedgerRecords: false as const,
      persistsDecision: false as const,
      invokesExternalModel: false as const,
    },
  };
  return { ...base, decisionHash: hashEvidence(base) };
};
