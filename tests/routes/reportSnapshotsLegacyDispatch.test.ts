import { describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';

vi.mock('../../server/auth/requestContext', () => ({
  requireAdmin: vi.fn(async () => ({
    userId: 'user-1',
    role: 'admin',
    actorId: 'user-1',
  })),
}));

vi.mock('../../server/prismaClient', () => ({
  prisma: {
    $transaction: vi.fn(),
  },
}));

import { prisma } from '../../server/prismaClient';
import { postPrepareReportDispatch } from '../../server/routes/reportSnapshots';

const mockResponse = () => {
  const response: Partial<Response> = {};
  response.status = vi.fn().mockReturnValue(response);
  response.json = vi.fn().mockReturnValue(response);
  return response as Response;
};

describe('legacy report dispatch preparation route', () => {
  it('is retired and performs no database writes', async () => {
    const request = {
      params: { snapshotId: 'snapshot-1' },
      body: {},
      header: vi.fn(),
    } as unknown as Request;
    const response = mockResponse();

    await postPrepareReportDispatch(request, response);

    expect(response.status).toHaveBeenCalledWith(410);
    expect(response.json).toHaveBeenCalledWith({
      error: 'Deze verouderde verzendroute is uitgeschakeld. Gebruik de maandrapport-verzendactie.',
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
