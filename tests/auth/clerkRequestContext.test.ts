import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  verifyClerkSession: vi.fn(),
  getUser: vi.fn(),
  userFindFirst: vi.fn(),
  membershipFindFirst: vi.fn(),
}));

vi.mock('../../src/utils/session-auth', () => ({
  verifyClerkSession: mocks.verifyClerkSession,
}));
vi.mock('@clerk/backend', () => ({
  createClerkClient: () => ({ users: { getUser: mocks.getUser } }),
}));
vi.mock('../../server/prismaClient', () => ({
  prisma: {
    user: { findFirst: mocks.userFindFirst },
    workspaceMembership: { findFirst: mocks.membershipFindFirst },
  },
}));

const originalEnv = { ...process.env };

describe('Clerk identity to finance membership authorization', () => {
  beforeEach(() => {
    vi.resetModules();
    (process.env as Record<string, string | undefined>).NODE_ENV = 'production';
    process.env.AUTH_PROVIDER = 'clerk';
    process.env.NEXT_PUBLIC_AUTH_PROVIDER = 'clerk';
    process.env.CLERK_SECRET_KEY = 'sk_test_unit_test_key_for_auth';
    process.env.DEFAULT_WORKSPACE_ID = '11111111-1111-4111-8111-111111111111';
    mocks.verifyClerkSession.mockResolvedValue({ clerkUserId: 'clerk-user-1' });
    mocks.getUser.mockResolvedValue({
      primaryEmailAddress: { emailAddress: 'Finance@example.test' },
    });
    mocks.userFindFirst.mockResolvedValue({ id: 'local-user-1', email: 'finance@example.test' });
    mocks.membershipFindFirst.mockResolvedValue({ role: 'VIEWER' });
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('derives the local user and viewer role from verified Clerk identity plus membership', async () => {
    const { resolveRequestActor } = await import('../../server/auth/requestContext');

    await expect(resolveRequestActor('__session=verified')).resolves.toEqual({
      actor: {
        userId: 'local-user-1',
        workspaceId: expect.any(String),
        role: 'viewer',
        actorId: 'local-user-1',
        actorEmail: 'finance@example.test',
      },
      error: null,
    });
    expect(mocks.userFindFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ email: { equals: 'finance@example.test', mode: 'insensitive' } }),
    }));
    expect(mocks.membershipFindFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ workspaceId: expect.any(String), isActive: true }),
    }));
  });

  it('denies an authenticated Clerk user without active workspace membership', async () => {
    mocks.membershipFindFirst.mockResolvedValue(null);
    const { resolveRequestActor } = await import('../../server/auth/requestContext');

    await expect(resolveRequestActor('__session=verified')).resolves.toEqual({
      actor: null,
      error: 'forbidden',
    });
  });

  it('maps an active administrator membership to the admin role', async () => {
    mocks.membershipFindFirst.mockResolvedValue({ role: 'ADMIN' });
    const { resolveRequestActor } = await import('../../server/auth/requestContext');

    await expect(resolveRequestActor('__session=verified')).resolves.toMatchObject({
      actor: { userId: 'local-user-1', role: 'admin' },
      error: null,
    });
  });

  it('accepts the seeded production workspace UUID when it is configured as the active workspace', async () => {
    process.env.DEFAULT_WORKSPACE_ID = '00000000-0000-4000-8000-000000000001';
    const { resolveRequestActor } = await import('../../server/auth/requestContext');

    await expect(resolveRequestActor('__session=verified')).resolves.toMatchObject({
      actor: { userId: 'local-user-1' },
      error: null,
    });
  });

  it('denies a verified Clerk user without an active local User', async () => {
    mocks.userFindFirst.mockResolvedValue(null);
    const { resolveRequestActor } = await import('../../server/auth/requestContext');

    await expect(resolveRequestActor('__session=verified')).resolves.toEqual({
      actor: null,
      error: 'forbidden',
    });
  });

  it('fails closed when the production workspace configuration is missing or malformed', async () => {
    const { resolveRequestActor } = await import('../../server/auth/requestContext');

    delete process.env.DEFAULT_WORKSPACE_ID;
    await expect(resolveRequestActor('__session=verified')).resolves.toEqual({
      actor: null,
      error: 'misconfigured',
    });

    process.env.DEFAULT_WORKSPACE_ID = 'not-a-workspace-id';
    await expect(resolveRequestActor('__session=verified')).resolves.toEqual({
      actor: null,
      error: 'misconfigured',
    });
  });
});
