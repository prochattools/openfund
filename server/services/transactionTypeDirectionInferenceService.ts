import crypto from 'node:crypto';
import type { PrismaClient, TransactionDirection } from '@prisma/client';

export const DIRECTION_INFERENCE_VERSION = 'direction-inference-v1';

export type DirectionInferenceOutcome = 'unambiguous' | 'conflicting' | 'unknown' | 'unused';

export type TransactionTypeDirectionEntry = {
  transactionTypeId: string;
  literalName: string;
  currentDirection: TransactionDirection | null;
  outcome: DirectionInferenceOutcome;
  proposedDirection: TransactionDirection | null;
  creditCount: number;
  debitCount: number;
  bookingCount: number;
};

export type TransactionTypeDirectionInferencePlan = {
  algorithmVersion: string;
  workspaceId: string;
  planHash: string;
  sideEffects: { writesPerformed: false };
  counts: {
    unambiguous: number;
    conflicting: number;
    unknown: number;
    unused: number;
    total: number;
  };
  entries: TransactionTypeDirectionEntry[];
};

export type DirectionInferenceExecutionResult = {
  status:
    | 'DRY_RUN_COMPLETE'
    | 'CONFIRMATION_REQUIRED'
    | 'EXECUTION_NOT_ALLOWED'
    | 'HASH_DRIFT'
    | 'APPLIED';
  dryRun: boolean;
  writesPerformed: boolean;
  updatedCount: number;
  skippedAlreadySetCount: number;
  plan: TransactionTypeDirectionInferencePlan;
  sideEffects: {
    updatesTransactionTypeDirection: boolean;
    createsTransactionBooking: false;
    createsReviewDecision: false;
    mutatesBankFacts: false;
  };
};

type DirectionInferenceDb = Pick<PrismaClient, 'transactionType' | 'transactionBooking' | '$transaction'>;

const stableValue = (value: unknown): unknown => {
  if (value === null || value === undefined) return null;
  if (Array.isArray(value)) return value.map(stableValue);
  if (typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([k, v]) => [k, stableValue(v)]),
    );
  }
  return value;
};

const hashPlan = (entries: TransactionTypeDirectionEntry[]): string => {
  const payload = entries.map((entry) => ({
    transactionTypeId: entry.transactionTypeId,
    outcome: entry.outcome,
    proposedDirection: entry.proposedDirection,
    creditCount: entry.creditCount,
    debitCount: entry.debitCount,
  }));
  return crypto
    .createHash('sha256')
    .update(JSON.stringify(stableValue(payload)))
    .digest('hex');
};

export const inferTransactionTypeDirections = async (
  db: DirectionInferenceDb,
  input: { workspaceId: string },
): Promise<TransactionTypeDirectionInferencePlan> => {
  const { workspaceId } = input;

  const types = await db.transactionType.findMany({
    where: { workspaceId },
    select: { id: true, literalName: true, direction: true },
    orderBy: [{ literalName: 'asc' }, { id: 'asc' }],
  });

  const bookings = await db.transactionBooking.findMany({
    where: { workspaceId },
    select: {
      transactionTypeId: true,
      transaction: { select: { direction: true } },
    },
  });

  const byTypeId = new Map<string, { credit: number; debit: number }>();
  for (const booking of bookings) {
    const entry = byTypeId.get(booking.transactionTypeId) ?? { credit: 0, debit: 0 };
    if (booking.transaction.direction === 'credit') {
      entry.credit += 1;
    } else {
      entry.debit += 1;
    }
    byTypeId.set(booking.transactionTypeId, entry);
  }

  const entries: TransactionTypeDirectionEntry[] = types.map((type) => {
    const counts = byTypeId.get(type.id);
    const creditCount = counts?.credit ?? 0;
    const debitCount = counts?.debit ?? 0;
    const bookingCount = creditCount + debitCount;

    let outcome: DirectionInferenceOutcome;
    let proposedDirection: TransactionDirection | null = null;

    if (bookingCount === 0) {
      outcome = type.direction === null ? 'unknown' : 'unused';
    } else if (creditCount > 0 && debitCount > 0) {
      outcome = 'conflicting';
    } else {
      outcome = 'unambiguous';
      proposedDirection = creditCount > 0 ? 'credit' : 'debit';
    }

    return {
      transactionTypeId: type.id,
      literalName: type.literalName,
      currentDirection: type.direction,
      outcome,
      proposedDirection,
      creditCount,
      debitCount,
      bookingCount,
    };
  });

  const sorted = [...entries].sort((left, right) => left.transactionTypeId.localeCompare(right.transactionTypeId));

  return {
    algorithmVersion: DIRECTION_INFERENCE_VERSION,
    workspaceId,
    planHash: hashPlan(sorted),
    sideEffects: { writesPerformed: false },
    counts: {
      unambiguous: entries.filter((e) => e.outcome === 'unambiguous').length,
      conflicting: entries.filter((e) => e.outcome === 'conflicting').length,
      unknown: entries.filter((e) => e.outcome === 'unknown').length,
      unused: entries.filter((e) => e.outcome === 'unused').length,
      total: entries.length,
    },
    entries,
  };
};

const baseDryRunResult = (plan: TransactionTypeDirectionInferencePlan): DirectionInferenceExecutionResult => ({
  status: 'DRY_RUN_COMPLETE',
  dryRun: true,
  writesPerformed: false,
  updatedCount: 0,
  skippedAlreadySetCount: 0,
  plan,
  sideEffects: {
    updatesTransactionTypeDirection: false,
    createsTransactionBooking: false,
    createsReviewDecision: false,
    mutatesBankFacts: false,
  },
});

export const executeDirectionInferencePlan = async (
  db: DirectionInferenceDb,
  input: {
    workspaceId: string;
    execute: boolean;
    executionAllowed: boolean;
    confirmedPlanHash?: string | null;
  },
): Promise<DirectionInferenceExecutionResult> => {
  const plan = await inferTransactionTypeDirections(db, { workspaceId: input.workspaceId });

  if (!input.execute) return baseDryRunResult(plan);

  if (!input.executionAllowed) {
    return { ...baseDryRunResult(plan), status: 'EXECUTION_NOT_ALLOWED', dryRun: false };
  }

  if (!input.confirmedPlanHash) {
    return { ...baseDryRunResult(plan), status: 'CONFIRMATION_REQUIRED', dryRun: false };
  }

  if (input.confirmedPlanHash !== plan.planHash) {
    return { ...baseDryRunResult(plan), status: 'HASH_DRIFT', dryRun: false };
  }

  return db.$transaction(async (tx) => {
    // Recompute inside transaction to detect race-condition drift
    const currentPlan = await inferTransactionTypeDirections(
      tx as unknown as DirectionInferenceDb,
      { workspaceId: input.workspaceId },
    );

    if (currentPlan.planHash !== input.confirmedPlanHash) {
      return {
        ...baseDryRunResult(currentPlan),
        status: 'HASH_DRIFT' as const,
        dryRun: false,
      };
    }

    const toUpdate = currentPlan.entries.filter(
      (entry) => entry.outcome === 'unambiguous' && entry.proposedDirection !== null,
    );

    let updatedCount = 0;
    let skippedAlreadySetCount = 0;

    for (const entry of toUpdate) {
      if (entry.currentDirection === entry.proposedDirection) {
        skippedAlreadySetCount += 1;
        continue;
      }
      await (tx as unknown as DirectionInferenceDb).transactionType.update({
        where: { id: entry.transactionTypeId },
        data: { direction: entry.proposedDirection },
      });
      updatedCount += 1;
    }

    return {
      status: 'APPLIED' as const,
      dryRun: false,
      writesPerformed: updatedCount > 0,
      updatedCount,
      skippedAlreadySetCount,
      plan: currentPlan,
      sideEffects: {
        updatesTransactionTypeDirection: updatedCount > 0,
        createsTransactionBooking: false,
        createsReviewDecision: false,
        mutatesBankFacts: false,
      },
    };
  });
};
