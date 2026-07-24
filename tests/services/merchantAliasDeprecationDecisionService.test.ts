import fs from 'node:fs';
import path from 'node:path';
import type { PrismaClient } from '@prisma/client';
import { MerchantAliasStatus } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import type { RequestActor } from '../../server/auth/requestContext';
import {
  MerchantAliasDeprecationError,
  confirmMerchantAliasDeprecation,
} from '../../server/services/merchantAliasDeprecationDecisionService';
import { planMerchantIdentityChange } from '../../server/services/merchantIdentityPlanService';
import { hashEvidence } from '../../server/services/reviewDecisionService';

const workspaceId = '11111111-1111-4111-8111-111111111111';
const actor: RequestActor = {
  userId: 'admin-user',
  role: 'admin',
  actorId: 'admin-user',
  actorEmail: 'admin@example.test',
};
const enabledEnv = {
  DEFAULT_WORKSPACE_ID: workspaceId,
  MERCHANT_ALIAS_DEPRECATION_CONFIRMATION_ENABLED: 'true',
} as NodeJS.ProcessEnv;
const reason = 'Deze alias is aantoonbaar verouderd en mag niet meer matchen.';
const requestKey = 'alias-deprecate-001';

const merchantRows = [
  { id: 'merchant-1', workspaceId, status: 'ACTIVE' as const, mergedIntoMerchantId: null },
];
const plannerAlias = {
  id: 'alias-1',
  workspaceId,
  merchantId: 'merchant-1',
  signalType: 'IBAN' as const,
  valueHash: 'alias-value-hash',
  status: 'TRUSTED' as const,
  evidenceHash: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
};
const aliasDetail = {
  ...plannerAlias,
  sourceTransactionId: 'transaction-source-1',
  confidenceBasisPoints: 9900,
  normalizationVersion: 'merchant-normalization-v1',
  approvedById: 'admin-user',
  approvedAt: new Date('2026-07-20T10:00:00.000Z'),
  createdAt: new Date('2026-07-19T10:00:00.000Z'),
  updatedAt: new Date('2026-07-20T10:00:00.000Z'),
  deprecatedAt: null as Date | null,
};

const buildPlan = (aliases = [plannerAlias], inputReason = reason, inputRequestKey = requestKey) =>
  planMerchantIdentityChange({
    action: 'DEPRECATE_ALIAS',
    workspaceId,
    actorId: actor.actorId,
    requestKey: inputRequestKey,
    reason: inputReason,
    merchants: merchantRows,
    aliases,
    fingerprints: [],
    aliasId: 'alias-1',
  });

const buildRequest = (plan = buildPlan(), overrides: Record<string, unknown> = {}) => ({
  action: 'DEPRECATE_ALIAS',
  aliasId: 'alias-1',
  planVersion: plan.planVersion,
  planHash: plan.planHash,
  expectedEvidenceHash: plannerAlias.evidenceHash,
  reason,
  requestKey,
  ...overrides,
});

type FixtureOptions = {
  membership?: boolean;
  aliasExists?: boolean;
  aliasStatus?: MerchantAliasStatus;
  aliasEvidenceHash?: string;
  plannerAliases?: typeof plannerAlias[];
  failDecisionCreate?: boolean;
  failAuditCreate?: boolean;
  existingDecision?: Record<string, unknown> | null;
  existingAudit?: Record<string, unknown> | null;
};

const makeFixture = (options: FixtureOptions = {}) => {
  let committed = {
    alias: {
      ...aliasDetail,
      status: options.aliasStatus ?? MerchantAliasStatus.TRUSTED,
      evidenceHash: options.aliasEvidenceHash ?? aliasDetail.evidenceHash,
      deprecatedAt: options.aliasStatus === MerchantAliasStatus.DEPRECATED
        ? new Date('2026-07-21T12:00:00.000Z')
        : null,
    },
    decision: options.existingDecision ?? null,
    audit: options.existingAudit ?? null,
  };

  let latestTx: Record<string, any> | null = null;
  const client = {
    $transaction: vi.fn(async (callback: (tx: Record<string, any>) => Promise<unknown>) => {
      const draft = structuredClone(committed);
      const tx = {
        workspaceMembership: {
          findFirst: vi.fn().mockResolvedValue(options.membership === false ? null : { id: 'membership-1' }),
        },
        merchant: { findMany: vi.fn().mockResolvedValue(merchantRows) },
        merchantAlias: {
          findFirst: vi.fn(async () => options.aliasExists === false ? null : draft.alias),
          findMany: vi.fn().mockResolvedValue(options.plannerAliases ?? [{
            id: draft.alias.id,
            workspaceId: draft.alias.workspaceId,
            merchantId: draft.alias.merchantId,
            signalType: draft.alias.signalType,
            valueHash: draft.alias.valueHash,
            status: draft.alias.status,
            evidenceHash: draft.alias.evidenceHash,
          }]),
          update: vi.fn(async ({ data }: { data: { status: MerchantAliasStatus; deprecatedAt: Date } }) => {
            draft.alias.status = data.status;
            draft.alias.deprecatedAt = data.deprecatedAt;
            return draft.alias;
          }),
          delete: vi.fn(),
        },
        merchantFingerprint: { findMany: vi.fn().mockResolvedValue([]) },
        merchantIdentityDecision: {
          findUnique: vi.fn().mockImplementation(async () => draft.decision),
          create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
            if (options.failDecisionCreate) throw new Error('decision create failed');
            draft.decision = data;
            return data;
          }),
        },
        merchantAuditEvent: {
          findUnique: vi.fn().mockImplementation(async () => draft.audit),
          create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
            if (options.failAuditCreate) throw new Error('audit create failed');
            draft.audit = data;
            return data;
          }),
        },
        transaction: { update: vi.fn(), create: vi.fn(), delete: vi.fn() },
        transactionBooking: { update: vi.fn(), create: vi.fn(), delete: vi.fn() },
        reviewDecision: { update: vi.fn(), create: vi.fn(), delete: vi.fn() },
        categorizationSuggestion: { update: vi.fn(), create: vi.fn(), delete: vi.fn() },
        ledger: { update: vi.fn(), create: vi.fn(), delete: vi.fn() },
        periodClose: { update: vi.fn(), create: vi.fn(), delete: vi.fn() },
        reportSnapshot: { update: vi.fn(), create: vi.fn(), delete: vi.fn() },
      };
      latestTx = tx;
      const result = await callback(tx);
      committed = draft;
      return result;
    }),
  };

  return {
    client: client as unknown as PrismaClient,
    state: () => committed,
    tx: () => latestTx as Record<string, any>,
    transaction: client.$transaction,
  };
};

describe('Program Phase 3.8D alias-deprecation confirmation', () => {
  it('defaults confirmation to disabled and performs no transaction or hydration', async () => {
    const fixture = makeFixture();
    await expect(confirmMerchantAliasDeprecation(actor, buildRequest(), fixture.client, {})).rejects.toMatchObject<Partial<MerchantAliasDeprecationError>>({ code: 'disabled' });
    expect(fixture.transaction).not.toHaveBeenCalled();
  });

  it('rejects inactive workspace membership before Merchant Knowledge hydration or writes', async () => {
    const fixture = makeFixture({ membership: false });
    await expect(confirmMerchantAliasDeprecation(actor, buildRequest(), fixture.client, enabledEnv)).rejects.toMatchObject({ code: 'forbidden' });
    expect(fixture.tx().merchantAlias.findFirst).not.toHaveBeenCalled();
    expect(fixture.tx().merchantAlias.update).not.toHaveBeenCalled();
  });

  it('rejects a missing or cross-workspace alias with zero writes', async () => {
    const fixture = makeFixture({ aliasExists: false });
    await expect(confirmMerchantAliasDeprecation(actor, buildRequest(), fixture.client, enabledEnv)).rejects.toMatchObject({ code: 'not_found' });
    expect(fixture.tx().merchantAlias.update).not.toHaveBeenCalled();
    expect(fixture.tx().merchantIdentityDecision.create).not.toHaveBeenCalled();
    expect(fixture.tx().merchantAuditEvent.create).not.toHaveBeenCalled();
  });

  it('rejects an already-deprecated alias with zero writes', async () => {
    const fixture = makeFixture({ aliasStatus: MerchantAliasStatus.DEPRECATED });
    await expect(confirmMerchantAliasDeprecation(actor, buildRequest(), fixture.client, enabledEnv)).rejects.toMatchObject({ code: 'already_deprecated' });
    expect(fixture.tx().merchantAlias.update).not.toHaveBeenCalled();
  });

  it('rejects stale plan hashes, version mismatches, and changed evidence with zero writes', async () => {
    for (const scenario of [
      { request: buildRequest(buildPlan(), { planHash: '0'.repeat(64) }), fixture: makeFixture() },
      { request: buildRequest(buildPlan(), { planVersion: 'merchant-plan-v999' }), fixture: makeFixture() },
      { request: buildRequest(buildPlan()), fixture: makeFixture({ aliasEvidenceHash: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb' }) },
    ]) {
      await expect(confirmMerchantAliasDeprecation(actor, scenario.request, scenario.fixture.client, enabledEnv)).rejects.toMatchObject({ code: 'stale_plan' });
      expect(scenario.fixture.tx().merchantAlias.update).not.toHaveBeenCalled();
      expect(scenario.fixture.tx().merchantIdentityDecision.create).not.toHaveBeenCalled();
      expect(scenario.fixture.tx().merchantAuditEvent.create).not.toHaveBeenCalled();
    }
  });

  it('rejects planner blocking errors with zero writes', async () => {
    const blockedPlan = buildPlan([]);
    const fixture = makeFixture({ plannerAliases: [] });
    await expect(confirmMerchantAliasDeprecation(actor, buildRequest(blockedPlan), fixture.client, enabledEnv)).rejects.toMatchObject({ code: 'blocked' });
    expect(fixture.tx().merchantAlias.update).not.toHaveBeenCalled();
  });

  it('soft-deprecates exactly one alias and atomically writes decision and audit evidence', async () => {
    const plan = buildPlan();
    const fixture = makeFixture();
    const result = await confirmMerchantAliasDeprecation(actor, buildRequest(plan), fixture.client, enabledEnv);

    expect(result).toMatchObject({
      aliasId: 'alias-1',
      priorStatus: MerchantAliasStatus.TRUSTED,
      newStatus: 'DEPRECATED',
      planVersion: plan.planVersion,
      planHash: plan.planHash,
      idempotent: false,
      confirmed: true,
      persistsMerchantKnowledge: true,
      writesMerchantIdentityDecision: true,
      writesMerchantAuditEvent: true,
      createsTransactionBooking: false,
      mutatesBankFacts: false,
      mutatesFinancialRecords: false,
    });
    expect(fixture.state().alias.status).toBe(MerchantAliasStatus.DEPRECATED);
    expect(fixture.state().alias.deprecatedAt).toBeInstanceOf(Date);
    expect(fixture.tx().merchantAlias.update).toHaveBeenCalledWith({
      where: { id: 'alias-1' },
      data: { status: MerchantAliasStatus.DEPRECATED, deprecatedAt: expect.any(Date) },
    });
    expect(fixture.tx().merchantAlias.delete).not.toHaveBeenCalled();
    expect(fixture.tx().merchantIdentityDecision.create).toHaveBeenCalledTimes(1);
    expect(fixture.tx().merchantAuditEvent.create).toHaveBeenCalledTimes(1);
    expect(fixture.state().decision).toMatchObject({
      workspaceId,
      action: 'DEPRECATE_ALIAS',
      aliasId: 'alias-1',
      actorId: actor.actorId,
      reason,
      decisionVersion: plan.planVersion,
    });
    expect(fixture.state().audit).toMatchObject({
      workspaceId,
      entityType: 'MERCHANT_ALIAS',
      entityId: 'alias-1',
      action: 'DEPRECATE_ALIAS',
      actorId: actor.actorId,
      requestId: requestKey,
      evidenceHash: result.evidenceHash,
    });
    for (const model of ['transaction', 'transactionBooking', 'reviewDecision', 'categorizationSuggestion', 'ledger', 'periodClose', 'reportSnapshot']) {
      expect(fixture.tx()[model].update).not.toHaveBeenCalled();
      expect(fixture.tx()[model].create).not.toHaveBeenCalled();
      expect(fixture.tx()[model].delete).not.toHaveBeenCalled();
    }
  });

  it('rolls back alias state when decision creation fails', async () => {
    const fixture = makeFixture({ failDecisionCreate: true });
    await expect(confirmMerchantAliasDeprecation(actor, buildRequest(), fixture.client, enabledEnv)).rejects.toThrow('decision create failed');
    expect(fixture.state().alias.status).toBe(MerchantAliasStatus.TRUSTED);
    expect(fixture.state().decision).toBeNull();
    expect(fixture.state().audit).toBeNull();
  });

  it('rolls back alias and decision state when audit creation fails', async () => {
    const fixture = makeFixture({ failAuditCreate: true });
    await expect(confirmMerchantAliasDeprecation(actor, buildRequest(), fixture.client, enabledEnv)).rejects.toThrow('audit create failed');
    expect(fixture.state().alias.status).toBe(MerchantAliasStatus.TRUSTED);
    expect(fixture.state().decision).toBeNull();
    expect(fixture.state().audit).toBeNull();
  });

  it('returns idempotent success for the same request and rejects different content', async () => {
    const plan = buildPlan();
    const request = buildRequest(plan);
    const requestHash = hashEvidence({
      workspaceId,
      action: 'DEPRECATE_ALIAS',
      aliasId: 'alias-1',
      planVersion: plan.planVersion,
      planHash: plan.planHash,
      expectedEvidenceHash: plannerAlias.evidenceHash,
      reason,
      requestKey,
    });
    const evidenceHash = 'cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc';
    const decisionId = `mk-decision-${hashEvidence({ prefix: 'mk-decision', workspaceId, requestKey }).slice(0, 32)}`;
    const auditEventId = `mk-audit-${hashEvidence({ prefix: 'mk-audit', workspaceId, requestKey }).slice(0, 32)}`;
    const fixture = makeFixture({
      aliasStatus: MerchantAliasStatus.DEPRECATED,
      existingDecision: {
        id: decisionId,
        aliasId: 'alias-1',
        evidence: { requestHash, planHash: plan.planHash, planVersion: plan.planVersion, priorStatus: 'TRUSTED', rollbackPlan: plan.rollbackPlan },
        evidenceHash,
        decisionVersion: plan.planVersion,
      },
      existingAudit: { id: auditEventId, evidenceHash },
    });

    const result = await confirmMerchantAliasDeprecation(actor, request, fixture.client, enabledEnv);
    expect(result.idempotent).toBe(true);
    expect(fixture.tx().merchantAlias.update).not.toHaveBeenCalled();
    expect(fixture.tx().merchantIdentityDecision.create).not.toHaveBeenCalled();
    expect(fixture.tx().merchantAuditEvent.create).not.toHaveBeenCalled();

    await expect(confirmMerchantAliasDeprecation(actor, { ...request, reason: 'Andere bevestigingsinhoud.' }, fixture.client, enabledEnv)).rejects.toMatchObject({ code: 'idempotency_conflict' });
  });

  it('contains no hard delete, bulk action, booking, bank-fact, suggestion, review, ledger, period, report, backfill, or AI mutation path', () => {
    const source = fs.readFileSync(path.join(process.cwd(), 'server/services/merchantAliasDeprecationDecisionService.ts'), 'utf8');
    expect(source).not.toMatch(/merchantAlias\.delete|deleteMany|updateMany/);
    expect(source).not.toMatch(/transactionBooking\.|categorizationSuggestion\.|reviewDecision\.|ledger\.|periodClose\.|reportSnapshot\./);
    expect(source).not.toMatch(/Bedrock|Claude|OpenAI|backfill/i);
    expect(source).not.toMatch(/MERGE_MERCHANTS|SPLIT_MERCHANT|RESOLVE_CONFLICT|REASSIGN_KNOWLEDGE|DEPRECATE_MERCHANT/);
  });
});
