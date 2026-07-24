import type { Prisma, PrismaClient } from '@prisma/client';
import { MerchantStatus } from '@prisma/client';
import { isValidWorkspaceId } from '../../src/utils/auth';
import type { RequestActor } from '../auth/requestContext';
import { prisma } from '../prismaClient';
import {
  MERCHANT_DEPRECATION_CONFIRMATION_EFFECTS,
  isMerchantDeprecationConfirmationEnabled,
} from './merchantKnowledgeCapability';
import { createMerchantKnowledgeAuditEvent } from './merchantKnowledgeAuditService';
import { hashMerchantConfirmationState } from './merchantKnowledgeStateHash';
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
const CONFIRMATION_SCHEMA_VERSION = 'merchant-deprecation-confirmation-v1';
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

export class MerchantDeprecationError extends Error {
  constructor(
    public readonly code:
      | 'disabled'
      | 'misconfigured'
      | 'invalid_input'
      | 'forbidden'
      | 'not_found'
      | 'already_deprecated'
      | 'invalid_state'
      | 'stale_plan'
      | 'blocked'
      | 'idempotency_conflict'
      | 'integrity_error',
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = 'MerchantDeprecationError';
  }
}

export type MerchantDeprecationConfirmationRequest = {
  action: unknown;
  merchantId: unknown;
  planVersion: unknown;
  planHash: unknown;
  expectedStateHash: unknown;
  reason: unknown;
  requestKey: unknown;
};

export type MerchantDeprecationConfirmationResult = {
  decisionId: string;
  auditEventId: string;
  merchantId: string;
  priorStatus: MerchantStatus;
  newStatus: 'DEPRECATED';
  priorVersion: number;
  newVersion: number;
  deprecatedAt: Date;
  planVersion: string;
  planHash: string;
  stateHash: string;
  evidenceHash: string;
  rollbackReference: {
    decisionId: string;
    steps: unknown[];
  };
  idempotent: boolean;
} & typeof MERCHANT_DEPRECATION_CONFIRMATION_EFFECTS;

type ParsedRequest = {
  action: 'DEPRECATE_MERCHANT';
  merchantId: string;
  planVersion: string;
  planHash: string;
  expectedStateHash: string;
  reason: string;
  requestKey: string;
};

const parseString = (value: unknown): string => typeof value === 'string' ? value.trim() : '';

const parseRequest = (input: MerchantDeprecationConfirmationRequest): ParsedRequest => {
  const action = parseString(input.action);
  const merchantId = parseString(input.merchantId);
  const planVersion = parseString(input.planVersion);
  const planHash = parseString(input.planHash).toLowerCase();
  const expectedStateHash = parseString(input.expectedStateHash).toLowerCase();
  const reason = parseString(input.reason);
  const requestKey = parseString(input.requestKey);

  if (action !== 'DEPRECATE_MERCHANT') {
    throw new MerchantDeprecationError('invalid_input', 'Alleen merchantdeprecatie kan in deze bevestigingsroute worden uitgevoerd.', 400);
  }
  if (!merchantId || merchantId.length > MAX_ID_LENGTH) {
    throw new MerchantDeprecationError('invalid_input', 'Een geldig merchant-ID is verplicht.', 400);
  }
  if (!planVersion || planVersion.length > 100) {
    throw new MerchantDeprecationError('invalid_input', 'Een geldige planversie is verplicht.', 400);
  }
  if (!HASH_PATTERN.test(planHash)) {
    throw new MerchantDeprecationError('invalid_input', 'Een geldige plan-hash is verplicht.', 400);
  }
  if (!HASH_PATTERN.test(expectedStateHash)) {
    throw new MerchantDeprecationError('invalid_input', 'Een geldige merchant-state-hash is verplicht.', 400);
  }
  if (!reason || reason.length > MAX_REASON_LENGTH) {
    throw new MerchantDeprecationError('invalid_input', 'Een expliciete reden van maximaal 500 tekens is verplicht.', 400);
  }
  if (!REQUEST_KEY_PATTERN.test(requestKey)) {
    throw new MerchantDeprecationError('invalid_input', 'De request key moet 8–80 veilige tekens bevatten.', 400);
  }

  return {
    action: 'DEPRECATE_MERCHANT',
    merchantId,
    planVersion,
    planHash,
    expectedStateHash,
    reason,
    requestKey,
  };
};

const readEvidenceRecord = (value: Prisma.JsonValue): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};

export const confirmMerchantDeprecation = async (
  actor: RequestActor,
  request: MerchantDeprecationConfirmationRequest,
  client: PrismaClient = prisma,
  env: NodeJS.ProcessEnv = process.env,
): Promise<MerchantDeprecationConfirmationResult> => {
  if (!isMerchantDeprecationConfirmationEnabled(env)) {
    throw new MerchantDeprecationError('disabled', 'Merchantdeprecatiebevestiging is uitgeschakeld.', 503);
  }

  const input = parseRequest(request);
  const workspaceId = env.DEFAULT_WORKSPACE_ID?.trim();
  if (!isValidWorkspaceId(workspaceId)) {
    throw new MerchantDeprecationError('misconfigured', 'Merchant Knowledge-werkruimte is niet geconfigureerd.', 503);
  }

  const requestHash = hashEvidence({
    workspaceId,
    action: input.action,
    merchantId: input.merchantId,
    planVersion: input.planVersion,
    planHash: input.planHash,
    expectedStateHash: input.expectedStateHash,
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
      throw new MerchantDeprecationError('forbidden', 'Geen toegang tot deze financiële werkruimte.', 403);
    }

    const existingDecision = await tx.merchantIdentityDecision.findUnique({
      where: { id: decisionId },
      select: {
        id: true,
        action: true,
        sourceMerchantId: true,
        evidence: true,
        evidenceHash: true,
        decisionVersion: true,
      },
    });
    if (existingDecision) {
      const evidence = readEvidenceRecord(existingDecision.evidence);
      if (
        existingDecision.action !== 'DEPRECATE_MERCHANT'
        || existingDecision.sourceMerchantId !== input.merchantId
        || evidence.requestHash !== requestHash
        || evidence.planHash !== input.planHash
        || evidence.planVersion !== input.planVersion
        || evidence.expectedStateHash !== input.expectedStateHash
      ) {
        throw new MerchantDeprecationError('idempotency_conflict', 'Deze request key is al gebruikt voor andere bevestigingsinhoud.', 409);
      }

      const [existingAudit, currentMerchant] = await Promise.all([
        tx.merchantAuditEvent.findUnique({
          where: { id: auditEventId },
          select: { id: true, evidenceHash: true },
        }),
        tx.merchant.findFirst({
          where: { id: input.merchantId, workspaceId },
          select: {
            status: true,
            version: true,
            deprecatedAt: true,
          },
        }),
      ]);
      if (
        !existingAudit
        || existingAudit.evidenceHash !== existingDecision.evidenceHash
        || !currentMerchant?.deprecatedAt
        || currentMerchant.status !== MerchantStatus.DEPRECATED
      ) {
        throw new MerchantDeprecationError('integrity_error', 'De eerdere merchantdeprecatie is niet volledig terug te vinden.', 500);
      }

      const priorStatus = typeof evidence.priorStatus === 'string'
        ? evidence.priorStatus as MerchantStatus
        : MerchantStatus.PROPOSED;
      const priorVersion = typeof evidence.priorVersion === 'number'
        ? evidence.priorVersion
        : Math.max(1, currentMerchant.version - 1);
      return {
        decisionId: existingDecision.id,
        auditEventId: existingAudit.id,
        merchantId: input.merchantId,
        priorStatus,
        newStatus: 'DEPRECATED',
        priorVersion,
        newVersion: currentMerchant.version,
        deprecatedAt: currentMerchant.deprecatedAt,
        planVersion: existingDecision.decisionVersion,
        planHash: input.planHash,
        stateHash: input.expectedStateHash,
        evidenceHash: existingDecision.evidenceHash,
        rollbackReference: {
          decisionId: existingDecision.id,
          steps: Array.isArray(evidence.rollbackPlan) ? evidence.rollbackPlan : [],
        },
        idempotent: true,
        ...MERCHANT_DEPRECATION_CONFIRMATION_EFFECTS,
      };
    }

    const [merchantRows, aliasRows, fingerprintRows] = await Promise.all([
      tx.merchant.findMany({
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
          createdById: true,
          createdAt: true,
        },
      }),
      tx.merchantAlias.findMany({
        where: { workspaceId },
        select: {
          id: true,
          workspaceId: true,
          merchantId: true,
          signalType: true,
          valueHash: true,
          status: true,
          evidenceHash: true,
        },
      }),
      tx.merchantFingerprint.findMany({
        where: { workspaceId },
        select: {
          id: true,
          workspaceId: true,
          merchantId: true,
          signalType: true,
          valueHash: true,
          strength: true,
          status: true,
          evidenceHash: true,
        },
      }),
    ]);

    const merchant = merchantRows.find((row) => row.id === input.merchantId);
    if (!merchant) {
      throw new MerchantDeprecationError('not_found', 'Merchant niet gevonden in deze werkruimte.', 404);
    }
    if (merchant.status === MerchantStatus.DEPRECATED || merchant.deprecatedAt) {
      throw new MerchantDeprecationError('already_deprecated', 'Deze merchant is al gedeactiveerd.', 409);
    }
    if (merchant.status === MerchantStatus.MERGED || merchant.mergedIntoMerchantId) {
      throw new MerchantDeprecationError('invalid_state', 'Een samengevoegde merchant kan niet afzonderlijk worden gedeactiveerd.', 409);
    }

    const currentStateHash = hashMerchantConfirmationState(merchant);
    if (currentStateHash !== input.expectedStateHash) {
      throw new MerchantDeprecationError('stale_plan', 'De merchantstatus of updateprovenance is gewijzigd. Bouw eerst een nieuwe preview.', 409);
    }

    const aliases: MerchantAliasRecord[] = aliasRows
      .filter((row) => isSupportedSignal(row.signalType))
      .map((row) => ({ ...row, signalType: row.signalType as MerchantFingerprintSignalType }));
    const fingerprints: MerchantFingerprintOwnershipRecord[] = fingerprintRows
      .filter((row) => isSupportedSignal(row.signalType))
      .map((row) => ({ ...row, signalType: row.signalType as MerchantFingerprintSignalType }));
    const plan = planMerchantIdentityChange({
      action: 'DEPRECATE_MERCHANT',
      workspaceId,
      actorId: actor.actorId,
      requestKey: input.requestKey,
      reason: input.reason,
      merchants: merchantRows,
      aliases,
      fingerprints,
      merchantId: input.merchantId,
    });

    if (
      plan.action !== 'DEPRECATE_MERCHANT'
      || plan.workspaceId !== workspaceId
      || plan.planVersion !== input.planVersion
      || plan.planHash !== input.planHash
      || plan.sourceMerchantIds.length !== 1
      || plan.sourceMerchantIds[0] !== input.merchantId
      || plan.targetMerchantIds.length !== 0
      || plan.affectedAliasIds.length !== 0
      || plan.affectedFingerprintIds.length !== 0
    ) {
      throw new MerchantDeprecationError('stale_plan', 'Het previewplan is verouderd of gewijzigd. Bouw eerst een nieuwe preview.', 409);
    }
    if (plan.blockingErrors.length > 0) {
      throw new MerchantDeprecationError('blocked', 'Het plan bevat blokkerende fouten en kan niet worden bevestigd.', 409);
    }

    const priorStatus = merchant.status;
    const priorVersion = merchant.version;
    const newVersion = priorVersion + 1;
    const deprecatedAt = new Date();
    const evidence = {
      confirmationSchemaVersion: CONFIRMATION_SCHEMA_VERSION,
      requestHash,
      requestKey: input.requestKey,
      action: plan.action,
      planVersion: plan.planVersion,
      planHash: plan.planHash,
      expectedStateHash: input.expectedStateHash,
      actor: { actorId: actor.actorId, actorEmail: actor.actorEmail },
      merchant: {
        id: merchant.id,
        priorStatus,
        mergedIntoMerchantId: merchant.mergedIntoMerchantId,
        priorVersion,
        newVersion,
        createdById: merchant.createdById,
        updatedById: merchant.updatedById,
        createdAt: merchant.createdAt,
        updatedAt: merchant.updatedAt,
        deprecatedAt: merchant.deprecatedAt,
      },
      priorStatus,
      priorVersion,
      warnings: plan.validationWarnings,
      blockingErrors: plan.blockingErrors,
      supportingEvidence: plan.supportingEvidence,
      conflictingEvidence: plan.conflictingEvidence,
      rollbackPlan: plan.rollbackPlan,
      sideEffects: {
        cascadesAliases: false,
        cascadesFingerprints: false,
        createsTransactionBooking: false,
        mutatesBankFacts: false,
        mutatesFinancialRecords: false,
      },
    };
    const evidenceHash = hashEvidence(evidence);

    await tx.merchant.update({
      where: { id: merchant.id },
      data: {
        status: MerchantStatus.DEPRECATED,
        deprecatedAt,
        updatedById: actor.actorId,
        version: { increment: 1 },
      },
    });
    await tx.merchantIdentityDecision.create({
      data: {
        id: decisionId,
        workspaceId,
        action: 'DEPRECATE_MERCHANT',
        sourceMerchantId: merchant.id,
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
      entityType: 'MERCHANT',
      entityId: merchant.id,
      action: 'DEPRECATE_MERCHANT',
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
      merchantId: merchant.id,
      priorStatus,
      newStatus: 'DEPRECATED',
      priorVersion,
      newVersion,
      deprecatedAt,
      planVersion: plan.planVersion,
      planHash: plan.planHash,
      stateHash: input.expectedStateHash,
      evidenceHash,
      rollbackReference: { decisionId, steps: plan.rollbackPlan },
      idempotent: false,
      ...MERCHANT_DEPRECATION_CONFIRMATION_EFFECTS,
    };
  });
};
