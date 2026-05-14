import { Request, Response } from 'express';
import { prisma } from '../prismaClient';
import { clearReviewQueue as clearReviewQueueForUser } from '../services/reviewQueueService';
import { createAuditLog } from '../services/auditLogService';
import { getRequestActor, requireAdmin } from '../auth/requestContext';
import { readRouteParam } from './routeParams';

export const getReviewTransactions = async (req: Request, res: Response) => {
  const { userId } = getRequestActor(req);

  try {
    const [transactions, categories] = await Promise.all([
      prisma.transaction.findMany({
        where: {
          userId,
          OR: [
            { categoryId: null },
            { classificationSource: 'none' },
            { classificationSource: 'import' },
          ],
        },
        include: {
          account: true,
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
      })),
      categories,
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

  const { userId, actorId, actorEmail } = actor;
  const transactionId = readRouteParam(req, 'id');

  if (!transactionId) {
    return res.status(400).json({ error: 'Transactie id ontbreekt.' });
  }
  const { categoryId, categoryName } = req.body as {
    categoryId?: string | null;
    categoryName?: string;
  };

  try {
    const tx = await prisma.transaction.findFirst({
      where: {
        id: transactionId,
        userId,
      },
      include: {
        ledger: {
          select: {
            lockedAt: true,
          },
        },
      },
    });

    if (!tx) {
      return res.status(404).json({ error: 'Transactie niet gevonden.' });
    }

    if (process.env.RECONCILIATION_LOCKS_ENABLED !== 'false' && tx.ledger?.lockedAt) {
      return res.status(423).json({ error: 'Deze maand is vergrendeld. Ontgrendel de maand voordat je deze transactie wijzigt.' });
    }

    const updated = await prisma.$transaction(async (db) => {
      let finalCategoryId = categoryId ?? null;

      if (!finalCategoryId && categoryName) {
        const category = await db.category.upsert({
          where: { name: categoryName },
          update: {},
          create: { name: categoryName },
        });

        finalCategoryId = category.id;
      }

      const result = await db.transaction.update({
        where: { id: transactionId },
        data: {
          categoryId: finalCategoryId,
          classificationSource: 'manual',
          classificationRuleId: null,
        },
        include: {
          category: true,
        },
      });

      await createAuditLog(db, {
        userId,
        actorId,
        actorEmail,
        action: 'transaction.category.updated',
        entityType: 'transaction',
        entityId: transactionId,
        before: {
          categoryId: tx.categoryId,
          classificationSource: tx.classificationSource,
          classificationRuleId: tx.classificationRuleId,
        },
        after: {
          categoryId: result.categoryId,
          categoryName: result.category?.name ?? null,
          classificationSource: result.classificationSource,
          classificationRuleId: result.classificationRuleId,
        },
      });

      return result;
    });

    return res.json({
      id: updated.id,
      categoryId: updated.categoryId,
      categoryName: updated.category?.name ?? null,
    });
  } catch (error) {
    console.error('Categorie kon niet worden bijgewerkt', error);
    return res.status(500).json({ error: 'De categorie kon niet worden bijgewerkt.' });
  }
};

export const clearReviewQueue = async (req: Request, res: Response) => {
  const actor = requireAdmin(req, res);
  if (!actor) {
    return;
  }

  try {
    const cleared = await prisma.$transaction((tx) => clearReviewQueueForUser(tx, actor.userId));
    return res.json({ cleared });
  } catch (error) {
    console.error('Beoordelingsrij kon niet worden afgerond', error);
    return res.status(500).json({ error: 'De beoordelingsrij kon niet worden afgerond.' });
  }
};
