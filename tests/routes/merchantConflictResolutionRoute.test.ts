import fs from 'node:fs';
import path from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { setRequestActor } from '../../server/auth/requestContext';

const decisionMocks = vi.hoisted(() => ({ confirm: vi.fn() }));

vi.mock('../../server/services/merchantConflictDecisionService', () => ({
  confirmMerchantConflictResolution: decisionMocks.confirm,
  MerchantConflictDecisionError: class MerchantConflictDecisionError extends Error {
    constructor(public readonly code: string, message: string, public readonly statusCode: number) { super(message); }
  },
}));

import { confirmMerchantConflictResolutionRoute } from '../../server/routes/merchantKnowledge';

const makeRequest = (role: 'admin' | 'viewer', body: Record<string, unknown> = {}, params: Record<string, string> = { conflictId: 'conflict-route-1' }) => {
  const request = { body, params, query: {} as Record<string, string>, header: () => undefined };
  setRequestActor(request, { userId: `${role}-user`, role, actorId: `${role}-user`, actorEmail: `${role}@example.test` });
  return request;
};
const makeResponse = () => ({
  statusCode: 200,
  body: undefined as unknown,
  status(code: number) { this.statusCode = code; return this; },
  json(payload: unknown) { this.body = payload; return this; },
  send() { return this; },
});

describe('Phase 3.8D conflict confirmation route', () => {
  beforeEach(() => decisionMocks.confirm.mockReset());

  it('rejects viewers through server-authoritative requireAdmin before service invocation', async () => {
    const response = makeResponse();
    await confirmMerchantConflictResolutionRoute(makeRequest('viewer') as any, response as any);
    expect(response.statusCode).toBe(403);
    expect(response.body).toEqual({ error: 'Alleen beheerders mogen deze actie uitvoeren.' });
    expect(decisionMocks.confirm).not.toHaveBeenCalled();
  });

  it('passes the authenticated administrator and route-authoritative conflict ID to the dedicated service', async () => {
    decisionMocks.confirm.mockResolvedValue({
      decisionId: 'decision-1', auditEventId: 'audit-1', resolutionId: 'resolution-1', conflictId: 'conflict-route-1', intent: 'SELECT_MERCHANT', selectedMerchantId: 'merchant-1', priorStatus: 'OPEN', newStatus: 'RESOLVED', resolvedAt: new Date('2026-07-24T10:00:00.000Z'), planVersion: 'merchant-identity-plan-v1', planHash: 'a'.repeat(64), conflictStateHash: 'b'.repeat(64), evidenceHash: 'c'.repeat(64), idempotent: false, confirmed: true, action: 'RESOLVE_CONFLICT', persistsMerchantKnowledge: true, writesMerchantResolution: true, writesMerchantIdentityDecision: true, writesMerchantAuditEvent: true, trustsAliases: false, trustsFingerprints: false, mutatesMerchants: false, createsTransactionBooking: false, mutatesBankFacts: false, mutatesFinancialRecords: false,
    });
    const response = makeResponse();
    const request = makeRequest('admin', {
      action: 'RESOLVE_CONFLICT', conflictId: 'client-conflict', intent: 'SELECT_MERCHANT', selectedMerchantId: 'merchant-1', planVersion: 'merchant-identity-plan-v1', planHash: 'a'.repeat(64), conflictStateHash: 'b'.repeat(64), conflictEvidenceHash: 'd'.repeat(64), reason: 'Verified conflict resolution.', requestKey: 'conflict-confirm-001',
    }, { id: 'conflict-route-1' });

    await confirmMerchantConflictResolutionRoute(request as any, response as any);

    expect(response.statusCode).toBe(200);
    expect(response.body).toMatchObject({ conflictId: 'conflict-route-1', resolvedAt: '2026-07-24T10:00:00.000Z' });
    expect(decisionMocks.confirm).toHaveBeenCalledWith(
      expect.objectContaining({ role: 'admin', actorId: 'admin-user' }),
      expect.objectContaining({ conflictId: 'conflict-route-1', action: 'RESOLVE_CONFLICT' }),
    );
  });

  it('registers exactly one conflict route and no generic, bulk, merge, split, or reassignment confirmation endpoint', () => {
    const server = fs.readFileSync(path.join(process.cwd(), 'server/index.ts'), 'utf8');
    const bridge = fs.readFileSync(path.join(process.cwd(), 'src/app/api/merchant-knowledge/conflicts/[id]/resolve/confirm/route.ts'), 'utf8');
    expect(server.match(/app\.post\('\/api\/merchant-knowledge\/conflicts\/:conflictId\/resolve\/confirm'/g)).toHaveLength(1);
    expect(server).not.toMatch(/merchant-knowledge\/(plans\/confirm|confirm|bulk)/);
    expect(server).not.toMatch(/(merge|split|reassign).*confirm/i);
    expect(bridge).toContain('export async function POST');
    expect(bridge).not.toMatch(/export async function (GET|PUT|PATCH|DELETE)/);
  });

  it('keeps conflict confirmation administrator-only, individual, accessible, privacy-safe, and explicit about no trust or financial effects', () => {
    const panel = fs.readFileSync(path.join(process.cwd(), 'src/ui/MerchantKnowledgePreviewPanel.tsx'), 'utf8');
    expect(panel).toContain('if (!isClientAdmin()) return null');
    expect(panel).toContain("preview.action === 'RESOLVE_CONFLICT'");
    expect(panel).toContain('aria-labelledby="conflict-resolution-title"');
    expect(panel).toContain('aria-describedby="conflict-resolution-description"');
    expect(panel).toContain('aria-label="Bevestig conflictoplossing"');
    expect(panel).toContain('geen alias of vingerafdruk');
    expect(panel).toContain('geen merchantrecord');
    expect(panel).toContain('geen boeking');
    expect(panel).toContain('geen bankfeit');
    expect(panel).not.toMatch(/bulk|alles selecteren/i);
    expect(panel).not.toMatch(/Bevestig (merge|split|reassign)/i);
    expect(panel).not.toContain('prisma');
    expect(panel).not.toContain('normalizedValue');
    expect(panel).not.toContain('rawEvidence');
  });
});
