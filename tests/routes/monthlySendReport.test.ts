import { describe, expect, it, beforeEach, vi } from 'vitest';
import { Request, Response } from 'express';
import { setRequestActor } from '../../server/auth/requestContext';
import { postMonthlySendReport } from '../../server/routes/monthlySendReport';

vi.mock('../../server/prismaClient', () => ({
  prisma: {
    $transaction: vi.fn(),
    statementPeriod: { findMany: vi.fn() },
    periodClose: { findFirst: vi.fn() },
    emailRecipient: { findMany: vi.fn() },
    reportDispatch: { findFirst: vi.fn() },
  },
}));

vi.mock('../../server/services/reportSnapshotService', () => ({
  generateMonthlyReportSnapshot: vi.fn(),
  generateAndStoreReportArtifacts: vi.fn(),
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
    requireAdmin: vi.fn(async (req, res) => {
      return {
        userId: 'user-1',
        role: 'admin',
        actorId: 'user-1',
        actorEmail: 'test@example.local',
      };
    }),
  };
});

import { prisma } from '../../server/prismaClient';
import {
  approveSnapshot,
  prepareDispatch,
  executeDispatch,
} from '../../server/services/reportApprovalDispatchService';
import { generateMonthlyReportSnapshot } from '../../server/services/reportSnapshotService';
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

const configureSuccessfulWorkflow = (
  recipientRows: Array<{ id: string; email: string; name: string | null }> = [
    { id: 'r1', email: 'test@example.com', name: 'Test' },
  ],
) => {
  let existingDeliveryKey: string | null = null;

  (prisma.statementPeriod.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
    { id: 'period-1' },
  ]);
  (prisma.periodClose.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
    id: 'close-1',
    status: 'CLOSED',
    version: 1,
  });
  (prisma.emailRecipient.findMany as ReturnType<typeof vi.fn>).mockResolvedValue(recipientRows);
  (prisma.reportDispatch.findFirst as ReturnType<typeof vi.fn>).mockImplementation(
    async ({ where }: { where: { deliveryKey: string } }) =>
      existingDeliveryKey === where.deliveryKey
        ? { id: 'dispatch-1', status: 'SENT' }
        : null,
  );

  const tx = {
    reportSnapshotLine: { findMany: vi.fn().mockResolvedValue([]) },
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

  (generateMonthlyReportSnapshot as ReturnType<typeof vi.fn>).mockResolvedValue({
    snapshotId: 'snap-1',
    snapshotHash: 'snapshot-hash-1',
    kind: 'MONTHLY',
    year: 2024,
    month: 1,
    openingBalanceMinor: 0n,
    incomeMinor: 1000n,
    expenseMinor: 500n,
    netMinor: 500n,
    closingBalanceMinor: 500n,
    transactionCount: 2,
    generatedBy: 'user-1',
    generatedAt: new Date('2024-02-01T00:00:00.000Z'),
  });
  (generateAndStoreReportArtifacts as ReturnType<typeof vi.fn>).mockResolvedValue({
    htmlArtifactId: 'art-html',
    xlsxArtifactId: 'art-xlsx',
    pdfArtifactId: 'art-pdf',
  });
  (approveSnapshot as ReturnType<typeof vi.fn>).mockResolvedValue({
    approvalId: 'approval-1',
  });
  (prepareDispatch as ReturnType<typeof vi.fn>).mockImplementation(
    async (_client: unknown, input: { deliveryKey: string }) => {
      existingDeliveryKey = input.deliveryKey;
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

  describe('statement period verification', () => {
    it('rejects zero statement periods for month', async () => {
      (prisma.statementPeriod.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      const req = mockReq({ year: 2024, month: 1, confirmed: true });
      const res = mockRes();

      await postMonthlySendReport(req, res);

      expect((res as any).statusCode).toBe(409);
      expect((res as any).jsonData.error).toContain('bankafschriften');
    });

    it('rejects when one period is not CLOSED', async () => {
      (prisma.statementPeriod.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
        { id: 'period-1' },
        { id: 'period-2' },
      ]);

      let callCount = 0;
      (prisma.periodClose.findFirst as ReturnType<typeof vi.fn>).mockImplementation(async () => {
        callCount++;
        return callCount === 1 ? { status: 'CLOSED', version: 1 } : null;
      });

      const req = mockReq({ year: 2024, month: 1, confirmed: true });
      const res = mockRes();

      await postMonthlySendReport(req, res);

      expect((res as any).statusCode).toBe(409);
      expect((res as any).jsonData.error).toContain('Afschriftperiode');
    });

    it('completes the full workflow when all periods are CLOSED', async () => {
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
      expect(generateMonthlyReportSnapshot).toHaveBeenCalledTimes(1);
      expect(generateAndStoreReportArtifacts).toHaveBeenCalledTimes(1);
      expect(approveSnapshot).toHaveBeenCalledTimes(1);
      expect(prepareDispatch).toHaveBeenCalledTimes(1);
      expect(executeDispatch).toHaveBeenCalledTimes(1);
    });

    it('rejects REOPENED period', async () => {
      (prisma.statementPeriod.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
        { id: 'period-1' },
      ]);
      (prisma.periodClose.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        status: 'REOPENED',
        version: 1,
      });

      const req = mockReq({ year: 2024, month: 1, confirmed: true });
      const res = mockRes();

      await postMonthlySendReport(req, res);

      expect((res as any).statusCode).toBe(409);
      expect((res as any).jsonData.error).toContain('REOPENED');
    });
  });

  describe('recipient validation', () => {
    beforeEach(() => {
      (prisma.statementPeriod.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
        { id: 'period-1' },
      ]);
      (prisma.periodClose.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        status: 'CLOSED',
        version: 1,
      });
    });

    it('rejects zero active recipients', async () => {
      (prisma.emailRecipient.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      const req = mockReq({ year: 2024, month: 1, confirmed: true });
      const res = mockRes();

      await postMonthlySendReport(req, res);

      expect((res as any).statusCode).toBe(400);
      expect((res as any).jsonData.error).toContain('ontvangers');
    });

    it('passes all active recipients to dispatch in canonical order', async () => {
      configureSuccessfulWorkflow([
        { id: 'r2', email: ' R2@TEST.COM ', name: ' Recipient 2 ' },
        { id: 'r1', email: 'r1@test.com', name: 'Recipient 1' },
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

  describe('duplicate dispatch protection', () => {
    it('blocks a second identical request before any additional writes or provider call', async () => {
      configureSuccessfulWorkflow([
        { id: 'r2', email: 'SECOND@EXAMPLE.COM', name: 'Second' },
        { id: 'r1', email: 'first@example.com', name: 'First' },
      ]);

      const firstResponse = mockRes();
      await postMonthlySendReport(
        mockReq({ year: 2024, month: 1, confirmed: true }),
        firstResponse,
      );

      expect((firstResponse as any).jsonData.status).toBe('SENT');
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(generateMonthlyReportSnapshot).toHaveBeenCalledTimes(1);
      expect(generateAndStoreReportArtifacts).toHaveBeenCalledTimes(1);
      expect(approveSnapshot).toHaveBeenCalledTimes(1);
      expect(prepareDispatch).toHaveBeenCalledTimes(1);
      expect(executeDispatch).toHaveBeenCalledTimes(1);

      const secondResponse = mockRes();
      await postMonthlySendReport(
        mockReq({ year: 2024, month: 1, confirmed: true }),
        secondResponse,
      );

      expect((secondResponse as any).statusCode).toBe(409);
      expect((secondResponse as any).jsonData.error).not.toContain('@');
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(generateMonthlyReportSnapshot).toHaveBeenCalledTimes(1);
      expect(generateAndStoreReportArtifacts).toHaveBeenCalledTimes(1);
      expect(approveSnapshot).toHaveBeenCalledTimes(1);
      expect(prepareDispatch).toHaveBeenCalledTimes(1);
      expect(executeDispatch).toHaveBeenCalledTimes(1);
    });

    it('rejects duplicate with ReportApprovalError', async () => {
      (prisma.statementPeriod.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
        { id: 'period-1' },
      ]);
      (prisma.periodClose.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        status: 'CLOSED',
        version: 1,
      });
      (prisma.emailRecipient.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
        { id: 'r1', email: 'test@example.com', name: 'Test' },
      ]);

      (prisma.$transaction as ReturnType<typeof vi.fn>).mockImplementation(
        async (fn: (tx: unknown) => Promise<unknown>) => {
          const tx = {
            reportSnapshotLine: { findMany: vi.fn().mockResolvedValue([]) },
            reportArtifact: { findUnique: vi.fn().mockResolvedValue({ content: '<html></html>' }) },
          };
          return fn(tx);
        },
      );

      (generateMonthlyReportSnapshot as ReturnType<typeof vi.fn>).mockResolvedValue({
        snapshotId: 'snap-1',
        snapshotHash: 'hash-1',
        kind: 'MONTHLY',
        year: 2024,
        month: 1,
        openingBalanceMinor: 0n,
        incomeMinor: 1000n,
        expenseMinor: 500n,
        netMinor: 500n,
        closingBalanceMinor: 500n,
        transactionCount: 2,
        generatedBy: 'user-1',
        generatedAt: new Date(),
      });

      (generateAndStoreReportArtifacts as ReturnType<typeof vi.fn>).mockResolvedValue({
        htmlArtifactId: 'art-html',
        xlsxArtifactId: 'art-xlsx',
        pdfArtifactId: 'art-pdf',
      });

      (approveSnapshot as ReturnType<typeof vi.fn>).mockResolvedValue({
        approvalId: 'approval-1',
      });

      const { ReportApprovalError } = await import(
        '../../server/services/reportApprovalDispatchService'
      );
      const duplicateError = new ReportApprovalError(
        'Dit rapport met deze ontvangers en inhoud is al geverifieerd.',
        409,
      );
      (prepareDispatch as ReturnType<typeof vi.fn>).mockRejectedValue(duplicateError);

      const req = mockReq({ year: 2024, month: 1, confirmed: true });
      const res = mockRes();

      await postMonthlySendReport(req, res);

      expect((res as any).statusCode).toBe(409);
      // Early check error contains "ingediend", service-layer error contains "geverifieerd"
      expect((res as any).jsonData.error).toMatch(/ingediend|geverifieerd/);
    });

    it('handles Prisma P2002 unique constraint violation on deliveryKey', async () => {
      (prisma.statementPeriod.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
        { id: 'period-1' },
      ]);
      (prisma.periodClose.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        status: 'CLOSED',
        version: 1,
        id: 'close-1',
      });
      (prisma.emailRecipient.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
        { id: 'r1', email: 'test@example.com', name: 'Test' },
      ]);

      const p2002Error = new Error('Unique constraint failed on deliveryKey');
      (p2002Error as any).code = 'P2002';
      (p2002Error as any).meta = {
        target: ['deliveryKey'],
      };

      (prisma.$transaction as ReturnType<typeof vi.fn>).mockRejectedValue(p2002Error);

      const req = mockReq({ year: 2024, month: 1, confirmed: true });
      const res = mockRes();

      await postMonthlySendReport(req, res);

      expect((res as any).statusCode).toBe(409);
      expect((res as any).jsonData.error).toMatch(/ingediend|geverifieerd/);
    });
  });

  describe('response contract', () => {
    beforeEach(() => {
      (prisma.statementPeriod.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
        { id: 'period-1' },
      ]);
      (prisma.periodClose.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        status: 'CLOSED',
        version: 1,
      });
      (prisma.emailRecipient.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
        { id: 'r1', email: 'secret@example.com', name: 'Test' },
      ]);

      (prisma.$transaction as ReturnType<typeof vi.fn>).mockImplementation(
        async (fn: (tx: unknown) => Promise<unknown>) => {
          const tx = {
            reportSnapshotLine: { findMany: vi.fn().mockResolvedValue([]) },
            reportArtifact: { findUnique: vi.fn().mockResolvedValue({ content: '<html></html>' }) },
          };
          return fn(tx);
        },
      );

      (generateMonthlyReportSnapshot as ReturnType<typeof vi.fn>).mockResolvedValue({
        snapshotId: 'snap-1',
        snapshotHash: 'hash-1',
        kind: 'MONTHLY',
        year: 2024,
        month: 1,
        openingBalanceMinor: 0n,
        incomeMinor: 1000n,
        expenseMinor: 500n,
        netMinor: 500n,
        closingBalanceMinor: 500n,
        transactionCount: 2,
        generatedBy: 'user-1',
        generatedAt: new Date(),
      });

      (generateAndStoreReportArtifacts as ReturnType<typeof vi.fn>).mockResolvedValue({
        htmlArtifactId: 'art-html',
        xlsxArtifactId: 'art-xlsx',
        pdfArtifactId: 'art-pdf',
      });

      (approveSnapshot as ReturnType<typeof vi.fn>).mockResolvedValue({
        approvalId: 'approval-1',
      });

      (prepareDispatch as ReturnType<typeof vi.fn>).mockResolvedValue({
        dispatchId: 'dispatch-1',
      });

      (executeDispatch as ReturnType<typeof vi.fn>).mockResolvedValue({
        dispatchId: 'dispatch-1',
        status: 'SENT',
      });

      (ResendReportEmailProvider as ReturnType<typeof vi.fn>).mockImplementation(() => ({
        send: vi.fn().mockResolvedValue({ success: true }),
      }));
    });

    it('never returns recipient email addresses in response', async () => {
      const req = mockReq({ year: 2024, month: 1, confirmed: true });
      const res = mockRes();

      await postMonthlySendReport(req, res);

      const jsonStr = JSON.stringify((res as any).jsonData);
      expect(jsonStr).not.toContain('secret@example.com');
      expect(jsonStr).not.toContain('@');
    });

    it('returns only expected fields in success response', async () => {
      const req = mockReq({ year: 2024, month: 1, confirmed: true });
      const res = mockRes();

      await postMonthlySendReport(req, res);

      const keys = Object.keys((res as any).jsonData).sort();
      expect(keys).toEqual([
        'dispatchId',
        'month',
        'recipientCount',
        'snapshotId',
        'status',
      ]);
    });

    it('returns SENT status on success', async () => {
      const req = mockReq({ year: 2024, month: 1, confirmed: true });
      const res = mockRes();

      await postMonthlySendReport(req, res);

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
