import fs from 'node:fs';
import path from 'node:path';
import type { PrismaClient } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import type { RequestActor } from '../../server/auth/requestContext';
import {
  MerchantKnowledgeAccessError,
  getMerchantKnowledgeMerchantDetail,
  getMerchantKnowledgeSummary,
  listMerchantKnowledgeMerchants,
  parseMerchantKnowledgeListInput,
} from '../../server/services/merchantKnowledgeQueryService';
import { isMerchantKnowledgeReadEnabled } from '../../server/services/merchantKnowledgeCapability';

const workspaceId = '11111111-1111-4111-8111-111111111111';
const enabledEnv = {
  MERCHANT_KNOWLEDGE_READS_ENABLED: 'true',
  DEFAULT_WORKSPACE_ID: workspaceId,
} as NodeJS.ProcessEnv;
const admin: RequestActor = { userId: 'admin-user', role: 'admin', actorId: 'admin-user', actorEmail: 'admin@example.test' };
const viewer: RequestActor = { userId: 'viewer-user', role: 'viewer', actorId: 'viewer-user', actorEmail: 'viewer@example.test' };

const createClient = () => {
  const client = {
    workspaceMembership: { findFirst: vi.fn().mockResolvedValue({ id: 'membership-1' }) },
    merchant: {
      count: vi.fn().mockResolvedValue(0),
      findMany: vi.fn().mockResolvedValue([]),
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn(), update: vi.fn(), delete: vi.fn(), upsert: vi.fn(),
    },
    merchantAlias: { count: vi.fn().mockResolvedValue(0), create: vi.fn(), update: vi.fn(), delete: vi.fn(), upsert: vi.fn() },
    merchantFingerprint: { count: vi.fn().mockResolvedValue(0), create: vi.fn(), update: vi.fn(), delete: vi.fn(), upsert: vi.fn() },
    merchantConflict: { count: vi.fn().mockResolvedValue(0), create: vi.fn(), update: vi.fn(), delete: vi.fn(), upsert: vi.fn() },
    $transaction: vi.fn(),
  };
  return client as unknown as PrismaClient & typeof client;
};

describe('Merchant Knowledge Phase 3.8A read contracts', () => {
  it('defaults the capability to disabled and does not query any table', async () => {
    const client = createClient();
    expect(isMerchantKnowledgeReadEnabled({})).toBe(false);
    await expect(getMerchantKnowledgeSummary(admin, client, {})).rejects.toMatchObject<Partial<MerchantKnowledgeAccessError>>({ code: 'disabled' });
    expect(client.workspaceMembership.findFirst).not.toHaveBeenCalled();
    expect(client.merchant.count).not.toHaveBeenCalled();
  });

  it.each([admin, viewer])('allows authenticated active workspace members with role $role', async (actor) => {
    const client = createClient();
    const response = await getMerchantKnowledgeSummary(actor, client, enabledEnv);
    expect(response).toMatchObject({ readOnly: true, createsTransactionBooking: false, mutatesBankFacts: false });
    expect(client.workspaceMembership.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ userId: actor.userId, workspaceId, isActive: true }),
    }));
  });

  it('rejects missing or cross-workspace membership', async () => {
    const client = createClient();
    client.workspaceMembership.findFirst.mockResolvedValueOnce(null);
    await expect(getMerchantKnowledgeSummary(viewer, client, enabledEnv)).rejects.toMatchObject({ code: 'forbidden' });
    expect(client.merchant.count).not.toHaveBeenCalled();
  });

  it('parses bounded filters and approved page sizes', () => {
    expect(parseMerchantKnowledgeListInput({})).toEqual({ page: 1, pageSize: 25, status: null, query: null });
    expect(parseMerchantKnowledgeListInput({ page: '2', pageSize: '50', status: 'ACTIVE', query: '  Shop  ' }))
      .toEqual({ page: 2, pageSize: 50, status: 'ACTIVE', query: 'Shop' });
    expect(parseMerchantKnowledgeListInput({ page: '-1', pageSize: '999', status: 'UNKNOWN', query: 'x'.repeat(150) }))
      .toEqual({ page: 1, pageSize: 25, status: null, query: 'x'.repeat(100) });
    expect(parseMerchantKnowledgeListInput({ pageSize: '100' }).pageSize).toBe(100);
  });

  it('uses workspace scope, deterministic ordering, stable pagination, and empty pages', async () => {
    const client = createClient();
    const response = await listMerchantKnowledgeMerchants(admin, { page: 3, pageSize: 25, status: 'ACTIVE', query: 'shop' }, client, enabledEnv);
    expect(response.merchants).toEqual([]);
    expect(response.pagination).toEqual({ page: 3, pageSize: 25, totalItems: 0, totalPages: 0, hasPreviousPage: false, hasNextPage: false });
    expect(client.merchant.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ workspaceId, status: 'ACTIVE' }),
      orderBy: [{ normalizedCanonicalName: 'asc' }, { id: 'asc' }],
      skip: 50,
      take: 25,
    }));
  });

  it('redacts aliases and fingerprints while masking IBAN evidence', async () => {
    const client = createClient();
    client.merchant.findFirst.mockResolvedValueOnce({
      id: 'merchant-1', canonicalName: 'Example', status: 'ACTIVE', version: 1,
      mergedIntoMerchantId: null, createdAt: new Date('2026-01-01T00:00:00Z'), updatedAt: new Date('2026-01-02T00:00:00Z'),
      aliases: [
        { id: 'a1', signalType: 'IBAN', status: 'APPROVED', valueHash: 'vh1', evidenceHash: 'eh1', normalizationVersion: 'v1', normalizedValue: 'NL91ABNA0417164300', confidenceBasisPoints: 9900, createdAt: new Date('2026-01-01T00:00:00Z') },
        { id: 'a2', signalType: 'APPROVED_ALIAS', status: 'APPROVED', valueHash: 'vh2', evidenceHash: 'eh2', normalizationVersion: 'v1', normalizedValue: 'Secret Alias', confidenceBasisPoints: 9000, createdAt: new Date('2026-01-01T00:00:00Z') },
      ],
      fingerprints: [
        { id: 'f1', signalType: 'IBAN', status: 'MATCHED', strength: 'STRONG', valueHash: 'vh3', evidenceHash: 'eh3', extractionVersion: 'v1', normalizedValue: 'NL91ABNA0417164300', createdAt: new Date('2026-01-01T00:00:00Z') },
      ],
    });
    const response = await getMerchantKnowledgeMerchantDetail(viewer, 'merchant-1', client, enabledEnv);
    expect(response.merchant?.aliases[0].displayValue).toBe('NL91••••••4300');
    expect(response.merchant?.aliases[1].displayValue).toBeNull();
    expect(response.merchant?.fingerprints[0].displayValue).toBe('NL91••••••4300');
    expect(JSON.stringify(response)).not.toContain('Secret Alias');
    expect(client.merchant.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'merchant-1', workspaceId } }));
  });

  it('performs no write or transaction operation', async () => {
    const client = createClient();
    await getMerchantKnowledgeSummary(admin, client, enabledEnv);
    await listMerchantKnowledgeMerchants(admin, {}, client, enabledEnv);
    await getMerchantKnowledgeMerchantDetail(admin, 'missing', client, enabledEnv);
    expect(client.$transaction).not.toHaveBeenCalled();
    for (const model of [client.merchant, client.merchantAlias, client.merchantFingerprint, client.merchantConflict]) {
      expect(model.create).not.toHaveBeenCalled();
      expect(model.update).not.toHaveBeenCalled();
      expect(model.delete).not.toHaveBeenCalled();
      expect(model.upsert).not.toHaveBeenCalled();
    }
  });

  it('exposes only GET routes and no mutation bridge', () => {
    const server = fs.readFileSync(path.join(process.cwd(), 'server/index.ts'), 'utf8');
    const routeFiles = [
      'src/app/api/merchant-knowledge/summary/route.ts',
      'src/app/api/merchant-knowledge/merchants/route.ts',
      'src/app/api/merchant-knowledge/merchants/[id]/route.ts',
    ].map((file) => fs.readFileSync(path.join(process.cwd(), file), 'utf8')).join('\n');
    expect(server.match(/app\.get\('\/api\/merchant-knowledge/g)).toHaveLength(3);
    expect(server).not.toMatch(/app\.(post|patch|put|delete)\('\/api\/merchant-knowledge/);
    expect(routeFiles).not.toMatch(/export async function (POST|PATCH|PUT|DELETE)/);
  });
});
