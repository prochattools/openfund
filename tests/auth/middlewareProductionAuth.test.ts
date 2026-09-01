import { describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import middleware from '../../src/middleware';

const ENV_KEYS = [
  'NODE_ENV',
  'AUTH_PROVIDER',
  'NEXT_PUBLIC_AUTH_PROVIDER',
  'ALLOW_PRODUCTION_AUTH_BYPASS',
  'DEFAULT_USER_ID',
  'DEFAULT_WORKSPACE_ID',
] as const;

const withEnv = async (
  values: Partial<Record<(typeof ENV_KEYS)[number], string | undefined>>,
  fn: () => Promise<void> | void,
) => {
  const originals = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));

  try {
    for (const key of ENV_KEYS) {
      const value = values[key];
      if (value == null) delete process.env[key];
      else process.env[key] = value;
    }
    await fn();
  } finally {
    for (const key of ENV_KEYS) {
      const value = originals[key];
      if (value == null) delete process.env[key];
      else process.env[key] = value;
    }
  }
};

const withProductionEnv = (fn: () => Promise<void> | void) =>
  withEnv({ NODE_ENV: 'production', AUTH_PROVIDER: 'clerk' }, fn);

const withProductionBypass = (fn: () => Promise<void> | void) =>
  withEnv({
    NODE_ENV: 'production',
    AUTH_PROVIDER: 'disabled',
    NEXT_PUBLIC_AUTH_PROVIDER: 'disabled',
    ALLOW_PRODUCTION_AUTH_BYPASS: 'true',
    DEFAULT_USER_ID: 'configured-admin',
    DEFAULT_WORKSPACE_ID: '123e4567-e89b-42d3-a456-426614174000',
  }, fn);

describe('production route authentication middleware', () => {
  it('returns a 401 JSON response for unauthenticated review API requests', async () => {
    await withProductionEnv(async () => {
      const response = await middleware(new NextRequest('http://localhost/api/review'));
      expect(response.status).toBe(401);
      await expect(response.json()).resolves.toEqual({ error: 'Authenticatie vereist.' });
    });
  });

  it('does not honor the bypass flag in production Clerk mode', async () => {
    await withEnv({
      NODE_ENV: 'production',
      AUTH_PROVIDER: 'clerk',
      NEXT_PUBLIC_AUTH_PROVIDER: 'clerk',
      ALLOW_PRODUCTION_AUTH_BYPASS: 'true',
      DEFAULT_USER_ID: 'configured-admin',
      DEFAULT_WORKSPACE_ID: '123e4567-e89b-42d3-a456-426614174000',
    }, async () => {
      const response = await middleware(new NextRequest('http://localhost/api/review'));
      expect(response.status).toBe(401);
      await expect(response.json()).resolves.toEqual({ error: 'Authenticatie vereist.' });
    });
  });

  it('redirects unauthenticated review pages to the sign-in route', async () => {
    await withProductionEnv(async () => {
      const response = await middleware(new NextRequest('http://localhost/review'));
      expect([307, 308]).toContain(response.status);
      expect(response.headers.get('location')).toContain('/sign-in');
      expect(response.headers.get('location')).toContain('redirect_url=%2Freview');
    });
  });

  it('redirects unauthenticated reports pages to the sign-in route', async () => {
    await withProductionEnv(async () => {
      const response = await middleware(new NextRequest('http://localhost/reports'));
      expect([307, 308]).toContain(response.status);
      expect(response.headers.get('location')).toContain('/sign-in');
      expect(response.headers.get('location')).toContain('redirect_url=%2Freports');
    });
  });

  it('does not expose a public application sign-up route', async () => {
    await withProductionEnv(async () => {
      const response = await middleware(new NextRequest('http://localhost/sign-up'));
      expect([307, 308]).toContain(response.status);
      expect(response.headers.get('location')).toContain('/sign-in');
    });
  });

  it('allows API and page requests through only for the explicit production bypass', async () => {
    await withProductionBypass(async () => {
      const apiResponse = await middleware(new NextRequest('http://localhost/api/review'));
      const pageResponse = await middleware(new NextRequest('http://localhost/review'));
      expect(apiResponse.status).toBe(200);
      expect(pageResponse.status).toBe(200);
      expect(apiResponse.headers.get('x-middleware-next')).toBe('1');
      expect(pageResponse.headers.get('x-middleware-next')).toBe('1');
    });
  });

  it('fails closed when the bypass workspace is malformed', async () => {
    await withEnv({
      NODE_ENV: 'production',
      AUTH_PROVIDER: 'disabled',
      ALLOW_PRODUCTION_AUTH_BYPASS: 'true',
      DEFAULT_USER_ID: 'configured-admin',
      DEFAULT_WORKSPACE_ID: 'not-a-workspace-id',
    }, async () => {
      const response = await middleware(new NextRequest('http://localhost/api/review'));
      expect(response.status).toBe(401);
    });
  });
});
