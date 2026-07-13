import { describe, expect, it } from 'vitest';
import {
  rankHistorySuggestions,
  type ApprovedHistoryBooking,
  type HistorySuggestionFacts,
} from '../../server/services/historySuggestionService';

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
});
