import { Request, Response } from 'express';
import { prisma } from '../prismaClient';
import { getRequestActor } from '../auth/requestContext';
import { readListLimit } from './queryParams';

export const readAuditLogLimit = readListLimit;

export type AuditLogResponseInput = {
  id: string;
  actorId: string | null;
  actorEmail: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  before: unknown;
  after: unknown;
  metadata: unknown;
  createdAt: Date;
};

export const serializeAuditLogEntry = (log: AuditLogResponseInput) => ({
  id: log.id,
  actorId: log.actorId,
  actorEmail: log.actorEmail,
  action: log.action,
  entityType: log.entityType,
  entityId: log.entityId,
  before: log.before,
  after: log.after,
  metadata: log.metadata,
  createdAt: log.createdAt.toISOString(),
});

export const listAuditLogs = async (req: Request, res: Response) => {
  const { userId } = getRequestActor(req);
  const limit = readAuditLogLimit(req.query.limit);

  try {
    const logs = await prisma.auditLog.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return res.json(logs.map(serializeAuditLogEntry));
  } catch (error) {
    console.error('Auditlog kon niet worden geladen', error);
    return res.status(500).json({ error: 'De auditlog kon niet worden geladen.' });
  }
};
