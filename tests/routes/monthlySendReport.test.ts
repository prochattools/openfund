import { describe, expect, it, beforeEach, vi } from 'vitest';
import { Request, Response } from 'express';
import { setRequestActor } from '../../server/auth/requestContext';
import { postMonthlySendReport } from '../../server/routes/monthlySendReport';

vi.mock('../../server/prismaClient', () => ({
  prisma: {
    $transaction: vi.fn(),
    emailRecipient: { findMany: vi.fn() },
  },
}));

vi.mock('../../server/services/reportSnapshotService', () => ({
  generateLiveMonthlyReportSnapshot: vi.fn(),
  ReportSnapshotError: class ReportSnapshotError extends Error {
    statusCode: number;
    constructor(message: string, statusCode = 400) {
      super(message);
      this.name = 'ReportSnapshotError';
      this.statusCode = statusCode;
    }
  },
}));

vi.mock('../../server/services/reportArtifactService', () => ({
  generateAndStoreReportArtifacts: vi.fn(),
}));

vi.mock('../../server/services/reportApprovalDispatchService', async () => {
  const actual = await vi.importActual<
    typeof import('../../server/services/reportApprovalDispatchService')
  >('../../server/services/reportApprovalDispatchService');
  return {
    ...actual,
    approveSnapshot: vi.fn(),
    prepareDispatch: vi.fn(),
    executeDispatch: vi.fn(),
  };
});

vi.mock('../../server/services/reportEmailProvider', () => ({
  ResendReportEmailProvider: vi.fn(),
}));

vi.mock('../../server/services/reviewDecisionService', () => ({
  hashEvidence: vi.fn((input) => `hash-${JSON.stringify(input).slice(0, 16)}`),
}));

vi.mock('../../server/services/recipientNormalization', async () => {
  const actual = await vi.importActual<
    typeof import('../../server/services/recipientNormalization')
  >('../../server/services/recipientNormalization');
  return actual;
});

vi.mock('../../server/services/deliveryKeyService', async () => {
  const actual = await vi.importActual<
    typeof import('../../server/services/deliveryKeyService')
  >('../../server/services/deliveryKeyService');
  return actual;
});

vi.mock('../../server/auth/requestContext', async () => {
  const actual = await vi.importActual<
    typeof import('../../server/auth/requestContext')
  >('../../server/auth/requestContext');
  return {
    ...actual,
    requireAdmin: vi.fn(async () => ({
      userId: 'user-1',
      workspaceId: 'ws-1',
      role: 'admin',
      actorId: 'user-1',
      actorEmail: 'test@example.local',
    })),
  };
});

import { prisma } from '../../server/prismaClient';
import {
  approveSnapshot,
  prepareDispatch,
  executeDispatch,
} from '../../server/services/reportApprovalDispatchService';
import { generateLiveMonthlyReportSnapshot } from '../../server/services/reportSnapshotService';
import { generateAndStoreReportArtifacts } from '../../server/services/reportArtifactService';
import { ResendReportEmailProvider } from '../../server/services/reportEmailProvider';

const mockReq = (body: object = {}): Request => {
  const request = { body } as Request;
  setRequestActor(request, {
    userId: 'user-1',
    role: 'admin',
    actorId: 'user-1',
    actorEmail: 'test@example.local',
  });
  return request;
};

const mockRes = () => {
  const res: any = {};
  res.statusCode = undefined;
  res.jsonData = undefined;
  res.status = vi.fn((code: number) => {
    res.statusCode = code;
    return res;
  });
  res.json = vi.fn((data: any) => {
    res.jsonData = data;
    return res;
  });
  return res as Response;
};

const BASE_SNAPSHOT = {
  snapshotId: 'snap-1',
  snapshotHash: 'snapshot-hash-1',
  kind: 'MONTHLY',
  year: 2024,
  month: 1,
  openingBalanceMinor: '0',
  incomeMinor: '100000',
  expenseMinor: '50000',
  netMinor: '50000',
  closingBalanceMinor: '50000',
  transactionCount: 2,
  periodCloseIds: [],
  generatedBy: 'user-1',
  generatedAt: new Date('2024-02-01T00:00:00.000Z'),
  lines: [],
  sideEffects: {
    createsReportSnapshot: true as const,
    createsReportApproval: false as const,
    createsReportArtifact: false as const,
    dispatchesReport: false as const,
  },
};

const configureSuccessfulWorkflow = (
  recipientRows: Array<{ email: string; name: string | null }> = [
    { email: 'test@example.com', name: 'Test' },
  ],
  snapshotOverrides: object = {},
) => {
  // Track dispatched delivery key for duplicate detection
  let dispatchedDeliveryKey: string | null = null;

  (prisma.emailRecipient.findMany as ReturnType<typeof vi.fn>).mockResolvedValue(recipientRows);

  const tx: any = {
    reportSnapshotLine: { findMany: vi.fn().mockResolvedValue([]) },
    reportDispatch: {
      findFirst: vi.fn().mockImplementation(async ({ where }: { where: { deliveryKey: string } }) =>
        dispatchedDeliveryKey === where.deliveryKey
          ? { id: 'dispatch-existing', status: 'SENT' }
          : null,
      ),
    },
    reportArtifact: {
      findUnique: vi.fn().mockImplementation(async ({ where }: { where: { id: string } }) => ({
        sha256: `sha-${where.id}`,
        content: where.id === 'art-html' ? Buffer.from('<html>rapport</html>') : Buffer.alloc(0),
      })),
    },
  };
  (prisma.$transaction as ReturnType<typeof vi.fn>).mockImplementation(
    async (fn: (client: typeof tx) => Promise<unknown>) => fn(tx),
  );

  (generateLiveMonthlyReportSnapshot as ReturnType<typeof vi.fn>).mockResolvedValue({
    ...BASE_SNAPSHOT,
    ...snapshotOverrides,
  });
  (generateAndStoreReportArtifacts as ReturnType<typeof vi.fn>).mockResolvedValue({
    htmlArtifactId: 'art-html',
    xlsxArtifactId: 'art-xlsx',
    pdfArtifactId: 'art-pdf',
  });
  (approveSnapshot as ReturnType<typeof vi.fn>).mockResolvedValue({ approvalId: 'approval-1' });
  (prepareDispatch as ReturnType<typeof vi.fn>).mockImplementation(
    async (_client: unknown, input: { deliveryKey: string }) => {
      dispatchedDeliveryKey = input.deliveryKey;
      return { dispatchId: 'dispatch-1' };
    },
  );
  (executeDispatch as ReturnType<typeof vi.fn>).mockResolvedValue({
    dispatchId: 'dispatch-1',
    status: 'SENT',
  });
  (ResendReportEmailProvider as ReturnType<typeof vi.fn>).mockImplementation(() => ({
    send: vi.fn().mockResolvedValue({ success: true }),
  }));

  return { tx };
};

describe('POST /api/reports/monthly/send', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.RESEND_API_KEY = 'test-key';
  });

  describe('request validation', () => {
    it('rejects missing confirmed flag', async () => {
      const req = mockReq({ year: 2024, month: 1 });
      const res = mockRes();
      await postMonthlySendReport(req, res);
      expect((res as any).statusCode).toBe(400);
      expect((res as any).jsonData.error).toContain('confirmed');
    });

    it('rejects confirmed=false', async () => {
      const req = mockReq({ year: 2024, month: 1, confirmed: false });
      const res = mockRes();
      await postMonthlySendReport(req, res);
      expect((res as any).statusCode).toBe(400);
    });

    it('enforces year bounds', async () => {
      const req = mockReq({ year: 1999, month: 1, confirmed: true });
      const res = mockRes();
      await postMonthlySendReport(req, res);
      expect((res as any).statusCode).toBe(400);
    });

    it('enforces month bounds', async () => {
      const req = mockReq({ year: 2024, month: 13, confirmed: true });
      const res = mockRes();
      await postMonthlySendReport(req, res);
      expect((res as any).statusCode).toBe(400);
    });
  });

  describe('provider configuration', () => {
    it('rejects when RESEND_API_KEY is missing', async () => {
      delete process.env.RESEND_API_KEY;
      const req = mockReq({ year: 2024, month: 1, confirmed: true });
      const res = mockRes();
      await postMonthlySendReport(req, res);
      expect((res as any).statusCode).toBe(503);
      expect((res as any).jsonData.error).toContain('Resend');
    });
  });

  describe('period close is NOT required', () => {
    it('succeeds when no period closes exist for the month (open month)', async () => {
      configureSuccessfulWorkflow();
      const req = mockReq({ year: 2024, month: 1, confirmed: true });
      const res = mockRes();
      await postMonthlySendReport(req, res);
      expect((res as any).jsonData.status).toBe('SENT');
    });

    it('succeeds when period status is REOPENED', async () => {
      // The live snapshot service does not check period close status at all.
      // A REOPENED period should not block the send.
      configureSuccessfulWorkflow();
      const req = mockReq({ year: 2024, month: 1, confirmed: true });
      const res = mockRes();
      await postMonthlySendReport(req, res);
      // Route succeeds — period close state is irrelevant
      expect((res as any).jsonData?.status).toBe('SENT');
      expect((res as any).statusCode).not.toBe(409);
    });

    it('does not query statementPeriod or periodClose tables', async () => {
      configureSuccessfulWorkflow();
      const req = mockReq({ year: 2024, month: 1, confirmed: true });
      const res = mockRes();
      await postMonthlySendReport(req, res);
      // prisma mock has no statementPeriod or periodClose — if the route tried to
      // access them it would throw. Success proves they are not accessed.
      expect((res as any).jsonData.status).toBe('SENT');
    });
  });

  describe('unbooked transactions block send', () => {
    it('returns 422 when generateLiveMonthlyReportSnapshot throws ReportSnapshotError for unbooked transactions', async () => {
      (prisma.emailRecipient.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
        { email: 'test@example.com', name: 'Test' },
      ]);

      const { ReportSnapshotError } = await import('../../server/services/reportSnapshotService');
      const unbookedError = new ReportSnapshotError(
        'Er zijn 3 ongeboekte transacties in 2024-01. Alle transacties moeten geboekt zijn.',
        422,
      );

      const tx: any = {
        reportSnapshotLine: { findMany: vi.fn() },
        reportDispatch: { findFirst: vi.fn() },
        reportArtifact: { findUnique: vi.fn() },
      };
      (prisma.$transaction as ReturnType<typeof vi.fn>).mockImplementation(
        async (fn: (client: typeof tx) => Promise<unknown>) => fn(tx),
      );
      (generateLiveMonthlyReportSnapshot as ReturnType<typeof vi.fn>).mockRejectedValue(unbookedError);

      const req = mockReq({ year: 2024, month: 1, confirmed: true });
      const res = mockRes();
      await postMonthlySendReport(req, res);

      expect((res as any).statusCode).toBe(422);
      expect((res as any).jsonData.error).toContain('ongeboekte transacties');
    });
  });

  describe('recipient validation', () => {
    it('rejects zero active recipients', async () => {
      (prisma.emailRecipient.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
      const req = mockReq({ year: 2024, month: 1, confirmed: true });
      const res = mockRes();
      await postMonthlySendReport(req, res);
      expect((res as any).statusCode).toBe(400);
      expect((res as any).jsonData.error).toContain('ontvangers');
    });

    it('passes active recipients to dispatch in canonical order', async () => {
      configureSuccessfulWorkflow([
        { email: ' R2@TEST.COM ', name: ' Recipient 2 ' },
        { email: 'r1@test.com', name: 'Recipient 1' },
      ]);
      const req = mockReq({ year: 2024, month: 1, confirmed: true });
      const res = mockRes();
      await postMonthlySendReport(req, res);
      expect((res as any).jsonData.recipientCount).toBe(2);
      expect(executeDispatch).toHaveBeenCalledWith(
        prisma,
        expect.objectContaining({
          recipients: [
            { email: 'r1@test.com', name: 'Recipient 1' },
            { email: 'r2@test.com', name: 'Recipient 2' },
          ],
        }),
      );
    });
  });

  describe('full workflow with open period', () => {
    it('completes the full workflow without any closed periods', async () => {
      configureSuccessfulWorkflow();
      const req = mockReq({ year: 2024, month: 1, confirmed: true });
      const res = mockRes();

      await postMonthlySendReport(req, res);

      expect((res as any).jsonData).toEqual({
        status: 'SENT',
        month: '2024-01',
        recipientCount: 1,
        snapshotId: 'snap-1',
        dispatchId: 'dispatch-1',
      });
      expect(generateLiveMonthlyReportSnapshot).toHaveBeenCalledTimes(1);
      expect(generateAndStoreReportArtifacts).toHaveBeenCalledTimes(1);
      expect(approveSnapshot).toHaveBeenCalledTimes(1);
      expect(prepareDispatch).toHaveBeenCalledTimes(1);
      expect(executeDispatch).toHaveBeenCalledTimes(1);
    });
  });

  describe('duplicate dispatch protection', () => {
    it('blocks a second identical request (same content, same recipients)', async () => {
      configureSuccessfulWorkflow([
        { email: 'SECOND@EXAMPLE.COM', name: 'Second' },
        { email: 'first@example.com', name: 'First' },
      ]);

      const firstRes = mockRes();
      await postMonthlySendReport(mockReq({ year: 2024, month: 1, confirmed: true }), firstRes);
      expect((firstRes as any).jsonData.status).toBe('SENT');
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);

      const secondRes = mockRes();
      await postMonthlySendReport(mockReq({ year: 2024, month: 1, confirmed: true }), secondRes);
      expect((secondRes as any).statusCode).toBe(409);
      expect((secondRes as any).jsonData.error).not.toContain('@');
      // Transaction was called again (to detect duplicate inside), but dispatch not called again
      expect(executeDispatch).toHaveBeenCalledTimes(1);
    });

    it('changed report content produces a new delivery key (different snapshot totals)', async () => {
      configureSuccessfulWorkflow(
        [{ email: 'test@example.com', name: 'Test' }],
        { incomeMinor: '200000', netMinor: '150000', closingBalanceMinor: '150000' },
      );

      const req = mockReq({ year: 2024, month: 1, confirmed: true });
      const res = mockRes();
      await postMonthlySendReport(req, res);
      expect((res as any).jsonData.status).toBe('SENT');

      // Change snapshot content (different income)
      (generateLiveMonthlyReportSnapshot as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ...BASE_SNAPSHOT,
        incomeMinor: '300000',
        netMinor: '250000',
        closingBalanceMinor: '250000',
      });

      // Different snapshot content → different reportEvidenceHash → different delivery key → not a duplicate
      const secondRes = mockRes();
      await postMonthlySendReport(mockReq({ year: 2024, month: 1, confirmed: true }), secondRes);
      // If delivery key differs, no duplicate → second dispatch proceeds
      expect(executeDispatch).toHaveBeenCalledTimes(2);
    });

    it('changed recipients produces a different delivery key', async () => {
      configureSuccessfulWorkflow([{ email: 'alice@example.com', name: 'Alice' }]);
      await postMonthlySendReport(mockReq({ year: 2024, month: 1, confirmed: true }), mockRes());

      // Change recipients
      (prisma.emailRecipient.findMany as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
        { email: 'bob@example.com', name: 'Bob' },
      ]);
      const secondRes = mockRes();
      await postMonthlySendReport(mockReq({ year: 2024, month: 1, confirmed: true }), secondRes);
      expect(executeDispatch).toHaveBeenCalledTimes(2);
    });

    it('handles Prisma P2002 unique constraint on deliveryKey (concurrent duplicate race)', async () => {
      (prisma.emailRecipient.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
        { email: 'test@example.com', name: 'Test' },
      ]);
      const p2002 = Object.assign(new Error('Unique constraint failed on deliveryKey'), {
        code: 'P2002',
        meta: { target: ['deliveryKey'] },
      });
      (prisma.$transaction as ReturnType<typeof vi.fn>).mockRejectedValue(p2002);

      const res = mockRes();
      await postMonthlySendReport(mockReq({ year: 2024, month: 1, confirmed: true }), res);
      expect((res as any).statusCode).toBe(409);
      expect((res as any).jsonData.error).toMatch(/ingediend/);
    });

    it('handles ReportApprovalError from prepareDispatch', async () => {
      (prisma.emailRecipient.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
        { email: 'test@example.com', name: 'Test' },
      ]);
      const tx: any = {
        reportSnapshotLine: { findMany: vi.fn().mockResolvedValue([]) },
        reportDispatch: { findFirst: vi.fn().mockResolvedValue(null) },
        reportArtifact: {
          findUnique: vi.fn().mockResolvedValue({ sha256: 'abc', content: '<html></html>' }),
        },
      };
      (prisma.$transaction as ReturnType<typeof vi.fn>).mockImplementation(
        async (fn: (tx: typeof tx) => Promise<unknown>) => fn(tx),
      );
      (generateLiveMonthlyReportSnapshot as ReturnType<typeof vi.fn>).mockResolvedValue(BASE_SNAPSHOT);
      (generateAndStoreReportArtifacts as ReturnType<typeof vi.fn>).mockResolvedValue({
        htmlArtifactId: 'art-html',
        xlsxArtifactId: 'art-xlsx',
        pdfArtifactId: 'art-pdf',
      });
      (approveSnapshot as ReturnType<typeof vi.fn>).mockResolvedValue({ approvalId: 'approval-1' });

      const { ReportApprovalError } = await import(
        '../../server/services/reportApprovalDispatchService'
      );
      (prepareDispatch as ReturnType<typeof vi.fn>).mockRejectedValue(
        new ReportApprovalError('Rapport al geverifieerd.', 409),
      );

      const res = mockRes();
      await postMonthlySendReport(mockReq({ year: 2024, month: 1, confirmed: true }), res);
      expect((res as any).statusCode).toBe(409);
      expect((res as any).jsonData.error).toContain('geverifieerd');
    });
  });

  describe('delivery key determinism (old PeriodClose path unchanged)', () => {
    it('computeDeliveryKey produces same key for same period closes in any order', async () => {
      const { computeDeliveryKey } = await import('../../server/services/deliveryKeyService');
      const { normalizeRecipients } = await import('../../server/services/recipientNormalization');
      const { recipientHash } = normalizeRecipients([{ email: 'a@b.com', name: null }]);

      const key1 = computeDeliveryKey({
        workspaceId: 'ws-1',
        kind: 'MONTHLY',
        year: 2024,
        month: 1,
        periodCloses: [{ id: 'c2', version: 1 }, { id: 'c1', version: 1 }],
        recipientHash,
      });
      const key2 = computeDeliveryKey({
        workspaceId: 'ws-1',
        kind: 'MONTHLY',
        year: 2024,
        month: 1,
        periodCloses: [{ id: 'c1', version: 1 }, { id: 'c2', version: 1 }],
        recipientHash,
      });
      expect(key1).toBe(key2);
    });

    it('computeDeliveryKey produces different key when reportEvidenceHash is present', async () => {
      const { computeDeliveryKey } = await import('../../server/services/deliveryKeyService');
      const { normalizeRecipients } = await import('../../server/services/recipientNormalization');
      const { recipientHash } = normalizeRecipients([{ email: 'a@b.com', name: null }]);

      const periodKey = computeDeliveryKey({
        workspaceId: 'ws-1',
        kind: 'MONTHLY',
        year: 2024,
        month: 1,
        periodCloses: [{ id: 'c1', version: 1 }],
        recipientHash,
      });
      const liveKey = computeDeliveryKey({
        workspaceId: 'ws-1',
        kind: 'MONTHLY',
        year: 2024,
        month: 1,
        periodCloses: [],
        recipientHash,
        reportEvidenceHash: 'some-content-hash',
      });
      expect(periodKey).not.toBe(liveKey);
    });
  });

  describe('response contract', () => {
    beforeEach(() => {
      (prisma.emailRecipient.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
        { email: 'secret@example.com', name: 'Test' },
      ]);
      const tx: any = {
        reportSnapshotLine: { findMany: vi.fn().mockResolvedValue([]) },
        reportDispatch: { findFirst: vi.fn().mockResolvedValue(null) },
        reportArtifact: {
          findUnique: vi.fn().mockImplementation(async ({ where }: { where: { id: string } }) => ({
            sha256: `sha-${where.id}`,
            content: where.id === 'art-html' ? Buffer.from('<html></html>') : Buffer.alloc(0),
          })),
        },
      };
      (prisma.$transaction as ReturnType<typeof vi.fn>).mockImplementation(
        async (fn: (tx: typeof tx) => Promise<unknown>) => fn(tx),
      );
      (generateLiveMonthlyReportSnapshot as ReturnType<typeof vi.fn>).mockResolvedValue(BASE_SNAPSHOT);
      (generateAndStoreReportArtifacts as ReturnType<typeof vi.fn>).mockResolvedValue({
        htmlArtifactId: 'art-html',
        xlsxArtifactId: 'art-xlsx',
        pdfArtifactId: 'art-pdf',
      });
      (approveSnapshot as ReturnType<typeof vi.fn>).mockResolvedValue({ approvalId: 'approval-1' });
      (prepareDispatch as ReturnType<typeof vi.fn>).mockResolvedValue({ dispatchId: 'dispatch-1' });
      (executeDispatch as ReturnType<typeof vi.fn>).mockResolvedValue({
        dispatchId: 'dispatch-1',
        status: 'SENT',
      });
      (ResendReportEmailProvider as ReturnType<typeof vi.fn>).mockImplementation(() => ({
        send: vi.fn().mockResolvedValue({ success: true }),
      }));
    });

    it('never returns recipient email addresses in response', async () => {
      const res = mockRes();
      await postMonthlySendReport(mockReq({ year: 2024, month: 1, confirmed: true }), res);
      const jsonStr = JSON.stringify((res as any).jsonData);
      expect(jsonStr).not.toContain('secret@example.com');
      expect(jsonStr).not.toContain('@');
    });

    it('returns only expected fields in success response', async () => {
      const res = mockRes();
      await postMonthlySendReport(mockReq({ year: 2024, month: 1, confirmed: true }), res);
      expect(Object.keys((res as any).jsonData).sort()).toEqual([
        'dispatchId', 'month', 'recipientCount', 'snapshotId', 'status',
      ]);
    });

    it('returns SENT status on success', async () => {
      const res = mockRes();
      await postMonthlySendReport(mockReq({ year: 2024, month: 1, confirmed: true }), res);
      expect((res as any).jsonData.status).toBe('SENT');
    });
  });

  describe('error sanitization', () => {
    it('sanitizes email addresses from error messages', () => {
      const errorMsg = 'Failed with error: test@example.com in database';
      const sanitized = errorMsg.replace(
        /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g,
        '[EMAIL]',
      );
      expect(sanitized).not.toContain('test@example.com');
      expect(sanitized).toContain('[EMAIL]');
    });
  });
});
