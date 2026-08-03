import { describe, expect, it } from 'vitest';
import { mapApiTransaction } from '../../src/helpers/api-transaction-mapper';
import { mergeLedgerWithReview } from '../../src/helpers/review-response-mapper';
import type { EvidenceRichReviewResponse } from '../../src/libs/api';

const response: EvidenceRichReviewResponse = {
  transactions: [{
    id: 'review-1',
    transactionId: 'tx-1',
    previewFingerprint: null,
    displayDate: '01-06-2026',
    rawIngDate: '20260601',
    counterparty: 'Stichting Alpha',
    counterpartyIban: 'NL11BANK0123456789',
    accountIdentifier: 'NL89INGB0006369960',
    accountName: 'ING',
    amount: 50,
    amountMinor: '5000',
    currency: 'EUR',
    direction: 'credit',
    directionLabel: 'Inkomst',
    description: 'Maandelijkse gift',
    paymentPurpose: 'Gift YA',
    source: 'import.csv',
    deterministicStatus: 'review_suggested',
    statusLabel: 'Suggestie',
    reason: 'Historische overeenkomst',
    proposed: {
      projectId: 'project-1',
      projectCode: 'YA',
      projectLabel: 'Yeshua Academy',
      transactionTypeId: 'type-1',
      transactionTypeLabel: 'Schenking in',
      categoryId: 'category-gifts',
      categoryLabel: 'Giften',
      complete: true,
    },
    prefill: {
      source: 'LEGACY_HISTORY_FALLBACK',
      complete: true,
      weakFallback: true,
      scoreBasisPoints: null,
      confidence: 'FUZZY',
      matcher: 'FUZZY_HISTORY',
    },
    alternatives: [{
      suggestionId: 'suggestion-1',
      rank: 1,
      matcher: 'FUZZY_HISTORY',
      confidence: 'FUZZY',
      confidenceLabel: 'Waarschijnlijk',
      reason: 'Zelfde tegenpartij en omschrijving',
      matchedRuleIds: [],
      historicalRecordIds: ['history-1'],
      evidenceHashes: ['hash-1'],
      evidenceHash: 'suggestion-hash-1',
      producerKey: null,
      producerVersion: null,
      scoreBasisPoints: null,
      projectId: 'project-1',
      projectCode: 'YA',
      projectLabel: 'Yeshua Academy',
      transactionTypeId: 'type-1',
      transactionTypeLabel: 'Schenking in',
      categoryId: 'category-gifts',
      categoryLabel: 'Giften',
      complete: true,
      eligible: true,
    }],
    evidence: {
      matchedRuleIds: [],
      historicalRecordIds: ['history-1'],
      evidenceHashes: ['hash-1'],
      importFingerprint: 'fingerprint-1',
      exactReplayKey: null,
      reason: 'Historische overeenkomst',
    },
    safeDeterministicCandidate: false,
    requiresAdministratorApproval: true,
    sideEffects: {
      createsTransactionBooking: false,
      closesPeriod: false,
    },
  }],
  categories: [
    { id: 'category-gifts', name: 'Giften' },
  ],
  projects: [{ id: 'project-1', code: 'YA', name: 'Yeshua Academy' }],
  transactionTypes: [{ id: 'type-1', literalName: 'Schenking in', direction: 'credit' }],
  pagination: {
    page: 1,
    pageSize: 25,
    totalItems: 1,
    totalPages: 1,
    hasPreviousPage: false,
    hasNextPage: false,
  },
  message: 'Review geladen',
};

describe('review response mapper', () => {
  it('merges complete rank-one proposals without setting final booking fields', () => {
    const ledger = [mapApiTransaction({
      id: 'tx-1',
      date: '2026-06-01T00:00:00.000Z',
      description: 'Maandelijkse gift',
      amount: 50,
      direction: 'credit',
      source: 'import.csv',
      categoryId: null,
      classificationSource: 'none',
    })];

    const result = mergeLedgerWithReview(ledger, response);
    const transaction = result.transactions[0]!;

    expect(transaction).toMatchObject({
      id: 'tx-1',
      categoryId: null,
      categoryName: null,
      mainCategoryId: null,
      mainCategoryName: null,
      needsManualCategory: true,
      autoCategorized: false,
      suggestedMainCategoryName: null,
      suggestedSubCategoryName: 'Giften',
      reviewProposal: {
        projectId: 'project-1',
        transactionTypeId: 'type-1',
        categoryId: 'category-gifts',
        complete: true,
      },
      reviewConfidence: 'FUZZY',
      reviewConfidenceLabel: 'Waarschijnlijk',
      reviewReason: 'Zelfde tegenpartij en omschrijving',
      suggestionConfidence: 'fuzzy',
    });
    expect(transaction.reviewAlternatives).toHaveLength(1);
    expect(result.projects).toEqual(response.projects);
    expect(result.transactionTypes).toEqual(response.transactionTypes);
  });

  it('leaves ledger rows unchanged when no review response is available', () => {
    const ledger = [mapApiTransaction({
      id: 'tx-2',
      date: '2026-06-02T00:00:00.000Z',
      description: 'Bankkosten',
      amount: 5,
      direction: 'debit',
      source: 'import.csv',
      categoryId: null,
      classificationSource: 'none',
    })];

    const result = mergeLedgerWithReview(ledger, null);

    expect(result.transactions).toEqual(ledger);
    expect(result.categories).toEqual([]);
    expect(result.projects).toEqual([]);
    expect(result.transactionTypes).toEqual([]);
  });
});
