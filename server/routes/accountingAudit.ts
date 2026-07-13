import type { Request, Response } from 'express';
import { prisma } from '../prismaClient';
import { requireAuthenticatedRequest } from '../auth/requestContext';
import { getAccountingAudit } from '../services/accountingAuditService';

const readSingleQuery = (value: unknown): string | undefined => {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (Array.isArray(value) && typeof value[0] === 'string' && value[0].trim()) return value[0].trim();
  return undefined;
};

export const getAccountingAuditReport = async (req: Request, res: Response) => {
  const actor = await requireAuthenticatedRequest(req, res);
  if (!actor) {
    return;
  }

  const { userId } = actor;
  const accountIdentifier = readSingleQuery(req.query.accountIdentifier);

  try {
    const audit = await getAccountingAudit(prisma, { userId, accountIdentifier });
    if (!audit) {
      return res.status(404).json({
        error: 'De gecontroleerde ING-rekening is niet gevonden.',
        readOnly: true,
      });
    }

    return res.json(audit);
  } catch (error) {
    console.error('Accounting audit failed', error);
    return res.status(500).json({
      error: 'De accountingcontrole kon niet worden uitgevoerd.',
      readOnly: true,
    });
  }
};
