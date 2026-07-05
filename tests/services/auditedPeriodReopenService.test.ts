import { describe, expect, it } from 'vitest';
import {
  executeAuditedReopen,
  AuditedReopenError,
  type AuditedReopenInput,
} from '../../server/services/auditedPeriodReopenService';

const adminActor = {
  userId: 'user-1',
  role: 'admin' as const,
  actorId: 'admin-1',
  actorEmail: 'admin@example.test',
};

const viewerActor = {
  userId: 'user-2',
  role: 'viewer' as const,
  actorId: 'viewer-1',
  actorEmail: 'viewer@example.test',
};

const makePeriodClose = (overrides: Partial<any> = {}) => ({
  id: 'close-1',
  workspaceId: 'workspace-1',
  status: 'CLOSED',
  reportSnapshotLinks: [],
  ...overrides,
});

const makeDb = (overrides: {
  periodClose?: object | null;
  activeApprovals?: object[];
  capturedUpdates?: { periodClose?: object; approvals?: object[] };
} = {}) => {
  const captured = overrides.capturedUpdates || { periodClose: null, approvals: [] };
  const calls: any[] = [];
  const periodCloseDefault = makePeriodClose();

  const db = {
    periodClose: {
      findFirst: async (opts: any) => {
        calls.push({ model: 'periodClose', method: 'findFirst', opts });
        const close = overrides.periodClose !== undefined
          ? overrides.periodClose
          : periodCloseDefault;
        if (close && (close as any).workspaceId !== opts.where.workspaceId) {
          return null;
        }
        return close as any;
      },
      update: async (_opts: any) => {
        calls.push({ model: 'periodClose', method: 'update', opts: _opts });
        const result = {
          id: 'close-1',
          status: 'REOPENED',
          reopenedBy: adminActor.actorId,
          reopenedAt: new Date('2026-07-05T12:00:00Z'),
          reopenReason: 'Testing',
        };
        captured.periodClose = result;
        return result;
      },
    },
    reportApproval: {
      findMany: async (opts: any) => {
        calls.push({ model: 'reportApproval', method: 'findMany', opts });
        return overrides.activeApprovals ?? [];
      },
      updateMany: async (opts: any) => {
        calls.push({ model: 'reportApproval', method: 'updateMany', opts });
        captured.approvals = overrides.activeApprovals ?? [];
        return { count: (overrides.activeApprovals ?? []).length };
      },
    },
    auditLog: {
      create: async (opts: any) => {
        calls.push({ model: 'auditLog', method: 'create', opts });
        return { id: 'audit-1' };
      },
    },
  };

  return { db, calls };
};

describe('auditedPeriodReopenService', () => {
  describe('executeAuditedReopen', () => {
    it('should reopen closed period for admin with non-empty reason', async () => {
      const periodClose = makePeriodClose();
      const { db } = makeDb({ periodClose }) as any;

      const result = await executeAuditedReopen(db, {
        actor: adminActor,
        workspaceId: 'workspace-1',
        periodCloseId: 'close-1',
        reason: 'Correction needed',
      });

      expect(result.closeId).toBe('close-1');
      expect(result.priorStatus).toBe('CLOSED');
      expect(result.newStatus).toBe('REOPENED');
      expect(result.revokedApprovalCount).toBe(0);
      expect(result.affectedReportSnapshotIds).toEqual([]);
      expect(result.sideEffects.updatesPeriodClose).toBe(true);
      expect(result.sideEffects.writesAuditLog).toBe(true);
      expect(result.sideEffects.revokesReportApprovals).toBe(false);
    });

    it('should write exactly one audit event', async () => {
      const periodClose = makePeriodClose();
      let auditCreated = false;
      const { db } = makeDb({ periodClose }) as any;
      const originalCreate = db.auditLog.create;
      db.auditLog.create = async (opts: any) => {
        expect(opts.data.action).toBe('period.close.reopened');
        expect(opts.data.entityType).toBe('periodClose');
        expect(opts.data.entityId).toBe('close-1');
        expect(opts.data.before).toBeDefined();
        expect(opts.data.after).toBeDefined();
        auditCreated = true;
        return originalCreate.call(db.auditLog, opts);
      };

      await executeAuditedReopen(db, {
        actor: adminActor,
        workspaceId: 'workspace-1',
        periodCloseId: 'close-1',
        reason: 'Testing',
      });

      expect(auditCreated).toBe(true);
    });

    it('should revoke active report approvals for linked report snapshots', async () => {
      const approvals = [
        { id: 'approval-1', reportSnapshotId: 'snapshot-1' },
        { id: 'approval-2', reportSnapshotId: 'snapshot-1' },
      ];
      const periodClose = makePeriodClose({
        reportSnapshotLinks: [{ reportSnapshotId: 'snapshot-1' }],
      });
      const { db } = makeDb({ periodClose, activeApprovals: approvals }) as any;

      let updateManyCalled = false;
      const originalUpdateMany = db.reportApproval.updateMany;
      db.reportApproval.updateMany = async (opts: any) => {
        expect(opts.where.id.in).toContain('approval-1');
        expect(opts.where.id.in).toContain('approval-2');
        expect(opts.data.revokedBy).toBe(adminActor.actorId);
        expect(opts.data.revokedAt).toBeDefined();
        expect(opts.data.revokeReason).toContain('Testing');
        updateManyCalled = true;
        return originalUpdateMany.call(db.reportApproval, opts);
      };

      const result = await executeAuditedReopen(db, {
        actor: adminActor,
        workspaceId: 'workspace-1',
        periodCloseId: 'close-1',
        reason: 'Testing',
      });

      expect(updateManyCalled).toBe(true);
      expect(result.revokedApprovalCount).toBe(2);
      expect(result.affectedReportSnapshotIds).toContain('snapshot-1');
    });

    it('should not revoke approvals that are already revoked', async () => {
      const periodClose = makePeriodClose({
        reportSnapshotLinks: [{ reportSnapshotId: 'snapshot-1' }],
      });
      const { db } = makeDb({ periodClose, activeApprovals: [] }) as any;

      const result = await executeAuditedReopen(db, {
        actor: adminActor,
        workspaceId: 'workspace-1',
        periodCloseId: 'close-1',
        reason: 'Testing',
      });

      expect(result.revokedApprovalCount).toBe(0);
    });

    it('should reject viewer/non-admin', async () => {
      const periodClose = makePeriodClose();
      const { db } = makeDb({ periodClose }) as any;

      await expect(
        executeAuditedReopen(db, {
          actor: viewerActor,
          workspaceId: 'workspace-1',
          periodCloseId: 'close-1',
          reason: 'Testing',
        }),
      ).rejects.toThrow(AuditedReopenError);
    });

    it('should reject blank reason', async () => {
      const periodClose = makePeriodClose();
      const { db } = makeDb({ periodClose }) as any;

      await expect(
        executeAuditedReopen(db, {
          actor: adminActor,
          workspaceId: 'workspace-1',
          periodCloseId: 'close-1',
          reason: '   ',
        }),
      ).rejects.toThrow(AuditedReopenError);
    });

    it('should reject missing period close', async () => {
      const { db } = makeDb({ periodClose: null }) as any;

      await expect(
        executeAuditedReopen(db, {
          actor: adminActor,
          workspaceId: 'workspace-1',
          periodCloseId: 'missing',
          reason: 'Testing',
        }),
      ).rejects.toThrow(AuditedReopenError);
    });

    it('should reject already reopened close', async () => {
      const periodClose = makePeriodClose({ status: 'REOPENED' });
      const { db } = makeDb({ periodClose }) as any;

      await expect(
        executeAuditedReopen(db, {
          actor: adminActor,
          workspaceId: 'workspace-1',
          periodCloseId: 'close-1',
          reason: 'Testing',
        }),
      ).rejects.toThrow(AuditedReopenError);
    });

    it('should store reopenedBy, reopenedAt, and reopenReason', async () => {
      const periodClose = makePeriodClose();
      const captured: any = {};
      const { db } = makeDb({ periodClose, capturedUpdates: captured }) as any;
      const originalUpdate = db.periodClose.update;
      db.periodClose.update = async (opts: any) => {
        captured.periodClose = await originalUpdate.call(db.periodClose, opts);
        expect(opts.data.reopenedBy).toBe(adminActor.actorId);
        expect(opts.data.reopenedAt).toBeDefined();
        expect(opts.data.reopenReason).toBe('Testing');
        return captured.periodClose;
      };

      await executeAuditedReopen(db, {
        actor: adminActor,
        workspaceId: 'workspace-1',
        periodCloseId: 'close-1',
        reason: 'Testing',
      });

      expect(captured.periodClose?.reopenedBy).toBe(adminActor.actorId);
      expect(captured.periodClose?.reopenReason).toBe('Testing');
    });

    it('should create no PeriodClose, ReportSnapshot, ReportArtifact, ReportDispatch, or TransactionBooking', async () => {
      const periodClose = makePeriodClose();
      const { db } = makeDb({ periodClose }) as any;
      const creationMethods = [
        'periodClose',
        'reportSnapshot',
        'reportArtifact',
        'reportDispatch',
        'transactionBooking',
      ];

      for (const method of creationMethods) {
        db[method] = db[method] || {};
        db[method].create = async () => {
          throw new Error(`Should not create ${method}`);
        };
      }

      const result = await executeAuditedReopen(db, {
        actor: adminActor,
        workspaceId: 'workspace-1',
        periodCloseId: 'close-1',
        reason: 'Testing',
      });

      expect(result.sideEffects.createsReportSnapshot).toBe(false);
      expect(result.sideEffects.createsTransactionBooking).toBe(false);
      expect(result.sideEffects.dispatchesReport).toBe(false);
    });

    it('should return affected snapshot ids and revoked approval count', async () => {
      const approvals = [
        { id: 'approval-1', reportSnapshotId: 'snapshot-1' },
        { id: 'approval-2', reportSnapshotId: 'snapshot-2' },
      ];
      const periodClose = makePeriodClose({
        reportSnapshotLinks: [
          { reportSnapshotId: 'snapshot-1' },
          { reportSnapshotId: 'snapshot-2' },
        ],
      });
      const { db } = makeDb({ periodClose, activeApprovals: approvals }) as any;

      const result = await executeAuditedReopen(db, {
        actor: adminActor,
        workspaceId: 'workspace-1',
        periodCloseId: 'close-1',
        reason: 'Testing',
      });

      expect(result.revokedApprovalCount).toBe(2);
      expect(result.affectedReportSnapshotIds.length).toBe(2);
      expect(result.affectedReportSnapshotIds).toContain('snapshot-1');
      expect(result.affectedReportSnapshotIds).toContain('snapshot-2');
    });

    it('should query period close by id and workspaceId', async () => {
      const { db, calls } = makeDb({ periodClose: makePeriodClose() }) as any;

      await executeAuditedReopen(db, {
        actor: adminActor,
        workspaceId: 'workspace-1',
        periodCloseId: 'close-1',
        reason: 'Testing',
      });

      expect(calls.find((call: any) => call.model === 'periodClose' && call.method === 'findFirst')?.opts.where).toEqual({
        id: 'close-1',
        workspaceId: 'workspace-1',
      });
    });

    it('should reject a close from another workspace as not found', async () => {
      const { db, calls } = makeDb({
        periodClose: makePeriodClose({ workspaceId: 'workspace-other' }),
      }) as any;

      await expect(
        executeAuditedReopen(db, {
          actor: adminActor,
          workspaceId: 'workspace-1',
          periodCloseId: 'close-1',
          reason: 'Testing',
        }),
      ).rejects.toMatchObject({
        message: 'Periode-afsluiting niet gevonden.',
        statusCode: 404,
      });

      expect(calls.some((call: any) => call.model === 'periodClose' && call.method === 'update')).toBe(false);
      expect(calls.some((call: any) => call.model === 'auditLog')).toBe(false);
    });
  });
});
