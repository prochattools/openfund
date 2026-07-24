import fs from 'node:fs';
import path from 'node:path';
import type { PrismaClient } from '@prisma/client';
import { MerchantStatus } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import type { RequestActor } from '../../server/auth/requestContext';
import {
  MerchantDeprecationError,
  confirmMerchantDeprecation,
} from '../../server/services/merchantDeprecationDecisionService';
import { hashMerchantConfirmationState } from '../../server/services/merchantKnowledgeStateHash';
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
  MERCHANT_DEPRECATION_CONFIRMATION_ENABLED: 'true',
} as NodeJS.ProcessEnv;
const reason = 'Deze merchant is aantoonbaar verouderd en mag niet meer actief worden gebruikt.';
const requestKey = 'merchant-deprecate-001';

const merchantDetail = {
  id: 'merchant-1',
  workspaceId,
  status: MerchantStatus.ACTIVE,
  mergedIntoMerchantId: null as string | null,
  version: 4,
  updatedById: 'admin-before',
  updatedAt: new Date('2026-07-22T10:00:00.000Z'),
  deprecatedAt: null as Date | null,
  createdById: 'creator-user',
  createdAt: new Date('2026-07-19T10:00:00.000Z'),
};

const buildPlan = (merchants = [merchantDetail], inputReason = reason, inputRequestKey = requestKey) =>
  planMerchantIdentityChange({
    action: 'DEPRECATE_MERCHANT',
    workspaceId,
    actorId: actor.actorId,
    requestKey: inputRequestKey,
    reason: inputReason,
    merchants,
    aliases: [],
    fingerprints: [],
    merchantId: 'merchant-1',
  });

const buildRequest = (plan = buildPlan(), merchant = merchantDetail, overrides: Record<string, unknown> = {}) => ({
  action: 'DEPRECATE_MERCHANT',
  merchantId: 'merchant-1',
  planVersion: plan.planVersion,
  planHash: plan.planHash,
  expectedStateHash: hashMerchantConfirmationState(merchant),
  reason,
  requestKey,
  ...overrides,
});

type FixtureOptions = {
  membership?: boolean;
  merchantExists?: boolean;
  merchant?: typeof merchantDetail;
  merchantRows?: Array<typeof merchantDetail>;
  failDecisionCreate?: boolean;
  failAuditCreate?: boolean;
  existingDecision?: Record<string, unknown> | null;
  existingAudit?: Record<string, unknown> | null;
};

const makeFixture = (options: FixtureOptions = {}) => {
  const initialMerchant = structuredClone(options.merchant ?? merchantDetail);
  let committed = {
    merchants: options.merchantRows ? structuredClone(options.merchantRows) : [initialMerchant],
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
        merchant: {
          findMany: vi.fn().mockResolvedValue(options.merchantExists === false ? [] : draft.merchants),
          findFirst: vi.fn(async () => options.merchantExists === false ? null : draft.merchants.find((item) => item.id === 'merchant-1') ?? null),
          update: vi.fn(async ({ data }: { data: { status: MerchantStatus; deprecatedAt: Date; updatedById: string; version: { increment: number } } }) => {
            const merchant = draft.merchants.find((item) => item.id === 'merchant-1');
            if (!merchant) throw new Error('merchant missing');
            merchant.status = data.status;
            merchant.deprecatedAt = data.deprecatedAt;
            merchant.updatedById = data.updatedById;
            merchant.updatedAt = new Date('2026-07-24T10:00:00.000Z');
            merchant.version += data.version.increment;
            return merchant;
          }),
          delete: vi.fn(),
          updateMany: vi.fn(),
          deleteMany: vi.fn(),
        },
        merchantAlias: {
          findMany: vi.fn().mockResolvedValue([]),
          update: vi.fn(), create: vi.fn(), delete: vi.fn(), upsert: vi.fn(), updateMany: vi.fn(), deleteMany: vi.fn(),
        },
        merchantFingerprint: {
          findMany: vi.fn().mockResolvedValue([]),
          update: vi.fn(), create: vi.fn(), delete: vi.fn(), upsert: vi.fn(), updateMany: vi.fn(), deleteMany: vi.fn(),
        },
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

describe('Program Phase 3.8D merchant-deprecation confirmation', () => {
  it('defaults confirmation to disabled and opens no transaction', async () => {
    const fixture = makeFixture();
    await expect(confirmMerchantDeprecation(actor, buildRequest(), fixture.client, {})).rejects.toMatchObject<Partial<MerchantDeprecationError>>({ code: 'disabled' });
    expect(fixture.transaction).not.toHaveBeenCalled();
  });

  it('rejects inactive workspace membership before hydration or writes', async () => {
    const fixture = makeFixture({ membership: false });
    await expect(confirmMerchantDeprecation(actor, buildRequest(), fixture.client, enabledEnv)).rejects.toMatchObject({ code: 'forbidden' });
    expect(fixture.tx().merchant.findMany).not.toHaveBeenCalled();
    expect(fixture.tx().merchant.update).not.toHaveBeenCalled();
  });

  it('rejects missing and cross-workspace merchants with zero writes', async () => {
    const fixture = makeFixture({ merchantExists: false });
    await expect(confirmMerchantDeprecation(actor, buildRequest(), fixture.client, enabledEnv)).rejects.toMatchObject({ code: 'not_found' });
    expect(fixture.tx().merchant.update).not.toHaveBeenCalled();
    expect(fixture.tx().merchantIdentityDecision.create).not.toHaveBeenCalled();
    expect(fixture.tx().merchantAuditEvent.create).not.toHaveBeenCalled();
  });

  it('rejects already-deprecated and merged merchant states with zero writes', async () => {
    const deprecated = { ...merchantDetail, status: MerchantStatus.DEPRECATED, deprecatedAt: new Date('2026-07-23T10:00:00.000Z') };
    const merged = { ...merchantDetail, status: MerchantStatus.MERGED, mergedIntoMerchantId: 'merchant-2' };
    for (const scenario of [
      { merchant: deprecated, code: 'already_deprecated' },
      { merchant: merged, code: 'invalid_state' },
    ]) {
      const fixture = makeFixture({ merchant: scenario.merchant });
      await expect(confirmMerchantDeprecation(actor, buildRequest(buildPlan([scenario.merchant]), scenario.merchant), fixture.client, enabledEnv)).rejects.toMatchObject({ code: scenario.code });
      expect(fixture.tx().merchant.update).not.toHaveBeenCalled();
    }
  });

  it('rejects stale hashes, plan versions, and changed state provenance with zero writes', async () => {
    const changed = { ...merchantDetail, version: merchantDetail.version + 1, updatedAt: new Date('2026-07-23T10:00:00.000Z') };
    for (const scenario of [
      { request: buildRequest(buildPlan(), merchantDetail, { planHash: '0'.repeat(64) }), fixture: makeFixture() },
      { request: buildRequest(buildPlan(), merchantDetail, { planVersion: 'merchant-plan-v999' }), fixture: makeFixture() },
      { request: buildRequest(), fixture: makeFixture({ merchant: changed }) },
    ]) {
      await expect(confirmMerchantDeprecation(actor, scenario.request, scenario.fixture.client, enabledEnv)).rejects.toMatchObject({ code: 'stale_plan' });
      expect(scenario.fixture.tx().merchant.update).not.toHaveBeenCalled();
      expect(scenario.fixture.tx().merchantIdentityDecision.create).not.toHaveBeenCalled();
      expect(scenario.fixture.tx().merchantAuditEvent.create).not.toHaveBeenCalled();
    }
  });

  it('rejects planner blocking errors with zero writes', async () => {
    const foreign = { ...merchantDetail, id: 'merchant-foreign', workspaceId: '22222222-2222-4222-8222-222222222222' };
    const rows = [merchantDetail, foreign];
    const blockedPlan = buildPlan(rows);
    const fixture = makeFixture({ merchantRows: rows });
    await expect(confirmMerchantDeprecation(actor, buildRequest(blockedPlan), fixture.client, enabledEnv)).rejects.toMatchObject({ code: 'blocked' });
    expect(fixture.tx().merchant.update).not.toHaveBeenCalled();
  });

  it('soft-deprecates one merchant and atomically writes decision and audit without cascades', async () => {
    const plan = buildPlan();
    const fixture = makeFixture();
    const result = await confirmMerchantDeprecation(actor, buildRequest(plan), fixture.client, enabledEnv);

    expect(result).toMatchObject({
      merchantId: 'merchant-1',
      priorStatus: MerchantStatus.ACTIVE,
      newStatus: 'DEPRECATED',
      priorVersion: 4,
      newVersion: 5,
      planVersion: plan.planVersion,
      planHash: plan.planHash,
      idempotent: false,
      confirmed: true,
      persistsMerchantKnowledge: true,
      writesMerchantIdentityDecision: true,
      writesMerchantAuditEvent: true,
      cascadesAliases: false,
      cascadesFingerprints: false,
      createsTransactionBooking: false,
      mutatesBankFacts: false,
      mutatesFinancialRecords: false,
    });
    const merchant = fixture.state().merchants[0];
    expect(merchant.status).toBe(MerchantStatus.DEPRECATED);
    expect(merchant.deprecatedAt).toBeInstanceOf(Date);
    expect(merchant.version).toBe(5);
    expect(merchant.updatedById).toBe(actor.actorId);
    expect(fixture.tx().merchant.update).toHaveBeenCalledWith({
      where: { id: 'merchant-1' },
      data: {
        status: MerchantStatus.DEPRECATED,
        deprecatedAt: expect.any(Date),
        updatedById: actor.actorId,
        version: { increment: 1 },
      },
    });
    expect(fixture.tx().merchant.delete).not.toHaveBeenCalled();
    expect(fixture.tx().merchant.updateMany).not.toHaveBeenCalled();
    expect(fixture.tx().merchantAlias.update).not.toHaveBeenCalled();
    expect(fixture.tx().merchantFingerprint.update).not.toHaveBeenCalled();
    expect(fixture.tx().merchantIdentityDecision.create).toHaveBeenCalledTimes(1);
    expect(fixture.tx().merchantAuditEvent.create).toHaveBeenCalledTimes(1);
    expect(fixture.state().decision).toMatchObject({
      workspaceId,
      action: 'DEPRECATE_MERCHANT',
      sourceMerchantId: 'merchant-1',
      actorId: actor.actorId,
      reason,
      decisionVersion: plan.planVersion,
    });
    expect(fixture.state().audit).toMatchObject({
      workspaceId,
      entityType: 'MERCHANT',
      entityId: 'merchant-1',
      action: 'DEPRECATE_MERCHANT',
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

  it('rolls back merchant state when decision creation fails', async () => {
    const fixture = makeFixture({ failDecisionCreate: true });
    await expect(confirmMerchantDeprecation(actor, buildRequest(), fixture.client, enabledEnv)).rejects.toThrow('decision create failed');
    expect(fixture.state().merchants[0].status).toBe(MerchantStatus.ACTIVE);
    expect(fixture.state().merchants[0].version).toBe(4);
    expect(fixture.state().decision).toBeNull();
    expect(fixture.state().audit).toBeNull();
  });

  it('rolls back merchant and decision state when audit creation fails', async () => {
    const fixture = makeFixture({ failAuditCreate: true });
    await expect(confirmMerchantDeprecation(actor, buildRequest(), fixture.client, enabledEnv)).rejects.toThrow('audit create failed');
    expect(fixture.state().merchants[0].status).toBe(MerchantStatus.ACTIVE);
    expect(fixture.state().merchants[0].version).toBe(4);
    expect(fixture.state().decision).toBeNull();
    expect(fixture.state().audit).toBeNull();
  });

  it('returns idempotent success for identical content and rejects different content', async () => {
    const plan = buildPlan();
    const request = buildRequest(plan);
    const expectedStateHash = hashMerchantConfirmationState(merchantDetail);
    const requestHash = hashEvidence({
      workspaceId,
      action: 'DEPRECATE_MERCHANT',
      merchantId: 'merchant-1',
      planVersion: plan.planVersion,
      planHash: plan.planHash,
      expectedStateHash,
      reason,
      requestKey,
    });
    const evidenceHash = 'dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd';
    const decisionId = `mk-decision-${hashEvidence({ prefix: 'mk-decision', workspaceId, requestKey }).slice(0, 32)}`;
    const auditEventId = `mk-audit-${hashEvidence({ prefix: 'mk-audit', workspaceId, requestKey }).slice(0, 32)}`;
    const deprecatedMerchant = {
      ...merchantDetail,
      status: MerchantStatus.DEPRECATED,
      version: 5,
      deprecatedAt: new Date('2026-07-24T10:00:00.000Z'),
      updatedById: actor.actorId,
      updatedAt: new Date('2026-07-24T10:00:00.000Z'),
    };
    const fixture = makeFixture({
      merchant: deprecatedMerchant,
      existingDecision: {
        id: decisionId,
        action: 'DEPRECATE_MERCHANT',
        sourceMerchantId: 'merchant-1',
        evidence: { requestHash, planHash: plan.planHash, planVersion: plan.planVersion, expectedStateHash, priorStatus: 'ACTIVE', priorVersion: 4, rollbackPlan: plan.rollbackPlan },
        evidenceHash,
        decisionVersion: plan.planVersion,
      },
      existingAudit: { id: auditEventId, evidenceHash },
    });

    const result = await confirmMerchantDeprecation(actor, request, fixture.client, enabledEnv);
    expect(result.idempotent).toBe(true);
    expect(result.newVersion).toBe(5);
    expect(fixture.tx().merchant.update).not.toHaveBeenCalled();
    expect(fixture.tx().merchantIdentityDecision.create).not.toHaveBeenCalled();
    expect(fixture.tx().merchantAuditEvent.create).not.toHaveBeenCalled();

    await expect(confirmMerchantDeprecation(actor, { ...request, reason: 'Andere bevestigingsinhoud.' }, fixture.client, enabledEnv)).rejects.toMatchObject({ code: 'idempotency_conflict' });
  });

  it('contains no hard delete, cascade, bulk, financial, backfill, AI, or other confirmation action path', () => {
    const source = fs.readFileSync(path.join(process.cwd(), 'server/services/merchantDeprecationDecisionService.ts'), 'utf8');
    expect(source).not.toMatch(/merchant\.delete|deleteMany|updateMany/);
    expect(source).not.toMatch(/merchantAlias\.(create|update|delete|upsert)|merchantFingerprint\.(create|update|delete|upsert)/);
    expect(source).not.toMatch(/transactionBooking\.|categorizationSuggestion\.|reviewDecision\.|ledger\.|periodClose\.|reportSnapshot\./);
    expect(source).not.toMatch(/Bedrock|Claude|OpenAI|backfill/i);
    expect(source).not.toMatch(/MERGE_MERCHANTS|SPLIT_MERCHANT|RESOLVE_CONFLICT|REASSIGN_KNOWLEDGE/);
  });
});
