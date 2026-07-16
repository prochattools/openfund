import { Request, Response } from 'express';
import { prisma } from '../prismaClient';
import {
  clearReviewQueue as clearReviewQueueForUser,
  getEvidenceRichReviewQueue,
} from '../services/reviewQueueService';
import {
  assignManualBooking,
  INCOMPLETE_DIMENSIONS_MESSAGE,
  isCompleteReviewAssignmentPayload,
  ReviewDecisionError,
} from '../services/reviewDecisionService';
import {
  activateRuleCreation,
  previewRuleCreation,
  RuleCreationError,
  type RuleCreationCondition,
} from '../services/ruleCreationService';
import { requireAuthenticatedRequest, requireAdmin } from '../auth/requestContext';
import { readRouteParam } from './routeParams';

const REVIEW_PAGE_SIZES = new Set([25, 50, 100]);
const REVIEW_CONFIDENCE_BANDS = new Set(['green', 'amber', 'red', 'gray']);
const REVIEW_DIRECTIONS = new Set(['credit', 'debit']);

const readQueryString = (value: unknown): string | null => {
  const raw = Array.isArray(value) ? value[0] : value;
  return typeof raw === 'string' && raw.trim() ? raw.trim() : null;
};

const readPositiveInteger = (value: unknown, fallback: number): number => {
  const raw = Array.isArray(value) ? value[0] : value;
  const parsed = typeof raw === 'string' ? Number.parseInt(raw, 10) : Number.NaN;
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

const readReviewQueueOptions = (req: Request) => {
  const query = req.query ?? {};
  const page = readPositiveInteger(query.page, 1);
  const requestedPageSize = readPositiveInteger(query.pageSize, 25);
  const pageSize = REVIEW_PAGE_SIZES.has(requestedPageSize) ? requestedPageSize : 25;
  const confidenceValue = readQueryString(query.confidence);
  const directionValue = readQueryString(query.direction);
  const stateValue = readQueryString(query.state);
  return {
    page,
    pageSize,
    confidence: confidenceValue && REVIEW_CONFIDENCE_BANDS.has(confidenceValue)
      ? confidenceValue as 'green' | 'amber' | 'red' | 'gray'
      : null,
    direction: directionValue && REVIEW_DIRECTIONS.has(directionValue)
      ? directionValue as 'credit' | 'debit'
      : null,
    projectId: readQueryString(query.projectId),
    categoryId: readQueryString(query.categoryId),
    state: stateValue === 'incomplete' ? 'incomplete' as const : 'all' as const,
  };
};

const sendReviewDecisionError = (res: Response, error: unknown, fallback: string) => {
  if (error instanceof ReviewDecisionError || error instanceof RuleCreationError) {
    return res.status(error.statusCode).json({ error: error.message });
  }

  return res.status(500).json({ error: fallback });
};

export const getReviewTransactions = async (req: Request, res: Response) => {
  const actor = await requireAuthenticatedRequest(req, res);
  if (!actor) {
    return;
  }

  try {
    return res.json(await getEvidenceRichReviewQueue(prisma, actor.userId, readReviewQueueOptions(req)));
  } catch (error) {
    console.error('Beoordelingsrij kon niet worden geladen', error);
    return res.status(500).json({ error: 'De beoordelingsrij kon niet worden geladen.' });
  }
};

export const updateTransactionCategory = async (req: Request, res: Response) => {
  const actor = await requireAdmin(req, res);
  if (!actor) {
    return;
  }

  const transactionId = readRouteParam(req, 'id');

  if (!transactionId) {
    return res.status(400).json({ error: 'Transactie id ontbreekt.' });
  }

  const payload = req.body as {
    categoryId?: string | null;
    projectId?: string | null;
    transactionTypeId?: string | null;
    reason?: string | null;
  };

  const reason = payload.reason ?? null;

  if (!isCompleteReviewAssignmentPayload(payload)) {
    return res.status(400).json({ error: INCOMPLETE_DIMENSIONS_MESSAGE });
  }

  try {
    const result = await prisma.$transaction((db) => assignManualBooking(db, {
      actor,
      transactionId,
      projectId: payload.projectId,
      transactionTypeId: payload.transactionTypeId,
      categoryId: payload.categoryId,
      reason,
    }));

    return res.json({
      id: result.transaction.id,
      categoryId: result.transaction.categoryId,
      categoryName: result.transaction.category?.name ?? null,
      projectId: result.transaction.projectId,
      projectName: result.transaction.project?.name ?? null,
      transactionTypeId: result.transaction.transactionTypeId,
      transactionTypeName: result.transaction.transactionType?.literalName ?? null,
      bookingId: result.booking.id,
      reviewDecisionId: result.decision.id,
    });
  } catch (error) {
    console.error('Boeking kon niet worden bijgewerkt', error);
    return sendReviewDecisionError(res, error, 'De boeking kon niet worden bijgewerkt.');
  }
};

export const clearReviewQueue = async (req: Request, res: Response) => {
  const actor = await requireAdmin(req, res);
  if (!actor) {
    return;
  }

  try {
    await prisma.$transaction((tx) => clearReviewQueueForUser(tx, actor.userId));
    return res.json({ cleared: 0 });
  } catch (error) {
    console.error('Beoordelingsrij kon niet worden afgerond', error);
    return sendReviewDecisionError(res, error, 'De beoordelingsrij kon niet worden afgerond.');
  }
};

const readRuleCreationPayload = (body: unknown): {
  reviewDecisionId?: string | null;
  projectId?: string | null;
  transactionTypeId?: string | null;
  categoryId?: string | null;
  label?: string | null;
  conditions?: RuleCreationCondition[];
  confidence?: string | null;
  previewHash?: string | null;
  explicitConfirmation?: boolean;
} => {
  const payload = (body ?? {}) as Record<string, unknown>;
  return {
    reviewDecisionId: typeof payload.reviewDecisionId === 'string' ? payload.reviewDecisionId : null,
    projectId: typeof payload.projectId === 'string' ? payload.projectId : null,
    transactionTypeId: typeof payload.transactionTypeId === 'string' ? payload.transactionTypeId : null,
    categoryId: typeof payload.categoryId === 'string' ? payload.categoryId : null,
    label: typeof payload.label === 'string' ? payload.label : null,
    conditions: Array.isArray(payload.conditions) ? payload.conditions as RuleCreationCondition[] : [],
    confidence: typeof payload.confidence === 'string' ? payload.confidence : null,
    previewHash: typeof payload.previewHash === 'string' ? payload.previewHash : null,
    explicitConfirmation: payload.explicitConfirmation === true,
  };
};

export const previewReviewRuleCreation = async (req: Request, res: Response) => {
  const actor = await requireAdmin(req, res);
  if (!actor) {
    return;
  }

  const transactionId = readRouteParam(req, 'id');
  if (!transactionId) {
    return res.status(400).json({ error: 'Transactie id ontbreekt.' });
  }

  try {
    const preview = await prisma.$transaction((db) => previewRuleCreation(db, {
      actor,
      transactionId,
      ...readRuleCreationPayload(req.body),
    }));

    return res.json(preview);
  } catch (error) {
    console.error('Regelvoorbeeld kon niet worden opgebouwd', error);
    return sendReviewDecisionError(res, error, 'Regelvoorbeeld kon niet worden opgebouwd.');
  }
};

export const activateReviewRuleCreation = async (req: Request, res: Response) => {
  const actor = await requireAdmin(req, res);
  if (!actor) {
    return;
  }

  const transactionId = readRouteParam(req, 'id');
  if (!transactionId) {
    return res.status(400).json({ error: 'Transactie id ontbreekt.' });
  }

  try {
    const result = await prisma.$transaction((db) => activateRuleCreation(db, {
      actor,
      transactionId,
      ...readRuleCreationPayload(req.body),
    }));

    return res.status(201).json({
      rule: result.rule,
      preview: result.preview,
      sideEffects: result.sideEffects,
    });
  } catch (error) {
    console.error('Regel kon niet worden geactiveerd', error);
    return sendReviewDecisionError(res, error, 'Regel kon niet worden geactiveerd.');
  }
};
