import { describe, expect, it, vi } from 'vitest';
import {
  getRequestActor,
  requireAdmin,
  requireAuthenticatedRequest,
  setRequestActor,
} from '../../server/auth/requestContext';

const makeRequest = (headers: Record<string, string | undefined>) => ({
  header: (name: string) => headers[name.toLowerCase()],
});

const makeResponse = () => {
  const res = {
    status: vi.fn(() => res),
    json: vi.fn(() => res),
  };
  return res;
};

const trustedActor = {
  userId: 'finance-user',
  role: 'viewer' as const,
  actorId: 'finance-user',
  actorEmail: 'admin@example.test',
};

describe('request context auth guard', () => {
  it('ignores client-supplied identity headers', () => {
    const request = makeRequest({
      'x-user-id': 'spoofed-user',
      'x-user-role': 'admin',
      'x-actor-id': 'spoofed-actor',
      'x-user-email': 'spoofed@example.test',
    });

    expect(getRequestActor(request as any)).toBeNull();
  });

  it('returns the server-stamped actor only', () => {
    const request = makeRequest({ 'x-user-role': 'admin' });
    setRequestActor(request, trustedActor);

    expect(getRequestActor(request as any)).toEqual(trustedActor);
  });

  it('blocks viewers with a Dutch forbidden response', async () => {
    const request = makeRequest({});
    setRequestActor(request, trustedActor);
    const res = makeResponse();

    const actor = await requireAdmin(request as any, res as any);

    expect(actor).toBeNull();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: 'Alleen beheerders mogen deze actie uitvoeren.' });
  });

  it('allows trusted admins through mutation guards', async () => {
    const request = makeRequest({});
    setRequestActor(request, { ...trustedActor, role: 'admin' });
    const res = makeResponse();

    const actor = await requireAdmin(request as any, res as any);

    expect(actor?.role).toBe('admin');
    expect(actor?.userId).toBe('finance-user');
    expect(res.status).not.toHaveBeenCalled();
  });

  it('requires a verified session when no trusted actor is present', async () => {
    const originalNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      const res = makeResponse();
      const actor = await requireAuthenticatedRequest(makeRequest({}) as any, res as any);

      expect(actor).toBeNull();
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Authenticatie vereist.' });
    } finally {
      process.env.NODE_ENV = originalNodeEnv;
    }
  });
});
