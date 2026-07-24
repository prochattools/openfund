import type { PrismaClient } from '@prisma/client';
import { isValidWorkspaceId } from '../../src/utils/auth';
import type { RequestActor } from '../auth/requestContext';
import { prisma } from '../prismaClient';
import {
  planMerchantIdentityChange,
  type MerchantIdentityPlanAction,
  type MerchantIdentityPlanInput,
  type MerchantIdentityPlanIssue,
  type MerchantOwnershipSnapshot,
  type MerchantRollbackStep,
  type SplitAssignment,
} from './merchantIdentityPlanService';
import type { MerchantAliasMatchEvidence, MerchantAliasRecord } from './merchantAliasResolver';
import type { MerchantFingerprintOwnershipRecord } from './merchantIdentityPlanService';
import type { MerchantFingerprintSignalType } from './merchantFingerprintExtractor';
import {
  MERCHANT_KNOWLEDGE_PREVIEW_EFFECTS,
  isMerchantKnowledgePreviewEnabled,
} from './merchantKnowledgeCapability';
import { hashMerchantConfirmationState } from './merchantKnowledgeStateHash';

const SUPPORTED_SIGNALS = new Set<MerchantFingerprintSignalType>(['IBAN', 'NORMALIZED_COUNTERPARTY', 'PAYMENT_PURPOSE', 'RECURRING_PATTERN']);
const isSupportedSignal = (value: string): value is MerchantFingerprintSignalType =>
  SUPPORTED_SIGNALS.has(value as MerchantFingerprintSignalType);
const REQUEST_KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,79}$/;
const MAX_REASON_LENGTH = 500;

export class MerchantKnowledgePreviewError extends Error {
  constructor(
    public readonly code: 'disabled' | 'misconfigured' | 'forbidden' | 'invalid_input' | 'not_found',
    message: string,
  ) {
    super(message);
  }
}

type CommonRequest = { action: MerchantIdentityPlanAction; reason: unknown; requestKey: unknown };
export type MerchantKnowledgePreviewResponse = {
  action: MerchantIdentityPlanAction;
  planVersion: string;
  planHash: string;
  beforeState: MerchantOwnershipSnapshot;
  afterState: MerchantOwnershipSnapshot;
  affectedEntityIds: string[];
  evidenceRefs: Array<{
    recordType: 'ALIAS' | 'FINGERPRINT';
    recordId: string;
    evidenceHash: string;
  }>;
  merchantStateRefs: Array<{
    merchantId: string;
    stateHash: string;
  }>;
  warnings: string[];
  blockingErrors: MerchantIdentityPlanIssue[];
  rollbackSteps: MerchantRollbackStep[];
} & typeof MERCHANT_KNOWLEDGE_PREVIEW_EFFECTS;

export type MerchantKnowledgePreviewRequest = CommonRequest & {
  targetMerchantId?: unknown;
  sourceMerchantIds?: unknown;
  sourceMerchantId?: unknown;
  plannedMerchantIds?: unknown;
  affectedAliasIds?: unknown;
  affectedFingerprintIds?: unknown;
  assignments?: unknown;
  conflictId?: unknown;
  intent?: unknown;
  selectedMerchantId?: unknown;
  aliasId?: unknown;
  merchantId?: unknown;
};

const strings = (value: unknown): string[] =>
  Array.isArray(value) ? [...new Set(value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0).map((item) => item.trim()))].sort() : [];
const stringValue = (value: unknown): string => typeof value === 'string' ? value.trim() : '';

const parseCommon = (request: MerchantKnowledgePreviewRequest) => {
  const reason = stringValue(request.reason).slice(0, MAX_REASON_LENGTH);
  const requestKey = stringValue(request.requestKey);
  if (!reason) throw new MerchantKnowledgePreviewError('invalid_input', 'Een expliciete reden is verplicht.');
  if (!REQUEST_KEY_PATTERN.test(requestKey)) throw new MerchantKnowledgePreviewError('invalid_input', 'De request key moet 8–80 veilige tekens bevatten.');
  return { reason, requestKey };
};

const resolveWorkspaceId = async (actor: RequestActor, client: PrismaClient, env: NodeJS.ProcessEnv) => {
  if (!isMerchantKnowledgePreviewEnabled(env)) throw new MerchantKnowledgePreviewError('disabled', 'Merchant Knowledge-planpreviews zijn uitgeschakeld.');
  const workspaceId = env.DEFAULT_WORKSPACE_ID?.trim();
  if (!isValidWorkspaceId(workspaceId)) throw new MerchantKnowledgePreviewError('misconfigured', 'Merchant Knowledge-werkruimte is niet geconfigureerd.');
  const membership = await client.workspaceMembership.findFirst({
    where: { userId: actor.userId, workspaceId, isActive: true, workspace: { isActive: true } },
    select: { id: true },
  });
  if (!membership) throw new MerchantKnowledgePreviewError('forbidden', 'Geen toegang tot deze financiële werkruimte.');
  return workspaceId;
};

const parseAssignments = (value: unknown): SplitAssignment[] => {
  if (!Array.isArray(value)) return [];
  return value.map((item) => {
    const row = item && typeof item === 'object' ? item as Record<string, unknown> : {};
    return { merchantId: stringValue(row.merchantId), aliasIds: strings(row.aliasIds), fingerprintIds: strings(row.fingerprintIds) };
  }).filter((item) => item.merchantId);
};

export const previewMerchantKnowledgePlan = async (
  actor: RequestActor,
  request: MerchantKnowledgePreviewRequest,
  client: PrismaClient = prisma,
  env: NodeJS.ProcessEnv = process.env,
): Promise<MerchantKnowledgePreviewResponse> => {
  const workspaceId = await resolveWorkspaceId(actor, client, env);
  const { reason, requestKey } = parseCommon(request);
  const [merchantRows, aliasRows, fingerprintRows] = await Promise.all([
    client.merchant.findMany({
      where: { workspaceId },
      select: {
        id: true,
        workspaceId: true,
        status: true,
        mergedIntoMerchantId: true,
        version: true,
        updatedById: true,
        updatedAt: true,
        deprecatedAt: true,
      },
    }),
    client.merchantAlias.findMany({ where: { workspaceId }, select: { id: true, workspaceId: true, merchantId: true, signalType: true, valueHash: true, status: true, evidenceHash: true } }),
    client.merchantFingerprint.findMany({ where: { workspaceId }, select: { id: true, workspaceId: true, merchantId: true, signalType: true, valueHash: true, strength: true, status: true, evidenceHash: true } }),
  ]);
  const aliases: MerchantAliasRecord[] = aliasRows
    .filter((row) => isSupportedSignal(row.signalType))
    .map((row) => ({ ...row, signalType: row.signalType as MerchantFingerprintSignalType }));
  const fingerprints: MerchantFingerprintOwnershipRecord[] = fingerprintRows
    .filter((row) => isSupportedSignal(row.signalType))
    .map((row) => ({ ...row, signalType: row.signalType as MerchantFingerprintSignalType }));
  const common = { workspaceId, actorId: actor.actorId, requestKey, reason, merchants: merchantRows, aliases, fingerprints };
  let input: MerchantIdentityPlanInput;

  if (request.action === 'MERGE_MERCHANTS') {
    input = { ...common, action: request.action, targetMerchantId: stringValue(request.targetMerchantId), sourceMerchantIds: strings(request.sourceMerchantIds), affectedAliasIds: strings(request.affectedAliasIds), affectedFingerprintIds: strings(request.affectedFingerprintIds) };
  } else if (request.action === 'SPLIT_MERCHANT') {
    input = { ...common, action: request.action, sourceMerchantId: stringValue(request.sourceMerchantId), plannedMerchantIds: strings(request.plannedMerchantIds), affectedAliasIds: strings(request.affectedAliasIds), affectedFingerprintIds: strings(request.affectedFingerprintIds), assignments: parseAssignments(request.assignments) };
  } else if (request.action === 'REASSIGN_KNOWLEDGE') {
    input = { ...common, action: request.action, targetMerchantId: stringValue(request.targetMerchantId), affectedAliasIds: strings(request.affectedAliasIds), affectedFingerprintIds: strings(request.affectedFingerprintIds) };
  } else if (request.action === 'DEPRECATE_ALIAS') {
    input = { ...common, action: request.action, aliasId: stringValue(request.aliasId) };
  } else if (request.action === 'DEPRECATE_MERCHANT') {
    input = { ...common, action: request.action, merchantId: stringValue(request.merchantId) };
  } else if (request.action === 'RESOLVE_CONFLICT') {
    const conflictId = stringValue(request.conflictId);
    const conflict = await client.merchantConflict.findFirst({ where: { id: conflictId, workspaceId }, select: { id: true, candidateMerchantIds: true } });
    if (!conflict) throw new MerchantKnowledgePreviewError('not_found', 'Conflict niet gevonden.');
    const candidateIds = strings(conflict.candidateMerchantIds);
    const evidence: MerchantAliasMatchEvidence[] = aliases
      .filter((alias): alias is MerchantAliasRecord & { status: 'APPROVED' | 'TRUSTED' } =>
        candidateIds.includes(alias.merchantId) && (alias.status === 'APPROVED' || alias.status === 'TRUSTED'))
      .map((alias) => ({ aliasId: alias.id, merchantId: alias.merchantId, signalType: alias.signalType, fingerprintHash: alias.valueHash, aliasStatus: alias.status, precedence: alias.signalType === 'IBAN' ? 10 : alias.signalType === 'NORMALIZED_COUNTERPARTY' ? 30 : alias.signalType === 'PAYMENT_PURPOSE' ? 40 : 50, evidenceHash: alias.evidenceHash }));
    const intent = request.intent === 'SELECT_MERCHANT' || request.intent === 'ABSTAIN' || request.intent === 'DISMISS' ? request.intent : 'ABSTAIN';
    input = { ...common, action: request.action, intent, selectedMerchantId: stringValue(request.selectedMerchantId) || undefined, resolution: { workspaceId, resolutionVersion: 'merchant-alias-resolution-v1', status: 'CONFLICTED', merchantId: null, strongestSignalType: null, reason: 'STRONGEST_SIGNAL_COLLISION', supportingEvidence: [], conflictingEvidence: evidence }, conflictingEvidence: evidence };
  } else {
    throw new MerchantKnowledgePreviewError('invalid_input', 'Onbekende previewactie.');
  }

  const plan = planMerchantIdentityChange(input);
  return {
    action: plan.action,
    planVersion: plan.planVersion,
    planHash: plan.planHash,
    beforeState: plan.beforeState,
    afterState: plan.proposedAfterState,
    affectedEntityIds: [...new Set([
      ...plan.sourceMerchantIds,
      ...plan.targetMerchantIds,
      ...plan.affectedAliasIds,
      ...plan.affectedFingerprintIds,
    ])].sort(),
    evidenceRefs: [
      ...aliasRows
        .filter((row) => plan.affectedAliasIds.includes(row.id))
        .map((row) => ({ recordType: 'ALIAS' as const, recordId: row.id, evidenceHash: row.evidenceHash })),
      ...fingerprintRows
        .filter((row) => plan.affectedFingerprintIds.includes(row.id))
        .map((row) => ({ recordType: 'FINGERPRINT' as const, recordId: row.id, evidenceHash: row.evidenceHash })),
    ].sort((left, right) => `${left.recordType}:${left.recordId}`.localeCompare(`${right.recordType}:${right.recordId}`)),
    merchantStateRefs: merchantRows
      .filter((row) => plan.sourceMerchantIds.includes(row.id) || plan.targetMerchantIds.includes(row.id))
      .map((row) => ({
        merchantId: row.id,
        stateHash: hashMerchantConfirmationState(row),
      }))
      .sort((left, right) => left.merchantId.localeCompare(right.merchantId)),
    warnings: plan.validationWarnings,
    blockingErrors: plan.blockingErrors,
    rollbackSteps: plan.rollbackPlan,
    ...MERCHANT_KNOWLEDGE_PREVIEW_EFFECTS,
  };
};
