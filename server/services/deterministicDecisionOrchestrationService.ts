import type { DeterministicCategorizationResult } from './deterministicCategorizationService';
import type { EvaluatedMerchantRetrievalAnchor } from './merchantRetrievalAnchor';
import {
  DETERMINISTIC_DECISION_VERSION,
  type DeterministicDecisionResult,
} from './deterministicDecisionService';
import { hashEvidence } from './reviewDecisionService';

export const DETERMINISTIC_ORCHESTRATION_VERSION = 'deterministic-orchestration-v1';
export const DETERMINISTIC_CONTRIBUTOR_PRIORITY_VERSION = 'rule-history-agreement-v1';

export type DeterministicContributorType =
  | 'RULE'
  | 'MERCHANT'
  | 'RETRIEVAL'
  | 'EVIDENCE'
  | 'CANDIDATES'
  | 'DECISION';

export type DeterministicContributorStatus =
  | 'MATCHED'
  | 'ABSTAINED'
  | 'CONFLICTED'
  | 'UNAVAILABLE'
  | 'STALE'
  | 'FAILED';

export type DeterministicOrchestrationStatus = 'MATCHED' | 'ABSTAINED' | 'CONFLICTED' | 'FAILED';

export type DeterministicOrchestrationReason =
  | 'DECISION_PROPOSED'
  | 'DECISION_ABSTAINED'
  | 'DECISION_CONFLICTED'
  | 'DECISION_INCOMPLETE'
  | 'RULE_AGREES_WITH_DECISION'
  | 'RULE_CONFLICTS_WITH_DECISION'
  | 'RULE_REQUIRES_REVIEW'
  | 'NO_RULE_MATCH'
  | 'MERCHANT_READY'
  | 'MERCHANT_CONFLICT'
  | 'MERCHANT_UNAVAILABLE'
  | 'MERCHANT_STALE'
  | 'WORKSPACE_MISMATCH'
  | 'TRANSACTION_MISMATCH'
  | 'STALE_ORCHESTRATION';

export type DeterministicContributorResult = {
  contributor: DeterministicContributorType;
  version: string;
  mandatory: boolean;
  status: DeterministicContributorStatus;
  inputHash: string;
  outputHash: string;
  provenanceHashes: string[];
  reason: DeterministicOrchestrationReason;
  affectedFinalDecision: boolean;
};

export type DeterministicOrchestrationResult = {
  orchestrationVersion: typeof DETERMINISTIC_ORCHESTRATION_VERSION;
  priorityVersion: typeof DETERMINISTIC_CONTRIBUTOR_PRIORITY_VERSION;
  workspaceId: string;
  targetTransactionId: string;
  transactionFactHash: string | null;
  status: DeterministicOrchestrationStatus;
  reason: DeterministicOrchestrationReason;
  contributors: DeterministicContributorResult[];
  finalDecision: DeterministicDecisionResult | null;
  finalDecisionHash: string | null;
  replayIdentity: {
    contributorIdentityHash: string;
    decisionHash: string;
    orchestrationHash: string;
  };
  orchestrationHash: string;
  sideEffects: {
    readOnly: true;
    previewOnly: true;
    createsTransactionBooking: false;
    createsCategorizationSuggestion: false;
    mutatesBankFacts: false;
    mutatesReviewDecisions: false;
    mutatesPeriodState: false;
    mutatesLedgerRecords: false;
    mutatesMerchantKnowledge: false;
    persistsDecision: false;
    invokesExternalModel: false;
  };
};

export class DeterministicOrchestrationError extends Error {
  constructor(
    public readonly code: 'workspace_mismatch' | 'transaction_mismatch' | 'stale_orchestration',
    message: string,
  ) {
    super(message);
    this.name = 'DeterministicOrchestrationError';
  }
}

const contributorOrder: Record<DeterministicContributorType, number> = {
  RULE: 10,
  MERCHANT: 20,
  RETRIEVAL: 30,
  EVIDENCE: 40,
  CANDIDATES: 50,
  DECISION: 60,
};

const canonicalContributors = (contributors: DeterministicContributorResult[]): DeterministicContributorResult[] =>
  [...contributors]
    .map((contributor) => ({
      ...contributor,
      provenanceHashes: [...new Set(contributor.provenanceHashes)].sort((left, right) => left.localeCompare(right)),
    }))
    .sort((left, right) =>
      contributorOrder[left.contributor] - contributorOrder[right.contributor]
      || left.version.localeCompare(right.version)
      || left.outputHash.localeCompare(right.outputHash));

const decisionTriple = (decision: DeterministicDecisionResult): [string | null, string | null, string | null] => [
  decision.dimensions.project.selectedCandidateId,
  decision.dimensions.transactionType.selectedCandidateId,
  decision.dimensions.category.selectedCandidateId,
];

const categorizationTriple = (result: DeterministicCategorizationResult): [string | null, string | null, string | null] => [
  result.projectId,
  result.transactionTypeId,
  result.categoryId,
];

const sameTriple = (
  left: [string | null, string | null, string | null],
  right: [string | null, string | null, string | null],
): boolean => left.every((value, index) => value === right[index]);

const decisionContributorStatus = (
  decision: DeterministicDecisionResult,
): { status: DeterministicContributorStatus; reason: DeterministicOrchestrationReason } => {
  if (decision.status === 'PROPOSED') return { status: 'MATCHED', reason: 'DECISION_PROPOSED' };
  if (decision.status === 'CONFLICTED') return { status: 'CONFLICTED', reason: 'DECISION_CONFLICTED' };
  if (decision.status === 'INCOMPLETE') return { status: 'ABSTAINED', reason: 'DECISION_INCOMPLETE' };
  return { status: 'ABSTAINED', reason: 'DECISION_ABSTAINED' };
};

const ruleContributor = (input: {
  transactionFactHash: string | null;
  ruleResult?: DeterministicCategorizationResult | null;
  decision: DeterministicDecisionResult;
}): DeterministicContributorResult => {
  const result = input.ruleResult ?? null;
  if (!result) {
    return {
      contributor: 'RULE',
      version: 'deterministic-categorization-v1',
      mandatory: false,
      status: 'UNAVAILABLE',
      inputHash: input.transactionFactHash ?? 'none',
      outputHash: 'none',
      provenanceHashes: [],
      reason: 'NO_RULE_MATCH',
      affectedFinalDecision: false,
    };
  }

  const hasRuleSource = result.source === 'rule' || result.source === 'rule_and_historical_replay';
  if (result.status === 'conflict') {
    return {
      contributor: 'RULE',
      version: 'deterministic-categorization-v1',
      mandatory: false,
      status: 'CONFLICTED',
      inputHash: input.transactionFactHash ?? 'none',
      outputHash: result.evidenceHash,
      provenanceHashes: [...result.evidence.ruleEvidenceHashes, ...result.evidence.historicalEvidenceHashes],
      reason: 'RULE_CONFLICTS_WITH_DECISION',
      affectedFinalDecision: true,
    };
  }
  if (result.status !== 'finalized' || !hasRuleSource) {
    return {
      contributor: 'RULE',
      version: 'deterministic-categorization-v1',
      mandatory: false,
      status: result.status === 'review_suggested' ? 'ABSTAINED' : 'UNAVAILABLE',
      inputHash: input.transactionFactHash ?? 'none',
      outputHash: result.evidenceHash,
      provenanceHashes: [...result.evidence.ruleEvidenceHashes, ...result.evidence.historicalEvidenceHashes],
      reason: result.status === 'review_suggested' ? 'RULE_REQUIRES_REVIEW' : 'NO_RULE_MATCH',
      affectedFinalDecision: false,
    };
  }

  const agrees = sameTriple(categorizationTriple(result), decisionTriple(input.decision));
  return {
    contributor: 'RULE',
    version: 'deterministic-categorization-v1',
    mandatory: false,
    status: agrees ? 'MATCHED' : 'CONFLICTED',
    inputHash: input.transactionFactHash ?? 'none',
    outputHash: result.evidenceHash,
    provenanceHashes: [...result.evidence.ruleEvidenceHashes, ...result.evidence.historicalEvidenceHashes],
    reason: agrees ? 'RULE_AGREES_WITH_DECISION' : 'RULE_CONFLICTS_WITH_DECISION',
    affectedFinalDecision: !agrees,
  };
};

const merchantContributor = (input: {
  transactionFactHash: string | null;
  merchantAnchor?: EvaluatedMerchantRetrievalAnchor | null;
}): DeterministicContributorResult => {
  const anchor = input.merchantAnchor ?? null;
  if (!anchor) {
    return {
      contributor: 'MERCHANT',
      version: 'merchant-retrieval-anchor-v1',
      mandatory: false,
      status: 'UNAVAILABLE',
      inputHash: input.transactionFactHash ?? 'none',
      outputHash: 'none',
      provenanceHashes: [],
      reason: 'MERCHANT_UNAVAILABLE',
      affectedFinalDecision: false,
    };
  }

  const provenanceHashes = [
    anchor.evidenceHash,
    ...anchor.supportingEvidence.map((item) => item.evidenceHash),
    ...anchor.conflictingEvidence.map((item) => item.evidenceHash),
  ];
  if (anchor.state === 'CONFLICTED') {
    return {
      contributor: 'MERCHANT',
      version: anchor.anchorVersion,
      mandatory: false,
      status: 'CONFLICTED',
      inputHash: input.transactionFactHash ?? 'none',
      outputHash: anchor.evaluationHash,
      provenanceHashes,
      reason: 'MERCHANT_CONFLICT',
      affectedFinalDecision: true,
    };
  }
  if (anchor.state === 'CROSS_WORKSPACE') {
    return {
      contributor: 'MERCHANT',
      version: anchor.anchorVersion,
      mandatory: false,
      status: 'FAILED',
      inputHash: input.transactionFactHash ?? 'none',
      outputHash: anchor.evaluationHash,
      provenanceHashes,
      reason: 'WORKSPACE_MISMATCH',
      affectedFinalDecision: true,
    };
  }
  if (anchor.state === 'STALE') {
    return {
      contributor: 'MERCHANT',
      version: anchor.anchorVersion,
      mandatory: false,
      status: 'STALE',
      inputHash: input.transactionFactHash ?? 'none',
      outputHash: anchor.evaluationHash,
      provenanceHashes,
      reason: 'MERCHANT_STALE',
      affectedFinalDecision: false,
    };
  }
  if (!anchor.usable) {
    return {
      contributor: 'MERCHANT',
      version: anchor.anchorVersion,
      mandatory: false,
      status: 'ABSTAINED',
      inputHash: input.transactionFactHash ?? 'none',
      outputHash: anchor.evaluationHash,
      provenanceHashes,
      reason: 'MERCHANT_UNAVAILABLE',
      affectedFinalDecision: false,
    };
  }
  return {
    contributor: 'MERCHANT',
    version: anchor.anchorVersion,
    mandatory: false,
    status: 'MATCHED',
    inputHash: input.transactionFactHash ?? 'none',
    outputHash: anchor.evaluationHash,
    provenanceHashes,
    reason: 'MERCHANT_READY',
    affectedFinalDecision: true,
  };
};

export const orchestrateDeterministicDecision = (input: {
  workspaceId: string;
  targetTransactionId: string;
  transactionFactHash?: string | null;
  decision: DeterministicDecisionResult;
  ruleResult?: DeterministicCategorizationResult | null;
  merchantAnchor?: EvaluatedMerchantRetrievalAnchor | null;
  expectedOrchestrationHash?: string;
}): DeterministicOrchestrationResult => {
  const transactionFactHash = input.transactionFactHash ?? input.decision.transactionFactHash ?? null;
  if (input.decision.workspaceId !== input.workspaceId) {
    throw new DeterministicOrchestrationError('workspace_mismatch', 'Decision workspace does not match the authorized workspace.');
  }
  if (input.decision.targetTransactionId !== input.targetTransactionId) {
    throw new DeterministicOrchestrationError('transaction_mismatch', 'Decision transaction does not match the orchestration target.');
  }
  if (input.merchantAnchor && (
    input.merchantAnchor.workspaceId !== input.workspaceId
    || input.merchantAnchor.transactionId !== input.targetTransactionId
  )) {
    throw new DeterministicOrchestrationError('workspace_mismatch', 'Merchant contributor scope does not match the orchestration target.');
  }

  const decisionState = decisionContributorStatus(input.decision);
  const contributors = canonicalContributors([
    ruleContributor({ transactionFactHash, ruleResult: input.ruleResult, decision: input.decision }),
    merchantContributor({ transactionFactHash, merchantAnchor: input.merchantAnchor }),
    {
      contributor: 'RETRIEVAL',
      version: input.decision.scorerVersion,
      mandatory: true,
      status: decisionState.status,
      inputHash: transactionFactHash ?? 'none',
      outputHash: input.decision.replayIdentity.retrievalHash,
      provenanceHashes: [input.decision.replayIdentity.retrievalHash],
      reason: decisionState.reason,
      affectedFinalDecision: true,
    },
    {
      contributor: 'EVIDENCE',
      version: input.decision.evidenceVersion,
      mandatory: true,
      status: decisionState.status,
      inputHash: input.decision.replayIdentity.retrievalHash,
      outputHash: input.decision.replayIdentity.evidenceHash,
      provenanceHashes: [input.decision.replayIdentity.evidenceHash],
      reason: decisionState.reason,
      affectedFinalDecision: true,
    },
    {
      contributor: 'CANDIDATES',
      version: input.decision.candidateVersion,
      mandatory: true,
      status: decisionState.status,
      inputHash: input.decision.replayIdentity.evidenceHash,
      outputHash: input.decision.replayIdentity.candidateSetHash,
      provenanceHashes: [input.decision.replayIdentity.candidateSetHash],
      reason: decisionState.reason,
      affectedFinalDecision: true,
    },
    {
      contributor: 'DECISION',
      version: DETERMINISTIC_DECISION_VERSION,
      mandatory: true,
      status: decisionState.status,
      inputHash: input.decision.replayIdentity.candidateSetHash,
      outputHash: input.decision.decisionHash,
      provenanceHashes: Object.values(input.decision.dimensions).flatMap((dimension) => dimension.provenanceHashes),
      reason: decisionState.reason,
      affectedFinalDecision: true,
    },
  ]);

  const rule = contributors.find((contributor) => contributor.contributor === 'RULE')!;
  const merchant = contributors.find((contributor) => contributor.contributor === 'MERCHANT')!;
  const mandatoryFailure = contributors.some((contributor) =>
    contributor.mandatory && ['FAILED', 'STALE', 'UNAVAILABLE'].includes(contributor.status));
  const conflict = input.decision.status === 'CONFLICTED'
    || rule.status === 'CONFLICTED'
    || merchant.status === 'CONFLICTED';
  const failed = mandatoryFailure || merchant.status === 'FAILED';
  const matched = input.decision.status === 'PROPOSED' && !conflict && !failed;

  const status: DeterministicOrchestrationStatus = failed
    ? 'FAILED'
    : conflict
      ? 'CONFLICTED'
      : matched
        ? 'MATCHED'
        : 'ABSTAINED';
  const reason: DeterministicOrchestrationReason = failed
    ? merchant.reason === 'WORKSPACE_MISMATCH' ? 'WORKSPACE_MISMATCH' : decisionState.reason
    : conflict
      ? rule.status === 'CONFLICTED'
        ? 'RULE_CONFLICTS_WITH_DECISION'
        : merchant.status === 'CONFLICTED'
          ? 'MERCHANT_CONFLICT'
          : 'DECISION_CONFLICTED'
      : matched
        ? 'DECISION_PROPOSED'
        : decisionState.reason;
  const finalDecision = matched ? input.decision : null;
  const contributorIdentityHash = hashEvidence(contributors);
  const orchestrationBase = {
    orchestrationVersion: DETERMINISTIC_ORCHESTRATION_VERSION,
    priorityVersion: DETERMINISTIC_CONTRIBUTOR_PRIORITY_VERSION,
    workspaceId: input.workspaceId,
    targetTransactionId: input.targetTransactionId,
    transactionFactHash,
    status,
    reason,
    contributors,
    finalDecision,
    finalDecisionHash: finalDecision?.decisionHash ?? null,
    contributorIdentityHash,
    decisionHash: input.decision.decisionHash,
  };
  const orchestrationHash = hashEvidence(orchestrationBase);
  if (input.expectedOrchestrationHash && input.expectedOrchestrationHash !== orchestrationHash) {
    throw new DeterministicOrchestrationError('stale_orchestration', 'Orchestration identity is stale.');
  }
  const replayIdentity = {
    contributorIdentityHash,
    decisionHash: input.decision.decisionHash,
    orchestrationHash,
  };
  const base: Omit<DeterministicOrchestrationResult, 'orchestrationHash'> = {
    orchestrationVersion: DETERMINISTIC_ORCHESTRATION_VERSION,
    priorityVersion: DETERMINISTIC_CONTRIBUTOR_PRIORITY_VERSION,
    workspaceId: input.workspaceId,
    targetTransactionId: input.targetTransactionId,
    transactionFactHash,
    status,
    reason,
    contributors,
    finalDecision,
    finalDecisionHash: finalDecision?.decisionHash ?? null,
    replayIdentity,
    sideEffects: {
      readOnly: true,
      previewOnly: true,
      createsTransactionBooking: false,
      createsCategorizationSuggestion: false,
      mutatesBankFacts: false,
      mutatesReviewDecisions: false,
      mutatesPeriodState: false,
      mutatesLedgerRecords: false,
      mutatesMerchantKnowledge: false,
      persistsDecision: false,
      invokesExternalModel: false,
    },
  };
  return { ...base, orchestrationHash };
};
