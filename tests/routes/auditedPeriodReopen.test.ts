import { beforeEach, describe, expect, it, vi } from 'vitest';
import { setRequestActor } from '../../server/auth/requestContext';
import { postAuditedPeriodReopen } from '../../server/routes/auditedPeriodReopen';
import { AuditedReopenError } from '../../server/services/auditedPeriodReopenService';

const routeMocks = vi.hoisted(() => ({
  prismaTransaction: vi.fn(),
  executeAuditedReopen: vi.fn(),
}));

vi.mock('../../server/prismaClient', () => ({
  prisma: {
    $transaction: routeMocks.prismaTransaction,
  },
}));

vi.mock('../../server/services/auditedPeriodReopenService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../server/services/auditedPeriodReopenService')>();
  return {
    ...actual,
    executeAuditedReopen: routeMocks.executeAuditedReopen,
  };
});

const makeResponse = () => {
  const response = {
    statusCode: 200,
    body: undefined as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    },
  };

  return response;
};

const makeRequest = ({
  body = { reason: 'Correctie na controle' },
  params = { id: 'close-1' },
  role = 'admin',
  workspaceHeader = 'workspace-1',
}: {
  body?: Record<string, unknown>;
  params?: Record<string, string>;
  role?: 'admin' | 'viewer';
  workspaceHeader?: string | null;
} = {}) => {
  const request = {
    body,
    params,
    header: (name: string) => (name === 'x-workspace-id' ? workspaceHeader ?? undefined : undefined),
  };
  setRequestActor(request, {
    userId: 'user-1',
    role,
    actorId: 'user-1',
    actorEmail: 'finance@example.test',
  });
  return request;
};

const successResult = {
  closeId: 'close-1',
  priorStatus: 'CLOSED',
  newStatus: 'REOPENED',
  reopenedAt: new Date('2026-07-05T12:00:00.000Z'),
  revokedApprovalCount: 2,
  affectedReportSnapshotIds: ['snapshot-1'],
  sideEffects: {
    updatesPeriodClose: true,
    writesAuditLog: true,
    revokesReportApprovals: true,
    createsReportSnapshot: false,
    createsTransactionBooking: false,
    dispatchesReport: false,
  },
};

describe('audited period reopen route', () => {
  beforeEach(() => {
    routeMocks.prismaTransaction.mockReset();
    routeMocks.executeAuditedReopen.mockReset();
    routeMocks.prismaTransaction.mockImplementation((callback: (tx: unknown) => unknown) => callback({}));
  });

  it('allows an admin to reopen with a non-empty reason and workspace id inside a transaction', async () => {
    routeMocks.executeAuditedReopen.mockResolvedValueOnce(successResult);
    const response = makeResponse();

    await postAuditedPeriodReopen(makeRequest() as any, response as any);

    expect(routeMocks.prismaTransaction).toHaveBeenCalledTimes(1);
    expect(routeMocks.executeAuditedReopen).toHaveBeenCalledWith(expect.anything(), {
      actor: {
        userId: 'user-1',
        role: 'admin',
        actorId: 'user-1',
        actorEmail: 'finance@example.test',
      },
      workspaceId: 'workspace-1',
      periodCloseId: 'close-1',
      reason: 'Correctie na controle',
    });
    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({
      closeId: 'close-1',
      priorStatus: 'CLOSED',
      newStatus: 'REOPENED',
      reopenedAt: '2026-07-05T12:00:00.000Z',
      revokedApprovalCount: 2,
      affectedReportSnapshotIds: ['snapshot-1'],
      sideEffects: successResult.sideEffects,
    });
  });

  it('can pass workspace id from the request body when the header is absent', async () => {
    routeMocks.executeAuditedReopen.mockResolvedValueOnce(successResult);
    const response = makeResponse();

    await postAuditedPeriodReopen(makeRequest({
      workspaceHeader: null,
      body: { reason: 'Correctie', workspaceId: 'workspace-body' },
    }) as any, response as any);

    expect(routeMocks.executeAuditedReopen).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      workspaceId: 'workspace-body',
    }));
  });

  it('rejects viewer actors before opening a transaction', async () => {
    const response = makeResponse();

    await postAuditedPeriodReopen(makeRequest({ role: 'viewer' }) as any, response as any);

    expect(response.statusCode).toBe(403);
    expect(response.body).toEqual({ error: 'Alleen beheerders mogen deze actie uitvoeren.' });
    expect(routeMocks.prismaTransaction).not.toHaveBeenCalled();
    expect(routeMocks.executeAuditedReopen).not.toHaveBeenCalled();
  });

  it('rejects blank reasons before opening a transaction', async () => {
    const response = makeResponse();

    await postAuditedPeriodReopen(makeRequest({ body: { reason: '   ' } }) as any, response as any);

    expect(response.statusCode).toBe(400);
    expect(response.body).toEqual({ error: 'Een heropenreden is verplicht.' });
    expect(routeMocks.prismaTransaction).not.toHaveBeenCalled();
  });

  it('rejects missing workspace id before opening a transaction', async () => {
    const response = makeResponse();

    await postAuditedPeriodReopen(makeRequest({
      workspaceHeader: null,
      body: { reason: 'Correctie' },
    }) as any, response as any);

    expect(response.statusCode).toBe(400);
    expect(response.body).toEqual({ error: 'Werkruimte-ID is verplicht.' });
    expect(routeMocks.prismaTransaction).not.toHaveBeenCalled();
  });

  it('maps missing close to 404 without exposing workspace existence', async () => {
    routeMocks.executeAuditedReopen.mockRejectedValueOnce(
      new AuditedReopenError('Periode-afsluiting niet gevonden.', 404),
    );
    const response = makeResponse();

    await postAuditedPeriodReopen(makeRequest() as any, response as any);

    expect(response.statusCode).toBe(404);
    expect(response.body).toEqual({ error: 'Periode-afsluiting niet gevonden.' });
  });

  it('maps already reopened or non-CLOSED close to 409', async () => {
    routeMocks.executeAuditedReopen.mockRejectedValueOnce(
      new AuditedReopenError('Alleen gesloten periodes kunnen heropend worden. Status is REOPENED.', 409),
    );
    const response = makeResponse();

    await postAuditedPeriodReopen(makeRequest() as any, response as any);

    expect(response.statusCode).toBe(409);
    expect(response.body).toEqual({
      error: 'Alleen gesloten periodes kunnen heropend worden. Status is REOPENED.',
    });
  });

  it('returns sanitized side-effect flags and does not create reports, dispatches, bookings, or new closes', async () => {
    routeMocks.executeAuditedReopen.mockResolvedValueOnce(successResult);
    const response = makeResponse();

    await postAuditedPeriodReopen(makeRequest() as any, response as any);

    expect(response.body).toMatchObject({
      sideEffects: {
        updatesPeriodClose: true,
        writesAuditLog: true,
        revokesReportApprovals: true,
        createsReportSnapshot: false,
        createsTransactionBooking: false,
        dispatchesReport: false,
      },
    });
    const serialized = JSON.stringify(response.body);
    expect(serialized).not.toContain('"createsReportSnapshot":true');
    expect(serialized).not.toContain('"createsTransactionBooking":true');
    expect(serialized).not.toContain('"dispatchesReport":true');
    expect(serialized).not.toContain('rawRow');
  });
});
