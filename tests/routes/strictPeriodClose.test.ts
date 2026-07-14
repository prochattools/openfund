import { describe, expect, it, vi } from 'vitest';
import { Request, Response } from 'express';
import { setRequestActor } from '../../server/auth/requestContext';

vi.mock('../../server/prismaClient', () => ({
  prisma: {
    $transaction: vi.fn(),
  },
}));

vi.mock('../../server/services/strictPeriodCloseService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../server/services/strictPeriodCloseService')>();
  return {
    ...actual,
    executeStrictPeriodClose: vi.fn(),
  };
});

import { prisma } from '../../server/prismaClient';
import { executeStrictPeriodClose } from '../../server/services/strictPeriodCloseService';
import { postStrictPeriodClose } from '../../server/routes/strictPeriodClose';
import { StrictPeriodCloseError } from '../../server/services/strictPeriodCloseService';

const mockReq = (
  params: Record<string, string> = {},
  headers: Record<string, string> = {},
  body: object = {},
): Request => {
  const request = {
    params,
    header: (name: string) => headers[name.toLowerCase()] ?? undefined,
    body,
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

const successResult = {
  closeId: 'close-1',
  version: 1,
  statementPeriodId: 'period-1',
  ledgerId: 'ledger-1',
  periodStart: '2026-01-01',
  periodEnd: '2026-01-31',
  closeControlHash: 'abc123',
  combinedPreview: {
    combinedStatus: 'BALANCED',
    combinedCloseEligible: true,
  },
  sideEffects: {
    createsPeriodClose: true,
    createsReportSnapshot: false,
    createsTransactionBooking: false,
    dispatchesReport: false,
  },
};

describe('strict period close route', () => {
  it('is admin-only — rejects viewer', async () => {
    const req = mockReq(
      { id: 'period-1' },
      { 'x-user-id': 'user-1', 'x-user-role': 'viewer', 'x-workspace-id': 'workspace-1' },
      { ledgerId: 'ledger-1', confirmed: true },
    );
    const res = mockRes();

    await postStrictPeriodClose(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.stringContaining('beheerders') }),
    );
  });

  it('rejects missing statement period id', async () => {
    const req = mockReq(
      {},
      adminHeaders,
      { ledgerId: 'ledger-1', confirmed: true },
    );
    const res = mockRes();

    await postStrictPeriodClose(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('rejects missing ledgerId', async () => {
    const req = mockReq(
      { id: 'period-1' },
      adminHeaders,
      { confirmed: true },
    );
    const res = mockRes();

    await postStrictPeriodClose(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('rejects missing workspaceId', async () => {
    const req = mockReq(
      { id: 'period-1' },
      { 'x-user-id': 'user-1', 'x-user-role': 'admin' },
      { ledgerId: 'ledger-1', confirmed: true },
    );
    const res = mockRes();

    await postStrictPeriodClose(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('calls executeStrictPeriodClose inside a transaction and returns 201 with close summary', async () => {
    (prisma.$transaction as ReturnType<typeof vi.fn>).mockImplementation(
      async (fn: (tx: unknown) => Promise<unknown>) => fn({}),
    );
    (executeStrictPeriodClose as ReturnType<typeof vi.fn>).mockResolvedValue(successResult);

    const req = mockReq(
      { id: 'period-1' },
      adminHeaders,
      { ledgerId: 'ledger-1', confirmed: true, expectedCloseControlHash: 'hash-123' },
    );
    const res = mockRes();

    await postStrictPeriodClose(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        closeId: 'close-1',
        version: 1,
        sideEffects: expect.objectContaining({
          createsPeriodClose: true,
          createsReportSnapshot: false,
        }),
      }),
    );
  });

  it('returns 201 response with no report snapshots, approvals, or dispatches', async () => {
    (prisma.$transaction as ReturnType<typeof vi.fn>).mockImplementation(
      async (fn: (tx: unknown) => Promise<unknown>) => fn({}),
    );
    (executeStrictPeriodClose as ReturnType<typeof vi.fn>).mockResolvedValue(successResult);

    const req = mockReq(
      { id: 'period-1' },
      adminHeaders,
      { ledgerId: 'ledger-1', confirmed: true },
    );
    const res = mockRes();

    await postStrictPeriodClose(req, res);

    const body = (res.json as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(body.sideEffects.createsReportSnapshot).toBe(false);
    expect(body.sideEffects.createsTransactionBooking).toBe(false);
    expect(body.sideEffects.dispatchesReport).toBe(false);
    expect(JSON.stringify(body)).not.toContain('"createsReportSnapshot":true');
  });

  it('returns 400 when StrictPeriodCloseError is thrown (confirmation missing)', async () => {
    (prisma.$transaction as ReturnType<typeof vi.fn>).mockImplementation(
      async (fn: (tx: unknown) => Promise<unknown>) => fn({}),
    );
    (executeStrictPeriodClose as ReturnType<typeof vi.fn>).mockRejectedValue(
      new StrictPeriodCloseError('Expliciete bevestiging is vereist om een periode te sluiten.', 400),
    );

    const req = mockReq(
      { id: 'period-1' },
      adminHeaders,
      { ledgerId: 'ledger-1', confirmed: false },
    );
    const res = mockRes();

    await postStrictPeriodClose(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns 409 when duplicate close StrictPeriodCloseError is thrown', async () => {
    (prisma.$transaction as ReturnType<typeof vi.fn>).mockImplementation(
      async (fn: (tx: unknown) => Promise<unknown>) => fn({}),
    );
    (executeStrictPeriodClose as ReturnType<typeof vi.fn>).mockRejectedValue(
      new StrictPeriodCloseError('Er bestaat al een actieve afsluiting voor deze afschriftperiode.', 409),
    );

    const req = mockReq(
      { id: 'period-1' },
      adminHeaders,
      { ledgerId: 'ledger-1', confirmed: true },
    );
    const res = mockRes();

    await postStrictPeriodClose(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
  });

  it('returns 409 for stale hash', async () => {
    (prisma.$transaction as ReturnType<typeof vi.fn>).mockImplementation(
      async (fn: (tx: unknown) => Promise<unknown>) => fn({}),
    );
    (executeStrictPeriodClose as ReturnType<typeof vi.fn>).mockRejectedValue(
      new StrictPeriodCloseError('De sluitingscontrolehash is verouderd.', 409),
    );

    const req = mockReq(
      { id: 'period-1' },
      adminHeaders,
      { ledgerId: 'ledger-1', confirmed: true, expectedCloseControlHash: 'stale-hash' },
    );
    const res = mockRes();

    await postStrictPeriodClose(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
  });

  it('returns 500 for unexpected errors', async () => {
    (prisma.$transaction as ReturnType<typeof vi.fn>).mockImplementation(
      async (fn: (tx: unknown) => Promise<unknown>) => fn({}),
    );
    (executeStrictPeriodClose as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('Unexpected DB error'),
    );

    const req = mockReq(
      { id: 'period-1' },
      adminHeaders,
      { ledgerId: 'ledger-1', confirmed: true },
    );
    const res = mockRes();

    await postStrictPeriodClose(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});
