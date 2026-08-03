import { beforeEach, describe, expect, it, vi } from 'vitest';
import { setRequestActor } from '../../server/auth/requestContext';
import {
  activateReviewRuleCreation,
  getReviewTransactions,
  previewReviewRuleCreation,
  updateTransactionCategory,
} from '../../server/routes/review';
import { INCOMPLETE_DIMENSIONS_MESSAGE } from '../../server/services/reviewDecisionService';

const serviceMocks = vi.hoisted(() => ({
  getEvidenceRichReviewQueue: vi.fn(),
  previewRuleCreation: vi.fn(),
  activateRuleCreation: vi.fn(),
  prismaTransaction: vi.fn(),
}));

vi.mock('../../server/prismaClient', () => ({
  prisma: {
    $transaction: serviceMocks.prismaTransaction,
  },
}));

vi.mock('../../server/services/reviewQueueService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../server/services/reviewQueueService')>();
  return {
    ...actual,
    getEvidenceRichReviewQueue: serviceMocks.getEvidenceRichReviewQueue,
  };
});

vi.mock('../../server/services/ruleCreationService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../server/services/ruleCreationService')>();
  return {
    ...actual,
    previewRuleCreation: serviceMocks.previewRuleCreation,
    activateRuleCreation: serviceMocks.activateRuleCreation,
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
  body = {},
  params = { id: 'tx-1' },
  query = {},
  role = 'admin',
  cookie = 'test-session',
}: {
  body?: unknown;
  params?: Record<string, string>;
  query?: Record<string, string>;
  role?: 'admin' | 'viewer';
  cookie?: string | null;
}) => {
  const request = {
    body,
    params,
    query,
    header: (name: string) => (name === 'cookie' ? cookie : undefined),
  };
  if (cookie !== null) {
    setRequestActor(request, {
      userId: 'user-1',
      workspaceId: 'workspace-1',
      role,
      actorId: 'user-1',
      actorEmail: 'finance@example.test',
    });
  }
  return request;
};

describe('review routes', () => {
  beforeEach(() => {
    serviceMocks.getEvidenceRichReviewQueue.mockReset();
    serviceMocks.previewRuleCreation.mockReset();
    serviceMocks.activateRuleCreation.mockReset();
    serviceMocks.prismaTransaction.mockReset();
    serviceMocks.prismaTransaction.mockImplementation((callback: (db: unknown) => unknown) => callback({}));
  });

  it('rejects unauthenticated production review requests before loading the queue', async () => {
    const originalNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      const response = makeResponse();

      await getReviewTransactions(makeRequest({ cookie: null }) as any, response as any);

      expect(response.statusCode).toBe(401);
      expect(response.body).toEqual({ error: 'Authenticatie vereist.' });
      expect(serviceMocks.getEvidenceRichReviewQueue).not.toHaveBeenCalled();
    } finally {
      process.env.NODE_ENV = originalNodeEnv;
    }
  });

  it('review route returns Dutch evidence-rich items for authenticated viewers without approving anything', async () => {
    const originalNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      serviceMocks.getEvidenceRichReviewQueue.mockResolvedValueOnce({
        transactions: [{
          transactionId: 'tx-1',
          deterministicStatus: 'conflict',
          statusLabel: 'Conflict, handmatig beoordelen',
          alternatives: [{ suggestionId: 'suggestion-1' }],
          sideEffects: {
            createsTransactionBooking: false,
            closesPeriod: false,
          },
        }],
        categories: [],
        projects: [],
        transactionTypes: [],
        message: 'Beoordelingsrij geladen. Er zijn geen boekingen of periodeafsluitingen gemaakt.',
      });
      const response = makeResponse();

      await getReviewTransactions(makeRequest({ role: 'viewer' }) as any, response as any);

      expect(response.statusCode).toBe(200);
      expect(response.body).toMatchObject({
        message: 'Beoordelingsrij geladen. Er zijn geen boekingen of periodeafsluitingen gemaakt.',
        transactions: [
          {
            transactionId: 'tx-1',
            deterministicStatus: 'conflict',
            sideEffects: {
              createsTransactionBooking: false,
              closesPeriod: false,
            },
          },
        ],
      });
      expect(serviceMocks.getEvidenceRichReviewQueue).toHaveBeenCalledWith(expect.anything(), 'user-1', 'workspace-1', {
        page: 1,
        pageSize: 25,
        confidence: null,
        direction: null,
        projectId: null,
        categoryId: null,
        state: 'all',
      });
    } finally {
      process.env.NODE_ENV = originalNodeEnv;
    }
  });

  it('forwards supported review pagination parameters to the queue service', async () => {
    serviceMocks.getEvidenceRichReviewQueue.mockResolvedValueOnce({
      transactions: [],
      categories: [],
      projects: [],
      transactionTypes: [],
      pagination: {
        page: 3,
        pageSize: 50,
        totalItems: 221,
        totalPages: 5,
        hasPreviousPage: true,
        hasNextPage: true,
      },
      message: 'Beoordelingsrij geladen.',
    });
    const response = makeResponse();

    await getReviewTransactions(makeRequest({
      role: 'viewer',
      query: { page: '3', pageSize: '50' },
    }) as any, response as any);

    expect(response.statusCode).toBe(200);
    expect(serviceMocks.getEvidenceRichReviewQueue).toHaveBeenCalledWith(expect.anything(), 'user-1', 'workspace-1', {
      page: 3,
      pageSize: 50,
      confidence: null,
      direction: null,
      projectId: null,
      categoryId: null,
      state: 'all',
    });
  });

  it('forwards supported review filters to the queue service', async () => {
    serviceMocks.getEvidenceRichReviewQueue.mockResolvedValueOnce({
      transactions: [], categories: [], projects: [], transactionTypes: [],
      pagination: { page: 1, pageSize: 25, totalItems: 0, totalPages: 1, hasPreviousPage: false, hasNextPage: false },
      message: 'Beoordelingsrij geladen.',
    });
    const response = makeResponse();

    await getReviewTransactions(makeRequest({
      role: 'viewer',
      query: {
        confidence: 'red', direction: 'debit', projectId: 'project-1',
        categoryId: 'category-1', state: 'incomplete',
      },
    }) as any, response as any);

    expect(serviceMocks.getEvidenceRichReviewQueue).toHaveBeenCalledWith(expect.anything(), 'user-1', 'workspace-1', {
      page: 1, pageSize: 25, confidence: 'red', direction: 'debit',
      projectId: 'project-1', categoryId: 'category-1', state: 'incomplete',
    });
  });

  it('falls back safely for unsupported review query values', async () => {
    serviceMocks.getEvidenceRichReviewQueue.mockResolvedValueOnce({
      transactions: [], categories: [], projects: [], transactionTypes: [],
      pagination: { page: 1, pageSize: 25, totalItems: 0, totalPages: 1, hasPreviousPage: false, hasNextPage: false },
      message: 'Beoordelingsrij geladen.',
    });
    const response = makeResponse();

    await getReviewTransactions(makeRequest({
      role: 'viewer',
      query: { page: '-4', pageSize: '40', confidence: 'blue', direction: 'sideways', state: 'closed' },
    }) as any, response as any);

    expect(serviceMocks.getEvidenceRichReviewQueue).toHaveBeenCalledWith(expect.anything(), 'user-1', 'workspace-1', {
      page: 1, pageSize: 25, confidence: null, direction: null,
      projectId: null, categoryId: null, state: 'all',
    });
  });

  it('returns the production category contract as a flat id/name DTO', async () => {
    const originalNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      serviceMocks.getEvidenceRichReviewQueue.mockResolvedValueOnce({
        transactions: [],
        categories: [{ id: 'cat-gifts', name: 'Giften' }],
        projects: [],
        transactionTypes: [],
        message: 'Beoordelingsrij geladen.',
      });
      const response = makeResponse();

      await getReviewTransactions(makeRequest({ role: 'viewer' }) as any, response as any);

      expect(response.statusCode).toBe(200);
      expect(response.body).toMatchObject({
        categories: [{ id: 'cat-gifts', name: 'Giften' }],
      });
      expect((response.body as any).categories[0]).not.toHaveProperty('parentId');
    } finally {
      process.env.NODE_ENV = originalNodeEnv;
    }
  });

  it('rejects category-only updates before touching persistence', async () => {
    const response = makeResponse();

    await updateTransactionCategory(makeRequest({
      body: {
        categoryId: 'cat-1',
      },
    }) as any, response as any);

    expect(response.statusCode).toBe(400);
    expect(response.body).toEqual({ error: INCOMPLETE_DIMENSIONS_MESSAGE });
  });

  it('rejects viewer category updates before touching persistence', async () => {
    const response = makeResponse();

    await updateTransactionCategory(makeRequest({
      body: {
        projectId: 'project-1',
        transactionTypeId: 'type-1',
        categoryId: 'cat-1',
      },
      role: 'viewer',
    }) as any, response as any);

    expect(response.statusCode).toBe(403);
    expect(response.body).toEqual({ error: 'Alleen beheerders mogen deze actie uitvoeren.' });
  });

  it('rejects missing transaction ids before touching persistence', async () => {
    const response = makeResponse();

    await updateTransactionCategory(makeRequest({
      body: {
        projectId: 'project-1',
        transactionTypeId: 'type-1',
        categoryId: 'cat-1',
      },
      params: { id: '' },
    }) as any, response as any);

    expect(response.statusCode).toBe(400);
    expect(response.body).toEqual({ error: 'Transactie id ontbreekt.' });
  });

  it('previews rule creation for an approved review decision without activating it', async () => {
    serviceMocks.previewRuleCreation.mockResolvedValueOnce({
      transactionId: 'tx-1',
      activationAllowed: true,
      previewHash: 'hash-1',
      sideEffects: {
        createsTransactionBooking: false,
        closesPeriod: false,
      },
    });
    const response = makeResponse();

    await previewReviewRuleCreation(makeRequest({
      body: {
        projectId: 'project-1',
        transactionTypeId: 'type-1',
        categoryId: 'cat-1',
        conditions: [{ field: 'paymentPurpose', matchType: 'contains', value: 'Gift voor mei' }],
      },
    }) as any, response as any);

    expect(response.statusCode).toBe(200);
    expect(response.body).toMatchObject({
      activationAllowed: true,
      sideEffects: {
        createsTransactionBooking: false,
        closesPeriod: false,
      },
    });
    expect(serviceMocks.previewRuleCreation).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      actor: expect.objectContaining({ userId: 'user-1', role: 'admin' }),
      transactionId: 'tx-1',
      projectId: 'project-1',
      transactionTypeId: 'type-1',
      categoryId: 'cat-1',
    }));
    expect(serviceMocks.activateRuleCreation).not.toHaveBeenCalled();
  });

  it('activates rule creation only through the explicit activation route', async () => {
    serviceMocks.activateRuleCreation.mockResolvedValueOnce({
      rule: { id: 'rule-1' },
      preview: { previewHash: 'hash-1' },
      sideEffects: {
        createsTransactionBooking: false,
        closesPeriod: false,
      },
    });
    const response = makeResponse();

    await activateReviewRuleCreation(makeRequest({
      body: {
        projectId: 'project-1',
        transactionTypeId: 'type-1',
        categoryId: 'cat-1',
        previewHash: 'hash-1',
        explicitConfirmation: true,
      },
    }) as any, response as any);

    expect(response.statusCode).toBe(201);
    expect(response.body).toMatchObject({
      rule: { id: 'rule-1' },
      sideEffects: {
        createsTransactionBooking: false,
        closesPeriod: false,
      },
    });
    expect(serviceMocks.activateRuleCreation).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      transactionId: 'tx-1',
      previewHash: 'hash-1',
      explicitConfirmation: true,
    }));
  });

  it('keeps rule creation admin-only', async () => {
    const response = makeResponse();

    await previewReviewRuleCreation(makeRequest({
      role: 'viewer',
      body: {
        projectId: 'project-1',
        transactionTypeId: 'type-1',
        categoryId: 'cat-1',
      },
    }) as any, response as any);

    expect(response.statusCode).toBe(403);
    expect(response.body).toEqual({ error: 'Alleen beheerders mogen deze actie uitvoeren.' });
    expect(serviceMocks.previewRuleCreation).not.toHaveBeenCalled();
  });
});
