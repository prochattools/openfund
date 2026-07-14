import { afterEach, describe, expect, it, vi } from 'vitest';

const ORIGINAL_ENV = { ...process.env };

const loadAuth = async (env: Record<string, string | undefined>) => {
  vi.resetModules();
  process.env = { ...ORIGINAL_ENV };
  for (const [key, value] of Object.entries(env)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
  return import('../../src/utils/auth');
};

afterEach(() => {
  vi.resetModules();
  process.env = { ...ORIGINAL_ENV };
});

describe('client auth configuration utilities', () => {
  it('defaults to disabled auth when no provider is configured', async () => {
    const auth = await loadAuth({
      NEXT_PUBLIC_AUTH_PROVIDER: undefined,
      AUTH_PROVIDER: undefined,
      AUTH_ENABLED: undefined,
    });

    expect(auth.AUTH_PROVIDER).toBe('disabled');
    expect(auth.AUTH_ENABLED).toBe(false);
    expect(auth.CLERK_ENABLED).toBe(false);
  });

  it('supports explicit disabled auth aliases', async () => {
    const auth = await loadAuth({ NEXT_PUBLIC_AUTH_PROVIDER: ' false ' });

    expect(auth.AUTH_PROVIDER).toBe('disabled');
    expect(auth.AUTH_ENABLED).toBe(false);
  });

  it('treats legacy provider selection as Clerk mode instead of selecting a fallback', async () => {
    const auth = await loadAuth({
      NEXT_PUBLIC_AUTH_PROVIDER: 'ory',
      NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: 'pk_test_Y2xlcmsuZXhhbXBsZS5jb20k',
    });

    expect(auth.AUTH_PROVIDER).toBe('clerk');
    expect(auth.AUTH_ENABLED).toBe(true);
    expect(auth.CLERK_ENABLED).toBe(true);
  });

  it('keeps Clerk runtime disabled for stub keys', async () => {
    const auth = await loadAuth({
      NEXT_PUBLIC_AUTH_PROVIDER: 'clerk',
      NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: 'pk_stub_local_development_key',
      CLERK_SECRET_KEY: 'sk_stub_local_development_key',
    });

    expect(auth.AUTH_PROVIDER).toBe('clerk');
    expect(auth.CLERK_ENABLED).toBe(true);
    expect(auth.CLERK_RUNTIME_ENABLED).toBe(false);
  });

  it('uses internal sign-in URLs when no provider URLs are configured', async () => {
    const auth = await loadAuth({
      NEXT_PUBLIC_SIGN_IN_URL: undefined,
      NEXT_PUBLIC_CLERK_SIGN_IN_URL: undefined,
      NEXT_PUBLIC_SIGN_UP_URL: undefined,
      NEXT_PUBLIC_CLERK_SIGN_UP_URL: undefined,
    });

    expect(auth.getSignInUrl()).toBe('/sign-in');
    expect(auth.getSignUpUrl()).toBe('/sign-in');
  });
});
