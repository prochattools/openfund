import { Request, Response } from 'express';
import { prisma } from '../prismaClient';
import { clearReviewQueue as clearReviewQueueForUser } from '../services/reviewQueueService';
import {
  assignManualBooking,
  INCOMPLETE_DIMENSIONS_MESSAGE,
  isCompleteReviewAssignmentPayload,
  ReviewDecisionError,
} from '../services/reviewDecisionService';
import { getRequestActor, requireAdmin } from '../auth/requestContext';
import { readRouteParam } from './routeParams';

const sendReviewDecisionError = (res: Response, error: unknown, fallback: string) => {
  if (error instanceof ReviewDecisionError) {
    return res.status(error.statusCode).json({ error: error.message });
  }

  return res.status(500).json({ error: fallback });
};

export const getReviewTransactions = async (req: Request, res: Response) => {
  const { userId } = getRequestActor(req);

  try {
    const [transactions, categories, projects, transactionTypes] = await Promise.all([
      prisma.transaction.findMany({
        where: {
          userId,
          OR: [
            { transactionBooking: null },
            { categoryId: null },
            { classificationSource: 'none' },
            { classificationSource: 'import' },
          ],
        },
        include: {
          account: true,
          transactionBooking: true,
          categorizationSuggestions: {
            where: {
              status: 'PENDING',
            },
            orderBy: {
              rank: 'asc',
            },
          },
        },
        orderBy: {
          date: 'desc',
        },
      }),
      prisma.category.findMany({
        orderBy: {
          name: 'asc',
        },
      }),
      prisma.project.findMany({
        where: { isActive: true },
        orderBy: { name: 'asc' },
      }),
      prisma.transactionType.findMany({
        where: { isActive: true },
        orderBy: [{ sortOrder: 'asc' }, { literalName: 'asc' }],
      }),
    ]);

    return res.json({
      transactions: transactions.map((tx) => ({
        id: tx.id,
        date: tx.date,
        description: tx.description,
        amount: Number(tx.amountMinor) / 100,
        amountMinor: tx.amountMinor.toString(),
        currency: tx.currency,
        source: tx.source,
        counterparty: tx.counterparty,
        accountIdentifier: tx.account?.identifier ?? null,
        accountName: tx.account?.name ?? null,
        createdAt: tx.createdAt,
        booking: tx.transactionBooking,
        suggestions: tx.categorizationSuggestions,
      })),
      categories,
      projects,
      transactionTypes,
    });
  } catch (error) {
    console.error('Beoordelingsrij kon niet worden geladen', error);
    return res.status(500).json({ error: 'De beoordelingsrij kon niet worden geladen.' });
  }
};

export const updateTransactionCategory = async (req: Request, res: Response) => {
  const actor = requireAdmin(req, res);
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
  const actor = requireAdmin(req, res);
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
