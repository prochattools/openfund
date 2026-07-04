import { describe, expect, it } from 'vitest';
import {
  PeriodCloseStatus,
  ReportArtifactFormat,
  ReportKind,
  ReportLineKind,
  StatementCoverageStatus,
} from '@prisma/client';
import {
  approveReportSnapshot,
  assertCanClose,
  createPeriodClose,
  createReportDispatch,
  createReportSnapshot,
  hashReportArtifact,
  PeriodCloseError,
  reopenPeriodClose,
  type BalancedReconciliationEvidence,
} from '../../server/services/periodCloseService';

const balancedEvidence: BalancedReconciliationEvidence = {
  status: 'BALANCED',
  coverageStatus: StatementCoverageStatus.COMPLETE,
  balanceDifferenceMinor: 0n,
  categoryIncomeDifferenceMinor: 0n,
  categoryExpenseDifferenceMinor: 0n,
  runningBalanceErrorCount: 0,
  transactionCount: 2,
  bookedTransactionCount: 2,
  unresolvedTransactionCount: 0,
  validatorVersion: 'test-v1',
};

describe('period close service', () => {
  it('rejects incomplete or unbalanced reconciliation evidence', () => {
    expect(() => assertCanClose({
      ...balancedEvidence,
      coverageStatus: StatementCoverageStatus.PARTIAL,
    })).toThrow(PeriodCloseError);
    expect(() => assertCanClose({
      ...balancedEvidence,
      unresolvedTransactionCount: 1,
    })).toThrow(PeriodCloseError);
  });

  it('creates an immutable versioned period close with hashed evidence', async () => {
    const calls: any[] = [];
    const db = {
      periodClose: {
        findFirst: async (args: any) => {
          calls.push(['findLatest', args]);
          return { version: 2 };
        },
        create: async (args: any) => {
          calls.push(['createClose', args]);
          return { id: 'close-3', ...args.data };
        },
      },
    } as any;

    const close = await createPeriodClose(db, {
      workspaceId: 'workspace-1',
      ledgerId: 'ledger-1',
      statementId: 'statement-1',
      statementPeriodId: 'period-1',
      periodStart: new Date('2026-01-01T00:00:00Z'),
      periodEnd: new Date('2026-01-31T23:59:59Z'),
      openingBalanceMinor: 1000n,
      incomeMinor: 250n,
      expenseMinor: 100n,
      closingBalanceMinor: 1150n,
      transactionCount: 2,
      closedBy: 'admin-1',
      reconciliationEvidence: balancedEvidence,
      classificationEvidence: { bookingIds: ['booking-1', 'booking-2'] },
      sourceDataEvidence: { sourceFileId: 'source-1' },
    });

    expect(close.version).toBe(3);
    expect(close.status).toBe(PeriodCloseStatus.CLOSED);
    expect(close.netMinor).toBe(150n);
    expect(close.classificationHash).toHaveLength(64);
    expect(close.sourceDataHash).toHaveLength(64);
    expect(calls[1][1].data.reconciliationEvidence.status).toBe('BALANCED');
  });

  it('requires a reopen reason and writes an audit log', async () => {
    const calls: any[] = [];
    const db = {
      periodClose: {
        update: async (args: any) => {
          calls.push(['updateClose', args]);
          return { id: 'close-1', ...args.data };
        },
      },
      auditLog: {
        create: async (args: any) => {
          calls.push(['audit', args]);
          return { id: 'audit-1', ...args.data };
        },
      },
    } as any;

    await expect(reopenPeriodClose(db, {
      closeId: 'close-1',
      reopenedBy: 'admin-1',
      reason: '   ',
      auditUserId: 'user-1',
    })).rejects.toThrow(PeriodCloseError);

    const reopened = await reopenPeriodClose(db, {
      closeId: 'close-1',
      reopenedBy: 'admin-1',
      reason: 'Correctie bankafschrift',
      auditUserId: 'user-1',
      actorEmail: 'finance@example.test',
    });

    expect(reopened.status).toBe(PeriodCloseStatus.REOPENED);
    expect(calls[1][0]).toBe('audit');
    expect(calls[1][1].data.action).toBe('period.close.reopened');
  });

  it('creates frozen report snapshots with period close links and exact lines', async () => {
    const calls: any[] = [];
    const db = {
      reportSnapshot: {
        create: async (args: any) => {
          calls.push(['createSnapshot', args]);
          return { id: 'snapshot-1', ...args.data };
        },
      },
    } as any;

    const snapshot = await createReportSnapshot(db, {
      workspaceId: 'workspace-1',
      kind: ReportKind.MONTHLY,
      year: 2026,
      month: 1,
      openingBalanceMinor: 1000n,
      incomeMinor: 250n,
      expenseMinor: 100n,
      closingBalanceMinor: 1150n,
      transactionCount: 2,
      generatedBy: 'admin-1',
      periodCloseIds: ['close-1'],
      lines: [{
        lineKind: ReportLineKind.PROJECT,
        projectId: 'project-1',
        literalProjectLabel: 'YA',
        amountMinor: 250n,
        transactionCount: 1,
        sortOrder: 1,
      }],
    });

    expect(snapshot.snapshotHash).toHaveLength(64);
    expect(calls[0][1].data.periodCloseLinks.create).toEqual([{ periodCloseId: 'close-1', sortOrder: 1 }]);
    expect(calls[0][1].data.lines.create[0]).toMatchObject({
      lineKind: ReportLineKind.PROJECT,
      projectId: 'project-1',
      literalProjectLabel: 'YA',
      amountMinor: 250n,
    });
  });

  it('approves snapshots and creates dispatch attempts only from active approvals', async () => {
    const calls: any[] = [];
    const db = {
      reportSnapshot: {
        findUnique: async () => ({ id: 'snapshot-1', snapshotHash: 'hash-1' }),
      },
      reportApproval: {
        create: async (args: any) => {
          calls.push(['createApproval', args]);
          return { id: 'approval-1', ...args.data };
        },
        findFirst: async (args: any) => {
          calls.push(['findApproval', args]);
          return { id: 'approval-1', reportSnapshotId: 'snapshot-1' };
        },
      },
      reportDispatch: {
        create: async (args: any) => {
          calls.push(['createDispatch', args]);
          return { id: 'dispatch-1', ...args.data };
        },
      },
    } as any;

    const approval = await approveReportSnapshot(db, {
      reportSnapshotId: 'snapshot-1',
      approvedBy: 'admin-1',
    });
    const dispatch = await createReportDispatch(db, {
      reportSnapshotId: 'snapshot-1',
      reportApprovalId: approval.id,
      fromAddress: 'finance@example.test',
      subject: 'Januari rapport',
      recipients: [{ email: 'admin@example.test', name: 'Admin' }],
      contentHash: 'content-hash',
      sentBy: 'admin-1',
    });

    expect(approval.snapshotHash).toBe('hash-1');
    expect(dispatch.status).toBe('PENDING');
    expect(dispatch.recipientHash).toHaveLength(64);
    expect(calls[2][1].data.recipients.create).toEqual([{ email: 'admin@example.test', name: 'Admin' }]);
  });

  it('hashes report artifacts from retained bytes', () => {
    const artifact = hashReportArtifact({
      format: ReportArtifactFormat.HTML,
      filename: 'rapport.html',
      mediaType: 'text/html',
      content: '<html>rapport</html>',
    });

    expect(artifact.sha256).toHaveLength(64);
    expect(artifact.sizeBytes).toBe(Buffer.from('<html>rapport</html>').byteLength);
  });
});
