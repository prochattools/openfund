import { describe, expect, it, vi } from 'vitest';
import { Request, Response } from 'express';

vi.mock('../../server/prismaClient', () => ({
  prisma: {
    statementPeriod: {
      findFirst: vi.fn(),
    },
    transaction: {
      findMany: vi.fn(),
    },
  },
}));

import { prisma } from '../../server/prismaClient';
import { getStatementReconciliationPreview } from '../../server/routes/statementReconciliationPreview';

const mockReq = (params: Record<string, string> = {}, headers: Record<string, string> = {}): Request =>
  ({
    params,
    header: (name: string) => headers[name.toLowerCase()] ?? undefined,
  }) as unknown as Request;

const mockRes = () => {
  const res: Partial<Response> = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res as Response;
};

describe('statement reconciliation preview route', () => {
  it('requires admin role', async () => {
    const req = mockReq({ id: 'period-1' }, { 'x-user-id': 'user-1', 'x-user-role': 'viewer' });
    const res = mockRes();

    await getStatementReconciliationPreview(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.stringContaining('beheerders') }),
    );
  });

  it('rejects missing statement period id param', async () => {
    const req = mockReq({}, { 'x-user-id': 'user-1', 'x-user-role': 'admin' });
    const res = mockRes();

    await getStatementReconciliationPreview(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns 404 when statement period is not found', async () => {
    (prisma.statementPeriod.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const req = mockReq({ id: 'period-not-found' }, { 'x-user-id': 'user-1', 'x-user-role': 'admin' });
    const res = mockRes();

    await getStatementReconciliationPreview(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('returns a read-only reconciliation preview for a valid period', async () => {
    (prisma.statementPeriod.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'period-1',
      workspaceId: 'workspace-1',
      accountId: 'account-1',
      periodStart: new Date('2026-01-01T00:00:00Z'),
      periodEnd: new Date('2026-01-31T23:59:59Z'),
      coverageStatus: 'COMPLETE',
      openingBalanceMinor: 100000n,
      incomeMinor: 5000n,
      expenseMinor: 3000n,
      closingBalanceMinor: 102000n,
      transactionCount: 2,
      statement: {
        bankAccountIdentifier: 'NL89INGB0006369960',
        workspaceId: 'workspace-1',
      },
    });

    (prisma.transaction.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        id: 'tx-1',
        amountMinor: 5000n,
        direction: 'credit',
        transactionBooking: { projectId: 'p1', transactionTypeId: 't1', categoryId: 'c1' },
        categorizationSuggestions: [],
      },
      {
        id: 'tx-2',
        amountMinor: 3000n,
        direction: 'debit',
        transactionBooking: { projectId: 'p2', transactionTypeId: 't2', categoryId: 'c2' },
        categorizationSuggestions: [],
      },
    ]);

    const req = mockReq({ id: 'period-1' }, { 'x-user-id': 'user-1', 'x-user-role': 'admin' });
    const res = mockRes();

    await getStatementReconciliationPreview(req, res);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'BALANCED',
        closeEligibility: { eligible: true, reasons: [] },
        sideEffects: {
          createsPeriodClose: false,
          createsReportSnapshot: false,
          closesPeriod: false,
        },
      }),
    );
  });
});
