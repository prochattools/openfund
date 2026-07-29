import { beforeEach, describe, expect, it, vi } from 'vitest';

const { loadSource, loadEligibility, evaluateBenchmark, buildPipeline } = vi.hoisted(() => ({
  loadSource: vi.fn(),
  loadEligibility: vi.fn(),
  evaluateBenchmark: vi.fn(),
  buildPipeline: vi.fn(),
}));

vi.mock('../../server/services/deterministicBenchmarkEvaluationService', async () => {
  const actual = await vi.importActual<typeof import('../../server/services/deterministicBenchmarkEvaluationService')>(
    '../../server/services/deterministicBenchmarkEvaluationService',
  );
  return {
    ...actual,
    loadDeterministicBenchmarkSource: loadSource,
    evaluateDeterministicBenchmark: evaluateBenchmark,
  };
});
vi.mock('../../server/services/confirmedHistoryEligibilityService', () => ({
  loadConfirmedHistoryEligibility: loadEligibility,
}));
vi.mock('../../server/services/suggestionBackfillService', async () => {
  const actual = await vi.importActual<typeof import('../../server/services/suggestionBackfillService')>(
    '../../server/services/suggestionBackfillService',
  );
  return { ...actual, buildReadOnlyPhase4Pipeline: buildPipeline };
});

import {
  DeterministicBenchmarkRunnerError,
  evaluateDeterministicBenchmarkRow,
  runDeterministicBenchmark,
} from '../../server/services/deterministicBenchmarkRunnerService';

const source = {
  sourceId: 'finance-db-open-statement-2026-221',
  sourceVersion: 'finance-db-benchmark-source-v1',
  sourceHash: 'source-hash',
  workspaceId: 'workspace-1',
  rows: [{ transactionId: 'tx-1', labelStatus: 'LABELED_CONFIRMED' }],
};
const metrics = { totalSourceRows: 221, coveredLabeledRows: 1 };
const report = {
  sourceId: source.sourceId,
  sourceVersion: source.sourceVersion,
  evaluatorVersion: 'deterministic-benchmark-evaluator-v1',
  sourceHash: source.sourceHash,
  workspaceId: source.workspaceId,
  rows: [{ rowHash: 'row-hash' }],
  metrics,
  reportHash: 'report-hash',
  sideEffects: {
    readOnly: true,
    writesPerformed: false,
    createsTransactionBooking: false,
    createsCategorizationSuggestion: false,
    mutatesBankFacts: false,
    mutatesReviewDecisions: false,
    mutatesPeriodState: false,
    mutatesLedgerRecords: false,
    mutatesMerchantKnowledge: false,
    persistsDecision: false,
    invokesExternalModel: false,
  },
};

const transaction = {
  id: 'tx-1', date: new Date('2026-01-01T00:00:00.000Z'), accountId: null,
  direction: 'credit', amountMinor: 100n, counterparty: null, reference: null,
  description: '', rawRow: {},
};

const makeDb = () => ({
  sourceFile: { findFirst: vi.fn(async () => ({ workspaceId: 'workspace-1' })) },
  workspaceMembership: { findFirst: vi.fn(async () => ({ userId: 'admin-1', workspaceId: 'workspace-1' })) },
  transaction: { findMany: vi.fn(async () => [transaction]) },
  bankStatement: { findFirst: vi.fn() },
  project: { findMany: vi.fn() },
  transactionType: { findMany: vi.fn() },
  category: { findMany: vi.fn() },
});

describe('deterministic benchmark runner service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    loadSource.mockResolvedValue(source);
    loadEligibility.mockResolvedValue({ eligibleHistory: [] });
    evaluateBenchmark.mockImplementation(async ({ evaluateRow }: any) => {
      await evaluateRow(source.rows[0]);
      return report;
    });
    buildPipeline.mockResolvedValue({ decision: { status: 'INCOMPLETE' }, orchestration: { status: 'ABSTAINED' } });
  });

  it('delegates each row to the existing read-only Phase 4 adapter', async () => {
    const result = await evaluateDeterministicBenchmarkRow({
      db: makeDb() as any, workspaceId: 'workspace-1', transaction: transaction as any, eligibleHistory: [],
    });
    expect(buildPipeline).toHaveBeenCalledOnce();
    expect(result).toEqual({ decision: { status: 'INCOMPLETE' }, orchestration: { status: 'ABSTAINED' } });
  });

  it('discovers frozen-source administrator authority and verifies replay', async () => {
    const db = makeDb();
    const result = await runDeterministicBenchmark({ db: db as any });
    expect(db.sourceFile.findFirst).toHaveBeenCalledOnce();
    expect(db.workspaceMembership.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ workspaceId: 'workspace-1', role: 'ADMIN', isActive: true }),
    }));
    expect(evaluateBenchmark).toHaveBeenCalledTimes(2);
    expect(result).toMatchObject({
      sourceHash: 'source-hash', reportHash: 'report-hash',
      replay: { verified: true, rowHashesMatch: true, metricsMatch: true },
      sideEffects: { writesPerformed: false, opensTransaction: false },
      phase5Gate: 'PHASE_5_GATE_UNDECIDABLE',
    });
    expect((db as any).$transaction).toBeUndefined();
  });

  it('fails closed when replay report hashes differ', async () => {
    evaluateBenchmark
      .mockResolvedValueOnce(report)
      .mockResolvedValueOnce({ ...report, reportHash: 'different-report-hash' });
    await expect(runDeterministicBenchmark({ db: makeDb() as any }))
      .rejects.toEqual(expect.objectContaining<Partial<DeterministicBenchmarkRunnerError>>({ code: 'REPLAY_MISMATCH' }));
  });

  it('fails closed when frozen source authority is unavailable', async () => {
    const db = makeDb();
    db.sourceFile.findFirst.mockResolvedValueOnce(null as any);
    await expect(runDeterministicBenchmark({ db: db as any }))
      .rejects.toEqual(expect.objectContaining({ code: 'WORKSPACE_CONTEXT_REQUIRED' }));
  });
});
