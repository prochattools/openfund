import type { Request, Response } from 'express';
import { prisma } from '../prismaClient';
import { requireAdmin } from '../auth/requestContext';
import { repairApprovedOpeningBalance } from '../services/openingBalanceRepairService';

export const postOpeningBalanceRepair = async (req: Request, res: Response) => {
  const actor = await requireAdmin(req, res);
  if (!actor) return;

  const body = (req.body ?? {}) as {
    execute?: boolean;
    confirmApprovedControl?: boolean;
    accountIdentifier?: string;
  };

  try {
    const repair = await repairApprovedOpeningBalance(prisma, {
      userId: actor.userId,
      actorId: actor.actorId,
      actorEmail: actor.actorEmail,
      accountIdentifier: body.accountIdentifier?.trim() || undefined,
      execute: body.execute === true,
      confirmApprovedControl: body.confirmApprovedControl === true,
      executionAllowed: process.env.ALLOW_OPENING_BALANCE_REPAIR_EXECUTION === 'true',
    });

    const statusCode = repair.status === 'ACCOUNT_NOT_FOUND'
      ? 404
      : repair.status === 'CONFLICT'
        ? 409
        : repair.status === 'EXECUTION_NOT_ALLOWED' || repair.status === 'CONFIRMATION_REQUIRED'
          ? 409
          : repair.status === 'CREATED'
            ? 201
            : 200;

    return res.status(statusCode).json(repair);
  } catch (error) {
    console.error('Opening balance repair failed', error);
    return res.status(500).json({
      error: 'De beginbalansreparatie kon niet worden uitgevoerd.',
      dryRun: body.execute !== true,
      writesPerformed: false,
    });
  }
};
