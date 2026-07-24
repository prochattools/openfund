import type { Prisma } from '@prisma/client';
import type { MerchantAliasMatchEvidence } from './merchantAliasResolver';
import type { MerchantFingerprintSignalType } from './merchantFingerprintExtractor';
import { hashEvidence } from './reviewDecisionService';

const SUPPORTED_SIGNALS = new Set<MerchantFingerprintSignalType>([
  'IBAN',
  'NORMALIZED_COUNTERPARTY',
  'PAYMENT_PURPOSE',
  'RECURRING_PATTERN',
]);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const asString = (value: unknown): string => typeof value === 'string' ? value.trim() : '';

export const parseConflictEvidence = (
  value: Prisma.JsonValue,
): MerchantAliasMatchEvidence[] => {
  if (!Array.isArray(value)) return [];
  const parsed: MerchantAliasMatchEvidence[] = [];
  for (const item of value) {
    if (!isRecord(item)) continue;
    const aliasId = asString(item.aliasId);
    const merchantId = asString(item.merchantId);
    const signalType = asString(item.signalType);
    const fingerprintHash = asString(item.fingerprintHash);
    const aliasStatus = asString(item.aliasStatus);
    const evidenceHash = asString(item.evidenceHash);
    const precedence = typeof item.precedence === 'number' && Number.isFinite(item.precedence)
      ? item.precedence
      : NaN;
    if (
      !aliasId
      || !merchantId
      || !SUPPORTED_SIGNALS.has(signalType as MerchantFingerprintSignalType)
      || !fingerprintHash
      || !['APPROVED', 'TRUSTED'].includes(aliasStatus)
      || !evidenceHash
      || !Number.isFinite(precedence)
    ) continue;
    parsed.push({
      aliasId,
      merchantId,
      signalType: signalType as MerchantFingerprintSignalType,
      fingerprintHash,
      aliasStatus: aliasStatus as 'APPROVED' | 'TRUSTED',
      precedence,
      evidenceHash,
    });
  }
  return parsed.sort((left, right) =>
    left.precedence - right.precedence
    || left.merchantId.localeCompare(right.merchantId)
    || left.aliasId.localeCompare(right.aliasId));
};

export type ConflictConfirmationState = {
  id: string;
  workspaceId: string;
  transactionId: string;
  status: string;
  candidateMerchantIds: string[];
  supportingEvidence: MerchantAliasMatchEvidence[];
  conflictingEvidence: MerchantAliasMatchEvidence[];
  evidenceHash: string;
  resolutionId: string | null;
  openedAt: Date | string;
  resolvedAt: Date | string | null;
  resolvedById: string | null;
  resolutionReason: string | null;
};

const iso = (value: Date | string): string =>
  value instanceof Date ? value.toISOString() : new Date(value).toISOString();

export const conflictStatePayload = (state: ConflictConfirmationState) => ({
  id: state.id,
  workspaceId: state.workspaceId,
  transactionId: state.transactionId,
  status: state.status,
  candidateMerchantIds: [...new Set(state.candidateMerchantIds)].sort(),
  supportingEvidence: state.supportingEvidence,
  conflictingEvidence: state.conflictingEvidence,
  evidenceHash: state.evidenceHash,
  resolutionId: state.resolutionId,
  openedAt: iso(state.openedAt),
  resolvedAt: state.resolvedAt ? iso(state.resolvedAt) : null,
  resolvedById: state.resolvedById,
  resolutionReason: state.resolutionReason,
});

export const hashConflictConfirmationState = (
  state: ConflictConfirmationState,
): string => hashEvidence(conflictStatePayload(state));
