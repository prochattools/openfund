import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  buildDeterministicDecision,
  DETERMINISTIC_DECISION_VERSION,
  DeterministicDecisionError,
} from '../../server/services/deterministicDecisionService';
import { buildRestrictedRetrievalCandidates } from '../../server/services/restrictedRetrievalCandidateService';
import { buildDeterministicRetrievalEvidence } from '../../server/services/deterministicRetrievalEvidenceService';
import { retrieveDeterministicConfirmedHistory } from '../../server/services/deterministicHistoryRetrievalService';
import {
  CONFIRMED_HISTORY_ELIGIBILITY_VERSION,
  type EligibleConfirmedHistoryBooking,
} from '../../server/services/confirmedHistoryEligibilityService';
import type { HistorySuggestionFacts } from '../../server/services/historySuggestionService';

const workspaceId = 'workspace-1';

const target = (): HistorySuggestionFacts => ({
  transactionId: 'target-1',
  date: new Date('2026-07-01T00:00:00.000Z'),
  accountId: 'account-1',
  direction: 'credit',
  amountMinor: 5000n,
  counterparty: 'Stichting Alpha',
  counterpartyIban: 'NL11BANK0123456789',
  description: 'Maandelijkse gift juli',
  paymentPurpose: 'Gift project YA',
});

const history = (
  id: string,
  triple: [string, string, string] = ['project-a', 'type-a', 'category-a'],
  overrides: Partial<EligibleConfirmedHistoryBooking> = {},
): EligibleConfirmedHistoryBooking => ({
  transactionId: id,
  date: new Date('2025-07-01T00:00:00.000Z'),
  accountId: 'account-1',
  direction: 'credit',
  amountMinor: 5000n,
  counterparty: 'Stichting Alpha',
  counterpartyIban: 'NL11BANK0123456789',
  description: 'Maandelijkse gift juli',
  paymentPurpose: 'Gift project YA',
  bookingId: `booking-${id}`,
  projectId: triple[0],
  transactionTypeId: triple[1],
  categoryId: triple[2],
  bookingEvidenceHash: `booking-hash-${id}`,
  confirmedHistory: {
    eligibilityVersion: CONFIRMED_HISTORY_ELIGIBILITY_VERSION,
    workspaceId,
    transactionId: id,
    bookingId: `booking-${id}`,
    reviewDecisionId: `decision-${id}`,
    reviewAction: 'ASSIGN_MANUALLY',
    actorId: 'admin-user',
    bookingSource: 'MANUAL',
    bookingEvidenceHash: `booking-hash-${id}`,
    decisionEvidenceHash: `decision-hash-${id}`,
    confirmedAt: '2025-07-01T10:00:00.000Z',
    decidedAt: '2025-07-01T10:00:01.000Z',
    projectId: triple[0],
    transactionTypeId: triple[1],
    categoryId: triple[2],
    ledgerLockedAt: null,
    provenanceHash: `provenance-${id}`,
  },
  ...overrides,
});

const pipeline = (records: EligibleConfirmedHistoryBooking[], minimumScoreBasisPoints = 0) => {
  const targetFacts = target();
  const retrieval = retrieveDeterministicConfirmedHistory({
    workspaceId,
    target: targetFacts,
    eligibleHistory: records,
    minimumScoreBasisPoints,
  });
  const evidence = buildDeterministicRetrievalEvidence({
    workspaceId,
    target: targetFacts,
    eligibleHistory: records,
    retrieval,
  });
  const candidates = buildRestrictedRetrievalCandidates({
    workspaceId,
    evidence,
    projectRecords: [
      { id: 'project-a', workspaceId, isActive: true },
      { id: 'project-b', workspaceId, isActive: true },
    ],
    transactionTypeRecords: [
      { id: 'type-a', workspaceId, isActive: true },
      { id: 'type-b', workspaceId, isActive: true },
    ],
    categoryRecords: [
      { id: 'category-a', workspaceId, isActive: true },
      { id: 'category-b', workspaceId, isActive: true },
    ],
  });
  return { targetFacts, retrieval, evidence, candidates };
};

const decision = (records: EligibleConfirmedHistoryBooking[], minimumScoreBasisPoints = 0) => {
  const built = pipeline(records, minimumScoreBasisPoints);
  return buildDeterministicDecision({
    workspaceId,
    transactionFactHash: 'transaction-fact-hash',
    ...built,
  });
};

describe('Program Phase 4.5 deterministic Decision contract', () => {
  it('builds a complete proposed Decision with selected values, alternatives, provenance, and stable hashes', () => {
    const result = decision([
      history('selected'),
      history('alternative', ['project-b', 'type-b', 'category-b'], {
        counterparty: 'Different party',
        counterpartyIban: null,
        description: 'Different description',
        paymentPurpose: null,
        amountMinor: 5100n,
      }),
    ]);

    expect(result.decisionVersion).toBe(DETERMINISTIC_DECISION_VERSION);
    expect(result.status).toBe('PROPOSED');
    expect(result.abstentionReason).toBeNull();
    expect(result.dimensions.project).toMatchObject({
      status: 'SELECTED',
      selectedCandidateId: 'project-a',
      selectedCandidateRank: 1,
      allowedCandidateIds: ['project-a', 'project-b'],
      confidence: { calibration: 'UNCALIBRATED', label: null },
    });
    expect(result.dimensions.transactionType.selectedCandidateId).toBe('type-a');
    expect(result.dimensions.category.selectedCandidateId).toBe('category-a');
    expect(result.dimensions.project.provenanceHashes).toContain('provenance-selected');
    expect(result.dimensions.project.dimensionHash).toMatch(/^[a-f0-9]{64}$/);
    expect(result.decisionHash).toMatch(/^[a-f0-9]{64}$/);
    expect(result.replayIdentity).toEqual(expect.objectContaining({
      retrievalHash: expect.stringMatching(/^[a-f0-9]{64}$/),
      evidenceHash: expect.stringMatching(/^[a-f0-9]{64}$/),
      candidateSetHash: expect.stringMatching(/^[a-f0-9]{64}$/),
      weightsHash: expect.stringMatching(/^[a-f0-9]{64}$/),
      boundsHash: expect.stringMatching(/^[a-f0-9]{64}$/),
    }));
  });

  it('is deterministic and independent of candidate-array input order', () => {
    const built = pipeline([
      history('selected'),
      history('alternative', ['project-b', 'type-b', 'category-b'], {
        counterparty: 'Different party',
        counterpartyIban: null,
        description: 'Different description',
        paymentPurpose: null,
        amountMinor: 5100n,
      }),
    ]);
    const first = buildDeterministicDecision({ workspaceId, transactionFactHash: 'fact', ...built });
    const reordered = {
      ...built.candidates,
      projectCandidates: [...built.candidates.projectCandidates].reverse(),
      transactionTypeCandidates: [...built.candidates.transactionTypeCandidates].reverse(),
      categoryCandidates: [...built.candidates.categoryCandidates].reverse(),
    };
    const second = buildDeterministicDecision({
      workspaceId,
      transactionFactHash: 'fact',
      retrieval: built.retrieval,
      evidence: built.evidence,
      candidates: reordered,
    });

    expect(second).toEqual(first);
    expect(JSON.stringify(second)).toBe(JSON.stringify(first));
  });

  it('propagates retrieval, material-conflict, and insufficient-evidence abstentions', () => {
    const noHistory = decision([], 3000);
    expect(noHistory).toMatchObject({ status: 'ABSTAINED', abstentionReason: 'NO_ELIGIBLE_HISTORY' });

    const conflicted = decision([
      history('a', ['project-a', 'type-a', 'category-a']),
      history('b', ['project-b', 'type-b', 'category-b']),
    ]);
    expect(conflicted).toMatchObject({ status: 'CONFLICTED', abstentionReason: 'MATERIAL_CONFLICT' });
    expect(conflicted.dimensions.project.status).toBe('CONFLICTED');

    const built = pipeline([history('one')]);
    const insufficientEvidence = { ...built.evidence, status: 'ABSTAINED' as const, abstentionReason: 'INSUFFICIENT_EVIDENCE' as const };
    const insufficientCandidates = { ...built.candidates, status: 'ABSTAINED' as const, abstentionReason: 'INSUFFICIENT_EVIDENCE' as const, projectCandidates: [], transactionTypeCandidates: [], categoryCandidates: [] };
    const insufficient = buildDeterministicDecision({
      workspaceId,
      retrieval: built.retrieval,
      evidence: insufficientEvidence,
      candidates: insufficientCandidates,
    });
    expect(insufficient).toMatchObject({ status: 'ABSTAINED', abstentionReason: 'INSUFFICIENT_EVIDENCE' });
  });

  it.each([
    ['projectCandidates', 'NO_VALID_PROJECT_CANDIDATE'],
    ['transactionTypeCandidates', 'NO_VALID_TRANSACTION_TYPE_CANDIDATE'],
    ['categoryCandidates', 'NO_VALID_CATEGORY_CANDIDATE'],
  ] as const)('abstains when %s is empty', (field, reason) => {
    const built = pipeline([history('one')]);
    const candidates = { ...built.candidates, [field]: [], status: 'ABSTAINED' as const, abstentionReason: reason };
    const result = buildDeterministicDecision({ workspaceId, ...built, candidates });
    expect(result.status).toBe('ABSTAINED');
    expect(result.abstentionReason).toBe(reason);
  });

  it('rejects stale identities, incompatible versions, and workspace mismatches', () => {
    const built = pipeline([history('one')]);
    expect(() => buildDeterministicDecision({
      workspaceId,
      ...built,
      expectedIdentity: { retrievalHash: 'stale' },
    })).toThrowError(expect.objectContaining({ code: 'stale_retrieval' }));
    expect(() => buildDeterministicDecision({
      workspaceId,
      ...built,
      expectedIdentity: { evidenceHash: 'stale' },
    })).toThrowError(expect.objectContaining({ code: 'stale_evidence' }));
    expect(() => buildDeterministicDecision({
      workspaceId,
      ...built,
      expectedIdentity: { candidateSetHash: 'stale' },
    })).toThrowError(expect.objectContaining({ code: 'stale_candidates' }));
    expect(() => buildDeterministicDecision({
      workspaceId: 'workspace-2',
      ...built,
    })).toThrowError(expect.objectContaining({ code: 'workspace_mismatch' }));
    expect(() => buildDeterministicDecision({
      workspaceId,
      retrieval: { ...built.retrieval, scorerVersion: 'other-v0' as any },
      evidence: built.evidence,
      candidates: built.candidates,
    })).toThrowError(expect.objectContaining({ code: 'version_mismatch' }));
  });

  it('produces an incomplete Decision when the selected value is not in the allowed set', () => {
    const built = pipeline([history('one')]);
    const candidates = { ...built.candidates, projectCandidates: [] };
    const result = buildDeterministicDecision({ workspaceId, ...built, candidates });

    expect(result.status).toBe('INCOMPLETE');
    expect(result.abstentionReason).toBe('INCOMPLETE_DECISION');
    expect(result.dimensions.project).toMatchObject({
      status: 'ABSTAINED',
      selectedCandidateId: null,
      reason: 'INCOMPLETE_DECISION',
    });
  });

  it('returns privacy-safe output with explicit zero-side-effect declarations', () => {
    const result = decision([history('private')]);
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain('NL11BANK0123456789');
    expect(serialized).not.toContain('Stichting Alpha');
    expect(serialized).not.toContain('Maandelijkse gift juli');
    expect(serialized).not.toContain('Gift project YA');
    expect(serialized).toContain('provenance-private');
    expect(result.sideEffects).toEqual({
      readOnly: true,
      previewOnly: true,
      createsTransactionBooking: false,
      createsCategorizationSuggestion: false,
      mutatesBankFacts: false,
      mutatesReviewDecisions: false,
      mutatesPeriodState: false,
      mutatesLedgerRecords: false,
      persistsDecision: false,
      invokesExternalModel: false,
    });

    const source = fs.readFileSync(path.join(process.cwd(), 'server/services/deterministicDecisionService.ts'), 'utf8');
    expect(source).not.toMatch(/\.(create|update|delete|upsert|createMany|updateMany|deleteMany)\s*\(/);
    expect(source).not.toContain('$transaction');
    expect(source).not.toMatch(/OpenAI|Claude|Bedrock|invokeModel|generateText/i);
    expect(source).not.toMatch(/transactionBooking\.|categorizationSuggestion\.|reviewDecision\.|ledger\.|period/);
  });

  it('uses typed Decision errors', () => {
    const error = new DeterministicDecisionError('stale_candidates', 'stale');
    expect(error).toMatchObject({ name: 'DeterministicDecisionError', code: 'stale_candidates', message: 'stale' });
  });
});
