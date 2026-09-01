import { describe, expect, it, vi } from 'vitest';

const ENV_KEYS = [
  'NODE_ENV',
  'AUTH_PROVIDER',
  'NEXT_PUBLIC_AUTH_PROVIDER',
  'ALLOW_PRODUCTION_AUTH_BYPASS',
  'DEFAULT_USER_ID',
  'DEFAULT_WORKSPACE_ID',
  'CLERK_SECRET_KEY',
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

const validBypassIdentity = {
  DEFAULT_USER_ID: 'configured-admin',
  DEFAULT_WORKSPACE_ID: '123e4567-e89b-42d3-a456-426614174000',
};

describe('production session authentication', () => {
  it('does not authenticate through the bypass when Clerk is configured', async () => {
    await withEnv({
      NODE_ENV: 'production',
      AUTH_PROVIDER: 'clerk',
      NEXT_PUBLIC_AUTH_PROVIDER: 'clerk',
      ALLOW_PRODUCTION_AUTH_BYPASS: 'true',
      ...validBypassIdentity,
    }, async () => {
      vi.resetModules();
      const { isProductionSessionAuthenticated } = await import('../../src/utils/session-auth');
      await expect(isProductionSessionAuthenticated(null)).resolves.toBe(false);
    });
  });

  it('authenticates only for the explicit disabled-provider production contract', async () => {
    await withEnv({
      NODE_ENV: 'production',
      AUTH_PROVIDER: 'disabled',
      NEXT_PUBLIC_AUTH_PROVIDER: 'disabled',
      ALLOW_PRODUCTION_AUTH_BYPASS: 'true',
      ...validBypassIdentity,
    }, async () => {
      vi.resetModules();
      const { isProductionSessionAuthenticated } = await import('../../src/utils/session-auth');
      await expect(isProductionSessionAuthenticated(null)).resolves.toBe(true);
    });
  });
});
