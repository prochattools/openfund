import { beforeEach, describe, expect, it, vi } from 'vitest';
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
  role = 'admin',
  cookie = 'ory_kratos_session=session-1',
}: {
  body?: unknown;
  params?: Record<string, string>;
  role?: 'admin' | 'viewer';
  cookie?: string | null;
}) => ({
  body,
  params,
  header: (name: string) => {
    if (name === 'x-user-id') return 'user-1';
    if (name === 'x-user-role') return role;
    if (name === 'x-actor-id') return 'actor-1';
    if (name === 'x-user-email') return 'finance@example.test';
    if (name === 'cookie') return cookie;
    return undefined;
  },
});

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
      expect(serviceMocks.getEvidenceRichReviewQueue).toHaveBeenCalledWith(expect.anything(), 'user-1');
    } finally {
      process.env.NODE_ENV = originalNodeEnv;
    }
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
