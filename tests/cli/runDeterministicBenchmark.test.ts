import { describe, expect, it, vi } from 'vitest';
import { runDeterministicBenchmarkCli } from '../../server/cli/runDeterministicBenchmark';
import { DeterministicBenchmarkRunnerError } from '../../server/services/deterministicBenchmarkRunnerService';

const successResult = {
  runnerVersion: 'deterministic-benchmark-runner-v1',
  sourceId: 'finance-db-open-statement-2026-221',
  sourceVersion: 'finance-db-benchmark-source-v1',
  evaluatorVersion: 'deterministic-benchmark-evaluator-v1',
  sourceHash: 'source-hash',
  reportHash: 'report-hash',
  metrics: { totalSourceRows: 221 },
  replay: {
    verified: true,
    sourceHashMatches: true,
    reportHashMatches: true,
    rowHashesMatch: true,
    metricsMatch: true,
  },
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
    opensTransaction: false,
  },
  phase5Gate: 'PHASE_5_GATE_UNDECIDABLE',
  phase5GateReason: 'NO_COMMITTED_NUMERIC_ACCEPTANCE_THRESHOLDS',
} as const;

const setup = (execute = vi.fn(async () => successResult)) => {
  const disconnect = vi.fn(async () => undefined);
  const createDb = vi.fn(async () => ({ db: {} as any, disconnect }));
  const write = vi.fn();
  return { execute, disconnect, createDb, write };
};

describe('deterministic benchmark CLI', () => {
  it('requires explicit read-only acknowledgement before creating Prisma', async () => {
    const dependencies = setup();
    const code = await runDeterministicBenchmarkCli({ args: [], env: { DATABASE_URL: 'hidden' }, dependencies });
    expect(code).toBe(2);
    expect(dependencies.createDb).not.toHaveBeenCalled();
    expect(dependencies.write).toHaveBeenCalledWith(JSON.stringify({ ok: false, errorCode: 'READ_ONLY_ACKNOWLEDGEMENT_REQUIRED' }));
  });

  it('fails closed when DATABASE_URL is absent without exposing a value', async () => {
    const dependencies = setup();
    const code = await runDeterministicBenchmarkCli({ args: ['--read-only'], env: {}, dependencies });
    expect(code).toBe(2);
    expect(dependencies.createDb).not.toHaveBeenCalled();
    expect(dependencies.write).toHaveBeenCalledWith(JSON.stringify({ ok: false, errorCode: 'DATABASE_URL_REQUIRED' }));
  });

  it('prints only structured success output and disconnects', async () => {
    const dependencies = setup();
    const code = await runDeterministicBenchmarkCli({
      args: ['--read-only'], env: { DATABASE_URL: 'must-not-appear' }, dependencies,
    });
    expect(code).toBe(0);
    expect(dependencies.disconnect).toHaveBeenCalledOnce();
    const output = dependencies.write.mock.calls[0][0];
    expect(JSON.parse(output)).toMatchObject({ ok: true, sourceHash: 'source-hash', reportHash: 'report-hash' });
    expect(output).not.toContain('must-not-appear');
  });

  it('maps known failures to stable error codes and disconnects', async () => {
    const dependencies = setup(vi.fn(async () => { throw new DeterministicBenchmarkRunnerError('REPLAY_MISMATCH'); }));
    const code = await runDeterministicBenchmarkCli({
      args: ['--read-only'], env: { DATABASE_URL: 'hidden' }, dependencies,
    });
    expect(code).toBe(1);
    expect(dependencies.disconnect).toHaveBeenCalledOnce();
    expect(dependencies.write).toHaveBeenCalledWith(JSON.stringify({ ok: false, errorCode: 'REPLAY_MISMATCH' }));
  });

  it('maps unknown failures without leaking stack traces and disconnects', async () => {
    const dependencies = setup(vi.fn(async () => { throw new Error('secret internal detail'); }));
    const code = await runDeterministicBenchmarkCli({
      args: ['--read-only'], env: { DATABASE_URL: 'hidden' }, dependencies,
    });
    expect(code).toBe(1);
    expect(dependencies.disconnect).toHaveBeenCalledOnce();
    const output = dependencies.write.mock.calls[0][0];
    expect(output).toBe(JSON.stringify({ ok: false, errorCode: 'BENCHMARK_EXECUTION_FAILED' }));
    expect(output).not.toContain('secret internal detail');
  });
});
