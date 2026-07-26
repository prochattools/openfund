import type { PrismaClient } from '@prisma/client';
import {
  DETERMINISTIC_RETRIEVAL_EVIDENCE_VERSION,
  type DeterministicRetrievalEvidenceResult,
  type RetrievalCandidateEvidence,
  type RetrievalDimensionEvidence,
} from './deterministicRetrievalEvidenceService';
import { DETERMINISTIC_HISTORY_RETRIEVAL_VERSION } from './deterministicHistoryRetrievalService';
import { CONFIRMED_HISTORY_ELIGIBILITY_VERSION } from './confirmedHistoryEligibilityService';
import { hashEvidence } from './reviewDecisionService';

export const RESTRICTED_RETRIEVAL_CANDIDATE_VERSION = 'restricted-retrieval-candidates-v1';
export const DEFAULT_RESTRICTED_CANDIDATE_BOUNDS = {
  maximumProjectCandidates: 5,
  maximumTransactionTypeCandidates: 5,
  maximumCategoryCandidates: 5,
  maximumEvidenceAlternativesPerDimension: 10,
} as const;
export const HARD_MAXIMUM_CANDIDATES_PER_DIMENSION = 10;
export const HARD_MAXIMUM_EVIDENCE_ALTERNATIVES_PER_DIMENSION = 25;

export type RestrictedCandidateDimension = 'PROJECT' | 'TRANSACTION_TYPE' | 'CATEGORY';
export type RestrictedCandidateReasonCode =
  | 'CURRENT_RETRIEVED_VALUE'
  | 'SUPPORTED_ALTERNATIVE'
  | 'ACTIVE_WORKSPACE_MATCH'
  | 'DIRECTION_COMPATIBLE';

export type RestrictedCandidateExclusionReason =
  | 'INACTIVE'
  | 'CROSS_WORKSPACE'
  | 'MISSING'
  | 'UNSUPPORTED_BY_EVIDENCE';

export type RestrictedDimensionRecord = {
  id: string;
  workspaceId: string;
  isActive: boolean;
};

export type RestrictedRetrievalCandidate = {
  candidateVersion: typeof RESTRICTED_RETRIEVAL_CANDIDATE_VERSION;
  dimension: RestrictedCandidateDimension;
  candidateId: string;
  rank: number;
  active: true;
  directionCompatible: true;
  reasonCodes: RestrictedCandidateReasonCode[];
  supportingEvidenceCount: number;
  conflictingEvidenceCount: number;
  retrievalHash: string;
  evidenceHash: string;
  provenanceHashes: string[];
  candidateHash: string;
};

export type RestrictedCandidateBounds = {
  maximumProjectCandidates: number;
  maximumTransactionTypeCandidates: number;
  maximumCategoryCandidates: number;
  maximumEvidenceAlternativesPerDimension: number;
};

export type RestrictedCandidateDiagnostic = {
  dimension: RestrictedCandidateDimension;
  candidateId: string;
  reason: RestrictedCandidateExclusionReason;
};

export type RestrictedRetrievalCandidateResult = {
  candidateVersion: typeof RESTRICTED_RETRIEVAL_CANDIDATE_VERSION;
  evidenceVersion: typeof DETERMINISTIC_RETRIEVAL_EVIDENCE_VERSION;
  scorerVersion: typeof DETERMINISTIC_HISTORY_RETRIEVAL_VERSION;
  eligibilityVersion: typeof CONFIRMED_HISTORY_ELIGIBILITY_VERSION;
  workspaceId: string;
  targetTransactionId: string;
  status: 'MATCHED' | 'ABSTAINED';
  abstentionReason:
    | 'MATERIAL_CONFLICT'
    | 'INSUFFICIENT_EVIDENCE'
    | 'NO_VALID_PROJECT_CANDIDATE'
    | 'NO_VALID_TRANSACTION_TYPE_CANDIDATE'
    | 'NO_VALID_CATEGORY_CANDIDATE'
    | null;
  bounds: RestrictedCandidateBounds;
  projectCandidates: RestrictedRetrievalCandidate[];
  transactionTypeCandidates: RestrictedRetrievalCandidate[];
  categoryCandidates: RestrictedRetrievalCandidate[];
  diagnostics: RestrictedCandidateDiagnostic[];
  candidateSetHash: string;
  sideEffects: DeterministicRetrievalEvidenceResult['sideEffects'];
};

const clamp = (value: number | undefined, fallback: number, hardMaximum: number): number => {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(1, Math.min(hardMaximum, Math.floor(value as number)));
};

export const normalizeRestrictedCandidateBounds = (
  input: Partial<RestrictedCandidateBounds> = {},
): RestrictedCandidateBounds => ({
  maximumProjectCandidates: clamp(
    input.maximumProjectCandidates,
    DEFAULT_RESTRICTED_CANDIDATE_BOUNDS.maximumProjectCandidates,
    HARD_MAXIMUM_CANDIDATES_PER_DIMENSION,
  ),
  maximumTransactionTypeCandidates: clamp(
    input.maximumTransactionTypeCandidates,
    DEFAULT_RESTRICTED_CANDIDATE_BOUNDS.maximumTransactionTypeCandidates,
    HARD_MAXIMUM_CANDIDATES_PER_DIMENSION,
  ),
  maximumCategoryCandidates: clamp(
    input.maximumCategoryCandidates,
    DEFAULT_RESTRICTED_CANDIDATE_BOUNDS.maximumCategoryCandidates,
    HARD_MAXIMUM_CANDIDATES_PER_DIMENSION,
  ),
  maximumEvidenceAlternativesPerDimension: clamp(
    input.maximumEvidenceAlternativesPerDimension,
    DEFAULT_RESTRICTED_CANDIDATE_BOUNDS.maximumEvidenceAlternativesPerDimension,
    HARD_MAXIMUM_EVIDENCE_ALTERNATIVES_PER_DIMENSION,
  ),
});

const candidateIds = (
  evidence: RetrievalDimensionEvidence,
  maximumAlternatives: number,
): string[] => [
  evidence.selectedValueId,
  ...evidence.conflictingEvidence.slice(0, maximumAlternatives).map((item) => item.valueId),
].filter((value, index, values) => values.indexOf(value) === index);

const provenanceHashes = (evidence: RetrievalDimensionEvidence, candidateId: string): string[] => {
  const selected = candidateId === evidence.selectedValueId
    ? evidence.supportingEvidence
    : evidence.conflictingEvidence.find((item) => item.valueId === candidateId)?.strongestEvidence ?? [];
  return [...new Set(selected.map((item) => item.provenanceHash))].sort((left, right) => left.localeCompare(right));
};

const counts = (evidence: RetrievalDimensionEvidence, candidateId: string): {
  supportingEvidenceCount: number;
  conflictingEvidenceCount: number;
  supportScoreBasisPoints: number;
} => {
  if (candidateId === evidence.selectedValueId) {
    return {
      supportingEvidenceCount: evidence.supportCount,
      conflictingEvidenceCount: evidence.conflictingEvidence.reduce((total, item) => total + item.supportCount, 0),
      supportScoreBasisPoints: evidence.supportScoreBasisPoints,
    };
  }
  const alternative = evidence.conflictingEvidence.find((item) => item.valueId === candidateId);
  return {
    supportingEvidenceCount: alternative?.supportCount ?? 0,
    conflictingEvidenceCount: evidence.supportCount,
    supportScoreBasisPoints: alternative?.supportScoreBasisPoints ?? 0,
  };
};

const buildDimensionCandidates = (input: {
  workspaceId: string;
  dimension: RestrictedCandidateDimension;
  evidence: RetrievalDimensionEvidence;
  records: RestrictedDimensionRecord[];
  maximumCandidates: number;
  maximumAlternatives: number;
  retrievalHash: string;
  evidenceHash: string;
}): { candidates: RestrictedRetrievalCandidate[]; diagnostics: RestrictedCandidateDiagnostic[] } => {
  const records = new Map(input.records.map((record) => [record.id, record]));
  const diagnostics: RestrictedCandidateDiagnostic[] = [];
  const ranked = candidateIds(input.evidence, input.maximumAlternatives)
    .map((candidateId) => {
      const record = records.get(candidateId);
      if (!record) {
        diagnostics.push({ dimension: input.dimension, candidateId, reason: 'MISSING' });
        return null;
      }
      if (record.workspaceId !== input.workspaceId) {
        diagnostics.push({ dimension: input.dimension, candidateId, reason: 'CROSS_WORKSPACE' });
        return null;
      }
      if (!record.isActive) {
        diagnostics.push({ dimension: input.dimension, candidateId, reason: 'INACTIVE' });
        return null;
      }
      const evidenceCounts = counts(input.evidence, candidateId);
      if (evidenceCounts.supportingEvidenceCount === 0) {
        diagnostics.push({ dimension: input.dimension, candidateId, reason: 'UNSUPPORTED_BY_EVIDENCE' });
        return null;
      }
      return {
        candidateId,
        current: candidateId === input.evidence.selectedValueId,
        supportScoreBasisPoints: evidenceCounts.supportScoreBasisPoints,
        supportingEvidenceCount: evidenceCounts.supportingEvidenceCount,
        conflictingEvidenceCount: evidenceCounts.conflictingEvidenceCount,
        provenanceHashes: provenanceHashes(input.evidence, candidateId),
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null)
    .sort((left, right) =>
      Number(right.current) - Number(left.current)
      || right.supportScoreBasisPoints - left.supportScoreBasisPoints
      || right.supportingEvidenceCount - left.supportingEvidenceCount
      || left.conflictingEvidenceCount - right.conflictingEvidenceCount
      || left.candidateId.localeCompare(right.candidateId))
    .slice(0, input.maximumCandidates)
    .map((item, index) => {
      const base = {
        candidateVersion: RESTRICTED_RETRIEVAL_CANDIDATE_VERSION as typeof RESTRICTED_RETRIEVAL_CANDIDATE_VERSION,
        dimension: input.dimension,
        candidateId: item.candidateId,
        rank: index + 1,
        active: true as const,
        directionCompatible: true as const,
        reasonCodes: [
          ...(item.current ? ['CURRENT_RETRIEVED_VALUE' as const] : ['SUPPORTED_ALTERNATIVE' as const]),
          'ACTIVE_WORKSPACE_MATCH' as const,
          'DIRECTION_COMPATIBLE' as const,
        ],
        supportingEvidenceCount: item.supportingEvidenceCount,
        conflictingEvidenceCount: item.conflictingEvidenceCount,
        retrievalHash: input.retrievalHash,
        evidenceHash: input.evidenceHash,
        provenanceHashes: item.provenanceHashes,
      };
      return { ...base, candidateHash: hashEvidence(base) };
    });

  return {
    candidates: ranked,
    diagnostics: diagnostics.sort((left, right) =>
      left.dimension.localeCompare(right.dimension)
      || left.candidateId.localeCompare(right.candidateId)
      || left.reason.localeCompare(right.reason)),
  };
};

export const buildRestrictedRetrievalCandidates = (input: {
  workspaceId: string;
  evidence: DeterministicRetrievalEvidenceResult;
  projectRecords: RestrictedDimensionRecord[];
  transactionTypeRecords: RestrictedDimensionRecord[];
  categoryRecords: RestrictedDimensionRecord[];
  bounds?: Partial<RestrictedCandidateBounds>;
}): RestrictedRetrievalCandidateResult => {
  if (input.evidence.workspaceId !== input.workspaceId) {
    throw new Error('Candidate evidence workspace does not match the authorized workspace.');
  }
  if (input.evidence.evidenceVersion !== DETERMINISTIC_RETRIEVAL_EVIDENCE_VERSION) {
    throw new Error('Only deterministic-retrieval-evidence-v1 input is supported.');
  }
  if (input.evidence.scorerVersion !== DETERMINISTIC_HISTORY_RETRIEVAL_VERSION) {
    throw new Error('Only deterministic-history-retrieval-v1 input is supported.');
  }
  if (input.evidence.eligibilityVersion !== CONFIRMED_HISTORY_ELIGIBILITY_VERSION) {
    throw new Error('Only confirmed-history-v1 input is supported.');
  }

  const bounds = normalizeRestrictedCandidateBounds(input.bounds);
  if (input.evidence.status === 'ABSTAINED') {
    const reason: 'MATERIAL_CONFLICT' | 'INSUFFICIENT_EVIDENCE' =
      input.evidence.abstentionReason === 'MATERIAL_CONFLICT'
        ? 'MATERIAL_CONFLICT'
        : 'INSUFFICIENT_EVIDENCE';
    const base: Omit<RestrictedRetrievalCandidateResult, 'candidateSetHash'> = {
      candidateVersion: RESTRICTED_RETRIEVAL_CANDIDATE_VERSION,
      evidenceVersion: DETERMINISTIC_RETRIEVAL_EVIDENCE_VERSION,
      scorerVersion: DETERMINISTIC_HISTORY_RETRIEVAL_VERSION,
      eligibilityVersion: CONFIRMED_HISTORY_ELIGIBILITY_VERSION,
      workspaceId: input.workspaceId,
      targetTransactionId: input.evidence.targetTransactionId,
      status: 'ABSTAINED',
      abstentionReason: reason,
      bounds,
      projectCandidates: [],
      transactionTypeCandidates: [],
      categoryCandidates: [],
      diagnostics: [],
      sideEffects: input.evidence.sideEffects,
    };
    return { ...base, candidateSetHash: hashEvidence(base) };
  }

  const top = input.evidence.candidates[0];
  if (!top) {
    throw new Error('Matched evidence must contain at least one candidate.');
  }
  const project = buildDimensionCandidates({
    workspaceId: input.workspaceId,
    dimension: 'PROJECT',
    evidence: top.dimensions.project,
    records: input.projectRecords,
    maximumCandidates: bounds.maximumProjectCandidates,
    maximumAlternatives: bounds.maximumEvidenceAlternativesPerDimension,
    retrievalHash: top.candidate.retrievalHash,
    evidenceHash: top.dimensions.project.evidenceHash,
  });
  const transactionType = buildDimensionCandidates({
    workspaceId: input.workspaceId,
    dimension: 'TRANSACTION_TYPE',
    evidence: top.dimensions.transactionType,
    records: input.transactionTypeRecords,
    maximumCandidates: bounds.maximumTransactionTypeCandidates,
    maximumAlternatives: bounds.maximumEvidenceAlternativesPerDimension,
    retrievalHash: top.candidate.retrievalHash,
    evidenceHash: top.dimensions.transactionType.evidenceHash,
  });
  const category = buildDimensionCandidates({
    workspaceId: input.workspaceId,
    dimension: 'CATEGORY',
    evidence: top.dimensions.category,
    records: input.categoryRecords,
    maximumCandidates: bounds.maximumCategoryCandidates,
    maximumAlternatives: bounds.maximumEvidenceAlternativesPerDimension,
    retrievalHash: top.candidate.retrievalHash,
    evidenceHash: top.dimensions.category.evidenceHash,
  });

  const abstentionReason = project.candidates.length === 0
    ? 'NO_VALID_PROJECT_CANDIDATE' as const
    : transactionType.candidates.length === 0
      ? 'NO_VALID_TRANSACTION_TYPE_CANDIDATE' as const
      : category.candidates.length === 0
        ? 'NO_VALID_CATEGORY_CANDIDATE' as const
        : null;
  const base = {
    candidateVersion: RESTRICTED_RETRIEVAL_CANDIDATE_VERSION as typeof RESTRICTED_RETRIEVAL_CANDIDATE_VERSION,
    evidenceVersion: DETERMINISTIC_RETRIEVAL_EVIDENCE_VERSION as typeof DETERMINISTIC_RETRIEVAL_EVIDENCE_VERSION,
    scorerVersion: DETERMINISTIC_HISTORY_RETRIEVAL_VERSION as typeof DETERMINISTIC_HISTORY_RETRIEVAL_VERSION,
    eligibilityVersion: CONFIRMED_HISTORY_ELIGIBILITY_VERSION as typeof CONFIRMED_HISTORY_ELIGIBILITY_VERSION,
    workspaceId: input.workspaceId,
    targetTransactionId: input.evidence.targetTransactionId,
    status: abstentionReason ? 'ABSTAINED' as const : 'MATCHED' as const,
    abstentionReason,
    bounds,
    projectCandidates: project.candidates,
    transactionTypeCandidates: transactionType.candidates,
    categoryCandidates: category.candidates,
    diagnostics: [...project.diagnostics, ...transactionType.diagnostics, ...category.diagnostics],
    sideEffects: input.evidence.sideEffects,
  };
  return { ...base, candidateSetHash: hashEvidence(base) };
};

type CandidateDb = Pick<PrismaClient, 'project' | 'transactionType' | 'category'>;

export const loadRestrictedDimensionRecords = async (
  db: CandidateDb,
  input: {
    workspaceId: string;
    evidence: DeterministicRetrievalEvidenceResult;
    bounds?: Partial<RestrictedCandidateBounds>;
  },
): Promise<{
  projectRecords: RestrictedDimensionRecord[];
  transactionTypeRecords: RestrictedDimensionRecord[];
  categoryRecords: RestrictedDimensionRecord[];
}> => {
  const bounds = normalizeRestrictedCandidateBounds(input.bounds);
  const top = input.evidence.candidates[0];
  if (!top || input.evidence.status !== 'MATCHED') {
    return { projectRecords: [], transactionTypeRecords: [], categoryRecords: [] };
  }
  const projectIds = candidateIds(top.dimensions.project, bounds.maximumEvidenceAlternativesPerDimension);
  const transactionTypeIds = candidateIds(top.dimensions.transactionType, bounds.maximumEvidenceAlternativesPerDimension);
  const categoryIds = candidateIds(top.dimensions.category, bounds.maximumEvidenceAlternativesPerDimension);

  const [projectRecords, transactionTypeRecords, categoryRecords] = await Promise.all([
    db.project.findMany({
      where: { id: { in: projectIds }, workspaceId: input.workspaceId },
      select: { id: true, workspaceId: true, isActive: true },
    }),
    db.transactionType.findMany({
      where: { id: { in: transactionTypeIds }, workspaceId: input.workspaceId },
      select: { id: true, workspaceId: true, isActive: true },
    }),
    db.category.findMany({
      where: { id: { in: categoryIds }, workspaceId: input.workspaceId },
      select: { id: true, workspaceId: true, isActive: true },
    }),
  ]);
  return { projectRecords, transactionTypeRecords, categoryRecords };
};
