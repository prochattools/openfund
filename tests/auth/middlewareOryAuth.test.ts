import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

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

const loadMiddleware = async () => {
  vi.resetModules();
  return (await import('../../src/middleware')).default;
};

describe('ory production middleware auth', () => {
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

  it('denies an invalid Ory session for the review API', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue({ ok: false } as Response);
    const middleware = await loadMiddleware();
    const request = new NextRequest('http://localhost/api/review', {
      headers: { cookie: 'ory_kratos_session=session-1' },
    });

    const response = await middleware(request);

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: 'Authenticatie vereist.' });
  });

  it('redirects an invalid Ory session for the review page to sign-in', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue({ ok: false } as Response);
    const middleware = await loadMiddleware();
    const request = new NextRequest('http://localhost/review', {
      headers: { cookie: 'ory_kratos_session=session-1' },
    });

    const response = await middleware(request);

    expect([307, 308]).toContain(response.status);
    expect(response.headers.get('location')).toContain('/self-service/login/browser');
    expect(response.headers.get('location')).toContain('return_to=');
  });
});
