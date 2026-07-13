import { describe, expect, it } from 'vitest';
import {
  evaluateHistorySuggestions,
} from '../../server/services/historySuggestionEvaluationService';
import type { ApprovedHistoryBooking } from '../../server/services/historySuggestionService';

const booking = (
  transactionId: string,
  date: string,
  triple: [string, string, string],
  overrides: Partial<ApprovedHistoryBooking> = {},
): ApprovedHistoryBooking => ({
  transactionId,
  date: new Date(date),
  accountId: 'account-1',
  direction: 'credit',
  amountMinor: 5000n,
  counterparty: 'Stichting Alpha',
  counterpartyIban: 'NL11BANK0123456789',
  description: 'Maandelijkse gift',
  paymentPurpose: 'Gift YA',
  bookingId: `booking-${transactionId}`,
  projectId: triple[0],
  transactionTypeId: triple[1],
  categoryId: triple[2],
  bookingEvidenceHash: `hash-${transactionId}`,
  ...overrides,
});

describe('history suggestion evaluation service', () => {
  it('evaluates chronological history without future leakage', () => {
    const samples = [
      booking('tx-1', '2024-01-01T00:00:00.000Z', ['project-ya', 'type-gift', 'category-gifts']),
      booking('tx-2', '2025-01-01T00:00:00.000Z', ['project-ya', 'type-gift', 'category-gifts']),
      booking('tx-3', '2026-01-01T00:00:00.000Z', ['project-ya', 'type-gift', 'category-gifts']),
    ];

    const result = evaluateHistorySuggestions(samples, { mode: 'chronological' });

    expect(result).toMatchObject({
      mode: 'chronological',
      sampleCount: 3,
      coveredCount: 2,
      uncoveredCount: 1,
      coverageBasisPoints: 6667,
      topOneCorrectCount: 2,
      topOneAccuracyBasisPoints: 10000,
      topThreeCorrectCount: 2,
      topThreeAccuracyBasisPoints: 10000,
      safeguards: {
        futureEvidenceExcluded: true,
        createsCategorizationSuggestion: false,
        createsTransactionBooking: false,
        mutatesBankFacts: false,
      },
    });
    expect(result.confidenceCalibration.EXACT_FALLBACK).toEqual({
      predictions: 2,
      correctTopOne: 2,
      accuracyBasisPoints: 10000,
    });
  });

  it('allows same-day leave-one-out peers while still excluding future dates', () => {
    const samples = [
      booking('tx-a', '2025-01-01T00:00:00.000Z', ['project-ya', 'type-gift', 'category-gifts']),
      booking('tx-b', '2025-01-01T00:00:00.000Z', ['project-ya', 'type-gift', 'category-gifts']),
      booking('tx-future', '2026-01-01T00:00:00.000Z', ['project-future', 'type-future', 'category-future'], {
        counterparty: 'Future only',
        counterpartyIban: 'NL99BANK9999999999',
        description: 'Future evidence',
        paymentPurpose: 'Future',
      }),
    ];

    const result = evaluateHistorySuggestions(samples, { mode: 'leave-one-out' });

    expect(result.mode).toBe('leave-one-out');
    expect(result.coveredCount).toBe(3);
    expect(result.uncoveredCount).toBe(0);
    expect(result.topOneCorrectCount).toBe(2);
    expect(result.matcherBreakdown.NORMALIZED_HISTORY).toEqual({
      predictions: 2,
      correctTopOne: 2,
      accuracyBasisPoints: 10000,
    });
  });

  it('reports measured mistakes rather than inflating confidence', () => {
    const samples = [
      booking('tx-1', '2024-01-01T00:00:00.000Z', ['project-a', 'type-a', 'category-a']),
      booking('tx-2', '2025-01-01T00:00:00.000Z', ['project-b', 'type-b', 'category-b']),
    ];

    const result = evaluateHistorySuggestions(samples, { mode: 'chronological' });

    expect(result.coveredCount).toBe(1);
    expect(result.topOneCorrectCount).toBe(0);
    expect(result.topOneAccuracyBasisPoints).toBe(0);
    expect(result.topThreeCorrectCount).toBe(0);
    expect(Object.values(result.confidenceCalibration)).toEqual([
      expect.objectContaining({ predictions: 1, correctTopOne: 0, accuracyBasisPoints: 0 }),
    ]);
  });

  it('is deterministic for a fixed algorithm version and sample set', () => {
    const samples = [
      booking('tx-1', '2024-01-01T00:00:00.000Z', ['project-a', 'type-a', 'category-a']),
      booking('tx-2', '2025-01-01T00:00:00.000Z', ['project-a', 'type-a', 'category-a']),
    ];

    const first = evaluateHistorySuggestions(samples, {
      mode: 'chronological',
      algorithmVersion: 'history-v1-test',
    });
    const second = evaluateHistorySuggestions(samples, {
      mode: 'chronological',
      algorithmVersion: 'history-v1-test',
    });

    expect(first).toEqual(second);
    expect(first.algorithmVersion).toBe('history-v1-test');
  });
});
