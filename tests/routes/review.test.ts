import { describe, expect, it } from 'vitest';
import { updateTransactionCategory } from '../../server/routes/review';
import { INCOMPLETE_DIMENSIONS_MESSAGE } from '../../server/services/reviewDecisionService';

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
}: {
  body?: unknown;
  params?: Record<string, string>;
  role?: 'admin' | 'viewer';
}) => ({
  body,
  params,
  header: (name: string) => {
    if (name === 'x-user-id') return 'user-1';
    if (name === 'x-user-role') return role;
    if (name === 'x-actor-id') return 'actor-1';
    if (name === 'x-user-email') return 'finance@example.test';
    return undefined;
  },
});

describe('review routes', () => {
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
});
