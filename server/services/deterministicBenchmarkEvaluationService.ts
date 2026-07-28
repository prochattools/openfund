import type { PrismaClient, ReviewDecisionAction } from '@prisma/client';
import { hashEvidence } from './reviewDecisionService';
import type { DeterministicDecisionResult } from './deterministicDecisionService';
import type { DeterministicOrchestrationResult } from './deterministicDecisionOrchestrationService';

export const FINANCE_BENCHMARK_SOURCE_ID = 'finance-db-open-statement-2026-221';
export const FINANCE_BENCHMARK_SOURCE_VERSION = 'finance-db-benchmark-source-v1';
export const DETERMINISTIC_BENCHMARK_EVALUATOR_VERSION = 'deterministic-benchmark-evaluator-v1';
export const FINANCE_BENCHMARK_SOURCE_SHA256 = '768912927a7bb3b545616631e6d5360479a90b0bc6448faa3f225925636d31d3';
export const FINANCE_BENCHMARK_SOURCE_FILENAME = 'NL89INGB0006369960_2026-01-01_2026-07-01.csv';
export const FINANCE_BENCHMARK_ROW_COUNT = 221;

const PERIOD_START = new Date('2026-01-01T00:00:00.000Z');
const PERIOD_END = new Date('2026-07-01T00:00:00.000Z');
const ELIGIBLE_ACTIONS = new Set<ReviewDecisionAction>([
  'ACCEPT_SUGGESTION',
  'ASSIGN_MANUALLY',
  'CHANGE_BOOKING',
]);

export type BenchmarkLabelStatus =
  | 'LABELED_CONFIRMED'
  | 'UNLABELED_PENDING_CONFIRMATION'
  | 'EXCLUDED_INVALID_LABEL';

export type BenchmarkLabelExclusionReason =
  | 'REMOVE_BOOKING'
  | 'LATEST_DECISION_NOT_ELIGIBLE'
  | 'CURRENT_BOOKING_MISMATCH'
  | 'INCOMPLETE_LABEL'
  | 'MISSING_PROVENANCE'
  | 'CROSS_WORKSPACE';

export type DeterministicBenchmarkSourceRow = {
  workspaceId: string;
  transactionId: string;
  importFingerprint: string;
  date: Date;
  sourceFile: string;
  labelStatus: BenchmarkLabelStatus;
  exclusionReason: BenchmarkLabelExclusionReason | null;
  expectedProjectId: string | null;
  expectedTransactionTypeId: string | null;
  expectedCategoryId: string | null;
  bookingId: string | null;
  reviewDecisionId: string | null;
  bookingEvidenceHash: string | null;
  decisionEvidenceHash: string | null;
};

export type DeterministicBenchmarkSource = {
  sourceId: typeof FINANCE_BENCHMARK_SOURCE_ID;
  sourceVersion: typeof FINANCE_BENCHMARK_SOURCE_VERSION;
  workspaceId: string;
  sourceFileId: string;
  statementId: string;
  importBatchId: string | null;
  sourceSha256: typeof FINANCE_BENCHMARK_SOURCE_SHA256;
  sourceFilename: typeof FINANCE_BENCHMARK_SOURCE_FILENAME;
  periodStart: string;
  periodEnd: string;
  coverageStatus: 'PARTIAL';
  controls: {
    openingBalanceMinor: string;
    incomeMinor: string;
    expenseMinor: string;
    netMinor: string;
    closingBalanceMinor: string;
    transactionCount: typeof FINANCE_BENCHMARK_ROW_COUNT;
  };
  rows: DeterministicBenchmarkSourceRow[];
  sourceHash: string;
  sideEffects: {
    readOnly: true;
    writesPerformed: false;
    opensTransaction: false;
    invokesExternalModel: false;
  };
};

export type BenchmarkPipelineResult = {
  decision: DeterministicDecisionResult;
  orchestration: DeterministicOrchestrationResult;
};

export type DeterministicBenchmarkRowResult = {
  sourceVersion: typeof FINANCE_BENCHMARK_SOURCE_VERSION;
  evaluatorVersion: typeof DETERMINISTIC_BENCHMARK_EVALUATOR_VERSION;
  workspaceId: string;
  transactionId: string;
  importFingerprintHash: string;
  labelStatus: BenchmarkLabelStatus;
  exclusionReason: BenchmarkLabelExclusionReason | null;
  expected: { projectId: string | null; transactionTypeId: string | null; categoryId: string | null };
  decisionStatus: DeterministicDecisionResult['status'] | null;
  orchestrationStatus: DeterministicOrchestrationResult['status'] | null;
  selected: { projectId: string | null; transactionTypeId: string | null; categoryId: string | null };
  allowedCandidateIds: { project: string[]; transactionType: string[]; category: string[] };
  correctness: { project: boolean | null; transactionType: boolean | null; category: boolean | null; completeTriple: boolean | null };
  topThree: { project: boolean | null; transactionType: boolean | null; category: boolean | null };
  abstentionReason: string | null;
  conflictReason: string | null;
  contributorAttribution: string[];
  decisionHash: string | null;
  orchestrationHash: string | null;
  rowHash: string;
};

export type DeterministicBenchmarkMetrics = {
  totalSourceRows: number;
  labeledRows: number;
  unlabeledPendingConfirmationRows: number;
  excludedInvalidLabelRows: number;
  evaluatedLabeledRows: number;
  coveredLabeledRows: number;
  coverageLabeledBasisPoints: number;
  coverageAllRowsBasisPoints: number;
  abstentionCount: number;
  abstentionRateLabeledBasisPoints: number;
  conflictCount: number;
  conflictRateLabeledBasisPoints: number;
  projectAccuracyCoveredBasisPoints: number;
  transactionTypeAccuracyCoveredBasisPoints: number;
  categoryAccuracyCoveredBasisPoints: number;
  completeTripleAccuracyCoveredBasisPoints: number;
  projectAccuracyEndToEndBasisPoints: number;
  transactionTypeAccuracyEndToEndBasisPoints: number;
  categoryAccuracyEndToEndBasisPoints: number;
  completeTripleAccuracyEndToEndBasisPoints: number;
  projectTopThreeBasisPoints: number;
  transactionTypeTopThreeBasisPoints: number;
  categoryTopThreeBasisPoints: number;
  incompleteDecisionCount: number;
  ruleContributionCount: number;
  merchantKnowledgeContributionCount: number;
  confirmedHistoryContributionCount: number;
  exclusionsByReason: Record<string, number>;
};

export type DeterministicBenchmarkReport = {
  sourceId: typeof FINANCE_BENCHMARK_SOURCE_ID;
  sourceVersion: typeof FINANCE_BENCHMARK_SOURCE_VERSION;
  evaluatorVersion: typeof DETERMINISTIC_BENCHMARK_EVALUATOR_VERSION;
  sourceHash: string;
  workspaceId: string;
  rows: DeterministicBenchmarkRowResult[];
  metrics: DeterministicBenchmarkMetrics;
  reportHash: string;
  sideEffects: {
    readOnly: true;
    writesPerformed: false;
    createsTransactionBooking: false;
    createsCategorizationSuggestion: false;
    mutatesBankFacts: false;
    mutatesReviewDecisions: false;
    mutatesPeriodState: false;
    mutatesLedgerRecords: false;
    mutatesMerchantKnowledge: false;
    persistsDecision: false;
    invokesExternalModel: false;
  };
};

export class DeterministicBenchmarkError extends Error {
  constructor(
    public readonly code:
      | 'workspace_not_found'
      | 'source_not_found'
      | 'statement_not_found'
      | 'source_identity_mismatch'
      | 'row_count_mismatch'
      | 'duplicate_transaction'
      | 'duplicate_fingerprint'
      | 'missing_fingerprint'
      | 'stale_source'
      | 'stale_report'
      | 'pipeline_identity_mismatch',
    message: string,
  ) {
    super(message);
    this.name = 'DeterministicBenchmarkError';
  }
}

type BenchmarkDb = Pick<PrismaClient, 'workspaceMembership' | 'sourceFile' | 'bankStatement' | 'transaction'>;

type LoadedTransaction = Awaited<ReturnType<BenchmarkDb['transaction']['findMany']>>[number] & {
  transactionBooking?: any;
  reviewDecisions?: any[];
};

const bp = (numerator: number, denominator: number): number => denominator === 0 ? 0 : Math.round((numerator * 10000) / denominator);
const sameDate = (left: Date, right: Date): boolean => left.toISOString() === right.toISOString();
const nonEmpty = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;

const latestDecision = (decisions: any[]): any | null => [...decisions].sort((left, right) => {
  const timeDifference = new Date(right.decidedAt).getTime() - new Date(left.decidedAt).getTime();
  return timeDifference || String(right.id).localeCompare(String(left.id));
})[0] ?? null;

const labelFor = (workspaceId: string, transaction: LoadedTransaction): Omit<DeterministicBenchmarkSourceRow, 'workspaceId' | 'transactionId' | 'importFingerprint' | 'date' | 'sourceFile'> => {
  const booking = transaction.transactionBooking ?? null;
  const decision = latestDecision(transaction.reviewDecisions ?? []);
  if (!booking || !decision) {
    return {
      labelStatus: 'UNLABELED_PENDING_CONFIRMATION', exclusionReason: null,
      expectedProjectId: null, expectedTransactionTypeId: null, expectedCategoryId: null,
      bookingId: booking?.id ?? null, reviewDecisionId: decision?.id ?? null,
      bookingEvidenceHash: booking?.evidenceHash ?? null, decisionEvidenceHash: decision?.evidenceHash ?? null,
    };
  }
  const invalid = (
    reason: BenchmarkLabelExclusionReason,
  ): Omit<
    DeterministicBenchmarkSourceRow,
    'workspaceId' | 'transactionId' | 'importFingerprint' | 'date' | 'sourceFile'
  > => ({
    labelStatus: 'EXCLUDED_INVALID_LABEL', exclusionReason: reason,
    expectedProjectId: null, expectedTransactionTypeId: null, expectedCategoryId: null,
    bookingId: booking.id, reviewDecisionId: decision.id,
    bookingEvidenceHash: booking.evidenceHash ?? null, decisionEvidenceHash: decision.evidenceHash ?? null,
  });
  if (decision.action === 'REMOVE_BOOKING') return invalid('REMOVE_BOOKING');
  if (!ELIGIBLE_ACTIONS.has(decision.action)) return invalid('LATEST_DECISION_NOT_ELIGIBLE');
  if (booking.workspaceId !== workspaceId || decision.workspaceId !== workspaceId
    || booking.project?.workspaceId !== workspaceId || booking.transactionType?.workspaceId !== workspaceId
    || booking.category?.workspaceId !== workspaceId) return invalid('CROSS_WORKSPACE');
  if (decision.afterBookingId !== booking.id
    || decision.afterProjectId !== booking.projectId
    || decision.afterTypeId !== booking.transactionTypeId
    || decision.afterCategoryId !== booking.categoryId) return invalid('CURRENT_BOOKING_MISMATCH');
  if (!nonEmpty(booking.projectId) || !nonEmpty(booking.transactionTypeId) || !nonEmpty(booking.categoryId)) return invalid('INCOMPLETE_LABEL');
  if (!nonEmpty(booking.evidenceHash) || !nonEmpty(decision.evidenceHash) || !nonEmpty(decision.actorId)
    || !decision.decidedAt || !booking.confirmedAt) return invalid('MISSING_PROVENANCE');
  return {
    labelStatus: 'LABELED_CONFIRMED', exclusionReason: null,
    expectedProjectId: booking.projectId, expectedTransactionTypeId: booking.transactionTypeId,
    expectedCategoryId: booking.categoryId, bookingId: booking.id, reviewDecisionId: decision.id,
    bookingEvidenceHash: booking.evidenceHash, decisionEvidenceHash: decision.evidenceHash,
  };
};

export const loadDeterministicBenchmarkSource = async (
  db: BenchmarkDb,
  input: { userId: string; expectedSourceHash?: string },
): Promise<DeterministicBenchmarkSource> => {
  const membership = await db.workspaceMembership.findFirst({
    where: { userId: input.userId, isActive: true, workspace: { isActive: true } },
    select: { workspaceId: true },
  });
  if (!membership) throw new DeterministicBenchmarkError('workspace_not_found', 'An active workspace membership is required.');
  const sourceFile = await db.sourceFile.findFirst({
    where: { workspaceId: membership.workspaceId, sha256: FINANCE_BENCHMARK_SOURCE_SHA256 },
    select: { id: true, workspaceId: true, filename: true, sha256: true },
  });
  if (!sourceFile) throw new DeterministicBenchmarkError('source_not_found', 'The frozen benchmark source file was not found.');
  const statement = await db.bankStatement.findFirst({
    where: { workspaceId: membership.workspaceId, sourceFileId: sourceFile.id },
  });
  if (!statement) throw new DeterministicBenchmarkError('statement_not_found', 'The frozen benchmark statement was not found.');
  if (sourceFile.filename !== FINANCE_BENCHMARK_SOURCE_FILENAME || sourceFile.sha256 !== FINANCE_BENCHMARK_SOURCE_SHA256
    || statement.coverageStatus !== 'PARTIAL' || statement.transactionCount !== FINANCE_BENCHMARK_ROW_COUNT
    || !sameDate(statement.periodStart, PERIOD_START) || !sameDate(statement.periodEnd, PERIOD_END)
    || statement.openingBalanceMinor !== 1035086n || statement.incomeMinor !== 5878408n
    || statement.expenseMinor !== 6129769n || statement.netMinor !== -251361n
    || statement.closingBalanceMinor !== 783725n) {
    throw new DeterministicBenchmarkError('source_identity_mismatch', 'The frozen benchmark source identity does not match.');
  }
  const memberships = await db.workspaceMembership.findMany({
    where: { workspaceId: membership.workspaceId, isActive: true }, select: { userId: true },
  });
  const transactions = await db.transaction.findMany({
    where: {
      userId: { in: memberships.map((item) => item.userId) },
      sourceFile: FINANCE_BENCHMARK_SOURCE_FILENAME,
      ...(statement.importBatchId ? { importBatchId: statement.importBatchId } : {}),
    },
    include: {
      transactionBooking: { include: { project: { select: { workspaceId: true } }, transactionType: { select: { workspaceId: true } }, category: { select: { workspaceId: true } } } },
      reviewDecisions: { include: { suggestion: { select: { workspaceId: true, status: true } } }, orderBy: [{ decidedAt: 'desc' }, { id: 'desc' }] },
    },
    orderBy: [{ date: 'asc' }, { id: 'asc' }],
  }) as LoadedTransaction[];
  if (transactions.length !== FINANCE_BENCHMARK_ROW_COUNT) throw new DeterministicBenchmarkError('row_count_mismatch', `Expected ${FINANCE_BENCHMARK_ROW_COUNT} benchmark rows.`);
  const ids = new Set<string>();
  const fingerprints = new Set<string>();
  const orderedTransactions = [...transactions].sort((left, right) =>
    left.date.getTime() - right.date.getTime() || left.id.localeCompare(right.id),
  );
  const rows = orderedTransactions.map((transaction) => {
    if (ids.has(transaction.id)) throw new DeterministicBenchmarkError('duplicate_transaction', 'Duplicate benchmark transaction ID.');
    ids.add(transaction.id);
    if (!nonEmpty(transaction.importFingerprint)) throw new DeterministicBenchmarkError('missing_fingerprint', 'Every benchmark row requires an import fingerprint.');
    if (fingerprints.has(transaction.importFingerprint)) throw new DeterministicBenchmarkError('duplicate_fingerprint', 'Duplicate benchmark import fingerprint.');
    fingerprints.add(transaction.importFingerprint);
    return {
      workspaceId: membership.workspaceId,
      transactionId: transaction.id,
      importFingerprint: transaction.importFingerprint,
      date: transaction.date,
      sourceFile: transaction.sourceFile ?? '',
      ...labelFor(membership.workspaceId, transaction),
    };
  });
  const controls = {
    openingBalanceMinor: statement.openingBalanceMinor.toString(), incomeMinor: statement.incomeMinor.toString(),
    expenseMinor: statement.expenseMinor.toString(), netMinor: statement.netMinor.toString(),
    closingBalanceMinor: statement.closingBalanceMinor.toString(), transactionCount: FINANCE_BENCHMARK_ROW_COUNT as typeof FINANCE_BENCHMARK_ROW_COUNT,
  };
  const sourceHash = hashEvidence({
    sourceVersion: FINANCE_BENCHMARK_SOURCE_VERSION, workspaceId: membership.workspaceId,
    sourceSha256: FINANCE_BENCHMARK_SOURCE_SHA256, sourceFileId: sourceFile.id, statementId: statement.id,
    importBatchId: statement.importBatchId, periodStart: PERIOD_START, periodEnd: PERIOD_END,
    coverageStatus: 'PARTIAL', controls,
    rows: rows.map((row) => ({
      transactionId: row.transactionId, importFingerprint: row.importFingerprint,
      bookingId: row.bookingId, reviewDecisionId: row.reviewDecisionId,
      expectedProjectId: row.expectedProjectId, expectedTransactionTypeId: row.expectedTransactionTypeId,
      expectedCategoryId: row.expectedCategoryId, bookingEvidenceHash: row.bookingEvidenceHash,
      decisionEvidenceHash: row.decisionEvidenceHash, labelStatus: row.labelStatus,
      exclusionReason: row.exclusionReason,
    })),
  });
  if (input.expectedSourceHash && input.expectedSourceHash !== sourceHash) throw new DeterministicBenchmarkError('stale_source', 'The benchmark source identity is stale.');
  return {
    sourceId: FINANCE_BENCHMARK_SOURCE_ID, sourceVersion: FINANCE_BENCHMARK_SOURCE_VERSION,
    workspaceId: membership.workspaceId, sourceFileId: sourceFile.id, statementId: statement.id,
    importBatchId: statement.importBatchId, sourceSha256: FINANCE_BENCHMARK_SOURCE_SHA256,
    sourceFilename: FINANCE_BENCHMARK_SOURCE_FILENAME, periodStart: PERIOD_START.toISOString(), periodEnd: PERIOD_END.toISOString(),
    coverageStatus: 'PARTIAL', controls, rows, sourceHash,
    sideEffects: { readOnly: true, writesPerformed: false, opensTransaction: false, invokesExternalModel: false },
  };
};

const topThree = (expected: string | null, allowed: string[]): boolean | null => expected ? allowed.slice(0, 3).includes(expected) : null;
const exact = (expected: string | null, selected: string | null): boolean | null => expected ? expected === selected : null;

export const evaluateDeterministicBenchmark = async (input: {
  source: DeterministicBenchmarkSource;
  evaluateRow: (row: DeterministicBenchmarkSourceRow) => Promise<BenchmarkPipelineResult | null>;
  expectedSourceHash?: string;
  expectedReportHash?: string;
}): Promise<DeterministicBenchmarkReport> => {
  if (input.expectedSourceHash && input.expectedSourceHash !== input.source.sourceHash) throw new DeterministicBenchmarkError('stale_source', 'The benchmark source identity is stale.');
  const rows: DeterministicBenchmarkRowResult[] = [];
  for (const sourceRow of [...input.source.rows].sort((left, right) => left.date.getTime() - right.date.getTime() || left.transactionId.localeCompare(right.transactionId))) {
    const pipeline = sourceRow.labelStatus === 'LABELED_CONFIRMED' ? await input.evaluateRow(sourceRow) : null;
    if (pipeline && (pipeline.decision.workspaceId !== input.source.workspaceId || pipeline.decision.targetTransactionId !== sourceRow.transactionId
      || pipeline.orchestration.workspaceId !== input.source.workspaceId || pipeline.orchestration.targetTransactionId !== sourceRow.transactionId)) {
      throw new DeterministicBenchmarkError('pipeline_identity_mismatch', 'Pipeline output does not match the benchmark row.');
    }
    const decision = pipeline?.decision ?? null;
    const orchestration = pipeline?.orchestration ?? null;
    const selected = {
      projectId: decision?.dimensions.project.selectedCandidateId ?? null,
      transactionTypeId: decision?.dimensions.transactionType.selectedCandidateId ?? null,
      categoryId: decision?.dimensions.category.selectedCandidateId ?? null,
    };
    const allowedCandidateIds = {
      project: decision?.dimensions.project.allowedCandidateIds ?? [],
      transactionType: decision?.dimensions.transactionType.allowedCandidateIds ?? [],
      category: decision?.dimensions.category.allowedCandidateIds ?? [],
    };
    const correctness = {
      project: exact(sourceRow.expectedProjectId, selected.projectId),
      transactionType: exact(sourceRow.expectedTransactionTypeId, selected.transactionTypeId),
      category: exact(sourceRow.expectedCategoryId, selected.categoryId),
      completeTriple: sourceRow.labelStatus === 'LABELED_CONFIRMED'
        ? selected.projectId === sourceRow.expectedProjectId && selected.transactionTypeId === sourceRow.expectedTransactionTypeId && selected.categoryId === sourceRow.expectedCategoryId
        : null,
    };
    const contributorAttribution = orchestration?.contributors.filter((item) => item.status === 'MATCHED').map((item) => item.contributor).sort() ?? [];
    const base: Omit<DeterministicBenchmarkRowResult, 'rowHash'> = {
      sourceVersion: FINANCE_BENCHMARK_SOURCE_VERSION, evaluatorVersion: DETERMINISTIC_BENCHMARK_EVALUATOR_VERSION,
      workspaceId: input.source.workspaceId, transactionId: sourceRow.transactionId,
      importFingerprintHash: hashEvidence(sourceRow.importFingerprint), labelStatus: sourceRow.labelStatus,
      exclusionReason: sourceRow.exclusionReason,
      expected: { projectId: sourceRow.expectedProjectId, transactionTypeId: sourceRow.expectedTransactionTypeId, categoryId: sourceRow.expectedCategoryId },
      decisionStatus: decision?.status ?? null, orchestrationStatus: orchestration?.status ?? null,
      selected, allowedCandidateIds, correctness,
      topThree: {
        project: topThree(sourceRow.expectedProjectId, allowedCandidateIds.project),
        transactionType: topThree(sourceRow.expectedTransactionTypeId, allowedCandidateIds.transactionType),
        category: topThree(sourceRow.expectedCategoryId, allowedCandidateIds.category),
      },
      abstentionReason: decision?.status === 'ABSTAINED' || decision?.status === 'INCOMPLETE' ? decision.abstentionReason : null,
      conflictReason: orchestration?.status === 'CONFLICTED' ? orchestration.reason : null,
      contributorAttribution, decisionHash: decision?.decisionHash ?? null, orchestrationHash: orchestration?.orchestrationHash ?? null,
    };
    rows.push({ ...base, rowHash: hashEvidence(base) });
  }
  const labeled = rows.filter((row) => row.labelStatus === 'LABELED_CONFIRMED');
  const covered = labeled.filter((row) => row.orchestrationStatus === 'MATCHED' && row.decisionStatus === 'PROPOSED');
  const countTrue = (selector: (row: DeterministicBenchmarkRowResult) => boolean | null, source = covered) => source.filter((row) => selector(row) === true).length;
  const exclusionsByReason: Record<string, number> = {};
  rows.filter((row) => row.exclusionReason).forEach((row) => { exclusionsByReason[row.exclusionReason!] = (exclusionsByReason[row.exclusionReason!] ?? 0) + 1; });
  const metrics: DeterministicBenchmarkMetrics = {
    totalSourceRows: rows.length, labeledRows: labeled.length,
    unlabeledPendingConfirmationRows: rows.filter((row) => row.labelStatus === 'UNLABELED_PENDING_CONFIRMATION').length,
    excludedInvalidLabelRows: rows.filter((row) => row.labelStatus === 'EXCLUDED_INVALID_LABEL').length,
    evaluatedLabeledRows: labeled.length, coveredLabeledRows: covered.length,
    coverageLabeledBasisPoints: bp(covered.length, labeled.length), coverageAllRowsBasisPoints: bp(covered.length, rows.length),
    abstentionCount: labeled.filter((row) => row.decisionStatus === 'ABSTAINED' || row.decisionStatus === 'INCOMPLETE').length,
    abstentionRateLabeledBasisPoints: bp(labeled.filter((row) => row.decisionStatus === 'ABSTAINED' || row.decisionStatus === 'INCOMPLETE').length, labeled.length),
    conflictCount: labeled.filter((row) => row.orchestrationStatus === 'CONFLICTED').length,
    conflictRateLabeledBasisPoints: bp(labeled.filter((row) => row.orchestrationStatus === 'CONFLICTED').length, labeled.length),
    projectAccuracyCoveredBasisPoints: bp(countTrue((row) => row.correctness.project), covered.length),
    transactionTypeAccuracyCoveredBasisPoints: bp(countTrue((row) => row.correctness.transactionType), covered.length),
    categoryAccuracyCoveredBasisPoints: bp(countTrue((row) => row.correctness.category), covered.length),
    completeTripleAccuracyCoveredBasisPoints: bp(countTrue((row) => row.correctness.completeTriple), covered.length),
    projectAccuracyEndToEndBasisPoints: bp(countTrue((row) => row.correctness.project, labeled), labeled.length),
    transactionTypeAccuracyEndToEndBasisPoints: bp(countTrue((row) => row.correctness.transactionType, labeled), labeled.length),
    categoryAccuracyEndToEndBasisPoints: bp(countTrue((row) => row.correctness.category, labeled), labeled.length),
    completeTripleAccuracyEndToEndBasisPoints: bp(countTrue((row) => row.correctness.completeTriple, labeled), labeled.length),
    projectTopThreeBasisPoints: bp(countTrue((row) => row.topThree.project, labeled), labeled.length),
    transactionTypeTopThreeBasisPoints: bp(countTrue((row) => row.topThree.transactionType, labeled), labeled.length),
    categoryTopThreeBasisPoints: bp(countTrue((row) => row.topThree.category, labeled), labeled.length),
    incompleteDecisionCount: labeled.filter((row) => row.decisionStatus === 'INCOMPLETE').length,
    ruleContributionCount: rows.filter((row) => row.contributorAttribution.includes('RULE')).length,
    merchantKnowledgeContributionCount: rows.filter((row) => row.contributorAttribution.includes('MERCHANT')).length,
    confirmedHistoryContributionCount: rows.filter((row) => row.contributorAttribution.includes('RETRIEVAL')).length,
    exclusionsByReason,
  };
  const reportBase = {
    sourceId: FINANCE_BENCHMARK_SOURCE_ID, sourceVersion: FINANCE_BENCHMARK_SOURCE_VERSION,
    evaluatorVersion: DETERMINISTIC_BENCHMARK_EVALUATOR_VERSION, sourceHash: input.source.sourceHash,
    workspaceId: input.source.workspaceId, rowHashes: rows.map((row) => row.rowHash), metrics,
  };
  const reportHash = hashEvidence(reportBase);
  if (input.expectedReportHash && input.expectedReportHash !== reportHash) throw new DeterministicBenchmarkError('stale_report', 'The benchmark report identity is stale.');
  return {
    sourceId: FINANCE_BENCHMARK_SOURCE_ID, sourceVersion: FINANCE_BENCHMARK_SOURCE_VERSION,
    evaluatorVersion: DETERMINISTIC_BENCHMARK_EVALUATOR_VERSION, sourceHash: input.source.sourceHash,
    workspaceId: input.source.workspaceId, rows, metrics, reportHash,
    sideEffects: {
      readOnly: true, writesPerformed: false, createsTransactionBooking: false,
      createsCategorizationSuggestion: false, mutatesBankFacts: false, mutatesReviewDecisions: false,
      mutatesPeriodState: false, mutatesLedgerRecords: false, mutatesMerchantKnowledge: false,
      persistsDecision: false, invokesExternalModel: false,
    },
  };
};
