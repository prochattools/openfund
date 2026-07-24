import type { Prisma, PrismaClient } from '@prisma/client';
import { MerchantAliasStatus } from '@prisma/client';
import { isValidWorkspaceId } from '../../src/utils/auth';
import type { RequestActor } from '../auth/requestContext';
import { prisma } from '../prismaClient';
import {
  MERCHANT_ALIAS_DEPRECATION_CONFIRMATION_EFFECTS,
  isMerchantAliasDeprecationConfirmationEnabled,
} from './merchantKnowledgeCapability';
import { createMerchantKnowledgeAuditEvent } from './merchantKnowledgeAuditService';
import type { MerchantAliasRecord } from './merchantAliasResolver';
import type { MerchantFingerprintSignalType } from './merchantFingerprintExtractor';
import {
  planMerchantIdentityChange,
  type MerchantFingerprintOwnershipRecord,
} from './merchantIdentityPlanService';
import { canonicalizeEvidence, hashEvidence } from './reviewDecisionService';

const REQUEST_KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,79}$/;
const PLAN_HASH_PATTERN = /^[a-f0-9]{64}$/i;
const MAX_REASON_LENGTH = 500;
const MAX_ID_LENGTH = 200;
const CONFIRMATION_SCHEMA_VERSION = 'merchant-alias-deprecation-confirmation-v1';
const AUDIT_SCHEMA_VERSION = 'merchant-audit-v1';
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

const deterministicId = (prefix: 'mk-decision' | 'mk-audit', workspaceId: string, requestKey: string) =>
  `${prefix}-${hashEvidence({ prefix, workspaceId, requestKey }).slice(0, 32)}`;

export class MerchantAliasDeprecationError extends Error {
  constructor(
    public readonly code:
      | 'disabled'
      | 'misconfigured'
      | 'invalid_input'
      | 'forbidden'
      | 'not_found'
      | 'already_deprecated'
      | 'stale_plan'
      | 'blocked'
      | 'idempotency_conflict'
      | 'integrity_error',
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = 'MerchantAliasDeprecationError';
  }
}

export type MerchantAliasDeprecationConfirmationRequest = {
  action: unknown;
  aliasId: unknown;
  planVersion: unknown;
  planHash: unknown;
  expectedEvidenceHash: unknown;
  reason: unknown;
  requestKey: unknown;
};

export type MerchantAliasDeprecationConfirmationResult = {
  decisionId: string;
  auditEventId: string;
  aliasId: string;
  priorStatus: MerchantAliasStatus;
  newStatus: 'DEPRECATED';
  deprecatedAt: Date;
  planVersion: string;
  planHash: string;
  evidenceHash: string;
  rollbackReference: {
    decisionId: string;
    steps: unknown[];
  };
  idempotent: boolean;
} & typeof MERCHANT_ALIAS_DEPRECATION_CONFIRMATION_EFFECTS;

type ParsedRequest = {
  action: 'DEPRECATE_ALIAS';
  aliasId: string;
  planVersion: string;
  planHash: string;
  expectedEvidenceHash: string;
  reason: string;
  requestKey: string;
};

const parseString = (value: unknown): string => typeof value === 'string' ? value.trim() : '';

const parseRequest = (input: MerchantAliasDeprecationConfirmationRequest): ParsedRequest => {
  const action = parseString(input.action);
  const aliasId = parseString(input.aliasId);
  const planVersion = parseString(input.planVersion);
  const planHash = parseString(input.planHash).toLowerCase();
  const expectedEvidenceHash = parseString(input.expectedEvidenceHash).toLowerCase();
  const reason = parseString(input.reason);
  const requestKey = parseString(input.requestKey);

  if (action !== 'DEPRECATE_ALIAS') {
    throw new MerchantAliasDeprecationError('invalid_input', 'Alleen aliasdeprecatie kan in deze bevestigingsroute worden uitgevoerd.', 400);
  }
  if (!aliasId || aliasId.length > MAX_ID_LENGTH) {
    throw new MerchantAliasDeprecationError('invalid_input', 'Een geldig alias-ID is verplicht.', 400);
  }
  if (!planVersion || planVersion.length > 100) {
    throw new MerchantAliasDeprecationError('invalid_input', 'Een geldige planversie is verplicht.', 400);
  }
  if (!PLAN_HASH_PATTERN.test(planHash)) {
    throw new MerchantAliasDeprecationError('invalid_input', 'Een geldige plan-hash is verplicht.', 400);
  }
  if (!PLAN_HASH_PATTERN.test(expectedEvidenceHash)) {
    throw new MerchantAliasDeprecationError('invalid_input', 'Een geldige alias-evidence-hash is verplicht.', 400);
  }
  if (!reason || reason.length > MAX_REASON_LENGTH) {
    throw new MerchantAliasDeprecationError('invalid_input', 'Een expliciete reden van maximaal 500 tekens is verplicht.', 400);
  }
  if (!REQUEST_KEY_PATTERN.test(requestKey)) {
    throw new MerchantAliasDeprecationError('invalid_input', 'De request key moet 8–80 veilige tekens bevatten.', 400);
  }

  return { action: 'DEPRECATE_ALIAS', aliasId, planVersion, planHash, expectedEvidenceHash, reason, requestKey };
};

const readEvidenceRecord = (value: Prisma.JsonValue): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};

export const confirmMerchantAliasDeprecation = async (
  actor: RequestActor,
  request: MerchantAliasDeprecationConfirmationRequest,
  client: PrismaClient = prisma,
  env: NodeJS.ProcessEnv = process.env,
): Promise<MerchantAliasDeprecationConfirmationResult> => {
  if (!isMerchantAliasDeprecationConfirmationEnabled(env)) {
    throw new MerchantAliasDeprecationError('disabled', 'Aliasdeprecatiebevestiging is uitgeschakeld.', 503);
  }

  const input = parseRequest(request);
  const workspaceId = env.DEFAULT_WORKSPACE_ID?.trim();
  if (!isValidWorkspaceId(workspaceId)) {
    throw new MerchantAliasDeprecationError('misconfigured', 'Merchant Knowledge-werkruimte is niet geconfigureerd.', 503);
  }

  const requestHash = hashEvidence({
    workspaceId,
    action: input.action,
    aliasId: input.aliasId,
    planVersion: input.planVersion,
    planHash: input.planHash,
    expectedEvidenceHash: input.expectedEvidenceHash,
    reason: input.reason,
    requestKey: input.requestKey,
  });
  const decisionId = deterministicId('mk-decision', workspaceId, input.requestKey);
  const auditEventId = deterministicId('mk-audit', workspaceId, input.requestKey);

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
      throw new MerchantAliasDeprecationError('forbidden', 'Geen toegang tot deze financiële werkruimte.', 403);
    }

    const existingDecision = await tx.merchantIdentityDecision.findUnique({
      where: { id: decisionId },
      select: {
        id: true,
        aliasId: true,
        evidence: true,
        evidenceHash: true,
        decisionVersion: true,
      },
    });
    if (existingDecision) {
      const evidence = readEvidenceRecord(existingDecision.evidence);
      if (
        evidence.requestHash !== requestHash
        || evidence.planHash !== input.planHash
        || evidence.planVersion !== input.planVersion
        || existingDecision.aliasId !== input.aliasId
      ) {
        throw new MerchantAliasDeprecationError('idempotency_conflict', 'Deze request key is al gebruikt voor andere bevestigingsinhoud.', 409);
      }
      const [existingAudit, currentAlias] = await Promise.all([
        tx.merchantAuditEvent.findUnique({ where: { id: auditEventId }, select: { id: true, evidenceHash: true } }),
        tx.merchantAlias.findFirst({
          where: { id: input.aliasId, workspaceId },
          select: { status: true, deprecatedAt: true },
        }),
      ]);
      if (!existingAudit || existingAudit.evidenceHash !== existingDecision.evidenceHash || !currentAlias?.deprecatedAt || currentAlias.status !== MerchantAliasStatus.DEPRECATED) {
        throw new MerchantAliasDeprecationError('integrity_error', 'De eerdere aliasdeprecatie is niet volledig terug te vinden.', 500);
      }
      const priorStatus = typeof evidence.priorStatus === 'string'
        ? evidence.priorStatus as MerchantAliasStatus
        : MerchantAliasStatus.OBSERVED;
      return {
        decisionId: existingDecision.id,
        auditEventId: existingAudit.id,
        aliasId: input.aliasId,
        priorStatus,
        newStatus: 'DEPRECATED',
        deprecatedAt: currentAlias.deprecatedAt,
        planVersion: existingDecision.decisionVersion,
        planHash: input.planHash,
        evidenceHash: existingDecision.evidenceHash,
        rollbackReference: {
          decisionId: existingDecision.id,
          steps: Array.isArray(evidence.rollbackPlan) ? evidence.rollbackPlan : [],
        },
        idempotent: true,
        ...MERCHANT_ALIAS_DEPRECATION_CONFIRMATION_EFFECTS,
      };
    }

    const [alias, merchantRows, aliasRows, fingerprintRows] = await Promise.all([
      tx.merchantAlias.findFirst({
        where: { id: input.aliasId, workspaceId },
        select: {
          id: true,
          workspaceId: true,
          merchantId: true,
          sourceTransactionId: true,
          signalType: true,
          valueHash: true,
          status: true,
          confidenceBasisPoints: true,
          normalizationVersion: true,
          evidenceHash: true,
          approvedById: true,
          approvedAt: true,
          createdAt: true,
          updatedAt: true,
          deprecatedAt: true,
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

    if (!alias) {
      throw new MerchantAliasDeprecationError('not_found', 'Alias niet gevonden in deze werkruimte.', 404);
    }
    if (alias.status === MerchantAliasStatus.DEPRECATED || alias.deprecatedAt) {
      throw new MerchantAliasDeprecationError('already_deprecated', 'Deze alias is al gedeactiveerd.', 409);
    }
    if (alias.evidenceHash !== input.expectedEvidenceHash) {
      throw new MerchantAliasDeprecationError('stale_plan', 'Het aliasbewijs is gewijzigd. Bouw eerst een nieuwe preview.', 409);
    }
    const priorStatus = alias.status;
    if (!isSupportedSignal(alias.signalType)) {
      throw new MerchantAliasDeprecationError('blocked', 'Deze alias gebruikt een signaaltype dat de huidige planner niet veilig kan bevestigen.', 409);
    }

    const aliases: MerchantAliasRecord[] = aliasRows
      .filter((row) => isSupportedSignal(row.signalType))
      .map((row) => ({ ...row, signalType: row.signalType as MerchantFingerprintSignalType }));
    const fingerprints: MerchantFingerprintOwnershipRecord[] = fingerprintRows
      .filter((row) => isSupportedSignal(row.signalType))
      .map((row) => ({ ...row, signalType: row.signalType as MerchantFingerprintSignalType }));
    const plan = planMerchantIdentityChange({
      action: 'DEPRECATE_ALIAS',
      workspaceId,
      actorId: actor.actorId,
      requestKey: input.requestKey,
      reason: input.reason,
      merchants: merchantRows,
      aliases,
      fingerprints,
      aliasId: input.aliasId,
    });

    if (
      plan.action !== 'DEPRECATE_ALIAS'
      || plan.workspaceId !== workspaceId
      || plan.planVersion !== input.planVersion
      || plan.planHash !== input.planHash
      || plan.affectedAliasIds.length !== 1
      || plan.affectedAliasIds[0] !== input.aliasId
    ) {
      throw new MerchantAliasDeprecationError('stale_plan', 'Het previewplan is verouderd of gewijzigd. Bouw eerst een nieuwe preview.', 409);
    }
    if (plan.blockingErrors.length > 0) {
      throw new MerchantAliasDeprecationError('blocked', 'Het plan bevat blokkerende fouten en kan niet worden bevestigd.', 409);
    }

    const deprecatedAt = new Date();
    const evidence = {
      confirmationSchemaVersion: CONFIRMATION_SCHEMA_VERSION,
      requestHash,
      requestKey: input.requestKey,
      action: plan.action,
      planVersion: plan.planVersion,
      planHash: plan.planHash,
      actor: { actorId: actor.actorId, actorEmail: actor.actorEmail },
      alias: {
        id: alias.id,
        merchantId: alias.merchantId,
        sourceTransactionId: alias.sourceTransactionId,
        signalType: alias.signalType,
        valueHash: alias.valueHash,
        priorStatus: alias.status,
        normalizationVersion: alias.normalizationVersion,
        evidenceHash: alias.evidenceHash,
        confidenceBasisPoints: alias.confidenceBasisPoints,
        approvedById: alias.approvedById,
        approvedAt: alias.approvedAt,
        createdAt: alias.createdAt,
        updatedAt: alias.updatedAt,
      },
      priorStatus: alias.status,
      warnings: plan.validationWarnings,
      blockingErrors: plan.blockingErrors,
      supportingEvidence: plan.supportingEvidence,
      conflictingEvidence: plan.conflictingEvidence,
      rollbackPlan: plan.rollbackPlan,
      sideEffects: {
        createsTransactionBooking: false,
        mutatesBankFacts: false,
        mutatesFinancialRecords: false,
      },
    };
    const evidenceHash = hashEvidence(evidence);

    await tx.merchantAlias.update({
      where: { id: alias.id },
      data: { status: MerchantAliasStatus.DEPRECATED, deprecatedAt },
    });
    await tx.merchantIdentityDecision.create({
      data: {
        id: decisionId,
        workspaceId,
        action: 'DEPRECATE_ALIAS',
        sourceMerchantId: alias.merchantId,
        aliasId: alias.id,
        actorId: actor.actorId,
        reason: input.reason,
        beforeState: toInputJson(plan.beforeState),
        afterState: toInputJson(plan.proposedAfterState),
        evidence: toInputJson(evidence),
        evidenceHash,
        decisionVersion: plan.planVersion,
      },
    });
    await createMerchantKnowledgeAuditEvent(tx, {
      id: auditEventId,
      workspaceId,
      entityType: 'MERCHANT_ALIAS',
      entityId: alias.id,
      action: 'DEPRECATE_ALIAS',
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
      aliasId: alias.id,
      priorStatus,
      newStatus: 'DEPRECATED',
      deprecatedAt,
      planVersion: plan.planVersion,
      planHash: plan.planHash,
      evidenceHash,
      rollbackReference: { decisionId, steps: plan.rollbackPlan },
      idempotent: false,
      ...MERCHANT_ALIAS_DEPRECATION_CONFIRMATION_EFFECTS,
    };
  });
};
