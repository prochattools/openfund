import type {
  ExtractedMerchantFingerprint,
  MerchantFingerprintSignalType,
} from './merchantFingerprintExtractor';

export const MERCHANT_ALIAS_RESOLUTION_VERSION = 'merchant-alias-resolution-v1';

export type MerchantAliasResolutionStatus = 'RESOLVED' | 'ABSTAINED' | 'CONFLICTED';
export type MerchantAliasStatus = 'OBSERVED' | 'PROPOSED' | 'APPROVED' | 'TRUSTED' | 'DEPRECATED' | 'REJECTED';

export type MerchantAliasRecord = {
  id: string;
  workspaceId: string;
  merchantId: string;
  signalType: MerchantFingerprintSignalType;
  valueHash: string;
  status: MerchantAliasStatus;
  evidenceHash: string;
};

export type MerchantAliasMatchEvidence = {
  aliasId: string;
  merchantId: string;
  signalType: MerchantFingerprintSignalType;
  fingerprintHash: string;
  aliasStatus: 'APPROVED' | 'TRUSTED';
  precedence: number;
  evidenceHash: string;
};

export type MerchantAliasResolutionReason =
  | 'NO_TRUSTED_MATCH'
  | 'NO_SUPPORTED_FINGERPRINTS'
  | 'STRONGEST_SIGNAL_COLLISION'
  | 'CROSS_WORKSPACE_ALIAS'
  | 'MISSING_WORKSPACE_CONTEXT';

export type MerchantAliasResolutionResult = {
  workspaceId: string;
  resolutionVersion: string;
  status: MerchantAliasResolutionStatus;
  merchantId: string | null;
  strongestSignalType: MerchantFingerprintSignalType | null;
  reason: MerchantAliasResolutionReason | null;
  supportingEvidence: MerchantAliasMatchEvidence[];
  conflictingEvidence: MerchantAliasMatchEvidence[];
};

const SIGNAL_PRECEDENCE: Record<MerchantFingerprintSignalType, number> = {
  IBAN: 10,
  NORMALIZED_COUNTERPARTY: 30,
  PAYMENT_PURPOSE: 40,
  RECURRING_PATTERN: 50,
};

const isTrustedAlias = (
  alias: MerchantAliasRecord,
): alias is MerchantAliasRecord & { status: 'APPROVED' | 'TRUSTED' } =>
  alias.status === 'APPROVED' || alias.status === 'TRUSTED';

const compareEvidence = (
  left: MerchantAliasMatchEvidence,
  right: MerchantAliasMatchEvidence,
): number =>
  left.precedence - right.precedence
  || left.merchantId.localeCompare(right.merchantId)
  || left.aliasId.localeCompare(right.aliasId);

export const resolveMerchantAlias = (input: {
  workspaceId: string;
  fingerprints: readonly ExtractedMerchantFingerprint[];
  aliases: readonly MerchantAliasRecord[];
}): MerchantAliasResolutionResult => {
  const workspaceId = input.workspaceId.trim();
  if (!workspaceId) {
    return {
      workspaceId: '',
      resolutionVersion: MERCHANT_ALIAS_RESOLUTION_VERSION,
      status: 'ABSTAINED',
      merchantId: null,
      strongestSignalType: null,
      reason: 'MISSING_WORKSPACE_CONTEXT',
      supportingEvidence: [],
      conflictingEvidence: [],
    };
  }

  if (input.aliases.some((alias) => alias.workspaceId !== workspaceId)) {
    return {
      workspaceId,
      resolutionVersion: MERCHANT_ALIAS_RESOLUTION_VERSION,
      status: 'ABSTAINED',
      merchantId: null,
      strongestSignalType: null,
      reason: 'CROSS_WORKSPACE_ALIAS',
      supportingEvidence: [],
      conflictingEvidence: [],
    };
  }

  if (input.fingerprints.length === 0) {
    return {
      workspaceId,
      resolutionVersion: MERCHANT_ALIAS_RESOLUTION_VERSION,
      status: 'ABSTAINED',
      merchantId: null,
      strongestSignalType: null,
      reason: 'NO_SUPPORTED_FINGERPRINTS',
      supportingEvidence: [],
      conflictingEvidence: [],
    };
  }

  const fingerprintsByKey = new Map<string, ExtractedMerchantFingerprint>();
  for (const fingerprint of input.fingerprints) {
    fingerprintsByKey.set(`${fingerprint.signalType}:${fingerprint.valueHash}`, fingerprint);
  }

  const matches = input.aliases
    .filter(isTrustedAlias)
    .filter((alias) => fingerprintsByKey.has(`${alias.signalType}:${alias.valueHash}`))
    .map<MerchantAliasMatchEvidence>((alias) => ({
      aliasId: alias.id,
      merchantId: alias.merchantId,
      signalType: alias.signalType,
      fingerprintHash: alias.valueHash,
      aliasStatus: alias.status,
      precedence: SIGNAL_PRECEDENCE[alias.signalType],
      evidenceHash: alias.evidenceHash,
    }))
    .sort(compareEvidence);

  if (matches.length === 0) {
    return {
      workspaceId,
      resolutionVersion: MERCHANT_ALIAS_RESOLUTION_VERSION,
      status: 'ABSTAINED',
      merchantId: null,
      strongestSignalType: null,
      reason: 'NO_TRUSTED_MATCH',
      supportingEvidence: [],
      conflictingEvidence: [],
    };
  }

  const strongestPrecedence = matches[0].precedence;
  const strongestMatches = matches.filter((match) => match.precedence === strongestPrecedence);
  const strongestMerchantIds = [...new Set(strongestMatches.map((match) => match.merchantId))].sort();
  const strongestSignalType = strongestMatches[0].signalType;

  if (strongestMerchantIds.length !== 1) {
    return {
      workspaceId,
      resolutionVersion: MERCHANT_ALIAS_RESOLUTION_VERSION,
      status: 'CONFLICTED',
      merchantId: null,
      strongestSignalType,
      reason: 'STRONGEST_SIGNAL_COLLISION',
      supportingEvidence: [],
      conflictingEvidence: matches,
    };
  }

  const merchantId = strongestMerchantIds[0];
  const supportingEvidence = matches
    .filter((match) => match.merchantId === merchantId)
    .sort(compareEvidence);
  const conflictingEvidence = matches
    .filter((match) => match.merchantId !== merchantId)
    .sort(compareEvidence);

  return {
    workspaceId,
    resolutionVersion: MERCHANT_ALIAS_RESOLUTION_VERSION,
    status: 'RESOLVED',
    merchantId,
    strongestSignalType,
    reason: null,
    supportingEvidence,
    conflictingEvidence,
  };
};
