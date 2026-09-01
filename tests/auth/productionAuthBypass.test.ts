import { describe, expect, it } from 'vitest';
import {
  canUseProductionAuthBypass,
  getConfiguredAuthProvider,
  isProductionAuthBypassEnabled,
} from '../../src/utils/production-auth-bypass';

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

const validBypassIdentity = {
  DEFAULT_USER_ID: 'configured-admin',
  DEFAULT_WORKSPACE_ID: '123e4567-e89b-42d3-a456-426614174000',
};

describe('production auth bypass', () => {
  it('is unavailable when production uses Clerk and the flag is false', async () => {
    await withEnv({
      NODE_ENV: 'production',
      AUTH_PROVIDER: 'clerk',
      ALLOW_PRODUCTION_AUTH_BYPASS: 'false',
      ...validBypassIdentity,
    }, async () => {
      expect(isProductionAuthBypassEnabled()).toBe(false);
      expect(canUseProductionAuthBypass()).toBe(false);
    });
  });

  it('remains unavailable when production Clerk accidentally has the flag enabled', async () => {
    await withEnv({
      NODE_ENV: 'production',
      AUTH_PROVIDER: 'clerk',
      ALLOW_PRODUCTION_AUTH_BYPASS: 'true',
      ...validBypassIdentity,
    }, async () => {
      expect(getConfiguredAuthProvider()).toBe('clerk');
      expect(isProductionAuthBypassEnabled()).toBe(false);
      expect(canUseProductionAuthBypass()).toBe(false);
    });
  });

  it('fails closed when the public provider setting is Clerk', async () => {
    await withEnv({
      NODE_ENV: 'production',
      AUTH_PROVIDER: 'disabled',
      NEXT_PUBLIC_AUTH_PROVIDER: 'clerk',
      ALLOW_PRODUCTION_AUTH_BYPASS: 'true',
      ...validBypassIdentity,
    }, async () => {
      expect(getConfiguredAuthProvider()).toBe('clerk');
      expect(isProductionAuthBypassEnabled()).toBe(false);
    });
  });

  it('supports only the explicit production disabled-provider contract', async () => {
    await withEnv({
      NODE_ENV: 'production',
      AUTH_PROVIDER: 'disabled',
      NEXT_PUBLIC_AUTH_PROVIDER: 'disabled',
      ALLOW_PRODUCTION_AUTH_BYPASS: 'true',
      ...validBypassIdentity,
    }, async () => {
      expect(getConfiguredAuthProvider()).toBe('disabled');
      expect(isProductionAuthBypassEnabled()).toBe(true);
      expect(canUseProductionAuthBypass()).toBe(true);
    });
  });

  it('rejects a malformed production bypass workspace', async () => {
    await withEnv({
      NODE_ENV: 'production',
      AUTH_PROVIDER: 'disabled',
      ALLOW_PRODUCTION_AUTH_BYPASS: 'true',
      DEFAULT_USER_ID: 'configured-admin',
      DEFAULT_WORKSPACE_ID: 'not-a-workspace-id',
    }, async () => {
      expect(isProductionAuthBypassEnabled()).toBe(false);
    });
  });
});
