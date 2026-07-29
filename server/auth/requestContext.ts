import type { NextFunction, Request, Response } from 'express';
import { createClerkClient } from '@clerk/backend';
import { prisma } from '../prismaClient';
import { AUTH_PROVIDER, isValidWorkspaceId } from '../../src/utils/auth';
import { verifyClerkSession } from '../../src/utils/session-auth';

export type AppRole = 'admin' | 'viewer';

export type RequestActor = {
  userId: string;
  role: AppRole;
  actorId: string;
  actorEmail: string;
};

export type AuthResolution =
  | { actor: RequestActor; error: null }
  | { actor: null; error: 'unauthenticated' | 'forbidden' | 'misconfigured' };

const REQUEST_ACTORS = new WeakMap<object, RequestActor>();

const unauthenticated = (): AuthResolution => ({ actor: null, error: 'unauthenticated' });
const forbidden = (): AuthResolution => ({ actor: null, error: 'forbidden' });
const misconfigured = (): AuthResolution => ({ actor: null, error: 'misconfigured' });

const getConfiguredWorkspaceId = (): string | null => {
  const value = process.env.DEFAULT_WORKSPACE_ID?.trim();
  return isValidWorkspaceId(value) ? value : null;
};

const sendAuthError = (res: Response, error: AuthResolution['error']) => {
  const status = error === 'forbidden' ? 403 : error === 'misconfigured' ? 503 : 401;
  const message =
    error === 'forbidden'
      ? 'Geen toegang tot deze financiële werkruimte.'
      : error === 'misconfigured'
        ? 'Authenticatie is tijdelijk niet beschikbaar.'
        : 'Authenticatie vereist.';
  return res.status(status).json({ error: message });
};

export const setRequestActor = (request: object, actor: RequestActor): void => {
  REQUEST_ACTORS.set(request, actor);
};

export const getRequestActor = (req: Request): RequestActor | null =>
  REQUEST_ACTORS.get(req) ?? null;

const resolveConfiguredLocalActor = async (): Promise<AuthResolution> => {
  if (AUTH_PROVIDER !== 'disabled') {
    return unauthenticated();
  }

  const workspaceId = getConfiguredWorkspaceId();
  if (!workspaceId) return misconfigured();

  const configuredUserId = process.env.DEFAULT_USER_ID?.trim();
  if (!configuredUserId) return unauthenticated();

  const user = await prisma.user.findFirst({
    where: { id: configuredUserId, isActive: true },
    select: { id: true, email: true },
  });
  if (!user) return forbidden();

  const membership = await prisma.workspaceMembership.findFirst({
    where: {
      userId: user.id,
      workspaceId,
      isActive: true,
      workspace: { isActive: true },
    },
    select: { role: true },
  });
  if (!membership) return forbidden();

  return {
    actor: {
      userId: user.id,
      role: membership.role === 'ADMIN' ? 'admin' : 'viewer',
      actorId: user.id,
      actorEmail: user.email,
    },
    error: null,
  };
};

export const resolveRequestActor = async (
  cookieHeader: string | null | undefined,
): Promise<AuthResolution> => {
  if (AUTH_PROVIDER === 'disabled') return resolveConfiguredLocalActor();

  const session = await verifyClerkSession(cookieHeader);
  if (!session) return unauthenticated();

  const workspaceId = getConfiguredWorkspaceId();
  if (!workspaceId) return misconfigured();

  const secretKey = process.env.CLERK_SECRET_KEY?.trim();
  if (!secretKey) return misconfigured();

  try {
    const clerk = createClerkClient({ secretKey });
    const clerkUser = await clerk.users.getUser(session.clerkUserId);
    const email = clerkUser.primaryEmailAddress?.emailAddress?.trim().toLowerCase();
    if (!email) return forbidden();

    const user = await prisma.user.findFirst({
      where: {
        email: { equals: email, mode: 'insensitive' },
        isActive: true,
      },
      select: { id: true, email: true },
    });
    if (!user) return forbidden();

    const membership = await prisma.workspaceMembership.findFirst({
      where: {
        userId: user.id,
        workspaceId,
        isActive: true,
        workspace: { isActive: true },
      },
      select: { role: true },
    });
    if (!membership) return forbidden();

    return {
      actor: {
        userId: user.id,
        role: membership.role === 'ADMIN' ? 'admin' : 'viewer',
        actorId: user.id,
        actorEmail: user.email,
      },
      error: null,
    };
  } catch {
    return unauthenticated();
  }
};

export const requireAuthenticatedRequest = async (
  req: Request,
  res: Response,
): Promise<RequestActor | null> => {
  const trustedActor = getRequestActor(req);
  if (trustedActor) return trustedActor;

  const resolution = await resolveRequestActor(req.header('cookie'));
  if (!resolution.actor) {
    sendAuthError(res, resolution.error);
    return null;
  }

  setRequestActor(req, resolution.actor);
  return resolution.actor;
};

export const requireAdmin = async (req: Request, res: Response): Promise<RequestActor | null> => {
  const actor = await requireAuthenticatedRequest(req, res);
  if (!actor) return null;

  if (actor.role !== 'admin') {
    res.status(403).json({ error: 'Alleen beheerders mogen deze actie uitvoeren.' });
    return null;
  }

  return actor;
};

export const authenticateExpressRequest = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  const resolution = await resolveRequestActor(req.header('cookie'));
  if (!resolution.actor) {
    sendAuthError(res, resolution.error);
    return;
  }

  setRequestActor(req, resolution.actor);
  next();
};
