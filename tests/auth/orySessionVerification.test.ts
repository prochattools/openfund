import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const envKeys = [
  'NODE_ENV',
  'AUTH_PROVIDER',
  'NEXT_PUBLIC_AUTH_PROVIDER',
  'NEXT_PUBLIC_ORY_SDK_URL',
  'ORY_SDK_URL',
  'NEXT_PUBLIC_ORY_LOGIN_URL',
] as const;

const originalEnv = new Map(envKeys.map((key) => [key, process.env[key]] as const));

const restoreEnv = () => {
  for (const key of envKeys) {
    const value = originalEnv.get(key);
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
};

const makeRequest = (cookie: string | null) => ({
  header: (name: string) => {
    if (name === 'cookie') return cookie;
    if (name === 'x-user-id') return 'finance-user';
    if (name === 'x-user-role') return 'viewer';
    if (name === 'x-actor-id') return 'ory-identity-1';
    return undefined;
  },
});

const makeResponse = () => {
  const res = {
    status: vi.fn(() => res),
    json: vi.fn(() => res),
  };
  return res;
};

const loadRequestContext = async () => {
  vi.resetModules();
  return import('../../server/auth/requestContext');
};

describe('ory session verification', () => {
  beforeEach(() => {
    process.env.NODE_ENV = 'production';
    process.env.AUTH_PROVIDER = 'ory';
    process.env.NEXT_PUBLIC_AUTH_PROVIDER = 'ory';
    process.env.NEXT_PUBLIC_ORY_SDK_URL = 'https://ory.example.test';
    process.env.ORY_SDK_URL = 'https://ory.example.test';
    process.env.NEXT_PUBLIC_ORY_LOGIN_URL = '/self-service/login/browser';
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    restoreEnv();
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it('accepts a verified production session', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue({ ok: true } as Response);

    const { requireAuthenticatedRequest } = await loadRequestContext();
    const res = makeResponse();

    const actor = await requireAuthenticatedRequest(makeRequest('ory_kratos_session=session-1') as any, res as any);

    expect(actor).toEqual({
      userId: 'finance-user',
      role: 'viewer',
      actorId: 'ory-identity-1',
      actorEmail: null,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(String(url)).toBe('https://ory.example.test/sessions/whoami');
    expect(init).toMatchObject({
      method: 'GET',
      cache: 'no-store',
      headers: {
        accept: 'application/json',
        cookie: 'ory_kratos_session=session-1',
      },
    });
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
  });

  it('rejects an unverified cookie even when it is present', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue({ ok: false } as Response);

    const { requireAuthenticatedRequest } = await loadRequestContext();
    const res = makeResponse();

    const actor = await requireAuthenticatedRequest(makeRequest('ory_kratos_session=session-1') as any, res as any);

    expect(actor).toBeNull();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Authenticatie vereist.' });
  });
});
