import { Request, Response } from 'express';
import { requireAdmin } from '../auth/requestContext';
import { prisma } from '../prismaClient';
import {
  buildStatementReconciliationPreview,
  StatementReconciliationControlError,
  type BookedTransactionSummary,
} from '../services/statementReconciliationControlService';

export const getStatementReconciliationPreview = async (req: Request, res: Response) => {
  const actor = requireAdmin(req, res);
  if (!actor) return;

  const statementPeriodId = typeof req.params.id === 'string' ? req.params.id : '';
  if (!statementPeriodId) {
    return res.status(400).json({ error: 'Afschriftperiode-ID is verplicht.' });
  }

  try {
    const statementPeriod = await prisma.statementPeriod.findFirst({
      where: { id: statementPeriodId },
      include: {
        statement: true,
      },
    });

    if (!statementPeriod) {
      return res.status(404).json({ error: 'Afschriftperiode niet gevonden.' });
    }

    const transactions = await prisma.transaction.findMany({
      where: {
        userId: actor.userId,
        date: {
          gte: statementPeriod.periodStart,
          lte: statementPeriod.periodEnd,
        },
      },
      select: {
        id: true,
        amountMinor: true,
        direction: true,
        transactionBooking: {
          select: {
            projectId: true,
            transactionTypeId: true,
            categoryId: true,
          },
        },
        categorizationSuggestions: {
          where: { status: 'PENDING' },
          select: { id: true },
        },
      },
    });

    const bookedTransactions: BookedTransactionSummary[] = transactions.map((tx) => {
      const booking = tx.transactionBooking;
      const hasCompleteBooking = Boolean(
        booking && booking.projectId && booking.transactionTypeId && booking.categoryId,
      );
      const hasPendingSuggestions = tx.categorizationSuggestions.length > 0;
      const isUnresolved = !hasCompleteBooking && hasPendingSuggestions;

      return {
        transactionId: tx.id,
        amountMinor: tx.amountMinor,
        direction: tx.direction as 'credit' | 'debit',
        hasCompleteBooking,
        isUnresolved,
      };
    });

    const preview = buildStatementReconciliationPreview({
      workspaceId: statementPeriod.statement.workspaceId,
      accountId: statementPeriod.accountId,
      accountIdentifier: statementPeriod.statement.bankAccountIdentifier,
      statementPeriodId: statementPeriod.id,
      periodStart: statementPeriod.periodStart,
      periodEnd: statementPeriod.periodEnd,
      coverageStatus: statementPeriod.coverageStatus,
      statementTotals: {
        openingBalanceMinor: statementPeriod.openingBalanceMinor,
        incomeMinor: statementPeriod.incomeMinor,
        expenseMinor: statementPeriod.expenseMinor,
        closingBalanceMinor: statementPeriod.closingBalanceMinor,
        transactionCount: statementPeriod.transactionCount,
      },
      bookedTransactions,
    });

    return res.json(preview);
  } catch (error) {
    if (error instanceof StatementReconciliationControlError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.error('Reconciliatievoorbeeldweergave kon niet worden berekend', error);
    return res.status(500).json({ error: 'Reconciliatievoorbeeldweergave kon niet worden berekend.' });
  }
};
