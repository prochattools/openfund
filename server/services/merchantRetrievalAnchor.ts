import crypto from 'node:crypto';
import type { MerchantAliasMatchEvidence } from './merchantAliasResolver';

export const MERCHANT_RETRIEVAL_ANCHOR_VERSION = 'merchant-retrieval-anchor-v1';
export const MERCHANT_RETRIEVAL_ANCHOR_SCORE_BASIS_POINTS = 1200;

export type MerchantRetrievalAnchorState =
  | 'READY'
  | 'MISSING'
  | 'UNRESOLVED'
  | 'CONFLICTED'
  | 'STALE'
  | 'CROSS_WORKSPACE';

export type MerchantRetrievalAnchor = {
  workspaceId: string;
  transactionId: string;
  merchantId: string | null;
  anchorVersion: string;
  resolutionVersion: string;
  evidenceHash: string;
  sourceState: string;
  supportingEvidence: readonly MerchantAliasMatchEvidence[];
  conflictingEvidence: readonly MerchantAliasMatchEvidence[];
  stale: boolean;
  expired?: boolean;
  readiness: 'READY' | 'NOT_READY';
};

export type EvaluatedMerchantRetrievalAnchor = {
  state: MerchantRetrievalAnchorState;
  workspaceId: string;
  transactionId: string;
  merchantId: string | null;
  anchorVersion: string;
  resolutionVersion: string;
  evidenceHash: string;
  sourceState: string;
  supportingEvidence: MerchantAliasMatchEvidence[];
  conflictingEvidence: MerchantAliasMatchEvidence[];
  scoreContributionBasisPoints: number;
  usable: boolean;
  evaluationHash: string;
};

const stableValue = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nested]) => [key, stableValue(nested)]),
    );
  }
  return value;
};

const stableHash = (value: unknown): string =>
  crypto.createHash('sha256').update(JSON.stringify(stableValue(value))).digest('hex');

const evidenceSort = (
  left: MerchantAliasMatchEvidence,
  right: MerchantAliasMatchEvidence,
): number =>
  left.precedence - right.precedence
  || left.merchantId.localeCompare(right.merchantId)
  || left.aliasId.localeCompare(right.aliasId);

export const evaluateMerchantRetrievalAnchor = (input: {
  workspaceId: string;
  transactionId: string;
  anchor?: MerchantRetrievalAnchor | null;
  enabled?: boolean;
}): EvaluatedMerchantRetrievalAnchor => {
  const workspaceId = input.workspaceId.trim();
  const transactionId = input.transactionId.trim();
  const anchor = input.anchor ?? null;
  const enabled = input.enabled ?? true;

  let state: MerchantRetrievalAnchorState = 'MISSING';
  if (anchor) {
    if (anchor.workspaceId !== workspaceId || anchor.transactionId !== transactionId) {
      state = 'CROSS_WORKSPACE';
    } else if (!enabled) {
      state = 'MISSING';
    } else if (
      anchor.stale
      || anchor.expired === true
      || anchor.readiness !== 'READY'
      || anchor.sourceState === 'STALE'
    ) {
      state = 'STALE';
    } else if (anchor.conflictingEvidence.length > 0 || anchor.sourceState === 'CONFLICTED') {
      state = 'CONFLICTED';
    } else if (!anchor.merchantId || anchor.sourceState === 'UNRESOLVED') {
      state = 'UNRESOLVED';
    } else {
      state = 'READY';
    }
  }

  const supportingEvidence = anchor ? [...anchor.supportingEvidence].sort(evidenceSort) : [];
  const conflictingEvidence = anchor ? [...anchor.conflictingEvidence].sort(evidenceSort) : [];
  const usable = state === 'READY';
  const payload = {
    state,
    workspaceId,
    transactionId,
    merchantId: usable ? anchor?.merchantId ?? null : null,
    anchorVersion: anchor?.anchorVersion ?? MERCHANT_RETRIEVAL_ANCHOR_VERSION,
    resolutionVersion: anchor?.resolutionVersion ?? 'none',
    evidenceHash: anchor?.evidenceHash ?? 'none',
    sourceState: anchor?.sourceState ?? 'MISSING',
    supportingEvidence,
    conflictingEvidence,
    scoreContributionBasisPoints: usable ? MERCHANT_RETRIEVAL_ANCHOR_SCORE_BASIS_POINTS : 0,
    usable,
  };

  return {
    ...payload,
    evaluationHash: stableHash(payload),
  };
};

export const merchantAnchorContribution = (input: {
  anchor: EvaluatedMerchantRetrievalAnchor;
  historicalMerchantId: string | null | undefined;
}): number =>
  input.anchor.usable
  && input.anchor.merchantId
  && input.historicalMerchantId === input.anchor.merchantId
    ? input.anchor.scoreContributionBasisPoints
    : 0;
