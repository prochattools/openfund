import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import {
  buildRestrictedRetrievalCandidates,
  DEFAULT_RESTRICTED_CANDIDATE_BOUNDS,
  HARD_MAXIMUM_CANDIDATES_PER_DIMENSION,
  HARD_MAXIMUM_EVIDENCE_ALTERNATIVES_PER_DIMENSION,
  loadRestrictedDimensionRecords,
  normalizeRestrictedCandidateBounds,
  RESTRICTED_RETRIEVAL_CANDIDATE_VERSION,
  type RestrictedDimensionRecord,
} from '../../server/services/restrictedRetrievalCandidateService';
import { buildDeterministicRetrievalEvidence } from '../../server/services/deterministicRetrievalEvidenceService';
import { retrieveDeterministicConfirmedHistory } from '../../server/services/deterministicHistoryRetrievalService';
import {
  CONFIRMED_HISTORY_ELIGIBILITY_VERSION,
  type EligibleConfirmedHistoryBooking,
} from '../../server/services/confirmedHistoryEligibilityService';
import type { HistorySuggestionFacts } from '../../server/services/historySuggestionService';

const workspaceId = 'workspace-1';

const target = (overrides: Partial<HistorySuggestionFacts> = {}): HistorySuggestionFacts => ({
  transactionId: 'target-1',
  date: new Date('2026-07-01T00:00:00.000Z'),
  accountId: 'account-1',
  direction: 'credit',
  amountMinor: 5000n,
  counterparty: 'Stichting Alpha',
  counterpartyIban: 'NL11BANK0123456789',
  description: 'Maandelijkse gift juli',
  paymentPurpose: 'Gift project YA',
  ...overrides,
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

const buildEvidence = (records: EligibleConfirmedHistoryBooking[], minimumScoreBasisPoints = 0) => {
  const targetFacts = target();
  const retrieval = retrieveDeterministicConfirmedHistory({
    workspaceId,
    target: targetFacts,
    eligibleHistory: records,
    minimumScoreBasisPoints,
  });
  return buildDeterministicRetrievalEvidence({
    workspaceId,
    target: targetFacts,
    eligibleHistory: records,
    retrieval,
  });
};

const activeRecord = (id: string, overrides: Partial<RestrictedDimensionRecord> = {}): RestrictedDimensionRecord => ({
  id,
  workspaceId,
  isActive: true,
  ...overrides,
});

const validRecords = () => ({
  projectRecords: [activeRecord('project-a')],
  transactionTypeRecords: [activeRecord('type-a')],
  categoryRecords: [activeRecord('category-a')],
});

describe('Program Phase 4.4 restricted retrieval candidates', () => {
  it('returns active workspace-scoped project, type, and category candidates', () => {
    const evidence = buildEvidence([history('one')]);
    const result = buildRestrictedRetrievalCandidates({ workspaceId, evidence, ...validRecords() });

    expect(result.status).toBe('MATCHED');
    expect(result.abstentionReason).toBeNull();
    expect(result.candidateVersion).toBe(RESTRICTED_RETRIEVAL_CANDIDATE_VERSION);
    expect(result.projectCandidates[0]).toMatchObject({
      candidateId: 'project-a',
      dimension: 'PROJECT',
      rank: 1,
      active: true,
      directionCompatible: true,
      reasonCodes: ['CURRENT_RETRIEVED_VALUE', 'ACTIVE_WORKSPACE_MATCH', 'DIRECTION_COMPATIBLE'],
    });
    expect(result.transactionTypeCandidates[0]!.candidateId).toBe('type-a');
    expect(result.categoryCandidates[0]!.candidateId).toBe('category-a');
    expect(result.projectCandidates[0]!.candidateHash).toMatch(/^[a-f0-9]{64}$/);
    expect(result.candidateSetHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('excludes inactive, missing, and cross-workspace records with bounded diagnostics', () => {
    const evidence = buildEvidence([history('one')]);
    const result = buildRestrictedRetrievalCandidates({
      workspaceId,
      evidence,
      projectRecords: [activeRecord('project-a', { isActive: false })],
      transactionTypeRecords: [],
      categoryRecords: [activeRecord('category-a', { workspaceId: 'workspace-2' })],
    });

    expect(result.status).toBe('ABSTAINED');
    expect(result.abstentionReason).toBe('NO_VALID_PROJECT_CANDIDATE');
    expect(result.projectCandidates).toEqual([]);
    expect(result.transactionTypeCandidates).toEqual([]);
    expect(result.categoryCandidates).toEqual([]);
    expect(result.diagnostics).toEqual([
      { dimension: 'PROJECT', candidateId: 'project-a', reason: 'INACTIVE' },
      { dimension: 'TRANSACTION_TYPE', candidateId: 'type-a', reason: 'MISSING' },
      { dimension: 'CATEGORY', candidateId: 'category-a', reason: 'CROSS_WORKSPACE' },
    ]);
  });

  it('retains a valid current value and includes only evidence-supported alternatives', () => {
    const alternative = history('alternative', ['project-b', 'type-b', 'category-b'], {
      counterparty: 'Different party',
      counterpartyIban: null,
      description: 'Different description',
      paymentPurpose: null,
      amountMinor: 5100n,
    });
    const evidence = buildEvidence([history('selected'), alternative]);
    const result = buildRestrictedRetrievalCandidates({
      workspaceId,
      evidence,
      projectRecords: [activeRecord('project-a'), activeRecord('project-b'), activeRecord('project-unsupported')],
      transactionTypeRecords: [activeRecord('type-a'), activeRecord('type-b'), activeRecord('type-unsupported')],
      categoryRecords: [activeRecord('category-a'), activeRecord('category-b'), activeRecord('category-unsupported')],
    });

    expect(result.projectCandidates.map((candidate) => candidate.candidateId)).toEqual(['project-a', 'project-b']);
    expect(result.transactionTypeCandidates.map((candidate) => candidate.candidateId)).toEqual(['type-a', 'type-b']);
    expect(result.categoryCandidates.map((candidate) => candidate.candidateId)).toEqual(['category-a', 'category-b']);
    expect(result.projectCandidates[1]!.reasonCodes).toContain('SUPPORTED_ALTERNATIVE');
    expect(JSON.stringify(result)).not.toContain('project-unsupported');
  });

  it('abstains for material conflict and insufficient evidence inputs', () => {
    const material = buildEvidence([
      history('a', ['project-a', 'type-a', 'category-a']),
      history('b', ['project-b', 'type-b', 'category-b']),
    ]);
    const materialResult = buildRestrictedRetrievalCandidates({
      workspaceId,
      evidence: material,
      projectRecords: [],
      transactionTypeRecords: [],
      categoryRecords: [],
    });
    expect(materialResult).toMatchObject({
      status: 'ABSTAINED',
      abstentionReason: 'MATERIAL_CONFLICT',
      projectCandidates: [],
      transactionTypeCandidates: [],
      categoryCandidates: [],
    });

    const insufficient = { ...buildEvidence([history('one')]), status: 'ABSTAINED' as const, abstentionReason: 'INSUFFICIENT_EVIDENCE' as const };
    expect(buildRestrictedRetrievalCandidates({
      workspaceId,
      evidence: insufficient,
      projectRecords: [],
      transactionTypeRecords: [],
      categoryRecords: [],
    })).toMatchObject({ status: 'ABSTAINED', abstentionReason: 'INSUFFICIENT_EVIDENCE' });
  });

  it.each([
    ['project', { projectRecords: [], transactionTypeRecords: [activeRecord('type-a')], categoryRecords: [activeRecord('category-a')] }, 'NO_VALID_PROJECT_CANDIDATE'],
    ['type', { projectRecords: [activeRecord('project-a')], transactionTypeRecords: [], categoryRecords: [activeRecord('category-a')] }, 'NO_VALID_TRANSACTION_TYPE_CANDIDATE'],
    ['category', { projectRecords: [activeRecord('project-a')], transactionTypeRecords: [activeRecord('type-a')], categoryRecords: [] }, 'NO_VALID_CATEGORY_CANDIDATE'],
  ] as const)('returns explicit empty-set abstention for %s', (_dimension, records, reason) => {
    const result = buildRestrictedRetrievalCandidates({ workspaceId, evidence: buildEvidence([history('one')]), ...records });
    expect(result.status).toBe('ABSTAINED');
    expect(result.abstentionReason).toBe(reason);
  });

  it('applies deterministic ordering, bounds, alternative limits, and hashes', () => {
    const alternatives = Array.from({ length: 12 }, (_, index) => history(
      `alternative-${String(index).padStart(2, '0')}`,
      [`project-${index}`, `type-${index}`, `category-${index}`],
      {
        counterparty: null,
        counterpartyIban: null,
        description: `other-${index}`,
        paymentPurpose: null,
        amountMinor: BigInt(5001 + index),
      },
    ));
    const evidence = buildEvidence([history('selected'), ...alternatives]);
    const records = {
      projectRecords: [activeRecord('project-a'), ...alternatives.map((_, index) => activeRecord(`project-${index}`))],
      transactionTypeRecords: [activeRecord('type-a'), ...alternatives.map((_, index) => activeRecord(`type-${index}`))],
      categoryRecords: [activeRecord('category-a'), ...alternatives.map((_, index) => activeRecord(`category-${index}`))],
    };
    const first = buildRestrictedRetrievalCandidates({
      workspaceId,
      evidence,
      ...records,
      bounds: {
        maximumProjectCandidates: 999,
        maximumTransactionTypeCandidates: 999,
        maximumCategoryCandidates: 999,
        maximumEvidenceAlternativesPerDimension: 2,
      },
    });
    const second = buildRestrictedRetrievalCandidates({
      workspaceId,
      evidence,
      projectRecords: [...records.projectRecords].reverse(),
      transactionTypeRecords: [...records.transactionTypeRecords].reverse(),
      categoryRecords: [...records.categoryRecords].reverse(),
      bounds: {
        maximumProjectCandidates: 999,
        maximumTransactionTypeCandidates: 999,
        maximumCategoryCandidates: 999,
        maximumEvidenceAlternativesPerDimension: 2,
      },
    });

    expect(first).toEqual(second);
    expect(first.bounds.maximumProjectCandidates).toBe(HARD_MAXIMUM_CANDIDATES_PER_DIMENSION);
    expect(first.bounds.maximumTransactionTypeCandidates).toBe(HARD_MAXIMUM_CANDIDATES_PER_DIMENSION);
    expect(first.bounds.maximumCategoryCandidates).toBe(HARD_MAXIMUM_CANDIDATES_PER_DIMENSION);
    expect(first.bounds.maximumEvidenceAlternativesPerDimension).toBe(2);
    expect(first.projectCandidates.length).toBeLessThanOrEqual(3);
    expect(first.projectCandidates[0]!.candidateId).toBe('project-a');
  });

  it('normalizes invalid bounds to conservative defaults and hard caps', () => {
    expect(normalizeRestrictedCandidateBounds({
      maximumProjectCandidates: Number.NaN,
      maximumTransactionTypeCandidates: 0,
      maximumCategoryCandidates: 999,
      maximumEvidenceAlternativesPerDimension: 999,
    })).toEqual({
      maximumProjectCandidates: DEFAULT_RESTRICTED_CANDIDATE_BOUNDS.maximumProjectCandidates,
      maximumTransactionTypeCandidates: 1,
      maximumCategoryCandidates: HARD_MAXIMUM_CANDIDATES_PER_DIMENSION,
      maximumEvidenceAlternativesPerDimension: HARD_MAXIMUM_EVIDENCE_ALTERNATIVES_PER_DIMENSION,
    });
  });

  it('enforces workspace, eligibility, retrieval, and evidence versions', () => {
    const evidence = buildEvidence([history('one')]);
    expect(() => buildRestrictedRetrievalCandidates({ workspaceId: 'workspace-2', evidence, ...validRecords() }))
      .toThrow('authorized workspace');
    expect(() => buildRestrictedRetrievalCandidates({
      workspaceId,
      evidence: { ...evidence, evidenceVersion: 'other-evidence-v0' as any },
      ...validRecords(),
    })).toThrow('deterministic-retrieval-evidence-v1');
    expect(() => buildRestrictedRetrievalCandidates({
      workspaceId,
      evidence: { ...evidence, scorerVersion: 'other-scorer-v0' as any },
      ...validRecords(),
    })).toThrow('deterministic-history-retrieval-v1');
    expect(() => buildRestrictedRetrievalCandidates({
      workspaceId,
      evidence: { ...evidence, eligibilityVersion: 'other-history-v0' as any },
      ...validRecords(),
    })).toThrow('confirmed-history-v1');
  });

  it('loads only bounded evidence IDs from the authorized workspace', async () => {
    const evidence = buildEvidence([history('one')]);
    const projectFindMany = vi.fn().mockResolvedValue([activeRecord('project-a')]);
    const typeFindMany = vi.fn().mockResolvedValue([activeRecord('type-a')]);
    const categoryFindMany = vi.fn().mockResolvedValue([activeRecord('category-a')]);
    const db = {
      project: { findMany: projectFindMany },
      transactionType: { findMany: typeFindMany },
      category: { findMany: categoryFindMany },
    } as any;

    const result = await loadRestrictedDimensionRecords(db, { workspaceId, evidence });

    expect(result.projectRecords).toHaveLength(1);
    expect(projectFindMany).toHaveBeenCalledWith({
      where: { id: { in: ['project-a'] }, workspaceId },
      select: { id: true, workspaceId: true, isActive: true },
    });
    expect(typeFindMany).toHaveBeenCalledWith({
      where: { id: { in: ['type-a'] }, workspaceId },
      select: { id: true, workspaceId: true, isActive: true },
    });
    expect(categoryFindMany).toHaveBeenCalledWith({
      where: { id: { in: ['category-a'] }, workspaceId },
      select: { id: true, workspaceId: true, isActive: true },
    });
  });

  it('returns privacy-safe output and contains no write, transaction, persistence, or AI path', () => {
    const result = buildRestrictedRetrievalCandidates({
      workspaceId,
      evidence: buildEvidence([history('private')]),
      ...validRecords(),
    });
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain('NL11BANK0123456789');
    expect(serialized).not.toContain('Stichting Alpha');
    expect(serialized).not.toContain('Maandelijkse gift juli');
    expect(serialized).not.toContain('Gift project YA');
    expect(result.sideEffects).toMatchObject({
      writesPerformed: false,
      createsTransactionBooking: false,
      createsCategorizationSuggestion: false,
      mutatesBankFacts: false,
      mutatesReviewDecisions: false,
      mutatesPeriodState: false,
      mutatesLedgerRecords: false,
      invokesExternalModel: false,
    });

    const source = fs.readFileSync(path.join(process.cwd(), 'server/services/restrictedRetrievalCandidateService.ts'), 'utf8');
    expect(source).not.toMatch(/\.(create|update|delete|upsert|createMany|updateMany|deleteMany)\s*\(/);
    expect(source).not.toContain('$transaction');
    expect(source).not.toMatch(/OpenAI|Claude|Bedrock|invokeModel|generateText/i);
    expect(source).not.toMatch(/transactionBooking\.|categorizationSuggestion\.|reviewDecision\.|ledger\.|period/);
  });
});
