import crypto from 'node:crypto';
import {
  extractMerchantFingerprints,
  MERCHANT_FINGERPRINT_EXTRACTION_VERSION,
  type MerchantFingerprintInput,
  type MerchantFingerprintSignalType,
} from './merchantFingerprintExtractor';
import {
  MERCHANT_ALIAS_RESOLUTION_VERSION,
  resolveMerchantAlias,
  type MerchantAliasRecord,
} from './merchantAliasResolver';
import type { MerchantIdentityRecord } from './merchantIdentityPlanService';

export const MERCHANT_BACKFILL_PLANNER_VERSION = 'merchant-backfill-plan-v1';
export const MERCHANT_BACKFILL_PAGE_SIZES = [25, 50, 100] as const;
export type MerchantBackfillPageSize = (typeof MERCHANT_BACKFILL_PAGE_SIZES)[number];

export type MerchantBackfillResultState =
  | 'KNOWN_MERCHANT'
  | 'NEW_MERCHANT_CANDIDATE'
  | 'CONFLICTED'
  | 'UNRESOLVED';

export type ApprovedMerchantCorrection = {
  id: string;
  workspaceId: string;
  merchantId: string;
  signalType: MerchantFingerprintSignalType;
  valueHash: string;
  status: 'APPROVED';
  evidenceHash: string;
};

export type MerchantBackfillTransaction = MerchantFingerprintInput;

export type MerchantBackfillResult = {
  resultId: string;
  transactionId: string;
  transactionDate: string;
  state: MerchantBackfillResultState;
  merchantId: string | null;
  knownMerchant: boolean;
  newMerchantCandidate: boolean;
  aliasConsolidationOpportunity: boolean;
  fingerprintCollision: boolean;
  conflictDetected: boolean;
  unresolved: boolean;
  correctionReuseCandidate: boolean;
  correctionIds: string[];
  retrievalAnchorReady: boolean;
  fingerprintSignalTypes: MerchantFingerprintSignalType[];
  abstentionReasons: string[];
  supportingEvidence: ReturnType<typeof resolveMerchantAlias>['supportingEvidence'];
  conflictingEvidence: ReturnType<typeof resolveMerchantAlias>['conflictingEvidence'];
  evidenceHash: string;
};

export type MerchantBackfillMetrics = {
  processedCount: number;
  knownMerchantCount: number;
  knownMerchantCoverageBasisPoints: number;
  newMerchantCandidateCount: number;
  newMerchantRateBasisPoints: number;
  aliasConsolidationCount: number;
  aliasConsolidationRateBasisPoints: number;
  fingerprintCollisionCount: number;
  fingerprintCollisionRateBasisPoints: number;
  merchantConflictCount: number;
  merchantConflictRateBasisPoints: number;
  unresolvedMerchantCount: number;
  unresolvedMerchantRateBasisPoints: number;
  correctionReuseCandidateCount: number;
  correctionReuseCandidateRateBasisPoints: number;
  retrievalAnchorReadyCount: number;
  retrievalAnchorCoverageBasisPoints: number;
  abstentionReasonDistribution: Record<string, number>;
  signalCoverage: Record<MerchantFingerprintSignalType, number>;
};

export type MerchantBackfillPagination = {
  page: number;
  pageSize: MerchantBackfillPageSize;
  totalItems: number;
  totalPages: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
};

export type MerchantBackfillReport = {
  workspaceId: string;
  runKey: string;
  plannerVersion: string;
  fingerprintExtractionVersion: string;
  aliasResolutionVersion: string;
  sourceSnapshotHash: string;
  parametersHash: string;
  totalTransactionCount: number;
  results: MerchantBackfillResult[];
  metrics: MerchantBackfillMetrics;
  pagination: MerchantBackfillPagination;
  sideEffects: {
    writesMerchantKnowledge: false;
    createsTransactionBooking: false;
    mutatesBankFacts: false;
    changesTrustedHistory: false;
  };
};

export type MerchantBackfillPlannerInput = {
  workspaceId: string;
  runKey: string;
  engineVersion: string;
  page?: number;
  pageSize?: number;
  transactions: readonly MerchantBackfillTransaction[];
  merchants: readonly MerchantIdentityRecord[];
  aliases: readonly MerchantAliasRecord[];
  approvedCorrections?: readonly ApprovedMerchantCorrection[];
  priorResultIds?: readonly string[];
};

const stableValue = (value: unknown): unknown => {
  if (typeof value === 'bigint') return value.toString();
  if (value instanceof Date) return value.toISOString();
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

const rate = (count: number, total: number): number =>
  total === 0 ? 0 : Math.round((count * 10_000) / total);

const sortedUnique = (values: readonly string[]): string[] =>
  [...new Set(values)].sort((left, right) => left.localeCompare(right));

const normalizePageSize = (value: number | undefined): MerchantBackfillPageSize =>
  MERCHANT_BACKFILL_PAGE_SIZES.includes(value as MerchantBackfillPageSize)
    ? value as MerchantBackfillPageSize
    : 25;

const validateInput = (input: MerchantBackfillPlannerInput): void => {
  const workspaceId = input.workspaceId.trim();
  if (!workspaceId) throw new Error('workspaceId is required');
  if (!input.runKey.trim()) throw new Error('runKey is required');
  if (!input.engineVersion.trim()) throw new Error('engineVersion is required');

  const transactionIds = input.transactions.map((item) => item.transactionId);
  if (new Set(transactionIds).size !== transactionIds.length) {
    throw new Error('duplicate transaction IDs are not allowed');
  }
  const priorResultIds = input.priorResultIds ?? [];
  if (new Set(priorResultIds).size !== priorResultIds.length) {
    throw new Error('duplicate prior result IDs are not allowed');
  }
  if (
    input.transactions.some((item) => item.workspaceId !== workspaceId)
    || input.merchants.some((item) => item.workspaceId !== workspaceId)
    || input.aliases.some((item) => item.workspaceId !== workspaceId)
    || (input.approvedCorrections ?? []).some((item) => item.workspaceId !== workspaceId)
  ) {
    throw new Error('all backfill input records must belong to the requested workspace');
  }
};

const classify = (
  input: MerchantBackfillPlannerInput,
  transaction: MerchantBackfillTransaction,
): MerchantBackfillResult => {
  const extraction = extractMerchantFingerprints(transaction);
  const resolution = resolveMerchantAlias({
    workspaceId: input.workspaceId,
    fingerprints: extraction.fingerprints,
    aliases: input.aliases,
  });
  const activeMerchantIds = new Set(
    input.merchants
      .filter((merchant) => merchant.status === 'ACTIVE')
      .map((merchant) => merchant.id),
  );
  const correctionMatches = (input.approvedCorrections ?? [])
    .filter((correction) => extraction.fingerprints.some(
      (fingerprint) => fingerprint.signalType === correction.signalType
        && fingerprint.valueHash === correction.valueHash,
    ))
    .sort((left, right) => left.id.localeCompare(right.id));

  const knownMerchant = resolution.status === 'RESOLVED'
    && resolution.merchantId !== null
    && activeMerchantIds.has(resolution.merchantId);
  const fingerprintCollision = resolution.status === 'CONFLICTED'
    && resolution.reason === 'STRONGEST_SIGNAL_COLLISION';
  const conflictDetected = resolution.status === 'CONFLICTED';
  const hasUsableFingerprint = extraction.fingerprints.length > 0;
  const newMerchantCandidate = resolution.status === 'ABSTAINED'
    && resolution.reason === 'NO_TRUSTED_MATCH'
    && hasUsableFingerprint;
  const unresolved = !knownMerchant && !newMerchantCandidate && !conflictDetected;
  const state: MerchantBackfillResultState = knownMerchant
    ? 'KNOWN_MERCHANT'
    : conflictDetected
      ? 'CONFLICTED'
      : newMerchantCandidate
        ? 'NEW_MERCHANT_CANDIDATE'
        : 'UNRESOLVED';

  const matchedAliasKeys = new Set(
    resolution.supportingEvidence.map((evidence) => `${evidence.signalType}:${evidence.fingerprintHash}`),
  );
  const aliasConsolidationOpportunity = knownMerchant
    && extraction.fingerprints.some((fingerprint) =>
      !matchedAliasKeys.has(`${fingerprint.signalType}:${fingerprint.valueHash}`),
    );
  const abstentionReasons = sortedUnique([
    ...extraction.abstentions.map((item) => `${item.signalType}:${item.reason}`),
    ...(resolution.reason ? [`ALIAS:${resolution.reason}`] : []),
  ]);
  const fingerprintSignalTypes = extraction.fingerprints.map((item) => item.signalType);
  const resultId = stableHash({
    workspaceId: input.workspaceId,
    runKey: input.runKey,
    engineVersion: input.engineVersion,
    transactionId: transaction.transactionId,
    extractionVersion: extraction.extractionVersion,
    resolutionVersion: resolution.resolutionVersion,
  });
  const evidenceHash = stableHash({
    resultId,
    state,
    merchantId: knownMerchant ? resolution.merchantId : null,
    extraction,
    resolution,
    correctionIds: correctionMatches.map((item) => item.id),
    aliasConsolidationOpportunity,
    fingerprintCollision,
  });

  return {
    resultId,
    transactionId: transaction.transactionId,
    transactionDate: transaction.date.toISOString(),
    state,
    merchantId: knownMerchant ? resolution.merchantId : null,
    knownMerchant,
    newMerchantCandidate,
    aliasConsolidationOpportunity,
    fingerprintCollision,
    conflictDetected,
    unresolved,
    correctionReuseCandidate: correctionMatches.length > 0,
    correctionIds: correctionMatches.map((item) => item.id),
    retrievalAnchorReady: knownMerchant && !conflictDetected,
    fingerprintSignalTypes,
    abstentionReasons,
    supportingEvidence: resolution.supportingEvidence,
    conflictingEvidence: resolution.conflictingEvidence,
    evidenceHash,
  };
};

const metricsFor = (results: readonly MerchantBackfillResult[]): MerchantBackfillMetrics => {
  const total = results.length;
  const count = (predicate: (item: MerchantBackfillResult) => boolean): number =>
    results.filter(predicate).length;
  const abstentionReasonDistribution: Record<string, number> = {};
  const signalCoverage: Record<MerchantFingerprintSignalType, number> = {
    IBAN: 0,
    NORMALIZED_COUNTERPARTY: 0,
    PAYMENT_PURPOSE: 0,
    RECURRING_PATTERN: 0,
  };

  for (const result of results) {
    for (const reason of result.abstentionReasons) {
      abstentionReasonDistribution[reason] = (abstentionReasonDistribution[reason] ?? 0) + 1;
    }
    for (const signalType of result.fingerprintSignalTypes) {
      signalCoverage[signalType] += 1;
    }
  }

  const knownMerchantCount = count((item) => item.knownMerchant);
  const newMerchantCandidateCount = count((item) => item.newMerchantCandidate);
  const aliasConsolidationCount = count((item) => item.aliasConsolidationOpportunity);
  const fingerprintCollisionCount = count((item) => item.fingerprintCollision);
  const merchantConflictCount = count((item) => item.conflictDetected);
  const unresolvedMerchantCount = count((item) => item.unresolved);
  const correctionReuseCandidateCount = count((item) => item.correctionReuseCandidate);
  const retrievalAnchorReadyCount = count((item) => item.retrievalAnchorReady);

  return {
    processedCount: total,
    knownMerchantCount,
    knownMerchantCoverageBasisPoints: rate(knownMerchantCount, total),
    newMerchantCandidateCount,
    newMerchantRateBasisPoints: rate(newMerchantCandidateCount, total),
    aliasConsolidationCount,
    aliasConsolidationRateBasisPoints: rate(aliasConsolidationCount, total),
    fingerprintCollisionCount,
    fingerprintCollisionRateBasisPoints: rate(fingerprintCollisionCount, total),
    merchantConflictCount,
    merchantConflictRateBasisPoints: rate(merchantConflictCount, total),
    unresolvedMerchantCount,
    unresolvedMerchantRateBasisPoints: rate(unresolvedMerchantCount, total),
    correctionReuseCandidateCount,
    correctionReuseCandidateRateBasisPoints: rate(correctionReuseCandidateCount, total),
    retrievalAnchorReadyCount,
    retrievalAnchorCoverageBasisPoints: rate(retrievalAnchorReadyCount, total),
    abstentionReasonDistribution: Object.fromEntries(
      Object.entries(abstentionReasonDistribution).sort(([left], [right]) => left.localeCompare(right)),
    ),
    signalCoverage,
  };
};

export const planMerchantBackfill = (
  input: MerchantBackfillPlannerInput,
): MerchantBackfillReport => {
  validateInput(input);
  const workspaceId = input.workspaceId.trim();
  const pageSize = normalizePageSize(input.pageSize);
  const sortedTransactions = [...input.transactions].sort((left, right) =>
    left.date.getTime() - right.date.getTime()
    || left.transactionId.localeCompare(right.transactionId),
  );
  const allResults = sortedTransactions.map((transaction) => classify(input, transaction));
  const totalItems = allResults.length;
  const totalPages = totalItems === 0 ? 0 : Math.ceil(totalItems / pageSize);
  const requestedPage = Number.isInteger(input.page) && (input.page ?? 0) > 0 ? input.page as number : 1;
  const page = totalPages === 0 ? 1 : Math.min(requestedPage, totalPages);
  const start = (page - 1) * pageSize;
  const results = allResults.slice(start, start + pageSize);
  const sourceSnapshotHash = stableHash(sortedTransactions);
  const parametersHash = stableHash({
    workspaceId,
    runKey: input.runKey.trim(),
    engineVersion: input.engineVersion.trim(),
    page,
    pageSize,
    plannerVersion: MERCHANT_BACKFILL_PLANNER_VERSION,
    fingerprintExtractionVersion: MERCHANT_FINGERPRINT_EXTRACTION_VERSION,
    aliasResolutionVersion: MERCHANT_ALIAS_RESOLUTION_VERSION,
    merchantIds: input.merchants.map((item) => item.id).sort(),
    aliasEvidence: input.aliases.map((item) => ({
      id: item.id,
      merchantId: item.merchantId,
      signalType: item.signalType,
      valueHash: item.valueHash,
      status: item.status,
      evidenceHash: item.evidenceHash,
    })).sort((left, right) => left.id.localeCompare(right.id)),
    correctionEvidence: (input.approvedCorrections ?? []).map((item) => ({ ...item }))
      .sort((left, right) => left.id.localeCompare(right.id)),
    priorResultIds: sortedUnique(input.priorResultIds ?? []),
  });

  return {
    workspaceId,
    runKey: input.runKey.trim(),
    plannerVersion: MERCHANT_BACKFILL_PLANNER_VERSION,
    fingerprintExtractionVersion: MERCHANT_FINGERPRINT_EXTRACTION_VERSION,
    aliasResolutionVersion: MERCHANT_ALIAS_RESOLUTION_VERSION,
    sourceSnapshotHash,
    parametersHash,
    totalTransactionCount: totalItems,
    results,
    metrics: metricsFor(allResults),
    pagination: {
      page,
      pageSize,
      totalItems,
      totalPages,
      hasPreviousPage: page > 1 && totalPages > 0,
      hasNextPage: page < totalPages,
    },
    sideEffects: {
      writesMerchantKnowledge: false,
      createsTransactionBooking: false,
      mutatesBankFacts: false,
      changesTrustedHistory: false,
    },
  };
};
