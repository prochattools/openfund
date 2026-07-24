import type { Prisma, PrismaClient } from '@prisma/client';
import { MerchantConflictStatus, MerchantResolutionStatus, MerchantStatus } from '@prisma/client';
import { isValidWorkspaceId } from '../../src/utils/auth';
import type { RequestActor } from '../auth/requestContext';
import { prisma } from '../prismaClient';
import {
  MERCHANT_CONFLICT_CONFIRMATION_EFFECTS,
  isMerchantConflictConfirmationEnabled,
} from './merchantKnowledgeCapability';
import { createMerchantKnowledgeAuditEvent } from './merchantKnowledgeAuditService';
import {
  conflictStatePayload,
  hashConflictConfirmationState,
  parseConflictEvidence,
} from './merchantConflictStateHash';
import type { MerchantAliasRecord } from './merchantAliasResolver';
import type { MerchantFingerprintSignalType } from './merchantFingerprintExtractor';
import {
  planMerchantIdentityChange,
  type MerchantFingerprintOwnershipRecord,
} from './merchantIdentityPlanService';
import { canonicalizeEvidence, hashEvidence } from './reviewDecisionService';

const REQUEST_KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,79}$/;
const HASH_PATTERN = /^[a-f0-9]{64}$/i;
const MAX_REASON_LENGTH = 500;
const MAX_ID_LENGTH = 200;
const ENGINE_VERSION = 'merchant-admin-conflict-resolution-v1';
const AUDIT_SCHEMA_VERSION = 'merchant-audit-v1';
const CONFIRMATION_SCHEMA_VERSION = 'merchant-conflict-confirmation-v1';
const SUPPORTED_SIGNALS = new Set<MerchantFingerprintSignalType>([
  'IBAN',
  'NORMALIZED_COUNTERPARTY',
  'PAYMENT_PURPOSE',
  'RECURRING_PATTERN',
]);

const isSupportedSignal = (value: string): value is MerchantFingerprintSignalType =>
  SUPPORTED_SIGNALS.has(value as MerchantFingerprintSignalType);
const toInputJson = (value: unknown): Prisma.InputJsonValue =>
  JSON.parse(canonicalizeEvidence(value)) as Prisma.InputJsonValue;
const deterministicId = (
  prefix: 'mk-decision' | 'mk-audit' | 'mk-resolution',
  workspaceId: string,
  requestKey: string,
) => `${prefix}-${hashEvidence({ prefix, workspaceId, requestKey }).slice(0, 32)}`;
const parseString = (value: unknown): string => typeof value === 'string' ? value.trim() : '';
const parseStringArray = (value: Prisma.JsonValue): string[] =>
  Array.isArray(value)
    ? [...new Set(value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0).map((item) => item.trim()))].sort()
    : [];
const readEvidenceRecord = (value: Prisma.JsonValue): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};

export type MerchantConflictIntent = 'SELECT_MERCHANT' | 'ABSTAIN' | 'DISMISS';

export class MerchantConflictDecisionError extends Error {
  constructor(
    public readonly code:
      | 'disabled'
      | 'misconfigured'
      | 'invalid_input'
      | 'forbidden'
      | 'not_found'
      | 'finalized'
      | 'stale_plan'
      | 'blocked'
      | 'invalid_selection'
      | 'idempotency_conflict'
      | 'integrity_error',
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = 'MerchantConflictDecisionError';
  }
}

export type MerchantConflictConfirmationRequest = {
  action: unknown;
  conflictId: unknown;
  intent: unknown;
  selectedMerchantId?: unknown;
  planVersion: unknown;
  planHash: unknown;
  conflictStateHash: unknown;
  conflictEvidenceHash: unknown;
  reason: unknown;
  requestKey: unknown;
};

type ParsedRequest = {
  action: 'RESOLVE_CONFLICT';
  conflictId: string;
  intent: MerchantConflictIntent;
  selectedMerchantId: string | null;
  planVersion: string;
  planHash: string;
  conflictStateHash: string;
  conflictEvidenceHash: string;
  reason: string;
  requestKey: string;
};

export type MerchantConflictConfirmationResult = {
  decisionId: string;
  auditEventId: string;
  resolutionId: string | null;
  conflictId: string;
  intent: MerchantConflictIntent;
  selectedMerchantId: string | null;
  priorStatus: MerchantConflictStatus;
  newStatus: 'RESOLVED' | 'DISMISSED';
  resolvedAt: Date;
  planVersion: string;
  planHash: string;
  conflictStateHash: string;
  evidenceHash: string;
  idempotent: boolean;
} & typeof MERCHANT_CONFLICT_CONFIRMATION_EFFECTS;

const parseRequest = (input: MerchantConflictConfirmationRequest): ParsedRequest => {
  const action = parseString(input.action);
  const conflictId = parseString(input.conflictId);
  const intent = parseString(input.intent);
  const selectedMerchantId = parseString(input.selectedMerchantId) || null;
  const planVersion = parseString(input.planVersion);
  const planHash = parseString(input.planHash).toLowerCase();
  const conflictStateHash = parseString(input.conflictStateHash).toLowerCase();
  const conflictEvidenceHash = parseString(input.conflictEvidenceHash).toLowerCase();
  const reason = parseString(input.reason);
  const requestKey = parseString(input.requestKey);

  if (action !== 'RESOLVE_CONFLICT') {
    throw new MerchantConflictDecisionError('invalid_input', 'Alleen conflictbevestiging is toegestaan.', 400);
  }
  if (!conflictId || conflictId.length > MAX_ID_LENGTH) {
    throw new MerchantConflictDecisionError('invalid_input', 'Een geldig conflict-ID is verplicht.', 400);
  }
  if (!['SELECT_MERCHANT', 'ABSTAIN', 'DISMISS'].includes(intent)) {
    throw new MerchantConflictDecisionError('invalid_input', 'Een geldige conflictintentie is verplicht.', 400);
  }
  if (intent === 'SELECT_MERCHANT' && !selectedMerchantId) {
    throw new MerchantConflictDecisionError('invalid_input', 'Een geselecteerde merchant is verplicht.', 400);
  }
  if (intent !== 'SELECT_MERCHANT' && selectedMerchantId) {
    throw new MerchantConflictDecisionError('invalid_input', 'Deze conflictintentie accepteert geen merchantselectie.', 400);
  }
  if (!planVersion || planVersion.length > 100 || !HASH_PATTERN.test(planHash)) {
    throw new MerchantConflictDecisionError('invalid_input', 'Een geldige planversie en plan-hash zijn verplicht.', 400);
  }
  if (!HASH_PATTERN.test(conflictStateHash) || !HASH_PATTERN.test(conflictEvidenceHash)) {
    throw new MerchantConflictDecisionError('invalid_input', 'Geldige conflict state- en evidence-hashes zijn verplicht.', 400);
  }
  if (!reason || reason.length > MAX_REASON_LENGTH) {
    throw new MerchantConflictDecisionError('invalid_input', 'Een expliciete reden van maximaal 500 tekens is verplicht.', 400);
  }
  if (!REQUEST_KEY_PATTERN.test(requestKey)) {
    throw new MerchantConflictDecisionError('invalid_input', 'De request key moet 8–80 veilige tekens bevatten.', 400);
  }

  return {
    action: 'RESOLVE_CONFLICT',
    conflictId,
    intent: intent as MerchantConflictIntent,
    selectedMerchantId,
    planVersion,
    planHash,
    conflictStateHash,
    conflictEvidenceHash,
    reason,
    requestKey,
  };
};

export const confirmMerchantConflictResolution = async (
  actor: RequestActor,
  request: MerchantConflictConfirmationRequest,
  client: PrismaClient = prisma,
  env: NodeJS.ProcessEnv = process.env,
): Promise<MerchantConflictConfirmationResult> => {
  if (!isMerchantConflictConfirmationEnabled(env)) {
    throw new MerchantConflictDecisionError('disabled', 'Conflictbevestiging is uitgeschakeld.', 503);
  }
  const input = parseRequest(request);
  const workspaceId = env.DEFAULT_WORKSPACE_ID?.trim();
  if (!isValidWorkspaceId(workspaceId)) {
    throw new MerchantConflictDecisionError('misconfigured', 'Merchant Knowledge-werkruimte is niet geconfigureerd.', 503);
  }

  const requestHash = hashEvidence({
    workspaceId,
    conflictId: input.conflictId,
    intent: input.intent,
    selectedMerchantId: input.selectedMerchantId,
    conflictStateHash: input.conflictStateHash,
    conflictEvidenceHash: input.conflictEvidenceHash,
    planVersion: input.planVersion,
    planHash: input.planHash,
    reason: input.reason,
    requestKey: input.requestKey,
  });
  const decisionId = deterministicId('mk-decision', workspaceId, input.requestKey);
  const auditEventId = deterministicId('mk-audit', workspaceId, input.requestKey);
  const resolutionId = input.intent === 'DISMISS'
    ? null
    : deterministicId('mk-resolution', workspaceId, input.requestKey);

  return client.$transaction(async (tx) => {
    const membership = await tx.workspaceMembership.findFirst({
      where: {
        userId: actor.userId,
        workspaceId,
        isActive: true,
        workspace: { isActive: true },
      },
      select: { id: true },
    });
    if (!membership) {
      throw new MerchantConflictDecisionError('forbidden', 'Geen toegang tot deze financiële werkruimte.', 403);
    }

    const existingDecision = await tx.merchantIdentityDecision.findUnique({
      where: { id: decisionId },
      select: {
        id: true,
        action: true,
        conflictId: true,
        targetMerchantId: true,
        evidence: true,
        evidenceHash: true,
        decisionVersion: true,
      },
    });
    if (existingDecision) {
      const evidence = readEvidenceRecord(existingDecision.evidence);
      if (
        existingDecision.action !== 'RESOLVE_CONFLICT'
        || existingDecision.conflictId !== input.conflictId
        || existingDecision.targetMerchantId !== input.selectedMerchantId
        || evidence.requestHash !== requestHash
        || evidence.intent !== input.intent
        || evidence.planHash !== input.planHash
        || evidence.planVersion !== input.planVersion
      ) {
        throw new MerchantConflictDecisionError('idempotency_conflict', 'Deze request key is al voor andere inhoud gebruikt.', 409);
      }
      const [existingAudit, conflict, existingResolution] = await Promise.all([
        tx.merchantAuditEvent.findUnique({ where: { id: auditEventId }, select: { id: true, evidenceHash: true } }),
        tx.merchantConflict.findFirst({
          where: { id: input.conflictId, workspaceId },
          select: { status: true, resolutionId: true, resolvedAt: true },
        }),
        resolutionId
          ? tx.merchantResolution.findUnique({ where: { id: resolutionId }, select: { id: true, status: true, merchantId: true, evidenceHash: true } })
          : Promise.resolve(null),
      ]);
      const expectedStatus = input.intent === 'DISMISS' ? MerchantConflictStatus.DISMISSED : MerchantConflictStatus.RESOLVED;
      if (
        !existingAudit
        || existingAudit.evidenceHash !== existingDecision.evidenceHash
        || !conflict?.resolvedAt
        || conflict.status !== expectedStatus
        || conflict.resolutionId !== resolutionId
        || (resolutionId && (!existingResolution || existingResolution.evidenceHash !== existingDecision.evidenceHash))
      ) {
        throw new MerchantConflictDecisionError('integrity_error', 'De eerdere conflictbevestiging is onvolledig.', 500);
      }
      return {
        decisionId: existingDecision.id,
        auditEventId: existingAudit.id,
        resolutionId,
        conflictId: input.conflictId,
        intent: input.intent,
        selectedMerchantId: input.selectedMerchantId,
        priorStatus: MerchantConflictStatus.OPEN,
        newStatus: expectedStatus,
        resolvedAt: conflict.resolvedAt,
        planVersion: existingDecision.decisionVersion,
        planHash: input.planHash,
        conflictStateHash: input.conflictStateHash,
        evidenceHash: existingDecision.evidenceHash,
        idempotent: true,
        ...MERCHANT_CONFLICT_CONFIRMATION_EFFECTS,
      };
    }

    const [conflict, merchantRows, aliasRows, fingerprintRows] = await Promise.all([
      tx.merchantConflict.findFirst({
        where: { id: input.conflictId, workspaceId },
        select: {
          id: true,
          workspaceId: true,
          transactionId: true,
          resolutionId: true,
          status: true,
          candidateMerchantIds: true,
          supportingSignals: true,
          conflictingSignals: true,
          evidenceHash: true,
          openedAt: true,
          resolvedAt: true,
          resolvedById: true,
          resolutionReason: true,
        },
      }),
      tx.merchant.findMany({
        where: { workspaceId },
        select: { id: true, workspaceId: true, status: true, mergedIntoMerchantId: true },
      }),
      tx.merchantAlias.findMany({
        where: { workspaceId },
        select: { id: true, workspaceId: true, merchantId: true, signalType: true, valueHash: true, status: true, evidenceHash: true },
      }),
      tx.merchantFingerprint.findMany({
        where: { workspaceId },
        select: { id: true, workspaceId: true, merchantId: true, signalType: true, valueHash: true, strength: true, status: true, evidenceHash: true },
      }),
    ]);
    if (!conflict) {
      throw new MerchantConflictDecisionError('not_found', 'Conflict niet gevonden in deze werkruimte.', 404);
    }
    if (conflict.status !== MerchantConflictStatus.OPEN || conflict.resolvedAt || conflict.resolvedById) {
      throw new MerchantConflictDecisionError('finalized', 'Alleen een open conflict kan worden bevestigd.', 409);
    }
    if (input.intent === 'DISMISS' && conflict.resolutionId) {
      throw new MerchantConflictDecisionError('stale_plan', 'Een conflict met bestaande resolution kan niet worden afgewezen.', 409);
    }

    const candidateMerchantIds = parseStringArray(conflict.candidateMerchantIds);
    const supportingEvidence = parseConflictEvidence(conflict.supportingSignals);
    const conflictingEvidence = parseConflictEvidence(conflict.conflictingSignals);
    const currentStateHash = hashConflictConfirmationState({
      ...conflict,
      candidateMerchantIds,
      supportingEvidence,
      conflictingEvidence,
    });
    if (currentStateHash !== input.conflictStateHash || conflict.evidenceHash !== input.conflictEvidenceHash) {
      throw new MerchantConflictDecisionError('stale_plan', 'Conflictstatus, kandidaten of bewijs zijn gewijzigd.', 409);
    }

    if (input.intent === 'SELECT_MERCHANT') {
      const selected = merchantRows.find((row) => row.id === input.selectedMerchantId);
      if (
        !selected
        || selected.status !== MerchantStatus.ACTIVE
        || selected.mergedIntoMerchantId
        || !candidateMerchantIds.includes(selected.id)
        || ![...supportingEvidence, ...conflictingEvidence].some((item) => item.merchantId === selected.id)
      ) {
        throw new MerchantConflictDecisionError('invalid_selection', 'De geselecteerde merchant is niet geldig voor dit conflict.', 409);
      }
    }

    const aliases: MerchantAliasRecord[] = aliasRows
      .filter((row) => isSupportedSignal(row.signalType))
      .map((row) => ({ ...row, signalType: row.signalType as MerchantFingerprintSignalType }));
    const fingerprints: MerchantFingerprintOwnershipRecord[] = fingerprintRows
      .filter((row) => isSupportedSignal(row.signalType))
      .map((row) => ({ ...row, signalType: row.signalType as MerchantFingerprintSignalType }));
    const plan = planMerchantIdentityChange({
      action: 'RESOLVE_CONFLICT',
      workspaceId,
      actorId: actor.actorId,
      requestKey: input.requestKey,
      reason: input.reason,
      merchants: merchantRows,
      aliases,
      fingerprints,
      intent: input.intent,
      selectedMerchantId: input.selectedMerchantId ?? undefined,
      resolution: {
        workspaceId,
        resolutionVersion: 'merchant-alias-resolution-v1',
        status: 'CONFLICTED',
        merchantId: null,
        strongestSignalType: null,
        reason: 'STRONGEST_SIGNAL_COLLISION',
        supportingEvidence,
        conflictingEvidence,
      },
      conflictingEvidence,
    });
    if (
      plan.action !== 'RESOLVE_CONFLICT'
      || plan.workspaceId !== workspaceId
      || plan.planVersion !== input.planVersion
      || plan.planHash !== input.planHash
      || plan.affectedAliasIds.length !== 0
      || plan.affectedFingerprintIds.length !== 0
    ) {
      throw new MerchantConflictDecisionError('stale_plan', 'Het previewplan is verouderd of gewijzigd.', 409);
    }
    if (plan.blockingErrors.length > 0) {
      throw new MerchantConflictDecisionError('blocked', 'Het plan bevat blokkerende fouten.', 409);
    }

    const resolvedAt = new Date();
    const newStatus = input.intent === 'DISMISS'
      ? MerchantConflictStatus.DISMISSED
      : MerchantConflictStatus.RESOLVED;
    const inputHash = hashEvidence({
      conflictStateHash: input.conflictStateHash,
      intent: input.intent,
      selectedMerchantId: input.selectedMerchantId,
      planVersion: input.planVersion,
      planHash: input.planHash,
    });
    const resolutionEvidence = {
      conflictId: conflict.id,
      transactionId: conflict.transactionId,
      candidateMerchantIds,
      supportingEvidence,
      conflictingEvidence,
      conflictEvidenceHash: conflict.evidenceHash,
      conflictStateHash: input.conflictStateHash,
      intent: input.intent,
      selectedMerchantId: input.selectedMerchantId,
      planVersion: input.planVersion,
      planHash: input.planHash,
      requestHash,
      actorId: actor.actorId,
      reason: input.reason,
    };
    const resolutionEvidenceHash = hashEvidence(resolutionEvidence);
    const decisionEvidence = {
      confirmationSchemaVersion: CONFIRMATION_SCHEMA_VERSION,
      requestHash,
      intent: input.intent,
      planVersion: input.planVersion,
      planHash: input.planHash,
      conflictStateHash: input.conflictStateHash,
      conflictEvidenceHash: input.conflictEvidenceHash,
      resolutionId,
      resolutionInputHash: inputHash,
      resolutionEvidence,
      warnings: plan.validationWarnings,
      blockingErrors: plan.blockingErrors,
      supportingEvidence: plan.supportingEvidence,
      conflictingEvidence: plan.conflictingEvidence,
      rollbackPlan: plan.rollbackPlan,
      sideEffects: {
        trustsAliases: false,
        trustsFingerprints: false,
        mutatesMerchants: false,
        createsTransactionBooking: false,
        mutatesBankFacts: false,
      },
    };
    const evidenceHash = hashEvidence(decisionEvidence);

    if (resolutionId) {
      await tx.merchantResolution.create({
        data: {
          id: resolutionId,
          workspaceId,
          transactionId: conflict.transactionId,
          merchantId: input.selectedMerchantId,
          status: input.intent === 'ABSTAIN'
            ? MerchantResolutionStatus.ABSTAINED
            : MerchantResolutionStatus.RESOLVED,
          engineVersion: ENGINE_VERSION,
          inputHash,
          evidence: toInputJson(resolutionEvidence),
          evidenceHash: resolutionEvidenceHash,
          confidenceBasisPoints: null,
          abstentionCode: input.intent === 'ABSTAIN' ? 'ADMIN_CONFIRMED_ABSTENTION' : null,
          validUntil: null,
          backfillRunId: null,
        },
      });
    }
    await tx.merchantConflict.update({
      where: { id: conflict.id },
      data: {
        status: newStatus,
        resolutionId,
        resolvedAt,
        resolvedById: actor.actorId,
        resolutionReason: input.reason,
      },
    });
    await tx.merchantIdentityDecision.create({
      data: {
        id: decisionId,
        workspaceId,
        action: 'RESOLVE_CONFLICT',
        targetMerchantId: input.selectedMerchantId,
        conflictId: conflict.id,
        actorId: actor.actorId,
        reason: input.reason,
        beforeState: toInputJson(plan.beforeState),
        afterState: toInputJson(plan.proposedAfterState),
        evidence: toInputJson(decisionEvidence),
        evidenceHash,
        decisionVersion: plan.planVersion,
      },
    });
    await createMerchantKnowledgeAuditEvent(tx, {
      id: auditEventId,
      workspaceId,
      entityType: 'MERCHANT_CONFLICT',
      entityId: conflict.id,
      action: 'RESOLVE_CONFLICT',
      actorId: actor.actorId,
      requestId: input.requestKey,
      beforeState: plan.beforeState,
      afterState: plan.proposedAfterState,
      evidenceHash,
      schemaVersion: AUDIT_SCHEMA_VERSION,
    });

    return {
      decisionId,
      auditEventId,
      resolutionId,
      conflictId: conflict.id,
      intent: input.intent,
      selectedMerchantId: input.selectedMerchantId,
      priorStatus: MerchantConflictStatus.OPEN,
      newStatus,
      resolvedAt,
      planVersion: plan.planVersion,
      planHash: plan.planHash,
      conflictStateHash: input.conflictStateHash,
      evidenceHash,
      idempotent: false,
      ...MERCHANT_CONFLICT_CONFIRMATION_EFFECTS,
    };
  });
};
