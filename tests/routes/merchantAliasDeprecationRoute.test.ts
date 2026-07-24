import fs from 'node:fs';
import path from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { setRequestActor } from '../../server/auth/requestContext';

const decisionMocks = vi.hoisted(() => ({
  confirm: vi.fn(),
}));

vi.mock('../../server/services/merchantAliasDeprecationDecisionService', () => ({
  confirmMerchantAliasDeprecation: decisionMocks.confirm,
  MerchantAliasDeprecationError: class MerchantAliasDeprecationError extends Error {
    constructor(
      public readonly code: string,
      message: string,
      public readonly statusCode: number,
    ) {
      super(message);
    }
  },
}));

import { confirmMerchantAliasDeprecationRoute } from '../../server/routes/merchantKnowledge';

const makeRequest = (role: 'admin' | 'viewer', body: Record<string, unknown> = {}) => {
  const request = {
    body,
    params: { aliasId: 'alias-route-1' },
    query: {} as Record<string, string>,
    header: () => undefined,
  };
  setRequestActor(request, {
    userId: `${role}-user`,
    role,
    actorId: `${role}-user`,
    actorEmail: `${role}@example.test`,
  });
  return request;
};

const makeResponse = () => ({
  statusCode: 200,
  body: undefined as unknown,
  status(code: number) { this.statusCode = code; return this; },
  json(payload: unknown) { this.body = payload; return this; },
  send() { return this; },
});

describe('Phase 3.8D alias-deprecation confirmation route', () => {
  beforeEach(() => {
    decisionMocks.confirm.mockReset();
  });

  it('rejects viewers through server-authoritative requireAdmin before service invocation', async () => {
    const response = makeResponse();
    await confirmMerchantAliasDeprecationRoute(makeRequest('viewer') as any, response as any);
    expect(response.statusCode).toBe(403);
    expect(response.body).toEqual({ error: 'Alleen beheerders mogen deze actie uitvoeren.' });
    expect(decisionMocks.confirm).not.toHaveBeenCalled();
  });

  it('passes the authenticated administrator and route-authoritative alias ID to the dedicated service', async () => {
    decisionMocks.confirm.mockResolvedValue({
      decisionId: 'decision-1',
      auditEventId: 'audit-1',
      aliasId: 'alias-route-1',
      priorStatus: 'TRUSTED',
      newStatus: 'DEPRECATED',
      deprecatedAt: new Date('2026-07-24T10:00:00.000Z'),
      planVersion: 'merchant-identity-plan-v1',
      planHash: 'a'.repeat(64),
      evidenceHash: 'b'.repeat(64),
      rollbackReference: { decisionId: 'decision-1', steps: [] },
      idempotent: false,
      confirmed: true,
      action: 'DEPRECATE_ALIAS',
      persistsMerchantKnowledge: true,
      writesMerchantIdentityDecision: true,
      writesMerchantAuditEvent: true,
      createsTransactionBooking: false,
      mutatesBankFacts: false,
      mutatesFinancialRecords: false,
    });
    const response = makeResponse();
    const request = makeRequest('admin', {
      action: 'DEPRECATE_ALIAS',
      aliasId: 'client-supplied-alias',
      planVersion: 'merchant-identity-plan-v1',
      planHash: 'a'.repeat(64),
      expectedEvidenceHash: 'b'.repeat(64),
      reason: 'Verified alias deprecation.',
      requestKey: 'alias-confirm-001',
    });

    await confirmMerchantAliasDeprecationRoute(request as any, response as any);

    expect(response.statusCode).toBe(200);
    expect(response.body).toMatchObject({ aliasId: 'alias-route-1', deprecatedAt: '2026-07-24T10:00:00.000Z' });
    expect(decisionMocks.confirm).toHaveBeenCalledWith(
      expect.objectContaining({ role: 'admin', actorId: 'admin-user' }),
      expect.objectContaining({ aliasId: 'alias-route-1', action: 'DEPRECATE_ALIAS' }),
    );
  });

  it('registers one dedicated alias route and no generic, bulk, or other-action confirmation endpoint', () => {
    const server = fs.readFileSync(path.join(process.cwd(), 'server/index.ts'), 'utf8');
    const bridge = fs.readFileSync(path.join(process.cwd(), 'src/app/api/merchant-knowledge/aliases/[aliasId]/deprecate/confirm/route.ts'), 'utf8');
    expect(server.match(/app\.post\('\/api\/merchant-knowledge\/aliases\/:aliasId\/deprecate\/confirm'/g)).toHaveLength(1);
    expect(server).not.toMatch(/merchant-knowledge\/(plans\/confirm|confirm|bulk)/);
    expect(server).not.toMatch(/(merge|split|conflicts|reassign|merchants\/.*deprecat).*confirm/i);
    expect(bridge).toContain('export async function POST');
    expect(bridge).not.toMatch(/export async function (GET|PUT|PATCH|DELETE)/);
  });

  it('keeps the confirmation UI administrator-only, individual, accessible, and free of other action controls', () => {
    const panel = fs.readFileSync(path.join(process.cwd(), 'src/ui/MerchantKnowledgePreviewPanel.tsx'), 'utf8');
    expect(panel).toContain('if (!isClientAdmin()) return null');
    expect(panel).toContain("preview.action === 'DEPRECATE_ALIAS'");
    expect(panel).toContain('aria-labelledby="alias-deprecation-title"');
    expect(panel).toContain('aria-describedby="alias-deprecation-description"');
    expect(panel).toContain('aria-label="Bevestig aliasdeprecatie"');
    expect(panel).toContain('geen boeking');
    expect(panel).toContain('wijzigt geen bankfeit');
    expect(panel).not.toMatch(/bulk|alles selecteren/i);
    expect(panel).not.toMatch(/Bevestig (merge|split|conflict|reassign|merchant)/i);
    expect(panel).not.toContain('prisma');
    expect(panel).not.toContain('normalizedValue');
    expect(panel).not.toContain('rawEvidence');
  });
});
