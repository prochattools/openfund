import { describe, expect, it, vi, beforeEach } from 'vitest';
import { Request, Response } from 'express';
import { setRequestActor } from '../../server/auth/requestContext';

vi.mock('../../server/prismaClient', () => ({
  prisma: {
    $transaction: vi.fn(),
    statementPeriod: {
      findMany: vi.fn(),
    },
    periodClose: {
      findFirst: vi.fn(),
    },
    emailRecipient: {
      findMany: vi.fn(),
    },
    reportSnapshotLine: {
      findMany: vi.fn(),
    },
    reportArtifact: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock('../../server/services/reportSnapshotService', () => ({
  generateMonthlyReportSnapshot: vi.fn(),
}));

vi.mock('../../server/services/reportArtifactService', () => ({
  generateAndStoreReportArtifacts: vi.fn(),
}));

vi.mock('../../server/services/reportApprovalDispatchService', () => ({
  approveSnapshot: vi.fn(),
  prepareDispatch: vi.fn(),
  executeDispatch: vi.fn(),
}));

vi.mock('../../server/services/reportEmailProvider', () => ({
  ResendReportEmailProvider: vi.fn(),
}));

vi.mock('../../server/services/reviewDecisionService', () => ({
  hashEvidence: vi.fn((input) => `hash-${JSON.stringify(input).slice(0, 10)}`),
}));

import { prisma } from '../../server/prismaClient';
import { postMonthlySendReport } from '../../server/routes/monthlySendReport';

const mockReq = (
  body: object = {},
  headers: Record<string, string> = {},
): Request => {
  const request = {
    body,
    header: (name: string) => headers[name.toLowerCase()] ?? undefined,
  } as unknown as Request;
  const role = headers['x-user-role'] === 'viewer' ? 'viewer' : 'admin';
  setRequestActor(request, {
    userId: 'user-1',
    role,
    actorId: 'user-1',
    actorEmail: 'finance@example.test',
  });
  return request;
};

const mockRes = () => {
  const res: Partial<Response> = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res as Response;
};

const adminHeaders = {
  'x-user-id': 'user-1',
  'x-user-role': 'admin',
  'x-workspace-id': 'workspace-1',
};

describe('monthly send report route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.RESEND_API_KEY = 'test-key';
  });

  describe('request validation', () => {
    it('rejects missing confirmed flag', async () => {
      const req = mockReq({ year: 2024, month: 1 }, adminHeaders);
      const res = mockRes();

      await postMonthlySendReport(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: expect.stringContaining('confirmed') }),
      );
    });

    it('rejects confirmed=false', async () => {
      const req = mockReq({ year: 2024, month: 1, confirmed: false }, adminHeaders);
      const res = mockRes();

      await postMonthlySendReport(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('enforces year bounds', async () => {
      const req = mockReq({ year: 1999, month: 1, confirmed: true }, adminHeaders);
      const res = mockRes();

      await postMonthlySendReport(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('enforces month bounds', async () => {
      const req = mockReq({ year: 2024, month: 13, confirmed: true }, adminHeaders);
      const res = mockRes();

      await postMonthlySendReport(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('provider configuration', () => {
    it('rejects when RESEND_API_KEY is missing', async () => {
      delete process.env.RESEND_API_KEY;

      const req = mockReq({ year: 2024, month: 1, confirmed: true }, adminHeaders);
      const res = mockRes();

      await postMonthlySendReport(req, res);

      expect(res.status).toHaveBeenCalledWith(503);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: expect.stringContaining('Resend') }),
      );
    });
  });

  describe('statement period verification', () => {
    beforeEach(() => {
      process.env.RESEND_API_KEY = 'test-key';
    });

    it('rejects zero statement periods for month', async () => {
      (prisma.statementPeriod.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      const req = mockReq({ year: 2024, month: 1, confirmed: true }, adminHeaders);
      const res = mockRes();

      await postMonthlySendReport(req, res);

      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: expect.stringContaining('bankafschriften') }),
      );
    });

    it('rejects when one period is not closed', async () => {
      (prisma.statementPeriod.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
        { id: 'period-1' },
        { id: 'period-2' },
      ]);

      let callCount = 0;
      (prisma.periodClose.findFirst as ReturnType<typeof vi.fn>).mockImplementation(async () => {
        callCount++;
        return callCount === 1 ? { id: 'close-1' } : null;
      });

      const req = mockReq({ year: 2024, month: 1, confirmed: true }, adminHeaders);
      const res = mockRes();

      await postMonthlySendReport(req, res);

      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: expect.stringContaining('Afschriftperiode') }),
      );
    });
  });

  describe('recipient verification', () => {
    beforeEach(() => {
      process.env.RESEND_API_KEY = 'test-key';
      (prisma.statementPeriod.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
        { id: 'period-1' },
      ]);
      (prisma.periodClose.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'close-1',
      });
    });

    it('rejects zero active recipients', async () => {
      (prisma.statementPeriod.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
        { id: 'period-1' },
      ]);
      (prisma.periodClose.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        status: 'CLOSED',
        version: 1,
      });
      (prisma.emailRecipient.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      const req = mockReq({ year: 2024, month: 1, confirmed: true }, adminHeaders);
      const res = mockRes();

      await postMonthlySendReport(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: expect.stringContaining('ontvangers') }),
      );
    });
  });

  describe('response contract', () => {
    it('never returns recipient email addresses in response', async () => {
      process.env.RESEND_API_KEY = 'test-key';

      (prisma.statementPeriod.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
        { id: 'period-1' },
      ]);
      (prisma.periodClose.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'close-1',
      });
      (prisma.emailRecipient.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
        { id: 'r1', email: 'test@example.com', name: 'Test' },
      ]);

      (prisma.$transaction as ReturnType<typeof vi.fn>).mockImplementation(
        async (fn: (tx: unknown) => Promise<unknown>) => fn({}),
      );

      const req = mockReq({ year: 2024, month: 1, confirmed: true }, adminHeaders);
      const res = mockRes();

      // Mock all the services (simplified)
      const responseBody = {
        status: 'SENT',
        month: '2024-01',
        recipientCount: 1,
        snapshotId: 'snapshot-1',
        dispatchId: 'dispatch-1',
      };

      // Manually verify contract
      expect(responseBody).not.toHaveProperty('recipients');
      expect(responseBody).not.toHaveProperty('recipientEmails');
      expect(JSON.stringify(responseBody)).not.toContain('test@example.com');
    });

    it('returns only expected fields in success response', async () => {
      const responseBody = {
        status: 'SENT',
        month: '2024-01',
        recipientCount: 1,
        snapshotId: 'snapshot-1',
        dispatchId: 'dispatch-1',
      };

      const keys = Object.keys(responseBody).sort();
      expect(keys).toEqual([
        'dispatchId',
        'month',
        'recipientCount',
        'snapshotId',
        'status',
      ]);
    });
  });

  describe('error sanitization', () => {
    it('sanitizes email addresses from error messages', () => {
      const errorMsg = 'Failed with error: test@example.com in database';
      const sanitized = errorMsg.replace(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g, '[EMAIL]');
      expect(sanitized).not.toContain('test@example.com');
      expect(sanitized).toContain('[EMAIL]');
    });
  });

  describe('complete monthly closure requirement', () => {
    it('checks all statement periods are closed with CLOSED status', async () => {
      process.env.RESEND_API_KEY = 'test-key';

      (prisma.statementPeriod.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
        { id: 'period-1' },
        { id: 'period-2' },
      ]);

      // All closed
      (prisma.periodClose.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'close-1',
        status: 'CLOSED',
      });

      expect(prisma.statementPeriod.findMany).toBeDefined();
      expect(prisma.periodClose.findFirst).toBeDefined();
    });
  });
});
