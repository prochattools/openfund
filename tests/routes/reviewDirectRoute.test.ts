import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  invokeExpressJsonHandler: vi.fn(),
  updateTransactionCategory: vi.fn(),
}));

vi.mock('@/app/api/_express-adapter', () => ({
  invokeExpressJsonHandler: mocks.invokeExpressJsonHandler,
}));
vi.mock('../../server/routes/review', () => ({
  updateTransactionCategory: mocks.updateTransactionCategory,
}));

import { PATCH } from '../../src/app/api/transactions/[id]/category/route';

describe('direct review approval route', () => {
  beforeEach(() => {
    mocks.invokeExpressJsonHandler.mockReset();
    mocks.updateTransactionCategory.mockReset();
    mocks.invokeExpressJsonHandler.mockResolvedValue(Response.json({ ok: true }));
  });

  it('forwards the complete review assignment and route id to the authoritative handler', async () => {
    const body = {
      projectId: 'project-1',
      transactionTypeId: 'type-1',
      categoryId: 'category-1',
      reason: 'Beheerder heeft gecontroleerd',
    };
    const request = new NextRequest('http://localhost/api/transactions/tx-1/category', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });

    const response = await PATCH(request, { params: { id: 'tx-1' } });

    expect(response.status).toBe(200);
    expect(mocks.invokeExpressJsonHandler).toHaveBeenCalledWith(
      request,
      mocks.updateTransactionCategory,
      {
        params: { id: 'tx-1' },
        body,
      },
    );
  });

  it('does not create bookings itself and delegates malformed payload validation', async () => {
    const request = new NextRequest('http://localhost/api/transactions/tx-2/category', {
      method: 'PATCH',
      body: 'not-json',
    });

    await PATCH(request, { params: { id: 'tx-2' } });

    expect(mocks.updateTransactionCategory).not.toHaveBeenCalled();
    expect(mocks.invokeExpressJsonHandler).toHaveBeenCalledWith(
      request,
      mocks.updateTransactionCategory,
      {
        params: { id: 'tx-2' },
        body: {},
      },
    );
  });
});
