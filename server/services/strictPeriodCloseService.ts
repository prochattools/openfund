import type { Prisma } from '@prisma/client';
import { hashEvidence } from './reviewDecisionService';
import {
  buildStatementReconciliationPreview,
  type BookedTransactionSummary,
} from './statementReconciliationControlService';
import {
  buildCategoryControlTotals,
  buildCloseControlPreview,
  toCombinedReconciliationEvidence,
  type CategoryControlTransactionInput,
  type CombinedCloseControlPreview,
} from './categoryControlTotalsService';
import { createPeriodClose, PeriodCloseError, type BalancedReconciliationEvidence } from './periodCloseService';
import type { AppRole } from '../auth/requestContext';
import { buildStatementPeriodMonthSlice } from './statementPeriodMonthSliceService';
import { inspectMonthlyTransactionIntegrity } from './monthlyReconciliationService';

export class StrictPeriodCloseError extends Error {
  statusCode: number;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = 'StrictPeriodCloseError';
    this.statusCode = statusCode;
  }
}

type TxClient = Prisma.TransactionClient;

export type StrictCloseActor = {
  userId: string;
  role?: AppRole;
  actorId?: string | null;
  actorEmail?: string | null;
};

export type StrictPeriodCloseInput = {
  actor: StrictCloseActor;
  workspaceId: string;
  ledgerId: string;
  statementPeriodId: string;
  expectedCloseControlHash: string | null;
  confirmed: boolean;
};

export type StrictPeriodCloseResult = {
  closeId: string;
  version: number;
  statementPeriodId: string;
  ledgerId: string;
  periodStart: string;
  periodEnd: string;
  closeControlHash: string;
  combinedPreview: CombinedCloseControlPreview;
  sideEffects: {
    createsPeriodClose: true;
    createsReportSnapshot: false;
    createsTransactionBooking: false;
    dispatchesReport: false;
  };
};

export type CloseControlHashInput = {
  statementPeriodId: string;
  ledgerId: string;
  periodStart: string;
  periodEnd: string;
  statementTotals: {
    incomeMinor: string;
    expenseMinor: string;
    balanceDifferenceMinor: string;
    transactionCount: number;
  };
  bookedTotals: {
    incomeMinor: string;
    expenseMinor: string;
    transactionCount: number;
    bookedTransactionCount: number;
    unresolvedTransactionCount: number;
  };
  categoryDifferences: {
    categoryIncomeDifferenceMinor: string;
    categoryExpenseDifferenceMinor: string;
    transactionCountDifference: number;
  };
  integrity: {
    duplicateFingerprintCount: number;
    runningBalanceErrorCount: number;
    monthChainErrorCount: number;
  };
  closeEligible: boolean;
  validatorVersions: string;
};

export const buildCloseControlHashFromParts = (
  statementPeriodId: string,
  ledgerId: string,
  combined: CombinedCloseControlPreview,
): string => {
  const input = {
    statementPeriodId,
    ledgerId,
    periodStart: combined.statementReconciliation.periodStart,
    periodEnd: combined.statementReconciliation.periodEnd,
    statementTotals: {
      incomeMinor: combined.statementReconciliation.source.incomeMinor,
      expenseMinor: combined.statementReconciliation.source.expenseMinor,
      balanceDifferenceMinor: combined.statementReconciliation.differences.balanceDifferenceMinor,
      transactionCount: combined.statementReconciliation.source.transactionCount,
    },
    bookedTotals: {
      incomeMinor: combined.statementReconciliation.booked.incomeMinor,
      expenseMinor: combined.statementReconciliation.booked.expenseMinor,
      transactionCount: combined.statementReconciliation.booked.transactionCount,
      bookedTransactionCount: combined.statementReconciliation.booked.bookedTransactionCount,
      unresolvedTransactionCount: combined.statementReconciliation.booked.unresolvedTransactionCount,
    },
    categoryDifferences: {
      categoryIncomeDifferenceMinor: combined.categoryControls.differences.categoryIncomeDifferenceMinor,
      categoryExpenseDifferenceMinor: combined.categoryControls.differences.categoryExpenseDifferenceMinor,
      transactionCountDifference: combined.categoryControls.differences.transactionCountDifference,
    },
    integrity: combined.statementReconciliation.integrity,
    closeEligible: combined.combinedCloseEligible,
    validatorVersions: `${combined.statementReconciliation.validatorVersion}+${combined.categoryControls.validatorVersion}`,
  };
  return hashEvidence(input);
};

const assertAdminActor = (actor: StrictCloseActor) => {
  if (actor.role && actor.role !== 'admin') {
    throw new StrictPeriodCloseError(
      'Alleen beheerders mogen een periode sluiten.',
      403,
    );
  }
};

const assertConfirmed = (confirmed: boolean | undefined) => {
  if (!confirmed) {
    throw new StrictPeriodCloseError(
      'Expliciete bevestiging is vereist om een periode te sluiten.',
    );
  }
};

const assertHashRequiredWhenConfirmed = (
  confirmed: boolean | undefined,
  expectedHash: string | null | undefined,
) => {
  if (confirmed && (!expectedHash || typeof expectedHash !== 'string' || !expectedHash.trim())) {
    throw new StrictPeriodCloseError(
      'Sluitingscontrolehash is verplicht wanneer confirmed=true.',
      400,
    );
  }
};

const assertNoActiveClose = async (
  db: TxClient,
  ledgerId: string,
) => {
  const existing = await db.periodClose.findFirst({
    where: {
      ledgerId,
      status: 'CLOSED',
    },
  });
  if (existing) {
    throw new StrictPeriodCloseError(
      'Er bestaat al een actieve afsluiting voor deze afschriftperiode.',
      409,
    );
  }
};

export const executeStrictPeriodClose = async (
  db: TxClient,
  input: StrictPeriodCloseInput,
): Promise<StrictPeriodCloseResult> => {
  assertAdminActor(input.actor);
  assertConfirmed(input.confirmed);
  assertHashRequiredWhenConfirmed(input.confirmed, input.expectedCloseControlHash);

  const statementPeriod = await db.statementPeriod.findFirst({
    where: { id: input.statementPeriodId },
    include: { statement: true },
  });

  if (!statementPeriod) {
    throw new StrictPeriodCloseError('Afschriftperiode niet gevonden.', 404);
  }

  const ledger = await db.ledger.findFirst({
    where: { id: input.ledgerId, userId: input.actor.userId },
    select: { id: true, year: true, month: true },
  });
  if (!ledger) {
    throw new StrictPeriodCloseError('Grootboek niet gevonden.', 404);
  }

  const previousStatementPeriodCandidate = await db.statementPeriod.findFirst({
    where: {
      workspaceId: statementPeriod.statement.workspaceId,
      accountId: statementPeriod.accountId,
      periodEnd: { lt: statementPeriod.periodStart },
    },
    orderBy: { periodEnd: 'desc' },
    select: { id: true, coverageStatus: true, closingBalanceMinor: true },
  });
  const previousStatementPeriod = previousStatementPeriodCandidate?.id === statementPeriod.id
    ? null
    : previousStatementPeriodCandidate;

  await assertNoActiveClose(db, input.ledgerId);

  const sourceTransactions = await db.transaction.findMany({
    where: {
      userId: input.actor.userId,
      accountId: statementPeriod.accountId,
      date: { gte: statementPeriod.periodStart, lte: statementPeriod.periodEnd },
    },
    select: { date: true, amountMinor: true, direction: true },
  });
  const slice = buildStatementPeriodMonthSlice({
    source: {
      periodStart: statementPeriod.periodStart,
      periodEnd: statementPeriod.periodEnd,
      coverageStatus: statementPeriod.coverageStatus,
      openingBalanceMinor: statementPeriod.openingBalanceMinor,
      incomeMinor: statementPeriod.incomeMinor,
      expenseMinor: statementPeriod.expenseMinor,
      closingBalanceMinor: statementPeriod.closingBalanceMinor,
      transactionCount: statementPeriod.transactionCount,
    },
    year: ledger.year,
    month: ledger.month,
    transactions: sourceTransactions.map((tx) => ({
      date: tx.date,
      amountMinor: tx.amountMinor,
      direction: tx.direction as 'credit' | 'debit',
    })),
  });
  if (slice.coverageStatus !== 'COMPLETE') {
    throw new StrictPeriodCloseError(
      'Dit bankafschrift dekt de geselecteerde kalendermaand niet volledig. Alleen volledig gedekte maanden kunnen worden afgesloten.',
      409,
    );
  }

  const transactions = await db.transaction.findMany({
    where: {
      userId: input.actor.userId,
      accountId: statementPeriod.accountId,
      date: {
        gte: slice.periodStart,
        lte: slice.periodEnd,
      },
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

  const categoryTransactions: CategoryControlTransactionInput[] = transactions.map((tx) => {
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

  const transactionIntegrity = inspectMonthlyTransactionIntegrity({
    workspaceId: statementPeriod.statement.workspaceId,
    accountId: statementPeriod.accountId,
    year: ledger.year,
    month: ledger.month,
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

  const statementPreview = buildStatementReconciliationPreview({
    workspaceId: statementPeriod.statement.workspaceId,
    accountId: statementPeriod.accountId,
    accountIdentifier: statementPeriod.statement.bankAccountIdentifier,
    statementPeriodId: statementPeriod.id,
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
    workspaceId: statementPeriod.statement.workspaceId,
    accountId: statementPeriod.accountId,
    accountIdentifier: statementPeriod.statement.bankAccountIdentifier,
    periodStart: slice.periodStart,
    periodEnd: slice.periodEnd,
    statementIncomeMinor: slice.incomeMinor,
    statementExpenseMinor: slice.expenseMinor,
    statementTransactionCount: slice.transactionCount,
    transactions: categoryTransactions,
  });

  const combined = buildCloseControlPreview(statementPreview, categoryControls);

  const closeControlHash = buildCloseControlHashFromParts(
    input.statementPeriodId,
    input.ledgerId,
    combined,
  );

  if (input.expectedCloseControlHash != null && input.expectedCloseControlHash !== closeControlHash) {
    throw new StrictPeriodCloseError(
      'De sluitingscontrolehash is verouderd. Ververs het afsluiting-overzicht opnieuw voordat u sluit.',
      409,
    );
  }

  if (!combined.combinedCloseEligible) {
    const reasons = combined.combinedReasons.join(' ');
    throw new StrictPeriodCloseError(
      `De periode kan niet worden gesloten: ${reasons}`,
    );
  }

  const reconciliationEvidence = toCombinedReconciliationEvidence(combined);
  if (!reconciliationEvidence) {
    throw new StrictPeriodCloseError(
      'Gecombineerde reconciliatie-evidence kon niet worden omgezet naar een balansevidentie.',
    );
  }

  const periodClose = await createPeriodClose(db, {
    workspaceId: input.workspaceId,
    ledgerId: input.ledgerId,
    statementId: statementPeriod.statementId,
    statementPeriodId: input.statementPeriodId,
    periodStart: slice.periodStart,
    periodEnd: slice.periodEnd,
    openingBalanceMinor: slice.openingBalanceMinor,
    incomeMinor: slice.incomeMinor,
    expenseMinor: slice.expenseMinor,
    closingBalanceMinor: slice.closingBalanceMinor,
    transactionCount: slice.transactionCount,
    closedBy: input.actor.actorId ?? input.actor.userId,
    reconciliationEvidence,
    classificationEvidence: { closeControlHash, validatorVersion: reconciliationEvidence.validatorVersion },
    sourceDataEvidence: { statementPeriodId: input.statementPeriodId, closeControlHash },
  });

  return {
    closeId: periodClose.id,
    version: periodClose.version,
    statementPeriodId: input.statementPeriodId,
    ledgerId: input.ledgerId,
    periodStart: slice.periodStart.toISOString().slice(0, 10),
    periodEnd: slice.periodEnd.toISOString().slice(0, 10),
    closeControlHash,
    combinedPreview: combined,
    sideEffects: {
      createsPeriodClose: true,
      createsReportSnapshot: false,
      createsTransactionBooking: false,
      dispatchesReport: false,
    },
  };
};

export { PeriodCloseError };

export type { BalancedReconciliationEvidence };
