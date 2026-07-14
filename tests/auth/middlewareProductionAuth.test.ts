import { describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import middleware from '../../src/middleware';

const withProductionEnv = async (fn: () => Promise<void> | void) => {
  const originalNodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
  try {
    await fn();
  } finally {
    process.env.NODE_ENV = originalNodeEnv;
  }
};

describe('production route authentication middleware', () => {
  it('returns a 401 JSON response for unauthenticated review API requests', async () => {
    await withProductionEnv(async () => {
      const request = new NextRequest('http://localhost/api/review');
      const response = await middleware(request);

      expect(response.status).toBe(401);
      await expect(response.json()).resolves.toEqual({ error: 'Authenticatie vereist.' });
    });
  });

  it('redirects unauthenticated review pages to the sign-in route', async () => {
    await withProductionEnv(async () => {
      const request = new NextRequest('http://localhost/review');
      const response = await middleware(request);

      expect([307, 308]).toContain(response.status);
      expect(response.headers.get('location')).toContain('/sign-in');
      expect(response.headers.get('location')).toContain('redirect_url=%2Freview');
    });
  });

  it('redirects unauthenticated reports pages to the sign-in route', async () => {
    await withProductionEnv(async () => {
      const request = new NextRequest('http://localhost/reports');
      const response = await middleware(request);

      expect([307, 308]).toContain(response.status);
      expect(response.headers.get('location')).toContain('/sign-in');
      expect(response.headers.get('location')).toContain('redirect_url=%2Freports');
    });
  });

  it('does not expose a public application sign-up route', async () => {
    await withProductionEnv(async () => {
      const request = new NextRequest('http://localhost/sign-up');
      const response = await middleware(request);

      expect([307, 308]).toContain(response.status);
      expect(response.headers.get('location')).toContain('/sign-in');
    });
  });

});
