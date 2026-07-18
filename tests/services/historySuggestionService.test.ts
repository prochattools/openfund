import { describe, expect, it } from 'vitest';
import {
  rankHistorySuggestions,
  type ApprovedHistoryBooking,
  type HistorySuggestionFacts,
} from '../../server/services/historySuggestionService';
import {
  MERCHANT_RETRIEVAL_ANCHOR_VERSION,
  type MerchantRetrievalAnchor,
} from '../../server/services/merchantRetrievalAnchor';

const target = (overrides: Partial<HistorySuggestionFacts> = {}): HistorySuggestionFacts => ({
  transactionId: 'target-1',
  date: new Date('2026-06-15T00:00:00.000Z'),
  accountId: 'account-1',
  direction: 'credit',
  amountMinor: 5000n,
  counterparty: 'Stichting Alpha',
  counterpartyIban: 'NL11BANK0123456789',
  description: 'Maandelijkse gift juni',
  paymentPurpose: 'Gift project YA',
  ...overrides,
});

const history = (
  id: string,
  triple: [string, string, string],
  overrides: Partial<ApprovedHistoryBooking> = {},
): ApprovedHistoryBooking => ({
  ...target({
    transactionId: id,
    date: new Date('2025-06-15T00:00:00.000Z'),
  }),
  bookingId: `booking-${id}`,
  projectId: triple[0],
  transactionTypeId: triple[1],
  categoryId: triple[2],
  bookingEvidenceHash: `hash-${id}`,
  ...overrides,
});

const readyAnchor = (overrides: Partial<MerchantRetrievalAnchor> = {}): MerchantRetrievalAnchor => ({
  workspaceId: 'workspace-1',
  transactionId: 'target-1',
  merchantId: 'merchant-1',
  anchorVersion: MERCHANT_RETRIEVAL_ANCHOR_VERSION,
  resolutionVersion: 'merchant-alias-resolution-v1',
  evidenceHash: 'anchor-evidence-1',
  sourceState: 'RESOLVED',
  supportingEvidence: [],
  conflictingEvidence: [],
  stale: false,
  expired: false,
  readiness: 'READY',
  ...overrides,
});

describe('history suggestion service', () => {
  it('ranks the strongest complete historical triple first with stable evidence', () => {
    const records = [
      history('exact-1', ['project-ya', 'type-gift-in', 'category-gifts']),
      history('exact-2', ['project-ya', 'type-gift-in', 'category-gifts'], {
        date: new Date('2024-06-15T00:00:00.000Z'),
      }),
      history('other', ['project-fr', 'type-other-in', 'category-other'], {
        counterparty: 'Andere partij',
        counterpartyIban: 'NL22BANK9876543210',
        description: 'Andere ontvangst',
        paymentPurpose: 'Anders',
        amountMinor: 7000n,
      }),
    ];

    const first = rankHistorySuggestions(target(), records);
    const second = rankHistorySuggestions(target(), records);

    expect(first).toEqual(second);
    expect(first).toHaveLength(2);
    expect(first[0]).toMatchObject({
      rank: 1,
      projectId: 'project-ya',
      transactionTypeId: 'type-gift-in',
      categoryId: 'category-gifts',
      matcher: 'NORMALIZED_HISTORY',
      confidence: 'EXACT_FALLBACK',
    });
    expect(first[0]!.scoreBasisPoints).toBeGreaterThan(first[1]!.scoreBasisPoints);
    expect(first[0]!.evidence).toMatchObject({
      targetTransactionId: 'target-1',
      matchedHistoricalTransactionIds: ['exact-1', 'exact-2'],
      safeguards: {
        completeTriple: true,
        directionCompatible: true,
        createsTransactionBooking: false,
        requiresAdministratorApproval: true,
      },
    });
    expect(first[0]!.evidenceHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('rejects direction-incompatible history completely', () => {
    const result = rankHistorySuggestions(target(), [
      history('debit-history', ['project-ya', 'type-cost', 'category-cost'], {
        direction: 'debit',
      }),
    ]);

    expect(result).toEqual([]);
  });

  it('limits candidates to three complete triples with deterministic tie-breaking', () => {
    const records = [
      history('a', ['project-a', 'type-a', 'category-a'], { counterparty: null, counterpartyIban: null }),
      history('b', ['project-b', 'type-b', 'category-b'], { counterparty: null, counterpartyIban: null }),
      history('c', ['project-c', 'type-c', 'category-c'], { counterparty: null, counterpartyIban: null }),
      history('d', ['project-d', 'type-d', 'category-d'], { counterparty: null, counterpartyIban: null }),
    ];

    const result = rankHistorySuggestions(target({ counterparty: null, counterpartyIban: null }), records);

    expect(result).toHaveLength(3);
    expect(result.map((candidate) => candidate.rank)).toEqual([1, 2, 3]);
    expect(result.every((candidate) => Boolean(
      candidate.projectId && candidate.transactionTypeId && candidate.categoryId,
    ))).toBe(true);
  });

  it('marks weak direction-only history as low-confidence default', () => {
    const result = rankHistorySuggestions(target({
      accountId: 'account-new',
      counterparty: 'Nieuwe partij',
      counterpartyIban: null,
      description: 'Onbekende ontvangst',
      paymentPurpose: null,
      amountMinor: 9999n,
      date: new Date('2026-11-01T00:00:00.000Z'),
    }), [
      history('weak', ['project-ya', 'type-gift-in', 'category-gifts'], {
        accountId: 'account-old',
        counterparty: 'Historische partij',
        counterpartyIban: null,
        description: 'Volledig andere tekst',
        paymentPurpose: null,
        amountMinor: 100n,
        date: new Date('2024-01-01T00:00:00.000Z'),
      }),
    ]);

    expect(result[0]).toMatchObject({
      matcher: 'DIRECTION_DEFAULT',
      confidence: 'DEFAULT',
    });
    expect(result[0]!.evidence.reason).toContain('Lage-zekerheidssuggestie');
  });

  it('does not use future-dated bookings as historical evidence', () => {
    const result = rankHistorySuggestions(target(), [
      history('past', ['project-past', 'type-past', 'category-past']),
      history('future', ['project-future', 'type-future', 'category-future'], {
        date: new Date('2027-01-01T00:00:00.000Z'),
      }),
    ]);

    expect(result).toHaveLength(1);
    expect(result[0]!.projectId).toBe('project-past');
    expect(result[0]!.evidence.matchedHistoricalTransactionIds).toEqual(['past']);
  });

  it('does not use the target transaction itself as historical evidence', () => {
    const result = rankHistorySuggestions(target(), [
      history('target-1', ['project-self', 'type-self', 'category-self']),
      history('other', ['project-other', 'type-other', 'category-other']),
    ]);

    expect(result).toHaveLength(1);
    expect(result[0]!.projectId).toBe('project-other');
    expect(result[0]!.evidence.matchedHistoricalTransactionIds).toEqual(['other']);
  });

  it('boosts only the matching confirmed-booking merchant candidate', () => {
    const records = [
      history('merchant-match', ['project-b', 'type-b', 'category-b'], {
        merchantId: 'merchant-1',
        counterparty: 'Andere partij',
        counterpartyIban: null,
        description: 'Andere tekst',
        paymentPurpose: null,
        amountMinor: 7000n,
      }),
      history('non-match', ['project-a', 'type-a', 'category-a'], {
        merchantId: 'merchant-2',
        counterparty: 'Andere partij',
        counterpartyIban: null,
        description: 'Andere tekst',
        paymentPurpose: null,
        amountMinor: 7000n,
      }),
    ];
    const withoutAnchor = rankHistorySuggestions(target(), records);
    const withAnchor = rankHistorySuggestions(target(), records, {
      workspaceId: 'workspace-1',
      merchantAnchor: readyAnchor(),
    });

    expect(withoutAnchor.map((item) => item.projectId)).toEqual(['project-a', 'project-b']);
    expect(withAnchor[0]).toMatchObject({ projectId: 'project-b' });
    expect(withAnchor[0]!.scoreBasisPoints - withoutAnchor[1]!.scoreBasisPoints).toBe(1200);
    expect(withAnchor[1]!.scoreBasisPoints).toBe(withoutAnchor[0]!.scoreBasisPoints);
    expect(withAnchor[0]!.evidence.features).toMatchObject({
      merchantAnchorMatches: 1,
      maximumMerchantAnchorContributionBasisPoints: 1200,
    });
    expect(withAnchor[0]!.evidence.merchantAnchor).toMatchObject({
      state: 'READY',
      anchorVersion: MERCHANT_RETRIEVAL_ANCHOR_VERSION,
      resolutionVersion: 'merchant-alias-resolution-v1',
      evidenceHash: 'anchor-evidence-1',
    });
  });

  it('gives no merchant boost to non-matching merchant history', () => {
    const records = [
      history('only', ['project-a', 'type-a', 'category-a'], { merchantId: 'merchant-2' }),
    ];
    const baseline = rankHistorySuggestions(target(), records);
    const anchored = rankHistorySuggestions(target(), records, {
      workspaceId: 'workspace-1',
      merchantAnchor: readyAnchor(),
    });

    expect(anchored[0]!.scoreBasisPoints).toBe(baseline[0]!.scoreBasisPoints);
    expect(anchored[0]!.evidence.features.merchantAnchorMatches).toBe(0);
  });

  it('preserves prior scoring for missing, disabled, unresolved, conflicted, stale, and cross-workspace anchors', () => {
    const records = [
      history('a', ['project-a', 'type-a', 'category-a'], { merchantId: 'merchant-1' }),
      history('b', ['project-b', 'type-b', 'category-b'], { merchantId: 'merchant-2' }),
    ];
    const baseline = rankHistorySuggestions(target(), records);
    const variants = [
      {},
      { workspaceId: 'workspace-1', merchantAnchor: readyAnchor(), merchantAnchorEnabled: false },
      { workspaceId: 'workspace-1', merchantAnchor: readyAnchor({ merchantId: null, sourceState: 'UNRESOLVED' }) },
      { workspaceId: 'workspace-1', merchantAnchor: readyAnchor({ sourceState: 'CONFLICTED', conflictingEvidence: [{
        aliasId: 'alias-x', merchantId: 'merchant-2', signalType: 'IBAN', fingerprintHash: 'fingerprint-x', aliasStatus: 'TRUSTED', precedence: 10, evidenceHash: 'evidence-x',
      }] }) },
      { workspaceId: 'workspace-1', merchantAnchor: readyAnchor({ stale: true }) },
      { workspaceId: 'workspace-1', merchantAnchor: readyAnchor({ workspaceId: 'workspace-2' }) },
    ];

    for (const options of variants) {
      const result = rankHistorySuggestions(target(), records, options);
      expect(result.map((item) => ({
        projectId: item.projectId,
        scoreBasisPoints: item.scoreBasisPoints,
        matcher: item.matcher,
        confidence: item.confidence,
        reason: item.evidence.reason,
        matched: item.evidence.matchedHistoricalTransactionIds,
      }))).toEqual(baseline.map((item) => ({
        projectId: item.projectId,
        scoreBasisPoints: item.scoreBasisPoints,
        matcher: item.matcher,
        confidence: item.confidence,
        reason: item.evidence.reason,
        matched: item.evidence.matchedHistoricalTransactionIds,
      })));
    }
  });

  it('does not let merchant anchors bypass direction or future-date eligibility', () => {
    const result = rankHistorySuggestions(target(), [
      history('debit', ['project-debit', 'type-debit', 'category-debit'], {
        direction: 'debit',
        merchantId: 'merchant-1',
      }),
      history('future', ['project-future', 'type-future', 'category-future'], {
        date: new Date('2027-01-01T00:00:00.000Z'),
        merchantId: 'merchant-1',
      }),
      history('valid', ['project-valid', 'type-valid', 'category-valid'], {
        merchantId: 'merchant-2',
      }),
    ], {
      workspaceId: 'workspace-1',
      merchantAnchor: readyAnchor(),
    });

    expect(result).toHaveLength(1);
    expect(result[0]!.projectId).toBe('project-valid');
    expect(result[0]!.evidence.matchedHistoricalTransactionIds).toEqual(['valid']);
    expect(result[0]!.evidence.features.merchantAnchorMatches).toBe(0);
  });

  it('preserves supporting and conflicting anchor evidence provenance without financial side effects', () => {
    const anchor = readyAnchor({
      supportingEvidence: [{
        aliasId: 'alias-support', merchantId: 'merchant-1', signalType: 'IBAN', fingerprintHash: 'fingerprint-support', aliasStatus: 'TRUSTED', precedence: 10, evidenceHash: 'support-hash',
      }],
      conflictingEvidence: [],
    });
    const result = rankHistorySuggestions(target(), [
      history('match', ['project-a', 'type-a', 'category-a'], { merchantId: 'merchant-1' }),
    ], {
      workspaceId: 'workspace-1',
      merchantAnchor: anchor,
    });

    expect(result[0]!.evidence.merchantAnchor).toMatchObject({
      supportingEvidenceCount: 1,
      conflictingEvidenceCount: 0,
    });
    expect(result[0]!.evidence.safeguards).toEqual({
      completeTriple: true,
      directionCompatible: true,
      createsTransactionBooking: false,
      requiresAdministratorApproval: true,
    });
  });
});
