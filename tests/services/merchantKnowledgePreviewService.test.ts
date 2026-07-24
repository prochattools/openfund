import fs from 'node:fs';
import path from 'node:path';
import type { PrismaClient } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import type { RequestActor } from '../../server/auth/requestContext';
import {
  MerchantKnowledgePreviewError,
  previewMerchantKnowledgePlan,
} from '../../server/services/merchantKnowledgePreviewService';
import { isMerchantKnowledgePreviewEnabled } from '../../server/services/merchantKnowledgeCapability';

const workspaceId = '11111111-1111-4111-8111-111111111111';
const env = { MERCHANT_KNOWLEDGE_PREVIEWS_ENABLED: 'true', DEFAULT_WORKSPACE_ID: workspaceId } as NodeJS.ProcessEnv;
const admin: RequestActor = { userId: 'admin-user', role: 'admin', actorId: 'admin-user', actorEmail: 'admin@example.test' };

const createClient = () => {
  const client = {
    workspaceMembership: { findFirst: vi.fn().mockResolvedValue({ id: 'membership-1' }) },
    merchant: {
      findMany: vi.fn().mockResolvedValue([
        { id: 'm1', workspaceId, status: 'ACTIVE', mergedIntoMerchantId: null, version: 2, updatedById: 'admin-user', updatedAt: new Date('2026-07-22T10:00:00.000Z'), deprecatedAt: null },
        { id: 'm2', workspaceId, status: 'ACTIVE', mergedIntoMerchantId: null, version: 1, updatedById: null, updatedAt: new Date('2026-07-21T10:00:00.000Z'), deprecatedAt: null },
      ]),
      create: vi.fn(), update: vi.fn(), delete: vi.fn(), upsert: vi.fn(),
    },
    merchantAlias: { findMany: vi.fn().mockResolvedValue([]), create: vi.fn(), update: vi.fn(), delete: vi.fn(), upsert: vi.fn() },
    merchantFingerprint: { findMany: vi.fn().mockResolvedValue([]), create: vi.fn(), update: vi.fn(), delete: vi.fn(), upsert: vi.fn() },
    merchantConflict: { findFirst: vi.fn().mockResolvedValue(null), create: vi.fn(), update: vi.fn(), delete: vi.fn(), upsert: vi.fn() },
    $transaction: vi.fn(),
  };
  return client as unknown as PrismaClient & typeof client;
};

const mergeRequest = {
  action: 'MERGE_MERCHANTS' as const,
  targetMerchantId: 'm1',
  sourceMerchantIds: ['m2'],
  reason: 'Duplicate merchant records verified by an administrator.',
  requestKey: 'preview-merge-001',
};

describe('Merchant Knowledge Phase 3.8C plan previews', () => {
  it('defaults previews to disabled and short-circuits before database or planner hydration', async () => {
    const client = createClient();
    expect(isMerchantKnowledgePreviewEnabled({})).toBe(false);
    await expect(previewMerchantKnowledgePlan(admin, mergeRequest, client, {})).rejects.toMatchObject<Partial<MerchantKnowledgePreviewError>>({ code: 'disabled' });
    expect(client.workspaceMembership.findFirst).not.toHaveBeenCalled();
    expect(client.merchant.findMany).not.toHaveBeenCalled();
  });

  it('validates reason and bounded request key', async () => {
    const client = createClient();
    await expect(previewMerchantKnowledgePlan(admin, { ...mergeRequest, reason: '' }, client, env)).rejects.toMatchObject({ code: 'invalid_input' });
    await expect(previewMerchantKnowledgePlan(admin, { ...mergeRequest, requestKey: 'short' }, client, env)).rejects.toMatchObject({ code: 'invalid_input' });
  });

  it('produces deterministic preview hashes and explicit zero-side-effect declarations', async () => {
    const client = createClient();
    const first = await previewMerchantKnowledgePlan(admin, mergeRequest, client, env);
    const second = await previewMerchantKnowledgePlan(admin, mergeRequest, client, env);
    expect(first.planHash).toBe(second.planHash);
    expect(first.beforeState).toEqual(second.beforeState);
    expect(first.afterState).toEqual(second.afterState);
    expect(first).toMatchObject({ previewOnly: true, readOnly: true, createsTransactionBooking: false, mutatesBankFacts: false, persistsMerchantKnowledge: false });
    expect(first.rollbackSteps.length).toBeGreaterThan(0);
    expect(first.merchantStateRefs).toEqual(second.merchantStateRefs);
    expect(first.merchantStateRefs.every((item) => /^[a-f0-9]{64}$/.test(item.stateHash))).toBe(true);
  });

  it('enforces active workspace membership and excludes cross-workspace entities', async () => {
    const client = createClient();
    client.workspaceMembership.findFirst.mockResolvedValueOnce(null);
    await expect(previewMerchantKnowledgePlan(admin, mergeRequest, client, env)).rejects.toMatchObject({ code: 'forbidden' });
    expect(client.merchant.findMany).not.toHaveBeenCalled();

    const isolated = createClient();
    const plan = await previewMerchantKnowledgePlan(admin, { ...mergeRequest, sourceMerchantIds: ['outside-workspace'] }, isolated, env);
    expect(plan.blockingErrors.length).toBeGreaterThan(0);
    expect(isolated.merchant.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { workspaceId } }));
  });

  it('preserves planner blockers, warnings, affected entities, and rollback steps', async () => {
    const client = createClient();
    const plan = await previewMerchantKnowledgePlan(admin, { ...mergeRequest, sourceMerchantIds: ['m1'] }, client, env);
    expect(plan.blockingErrors.length).toBeGreaterThan(0);
    expect(Array.isArray(plan.warnings)).toBe(true);
    expect(Array.isArray(plan.affectedEntityIds)).toBe(true);
    expect(Array.isArray(plan.rollbackSteps)).toBe(true);
  });

  it('performs no write, transaction, audit, booking, or persistence operation', async () => {
    const client = createClient();
    await previewMerchantKnowledgePlan(admin, mergeRequest, client, env);
    expect(client.$transaction).not.toHaveBeenCalled();
    for (const model of [client.merchant, client.merchantAlias, client.merchantFingerprint, client.merchantConflict]) {
      expect(model.create).not.toHaveBeenCalled();
      expect(model.update).not.toHaveBeenCalled();
      expect(model.delete).not.toHaveBeenCalled();
      expect(model.upsert).not.toHaveBeenCalled();
    }
  });

  it('uses server-authoritative admin enforcement and exposes one preview route only', () => {
    const route = fs.readFileSync(path.join(process.cwd(), 'server/routes/merchantKnowledge.ts'), 'utf8');
    const server = fs.readFileSync(path.join(process.cwd(), 'server/index.ts'), 'utf8');
    const bridge = fs.readFileSync(path.join(process.cwd(), 'src/app/api/merchant-knowledge/plans/preview/route.ts'), 'utf8');
    expect(route).toContain('requireAdmin(req, res)');
    expect(server.match(/app\.post\('\/api\/merchant-knowledge\/plans\/preview/g)).toHaveLength(1);
    expect(server).not.toMatch(/merchant-knowledge\/plans\/(confirm|execute|bulk)/);
    expect(bridge).toContain('export async function POST');
    expect(bridge).not.toMatch(/export async function (PUT|PATCH|DELETE)/);
  });

  it('keeps preview UI administrator-only and exposes only the three bounded confirmation actions', () => {
    const panel = fs.readFileSync(path.join(process.cwd(), 'src/ui/MerchantKnowledgePreviewPanel.tsx'), 'utf8');
    const page = fs.readFileSync(path.join(process.cwd(), 'src/ui/MerchantKnowledgeAdminPage.tsx'), 'utf8');
    expect(panel).toContain('if (!isClientAdmin()) return null');
    expect(page).toContain('<MerchantKnowledgePreviewPanel onConfirmed={refreshAfterAliasDeprecation} />');
    expect(panel).toContain('Preview-only · niet opgeslagen · geen uitvoering');
    expect(panel).toContain("preview.action === 'DEPRECATE_ALIAS'");
    expect(panel).toContain("preview.action === 'DEPRECATE_MERCHANT'");
    expect(panel).toContain("preview.action === 'RESOLVE_CONFLICT'");
    expect(panel).toContain('Open bevestiging voor aliasdeprecatie');
    expect(panel).toContain('Open bevestiging voor merchantdeprecatie');
    expect(panel).toContain('Open bevestiging voor conflictoplossing');
    expect(panel).not.toMatch(/>\s*(Uitvoeren|Opslaan|Toepassen)\s*</i);
    expect(panel).not.toMatch(/Bevestig (merge|split|reassign)/i);
    expect(panel).not.toContain('normalizedValue');
    expect(panel).not.toContain('rawEvidence');
    expect(panel).not.toContain('prisma');
    for (const label of ['Previewactie', 'Primair entiteits-ID', "Gerelateerde entiteits-ID's", 'Reden voor planpreview', 'Request key voor planpreview']) {
      expect(panel).toContain(label);
    }
  });
});
