import { Prisma, type PrismaClient } from '@prisma/client';
import {
  FINANCE_BENCHMARK_SOURCE_SHA256,
  evaluateDeterministicBenchmark,
  loadDeterministicBenchmarkSource,
  type DeterministicBenchmarkReport,
  type DeterministicBenchmarkSourceRow,
} from './deterministicBenchmarkEvaluationService';
import { loadConfirmedHistoryEligibility } from './confirmedHistoryEligibilityService';
import {
  buildReadOnlyPhase4Pipeline,
  type SuggestionBackfillTransaction,
} from './suggestionBackfillService';

export const DETERMINISTIC_BENCHMARK_RUNNER_VERSION = 'deterministic-benchmark-runner-v1';

export type DeterministicBenchmarkRunnerErrorCode =
  | 'READ_ONLY_ACKNOWLEDGEMENT_REQUIRED'
  | 'DATABASE_URL_REQUIRED'
  | 'PRISMA_INITIALIZATION_FAILED'
  | 'PRISMA_CONNECTION_FAILED'
  | 'FROZEN_SOURCE_QUERY_FAILED'
  | 'FROZEN_SOURCE_LOOKUP_FAILED'
  | 'WORKSPACE_CONTEXT_REQUIRED'
  | 'ADMIN_MEMBERSHIP_REQUIRED'
  | 'SOURCE_LOAD_FAILED'
  | 'SOURCE_MISMATCH'
  | 'ELIGIBILITY_LOAD_FAILED'
  | 'TRANSACTION_HYDRATION_FAILED'
  | 'TRANSACTION_HYDRATION_MISMATCH'
  | 'PHASE4_PIPELINE_FAILED'
  | 'BENCHMARK_EVALUATION_FAILED'
  | 'REPLAY_MISMATCH'
  | 'PRISMA_DISCONNECT_FAILED'
  | 'BENCHMARK_EXECUTION_FAILED';

export class DeterministicBenchmarkRunnerError extends Error {
  constructor(public readonly code: DeterministicBenchmarkRunnerErrorCode) {
    super(code);
    this.name = 'DeterministicBenchmarkRunnerError';
  }
}

type RunnerDb = Pick<
  PrismaClient,
  | 'workspaceMembership'
  | 'sourceFile'
  | 'bankStatement'
  | 'transaction'
  | 'project'
  | 'transactionType'
  | 'category'
>;

type RunnerTransaction = SuggestionBackfillTransaction;

export type DeterministicBenchmarkRunnerOutput = {
  runnerVersion: typeof DETERMINISTIC_BENCHMARK_RUNNER_VERSION;
  sourceId: string;
  sourceVersion: string;
  evaluatorVersion: string;
  sourceHash: string;
  reportHash: string;
  metrics: DeterministicBenchmarkReport['metrics'];
  replay: {
    verified: true;
    sourceHashMatches: true;
    reportHashMatches: true;
    rowHashesMatch: true;
    metricsMatch: true;
  };
  sideEffects: DeterministicBenchmarkReport['sideEffects'] & {
    opensTransaction: false;
  };
  phase5Gate: 'PHASE_5_GATE_UNDECIDABLE';
  phase5GateReason: 'NO_COMMITTED_NUMERIC_ACCEPTANCE_THRESHOLDS';
};

export const evaluateDeterministicBenchmarkRow = async (input: {
  db: Pick<PrismaClient, 'project' | 'transactionType' | 'category'>;
  workspaceId: string;
  transaction: RunnerTransaction;
  eligibleHistory: Awaited<ReturnType<typeof loadConfirmedHistoryEligibility>>['eligibleHistory'];
}) => {
  const result = await buildReadOnlyPhase4Pipeline({
    db: input.db,
    workspaceId: input.workspaceId,
    transaction: input.transaction,
    eligibleHistory: input.eligibleHistory,
  });
  return { decision: result.decision, orchestration: result.orchestration };
};

const stableEqual = (left: unknown, right: unknown): boolean =>
  JSON.stringify(left) === JSON.stringify(right);

const runStage = async <T>(
  code: DeterministicBenchmarkRunnerErrorCode,
  action: () => Promise<T>,
): Promise<T> => {
  try {
    return await action();
  } catch (error) {
    if (error instanceof DeterministicBenchmarkRunnerError) throw error;
    throw new DeterministicBenchmarkRunnerError(code);
  }
};

const lookupFrozenSource = async (db: RunnerDb) => {
  try {
    return await db.sourceFile.findFirst({
      where: { sha256: FINANCE_BENCHMARK_SOURCE_SHA256 },
      select: { workspaceId: true },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientInitializationError
      || error instanceof Prisma.PrismaClientRustPanicError
    ) {
      throw new DeterministicBenchmarkRunnerError('PRISMA_CONNECTION_FAILED');
    }
    throw new DeterministicBenchmarkRunnerError('FROZEN_SOURCE_QUERY_FAILED');
  }
};

export const runDeterministicBenchmark = async (input: {
  db: RunnerDb;
}): Promise<DeterministicBenchmarkRunnerOutput> => {
  const frozenSource = await lookupFrozenSource(input.db);
  if (!frozenSource) throw new DeterministicBenchmarkRunnerError('WORKSPACE_CONTEXT_REQUIRED');
  const membership = await runStage('ADMIN_MEMBERSHIP_REQUIRED', () =>
    input.db.workspaceMembership.findFirst({
      where: {
        workspaceId: frozenSource.workspaceId,
        role: 'ADMIN',
        isActive: true,
        workspace: { isActive: true },
      },
      select: { userId: true, workspaceId: true },
    }));
  if (!membership) throw new DeterministicBenchmarkRunnerError('ADMIN_MEMBERSHIP_REQUIRED');

  const execute = async (): Promise<DeterministicBenchmarkReport> => {
    const source = await runStage('SOURCE_LOAD_FAILED', () =>
      loadDeterministicBenchmarkSource(input.db, { userId: membership.userId }));
    if (source.workspaceId !== membership.workspaceId) {
      throw new DeterministicBenchmarkRunnerError('SOURCE_MISMATCH');
    }
    const eligibility = await runStage('ELIGIBILITY_LOAD_FAILED', () =>
      loadConfirmedHistoryEligibility(input.db, {
        workspaceId: membership.workspaceId,
        userId: membership.userId,
      }));
    const labeledIds = source.rows
      .filter((row) => row.labelStatus === 'LABELED_CONFIRMED')
      .map((row) => row.transactionId);
    const transactions = await runStage('TRANSACTION_HYDRATION_FAILED', () =>
      input.db.transaction.findMany({
        where: { id: { in: labeledIds } },
        select: {
          id: true,
          date: true,
          accountId: true,
          direction: true,
          amountMinor: true,
          counterparty: true,
          reference: true,
          description: true,
          rawRow: true,
        },
        orderBy: [{ date: 'asc' }, { id: 'asc' }],
      })) as RunnerTransaction[];
    const byId = new Map(transactions.map((transaction) => [transaction.id, transaction]));

    return runStage('BENCHMARK_EVALUATION_FAILED', () =>
      evaluateDeterministicBenchmark({
        source,
        evaluateRow: async (row: DeterministicBenchmarkSourceRow) => {
          const transaction = byId.get(row.transactionId);
          if (!transaction) {
            throw new DeterministicBenchmarkRunnerError('TRANSACTION_HYDRATION_MISMATCH');
          }
          return runStage('PHASE4_PIPELINE_FAILED', () =>
            evaluateDeterministicBenchmarkRow({
              db: input.db,
              workspaceId: membership.workspaceId,
              transaction,
              eligibleHistory: eligibility.eligibleHistory,
            }));
        },
      }));
  };

  const first = await execute();
  const second = await execute();
  const rowHashesMatch = stableEqual(
    first.rows.map((row) => row.rowHash),
    second.rows.map((row) => row.rowHash),
  );
  const metricsMatch = stableEqual(first.metrics, second.metrics);
  if (
    first.sourceHash !== second.sourceHash
    || first.reportHash !== second.reportHash
    || !rowHashesMatch
    || !metricsMatch
  ) {
    throw new DeterministicBenchmarkRunnerError('REPLAY_MISMATCH');
  }

  return {
    runnerVersion: DETERMINISTIC_BENCHMARK_RUNNER_VERSION,
    sourceId: first.sourceId,
    sourceVersion: first.sourceVersion,
    evaluatorVersion: first.evaluatorVersion,
    sourceHash: first.sourceHash,
    reportHash: first.reportHash,
    metrics: first.metrics,
    replay: {
      verified: true,
      sourceHashMatches: true,
      reportHashMatches: true,
      rowHashesMatch: true,
      metricsMatch: true,
    },
    sideEffects: {
      ...first.sideEffects,
      opensTransaction: false,
    },
    phase5Gate: 'PHASE_5_GATE_UNDECIDABLE',
    phase5GateReason: 'NO_COMMITTED_NUMERIC_ACCEPTANCE_THRESHOLDS',
  };
};
