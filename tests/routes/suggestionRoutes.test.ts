import { beforeEach, describe, expect, it, vi } from 'vitest';
import { setRequestActor } from '../../server/auth/requestContext';

const mocks = vi.hoisted(() => ({
  evaluateHistorySuggestionsForUser: vi.fn(),
  backfillHistorySuggestions: vi.fn(),
}));

vi.mock('../../server/prismaClient', () => ({ prisma: {} }));
vi.mock('../../server/services/historySuggestionEvaluationService', () => ({
  evaluateHistorySuggestionsForUser: mocks.evaluateHistorySuggestionsForUser,
}));
vi.mock('../../server/services/suggestionBackfillService', () => ({
  backfillHistorySuggestions: mocks.backfillHistorySuggestions,
}));

import { getSuggestionEvaluation } from '../../server/routes/suggestionEvaluation';
import { postSuggestionBackfill } from '../../server/routes/suggestionBackfill';

const makeRequest = (options: {
  role?: 'admin' | 'viewer';
  body?: unknown;
  query?: Record<string, string>;
  cookie?: string | null;
} = {}) => {
  const request = {
    body: options.body ?? {},
    query: options.query ?? {},
    params: {},
    header: (name: string) =>
      name === 'cookie' ? (options.cookie === undefined ? 'test-session' : options.cookie) : undefined,
  };
  if (options.cookie !== null) {
    setRequestActor(request, {
      userId: 'user-1',
      role: options.role ?? 'viewer',
      actorId: 'user-1',
      actorEmail: 'admin@example.test',
    });
  }
  return request;
};

const makeResponse = () => ({
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
});

describe('suggestion routes', () => {
  beforeEach(() => {
    mocks.evaluateHistorySuggestionsForUser.mockReset();
    mocks.backfillHistorySuggestions.mockReset();
  });

  it('allows read-only evaluation for viewers and performs no backfill', async () => {
    const originalNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      mocks.evaluateHistorySuggestionsForUser.mockResolvedValue({
        mode: 'chronological',
        sampleCount: 681,
        coveredCount: 680,
        safeguards: {
          createsCategorizationSuggestion: false,
          createsTransactionBooking: false,
          mutatesBankFacts: false,
        },
      });
      const req = makeRequest({ role: 'viewer', query: { mode: 'chronological' } });
      const res = makeResponse();

      await getSuggestionEvaluation(req as any, res as any);

      expect(res.statusCode).toBe(200);
      expect(res.body).toMatchObject({
        mode: 'chronological',
        sampleCount: 681,
        readOnly: true,
      });
      expect(mocks.evaluateHistorySuggestionsForUser).toHaveBeenCalledWith(
        expect.anything(),
        { userId: 'user-1', mode: 'chronological', algorithmVersion: undefined },
      );
      expect(mocks.backfillHistorySuggestions).not.toHaveBeenCalled();
    } finally {
      process.env.NODE_ENV = originalNodeEnv;
    }
  });

  it('rejects unauthenticated production evaluation requests before querying history', async () => {
    const originalNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      const req = makeRequest({ role: 'viewer', cookie: null, query: { mode: 'chronological' } });
      const res = makeResponse();

      await getSuggestionEvaluation(req as any, res as any);

      expect(res.statusCode).toBe(401);
      expect(res.body).toEqual({ error: 'Authenticatie vereist.' });
      expect(mocks.evaluateHistorySuggestionsForUser).not.toHaveBeenCalled();
      expect(mocks.backfillHistorySuggestions).not.toHaveBeenCalled();
    } finally {
      process.env.NODE_ENV = originalNodeEnv;
    }
  });

  it('rejects unsupported evaluation modes before querying history', async () => {
    const req = makeRequest({ query: { mode: 'future-leaking' } });
    const res = makeResponse();

    await getSuggestionEvaluation(req as any, res as any);

    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({
      error: 'Mode moet chronological of leave-one-out zijn.',
      readOnly: true,
    });
    expect(mocks.evaluateHistorySuggestionsForUser).not.toHaveBeenCalled();
  });

  it('rejects suggestion backfill for viewers before calling the service', async () => {
    const req = makeRequest({ role: 'viewer', body: { execute: true, confirmBackfill: true } });
    const res = makeResponse();

    await postSuggestionBackfill(req as any, res as any);

    expect(res.statusCode).toBe(403);
    expect(mocks.backfillHistorySuggestions).not.toHaveBeenCalled();
  });

  it('keeps administrator backfill dry-run by default', async () => {
    mocks.backfillHistorySuggestions.mockResolvedValue({
      status: 'DRY_RUN_COMPLETE',
      dryRun: true,
      writesPerformed: false,
    });
    const req = makeRequest({ role: 'admin', body: {} });
    const res = makeResponse();

    await postSuggestionBackfill(req as any, res as any);

    expect(res.statusCode).toBe(200);
    expect(mocks.backfillHistorySuggestions).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        userId: 'user-1',
        execute: false,
        confirmBackfill: false,
        executionAllowed: false,
      }),
    );
  });

  it('does not accept execution permission from request JSON', async () => {
    mocks.backfillHistorySuggestions.mockResolvedValue({
      status: 'EXECUTION_NOT_ALLOWED',
      dryRun: false,
      writesPerformed: false,
    });
    const req = makeRequest({
      role: 'admin',
      body: {
        execute: true,
        confirmBackfill: true,
        executionAllowed: true,
      },
    });
    const res = makeResponse();

    await postSuggestionBackfill(req as any, res as any);

    expect(res.statusCode).toBe(409);
    expect(mocks.backfillHistorySuggestions).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        execute: true,
        confirmBackfill: true,
        executionAllowed: false,
      }),
    );
  });
});
