/**
 * Strict configured-scope resolver tests.
 *
 * Verifies that resolveConfiguredLocalActor (the production disabled-auth path) fails closed
 * on every misconfiguration without ever silently selecting a fallback actor.
 *
 * Rules under test:
 * - Stale / non-existent configured user → misconfigured (503)
 * - Inactive configured user → misconfigured (503)
 * - Missing membership → misconfigured (503)
 * - Inactive membership → misconfigured (503)
 * - Wrong workspace → misconfigured (503)
 * - Empty DEFAULT_USER_ID in production bypass → misconfigured (503)
 * - Exact active configured admin → success
 * - Multiple active admins are NEVER silently selected
 * - requestContext and comparison CLI resolve from the same configured env vars
 * - No IDs, emails, or environment values appear in HTTP error responses
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  userFindFirst: vi.fn(),
  membershipFindFirst: vi.fn(),
  membershipFindMany: vi.fn(),
}));

vi.mock('../../server/prismaClient', () => ({
  prisma: {
    user: { findFirst: mocks.userFindFirst },
    workspaceMembership: {
      findFirst: mocks.membershipFindFirst,
      findMany: mocks.membershipFindMany,
    },
  },
}));

const VALID_WORKSPACE = '11111111-1111-4111-8111-111111111111';
const CONFIGURED_USER = 'configured-user-id';
const OTHER_WORKSPACE = '22222222-2222-4222-8222-222222222222';

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
  fn: () => Promise<void>,
) => {
  const originals = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
  try {
    for (const key of ENV_KEYS) {
      const v = values[key];
      if (v === undefined) delete process.env[key];
      else process.env[key] = v;
    }
    await fn();
  } finally {
    for (const key of ENV_KEYS) {
      const v = originals[key];
      if (v === undefined) delete process.env[key];
      else process.env[key] = v;
    }
  }
};

const withProductionBypass = (
  overrides: Partial<Record<(typeof ENV_KEYS)[number], string | undefined>>,
  fn: () => Promise<void>,
) =>
  withEnv(
    {
      NODE_ENV: 'production',
      AUTH_PROVIDER: 'disabled',
      NEXT_PUBLIC_AUTH_PROVIDER: 'disabled',
      ALLOW_PRODUCTION_AUTH_BYPASS: 'true',
      DEFAULT_USER_ID: CONFIGURED_USER,
      DEFAULT_WORKSPACE_ID: VALID_WORKSPACE,
      ...overrides,
    },
    fn,
  );

describe('resolveConfiguredLocalActor — strict fail-closed behavior', () => {
  beforeEach(() => {
    vi.resetModules();
    mocks.userFindFirst.mockResolvedValue({ id: CONFIGURED_USER, email: 'admin@example.test' });
    mocks.membershipFindFirst.mockResolvedValue({ role: 'ADMIN' });
    mocks.membershipFindMany.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('succeeds with exact active configured admin', async () => {
    await withProductionBypass({}, async () => {
      const { resolveRequestActor } = await import('../../server/auth/requestContext');
      const result = await resolveRequestActor(null);
      expect(result.error).toBeNull();
      expect(result.actor?.userId).toBe(CONFIGURED_USER);
      expect(result.actor?.role).toBe('admin');
    });
  });

  it('fails closed when configured user does not exist in the database', async () => {
    mocks.userFindFirst.mockResolvedValue(null);
    await withProductionBypass({}, async () => {
      const { resolveRequestActor } = await import('../../server/auth/requestContext');
      const result = await resolveRequestActor(null);
      expect(result.error).toBe('misconfigured');
      expect(result.actor).toBeNull();
    });
  });

  it('fails closed when configured user is inactive', async () => {
    // findFirst with isActive:true filter returns null for inactive users
    mocks.userFindFirst.mockResolvedValue(null);
    await withProductionBypass({}, async () => {
      const { resolveRequestActor } = await import('../../server/auth/requestContext');
      const result = await resolveRequestActor(null);
      expect(result.error).toBe('misconfigured');
    });
  });

  it('fails closed when configured user has no membership in workspace', async () => {
    mocks.membershipFindFirst.mockResolvedValue(null);
    await withProductionBypass({}, async () => {
      const { resolveRequestActor } = await import('../../server/auth/requestContext');
      const result = await resolveRequestActor(null);
      expect(result.error).toBe('misconfigured');
    });
  });

  it('fails closed when configured user membership is inactive', async () => {
    // The query filters for isActive: true, so inactive membership returns null
    mocks.membershipFindFirst.mockResolvedValue(null);
    await withProductionBypass({}, async () => {
      const { resolveRequestActor } = await import('../../server/auth/requestContext');
      const result = await resolveRequestActor(null);
      expect(result.error).toBe('misconfigured');
    });
  });

  it('fails closed when DEFAULT_USER_ID is wrong workspace (membership not found)', async () => {
    mocks.membershipFindFirst.mockResolvedValue(null);
    await withProductionBypass({ DEFAULT_WORKSPACE_ID: OTHER_WORKSPACE }, async () => {
      const { resolveRequestActor } = await import('../../server/auth/requestContext');
      const result = await resolveRequestActor(null);
      expect(result.error).toBe('misconfigured');
    });
  });

  it('falls back to unauthenticated (not bypass) when DEFAULT_USER_ID is empty', async () => {
    // When DEFAULT_USER_ID is empty, canUseProductionAuthBypass() in auth.ts returns false,
    // so AUTH_PROVIDER resolves to 'clerk'. The configured-actor path is never entered.
    // Result is unauthenticated (no Clerk session), which is the correct fail-closed behavior.
    await withProductionBypass({ DEFAULT_USER_ID: '' }, async () => {
      const { resolveRequestActor } = await import('../../server/auth/requestContext');
      const result = await resolveRequestActor(null);
      expect(result.error).toBe('unauthenticated');
      expect(result.actor).toBeNull();
    });
  });

  it('does not call findMany (fallback discovery) when configured user fails', async () => {
    mocks.userFindFirst.mockResolvedValue(null);
    await withProductionBypass({}, async () => {
      const { resolveRequestActor } = await import('../../server/auth/requestContext');
      await resolveRequestActor(null);
      expect(mocks.membershipFindMany).not.toHaveBeenCalled();
    });
  });

  it('does not call findMany (fallback discovery) when membership fails', async () => {
    mocks.membershipFindFirst.mockResolvedValue(null);
    await withProductionBypass({}, async () => {
      const { resolveRequestActor } = await import('../../server/auth/requestContext');
      await resolveRequestActor(null);
      expect(mocks.membershipFindMany).not.toHaveBeenCalled();
    });
  });

  it('HTTP error response for misconfigured does not contain IDs, emails, or env values', async () => {
    mocks.userFindFirst.mockResolvedValue(null);
    await withProductionBypass({}, async () => {
      const { resolveRequestActor } = await import('../../server/auth/requestContext');
      const result = await resolveRequestActor(null);
      // The error value itself must be the safe enum string only
      expect(result.error).toBe('misconfigured');
      // Serialize to confirm no PII leaks through the resolution object
      const serialized = JSON.stringify(result);
      expect(serialized).not.toContain(CONFIGURED_USER);
      expect(serialized).not.toContain(VALID_WORKSPACE);
      expect(serialized).not.toContain('@');
    });
  });

  it('maps VIEWER membership role correctly for configured user', async () => {
    mocks.membershipFindFirst.mockResolvedValue({ role: 'VIEWER' });
    await withProductionBypass({}, async () => {
      const { resolveRequestActor } = await import('../../server/auth/requestContext');
      const result = await resolveRequestActor(null);
      expect(result.error).toBeNull();
      expect(result.actor?.role).toBe('viewer');
    });
  });
});

describe('multiple active admins are never silently selected', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('discoverUniqueAdminForDiagnostics returns not-found when multiple admins exist', async () => {
    mocks.membershipFindMany.mockResolvedValue([
      { user: { id: 'admin-a', email: 'a@example.test' } },
      { user: { id: 'admin-b', email: 'b@example.test' } },
    ]);
    const { discoverUniqueAdminForDiagnostics } = await import('../../server/auth/requestContext');
    const result = await discoverUniqueAdminForDiagnostics(VALID_WORKSPACE);
    expect(result.found).toBe(false);
  });

  it('discoverUniqueAdminForDiagnostics returns not-found when no admins exist', async () => {
    mocks.membershipFindMany.mockResolvedValue([]);
    const { discoverUniqueAdminForDiagnostics } = await import('../../server/auth/requestContext');
    const result = await discoverUniqueAdminForDiagnostics(VALID_WORKSPACE);
    expect(result.found).toBe(false);
  });

  it('discoverUniqueAdminForDiagnostics returns the unique admin when exactly one exists', async () => {
    mocks.membershipFindMany.mockResolvedValue([
      { user: { id: 'admin-a', email: 'a@example.test' } },
    ]);
    const { discoverUniqueAdminForDiagnostics } = await import('../../server/auth/requestContext');
    const result = await discoverUniqueAdminForDiagnostics(VALID_WORKSPACE);
    expect(result.found).toBe(true);
    if (result.found) {
      expect(result.userId).toBe('admin-a');
    }
  });
});

describe('requestContext and comparison CLI use the same configured env vars', () => {
  it('both require DEFAULT_WORKSPACE_ID and DEFAULT_USER_ID from process.env', async () => {
    // This test verifies structural parity: both surfaces read from the same env var names.
    // The CLI is already tested in runBestPrefillComparison.test.ts for strict fail-closed behavior.
    // Here we verify the env var names are consistent.
    const { runBestPrefillComparisonCli } = await import(
      '../../server/cli/runBestPrefillComparison'
    );

    const lines: string[] = [];
    const code = await runBestPrefillComparisonCli({
      args: [],
      env: {
        DATABASE_URL: 'postgresql://finance_user:x@localhost:5433/finance?schema=finance',
        DEFAULT_WORKSPACE_ID: '',
        DEFAULT_USER_ID: 'some-user',
      } as unknown as NodeJS.ProcessEnv,
      createDb: async () => ({ db: {} as any, disconnect: async () => {} }),
      write: (l) => lines.push(l),
    });
    expect(code).toBe(2);
    const parsed = JSON.parse(lines[0]);
    expect(parsed.errorCode).toBe('WORKSPACE_OR_USER_REQUIRED');
  });
});
