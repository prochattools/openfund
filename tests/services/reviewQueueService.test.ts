import { describe, expect, it } from 'vitest';
import {
  buildEvidenceRichReviewQueue,
  clearReviewQueue,
} from '../../server/services/reviewQueueService';
import { BULK_CONFIRMATION_DISABLED_MESSAGE } from '../../server/services/reviewDecisionService';

const makeTransaction = (overrides: Record<string, any> = {}) => ({
  id: 'tx-1',
  date: new Date('2026-05-02T00:00:00.000Z'),
  description: 'Gift Alpha',
  amountMinor: 5000n,
  currency: 'EUR',
  direction: 'credit',
  source: 'ING CSV',
  counterparty: 'Donor A',
  reference: 'Gift voor mei',
  importFingerprint: 'fingerprint-1',
  rawRow: {
    Date: '2026-05-02',
    Account: 'NL89INGB0006369960',
    Counterparty: 'Donor A',
    Notifications: 'Gift voor mei',
    rawRow: 'must-not-leak',
    sourceFileContent: 'must-not-leak',
  },
  categoryId: null,
  projectId: null,
  transactionTypeId: null,
  classificationSource: 'none',
  classificationRuleId: null,
  account: {
    id: 'account-1',
    identifier: 'NL89INGB0006369960',
    name: 'ING hoofdrekening',
  },
  project: null,
  transactionType: null,
  category: null,
  classificationRule: null,
  transactionBooking: null,
  categorizationSuggestions: [],
  ...overrides,
});

const completeSuggestion = (overrides: Record<string, any> = {}) => ({
  id: 'suggestion-1',
  projectId: 'project-1',
  transactionTypeId: 'type-1',
  categoryId: 'cat-1',
  confidence: 'EXACT_FALLBACK',
  matcher: 'NORMALIZED_HISTORY',
  rank: 1,
  scoreBasisPoints: 10000,
  evidence: {
    matchedRuleIds: ['rule-1'],
    historicalRecordIds: ['history-1'],
    historicalEvidenceHashes: ['history-hash-1'],
    reason: 'Exact historische replay.',
  },
  evidenceHash: 'suggestion-hash-1',
  project: {
    id: 'project-1',
    code: 'YA',
    name: 'Yeshua Academy',
  },
  transactionType: {
    id: 'type-1',
    literalName: 'Schenking in',
  },
  category: {
    id: 'cat-1',
    name: 'Giften',
  },
  ...overrides,
});

describe('review queue service', () => {
  it('rejects bulk review clearing without mutating transactions', async () => {
    const calls: any[] = [];
    const fakeTx = {
      transaction: {
        updateMany: async (args: any) => {
          calls.push(args);
          throw new Error('updateMany should not be called');
        },
      },
    } as any;

    await expect(clearReviewQueue(fakeTx, 'user-1')).rejects.toMatchObject({
      message: BULK_CONFIRMATION_DISABLED_MESSAGE,
      statusCode: 409,
    });

    expect(calls).toHaveLength(0);
  });

  it('builds evidence-rich Dutch review items without leaking raw source rows or booking anything', () => {
    const queue = buildEvidenceRichReviewQueue([
      makeTransaction({
        id: 'tx-late',
        date: new Date('2026-05-03T00:00:00.000Z'),
      }),
      makeTransaction({
        id: 'tx-finalized',
        date: new Date('2026-05-01T00:00:00.000Z'),
        projectId: 'project-1',
        transactionTypeId: 'type-1',
        categoryId: 'cat-1',
        classificationSource: 'rule',
        classificationRuleId: 'rule-1',
        project: { id: 'project-1', code: 'YA', name: 'Yeshua Academy' },
        transactionType: { id: 'type-1', literalName: 'Schenking in' },
        category: { id: 'cat-1', name: 'Giften' },
      }),
      makeTransaction({
        id: 'tx-review',
        date: new Date('2026-05-02T00:00:00.000Z'),
        categorizationSuggestions: [completeSuggestion()],
      }),
    ] as any, {
      categories: [],
      projects: [],
      transactionTypes: [],
    });

    expect(queue.message).toBe('Beoordelingsrij geladen. Er zijn geen boekingen of periodeafsluitingen gemaakt.');
    expect(queue.transactions.map((item) => item.transactionId)).toEqual(['tx-late', 'tx-finalized', 'tx-review']);

    const finalized = queue.transactions.find((item) => item.transactionId === 'tx-finalized')!;
    expect(finalized).toMatchObject({
      deterministicStatus: 'finalized',
      statusLabel: 'Veilige deterministische kandidaat',
      rawIngDate: '2026-05-02',
      counterparty: 'Donor A',
      counterpartyIban: 'Donor A',
      accountIdentifier: 'NL89INGB0006369960',
      amount: 50,
      directionLabel: 'Bijschrijving',
      paymentPurpose: 'Gift voor mei',
      proposed: {
        projectId: 'project-1',
        projectCode: 'YA',
        projectLabel: 'Yeshua Academy',
        transactionTypeId: 'type-1',
        transactionTypeLabel: 'Schenking in',
        categoryId: 'cat-1',
        categoryLabel: 'Giften',
        complete: true,
      },
      safeDeterministicCandidate: true,
      requiresAdministratorApproval: true,
      sideEffects: {
        createsTransactionBooking: false,
        closesPeriod: false,
      },
    });

    const review = queue.transactions.find((item) => item.transactionId === 'tx-review')!;
    expect(review).toMatchObject({
      deterministicStatus: 'review_suggested',
      proposed: {
        projectId: 'project-1',
        projectCode: 'YA',
        projectLabel: 'Yeshua Academy',
        transactionTypeId: 'type-1',
        transactionTypeLabel: 'Schenking in',
        categoryId: 'cat-1',
        categoryLabel: 'Giften',
        complete: true,
      },
      safeDeterministicCandidate: false,
      requiresAdministratorApproval: true,
      sideEffects: {
        createsTransactionBooking: false,
        closesPeriod: false,
      },
      alternatives: [
        expect.objectContaining({
          suggestionId: 'suggestion-1',
          projectLabel: 'Yeshua Academy',
          transactionTypeLabel: 'Schenking in',
          categoryLabel: 'Giften',
          matchedRuleIds: ['rule-1'],
          historicalRecordIds: ['history-1'],
          evidenceHashes: ['history-hash-1', 'suggestion-hash-1'],
          reason: 'Exact historische replay.',
        }),
      ],
    });

    const serialized = JSON.stringify(queue);
    expect(serialized).not.toContain('sourceFileContent');
    expect(serialized).not.toContain('must-not-leak');
    expect(serialized).not.toContain('retainedCsvBytes');
  });

  it('marks conflicting alternatives and incomplete candidates for manual review', () => {
    const queue = buildEvidenceRichReviewQueue([
      makeTransaction({
        id: 'tx-conflict',
        categorizationSuggestions: [
          completeSuggestion({ id: 'suggestion-1', projectId: 'project-1' }),
          completeSuggestion({
            id: 'suggestion-2',
            projectId: 'project-2',
            evidenceHash: 'suggestion-hash-2',
            evidence: { historicalRecordIds: ['history-2'] },
            project: { id: 'project-2', code: 'FTK', name: 'For the King' },
          }),
        ],
      }),
      makeTransaction({
        id: 'tx-incomplete',
        categorizationSuggestions: [
          completeSuggestion({
            id: 'suggestion-partial',
            transactionTypeId: null,
            transactionType: null,
            evidenceHash: 'partial-hash',
          }),
        ],
      }),
    ] as any, {
      categories: [],
      projects: [],
      transactionTypes: [],
    });

    expect(queue.transactions.find((item) => item.transactionId === 'tx-conflict')).toMatchObject({
      deterministicStatus: 'conflict',
      reason: 'Er zijn meerdere complete alternatieven. Kies handmatig de juiste Klant, Type en Categorie.',
      sideEffects: {
        createsTransactionBooking: false,
        closesPeriod: false,
      },
    });
    expect(queue.transactions.find((item) => item.transactionId === 'tx-incomplete')).toMatchObject({
      deterministicStatus: 'review_suggested',
      alternatives: [
        expect.objectContaining({
          complete: false,
          transactionTypeId: null,
        }),
      ],
    });
  });

  it('filters before pagination and applies stable risk-first ordering with page clamping', () => {
    const conflictSuggestions = (projectId: string, categoryId: string) => [
      completeSuggestion({ id: `${projectId}-1`, projectId, categoryId }),
      completeSuggestion({
        id: `${projectId}-2`,
        projectId: `${projectId}-other`,
        categoryId,
        evidenceHash: `${projectId}-hash-2`,
        project: { id: `${projectId}-other`, code: 'ALT', name: 'Alternative' },
      }),
    ];
    const transactions = [
      makeTransaction({ id: 'red-high', amountMinor: 20000n, direction: 'debit', date: new Date('2026-05-03T00:00:00.000Z'), categorizationSuggestions: conflictSuggestions('project-red', 'cat-red') }),
      makeTransaction({ id: 'red-low', amountMinor: 10000n, direction: 'credit', date: new Date('2026-05-01T00:00:00.000Z'), categorizationSuggestions: conflictSuggestions('project-red', 'cat-red') }),
      makeTransaction({ id: 'gray-high', amountMinor: 30000n, direction: 'debit', date: new Date('2026-04-01T00:00:00.000Z') }),
      makeTransaction({ id: 'amber', amountMinor: 5000n, categorizationSuggestions: [completeSuggestion({ id: 'amber-suggestion', confidence: 'OVERALL', projectId: 'project-amber', categoryId: 'cat-amber', project: { id: 'project-amber', code: 'AMB', name: 'Amber' }, category: { id: 'cat-amber', name: 'Amber category' } })] }),
      makeTransaction({ id: 'green', amountMinor: 9000n, categorizationSuggestions: [completeSuggestion({ id: 'green-suggestion', projectId: 'project-green', categoryId: 'cat-green', project: { id: 'project-green', code: 'GRN', name: 'Green' }, category: { id: 'cat-green', name: 'Green category' } })] }),
    ] as any;
    const dimensions = { categories: [], projects: [], transactionTypes: [] };

    const first = buildEvidenceRichReviewQueue(transactions, dimensions, { page: 1, pageSize: 2, state: 'all' });
    expect(first.transactions.map((item) => item.transactionId)).toEqual(['red-high', 'red-low']);
    expect(first.pagination).toEqual({ page: 1, pageSize: 2, totalItems: 5, totalPages: 3, hasPreviousPage: false, hasNextPage: true });

    const middle = buildEvidenceRichReviewQueue(transactions, dimensions, { page: 2, pageSize: 2, state: 'all' });
    expect(middle.transactions.map((item) => item.transactionId)).toEqual(['gray-high', 'amber']);

    const final = buildEvidenceRichReviewQueue(transactions, dimensions, { page: 3, pageSize: 2, state: 'all' });
    expect(final.transactions.map((item) => item.transactionId)).toEqual(['green']);
    expect(final.pagination.hasNextPage).toBe(false);

    const clamped = buildEvidenceRichReviewQueue(transactions, dimensions, { page: 99, pageSize: 2, state: 'all' });
    expect(clamped.pagination.page).toBe(3);
    expect(clamped.transactions.map((item) => item.transactionId)).toEqual(['green']);

    expect(buildEvidenceRichReviewQueue(transactions, dimensions, { page: 1, pageSize: 25, confidence: 'red', state: 'all' }).transactions.map((item) => item.transactionId)).toEqual(['red-high', 'red-low']);
    expect(buildEvidenceRichReviewQueue(transactions, dimensions, { page: 1, pageSize: 25, direction: 'debit', state: 'all' }).transactions.map((item) => item.transactionId)).toEqual(['red-high', 'gray-high']);
    expect(buildEvidenceRichReviewQueue(transactions, dimensions, { page: 1, pageSize: 25, projectId: 'project-amber', state: 'all' }).transactions.map((item) => item.transactionId)).toEqual(['amber']);
    expect(buildEvidenceRichReviewQueue(transactions, dimensions, { page: 1, pageSize: 25, categoryId: 'cat-green', state: 'all' }).transactions.map((item) => item.transactionId)).toEqual(['green']);
    expect(buildEvidenceRichReviewQueue(transactions, dimensions, { page: 1, pageSize: 25, state: 'incomplete' }).transactions.map((item) => item.transactionId)).toEqual(['gray-high']);

    const empty = buildEvidenceRichReviewQueue(transactions, dimensions, { page: 5, pageSize: 25, projectId: 'missing', state: 'all' });
    expect(empty.transactions).toEqual([]);
    expect(empty.pagination).toEqual({ page: 1, pageSize: 25, totalItems: 0, totalPages: 1, hasPreviousPage: false, hasNextPage: false });
  });
});
