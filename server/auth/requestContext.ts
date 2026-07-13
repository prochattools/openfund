import { Request, Response } from 'express';
import { isProductionSessionAuthenticated } from '../../src/utils/session-auth';

export type AppRole = 'admin' | 'viewer';

const DEFAULT_USER_ID = process.env.DEFAULT_USER_ID ?? 'demo-user';
const DEFAULT_ROLE: AppRole = process.env.DEFAULT_USER_ROLE === 'viewer' ? 'viewer' : 'admin';

export type RequestActor = {
  userId: string;
  role: AppRole;
  actorId: string | null;
  actorEmail: string | null;
};

const normalizeRole = (value: string | undefined | null): AppRole =>
  value?.toLowerCase() === 'viewer' ? 'viewer' : 'admin';

export const getRequestActor = (req: Request): RequestActor => {
  const userId = req.header('x-user-id') ?? DEFAULT_USER_ID;
  const actorId = req.header('x-actor-id') ?? req.header('x-user-id') ?? null;
  const actorEmail = req.header('x-user-email') ?? null;
  const role = normalizeRole(req.header('x-user-role') ?? DEFAULT_ROLE);

  return {
    userId,
    role,
    actorId,
    actorEmail,
  };
};

export const requireAuthenticatedRequest = async (req: Request, res: Response): Promise<RequestActor | null> => {
  if (!(await isProductionSessionAuthenticated(req.header('cookie')))) {
    res.status(401).json({ error: 'Authenticatie vereist.' });
    return null;
  }

  return getRequestActor(req);
};

export const requireAdmin = async (req: Request, res: Response): Promise<RequestActor | null> => {
  const actor = await requireAuthenticatedRequest(req, res);
  if (!actor) {
    return null;
  }

  if (actor.role !== 'admin') {
    res.status(403).json({ error: 'Alleen beheerders mogen deze actie uitvoeren.' });
    return null;
  }

  return actor;
};
