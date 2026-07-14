import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const verifyToken = vi.hoisted(() => vi.fn());

vi.mock('@clerk/backend', () => ({ verifyToken }));

const envKeys = ['NODE_ENV', 'AUTH_PROVIDER', 'NEXT_PUBLIC_AUTH_PROVIDER', 'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', 'CLERK_SECRET_KEY', 'DEFAULT_WORKSPACE_ID'] as const;
const originalEnv = new Map(envKeys.map((key) => [key, process.env[key]] as const));

const restoreEnv = () => {
  for (const key of envKeys) {
    const value = originalEnv.get(key);
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
};

describe('Clerk session verification', () => {
  beforeEach(() => {
    vi.resetModules();
    (process.env as Record<string, string | undefined>).NODE_ENV = 'production';
    process.env.AUTH_PROVIDER = 'clerk';
    process.env.NEXT_PUBLIC_AUTH_PROVIDER = 'clerk';
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = 'pk_test_Y2xlcmsuZXhhbXBsZS5jb20k';
    process.env.CLERK_SECRET_KEY = 'sk_test_unit_test_key_for_auth';
    verifyToken.mockReset();
  });

  afterEach(() => {
    restoreEnv();
    vi.resetModules();
  });

  it('accepts a valid Clerk session token from the __session cookie', async () => {
    verifyToken.mockResolvedValue({ sub: 'clerk-user-1' });
    const { verifyClerkSession } = await import('../../src/utils/session-auth');

    await expect(verifyClerkSession('__session=verified-session')).resolves.toEqual({
      clerkUserId: 'clerk-user-1',
    });
    expect(verifyToken).toHaveBeenCalledWith('verified-session', {
      secretKey: 'sk_test_unit_test_key_for_auth',
    });
  });

  it('rejects missing and invalid Clerk sessions', async () => {
    verifyToken.mockRejectedValue(new Error('invalid'));
    const { verifyClerkSession } = await import('../../src/utils/session-auth');

    await expect(verifyClerkSession(null)).resolves.toBeNull();
    await expect(verifyClerkSession('__session=invalid-session')).resolves.toBeNull();
  });

  it('does not treat Ory or generic cookies as authenticated sessions', async () => {
    const { verifyClerkSession } = await import('../../src/utils/session-auth');

    await expect(verifyClerkSession('ory_kratos_session=legacy-session')).resolves.toBeNull();
    await expect(verifyClerkSession('session=generic-session')).resolves.toBeNull();
    expect(verifyToken).not.toHaveBeenCalled();
  });
});
