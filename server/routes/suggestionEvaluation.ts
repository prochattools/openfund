import type { Request, Response } from 'express';
import { prisma } from '../prismaClient';
import { requireAuthenticatedRequest } from '../auth/requestContext';
import {
  evaluateHistorySuggestionsForUser,
  type HistoryEvaluationMode,
} from '../services/historySuggestionEvaluationService';

const readSingleQuery = (value: unknown): string | undefined => {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (Array.isArray(value) && typeof value[0] === 'string' && value[0].trim()) return value[0].trim();
  return undefined;
};

export const getSuggestionEvaluation = async (req: Request, res: Response) => {
  const actor = await requireAuthenticatedRequest(req, res);
  if (!actor) {
    return;
  }

  const { userId } = actor;
  const requestedMode = readSingleQuery(req.query.mode) ?? 'chronological';
  if (requestedMode !== 'chronological' && requestedMode !== 'leave-one-out') {
    return res.status(400).json({
      error: 'Mode moet chronological of leave-one-out zijn.',
      readOnly: true,
    });
  }

  const algorithmVersion = readSingleQuery(req.query.algorithmVersion);

  try {
    const evaluation = await evaluateHistorySuggestionsForUser(prisma, {
      userId,
      mode: requestedMode as HistoryEvaluationMode,
      algorithmVersion,
    });
    return res.json({ ...evaluation, readOnly: true });
  } catch (error) {
    console.error('Suggestion evaluation failed', error);
    return res.status(500).json({
      error: 'De suggestiekwaliteit kon niet worden geëvalueerd.',
      readOnly: true,
    });
  }
};
