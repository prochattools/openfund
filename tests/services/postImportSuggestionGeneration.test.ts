import { describe, expect, it } from 'vitest';
import {
  rankHistorySuggestions,
  type ApprovedHistoryBooking,
  type HistorySuggestionFacts,
} from '../../server/services/historySuggestionService';
import {
  buildOwnerHistoryProposalPlan,
  OWNER_HISTORY_PRODUCER_KEY,
  OWNER_HISTORY_PRODUCER_VERSION,
} from '../../server/services/ownerHistoryProposalEvidenceService';
import {
  selectReviewPrefill,
  selectBestAvailableReviewSuggestion,
  checkPrefillEligibility,
  type ReviewEvidenceAlternative,
  type ReviewPrefillTrustedContext,
} from '../../server/services/reviewQueueService';
import { getReviewReliability } from '../../src/helpers/review-ui';
import type { EvidenceRichReviewItem } from '../../src/libs/api';

const makeTarget = (overrides: Partial<HistorySuggestionFacts> = {}): HistorySuggestionFacts => ({
  transactionId: 'new-tx-1',
  date: new Date('2026-07-10T00:00:00.000Z'),
  accountId: 'account-1',
  direction: 'debit',
  amountMinor: 15000n,
  counterparty: 'Hosting Provider BV',
  counterpartyIban: 'NL99BANK0000000001',
  description: 'Maandelijkse serverkosten juli',
  paymentPurpose: 'Hosting services',
  ...overrides,
});

const makeHistory = (
  id: string,
  triple: [string, string, string],
  overrides: Partial<ApprovedHistoryBooking> = {},
): ApprovedHistoryBooking => ({
  transactionId: id,
  date: new Date('2026-06-10T00:00:00.000Z'),
  accountId: 'account-1',
  direction: 'debit',
  amountMinor: 15000n,
  counterparty: 'Hosting Provider BV',
  counterpartyIban: 'NL99BANK0000000001',
  description: 'Maandelijkse serverkosten juni',
  paymentPurpose: 'Hosting services',
  bookingId: `booking-${id}`,
  projectId: triple[0],
  transactionTypeId: triple[1],
  categoryId: triple[2],
  bookingEvidenceHash: `hash-${id}`,
  ...overrides,
});

const makeAlternative = (overrides: Partial<ReviewEvidenceAlternative> = {}): ReviewEvidenceAlternative => ({
  suggestionId: 'suggestion-1',
  rank: 1,
  matcher: 'NORMALIZED_HISTORY',
  confidence: 'EXACT_FALLBACK',
  confidenceLabel: 'exacte historische suggestie',
  reason: 'Best match',
  matchedRuleIds: [],
  historicalRecordIds: ['hist-1'],
  evidenceHashes: ['hash-1'],
  evidenceHash: 'ev-hash-1',
  producerKey: OWNER_HISTORY_PRODUCER_KEY,
  producerVersion: OWNER_HISTORY_PRODUCER_VERSION,
  scoreBasisPoints: 8500,
  eligible: true,
  projectId: 'project-1',
  projectCode: 'P1',
  projectLabel: 'Project One',
  transactionTypeId: 'type-1',
  transactionTypeLabel: 'Expense',
  categoryId: 'category-1',
  categoryLabel: 'Hosting',
  complete: true,
  ...overrides,
});

const makeReviewItem = (overrides: Partial<EvidenceRichReviewItem> = {}): EvidenceRichReviewItem => ({
  id: 'tx-1',
  transactionId: 'tx-1',
  previewFingerprint: null,
  displayDate: '2026-07-01T00:00:00.000Z',
  rawIngDate: '2026-07-01',
  counterparty: 'Vendor',
  counterpartyIban: null,
  accountIdentifier: null,
  accountName: null,
  amount: -150,
  amountMinor: '15000',
  currency: 'EUR',
  direction: 'debit',
  directionLabel: 'Afschrijving',
  description: 'Test transaction',
  paymentPurpose: null,
  source: 'test',
  deterministicStatus: 'review_suggested',
  statusLabel: 'Suggestie',
  reason: 'Suggestie',
  proposed: {
    projectId: 'project-1',
    projectCode: 'P1',
    projectLabel: 'Project One',
    transactionTypeId: 'type-1',
    transactionTypeLabel: 'Expense',
    categoryId: 'category-1',
    categoryLabel: 'Hosting',
    complete: true,
  },
  prefill: {
    source: 'OWNER_HISTORY_V2',
    complete: true,
    weakFallback: false,
    scoreBasisPoints: 8500,
    confidence: 'EXACT_FALLBACK',
    matcher: 'NORMALIZED_HISTORY',
  },
  alternatives: [makeAlternative()],
  evidence: {
    matchedRuleIds: [],
    historicalRecordIds: ['hist-1'],
    evidenceHashes: ['hash-1'],
    importFingerprint: null,
    exactReplayKey: null,
    reason: 'Suggestie',
  },
  safeDeterministicCandidate: false,
  requiresAdministratorApproval: true,
  sideEffects: {
    createsTransactionBooking: false,
    closesPeriod: false,
  },
  ...overrides,
});

describe('post-import suggestion generation', () => {
  describe('imported unresolved rows receive complete pending proposals', () => {
    it('generates suggestions with complete triple from exact IBAN match', () => {
      const target = makeTarget();
      const history = [
        makeHistory('hist-1', ['project-1', 'type-1', 'category-1']),
        makeHistory('hist-2', ['project-1', 'type-1', 'category-1'], {
          date: new Date('2026-05-10T00:00:00.000Z'),
        }),
      ];

      const ranked = rankHistorySuggestions(target, history);
      expect(ranked.length).toBeGreaterThanOrEqual(1);
      const best = ranked[0]!;
      expect(best.projectId).toBe('project-1');
      expect(best.transactionTypeId).toBe('type-1');
      expect(best.categoryId).toBe('category-1');
      expect(best.matcher).toBe('NORMALIZED_HISTORY');
      expect(best.confidence).toBe('EXACT_FALLBACK');
      expect(best.scoreBasisPoints).toBeGreaterThan(0);
      expect(best.evidenceHash).toBeTruthy();
    });

    it('generates weak fallback proposal for DIRECTION_DEFAULT when only direction matches', () => {
      const target = makeTarget({
        counterparty: 'Totally Unknown Vendor',
        counterpartyIban: 'NL00XYZZ9999999999',
        description: 'Completely new payment',
        paymentPurpose: 'Unknown',
      });
      const history = [
        makeHistory('hist-1', ['project-1', 'type-1', 'category-1'], {
          counterparty: 'Something Else',
          counterpartyIban: 'NL11BANK1111111111',
          description: 'Entirely different transaction',
          paymentPurpose: 'Unrelated',
        }),
      ];

      const ranked = rankHistorySuggestions(target, history);
      expect(ranked.length).toBeGreaterThanOrEqual(1);
      const best = ranked[0]!;
      expect(best.projectId).toBe('project-1');
      expect(best.transactionTypeId).toBe('type-1');
      expect(best.categoryId).toBe('category-1');
      expect(best.matcher).toBe('DIRECTION_DEFAULT');
      expect(best.confidence).toBe('DEFAULT');
    });
  });

  describe('exact and weak compatible matches prefill all 3 with lower confidence for weak fallback', () => {
    it('exact match has high confidence and score', () => {
      const target = makeTarget();
      const history = [makeHistory('hist-1', ['project-1', 'type-1', 'category-1'])];
      const ranked = rankHistorySuggestions(target, history);
      const best = ranked[0]!;
      expect(best.confidence).toBe('EXACT_FALLBACK');
      expect(best.scoreBasisPoints).toBeGreaterThan(7000);
    });

    it('weak fallback has DEFAULT confidence and lower score', () => {
      const target = makeTarget({
        counterparty: 'Unknown',
        counterpartyIban: 'NL00DIFF0000000000',
        description: 'Something new',
        paymentPurpose: null,
      });
      const history = [
        makeHistory('hist-1', ['project-1', 'type-1', 'category-1'], {
          counterparty: 'Other vendor',
          counterpartyIban: 'NL00OTHER000000000',
          description: 'Other transaction',
          paymentPurpose: null,
        }),
      ];
      const ranked = rankHistorySuggestions(target, history);
      const best = ranked[0]!;
      expect(best.confidence).toBe('DEFAULT');
      expect(best.scoreBasisPoints).toBeLessThan(3000);
    });
  });

  describe('wrong-direction history cannot select incompatible Type', () => {
    it('excludes credit-only history for a debit target', () => {
      const target = makeTarget({ direction: 'debit' });
      const creditHistory = [
        makeHistory('hist-1', ['project-1', 'type-1', 'category-1'], {
          direction: 'credit',
        }),
      ];
      const ranked = rankHistorySuggestions(target, creditHistory);
      expect(ranked.length).toBe(0);
    });

    it('excludes debit-only history for a credit target', () => {
      const target = makeTarget({ direction: 'credit' });
      const debitHistory = [
        makeHistory('hist-1', ['project-1', 'type-1', 'category-1'], {
          direction: 'debit',
        }),
      ];
      const ranked = rankHistorySuggestions(target, debitHistory);
      expect(ranked.length).toBe(0);
    });
  });

  describe('suggestions never create bookings, review decisions, or mutate bank facts', () => {
    it('ranked suggestion metadata explicitly declares no side effects in evidence', () => {
      const target = makeTarget();
      const history = [makeHistory('hist-1', ['project-1', 'type-1', 'category-1'])];
      const ranked = rankHistorySuggestions(target, history);
      const best = ranked[0]!;
      expect(best.evidence.safeguards.createsTransactionBooking).toBe(false);
      expect(best.evidence.safeguards.requiresAdministratorApproval).toBe(true);
    });
  });

  describe('review queue selects OWNER_HISTORY_V2', () => {
    it('selects owner-history-v2 suggestion over legacy', () => {
      const ownerV2 = makeAlternative({
        suggestionId: 'owner-v2-1',
        producerKey: OWNER_HISTORY_PRODUCER_KEY,
        producerVersion: OWNER_HISTORY_PRODUCER_VERSION,
        scoreBasisPoints: 7500,
      });
      const legacy = makeAlternative({
        suggestionId: 'legacy-1',
        producerKey: null,
        producerVersion: null,
        scoreBasisPoints: 9000,
      });
      const best = selectBestAvailableReviewSuggestion([ownerV2, legacy]);
      expect(best?.suggestionId).toBe('owner-v2-1');
    });

    it('selectReviewPrefill returns OWNER_HISTORY_V2 source', () => {
      const ownerV2 = makeAlternative({
        producerKey: OWNER_HISTORY_PRODUCER_KEY,
        producerVersion: OWNER_HISTORY_PRODUCER_VERSION,
      });
      const result = selectReviewPrefill({
        authoritativeTransaction: {
          projectId: null,
          projectCode: null,
          projectLabel: null,
          transactionTypeId: null,
          transactionTypeLabel: null,
          categoryId: null,
          categoryLabel: null,
        },
        existingBooking: null,
        alternatives: [ownerV2],
      });
      expect(result.prefill.source).toBe('OWNER_HISTORY_V2');
      expect(result.proposed?.complete).toBe(true);
      expect(result.prefill.scoreBasisPoints).toBe(8500);
    });
  });

  describe('reliability uses actual scoreBasisPoints', () => {
    it('displays actual score from prefill metadata', () => {
      const item = makeReviewItem({
        prefill: {
          source: 'OWNER_HISTORY_V2',
          complete: true,
          weakFallback: false,
          scoreBasisPoints: 7200,
          confidence: 'EXACT_FALLBACK',
          matcher: 'NORMALIZED_HISTORY',
        },
        deterministicStatus: 'finalized',
      });
      const reliability = getReviewReliability(item);
      expect(reliability.score).toBe(72);
      expect(reliability.band).toBe('green');
    });

    it('falls back to band default when no scoreBasisPoints available', () => {
      const item = makeReviewItem({
        prefill: {
          source: 'NONE',
          complete: false,
          weakFallback: false,
          scoreBasisPoints: null,
          confidence: null,
          matcher: null,
        },
        deterministicStatus: 'unmatched',
        alternatives: [],
      });
      const reliability = getReviewReliability(item);
      expect(reliability.score).toBeNull();
      expect(reliability.band).toBe('gray');
    });

    it('uses actual score even for amber band', () => {
      const item = makeReviewItem({
        prefill: {
          source: 'OWNER_HISTORY_V2',
          complete: true,
          weakFallback: false,
          scoreBasisPoints: 4500,
          confidence: 'OVERALL',
          matcher: 'BEST_HISTORY',
        },
        alternatives: [makeAlternative({ confidence: 'OVERALL' })],
      });
      const reliability = getReviewReliability(item);
      expect(reliability.score).toBe(45);
      expect(reliability.band).toBe('amber');
    });
  });

  describe('responsive page has no fixed min-width table dependency', () => {
    it('page source does not contain min-w-[1100px] or overflow-x-auto grid header', () => {
      const fs = require('node:fs');
      const path = require('node:path');
      const pageSource = fs.readFileSync(
        path.join(process.cwd(), 'src/ui/FinanceReviewPage.tsx'),
        'utf8',
      );
      expect(pageSource).not.toContain('min-w-[1100px]');
      expect(pageSource).not.toContain('overflow-x-auto');
      expect(pageSource).not.toContain('xl:grid-cols-[110px_minmax');
    });
  });
});
