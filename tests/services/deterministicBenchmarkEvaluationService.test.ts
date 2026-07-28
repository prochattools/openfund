import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import {
  DETERMINISTIC_BENCHMARK_EVALUATOR_VERSION,
  DeterministicBenchmarkError,
  FINANCE_BENCHMARK_ROW_COUNT,
  FINANCE_BENCHMARK_SOURCE_FILENAME,
  FINANCE_BENCHMARK_SOURCE_ID,
  FINANCE_BENCHMARK_SOURCE_SHA256,
  FINANCE_BENCHMARK_SOURCE_VERSION,
  evaluateDeterministicBenchmark,
  loadDeterministicBenchmarkSource,
  type BenchmarkPipelineResult,
  type DeterministicBenchmarkSource,
  type DeterministicBenchmarkSourceRow,
} from '../../server/services/deterministicBenchmarkEvaluationService';
import type { DeterministicDecisionResult } from '../../server/services/deterministicDecisionService';
import type { DeterministicOrchestrationResult } from '../../server/services/deterministicDecisionOrchestrationService';

const workspaceId = 'workspace-1';
const statement = {
  id: 'statement-1',
  workspaceId,
  sourceFileId: 'source-1',
  importBatchId: 'batch-1',
  periodStart: new Date('2026-01-01T00:00:00.000Z'),
  periodEnd: new Date('2026-07-01T00:00:00.000Z'),
  coverageStatus: 'PARTIAL',
  openingBalanceMinor: 1035086n,
  incomeMinor: 5878408n,
  expenseMinor: 6129769n,
  netMinor: -251361n,
  closingBalanceMinor: 783725n,
  transactionCount: FINANCE_BENCHMARK_ROW_COUNT,
};

const decisionRecord = (transactionId: string, bookingId: string, overrides: Record<string, unknown> = {}) => ({
  id: `decision-${transactionId}`,
  workspaceId,
  transactionId,
  suggestionId: null,
  action: 'ASSIGN_MANUALLY',
  afterBookingId: bookingId,
  afterProjectId: 'project-a',
  afterTypeId: 'type-a',
  afterCategoryId: 'category-a',
  actorId: 'admin-user',
  evidenceHash: `decision-evidence-${transactionId}`,
  decidedAt: new Date('2026-07-02T10:00:00.000Z'),
  suggestion: null,
  ...overrides,
});

const transactionRecord = (index: number, overrides: Record<string, unknown> = {}) => {
  const id = `transaction-${String(index).padStart(3, '0')}`;
  const bookingId = `booking-${id}`;
  return {
    id,
    userId: 'admin-user',
    date: new Date(Date.UTC(2026, 0, 1 + index)),
    importFingerprint: `fingerprint-${String(index).padStart(3, '0')}`,
    sourceFile: FINANCE_BENCHMARK_SOURCE_FILENAME,
    importBatchId: 'batch-1',
    transactionBooking: {
      id: bookingId,
      workspaceId,
      projectId: 'project-a',
      transactionTypeId: 'type-a',
      categoryId: 'category-a',
      evidenceHash: `booking-evidence-${id}`,
      confirmedAt: new Date('2026-07-02T09:00:00.000Z'),
      project: { workspaceId },
      transactionType: { workspaceId },
      category: { workspaceId },
    },
    reviewDecisions: [decisionRecord(id, bookingId)],
    ...overrides,
  };
};

const buildDb = (transactions = Array.from({ length: FINANCE_BENCHMARK_ROW_COUNT }, (_, index) => transactionRecord(index))) => ({
  workspaceMembership: {
    findFirst: vi.fn(async () => ({ workspaceId })),
    findMany: vi.fn(async () => [{ userId: 'admin-user' }]),
  },
  sourceFile: {
    findFirst: vi.fn(async () => ({ id: 'source-1', workspaceId, filename: FINANCE_BENCHMARK_SOURCE_FILENAME, sha256: FINANCE_BENCHMARK_SOURCE_SHA256 })),
  },
  bankStatement: { findFirst: vi.fn(async () => statement) },
  transaction: { findMany: vi.fn(async () => transactions) },
});

const sourceRow = (transactionId: string, labelStatus: DeterministicBenchmarkSourceRow['labelStatus'] = 'LABELED_CONFIRMED'): DeterministicBenchmarkSourceRow => ({
  workspaceId,
  transactionId,
  importFingerprint: `fingerprint-${transactionId}`,
  date: new Date('2026-01-01T00:00:00.000Z'),
  sourceFile: FINANCE_BENCHMARK_SOURCE_FILENAME,
  labelStatus,
  exclusionReason: labelStatus === 'EXCLUDED_INVALID_LABEL' ? 'MISSING_PROVENANCE' : null,
  expectedProjectId: labelStatus === 'LABELED_CONFIRMED' ? 'project-a' : null,
  expectedTransactionTypeId: labelStatus === 'LABELED_CONFIRMED' ? 'type-a' : null,
  expectedCategoryId: labelStatus === 'LABELED_CONFIRMED' ? 'category-a' : null,
  bookingId: labelStatus === 'LABELED_CONFIRMED' ? `booking-${transactionId}` : null,
  reviewDecisionId: labelStatus === 'LABELED_CONFIRMED' ? `decision-${transactionId}` : null,
  bookingEvidenceHash: labelStatus === 'LABELED_CONFIRMED' ? `booking-evidence-${transactionId}` : null,
  decisionEvidenceHash: labelStatus === 'LABELED_CONFIRMED' ? `decision-evidence-${transactionId}` : null,
});

const benchmarkSource = (rows: DeterministicBenchmarkSourceRow[]): DeterministicBenchmarkSource => ({
  sourceId: FINANCE_BENCHMARK_SOURCE_ID,
  sourceVersion: FINANCE_BENCHMARK_SOURCE_VERSION,
  workspaceId,
  sourceFileId: 'source-1',
  statementId: 'statement-1',
  importBatchId: 'batch-1',
  sourceSha256: FINANCE_BENCHMARK_SOURCE_SHA256,
  sourceFilename: FINANCE_BENCHMARK_SOURCE_FILENAME,
  periodStart: '2026-01-01T00:00:00.000Z',
  periodEnd: '2026-07-01T00:00:00.000Z',
  coverageStatus: 'PARTIAL',
  controls: {
    openingBalanceMinor: '1035086', incomeMinor: '5878408', expenseMinor: '6129769',
    netMinor: '-251361', closingBalanceMinor: '783725', transactionCount: FINANCE_BENCHMARK_ROW_COUNT,
  },
  rows,
  sourceHash: 'source-hash',
  sideEffects: { readOnly: true, writesPerformed: false, opensTransaction: false, invokesExternalModel: false },
});

const pipeline = (transactionId: string, state: 'correct' | 'abstained' | 'conflicted' = 'correct'): BenchmarkPipelineResult => {
  const selected = state === 'correct' ? 'project-a' : null;
  const decisionStatus = state === 'correct' ? 'PROPOSED' : state === 'conflicted' ? 'CONFLICTED' : 'ABSTAINED';
  const dimension = (dimensionName: 'PROJECT' | 'TRANSACTION_TYPE' | 'CATEGORY', selectedId: string | null, allowed: string[]) => ({
    dimension: dimensionName,
    status: selectedId ? 'SELECTED' : 'ABSTAINED',
    selectedCandidateId: selectedId,
    selectedCandidateRank: selectedId ? 1 : null,
    allowedCandidateIds: allowed,
    supportingEvidenceCount: 1,
    conflictingEvidenceCount: 0,
    componentScores: null,
    retrievalHash: 'retrieval-hash',
    evidenceHash: 'evidence-hash',
    candidateHash: selectedId ? `candidate-${selectedId}` : null,
    candidateSetHash: 'candidate-set-hash',
    provenanceHashes: ['provenance-hash'],
    confidence: { calibration: 'UNCALIBRATED', scoreBasisPoints: 5000, label: null },
    reason: selectedId ? null : 'NO_SCORE_ABOVE_THRESHOLD',
    dimensionHash: `dimension-${dimensionName}`,
  });
  const decision = {
    decisionVersion: 'deterministic-decision-v1',
    eligibilityVersion: 'confirmed-history-v1',
    scorerVersion: 'deterministic-history-retrieval-v1',
    evidenceVersion: 'deterministic-retrieval-evidence-v1',
    candidateVersion: 'restricted-retrieval-candidates-v1',
    workspaceId,
    targetTransactionId: transactionId,
    transactionFactHash: 'fact-hash',
    status: decisionStatus,
    abstentionReason: state === 'correct' ? null : 'NO_SCORE_ABOVE_THRESHOLD',
    dimensions: {
      project: dimension('PROJECT', selected, ['project-a', 'project-b']),
      transactionType: dimension('TRANSACTION_TYPE', state === 'correct' ? 'type-a' : null, ['type-a', 'type-b']),
      category: dimension('CATEGORY', state === 'correct' ? 'category-a' : null, ['category-a', 'category-b']),
    },
    replayIdentity: { retrievalHash: 'retrieval-hash', evidenceHash: 'evidence-hash', candidateSetHash: 'candidate-set-hash', weightsHash: 'weights-hash', boundsHash: 'bounds-hash' },
    decisionHash: `decision-hash-${transactionId}-${state}`,
    sideEffects: {
      readOnly: true, previewOnly: true, createsTransactionBooking: false, createsCategorizationSuggestion: false,
      mutatesBankFacts: false, mutatesReviewDecisions: false, mutatesPeriodState: false,
      mutatesLedgerRecords: false, persistsDecision: false, invokesExternalModel: false,
    },
  } as DeterministicDecisionResult;
  const orchestration = {
    orchestrationVersion: 'deterministic-orchestration-v1',
    priorityVersion: 'rule-history-agreement-v1',
    workspaceId,
    targetTransactionId: transactionId,
    transactionFactHash: 'fact-hash',
    status: state === 'correct' ? 'MATCHED' : state === 'conflicted' ? 'CONFLICTED' : 'ABSTAINED',
    reason: state === 'correct' ? 'DECISION_PROPOSED' : state === 'conflicted' ? 'RULE_CONFLICTS_WITH_DECISION' : 'DECISION_ABSTAINED',
    contributors: [
      { contributor: 'RETRIEVAL', version: 'deterministic-history-retrieval-v1', mandatory: true, status: state === 'correct' ? 'MATCHED' : 'ABSTAINED', inputHash: 'input', outputHash: 'output', provenanceHashes: ['p'], reason: state === 'correct' ? 'DECISION_PROPOSED' : 'DECISION_ABSTAINED', affectedFinalDecision: true },
      { contributor: 'RULE', version: 'deterministic-categorization-v1', mandatory: false, status: state === 'conflicted' ? 'CONFLICTED' : 'MATCHED', inputHash: 'input-r', outputHash: 'output-r', provenanceHashes: ['r'], reason: state === 'conflicted' ? 'RULE_CONFLICTS_WITH_DECISION' : 'RULE_AGREES_WITH_DECISION', affectedFinalDecision: true },
    ],
    finalDecision: state === 'correct' ? decision : null,
    finalDecisionHash: state === 'correct' ? decision.decisionHash : null,
    replayIdentity: { contributorIdentityHash: 'contributors', decisionHash: decision.decisionHash, orchestrationHash: `orchestration-${transactionId}-${state}` },
    orchestrationHash: `orchestration-${transactionId}-${state}`,
    sideEffects: {
      readOnly: true, previewOnly: true, createsTransactionBooking: false, createsCategorizationSuggestion: false,
      mutatesBankFacts: false, mutatesReviewDecisions: false, mutatesPeriodState: false,
      mutatesLedgerRecords: false, mutatesMerchantKnowledge: false, persistsDecision: false, invokesExternalModel: false,
    },
  } as DeterministicOrchestrationResult;
  return { decision, orchestration };
};

describe('Program Phase 4.8 deterministic benchmark source loader', () => {
  it('loads exactly 221 ordered rows with confirmed administrator labels and stable source identity', async () => {
    const transactions = Array.from({ length: FINANCE_BENCHMARK_ROW_COUNT }, (_, index) => transactionRecord(FINANCE_BENCHMARK_ROW_COUNT - index - 1));
    const result = await loadDeterministicBenchmarkSource(buildDb(transactions) as any, { userId: 'admin-user' });

    expect(result.sourceId).toBe(FINANCE_BENCHMARK_SOURCE_ID);
    expect(result.sourceVersion).toBe(FINANCE_BENCHMARK_SOURCE_VERSION);
    expect(result.rows).toHaveLength(FINANCE_BENCHMARK_ROW_COUNT);
    expect(result.rows[0]?.transactionId).toBe('transaction-000');
    expect(result.rows.at(-1)?.transactionId).toBe('transaction-220');
    expect(result.rows.every((row) => row.labelStatus === 'LABELED_CONFIRMED')).toBe(true);
    expect(result.sourceHash).toMatch(/^[a-f0-9]{64}$/);
    expect(result.sideEffects).toEqual({ readOnly: true, writesPerformed: false, opensTransaction: false, invokesExternalModel: false });
  });

  it('maps unlabeled, removed, mismatched, incomplete, missing-provenance, and cross-workspace label states', async () => {
    const rows = Array.from({ length: FINANCE_BENCHMARK_ROW_COUNT }, (_, index) => transactionRecord(index));
    rows[0] = transactionRecord(0, { transactionBooking: null, reviewDecisions: [] });
    rows[1] = transactionRecord(1, { reviewDecisions: [decisionRecord('transaction-001', 'booking-transaction-001', { action: 'REMOVE_BOOKING' })] });
    rows[2] = transactionRecord(2, { reviewDecisions: [decisionRecord('transaction-002', 'other-booking')] });
    rows[3] = transactionRecord(3, { transactionBooking: { ...transactionRecord(3).transactionBooking, categoryId: '' } });
    rows[4] = transactionRecord(4, { reviewDecisions: [decisionRecord('transaction-004', 'booking-transaction-004', { evidenceHash: '' })] });
    rows[5] = transactionRecord(5, { transactionBooking: { ...transactionRecord(5).transactionBooking, workspaceId: 'other-workspace' } });
    const result = await loadDeterministicBenchmarkSource(buildDb(rows) as any, { userId: 'admin-user' });

    expect(result.rows.slice(0, 6).map((row) => [row.labelStatus, row.exclusionReason])).toEqual([
      ['UNLABELED_PENDING_CONFIRMATION', null],
      ['EXCLUDED_INVALID_LABEL', 'REMOVE_BOOKING'],
      ['EXCLUDED_INVALID_LABEL', 'CURRENT_BOOKING_MISMATCH'],
      ['EXCLUDED_INVALID_LABEL', 'CURRENT_BOOKING_MISMATCH'],
      ['EXCLUDED_INVALID_LABEL', 'MISSING_PROVENANCE'],
      ['EXCLUDED_INVALID_LABEL', 'CROSS_WORKSPACE'],
    ]);
  });

  it.each([
    ['row count', Array.from({ length: 220 }, (_, index) => transactionRecord(index)), 'row_count_mismatch'],
    ['missing fingerprint', Array.from({ length: 221 }, (_, index) => transactionRecord(index, index === 0 ? { importFingerprint: null } : {})), 'missing_fingerprint'],
    ['duplicate fingerprint', Array.from({ length: 221 }, (_, index) => transactionRecord(index, index === 1 ? { importFingerprint: 'fingerprint-000' } : {})), 'duplicate_fingerprint'],
    ['duplicate transaction', Array.from({ length: 221 }, (_, index) => transactionRecord(index, index === 1 ? { id: 'transaction-000' } : {})), 'duplicate_transaction'],
  ])('rejects invalid %s identity', async (_label, rows, code) => {
    await expect(loadDeterministicBenchmarkSource(buildDb(rows as any[]) as any, { userId: 'admin-user' }))
      .rejects.toMatchObject({ code });
  });

  it('rejects stale source identity and workspace/source mismatches', async () => {
    await expect(loadDeterministicBenchmarkSource(buildDb() as any, { userId: 'admin-user', expectedSourceHash: 'stale' }))
      .rejects.toMatchObject({ code: 'stale_source' });
    const db = buildDb();
    db.sourceFile.findFirst = vi.fn(async () => null as any);
    await expect(loadDeterministicBenchmarkSource(db as any, { userId: 'admin-user' }))
      .rejects.toMatchObject({ code: 'source_not_found' });
  });
});

describe('Program Phase 4.8 deterministic benchmark evaluator', () => {
  it('calculates covered, end-to-end, top-three, abstention, conflict, and contributor metrics', async () => {
    const rows = [
      sourceRow('correct'),
      sourceRow('abstained'),
      sourceRow('conflicted'),
      sourceRow('unlabeled', 'UNLABELED_PENDING_CONFIRMATION'),
      sourceRow('excluded', 'EXCLUDED_INVALID_LABEL'),
    ];
    const report = await evaluateDeterministicBenchmark({
      source: benchmarkSource(rows),
      evaluateRow: async (row) => row.transactionId === 'correct' ? pipeline(row.transactionId, 'correct')
        : row.transactionId === 'abstained' ? pipeline(row.transactionId, 'abstained')
          : pipeline(row.transactionId, 'conflicted'),
    });

    expect(report.evaluatorVersion).toBe(DETERMINISTIC_BENCHMARK_EVALUATOR_VERSION);
    expect(report.metrics).toMatchObject({
      totalSourceRows: 5,
      labeledRows: 3,
      unlabeledPendingConfirmationRows: 1,
      excludedInvalidLabelRows: 1,
      evaluatedLabeledRows: 3,
      coveredLabeledRows: 1,
      coverageLabeledBasisPoints: 3333,
      coverageAllRowsBasisPoints: 2000,
      abstentionCount: 1,
      abstentionRateLabeledBasisPoints: 3333,
      conflictCount: 1,
      conflictRateLabeledBasisPoints: 3333,
      projectAccuracyCoveredBasisPoints: 10000,
      completeTripleAccuracyCoveredBasisPoints: 10000,
      projectAccuracyEndToEndBasisPoints: 3333,
      completeTripleAccuracyEndToEndBasisPoints: 3333,
      projectTopThreeBasisPoints: 10000,
      ruleContributionCount: 2,
      confirmedHistoryContributionCount: 1,
    });
    expect(report.rows.find((row) => row.transactionId === 'correct')).toMatchObject({
      correctness: { project: true, transactionType: true, category: true, completeTriple: true },
      topThree: { project: true, transactionType: true, category: true },
    });
    expect(report.reportHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('is byte-equivalent and order-independent with stable row and report hashes', async () => {
    const leftRows = [sourceRow('b'), sourceRow('a')];
    const rightRows = [...leftRows].reverse();
    const evaluator = async (row: DeterministicBenchmarkSourceRow) => pipeline(row.transactionId, 'correct');
    const left = await evaluateDeterministicBenchmark({ source: benchmarkSource(leftRows), evaluateRow: evaluator });
    const right = await evaluateDeterministicBenchmark({ source: benchmarkSource(rightRows), evaluateRow: evaluator });

    expect(right).toEqual(left);
    expect(left.rows.map((row) => row.transactionId)).toEqual(['a', 'b']);
    expect(left.rows.every((row) => /^[a-f0-9]{64}$/.test(row.rowHash))).toBe(true);
  });

  it('rejects stale source/report and mismatched pipeline identity', async () => {
    const source = benchmarkSource([sourceRow('one')]);
    await expect(evaluateDeterministicBenchmark({ source, evaluateRow: async () => pipeline('one'), expectedSourceHash: 'stale' }))
      .rejects.toMatchObject({ code: 'stale_source' });
    const first = await evaluateDeterministicBenchmark({ source, evaluateRow: async () => pipeline('one') });
    await expect(evaluateDeterministicBenchmark({ source, evaluateRow: async () => pipeline('one'), expectedReportHash: 'stale' }))
      .rejects.toMatchObject({ code: 'stale_report' });
    await expect(evaluateDeterministicBenchmark({ source, evaluateRow: async () => pipeline('other') }))
      .rejects.toMatchObject({ code: 'pipeline_identity_mismatch' });
    expect(first.reportHash).toBeTruthy();
  });

  it('returns privacy-safe output and contains no writes, transactions, persistence, or model calls', async () => {
    const report = await evaluateDeterministicBenchmark({ source: benchmarkSource([sourceRow('private')]), evaluateRow: async () => pipeline('private') });
    const serialized = JSON.stringify(report);
    expect(serialized).not.toMatch(/NL\d{2}|counterparty|description|paymentPurpose|rawRow|stack/i);
    expect(report.sideEffects).toEqual({
      readOnly: true, writesPerformed: false, createsTransactionBooking: false,
      createsCategorizationSuggestion: false, mutatesBankFacts: false,
      mutatesReviewDecisions: false, mutatesPeriodState: false,
      mutatesLedgerRecords: false, mutatesMerchantKnowledge: false,
      persistsDecision: false, invokesExternalModel: false,
    });
    const source = fs.readFileSync(path.join(process.cwd(), 'server/services/deterministicBenchmarkEvaluationService.ts'), 'utf8');
    expect(source).not.toMatch(/\b(?:db|tx|client)\.[A-Za-z0-9_]+\.(?:create|createMany|update|updateMany|delete|deleteMany|upsert)\s*\(/);
    expect(source).not.toMatch(/\b(?:db|tx|client)\.\$transaction\s*\(/);
    expect(source).not.toMatch(/OpenAI|Anthropic|Claude|Bedrock|invokeModel|generateText|chat\.completions/i);
    expect(source).not.toMatch(/Math\.random|Date\.now\(\)/);
  });

  it('uses typed benchmark errors', () => {
    expect(new DeterministicBenchmarkError('stale_report', 'stale')).toMatchObject({
      name: 'DeterministicBenchmarkError', code: 'stale_report', message: 'stale',
    });
  });
});
