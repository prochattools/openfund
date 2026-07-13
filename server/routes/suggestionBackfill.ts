import type { Request, Response } from 'express';
import { prisma } from '../prismaClient';
import { requireAdmin } from '../auth/requestContext';
import { backfillHistorySuggestions } from '../services/suggestionBackfillService';

export const postSuggestionBackfill = async (req: Request, res: Response) => {
  const actor = await requireAdmin(req, res);
  if (!actor) return;

  const body = (req.body ?? {}) as {
    execute?: boolean;
    confirmBackfill?: boolean;
    algorithmVersion?: string;
  };

  try {
    const result = await backfillHistorySuggestions(prisma, {
      userId: actor.userId,
      execute: body.execute === true,
      confirmBackfill: body.confirmBackfill === true,
      algorithmVersion: body.algorithmVersion?.trim() || undefined,
      executionAllowed: process.env.ALLOW_SUGGESTION_BACKFILL_EXECUTION === 'true',
    });

    const statusCode = result.status === 'WORKSPACE_NOT_FOUND'
      ? 404
      : result.status === 'EXECUTION_NOT_ALLOWED' || result.status === 'CONFIRMATION_REQUIRED'
        ? 409
        : result.status === 'CREATED'
          ? 201
          : 200;

    return res.status(statusCode).json(result);
  } catch (error) {
    console.error('Suggestion backfill failed', error);
    return res.status(500).json({
      error: 'De suggestievoorvulling kon niet worden berekend.',
      dryRun: body.execute !== true,
      writesPerformed: false,
      sideEffects: {
        createsTransactionBooking: false,
        closesPeriod: false,
        mutatesBankFacts: false,
      },
    });
  }
};
