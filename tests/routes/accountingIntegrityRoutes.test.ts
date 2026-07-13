import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getAccountingAudit: vi.fn(),
  repairApprovedOpeningBalance: vi.fn(),
}));

vi.mock('../../server/prismaClient', () => ({ prisma: {} }));
vi.mock('../../server/services/accountingAuditService', () => ({
  getAccountingAudit: mocks.getAccountingAudit,
}));
vi.mock('../../server/services/openingBalanceRepairService', () => ({
  repairApprovedOpeningBalance: mocks.repairApprovedOpeningBalance,
}));

import { getAccountingAuditReport } from '../../server/routes/accountingAudit';
import { postOpeningBalanceRepair } from '../../server/routes/openingBalanceRepair';

const makeRequest = (options: {
  role?: 'admin' | 'viewer';
  body?: unknown;
  query?: Record<string, string>;
  cookie?: string | null;
} = {}) => ({
  body: options.body ?? {},
  query: options.query ?? {},
  params: {},
  header: (name: string) => {
    if (name === 'x-user-id') return 'user-1';
    if (name === 'x-user-role') return options.role ?? 'viewer';
    if (name === 'x-actor-id') return 'actor-1';
    if (name === 'x-user-email') return 'admin@example.test';
    if (name === 'cookie') return options.cookie === undefined ? 'ory_kratos_session=session-1' : options.cookie;
    return undefined;
  },
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

describe('accounting integrity routes', () => {
  beforeEach(() => {
    mocks.getAccountingAudit.mockReset();
    mocks.repairApprovedOpeningBalance.mockReset();
  });

  it('allows read-only accounting audit access without administrator mutation rights', async () => {
    const originalNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      const audit = {
        status: 'PASSED',
        readOnly: true,
        sideEffects: {
          createsOpeningBalance: false,
          createsTransactionBooking: false,
          createsCategorizationSuggestion: false,
          closesPeriod: false,
          createsReportSnapshot: false,
        },
      };
      mocks.getAccountingAudit.mockResolvedValue(audit);
      const req = makeRequest({
        role: 'viewer',
        query: { accountIdentifier: 'NL89INGB0006369960' },
      });
      const res = makeResponse();

      await getAccountingAuditReport(req as any, res as any);

      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual(audit);
      expect(mocks.getAccountingAudit).toHaveBeenCalledWith(
        expect.anything(),
        { userId: 'user-1', accountIdentifier: 'NL89INGB0006369960' },
      );
      expect(mocks.repairApprovedOpeningBalance).not.toHaveBeenCalled();
    } finally {
      process.env.NODE_ENV = originalNodeEnv;
    }
  });

  it('rejects unauthenticated production accounting audit requests before calling the service', async () => {
    const originalNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      const req = makeRequest({ role: 'viewer', cookie: null, query: { accountIdentifier: 'NL89INGB0006369960' } });
      const res = makeResponse();

      await getAccountingAuditReport(req as any, res as any);

      expect(res.statusCode).toBe(401);
      expect(res.body).toEqual({ error: 'Authenticatie vereist.' });
      expect(mocks.getAccountingAudit).not.toHaveBeenCalled();
      expect(mocks.repairApprovedOpeningBalance).not.toHaveBeenCalled();
    } finally {
      process.env.NODE_ENV = originalNodeEnv;
    }
  });

  it('rejects opening-balance repair for viewers before calling the service', async () => {
    const req = makeRequest({ role: 'viewer', body: { execute: true, confirmApprovedControl: true } });
    const res = makeResponse();

    await postOpeningBalanceRepair(req as any, res as any);

    expect(res.statusCode).toBe(403);
    expect(res.body).toEqual({ error: 'Alleen beheerders mogen deze actie uitvoeren.' });
    expect(mocks.repairApprovedOpeningBalance).not.toHaveBeenCalled();
  });

  it('keeps administrator repair dry-run by default', async () => {
    mocks.repairApprovedOpeningBalance.mockResolvedValue({
      status: 'WOULD_CREATE',
      dryRun: true,
      writesPerformed: false,
    });
    const req = makeRequest({ role: 'admin', body: {} });
    const res = makeResponse();

    await postOpeningBalanceRepair(req as any, res as any);

    expect(res.statusCode).toBe(200);
    expect(mocks.repairApprovedOpeningBalance).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        userId: 'user-1',
        execute: false,
        confirmApprovedControl: false,
        actorId: 'actor-1',
        actorEmail: 'admin@example.test',
      }),
    );
  });

  it('does not bypass the environment execution gate from request JSON', async () => {
    mocks.repairApprovedOpeningBalance.mockResolvedValue({
      status: 'EXECUTION_NOT_ALLOWED',
      dryRun: false,
      writesPerformed: false,
    });
    const req = makeRequest({
      role: 'admin',
      body: {
        execute: true,
        confirmApprovedControl: true,
        executionAllowed: true,
      },
    });
    const res = makeResponse();

    await postOpeningBalanceRepair(req as any, res as any);

    expect(res.statusCode).toBe(409);
    expect(mocks.repairApprovedOpeningBalance).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        execute: true,
        confirmApprovedControl: true,
        executionAllowed: false,
      }),
    );
  });
});
