import { describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  resolveRequestActor: vi.fn(),
  setRequestActor: vi.fn(),
}));

vi.mock('../../server/auth/requestContext', () => mocks);

import { invokeExpressJsonHandler } from '../../src/app/api/_express-adapter';

const actor = {
  userId: 'finance-user',
  role: 'viewer' as const,
  actorId: 'finance-user',
  actorEmail: 'viewer@example.test',
};

describe('direct Next API adapter authentication', () => {
  it('denies unauthenticated requests before invoking the Express handler', async () => {
    mocks.resolveRequestActor.mockResolvedValue({ actor: null, error: 'unauthenticated' });
    const handler = vi.fn();
    const request = new NextRequest('http://localhost/api/review');

    const response = await invokeExpressJsonHandler(request, handler);

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: 'Authenticatie vereist.' });
    expect(handler).not.toHaveBeenCalled();
    expect(mocks.setRequestActor).not.toHaveBeenCalled();
  });

  it('stamps only the verified actor before invoking an authorized handler', async () => {
    mocks.resolveRequestActor.mockResolvedValue({ actor, error: null });
    const handler = vi.fn((_request, response) => response.json({ ok: true }));
    const request = new NextRequest('http://localhost/api/review', {
      headers: {
        'x-user-id': 'spoofed-user',
        'x-user-role': 'admin',
      },
    });

    const response = await invokeExpressJsonHandler(request, handler);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(mocks.setRequestActor).toHaveBeenCalledWith(expect.anything(), actor);
    expect(handler).toHaveBeenCalledTimes(1);
  });
});
