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
import { inspectMonthlyTransactionIntegrity } from '../services/monthlyReconciliationService';
import {
  buildStatementPeriodMonthSlice,
  calendarMonthBounds,
  statementPeriodFullyCoversMonth,
} from '../services/statementPeriodMonthSliceService';

export type PeriodClosePreviewItem = {
  statementPeriodId: string;
  accountIdentifier: string;
  periodStart: string;
  periodEnd: string;
  closeControlHash: string;
  latestCloseStatus: string | null;
  latestCloseVersion: number | null;
  isClosed: boolean;
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

    const monthBounds = calendarMonthBounds(year, month);
    const selectedByAccount = new Map<string, (typeof statementPeriods)[number]>();
    const rankPeriod = (sp: (typeof statementPeriods)[number]) => {
      const exact = sp.periodStart.getTime() === monthBounds.start.getTime()
        && sp.periodEnd.getTime() === monthBounds.end.getTime();
      const full = statementPeriodFullyCoversMonth(sp.periodStart, sp.periodEnd, year, month);
      const exactComplete = exact && sp.coverageStatus === 'COMPLETE';
      const span = sp.periodEnd.getTime() - sp.periodStart.getTime();
      return { tier: exactComplete ? 4 : exact ? 3 : full ? 2 : 1, span };
    };
    for (const sp of statementPeriods) {
      const current = selectedByAccount.get(sp.accountId);
      if (!current) {
        selectedByAccount.set(sp.accountId, sp);
        continue;
      }
      const candidateRank = rankPeriod(sp);
      const currentRank = rankPeriod(current);
      if (candidateRank.tier > currentRank.tier
        || (candidateRank.tier === currentRank.tier && candidateRank.span < currentRank.span)) {
        selectedByAccount.set(sp.accountId, sp);
      }
    }

    // Build one preview per account for the selected calendar month.
    const previews: PeriodClosePreviewItem[] = [];

    for (const sp of selectedByAccount.values()) {
      const sourceTransactions = await prisma.transaction.findMany({
        where: {
          userId: actor.userId,
          accountId: sp.accountId,
          date: { gte: sp.periodStart, lte: sp.periodEnd },
        },
        select: { date: true, amountMinor: true, direction: true },
      });
      const slice = buildStatementPeriodMonthSlice({
        source: {
          periodStart: sp.periodStart,
          periodEnd: sp.periodEnd,
          coverageStatus: sp.coverageStatus,
          openingBalanceMinor: sp.openingBalanceMinor,
          incomeMinor: sp.incomeMinor,
          expenseMinor: sp.expenseMinor,
          closingBalanceMinor: sp.closingBalanceMinor,
          transactionCount: sp.transactionCount,
        },
        year,
        month,
        transactions: sourceTransactions.map((tx) => ({
          date: tx.date,
          amountMinor: tx.amountMinor,
          direction: tx.direction as 'credit' | 'debit',
        })),
      });

      const transactions = await prisma.transaction.findMany({
        where: {
          userId: actor.userId,
          accountId: sp.accountId,
          date: { gte: slice.periodStart, lte: slice.periodEnd },
        },
        select: {
          id: true,
          date: true,
          amountMinor: true,
          direction: true,
          importFingerprint: true,
          rawRow: true,
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

      const transactionIntegrity = inspectMonthlyTransactionIntegrity({
        workspaceId: sp.workspaceId,
        accountId: sp.accountId,
        year,
        month,
        openingBalanceMinor: slice.openingBalanceMinor,
        transactions: transactions.map((tx) => ({
          transactionId: tx.id,
          date: tx.date,
          amountMinor: tx.amountMinor,
          direction: tx.direction as 'credit' | 'debit',
          importFingerprint: tx.importFingerprint,
          rawRow: tx.rawRow && typeof tx.rawRow === 'object' && !Array.isArray(tx.rawRow)
            ? tx.rawRow as Record<string, unknown>
            : null,
        })),
      });

      const previousStatementPeriodCandidate = await prisma.statementPeriod.findFirst({
        where: {
          workspaceId: sp.workspaceId,
          accountId: sp.accountId,
          periodEnd: { lt: sp.periodStart },
        },
        orderBy: { periodEnd: 'desc' },
        select: { id: true, coverageStatus: true, closingBalanceMinor: true },
      });
      const previousStatementPeriod = previousStatementPeriodCandidate?.id === sp.id
        ? null
        : previousStatementPeriodCandidate;

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
        periodStart: slice.periodStart,
        periodEnd: slice.periodEnd,
        coverageStatus: slice.coverageStatus,
        statementTotals: {
          openingBalanceMinor: slice.openingBalanceMinor,
          incomeMinor: slice.incomeMinor,
          expenseMinor: slice.expenseMinor,
          closingBalanceMinor: slice.closingBalanceMinor,
          transactionCount: slice.transactionCount,
        },
        bookedTransactions,
        ...transactionIntegrity,
        previousStatementClosingBalanceMinor: previousStatementPeriod?.closingBalanceMinor ?? null,
        previousStatementCoverageStatus: previousStatementPeriod?.coverageStatus ?? null,
      });

      const categoryControls = buildCategoryControlTotals({
        workspaceId: sp.workspaceId,
        accountId: sp.accountId,
        accountIdentifier: sp.statement.bankAccountIdentifier,
        periodStart: slice.periodStart,
        periodEnd: slice.periodEnd,
        statementIncomeMinor: slice.incomeMinor,
        statementExpenseMinor: slice.expenseMinor,
        statementTransactionCount: slice.transactionCount,
        transactions: categoryTransactions,
      });

      const combined = buildCloseControlPreview(statementPreview, categoryControls);
      const closeControlHash = buildCloseControlHashFromParts(sp.id, ledger.id, combined);

      // Load latest close for this selected monthly ledger and source period.
      const latestClose = await prisma.periodClose.findFirst({
        where: { statementPeriodId: sp.id, ledgerId: ledger.id },
        select: { version: true, status: true },
        orderBy: { version: 'desc' },
      });

      previews.push({
        statementPeriodId: sp.id,
        accountIdentifier: sp.statement.bankAccountIdentifier,
        periodStart: slice.periodStart.toISOString().slice(0, 10),
        periodEnd: slice.periodEnd.toISOString().slice(0, 10),
        closeControlHash,
        latestCloseStatus: latestClose?.status ?? null,
        latestCloseVersion: latestClose?.version ?? null,
        isClosed: latestClose?.status === 'CLOSED',
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
