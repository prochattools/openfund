import { Request, Response } from 'express';
import { prisma } from '../prismaClient';

const DEFAULT_USER_ID = process.env.DEFAULT_USER_ID ?? 'demo-user';

const readLimit = (value: unknown): number => {
  const parsed = Number(value);
  if (Number.isInteger(parsed) && parsed > 0 && parsed <= 100) {
    return parsed;
  }
  return 25;
};

export const listAuditLogs = async (req: Request, res: Response) => {
  const userId = req.header('x-user-id') ?? DEFAULT_USER_ID;
  const limit = readLimit(req.query.limit);

  try {
    const logs = await prisma.auditLog.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return res.json(
      logs.map((log) => ({
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
      })),
    );
  } catch (error) {
    console.error('Audit log fetch failed', error);
    return res.status(500).json({ error: 'De auditlog kon niet worden geladen.' });
  }
};
