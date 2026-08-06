import { Request, Response } from 'express';
import { requireAdmin } from '../auth/requestContext';
import { prisma } from '../prismaClient';
import {
  buildStatementReconciliationPreview,
  type BookedTransactionSummary,
} from '../services/statementReconciliationControlService';
import {
  buildCategoryControlTotals,
  buildCloseControlPreview,
} from '../services/categoryControlTotalsService';
import { buildCloseControlHashFromParts } from '../services/strictPeriodCloseService';

export type PeriodClosePreviewItem = {
  statementPeriodId: string;
  accountIdentifier: string;
  periodStart: string;
  periodEnd: string;
  closeControlHash: string | null;
  preview: {
    status: string;
    closeEligible: boolean;
    blockers: string[];
  };
};

export const getMonthlyClosePreview = async (req: Request, res: Response) => {
  const actor = await requireAdmin(req, res);
  if (!actor) return;

  const year = Number(req.query.year);
  const month = Number(req.query.month);

  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    return res.status(400).json({ error: 'Jaar is ongeldig.' });
  }
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    return res.status(400).json({ error: 'Maand is ongeldig.' });
  }

  try {
    const periodStart = new Date(Date.UTC(year, month - 1, 1));
    const periodEnd = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));

    // Find the ledger for this period
    const ledger = await prisma.ledger.findFirst({
      where: { userId: actor.userId, month, year },
      select: { id: true },
    });

    if (!ledger) {
      return res.status(404).json({ error: 'Grootboek niet gevonden.' });
    }

    // Find all statement periods that overlap with this month, ordered by account and period
    const statementPeriods = await prisma.statementPeriod.findMany({
      where: {
        account: { userId: actor.userId },
        periodStart: { lte: periodEnd },
        periodEnd: { gte: periodStart },
      },
      include: { statement: true, account: true },
      orderBy: [{ accountId: 'asc' }, { periodStart: 'asc' }],
    });

    if (statementPeriods.length === 0) {
      return res.status(404).json({ error: 'Geen bankafschriften voor deze maand.' });
    }

    // Build preview for each statement period
    const previews: PeriodClosePreviewItem[] = [];

    for (const sp of statementPeriods) {
      const transactions = await prisma.transaction.findMany({
        where: {
          userId: actor.userId,
          accountId: sp.accountId,
          date: {
            gte: sp.periodStart,
            lte: sp.periodEnd,
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
              literalProjectLabel: true,
              literalTypeLabel: true,
              literalCategoryLabel: true,
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

      const categoryTransactions = transactions.map((tx) => {
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
          projectId: booking?.projectId ?? null,
          transactionTypeId: booking?.transactionTypeId ?? null,
          categoryId: booking?.categoryId ?? null,
          literalProjectLabel: booking?.literalProjectLabel ?? null,
          literalTypeLabel: booking?.literalTypeLabel ?? null,
          literalCategoryLabel: booking?.literalCategoryLabel ?? null,
        };
      });

      const statementPreview = buildStatementReconciliationPreview({
        workspaceId: sp.workspaceId,
        accountId: sp.accountId,
        accountIdentifier: sp.statement.bankAccountIdentifier,
        statementPeriodId: sp.id,
        periodStart: sp.periodStart,
        periodEnd: sp.periodEnd,
        coverageStatus: sp.coverageStatus,
        statementTotals: {
          openingBalanceMinor: sp.openingBalanceMinor,
          incomeMinor: sp.incomeMinor,
          expenseMinor: sp.expenseMinor,
          closingBalanceMinor: sp.closingBalanceMinor,
          transactionCount: sp.transactionCount,
        },
        bookedTransactions,
      });

      const categoryControls = buildCategoryControlTotals({
        workspaceId: sp.workspaceId,
        accountId: sp.accountId,
        accountIdentifier: sp.statement.bankAccountIdentifier,
        periodStart: sp.periodStart,
        periodEnd: sp.periodEnd,
        statementIncomeMinor: sp.incomeMinor,
        statementExpenseMinor: sp.expenseMinor,
        statementTransactionCount: sp.transactionCount,
        transactions: categoryTransactions,
      });

      const combined = buildCloseControlPreview(statementPreview, categoryControls);
      const closeControlHash = buildCloseControlHashFromParts(sp.id, ledger.id, combined);

      previews.push({
        statementPeriodId: sp.id,
        accountIdentifier: sp.statement.bankAccountIdentifier,
        periodStart: sp.periodStart.toISOString().slice(0, 10),
        periodEnd: sp.periodEnd.toISOString().slice(0, 10),
        closeControlHash,
        preview: {
          status: combined.combinedStatus,
          closeEligible: combined.combinedCloseEligible,
          blockers: combined.combinedReasons,
        },
      });
    }

    return res.json({
      ledger: { id: ledger.id },
      month: `${year}-${String(month).padStart(2, '0')}`,
      periods: previews,
    });
  } catch (err: unknown) {
    console.error('[GET /api/reconciliation/statement-periods/close-preview]', err);
    return res.status(500).json({ error: 'Closevoorvertoning kon niet worden geladen.' });
  }
};
