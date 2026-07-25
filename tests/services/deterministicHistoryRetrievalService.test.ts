import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_HISTORY_RETRIEVAL_BOUNDS,
  DETERMINISTIC_HISTORY_RETRIEVAL_VERSION,
  DeterministicHistoryRetrievalError,
  retrieveDeterministicConfirmedHistory,
} from '../../server/services/deterministicHistoryRetrievalService';
import { CONFIRMED_HISTORY_ELIGIBILITY_VERSION, type EligibleConfirmedHistoryBooking } from '../../server/services/confirmedHistoryEligibilityService';
import { HISTORY_SUGGESTION_COMPONENT_WEIGHTS, type HistorySuggestionFacts } from '../../server/services/historySuggestionService';
import { MERCHANT_RETRIEVAL_ANCHOR_VERSION, type MerchantRetrievalAnchor } from '../../server/services/merchantRetrievalAnchor';

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

describe('Program Phase 4.2 deterministic history retrieval', () => {
  it('scores only confirmed-history-v1 records and rejects invalid versions or workspaces', () => {
    const eligible = history('eligible');
    expect(retrieveDeterministicConfirmedHistory({ workspaceId, target: target(), eligibleHistory: [eligible] })).toMatchObject({
      status: 'MATCHED',
      scorerVersion: DETERMINISTIC_HISTORY_RETRIEVAL_VERSION,
      eligibilityVersion: CONFIRMED_HISTORY_ELIGIBILITY_VERSION,
      candidates: [expect.objectContaining({ historyTransactionId: 'eligible' })],
    });

    const invalidVersion = history('invalid-version');
    invalidVersion.confirmedHistory.eligibilityVersion = 'generated-history-v0';
    expect(() => retrieveDeterministicConfirmedHistory({ workspaceId, target: target(), eligibleHistory: [invalidVersion] }))
      .toThrowError(DeterministicHistoryRetrievalError);

    const crossWorkspace = history('cross-workspace');
    crossWorkspace.confirmedHistory.workspaceId = 'workspace-2';
    expect(() => retrieveDeterministicConfirmedHistory({ workspaceId, target: target(), eligibleHistory: [crossWorkspace] }))
      .toThrowError(DeterministicHistoryRetrievalError);
  });

  it('returns deterministic rank, hashes, tie-breaking, weights, and privacy-safe evidence only', () => {
    const records = [
      history('b', ['project-b', 'type-b', 'category-b'], { counterparty: null, counterpartyIban: null }),
      history('a', ['project-a', 'type-a', 'category-a'], { counterparty: null, counterpartyIban: null }),
    ];
    const first = retrieveDeterministicConfirmedHistory({ workspaceId, target: target({ counterparty: null, counterpartyIban: null }), eligibleHistory: records, minimumScoreBasisPoints: 0 });
    const second = retrieveDeterministicConfirmedHistory({ workspaceId, target: target({ counterparty: null, counterpartyIban: null }), eligibleHistory: [...records].reverse(), minimumScoreBasisPoints: 0 });

    expect(first).toEqual(second);
    expect(first.weights).toEqual(HISTORY_SUGGESTION_COMPONENT_WEIGHTS);
    expect(first.candidates.map((candidate) => candidate.rank)).toEqual([1, 2]);
    expect(first.candidates[0]!.retrievalHash).toMatch(/^[a-f0-9]{64}$/);
    expect(first.retrievalHash).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.stringify(first)).not.toContain('NL11BANK0123456789');
    expect(JSON.stringify(first)).not.toContain('Maandelijkse gift juli');
    expect(first.candidates[0]!.privacySafeEvidence).toEqual(expect.objectContaining({
      matchedHistoryCount: 1,
      provenanceHashes: [expect.any(String)],
      bookingEvidenceHashes: [expect.any(String)],
      decisionEvidenceHashes: [expect.any(String)],
    }));
  });

  it('preserves direction exclusion and exposes amount, recency, recurrence, account, and anchor components', () => {
    const matching = history('matching', undefined, { merchantId: 'merchant-1' });
    const directionMismatch = history('debit', ['project-debit', 'type-debit', 'category-debit'], { direction: 'debit' });
    const result = retrieveDeterministicConfirmedHistory({
      workspaceId,
      target: target(),
      eligibleHistory: [directionMismatch, matching],
      merchantAnchor: readyAnchor(),
      merchantAnchorEnabled: true,
    });

    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0]!.historyTransactionId).toBe('matching');
    expect(result.candidates[0]!.componentScores).toMatchObject({
      exactAmountBasisPoints: expect.any(Number),
      recencyBasisPoints: expect.any(Number),
      recurringMonthBasisPoints: expect.any(Number),
      sameAccountBasisPoints: expect.any(Number),
      merchantAnchorBasisPoints: expect.any(Number),
    });
    expect(result.candidates[0]!.componentScores.merchantAnchorBasisPoints).toBeGreaterThan(0);
  });

  it('enforces default and hard bounds, five-year lookback, and three-candidate maximum', () => {
    const many = Array.from({ length: 1005 }, (_, index) => history(`history-${String(index).padStart(4, '0')}`, [`project-${index}`, `type-${index}`, `category-${index}`], {
      date: new Date(`2025-01-${String((index % 28) + 1).padStart(2, '0')}T00:00:00.000Z`),
      counterparty: null,
      counterpartyIban: null,
    }));
    const result = retrieveDeterministicConfirmedHistory({
      workspaceId,
      target: target({ counterparty: null, counterpartyIban: null }),
      eligibleHistory: many,
      maximumHistoryRows: 9999,
      maximumCandidates: 99,
      minimumScoreBasisPoints: 0,
    });

    expect(DEFAULT_HISTORY_RETRIEVAL_BOUNDS).toEqual({
      maximumHistoryRows: 500,
      maximumCandidates: 3,
      lookbackDays: 1825,
      minimumScoreBasisPoints: 3000,
    });
    expect(result.bounds.maximumHistoryRows).toBe(1000);
    expect(result.bounds.maximumCandidates).toBe(3);
    expect(result.bounds.lookbackDays).toBe(1825);
    expect(result.bounds.eligibleHistoryRowsConsidered).toBe(1000);
    expect(result.bounds.historyRowsTruncated).toBe(true);
    expect(result.candidates.length).toBeLessThanOrEqual(3);
  });

  it('abstains explicitly for empty history and below-threshold matches', () => {
    expect(retrieveDeterministicConfirmedHistory({ workspaceId, target: target(), eligibleHistory: [] })).toMatchObject({
      status: 'ABSTAINED',
      abstentionReason: 'NO_ELIGIBLE_HISTORY',
      candidates: [],
    });

    expect(retrieveDeterministicConfirmedHistory({
      workspaceId,
      target: target({ counterparty: null, counterpartyIban: null, description: 'x', paymentPurpose: null, amountMinor: 1n }),
      eligibleHistory: [history('weak', undefined, { counterparty: null, counterpartyIban: null, description: 'y', paymentPurpose: null, amountMinor: 999999n, accountId: 'other' })],
      minimumScoreBasisPoints: 10000,
    })).toMatchObject({
      status: 'ABSTAINED',
      abstentionReason: 'NO_SCORE_ABOVE_THRESHOLD',
      candidates: [],
    });
  });

  it('contains no writes, transaction, AI, booking, suggestion, review, ledger, or period mutation path', () => {
    const source = fs.readFileSync(path.join(process.cwd(), 'server/services/deterministicHistoryRetrievalService.ts'), 'utf8');
    expect(source).not.toMatch(/\.(create|update|delete|upsert|createMany|updateMany|deleteMany)\s*\(/);
    expect(source).not.toContain('$transaction');
    expect(source).not.toMatch(/OpenAI|Claude|Bedrock|invokeModel|generateText/i);
    expect(source).not.toMatch(/transactionBooking\.|categorizationSuggestion\.|reviewDecision\.|ledger\.|period/);
  });
});
