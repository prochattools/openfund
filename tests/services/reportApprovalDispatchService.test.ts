import { describe, expect, it } from 'vitest';
import { DispatchStatus, PeriodCloseStatus } from '@prisma/client';
import {
  approveSnapshot,
  prepareDispatch,
  executeDispatch,
  ReportApprovalError,
  type ApprovalActor,
} from '../../server/services/reportApprovalDispatchService';
import { NoSendProvider } from '../../server/services/reportEmailProvider';
import type { ReportEmailProvider, ReportEmailResult } from '../../server/services/reportEmailProvider';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const adminActor: ApprovalActor = {
  userId: 'user-1',
  role: 'admin',
  actorId: 'actor-1',
};

const viewerActor: ApprovalActor = {
  userId: 'user-2',
  role: 'viewer',
  actorId: 'actor-2',
};

const SNAPSHOT_HASH = 'a'.repeat(64);
const SNAPSHOT_ID = 'snapshot-001';
const WORKSPACE_ID = 'workspace-1';

const makeApprovalDb = (opts: {
  snapshotExists?: boolean;
  snapshotHash?: string;
  periodCloseStatus?: PeriodCloseStatus;
  existingActiveApproval?: boolean;
  approval?: { id: string; approvedAt: Date; snapshotHash: string };
  approvalForDispatch?: { id: string; revokedAt: Date | null } | null;
  createdDispatch?: { id: string; recipientHash: string } | null;
} = {}) => {
  const hash = opts.snapshotHash ?? SNAPSHOT_HASH;
  const calls: string[] = [];

  return {
    reportSnapshot: {
      findFirst: async (_args: any) => {
        calls.push('snapshot.findFirst');
        if (!(opts.snapshotExists ?? true)) return null;
        return {
          id: SNAPSHOT_ID,
          snapshotHash: hash,
          periodCloseLinks: [
            {
              periodClose: {
                id: 'close-1',
                status: opts.periodCloseStatus ?? PeriodCloseStatus.CLOSED,
              },
            },
          ],
        };
      },
      findUnique: async (_args: any) => {
        calls.push('snapshot.findUnique');
        if (!(opts.snapshotExists ?? true)) return null;
        return { id: SNAPSHOT_ID, snapshotHash: hash };
      },
    },
    reportApproval: {
      findFirst: async (args: any) => {
        calls.push('approval.findFirst');
        if (args?.where?.revokedAt === null) {
          if (args?.where?.id !== undefined) {
            // For dispatch lookup: query has approval `id` in where clause
            if (opts.approvalForDispatch !== undefined) return opts.approvalForDispatch;
            return {
              id: 'approval-1',
              reportSnapshotId: SNAPSHOT_ID,
            };
          }
          // For duplicate check in approveSnapshot: query has snapshotHash, no id
          if (opts.existingActiveApproval) {
            return { id: 'existing-approval', reportSnapshotId: SNAPSHOT_ID };
          }
          return null;
        }
        return null;
      },
      create: async (args: any) => {
        calls.push('approval.create');
        return {
          id: opts.approval?.id ?? 'approval-new-1',
          approvedBy: args.data.approvedBy,
          approvedAt: opts.approval?.approvedAt ?? new Date('2026-07-05T12:00:00Z'),
          snapshotHash: args.data.snapshotHash,
          revokedAt: null,
          ...args.data,
        };
      },
    },
    reportDispatch: {
      create: async (args: any) => {
        calls.push('dispatch.create');
        return {
          id: opts.createdDispatch?.id ?? 'dispatch-1',
          reportSnapshotId: args.data.reportSnapshotId,
          reportApprovalId: args.data.reportApprovalId,
          status: 'PENDING',
          recipientHash: opts.createdDispatch?.recipientHash ?? 'recipient-hash-abc',
          contentHash: args.data.contentHash,
          sentBy: args.data.sentBy,
          ...args.data,
          recipients: { create: args.data.recipients?.create ?? [] },
        };
      },
    },
    _calls: calls,
  } as any;
};

// ─── REPORT-005: Approve snapshot ────────────────────────────────────────────

describe('report approval', () => {
  it('admin approval succeeds with matching snapshot hash', async () => {
    const db = makeApprovalDb();
    const result = await approveSnapshot(db, {
      actor: adminActor,
      workspaceId: WORKSPACE_ID,
      reportSnapshotId: SNAPSHOT_ID,
      expectedSnapshotHash: SNAPSHOT_HASH,
    });

    expect(result.approvalId).toBeTruthy();
    expect(result.reportSnapshotId).toBe(SNAPSHOT_ID);
    expect(result.snapshotHash).toBe(SNAPSHOT_HASH);
    expect(result.approvedBy).toBe('actor-1');
    expect(result.sideEffects.createsReportApproval).toBe(true);
    expect(result.sideEffects.dispatchesReport).toBe(false);
    expect(result.sideEffects.sendsEmail).toBe(false);
  });

  it('rejects stale snapshot hash', async () => {
    const db = makeApprovalDb({ snapshotHash: 'correct-hash-' + 'a'.repeat(50) });

    await expect(
      approveSnapshot(db, {
        actor: adminActor,
        workspaceId: WORKSPACE_ID,
        reportSnapshotId: SNAPSHOT_ID,
        expectedSnapshotHash: 'wrong-hash',
      }),
    ).rejects.toThrow(ReportApprovalError);

    await expect(
      approveSnapshot(db, {
        actor: adminActor,
        workspaceId: WORKSPACE_ID,
        reportSnapshotId: SNAPSHOT_ID,
        expectedSnapshotHash: 'wrong-hash',
      }),
    ).rejects.toThrow(/verouderd/);
  });

  it('rejects viewer/non-admin actor with Dutch error', async () => {
    const db = makeApprovalDb();

    await expect(
      approveSnapshot(db, {
        actor: viewerActor,
        workspaceId: WORKSPACE_ID,
        reportSnapshotId: SNAPSHOT_ID,
        expectedSnapshotHash: SNAPSHOT_HASH,
      }),
    ).rejects.toThrow(ReportApprovalError);

    await expect(
      approveSnapshot(db, {
        actor: viewerActor,
        workspaceId: WORKSPACE_ID,
        reportSnapshotId: SNAPSHOT_ID,
        expectedSnapshotHash: SNAPSHOT_HASH,
      }),
    ).rejects.toThrow(/beheerders/);
  });

  it('rejects when snapshot not found in workspace', async () => {
    const db = makeApprovalDb({ snapshotExists: false });

    await expect(
      approveSnapshot(db, {
        actor: adminActor,
        workspaceId: WORKSPACE_ID,
        reportSnapshotId: SNAPSHOT_ID,
        expectedSnapshotHash: SNAPSHOT_HASH,
      }),
    ).rejects.toThrow(ReportApprovalError);
  });

  it('rejects when linked period close is reopened', async () => {
    const db = makeApprovalDb({ periodCloseStatus: PeriodCloseStatus.REOPENED });

    await expect(
      approveSnapshot(db, {
        actor: adminActor,
        workspaceId: WORKSPACE_ID,
        reportSnapshotId: SNAPSHOT_ID,
        expectedSnapshotHash: SNAPSHOT_HASH,
      }),
    ).rejects.toThrow(ReportApprovalError);

    await expect(
      approveSnapshot(db, {
        actor: adminActor,
        workspaceId: WORKSPACE_ID,
        reportSnapshotId: SNAPSHOT_ID,
        expectedSnapshotHash: SNAPSHOT_HASH,
      }),
    ).rejects.toThrow(/heropend/);
  });

  it('rejects duplicate active approval for same snapshot hash', async () => {
    const db = makeApprovalDb({ existingActiveApproval: true });

    await expect(
      approveSnapshot(db, {
        actor: adminActor,
        workspaceId: WORKSPACE_ID,
        reportSnapshotId: SNAPSHOT_ID,
        expectedSnapshotHash: SNAPSHOT_HASH,
      }),
    ).rejects.toThrow(ReportApprovalError);
  });
});

// ─── REPORT-005: Prepare dispatch ────────────────────────────────────────────

describe('report dispatch', () => {
  const dispatchInput = {
    actor: adminActor,
    workspaceId: WORKSPACE_ID,
    reportSnapshotId: SNAPSHOT_ID,
    reportApprovalId: 'approval-1',
    fromAddress: 'finance@example.test',
    subject: 'Financieel rapport januari 2026',
    recipients: [{ email: 'admin@example.test', name: 'Administrator' }],
    contentHash: 'content-hash-' + 'b'.repeat(51),
  };

  it('dispatch requires active approval and creates PENDING metadata', async () => {
    const db = makeApprovalDb();
    const result = await prepareDispatch(db, dispatchInput);

    expect(result.dispatchId).toBeTruthy();
    expect(result.reportSnapshotId).toBe(SNAPSHOT_ID);
    expect(result.reportApprovalId).toBe('approval-1');
    expect(result.status).toBe('PENDING');
    expect(result.contentHash).toBe(dispatchInput.contentHash);
    expect(result.recipientHash).toHaveLength(64);
    expect(result.sideEffects.createsReportDispatch).toBe(true);
    expect(result.sideEffects.sendsEmail).toBe(false);
    expect(result.sideEffects.callsExternalProvider).toBe(false);
  });

  it('dispatch stores recipient hash not plain emails', async () => {
    const db = makeApprovalDb();
    const result = await prepareDispatch(db, dispatchInput);

    // recipientHash is a 64-char hex sha256, not a raw email
    expect(result.recipientHash).toHaveLength(64);
    expect(result.recipientHash).not.toContain('@');
  });

  it('dispatch rejected when approval is revoked (e.g. after period reopen)', async () => {
    const db = makeApprovalDb({
      approvalForDispatch: null,
    });

    await expect(
      prepareDispatch(db, dispatchInput),
    ).rejects.toThrow(ReportApprovalError);

    await expect(
      prepareDispatch(db, dispatchInput),
    ).rejects.toThrow(/goedkeuring/);
  });

  it('viewer cannot prepare dispatch', async () => {
    const db = makeApprovalDb();

    await expect(
      prepareDispatch(db, {
        ...dispatchInput,
        actor: viewerActor,
      }),
    ).rejects.toThrow(ReportApprovalError);
  });

  it('dispatch requires at least one recipient', async () => {
    const db = makeApprovalDb();

    await expect(
      prepareDispatch(db, {
        ...dispatchInput,
        recipients: [],
      }),
    ).rejects.toThrow(ReportApprovalError);
  });

  it('dispatch rejected when snapshot not found in workspace', async () => {
    const db = makeApprovalDb({ snapshotExists: false });

    await expect(
      prepareDispatch(db, dispatchInput),
    ).rejects.toThrow(ReportApprovalError);
  });

  it('no external email call is made', async () => {
    const db = makeApprovalDb();
    const result = await prepareDispatch(db, dispatchInput);

    // Side effects must explicitly state no email
    expect(result.sideEffects.sendsEmail).toBe(false);
    expect(result.sideEffects.callsExternalProvider).toBe(false);
  });
});

// ─── REPORT-005: Execute dispatch (real send) ────────────────────────────────

const makeExecuteDb = (opts: {
  snapshotExists?: boolean;
  approvalActive?: boolean;
  dispatchPending?: boolean;
  updatedStatus?: string | null;
} = {}) => {
  let lastUpdate: any = null;

  return {
    reportSnapshot: {
      findFirst: async () =>
        (opts.snapshotExists ?? true) ? { id: SNAPSHOT_ID } : null,
    },
    reportApproval: {
      findFirst: async () =>
        (opts.approvalActive ?? true)
          ? { id: 'approval-1', reportSnapshotId: SNAPSHOT_ID, revokedAt: null }
          : null,
    },
    reportDispatch: {
      findFirst: async () =>
        (opts.dispatchPending ?? true)
          ? { id: 'dispatch-1', status: 'PENDING' }
          : null,
      update: async (args: any) => {
        lastUpdate = args;
        return { id: 'dispatch-1', ...args.data };
      },
    },
    get _lastUpdate() { return lastUpdate; },
  } as any;
};

describe('report dispatch execute (real send)', () => {
  const baseExecuteInput = {
    actor: adminActor,
    workspaceId: WORKSPACE_ID,
    reportSnapshotId: SNAPSHOT_ID,
    reportApprovalId: 'approval-1',
    dispatchId: 'dispatch-1',
    fromAddress: 'Yeshua Academy Finance <info@yeshua.academy>',
    subject: 'Financieel rapport januari 2026',
    recipients: [{ email: 'admin@example.test', name: 'Administrator' }],
    contentHash: 'content-hash-' + 'c'.repeat(51),
    html: '<p>Rapport</p>',
    provider: new NoSendProvider(),
  };

  it('calls injected provider once and returns SENT on success', async () => {
    const db = makeExecuteDb();
    const provider = new NoSendProvider();
    const result = await executeDispatch(db, { ...baseExecuteInput, provider });

    expect(result.status).toBe('SENT');
    expect(result.sideEffects.sendsEmail).toBe(true);
    expect(result.sideEffects.callsExternalProvider).toBe(true);
    expect(provider.calls).toHaveLength(1);
    expect(provider.calls[0].to).toEqual(['admin@example.test']);
  });

  it('sets sendsEmail true and callsExternalProvider true on success', async () => {
    const db = makeExecuteDb();
    const result = await executeDispatch(db, baseExecuteInput);

    expect(result.sideEffects.sendsEmail).toBe(true);
    expect(result.sideEffects.callsExternalProvider).toBe(true);
  });

  it('returns FAILED with sanitized error when provider fails', async () => {
    const failProvider: ReportEmailProvider = {
      send: async (): Promise<ReportEmailResult> => ({
        success: false,
        providerMessageId: null,
        errorMessage: 'Rate limit exceeded',
      }),
    };

    const db = makeExecuteDb();
    const result = await executeDispatch(db, { ...baseExecuteInput, provider: failProvider });

    expect(result.status).toBe('FAILED');
    expect(result.sideEffects.sendsEmail).toBe(false);
    expect(result.sideEffects.callsExternalProvider).toBe(true);
    expect(result.errorMessage).toBe('Rate limit exceeded');
    expect(result.errorMessage).not.toContain('re_');
  });

  it('rejects when recipients list is empty', async () => {
    const db = makeExecuteDb();

    await expect(
      executeDispatch(db, { ...baseExecuteInput, recipients: [] }),
    ).rejects.toThrow(ReportApprovalError);
  });

  it('rejects malformed recipients', async () => {
    const db = makeExecuteDb();

    await expect(
      executeDispatch(db, {
        ...baseExecuteInput,
        recipients: [{ email: 'not-an-email' }],
      }),
    ).rejects.toThrow(/geldige e-mailadressen/);
  });

  it('rejects when approval is revoked', async () => {
    const db = makeExecuteDb({ approvalActive: false });

    await expect(
      executeDispatch(db, baseExecuteInput),
    ).rejects.toThrow(/goedkeuring/);
  });

  it('rejects when dispatch is not in PENDING status', async () => {
    const db = makeExecuteDb({ dispatchPending: false });

    await expect(
      executeDispatch(db, baseExecuteInput),
    ).rejects.toThrow(/PENDING/);
  });

  it('rejects when snapshot not found in workspace', async () => {
    const db = makeExecuteDb({ snapshotExists: false });

    await expect(
      executeDispatch(db, baseExecuteInput),
    ).rejects.toThrow(ReportApprovalError);
  });

  it('viewer cannot execute dispatch', async () => {
    const db = makeExecuteDb();

    await expect(
      executeDispatch(db, { ...baseExecuteInput, actor: viewerActor }),
    ).rejects.toThrow(/beheerders/);
  });

  it('metadata-only prepareDispatch still reports sendsEmail false', async () => {
    const db = makeApprovalDb();
    const result = await prepareDispatch(db, {
      actor: adminActor,
      workspaceId: WORKSPACE_ID,
      reportSnapshotId: SNAPSHOT_ID,
      reportApprovalId: 'approval-1',
      fromAddress: 'finance@example.test',
      subject: 'Test',
      recipients: [{ email: 'admin@example.test' }],
      contentHash: 'hash-1',
    });

    expect(result.sideEffects.sendsEmail).toBe(false);
    expect(result.sideEffects.callsExternalProvider).toBe(false);
  });

  it('no raw rows or secrets are included in provider calls', async () => {
    const provider = new NoSendProvider();
    const db = makeExecuteDb();
    await executeDispatch(db, { ...baseExecuteInput, provider });

    const callJson = JSON.stringify(provider.calls);
    expect(callJson).not.toContain('re_');
    expect(callJson).not.toContain('RESEND_API_KEY');
    expect(callJson).not.toContain('postgresql://');
    expect(callJson).not.toContain('DATABASE_URL');
  });

  it('recipient hash/content hash behavior remains deterministic', async () => {
    const db1 = makeApprovalDb();
    const db2 = makeApprovalDb();
    const input = {
      actor: adminActor,
      workspaceId: WORKSPACE_ID,
      reportSnapshotId: SNAPSHOT_ID,
      reportApprovalId: 'approval-1',
      fromAddress: 'finance@example.test',
      subject: 'Test',
      recipients: [{ email: 'admin@example.test', name: 'Admin' }],
      contentHash: 'deterministic-content-hash',
    };

    const r1 = await prepareDispatch(db1, input);
    const r2 = await prepareDispatch(db2, input);
    expect(r1.recipientHash).toBe(r2.recipientHash);
    expect(r1.contentHash).toBe(r2.contentHash);
  });
});
