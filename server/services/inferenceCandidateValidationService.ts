import type { RawProviderClassificationResponse } from './inferenceContractService';
import type {
  RestrictedCandidateDimension,
  RestrictedRetrievalCandidate,
  RestrictedRetrievalCandidateResult,
} from './restrictedRetrievalCandidateService';

export type TrustedInferenceInvocationEnvelope = Readonly<{
  contractVersion: string;
  workspaceId: string;
  targetTransactionId: string;
  transactionFactHash: string;
  candidateSetHash: string;
}>;

export type InferenceSemanticValidationFailureReason =
  | 'INVALID_CANDIDATE_SELECTION'
  | 'STALE_CANDIDATE_SET';

export type InferenceSemanticValidationResult =
  | Readonly<{
      ok: true;
      value: RawProviderClassificationResponse;
    }>
  | Readonly<{
      ok: false;
      abstention: Readonly<{
        outcome: 'ABSTAINED';
        reason: InferenceSemanticValidationFailureReason;
      }>;
    }>;

export type InferenceCandidateValidationInput = Readonly<{
  envelope: TrustedInferenceInvocationEnvelope;
  candidateSet: RestrictedRetrievalCandidateResult;
  response: RawProviderClassificationResponse;
}>;

type SelectedDimension = Readonly<{
  dimension: RestrictedCandidateDimension;
  selectedId: string;
  candidates: RestrictedRetrievalCandidate[];
}>;

const fail = (
  reason: InferenceSemanticValidationFailureReason,
): InferenceSemanticValidationResult => ({
  ok: false,
  abstention: {
    outcome: 'ABSTAINED',
    reason,
  },
});

const isNonEmptyIdentifier = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;

const selectedCandidateIsValid = (
  selection: SelectedDimension,
  allDimensions: SelectedDimension[],
): boolean => {
  const intendedMatches = selection.candidates.filter(
    (candidate) => candidate.candidateId === selection.selectedId,
  );
  if (intendedMatches.length !== 1) return false;

  const appearsInAnotherDimension = allDimensions.some(
    (other) =>
      other.dimension !== selection.dimension &&
      other.candidates.some((candidate) => candidate.candidateId === selection.selectedId),
  );
  if (appearsInAnotherDimension) return false;

  const candidate = intendedMatches[0];
  return (
    candidate.candidateId === selection.selectedId &&
    candidate.dimension === selection.dimension &&
    candidate.active === true &&
    candidate.directionCompatible === true
  );
};

export const validateProviderClassificationResponse = (
  input: InferenceCandidateValidationInput,
): InferenceSemanticValidationResult => {
  const { envelope, candidateSet, response } = input;

  if (
    envelope.workspaceId !== candidateSet.workspaceId ||
    envelope.targetTransactionId !== candidateSet.targetTransactionId ||
    envelope.candidateSetHash !== candidateSet.candidateSetHash
  ) {
    return fail('STALE_CANDIDATE_SET');
  }

  if (response.outcome === 'ABSTAINED') {
    return { ok: true, value: response };
  }

  const projectId = (response as { projectId?: unknown }).projectId;
  const transactionTypeId = (response as { transactionTypeId?: unknown }).transactionTypeId;
  const categoryId = (response as { categoryId?: unknown }).categoryId;

  if (
    !isNonEmptyIdentifier(projectId) ||
    !isNonEmptyIdentifier(transactionTypeId) ||
    !isNonEmptyIdentifier(categoryId)
  ) {
    return fail('INVALID_CANDIDATE_SELECTION');
  }

  if (new Set([projectId, transactionTypeId, categoryId]).size !== 3) {
    return fail('INVALID_CANDIDATE_SELECTION');
  }

  if (candidateSet.status !== 'MATCHED') {
    return fail('INVALID_CANDIDATE_SELECTION');
  }

  const selections: SelectedDimension[] = [
    {
      dimension: 'PROJECT',
      selectedId: projectId,
      candidates: candidateSet.projectCandidates,
    },
    {
      dimension: 'TRANSACTION_TYPE',
      selectedId: transactionTypeId,
      candidates: candidateSet.transactionTypeCandidates,
    },
    {
      dimension: 'CATEGORY',
      selectedId: categoryId,
      candidates: candidateSet.categoryCandidates,
    },
  ];

  if (!selections.every((selection) => selectedCandidateIsValid(selection, selections))) {
    return fail('INVALID_CANDIDATE_SELECTION');
  }

  return { ok: true, value: response };
};
