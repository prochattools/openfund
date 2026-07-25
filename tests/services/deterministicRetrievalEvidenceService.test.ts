import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  buildDeterministicRetrievalEvidence,
  DETERMINISTIC_RETRIEVAL_EVIDENCE_VERSION,
  MATERIAL_CONFLICT_MINIMUM_SCORE_BASIS_POINTS,
  MATERIAL_CONFLICT_SCORE_RATIO_PERCENT,
} from '../../server/services/deterministicRetrievalEvidenceService';
import {
  retrieveDeterministicConfirmedHistory,
} from '../../server/services/deterministicHistoryRetrievalService';
import {
  CONFIRMED_HISTORY_ELIGIBILITY_VERSION,
  type EligibleConfirmedHistoryBooking,
} from '../../server/services/confirmedHistoryEligibilityService';
import type { HistorySuggestionFacts } from '../../server/services/historySuggestionService';
import {
  MERCHANT_RETRIEVAL_ANCHOR_VERSION,
  type MerchantRetrievalAnchor,
} from '../../server/services/merchantRetrievalAnchor';

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
  triple: [string, string, string] = ['project-ya', 'type-gift-in', 'category-gifts'],
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

const readyAnchor = (): MerchantRetrievalAnchor => ({
  workspaceId,
  transactionId: 'target-1',
  merchantId: 'merchant-1',
  anchorVersion: MERCHANT_RETRIEVAL_ANCHOR_VERSION,
  resolutionVersion: 'merchant-alias-resolution-v1',
  evidenceHash: 'anchor-evidence-hash',
  sourceState: 'RESOLVED',
  supportingEvidence: [],
  conflictingEvidence: [],
  stale: false,
  expired: false,
  readiness: 'READY',
});

const explain = (input: {
  records: EligibleConfirmedHistoryBooking[];
  targetFacts?: HistorySuggestionFacts;
  merchantAnchor?: MerchantRetrievalAnchor | null;
  minimumScoreBasisPoints?: number;
}) => {
  const targetFacts = input.targetFacts ?? target();
  const retrieval = retrieveDeterministicConfirmedHistory({
    workspaceId,
    target: targetFacts,
    eligibleHistory: input.records,
    merchantAnchor: input.merchantAnchor,
    merchantAnchorEnabled: input.merchantAnchor != null,
    minimumScoreBasisPoints: input.minimumScoreBasisPoints,
  });
  return buildDeterministicRetrievalEvidence({
    workspaceId,
    target: targetFacts,
    eligibleHistory: input.records,
    retrieval,
    merchantAnchor: input.merchantAnchor,
    merchantAnchorEnabled: input.merchantAnchor != null,
  });
};

describe('Program Phase 4.3 deterministic retrieval evidence', () => {
  it('returns supporting evidence for all three dimensions when confirmed history agrees', () => {
    const result = explain({ records: [history('one'), history('two')] });

    expect(result.status).toBe('MATCHED');
    expect(result.abstentionReason).toBeNull();
    expect(result.evidenceVersion).toBe(DETERMINISTIC_RETRIEVAL_EVIDENCE_VERSION);
    expect(result.materialConflictRule).toEqual({
      version: DETERMINISTIC_RETRIEVAL_EVIDENCE_VERSION,
      scoreRatioPercent: MATERIAL_CONFLICT_SCORE_RATIO_PERCENT,
      minimumCompetingScoreBasisPoints: MATERIAL_CONFLICT_MINIMUM_SCORE_BASIS_POINTS,
    });
    const dimensions = result.candidates[0]!.dimensions;
    for (const dimension of [dimensions.project, dimensions.transactionType, dimensions.category]) {
      expect(dimension.status).toBe('SUPPORTED');
      expect(dimension.supportCount).toBe(2);
      expect(dimension.conflictingEvidence).toEqual([]);
      expect(dimension.supportingEvidence).toHaveLength(2);
      expect(dimension.evidenceHash).toMatch(/^[a-f0-9]{64}$/);
    }
  });

  it('identifies deterministic competing values for project, type, and category', () => {
    const result = explain({
      records: [
        history('selected', ['project-a', 'type-a', 'category-a']),
        history('alternative', ['project-b', 'type-b', 'category-b'], {
          counterparty: 'Different counterparty',
          counterpartyIban: null,
          description: 'Different description',
          paymentPurpose: null,
          amountMinor: 5100n,
        }),
      ],
      minimumScoreBasisPoints: 0,
    });

    const dimensions = result.candidates[0]!.dimensions;
    expect(dimensions.project.conflictingEvidence[0]).toMatchObject({ valueId: 'project-b', supportCount: 1 });
    expect(dimensions.transactionType.conflictingEvidence[0]).toMatchObject({ valueId: 'type-b', supportCount: 1 });
    expect(dimensions.category.conflictingEvidence[0]).toMatchObject({ valueId: 'category-b', supportCount: 1 });
    expect(dimensions.project.conflictingEvidence[0]!.strongestEvidence[0]).toEqual(expect.objectContaining({
      historyTransactionId: 'alternative',
      bookingId: 'booking-alternative',
      reviewDecisionId: 'decision-alternative',
      provenanceHash: 'provenance-alternative',
    }));
  });

  it('detects a material contradiction and abstains instead of silently choosing', () => {
    const result = explain({
      records: [
        history('a', ['project-a', 'type-a', 'category-a']),
        history('b', ['project-b', 'type-b', 'category-b']),
      ],
    });

    expect(result.status).toBe('ABSTAINED');
    expect(result.abstentionReason).toBe('MATERIAL_CONFLICT');
    expect(result.candidates[0]!.evidenceStatus).toBe('MATERIAL_CONFLICT');
    expect(result.candidates[0]!.dimensions.project.materialConflict).toBe(true);
    expect(result.candidates[0]!.dimensions.transactionType.materialConflict).toBe(true);
    expect(result.candidates[0]!.dimensions.category.materialConflict).toBe(true);
  });

  it('preserves empty-history abstention and deterministic evidence ordering and hashes', () => {
    const empty = explain({ records: [] });
    expect(empty).toMatchObject({
      status: 'ABSTAINED',
      abstentionReason: 'NO_ELIGIBLE_HISTORY',
      candidates: [],
    });

    const records = [
      history('z', ['project-z', 'type-z', 'category-z'], { counterparty: null, counterpartyIban: null }),
      history('a', ['project-a', 'type-a', 'category-a'], { counterparty: null, counterpartyIban: null }),
    ];
    const first = explain({ records, targetFacts: target({ counterparty: null, counterpartyIban: null }), minimumScoreBasisPoints: 0 });
    const second = explain({ records: [...records].reverse(), targetFacts: target({ counterparty: null, counterpartyIban: null }), minimumScoreBasisPoints: 0 });
    expect(first).toEqual(second);
    expect(first.evidenceHash).toMatch(/^[a-f0-9]{64}$/);
    expect(first.candidates.every((candidate) => /^[a-f0-9]{64}$/.test(candidate.evidenceHash))).toBe(true);
  });

  it('includes Merchant Knowledge anchor support only for matching privacy-safe merchant identity', () => {
    const result = explain({
      records: [history('merchant-match', undefined, { merchantId: 'merchant-1' })],
      merchantAnchor: readyAnchor(),
    });

    const project = result.candidates[0]!.dimensions.project;
    expect(project.componentCodes).toContain('MERCHANT_ANCHOR');
    expect(project.componentScores.merchantAnchorBasisPoints).toBeGreaterThan(0);
  });

  it('rejects invalid eligibility versions and cross-workspace history', () => {
    const invalidVersion = history('invalid-version');
    invalidVersion.confirmedHistory.eligibilityVersion = 'generated-history-v0';
    expect(() => explain({ records: [invalidVersion] })).toThrow('Only confirmed-history-v1');

    const crossWorkspace = history('cross-workspace');
    crossWorkspace.confirmedHistory.workspaceId = 'workspace-2';
    expect(() => explain({ records: [crossWorkspace] })).toThrow('Confirmed history from another workspace is not allowed.');
  });

  it('returns privacy-safe evidence only and has no write, transaction, persistence, or AI path', () => {
    const result = explain({ records: [history('private')] });
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain('NL11BANK0123456789');
    expect(serialized).not.toContain('Stichting Alpha');
    expect(serialized).not.toContain('Maandelijkse gift juli');
    expect(serialized).not.toContain('Gift project YA');
    expect(serialized).toContain('provenance-private');
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

    const source = fs.readFileSync(path.join(process.cwd(), 'server/services/deterministicRetrievalEvidenceService.ts'), 'utf8');
    expect(source).not.toMatch(/\.(create|update|delete|upsert|createMany|updateMany|deleteMany)\s*\(/);
    expect(source).not.toContain('$transaction');
    expect(source).not.toMatch(/OpenAI|Claude|Bedrock|invokeModel|generateText/i);
    expect(source).not.toMatch(/transactionBooking\.|categorizationSuggestion\.|reviewDecision\.|ledger\.|period/);
  });
});
