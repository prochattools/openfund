import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import {
  CONFIRMED_HISTORY_ELIGIBILITY_VERSION,
  evaluateConfirmedHistoryEligibility,
  type ConfirmedHistoryCandidate,
} from '../../server/services/confirmedHistoryEligibilityService';
import {
  DETERMINISTIC_HISTORY_RETRIEVAL_VERSION,
  retrieveDeterministicConfirmedHistory,
} from '../../server/services/deterministicHistoryRetrievalService';
import {
  DETERMINISTIC_RETRIEVAL_EVIDENCE_VERSION,
  buildDeterministicRetrievalEvidence,
} from '../../server/services/deterministicRetrievalEvidenceService';
import {
  RESTRICTED_RETRIEVAL_CANDIDATE_VERSION,
  buildRestrictedRetrievalCandidates,
} from '../../server/services/restrictedRetrievalCandidateService';
import {
  DETERMINISTIC_DECISION_VERSION,
  buildDeterministicDecision,
} from '../../server/services/deterministicDecisionService';
import {
  DETERMINISTIC_ORCHESTRATION_VERSION,
  orchestrateDeterministicDecision,
} from '../../server/services/deterministicDecisionOrchestrationService';
import { backfillHistorySuggestions } from '../../server/services/suggestionBackfillService';
import type { HistorySuggestionFacts } from '../../server/services/historySuggestionService';

const workspaceId = 'workspace-1';
const otherWorkspaceId = 'workspace-2';
const targetTransactionId = 'target-1';

const target = (): HistorySuggestionFacts => ({
  transactionId: targetTransactionId,
  date: new Date('2026-07-01T00:00:00.000Z'),
  accountId: 'account-1',
  direction: 'credit',
  amountMinor: 5000n,
  counterparty: 'Stichting Alpha',
  counterpartyIban: 'NL11BANK0123456789',
  description: 'Maandelijkse gift juli',
  paymentPurpose: 'Gift project YA',
});

const confirmedCandidate = (id: string, overrides: Partial<ConfirmedHistoryCandidate> = {}): ConfirmedHistoryCandidate => ({
  id,
  userId: 'admin-user',
  date: new Date('2025-07-01T00:00:00.000Z'),
  accountId: 'account-1',
  direction: 'credit',
  amountMinor: 5000n,
  counterparty: 'Stichting Alpha',
  reference: 'Gift project YA',
  description: 'Maandelijkse gift juli',
  rawRow: {
    'Counterparty IBAN': 'NL11BANK0123456789',
    Notifications: 'Gift project YA',
  },
  ledger: { lockedAt: new Date('2025-08-01T00:00:00.000Z') },
  transactionBooking: {
    id: `booking-${id}`,
    workspaceId,
    projectId: 'project-a',
    transactionTypeId: 'type-a',
    categoryId: 'category-a',
    source: 'MANUAL',
    evidenceHash: `booking-evidence-${id}`,
    confirmedBy: 'admin-user',
    confirmedAt: new Date('2025-07-02T10:00:00.000Z'),
    project: { workspaceId },
    transactionType: { workspaceId },
    category: { workspaceId },
  },
  reviewDecisions: [{
    id: `decision-${id}`,
    workspaceId,
    transactionId: id,
    suggestionId: null,
    action: 'ASSIGN_MANUALLY',
    afterBookingId: `booking-${id}`,
    afterProjectId: 'project-a',
    afterTypeId: 'type-a',
    afterCategoryId: 'category-a',
    actorId: 'admin-user',
    evidenceHash: `decision-evidence-${id}`,
    decidedAt: new Date('2025-07-02T10:00:01.000Z'),
    suggestion: null,
  }],
  ...overrides,
});

const buildPipeline = (candidates: ConfirmedHistoryCandidate[]) => {
  const eligibility = evaluateConfirmedHistoryEligibility({ workspaceId, candidates });
  const retrieval = retrieveDeterministicConfirmedHistory({
    workspaceId,
    target: target(),
    eligibleHistory: eligibility.eligibleHistory,
    minimumScoreBasisPoints: 0,
  });
  const evidence = buildDeterministicRetrievalEvidence({
    workspaceId,
    target: target(),
    eligibleHistory: eligibility.eligibleHistory,
    retrieval,
  });
  const restricted = buildRestrictedRetrievalCandidates({
    workspaceId,
    evidence,
    projectRecords: [{ id: 'project-a', workspaceId, isActive: true }],
    transactionTypeRecords: [{ id: 'type-a', workspaceId, isActive: true }],
    categoryRecords: [{ id: 'category-a', workspaceId, isActive: true }],
  });
  const decision = buildDeterministicDecision({
    workspaceId,
    transactionFactHash: 'transaction-fact-hash',
    retrieval,
    evidence,
    candidates: restricted,
  });
  const orchestration = orchestrateDeterministicDecision({
    workspaceId,
    targetTransactionId,
    decision,
  });
  return { eligibility, retrieval, evidence, restricted, decision, orchestration };
};

const privacyProbe = (value: unknown) => JSON.stringify(
  value,
  (_key, entry) => typeof entry === 'bigint' ? entry.toString() : entry,
);

const phase4ServicePaths = [
  'server/services/confirmedHistoryEligibilityService.ts',
  'server/services/historySuggestionService.ts',
  'server/services/deterministicHistoryRetrievalService.ts',
  'server/services/deterministicRetrievalEvidenceService.ts',
  'server/services/restrictedRetrievalCandidateService.ts',
  'server/services/deterministicDecisionService.ts',
  'server/services/deterministicDecisionOrchestrationService.ts',
];

describe('Program Phase 4.7 deterministic isolation and integrity', () => {
  it('produces a complete same-workspace result with all Phase 4 versions and no booking truth', () => {
    const result = buildPipeline([confirmedCandidate('history-1')]);

    expect(result.eligibility.eligibilityVersion).toBe(CONFIRMED_HISTORY_ELIGIBILITY_VERSION);
    expect(result.retrieval.scorerVersion).toBe(DETERMINISTIC_HISTORY_RETRIEVAL_VERSION);
    expect(result.evidence.evidenceVersion).toBe(DETERMINISTIC_RETRIEVAL_EVIDENCE_VERSION);
    expect(result.restricted.candidateVersion).toBe(RESTRICTED_RETRIEVAL_CANDIDATE_VERSION);
    expect(result.decision.decisionVersion).toBe(DETERMINISTIC_DECISION_VERSION);
    expect(result.orchestration.orchestrationVersion).toBe(DETERMINISTIC_ORCHESTRATION_VERSION);
    expect(result.orchestration.status).toBe('MATCHED');
    expect(result.orchestration.finalDecision?.status).toBe('PROPOSED');
    expect(result.decision.sideEffects).toMatchObject({
      readOnly: true,
      previewOnly: true,
      createsTransactionBooking: false,
      createsCategorizationSuggestion: false,
      persistsDecision: false,
      invokesExternalModel: false,
    });
    expect(result.orchestration.sideEffects).toMatchObject({
      createsTransactionBooking: false,
      createsCategorizationSuggestion: false,
      mutatesBankFacts: false,
      mutatesReviewDecisions: false,
      mutatesPeriodState: false,
      mutatesLedgerRecords: false,
      mutatesMerchantKnowledge: false,
      persistsDecision: false,
      invokesExternalModel: false,
    });
  });

  it('rejects or excludes cross-workspace state at every Phase 4 boundary', () => {
    const crossBooking = confirmedCandidate('cross-booking');
    crossBooking.transactionBooking!.workspaceId = otherWorkspaceId;
    expect(evaluateConfirmedHistoryEligibility({ workspaceId, candidates: [crossBooking] }).eligibleHistory).toEqual([]);

    const crossDecision = confirmedCandidate('cross-decision');
    crossDecision.reviewDecisions[0]!.workspaceId = otherWorkspaceId;
    expect(evaluateConfirmedHistoryEligibility({ workspaceId, candidates: [crossDecision] }).eligibleHistory).toEqual([]);

    const valid = buildPipeline([confirmedCandidate('valid')]);
    const crossHistory = structuredClone(valid.eligibility.eligibleHistory[0]!);
    crossHistory.confirmedHistory.workspaceId = otherWorkspaceId;
    expect(() => retrieveDeterministicConfirmedHistory({
      workspaceId,
      target: target(),
      eligibleHistory: [crossHistory],
      minimumScoreBasisPoints: 0,
    })).toThrow();

    expect(() => buildDeterministicRetrievalEvidence({
      workspaceId: otherWorkspaceId,
      target: target(),
      eligibleHistory: valid.eligibility.eligibleHistory,
      retrieval: valid.retrieval,
    })).toThrow();

    const crossCandidates = buildRestrictedRetrievalCandidates({
      workspaceId,
      evidence: valid.evidence,
      projectRecords: [{ id: 'project-a', workspaceId: otherWorkspaceId, isActive: true }],
      transactionTypeRecords: [{ id: 'type-a', workspaceId, isActive: true }],
      categoryRecords: [{ id: 'category-a', workspaceId, isActive: true }],
    });
    expect(crossCandidates.projectCandidates).toEqual([]);
    expect(crossCandidates.status).toBe('ABSTAINED');

    expect(() => buildDeterministicDecision({
      workspaceId: otherWorkspaceId,
      retrieval: valid.retrieval,
      evidence: valid.evidence,
      candidates: valid.restricted,
    })).toThrow();

    expect(() => orchestrateDeterministicDecision({
      workspaceId: otherWorkspaceId,
      targetTransactionId,
      decision: valid.decision,
    })).toThrow();
  });

  it('preserves locked-period provenance without mutating period, booking, ledger, or review state', () => {
    const result = buildPipeline([confirmedCandidate('locked')]);
    expect(result.eligibility.eligibleHistory[0]?.confirmedHistory.ledgerLockedAt).toBe('2025-08-01T00:00:00.000Z');
    expect(result.retrieval.sideEffects).toMatchObject({ writesPerformed: false });
    expect(result.evidence.sideEffects).toMatchObject({ writesPerformed: false });
    expect(result.restricted.sideEffects).toMatchObject({ writesPerformed: false });
    expect(result.decision.sideEffects.mutatesPeriodState).toBe(false);
    expect(result.decision.sideEffects.mutatesLedgerRecords).toBe(false);
    expect(result.orchestration.sideEffects.mutatesReviewDecisions).toBe(false);
  });

  it('is byte-equivalent under confirmed-history input reordering', () => {
    const left = buildPipeline([confirmedCandidate('history-a'), confirmedCandidate('history-b')]);
    const right = buildPipeline([confirmedCandidate('history-b'), confirmedCandidate('history-a')]);

    expect(privacyProbe(right.eligibility)).toBe(privacyProbe(left.eligibility));
    expect(privacyProbe(right.retrieval)).toBe(privacyProbe(left.retrieval));
    expect(privacyProbe(right.evidence)).toBe(privacyProbe(left.evidence));
    expect(privacyProbe(right.restricted)).toBe(privacyProbe(left.restricted));
    expect(privacyProbe(right.decision)).toBe(privacyProbe(left.decision));
    expect(privacyProbe(right.orchestration)).toBe(privacyProbe(left.orchestration));
  });

  it('rejects stale identities deterministically at retrieval, evidence, candidate, Decision, and orchestration boundaries', () => {
    const result = buildPipeline([confirmedCandidate('history-1')]);
    const invalidVersion = structuredClone(result.eligibility.eligibleHistory[0]!);
    invalidVersion.confirmedHistory.eligibilityVersion = 'confirmed-history-v0';
    expect(() => retrieveDeterministicConfirmedHistory({
      workspaceId,
      target: target(),
      eligibleHistory: [invalidVersion],
    })).toThrow();

    expect(() => buildDeterministicDecision({
      workspaceId,
      retrieval: result.retrieval,
      evidence: result.evidence,
      candidates: result.restricted,
      expectedIdentity: { retrievalHash: 'stale' },
    })).toThrow();
    expect(() => buildDeterministicDecision({
      workspaceId,
      retrieval: result.retrieval,
      evidence: result.evidence,
      candidates: result.restricted,
      expectedIdentity: { evidenceHash: 'stale' },
    })).toThrow();
    expect(() => buildDeterministicDecision({
      workspaceId,
      retrieval: result.retrieval,
      evidence: result.evidence,
      candidates: result.restricted,
      expectedIdentity: { candidateSetHash: 'stale' },
    })).toThrow();
    expect(() => orchestrateDeterministicDecision({
      workspaceId,
      targetTransactionId,
      decision: result.decision,
      expectedOrchestrationHash: 'stale',
    })).toThrow();
  });

  it('keeps externally consumable Phase 4 contracts privacy-safe while eligible history remains internal', () => {
    const result = buildPipeline([confirmedCandidate('private')]);
    const serialized = privacyProbe({
      retrieval: result.retrieval,
      evidence: result.evidence,
      restricted: result.restricted,
      decision: result.decision,
      orchestration: result.orchestration,
    });
    expect(serialized).not.toContain('NL11BANK0123456789');
    expect(serialized).not.toContain('Stichting Alpha');
    expect(serialized).not.toContain('Maandelijkse gift juli');
    expect(serialized).not.toContain('Gift project YA');
    expect(serialized).not.toContain('Counterparty IBAN');
    expect(serialized).not.toContain('stack');
    expect(serialized).toContain('provenance');
    expect(serialized).toContain('Hash');

    const decisionSource = fs.readFileSync(
      path.join(process.cwd(), 'server/services/deterministicDecisionService.ts'),
      'utf8',
    );
    const orchestrationSource = fs.readFileSync(
      path.join(process.cwd(), 'server/services/deterministicDecisionOrchestrationService.ts'),
      'utf8',
    );
    const routeAndUiRoots = ['src/app', 'src/ui', 'server/routes'];
    const routeAndUiSource = routeAndUiRoots
      .flatMap((root) => fs.existsSync(path.join(process.cwd(), root))
        ? fs.readdirSync(path.join(process.cwd(), root), { recursive: true })
          .filter((entry) => typeof entry === 'string' && /\.(?:ts|tsx)$/.test(entry))
          .map((entry) => fs.readFileSync(path.join(process.cwd(), root, entry), 'utf8'))
        : [])
      .join('\n');

    expect(decisionSource).not.toMatch(/eligibleHistory|counterpartyIban|paymentPurpose|description/);
    expect(orchestrationSource).not.toMatch(/eligibleHistory|counterpartyIban|paymentPurpose|description/);
    expect(routeAndUiSource).not.toMatch(/confirmedHistoryEligibilityService|eligibleHistory/);
    expect(result.decision.sideEffects.persistsDecision).toBe(false);
    expect(result.orchestration.sideEffects.persistsDecision).toBe(false);
  });

  it('contains no planning writes, transactions, booking/review/period/ledger mutations, or model calls', () => {
    const source = phase4ServicePaths
      .map((file) => fs.readFileSync(path.join(process.cwd(), file), 'utf8'))
      .join('\n');

    expect(source).not.toMatch(/\b(?:db|tx|client)\.[A-Za-z0-9_]+\.(?:create|createMany|update|updateMany|delete|deleteMany|upsert)\s*\(/);
    expect(source).not.toMatch(/\b(?:db|tx|client)\.\$transaction\s*\(/);
    expect(source).not.toMatch(/transactionBooking\.(create|update|delete|upsert)/);
    expect(source).not.toMatch(/reviewDecision\.(create|update|delete|upsert)/);
    expect(source).not.toMatch(/period\.(create|update|delete|upsert)|ledger\.(create|update|delete|upsert)/);
    expect(source).not.toMatch(/merchant(Alias|Fingerprint|Conflict|Resolution|IdentityDecision|AuditEvent)\.(create|update|delete|upsert)/);
    expect(source).not.toMatch(/OpenAI|Anthropic|Claude|Bedrock|invokeModel|generateText|chat\.completions/i);
    expect(source).not.toMatch(/Math\.random|Date\.now\(\)/);
  });

  it('keeps dry-run backfill planning outside the existing write transaction', async () => {
    const calls = {
      transaction: 0,
      create: 0,
      createMany: 0,
      update: 0,
      updateMany: 0,
      delete: 0,
      deleteMany: 0,
      upsert: 0,
    };
    const forbidden = (name: keyof typeof calls) => vi.fn(async () => {
      calls[name] += 1;
      throw new Error(`forbidden ${name}`);
    });
    const unresolved = {
      id: targetTransactionId,
      date: new Date('2026-07-01T00:00:00.000Z'),
      accountId: 'account-1',
      direction: 'credit',
      amountMinor: 5000n,
      counterparty: 'Stichting Alpha',
      reference: 'Gift project YA',
      description: 'Maandelijkse gift juli',
      rawRow: { 'Counterparty IBAN': 'NL11BANK0123456789' },
    };
    const approved = {
      ...unresolved,
      id: 'history-1',
      userId: 'admin-user',
      ledger: { lockedAt: new Date('2025-08-01T00:00:00.000Z') },
      transactionBooking: {
        id: 'booking-history-1',
        workspaceId,
        projectId: 'project-a',
        transactionTypeId: 'type-a',
        categoryId: 'category-a',
        source: 'MANUAL',
        evidenceHash: 'booking-evidence-history-1',
        confirmedBy: 'admin-user',
        confirmedAt: new Date('2025-07-02T10:00:00.000Z'),
        project: { workspaceId },
        transactionType: { workspaceId },
        category: { workspaceId },
      },
      reviewDecisions: [{
        id: 'decision-history-1',
        workspaceId,
        transactionId: 'history-1',
        suggestionId: null,
        action: 'ASSIGN_MANUALLY',
        afterBookingId: 'booking-history-1',
        afterProjectId: 'project-a',
        afterTypeId: 'type-a',
        afterCategoryId: 'category-a',
        actorId: 'admin-user',
        evidenceHash: 'decision-evidence-history-1',
        decidedAt: new Date('2025-07-02T10:00:01.000Z'),
        suggestion: null,
      }],
    };
    const db = {
      workspaceMembership: { findFirst: vi.fn(async () => ({ workspaceId })) },
      transaction: {
        findMany: vi.fn(async (args: any) => args.where.transactionBooking === null ? [unresolved] : [approved]),
      },
      project: { findMany: vi.fn(async () => [{ id: 'project-a', workspaceId, isActive: true }]) },
      transactionType: { findMany: vi.fn(async () => [{ id: 'type-a', workspaceId, isActive: true }]) },
      category: { findMany: vi.fn(async () => [{ id: 'category-a', workspaceId, isActive: true }]) },
      categorizationSuggestion: {
        create: forbidden('create'),
        createMany: forbidden('createMany'),
        update: forbidden('update'),
        updateMany: forbidden('updateMany'),
        delete: forbidden('delete'),
        deleteMany: forbidden('deleteMany'),
        upsert: forbidden('upsert'),
      },
      $transaction: vi.fn(async () => {
        calls.transaction += 1;
        throw new Error('forbidden transaction');
      }),
    };

    const result = await backfillHistorySuggestions(db as any, { userId: 'admin-user' });
    expect(result.status).toBe('DRY_RUN_COMPLETE');
    expect(result.dryRun).toBe(true);
    expect(result.writesPerformed).toBe(false);
    expect(calls).toEqual({
      transaction: 0,
      create: 0,
      createMany: 0,
      update: 0,
      updateMany: 0,
      delete: 0,
      deleteMany: 0,
      upsert: 0,
    });
    expect(result.sideEffects).toMatchObject({
      createsCategorizationSuggestion: false,
      createsTransactionBooking: false,
      closesPeriod: false,
      mutatesBankFacts: false,
    });
  });
});
