import fs from 'node:fs';
import path from 'node:path';
import type { PrismaClient } from '@prisma/client';
import { MerchantConflictStatus, MerchantResolutionStatus, MerchantStatus } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import type { RequestActor } from '../../server/auth/requestContext';
import {
  MerchantConflictDecisionError,
  confirmMerchantConflictResolution,
  type MerchantConflictIntent,
} from '../../server/services/merchantConflictDecisionService';
import { hashConflictConfirmationState } from '../../server/services/merchantConflictStateHash';
import { planMerchantIdentityChange } from '../../server/services/merchantIdentityPlanService';
import { hashEvidence } from '../../server/services/reviewDecisionService';

const workspaceId = '11111111-1111-4111-8111-111111111111';
const actor: RequestActor = { userId: 'admin-user', role: 'admin', actorId: 'admin-user', actorEmail: 'admin@example.test' };
const enabledEnv = { DEFAULT_WORKSPACE_ID: workspaceId, MERCHANT_CONFLICT_CONFIRMATION_ENABLED: 'true' } as NodeJS.ProcessEnv;
const reason = 'Bevestigde individuele conflictoplossing.';
const requestKey = 'conflict-confirm-001';
const evidenceHash = 'a'.repeat(64);
const evidence = [
  { aliasId: 'alias-1', merchantId: 'merchant-1', signalType: 'IBAN' as const, fingerprintHash: 'b'.repeat(64), aliasStatus: 'TRUSTED' as const, precedence: 10, evidenceHash: 'c'.repeat(64) },
  { aliasId: 'alias-2', merchantId: 'merchant-2', signalType: 'NORMALIZED_COUNTERPARTY' as const, fingerprintHash: 'd'.repeat(64), aliasStatus: 'APPROVED' as const, precedence: 30, evidenceHash: 'e'.repeat(64) },
];
const merchants = [
  { id: 'merchant-1', workspaceId, status: MerchantStatus.ACTIVE, mergedIntoMerchantId: null },
  { id: 'merchant-2', workspaceId, status: MerchantStatus.ACTIVE, mergedIntoMerchantId: null },
];
const baseConflict = {
  id: 'conflict-1', workspaceId, transactionId: 'transaction-1', resolutionId: null as string | null,
  status: MerchantConflictStatus.OPEN, candidateMerchantIds: ['merchant-2', 'merchant-1'],
  supportingSignals: evidence.slice(0, 1), conflictingSignals: evidence,
  evidenceHash, openedAt: new Date('2026-07-20T10:00:00.000Z'), resolvedAt: null as Date | null,
  resolvedById: null as string | null, resolutionReason: null as string | null,
};

const buildPlan = (intent: MerchantConflictIntent, selectedMerchantId?: string) => planMerchantIdentityChange({
  action: 'RESOLVE_CONFLICT', workspaceId, actorId: actor.actorId, requestKey, reason,
  merchants, aliases: [], fingerprints: [], intent, selectedMerchantId,
  resolution: {
    workspaceId, resolutionVersion: 'merchant-alias-resolution-v1', status: 'CONFLICTED', merchantId: null,
    strongestSignalType: null, reason: 'STRONGEST_SIGNAL_COLLISION', supportingEvidence: evidence.slice(0, 1), conflictingEvidence: evidence,
  },
  conflictingEvidence: evidence,
});
const stateHash = (conflict = baseConflict) => hashConflictConfirmationState({
  ...conflict, candidateMerchantIds: ['merchant-1', 'merchant-2'], supportingEvidence: evidence.slice(0, 1), conflictingEvidence: evidence,
});
const buildRequest = (intent: MerchantConflictIntent, selectedMerchantId?: string, overrides: Record<string, unknown> = {}) => {
  const plan = buildPlan(intent, selectedMerchantId);
  return {
    action: 'RESOLVE_CONFLICT', conflictId: 'conflict-1', intent, selectedMerchantId,
    planVersion: plan.planVersion, planHash: plan.planHash, conflictStateHash: stateHash(),
    conflictEvidenceHash: evidenceHash, reason, requestKey, ...overrides,
  };
};

type Options = { conflict?: typeof baseConflict | null; membership?: boolean; failResolution?: boolean; failDecision?: boolean; failAudit?: boolean; existingDecision?: any; existingAudit?: any; existingResolution?: any };
const fixture = (options: Options = {}) => {
  let committed = { conflict: structuredClone(options.conflict === undefined ? baseConflict : options.conflict), decision: options.existingDecision ?? null, audit: options.existingAudit ?? null, resolution: options.existingResolution ?? null };
  let latestTx: any;
  const client = { $transaction: vi.fn(async (callback: (tx: any) => Promise<any>) => {
    const draft = structuredClone(committed);
    const tx = {
      workspaceMembership: { findFirst: vi.fn().mockResolvedValue(options.membership === false ? null : { id: 'membership-1' }) },
      merchantConflict: {
        findFirst: vi.fn(async () => draft.conflict),
        update: vi.fn(async ({ data }: any) => { Object.assign(draft.conflict, data); return draft.conflict; }),
        delete: vi.fn(), updateMany: vi.fn(), deleteMany: vi.fn(),
      },
      merchant: { findMany: vi.fn().mockResolvedValue(merchants), update: vi.fn(), create: vi.fn(), delete: vi.fn() },
      merchantAlias: { findMany: vi.fn().mockResolvedValue([]), update: vi.fn(), create: vi.fn(), delete: vi.fn(), upsert: vi.fn() },
      merchantFingerprint: { findMany: vi.fn().mockResolvedValue([]), update: vi.fn(), create: vi.fn(), delete: vi.fn(), upsert: vi.fn() },
      merchantResolution: {
        findUnique: vi.fn(async () => draft.resolution),
        create: vi.fn(async ({ data }: any) => { if (options.failResolution) throw new Error('resolution failed'); draft.resolution = data; return data; }),
        update: vi.fn(), delete: vi.fn(),
      },
      merchantIdentityDecision: {
        findUnique: vi.fn(async () => draft.decision),
        create: vi.fn(async ({ data }: any) => { if (options.failDecision) throw new Error('decision failed'); draft.decision = data; return data; }),
      },
      merchantAuditEvent: {
        findUnique: vi.fn(async () => draft.audit),
        create: vi.fn(async ({ data }: any) => { if (options.failAudit) throw new Error('audit failed'); draft.audit = data; return data; }),
      },
      transaction: { update: vi.fn(), create: vi.fn(), delete: vi.fn() },
      transactionBooking: { update: vi.fn(), create: vi.fn(), delete: vi.fn() },
      reviewDecision: { update: vi.fn(), create: vi.fn(), delete: vi.fn() },
      categorizationSuggestion: { update: vi.fn(), create: vi.fn(), delete: vi.fn() },
      ledger: { update: vi.fn(), create: vi.fn(), delete: vi.fn() }, periodClose: { update: vi.fn(), create: vi.fn(), delete: vi.fn() }, reportSnapshot: { update: vi.fn(), create: vi.fn(), delete: vi.fn() },
    };
    latestTx = tx;
    const result = await callback(tx);
    committed = draft;
    return result;
  }) };
  return { client: client as unknown as PrismaClient, transaction: client.$transaction, tx: () => latestTx, state: () => committed };
};

describe('Phase 3.8D conflict confirmation', () => {
  it('is disabled by default and opens no transaction', async () => {
    const f = fixture();
    await expect(confirmMerchantConflictResolution(actor, buildRequest('DISMISS'), f.client, {})).rejects.toMatchObject<Partial<MerchantConflictDecisionError>>({ code: 'disabled' });
    expect(f.transaction).not.toHaveBeenCalled();
  });

  it('rejects missing membership, missing conflicts, finalized conflicts, and stale state with zero writes', async () => {
    const scenarios = [
      { f: fixture({ membership: false }), code: 'forbidden', req: buildRequest('DISMISS') },
      { f: fixture({ conflict: null }), code: 'not_found', req: buildRequest('DISMISS') },
      { f: fixture({ conflict: { ...baseConflict, status: MerchantConflictStatus.RESOLVED, resolvedAt: new Date() } }), code: 'finalized', req: buildRequest('DISMISS') },
      { f: fixture(), code: 'stale_plan', req: buildRequest('DISMISS', undefined, { conflictStateHash: 'f'.repeat(64) }) },
    ];
    for (const item of scenarios) {
      await expect(confirmMerchantConflictResolution(actor, item.req, item.f.client, enabledEnv)).rejects.toMatchObject({ code: item.code });
      if (item.f.tx()) expect(item.f.tx().merchantConflict.update).not.toHaveBeenCalled();
    }
  });

  it('requires a valid active selected merchant from candidates and preserved evidence', async () => {
    await expect(confirmMerchantConflictResolution(actor, buildRequest('SELECT_MERCHANT'), fixture().client, enabledEnv)).rejects.toMatchObject({ code: 'invalid_input' });
    await expect(confirmMerchantConflictResolution(actor, buildRequest('SELECT_MERCHANT', 'merchant-3'), fixture().client, enabledEnv)).rejects.toMatchObject({ code: 'invalid_selection' });
  });

  it.each([
    ['SELECT_MERCHANT', 'merchant-1', MerchantConflictStatus.RESOLVED, MerchantResolutionStatus.RESOLVED],
    ['ABSTAIN', undefined, MerchantConflictStatus.RESOLVED, MerchantResolutionStatus.ABSTAINED],
    ['DISMISS', undefined, MerchantConflictStatus.DISMISSED, null],
  ] as const)('persists the approved %s mapping atomically', async (intent, selectedMerchantId, expectedStatus, expectedResolutionStatus) => {
    const f = fixture();
    const result = await confirmMerchantConflictResolution(actor, buildRequest(intent, selectedMerchantId), f.client, enabledEnv);
    expect(result).toMatchObject({ intent, selectedMerchantId: selectedMerchantId ?? null, priorStatus: 'OPEN', newStatus: expectedStatus, idempotent: false, trustsAliases: false, trustsFingerprints: false, mutatesMerchants: false, createsTransactionBooking: false, mutatesBankFacts: false });
    expect(f.state().conflict).toMatchObject({ status: expectedStatus, resolvedById: actor.actorId, resolutionReason: reason, resolutionId: intent === 'DISMISS' ? null : expect.any(String) });
    if (expectedResolutionStatus) expect(f.state().resolution).toMatchObject({ status: expectedResolutionStatus, merchantId: selectedMerchantId ?? null, engineVersion: 'merchant-admin-conflict-resolution-v1' });
    else expect(f.state().resolution).toBeNull();
    expect(f.state().decision).toMatchObject({ action: 'RESOLVE_CONFLICT', conflictId: 'conflict-1', targetMerchantId: selectedMerchantId ?? null });
    expect(f.state().audit).toMatchObject({ entityType: 'MERCHANT_CONFLICT', entityId: 'conflict-1', action: 'RESOLVE_CONFLICT' });
    expect(f.tx().merchantAlias.update).not.toHaveBeenCalled();
    expect(f.tx().merchantFingerprint.update).not.toHaveBeenCalled();
    expect(f.tx().merchant.update).not.toHaveBeenCalled();
  });

  it.each(['failResolution', 'failDecision', 'failAudit'] as const)('rolls back every write when %s occurs', async (failure) => {
    const f = fixture({ [failure]: true });
    await expect(confirmMerchantConflictResolution(actor, buildRequest('SELECT_MERCHANT', 'merchant-1'), f.client, enabledEnv)).rejects.toThrow();
    expect(f.state().conflict.status).toBe(MerchantConflictStatus.OPEN);
    expect(f.state().resolution).toBeNull();
    expect(f.state().decision).toBeNull();
    expect(f.state().audit).toBeNull();
  });

  it('returns idempotent success and rejects conflicting request-key reuse', async () => {
    const request = buildRequest('ABSTAIN');
    const requestHash = hashEvidence({ workspaceId, conflictId: 'conflict-1', intent: 'ABSTAIN', selectedMerchantId: null, conflictStateHash: request.conflictStateHash, conflictEvidenceHash: evidenceHash, planVersion: request.planVersion, planHash: request.planHash, reason, requestKey });
    const decisionId = `mk-decision-${hashEvidence({ prefix: 'mk-decision', workspaceId, requestKey }).slice(0, 32)}`;
    const auditEventId = `mk-audit-${hashEvidence({ prefix: 'mk-audit', workspaceId, requestKey }).slice(0, 32)}`;
    const resolutionId = `mk-resolution-${hashEvidence({ prefix: 'mk-resolution', workspaceId, requestKey }).slice(0, 32)}`;
    const storedEvidenceHash = '9'.repeat(64);
    const f = fixture({
      conflict: { ...baseConflict, status: MerchantConflictStatus.RESOLVED, resolutionId, resolvedAt: new Date('2026-07-24T10:00:00.000Z'), resolvedById: actor.actorId, resolutionReason: reason },
      existingDecision: { id: decisionId, action: 'RESOLVE_CONFLICT', conflictId: 'conflict-1', targetMerchantId: null, evidence: { requestHash, intent: 'ABSTAIN', planHash: request.planHash, planVersion: request.planVersion }, evidenceHash: storedEvidenceHash, decisionVersion: request.planVersion },
      existingAudit: { id: auditEventId, evidenceHash: storedEvidenceHash },
      existingResolution: { id: resolutionId, status: MerchantResolutionStatus.ABSTAINED, merchantId: null, evidenceHash: storedEvidenceHash },
    });
    const result = await confirmMerchantConflictResolution(actor, request, f.client, enabledEnv);
    expect(result.idempotent).toBe(true);
    expect(f.tx().merchantConflict.update).not.toHaveBeenCalled();
    await expect(confirmMerchantConflictResolution(actor, { ...request, reason: 'Andere inhoud.' }, f.client, enabledEnv)).rejects.toMatchObject({ code: 'idempotency_conflict' });
  });

  it('contains no hard delete, bulk, other action, trust, financial, AI, or backfill mutation path', () => {
    const source = fs.readFileSync(path.join(process.cwd(), 'server/services/merchantConflictDecisionService.ts'), 'utf8');
    expect(source).not.toMatch(/deleteMany|updateMany|merchantConflict\.delete|merchantResolution\.update/);
    expect(source).not.toMatch(/merchantAlias\.(create|update|delete|upsert)|merchantFingerprint\.(create|update|delete|upsert)|merchant\.(create|update|delete)/);
    expect(source).not.toMatch(/transactionBooking\.|reviewDecision\.|categorizationSuggestion\.|ledger\.|periodClose\.|reportSnapshot\./);
    expect(source).not.toMatch(/MERGE_MERCHANTS|SPLIT_MERCHANT|REASSIGN_KNOWLEDGE|OpenAI|Claude|Bedrock/i);
    expect(source).toContain('backfillRunId: null');
    expect(source.split('\n').filter((line) => line.includes('backfillRunId:'))).toEqual([
      expect.stringMatching(/backfillRunId:\s*null/),
    ]);
  });
});
