import { describe, expect, it, vi } from 'vitest';
import { getRequestActor, requireAdmin } from '../../server/auth/requestContext';

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

describe('request context auth guard', () => {
  it('defaults to admin role for internal/local requests', () => {
    const actor = getRequestActor(makeRequest({ 'x-user-id': 'demo-user' }) as any);

    expect(actor).toEqual({
      userId: 'demo-user',
      role: 'admin',
      actorId: 'demo-user',
      actorEmail: null,
    });
  });

  it('parses viewer role and actor metadata from headers', () => {
    const actor = getRequestActor(makeRequest({
      'x-user-id': 'finance-user',
      'x-user-role': 'viewer',
      'x-actor-id': 'ory-identity-1',
      'x-user-email': 'admin@example.test',
    }) as any);

    expect(actor).toEqual({
      userId: 'finance-user',
      role: 'viewer',
      actorId: 'ory-identity-1',
      actorEmail: 'admin@example.test',
    });
  });

  it('blocks viewers with a Dutch forbidden response', () => {
    const res = makeResponse();
    const actor = requireAdmin(makeRequest({
      'x-user-id': 'finance-user',
      'x-user-role': 'viewer',
    }) as any, res as any);

    expect(actor).toBeNull();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: 'Alleen beheerders mogen deze actie uitvoeren.' });
  });

  it('allows admins through mutation guards', () => {
    const res = makeResponse();
    const actor = requireAdmin(makeRequest({
      'x-user-id': 'finance-user',
      'x-user-role': 'admin',
    }) as any, res as any);

    expect(actor?.role).toBe('admin');
    expect(actor?.userId).toBe('finance-user');
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
  });
});
