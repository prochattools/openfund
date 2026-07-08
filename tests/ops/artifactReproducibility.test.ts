/**
 * RC-002 — Artifact and source file reproducibility audit.
 *
 * Verifies that report artifacts, snapshot hashes, and approval/dispatch
 * metadata are byte-reproducible and correctly linked. No database required.
 */

import { describe, expect, it } from 'vitest';
import crypto from 'node:crypto';
import { ReportLineKind, PeriodCloseStatus } from '@prisma/client';

import {
  generateHtmlArtifact,
  generateXlsxArtifact,
  generatePdfArtifact,
  generateAndStoreReportArtifacts,
  sha256OfBuffer,
  type ArtifactSnapshotInput,
} from '../../server/services/reportArtifactService';

import {
  approveSnapshot,
  prepareDispatch,
  ReportApprovalError,
} from '../../server/services/reportApprovalDispatchService';

import {
  executeAuditedReopen,
} from '../../server/services/auditedPeriodReopenService';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const SNAPSHOT_ID = 'snapshot-repro-001';
const SNAPSHOT_HASH = 'f'.repeat(64);
const WORKSPACE_ID = 'workspace-repro';
const CONTENT_HASH = 'c'.repeat(64);
const pdfContainsAsciiHex = (content: string, value: string): boolean =>
  content.toLowerCase().replace(/\s+/g, '').includes(Buffer.from(value, 'utf-8').toString('hex'));

const baseSnapshot: ArtifactSnapshotInput = {
  snapshotId: SNAPSHOT_ID,
  snapshotHash: SNAPSHOT_HASH,
  kind: 'MONTHLY',
  year: 2026,
  month: 1,
  openingBalanceMinor: '1000000',
  incomeMinor: '250000',
  expenseMinor: '100000',
  netMinor: '150000',
  closingBalanceMinor: '1150000',
  transactionCount: 5,
  generatedBy: 'actor-1',
  generatedAt: new Date('2026-07-05T10:00:00Z'),
  lines: [
    {
      lineKind: ReportLineKind.CATEGORY,
      projectId: 'p-ya',
      transactionTypeId: 'tt-schenking',
      categoryId: 'c-giften',
      literalProjectLabel: 'YA',
      literalTypeLabel: 'Schenking',
      literalCategoryLabel: 'Giften in',
      direction: 'credit',
      amountMinor: 250000n,
      transactionCount: 3,
      sortOrder: 1,
    },
  ],
};

const adminActor = { userId: 'user-1', role: 'admin' as const, actorId: 'actor-1' };

const makeArtifactDb = (snapshotHashOverride?: string) => ({
  reportSnapshot: {
    findUnique: async (_: any) => ({
      id: SNAPSHOT_ID,
      snapshotHash: snapshotHashOverride ?? SNAPSHOT_HASH,
    }),
  },
  reportArtifact: {
    create: async (args: any) => {
      const sha256 = crypto.createHash('sha256').update(args.data.content).digest('hex');
      return {
        id: `artifact-${args.data.format.toLowerCase()}-1`,
        sha256,
        ...args.data,
      };
    },
  },
} as any);

const makeApprovalDb = (opts: { approvalForDispatch?: object | null } = {}) => ({
  reportSnapshot: {
    findFirst: async (_: any) => ({
      id: SNAPSHOT_ID,
      snapshotHash: SNAPSHOT_HASH,
      periodCloseLinks: [{
        periodClose: { id: 'close-1', status: PeriodCloseStatus.CLOSED },
      }],
    }),
    findUnique: async (_: any) => ({ id: SNAPSHOT_ID, snapshotHash: SNAPSHOT_HASH }),
  },
  reportApproval: {
    findFirst: async (args: any) => {
      if (args?.where?.revokedAt === null) {
        if (args?.where?.id !== undefined) {
          if (opts.approvalForDispatch !== undefined) return opts.approvalForDispatch;
          return { id: 'approval-1', reportSnapshotId: SNAPSHOT_ID };
        }
        return null;
      }
      return null;
    },
    create: async (args: any) => ({
      id: 'approval-repro-1',
      approvedBy: args.data.approvedBy,
      approvedAt: new Date('2026-07-05T12:00:00Z'),
      snapshotHash: args.data.snapshotHash,
      revokedAt: null,
      ...args.data,
    }),
  },
  reportDispatch: {
    create: async (args: any) => ({
      id: 'dispatch-repro-1',
      status: 'PENDING',
      ...args.data,
      recipients: { create: args.data.recipients?.create ?? [] },
    }),
  },
} as any);

const makeReopenDb = (linkedSnapshotIds: string[], activeApprovalIds: string[]) => ({
  periodClose: {
    findFirst: async (_: any) => ({
      id: 'close-1',
      workspaceId: WORKSPACE_ID,
      status: PeriodCloseStatus.CLOSED,
      reportSnapshotLinks: linkedSnapshotIds.map((id) => ({ reportSnapshotId: id })),
    }),
    update: async (_: any) => ({
      id: 'close-1',
      status: PeriodCloseStatus.REOPENED,
      reopenedBy: 'actor-1',
      reopenedAt: new Date('2026-07-05T12:00:00Z'),
      reopenReason: 'Correctie',
    }),
  },
  reportApproval: {
    findMany: async (_: any) => activeApprovalIds.map((id) => ({
      id,
      reportSnapshotId: SNAPSHOT_ID,
    })),
    updateMany: async (_: any) => ({ count: activeApprovalIds.length }),
  },
  auditLog: {
    create: async (_: any) => ({ id: 'audit-1' }),
  },
} as any);

// ─── RC-002 Reproducibility tests ────────────────────────────────────────────

describe('artifact reproducibility', () => {

  // Contract 1: Report artifact SHA-256 equals retained bytes
  it('1 — HTML artifact sha256 equals hash of its retained bytes', () => {
    const buf = generateHtmlArtifact(baseSnapshot);
    const sha256 = sha256OfBuffer(buf);
    const recomputed = crypto.createHash('sha256').update(buf).digest('hex');
    expect(sha256).toBe(recomputed);
    expect(sha256).toHaveLength(64);
  });

  it('1b — XLSX artifact sha256 equals hash of its retained bytes', () => {
    const buf = generateXlsxArtifact(baseSnapshot);
    const sha256 = sha256OfBuffer(buf);
    const recomputed = crypto.createHash('sha256').update(buf).digest('hex');
    expect(sha256).toBe(recomputed);
    expect(sha256).toHaveLength(64);
  });

  it('1c — PDF artifact sha256 equals hash of its retained bytes', async () => {
    const buf = await generatePdfArtifact(baseSnapshot);
    const sha256 = sha256OfBuffer(buf);
    const recomputed = crypto.createHash('sha256').update(buf).digest('hex');
    expect(sha256).toBe(recomputed);
    expect(sha256).toHaveLength(64);
  });

  // Contract 2: HTML/XLSX/PDF include same snapshot id/hash/totals
  it('2 — HTML includes snapshot id, hash, and totals', () => {
    const html = generateHtmlArtifact(baseSnapshot).toString('utf-8');
    expect(html).toContain(SNAPSHOT_ID);
    expect(html).toContain(SNAPSHOT_HASH);
    expect(html).toContain('EUR 2500.00'); // 250000 cents
    expect(html).toContain('EUR 1000.00'); // 100000 cents
  });

  it('2b — PDF artifact includes same snapshot id and hash', async () => {
    const content = (await generatePdfArtifact(baseSnapshot)).toString('utf-8');
    expect(content).toContain(SNAPSHOT_ID);
    expect(pdfContainsAsciiHex(content, SNAPSHOT_HASH)).toBe(true);
  });

  it('2c — HTML output remains byte-reproducible for identical inputs', () => {
    const html1 = sha256OfBuffer(generateHtmlArtifact(baseSnapshot));
    const html2 = sha256OfBuffer(generateHtmlArtifact(baseSnapshot));
    expect(html1).toBe(html2);
  });

  // Contract 3: Original source files are NOT embedded into report artifacts
  it('3 — report artifacts do not reference or embed SourceFile content', async () => {
    const db = makeArtifactDb();
    const result = await generateAndStoreReportArtifacts(db, baseSnapshot);
    expect(result).toBeDefined();
    // No sourceFile property or table access (db has no sourceFile stub — would throw if called)
    expect(result.snapshotId).toBe(SNAPSHOT_ID);
  });

  it('3b — HTML artifact contains no file path or upload references', () => {
    const html = generateHtmlArtifact(baseSnapshot).toString('utf-8');
    expect(html).not.toContain('NL89INGB0006369960_2026');
    expect(html).not.toContain('.xlsx');
    expect(html).not.toContain('.csv');
    expect(html).not.toContain('SourceFile');
    expect(html).not.toContain('sourceFile');
  });

  // Contract 4: Artifacts generated and stored have sha256 equal to content bytes
  it('4 — stored artifacts have sha256 equal to sha256 of stored content bytes', async () => {
    const capturedArtifacts: { format: string; content: Buffer; sha256: string }[] = [];

    const db = {
      reportSnapshot: {
        findUnique: async (_: any) => ({ id: SNAPSHOT_ID, snapshotHash: SNAPSHOT_HASH }),
      },
      reportArtifact: {
        create: async (args: any) => {
          const storedSha256 = args.data.sha256 as string;
          const computedSha256 = crypto.createHash('sha256').update(args.data.content).digest('hex');
          capturedArtifacts.push({
            format: args.data.format,
            content: args.data.content,
            sha256: storedSha256,
          });
          expect(storedSha256).toBe(computedSha256);
          return { id: `artifact-${args.data.format.toLowerCase()}-1`, ...args.data };
        },
      },
    } as any;

    await generateAndStoreReportArtifacts(db, baseSnapshot);
    expect(capturedArtifacts).toHaveLength(3);
    for (const artifact of capturedArtifacts) {
      const recomputed = crypto.createHash('sha256').update(artifact.content).digest('hex');
      expect(artifact.sha256).toBe(recomputed);
    }
  });

  // Contract 5: Report approval stores the snapshot hash
  it('5 — report approval stores the snapshot hash that was approved', async () => {
    const db = makeApprovalDb();
    const result = await approveSnapshot(db, {
      actor: adminActor,
      workspaceId: WORKSPACE_ID,
      reportSnapshotId: SNAPSHOT_ID,
      expectedSnapshotHash: SNAPSHOT_HASH,
    });

    expect(result.snapshotHash).toBe(SNAPSHOT_HASH);
    expect(result.reportSnapshotId).toBe(SNAPSHOT_ID);
    expect(result.sideEffects.createsReportApproval).toBe(true);
  });

  // Contract 6: Dispatch metadata references content hashes only
  it('6 — dispatch metadata references content hash and recipient hash, not plain emails', async () => {
    const db = makeApprovalDb();
    const result = await prepareDispatch(db, {
      actor: adminActor,
      workspaceId: WORKSPACE_ID,
      reportSnapshotId: SNAPSHOT_ID,
      reportApprovalId: 'approval-1',
      fromAddress: 'finance@example.test',
      subject: 'Rapport',
      recipients: [{ email: 'admin@example.test', name: 'Beheerder' }],
      contentHash: CONTENT_HASH,
    });

    expect(result.contentHash).toBe(CONTENT_HASH);
    expect(result.recipientHash).toHaveLength(64);
    expect(result.recipientHash).not.toContain('@');
    expect(result.recipientHash).not.toBe(CONTENT_HASH);
    expect(result.status).toBe('PENDING');
  });

  it('6b — dispatch rejected when approval is revoked (e.g. after reopen)', async () => {
    const db = makeApprovalDb({ approvalForDispatch: null });
    await expect(
      prepareDispatch(db, {
        actor: adminActor,
        workspaceId: WORKSPACE_ID,
        reportSnapshotId: SNAPSHOT_ID,
        reportApprovalId: 'approval-1',
        fromAddress: 'finance@example.test',
        subject: 'Rapport',
        recipients: [{ email: 'admin@example.test' }],
        contentHash: CONTENT_HASH,
      }),
    ).rejects.toThrow(ReportApprovalError);
  });

  // Contract 7: Reopen revokes approvals tied to snapshots linked to reopened close
  it('7 — audited reopen revokes approvals tied to snapshots linked to the reopened close', async () => {
    const db = makeReopenDb([SNAPSHOT_ID], ['approval-repro-1']);
    const result = await executeAuditedReopen(db, {
      actor: adminActor,
      workspaceId: WORKSPACE_ID,
      periodCloseId: 'close-1',
      reason: 'Reproducibiliteitstesthervatting',
    });

    expect(result.revokedApprovalCount).toBe(1);
    expect(result.affectedReportSnapshotIds).toContain(SNAPSHOT_ID);
    expect(result.sideEffects.revokesReportApprovals).toBe(true);
    expect(result.sideEffects.createsReportSnapshot).toBe(false);
    expect(result.sideEffects.createsTransactionBooking).toBe(false);
  });

  it('7b — reopen with no linked snapshots revokes zero approvals', async () => {
    const db = makeReopenDb([], []);
    const result = await executeAuditedReopen(db, {
      actor: adminActor,
      workspaceId: WORKSPACE_ID,
      periodCloseId: 'close-1',
      reason: 'Geen gekoppelde snapshots',
    });

    expect(result.revokedApprovalCount).toBe(0);
    expect(result.affectedReportSnapshotIds).toHaveLength(0);
    expect(result.sideEffects.revokesReportApprovals).toBe(false);
  });
});
