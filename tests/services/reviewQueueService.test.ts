import { describe, expect, it } from 'vitest';
import {
  buildEvidenceRichReviewQueue,
  clearReviewQueue,
  selectBestAvailableReviewSuggestion,
  classifyProducerTier,
  checkPrefillEligibility,
  type ReviewEvidenceAlternative,
  type ReviewPrefillTrustedContext,
} from '../../server/services/reviewQueueService';
import { BULK_CONFIRMATION_DISABLED_MESSAGE } from '../../server/services/reviewDecisionService';

const makeTransaction = (overrides: Record<string, unknown> = {}): any => ({
  id: 'tx-1',
  date: new Date('2026-05-02T00:00:00.000Z'),
  description: 'Gift Alpha',
  amountMinor: 5000n,
  currency: 'EUR',
  direction: 'credit' as const,
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
  categoryId: null as string | null,
  projectId: null as string | null,
  transactionTypeId: null as string | null,
  classificationSource: 'none' as const,
  classificationRuleId: null as string | null,
  account: {
    id: 'account-1',
    identifier: 'NL89INGB0006369960',
    name: 'ING hoofdrekening',
  },
  project: null as object | null,
  transactionType: null as object | null,
  category: null as object | null,
  classificationRule: null as object | null,
  transactionBooking: null as object | null,
  categorizationSuggestions: [] as unknown[],
  ...overrides,
});

const completeSuggestion = (overrides: Record<string, unknown> = {}): any => ({
  id: 'suggestion-1',
  projectId: 'project-1',
  transactionTypeId: 'type-1',
  categoryId: 'cat-1',
  workspaceId: 'workspace-1',
  transactionId: 'tx-1',
  status: 'PENDING' as const,
  confidence: 'EXACT_FALLBACK',
  matcher: 'NORMALIZED_HISTORY',
  rank: 1,
  scoreBasisPoints: 10000,
  producerKey: null as string | null,
  producerVersion: null as string | null,
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
    workspaceId: 'workspace-1',
    isActive: true,
  },
  transactionType: {
    id: 'type-1',
    literalName: 'Schenking in',
    workspaceId: 'workspace-1',
    isActive: true,
    direction: null as string | null,
  },
  category: {
    id: 'cat-1',
    name: 'Giften',
    workspaceId: 'workspace-1',
    isActive: true,
  },
  ...overrides,
});

const makeAlternative = (overrides: Partial<ReviewEvidenceAlternative> = {}): ReviewEvidenceAlternative => ({
  suggestionId: 'suggestion-1',
  rank: 1,
  matcher: 'NORMALIZED_HISTORY',
  confidence: 'EXACT_FALLBACK',
  confidenceLabel: 'exacte historische suggestie',
  reason: 'Exact historische replay.',
  matchedRuleIds: [],
  historicalRecordIds: [],
  evidenceHashes: ['hash-1'],
  evidenceHash: 'hash-1',
  producerKey: null,
  producerVersion: null,
  scoreBasisPoints: 10000,
  projectId: 'project-1',
  projectCode: 'YA',
  projectLabel: 'Yeshua Academy',
  transactionTypeId: 'type-1',
  transactionTypeLabel: 'Schenking in',
  categoryId: 'cat-1',
  categoryLabel: 'Giften',
  complete: true,
  eligible: true,
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
        categorizationSuggestions: [completeSuggestion({ transactionId: 'tx-review' })],
      }),
    ] as any, {
      categories: [],
      projects: [],
      transactionTypes: [],
    }, { page: 1, pageSize: 25, state: 'all' }, 'workspace-1');

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
          completeSuggestion({ id: 'suggestion-1', projectId: 'project-1', transactionId: 'tx-conflict' }),
          completeSuggestion({
            id: 'suggestion-2',
            projectId: 'project-2',
            transactionId: 'tx-conflict',
            evidenceHash: 'suggestion-hash-2',
            evidence: { historicalRecordIds: ['history-2'] },
            project: { id: 'project-2', code: 'FTK', name: 'For the King', workspaceId: 'workspace-1', isActive: true },
          }),
        ],
      }),
      makeTransaction({
        id: 'tx-incomplete',
        categorizationSuggestions: [
          completeSuggestion({
            id: 'suggestion-partial',
            transactionId: 'tx-incomplete',
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
    }, { page: 1, pageSize: 25, state: 'all' }, 'workspace-1');

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

  it('populates prefill metadata on review items', () => {
    // Authoritative transaction → AUTHORITATIVE_TRANSACTION
    const authQueue = buildEvidenceRichReviewQueue([
      makeTransaction({
        id: 'tx-auth',
        projectId: 'project-1',
        transactionTypeId: 'type-1',
        categoryId: 'cat-1',
        classificationSource: 'rule',
        project: { id: 'project-1', code: 'YA', name: 'Yeshua Academy' },
        transactionType: { id: 'type-1', literalName: 'Schenking in' },
        category: { id: 'cat-1', name: 'Giften' },
      }),
    ] as any, { categories: [], projects: [], transactionTypes: [] }, { page: 1, pageSize: 25, state: 'all' }, 'workspace-1');
    expect(authQueue.transactions[0].prefill.source).toBe('AUTHORITATIVE_TRANSACTION');
    expect(authQueue.transactions[0].prefill.weakFallback).toBe(false);

    // Legacy suggestion → LEGACY_HISTORY_FALLBACK (weakFallback: true)
    const legacyQueue = buildEvidenceRichReviewQueue([
      makeTransaction({
        id: 'tx-legacy',
        categorizationSuggestions: [completeSuggestion({ transactionId: 'tx-legacy' })],
      }),
    ] as any, { categories: [], projects: [], transactionTypes: [] }, { page: 1, pageSize: 25, state: 'all' }, 'workspace-1');
    expect(legacyQueue.transactions[0].prefill.source).toBe('LEGACY_HISTORY_FALLBACK');
    expect(legacyQueue.transactions[0].prefill.weakFallback).toBe(true);
    expect(legacyQueue.transactions[0].prefill.confidence).toBe('EXACT_FALLBACK');

    // Owner-history-v2 suggestion → OWNER_HISTORY_V2
    const v2Queue = buildEvidenceRichReviewQueue([
      makeTransaction({
        id: 'tx-v2',
        categorizationSuggestions: [completeSuggestion({ transactionId: 'tx-v2', producerKey: 'owner-history', producerVersion: 'v2' })],
      }),
    ] as any, { categories: [], projects: [], transactionTypes: [] }, { page: 1, pageSize: 25, state: 'all' }, 'workspace-1');
    expect(v2Queue.transactions[0].prefill.source).toBe('OWNER_HISTORY_V2');
    expect(v2Queue.transactions[0].prefill.weakFallback).toBe(false);

    // No suggestions → NONE
    const noneQueue = buildEvidenceRichReviewQueue([
      makeTransaction({ id: 'tx-none' }),
    ] as any, { categories: [], projects: [], transactionTypes: [] }, { page: 1, pageSize: 25, state: 'all' }, 'workspace-1');
    expect(noneQueue.transactions[0].prefill.source).toBe('NONE');
    expect(noneQueue.transactions[0].prefill.weakFallback).toBe(false);
  });

  it('filters before pagination and applies stable risk-first ordering with page clamping', () => {
    const conflictSuggestions = (txId: string, projectId: string, categoryId: string) => [
      completeSuggestion({ id: `${projectId}-1`, projectId, categoryId, transactionId: txId }),
      completeSuggestion({
        id: `${projectId}-2`,
        projectId: `${projectId}-other`,
        categoryId,
        transactionId: txId,
        evidenceHash: `${projectId}-hash-2`,
        project: { id: `${projectId}-other`, code: 'ALT', name: 'Alternative', workspaceId: 'workspace-1', isActive: true },
      }),
    ];
    const transactions = [
      makeTransaction({ id: 'red-high', amountMinor: 20000n, direction: 'debit', date: new Date('2026-05-03T00:00:00.000Z'), categorizationSuggestions: conflictSuggestions('red-high', 'project-red', 'cat-red') }),
      makeTransaction({ id: 'red-low', amountMinor: 10000n, direction: 'credit', date: new Date('2026-05-01T00:00:00.000Z'), categorizationSuggestions: conflictSuggestions('red-low', 'project-red', 'cat-red') }),
      makeTransaction({ id: 'gray-high', amountMinor: 30000n, direction: 'debit', date: new Date('2026-04-01T00:00:00.000Z') }),
      makeTransaction({ id: 'amber', amountMinor: 5000n, categorizationSuggestions: [completeSuggestion({ id: 'amber-suggestion', transactionId: 'amber', confidence: 'OVERALL', projectId: 'project-amber', categoryId: 'cat-amber', project: { id: 'project-amber', code: 'AMB', name: 'Amber', workspaceId: 'workspace-1', isActive: true }, category: { id: 'cat-amber', name: 'Amber category', workspaceId: 'workspace-1', isActive: true } })] }),
      makeTransaction({ id: 'green', amountMinor: 9000n, categorizationSuggestions: [completeSuggestion({ id: 'green-suggestion', transactionId: 'green', projectId: 'project-green', categoryId: 'cat-green', project: { id: 'project-green', code: 'GRN', name: 'Green', workspaceId: 'workspace-1', isActive: true }, category: { id: 'cat-green', name: 'Green category', workspaceId: 'workspace-1', isActive: true } })] }),
    ] as any;
    const dimensions = { categories: [] as any[], projects: [] as any[], transactionTypes: [] as any[] };

    const first = buildEvidenceRichReviewQueue(transactions, dimensions, { page: 1, pageSize: 2, state: 'all' }, 'workspace-1');
    expect(first.transactions.map((item) => item.transactionId)).toEqual(['red-high', 'red-low']);
    expect(first.pagination).toEqual({ page: 1, pageSize: 2, totalItems: 5, totalPages: 3, hasPreviousPage: false, hasNextPage: true });

    const middle = buildEvidenceRichReviewQueue(transactions, dimensions, { page: 2, pageSize: 2, state: 'all' }, 'workspace-1');
    expect(middle.transactions.map((item) => item.transactionId)).toEqual(['gray-high', 'amber']);

    const final = buildEvidenceRichReviewQueue(transactions, dimensions, { page: 3, pageSize: 2, state: 'all' }, 'workspace-1');
    expect(final.transactions.map((item) => item.transactionId)).toEqual(['green']);
    expect(final.pagination.hasNextPage).toBe(false);

    const clamped = buildEvidenceRichReviewQueue(transactions, dimensions, { page: 99, pageSize: 2, state: 'all' }, 'workspace-1');
    expect(clamped.pagination.page).toBe(3);
    expect(clamped.transactions.map((item) => item.transactionId)).toEqual(['green']);

    expect(buildEvidenceRichReviewQueue(transactions, dimensions, { page: 1, pageSize: 25, confidence: 'red', state: 'all' }, 'workspace-1').transactions.map((item) => item.transactionId)).toEqual(['red-high', 'red-low']);
    expect(buildEvidenceRichReviewQueue(transactions, dimensions, { page: 1, pageSize: 25, direction: 'debit', state: 'all' }, 'workspace-1').transactions.map((item) => item.transactionId)).toEqual(['red-high', 'gray-high']);
    expect(buildEvidenceRichReviewQueue(transactions, dimensions, { page: 1, pageSize: 25, projectId: 'project-amber', state: 'all' }, 'workspace-1').transactions.map((item) => item.transactionId)).toEqual(['amber']);
    expect(buildEvidenceRichReviewQueue(transactions, dimensions, { page: 1, pageSize: 25, categoryId: 'cat-green', state: 'all' }, 'workspace-1').transactions.map((item) => item.transactionId)).toEqual(['green']);
    expect(buildEvidenceRichReviewQueue(transactions, dimensions, { page: 1, pageSize: 25, state: 'incomplete' }, 'workspace-1').transactions.map((item) => item.transactionId)).toEqual(['gray-high']);

    const empty = buildEvidenceRichReviewQueue(transactions, dimensions, { page: 5, pageSize: 25, projectId: 'missing', state: 'all' }, 'workspace-1');
    expect(empty.transactions).toEqual([]);
    expect(empty.pagination).toEqual({ page: 1, pageSize: 25, totalItems: 0, totalPages: 1, hasPreviousPage: false, hasNextPage: false });
  });
});

describe('selectBestAvailableReviewSuggestion', () => {
  // ── Owner-history-v2 precedence ───────────────────────────────────────────

  it('returns null when alternatives is empty', () => {
    expect(selectBestAvailableReviewSuggestion([])).toBeNull();
  });

  it('returns null when all alternatives are incomplete', () => {
    const incomplete = makeAlternative({ eligible: false, complete: false, categoryId: null, categoryLabel: null });
    expect(selectBestAvailableReviewSuggestion([incomplete])).toBeNull();
  });

  it('owner-history-v2 beats legacy when both are rank 1 and complete', () => {
    const legacy = makeAlternative({ suggestionId: 'legacy-1', producerKey: null, producerVersion: null, evidenceHash: 'hash-legacy' });
    const v2 = makeAlternative({ suggestionId: 'v2-1', producerKey: 'owner-history', producerVersion: 'v2', evidenceHash: 'hash-v2' });
    const result = selectBestAvailableReviewSuggestion([legacy, v2]);
    expect(result?.suggestionId).toBe('v2-1');
  });

  it('owner-history-v2 wins regardless of array order', () => {
    const legacy = makeAlternative({ suggestionId: 'legacy-1', producerKey: null, producerVersion: null, evidenceHash: 'hash-legacy' });
    const v2 = makeAlternative({ suggestionId: 'v2-1', producerKey: 'owner-history', producerVersion: 'v2', evidenceHash: 'hash-v2' });
    const result = selectBestAvailableReviewSuggestion([v2, legacy]);
    expect(result?.suggestionId).toBe('v2-1');
  });

  it('complete owner-history-v2 beats higher-scoring legacy (producer policy is explicit)', () => {
    const highScoreLegacy = makeAlternative({
      suggestionId: 'legacy-high',
      producerKey: null,
      producerVersion: null,
      scoreBasisPoints: 99999,
      evidenceHash: 'hash-legacy-high',
    });
    const v2 = makeAlternative({
      suggestionId: 'v2-1',
      producerKey: 'owner-history',
      producerVersion: 'v2',
      scoreBasisPoints: 5000,
      evidenceHash: 'hash-v2',
    });
    const result = selectBestAvailableReviewSuggestion([highScoreLegacy, v2]);
    expect(result?.suggestionId).toBe('v2-1');
  });

  it('incomplete owner-history-v2 does NOT beat complete legacy', () => {
    const legacy = makeAlternative({ suggestionId: 'legacy-1', complete: true, producerKey: null, producerVersion: null, evidenceHash: 'hash-legacy' });
    const incompleteV2 = makeAlternative({
      suggestionId: 'v2-incomplete',
      producerKey: 'owner-history',
      producerVersion: 'v2',
      eligible: false,
      complete: false,
      categoryId: null,
      categoryLabel: null,
      evidenceHash: 'hash-v2',
    });
    const result = selectBestAvailableReviewSuggestion([incompleteV2, legacy]);
    expect(result?.suggestionId).toBe('legacy-1');
  });

  it('owner-history-v2 with missing projectId (incomplete) does NOT become prefill over complete legacy', () => {
    const legacyComplete = makeAlternative({ suggestionId: 'legacy-complete', complete: true, evidenceHash: 'hash-lc' });
    const v2Incomplete = makeAlternative({
      suggestionId: 'v2-no-project',
      producerKey: 'owner-history',
      producerVersion: 'v2',
      eligible: false,
      complete: false,
      projectId: null,
      projectCode: null,
      projectLabel: null,
      evidenceHash: 'hash-v2-np',
    });
    const result = selectBestAvailableReviewSuggestion([v2Incomplete, legacyComplete]);
    expect(result?.suggestionId).toBe('legacy-complete');
  });

  // ── Legacy fallback ───────────────────────────────────────────────────────

  it('returns complete legacy rank-1 when no owner-history-v2 exists', () => {
    const legacy = makeAlternative({ suggestionId: 'legacy-r1', rank: 1, complete: true });
    const result = selectBestAvailableReviewSuggestion([legacy]);
    expect(result?.suggestionId).toBe('legacy-r1');
  });

  it('incomplete legacy rank-1 falls back to next complete legacy candidate', () => {
    const incompleteR1 = makeAlternative({
      suggestionId: 'legacy-r1-incomplete',
      rank: 1,
      eligible: false,
      complete: false,
      categoryId: null,
      categoryLabel: null,
      evidenceHash: 'hash-r1',
    });
    const completeR2 = makeAlternative({ suggestionId: 'legacy-r2-complete', rank: 2, complete: true, evidenceHash: 'hash-r2' });
    const result = selectBestAvailableReviewSuggestion([incompleteR1, completeR2]);
    expect(result?.suggestionId).toBe('legacy-r2-complete');
  });

  // ── Stable ordering within a tier ────────────────────────────────────────

  it('higher score breaks same-rank ties', () => {
    const lowScore = makeAlternative({ suggestionId: 'low-score', rank: 1, scoreBasisPoints: 5000, evidenceHash: 'hash-low' });
    const highScore = makeAlternative({ suggestionId: 'high-score', rank: 1, scoreBasisPoints: 9000, evidenceHash: 'hash-high' });
    const result = selectBestAvailableReviewSuggestion([lowScore, highScore]);
    expect(result?.suggestionId).toBe('high-score');
  });

  it('null scoreBasisPoints counts as 0', () => {
    const noScore = makeAlternative({ suggestionId: 'no-score', rank: 1, scoreBasisPoints: null, evidenceHash: 'hash-ns' });
    const hasScore = makeAlternative({ suggestionId: 'has-score', rank: 1, scoreBasisPoints: 1, evidenceHash: 'hash-hs' });
    expect(selectBestAvailableReviewSuggestion([noScore, hasScore])?.suggestionId).toBe('has-score');
  });

  it('confidence ordering is deterministic (EXACT_FALLBACK beats DEFAULT)', () => {
    const defaultConf = makeAlternative({ suggestionId: 'default-conf', rank: 1, scoreBasisPoints: 10000, confidence: 'DEFAULT', evidenceHash: 'hash-def' });
    const exactConf = makeAlternative({ suggestionId: 'exact-conf', rank: 1, scoreBasisPoints: 10000, confidence: 'EXACT_FALLBACK', evidenceHash: 'hash-exact' });
    const result = selectBestAvailableReviewSuggestion([defaultConf, exactConf]);
    expect(result?.suggestionId).toBe('exact-conf');
  });

  it('lower rank wins when score and confidence are equal', () => {
    const r2 = makeAlternative({ suggestionId: 'rank-2', rank: 2, scoreBasisPoints: 10000, confidence: 'EXACT_FALLBACK', evidenceHash: 'hash-r2' });
    const r1 = makeAlternative({ suggestionId: 'rank-1', rank: 1, scoreBasisPoints: 10000, confidence: 'EXACT_FALLBACK', evidenceHash: 'hash-r1' });
    const result = selectBestAvailableReviewSuggestion([r2, r1]);
    expect(result?.suggestionId).toBe('rank-1');
  });

  it('matcher ordering is deterministic (NORMALIZED_HISTORY beats DIRECTION_DEFAULT)', () => {
    const weak = makeAlternative({ suggestionId: 'weak-matcher', rank: 1, scoreBasisPoints: 10000, confidence: 'EXACT_FALLBACK', matcher: 'DIRECTION_DEFAULT', evidenceHash: 'hash-weak' });
    const strong = makeAlternative({ suggestionId: 'strong-matcher', rank: 1, scoreBasisPoints: 10000, confidence: 'EXACT_FALLBACK', matcher: 'NORMALIZED_HISTORY', evidenceHash: 'hash-strong' });
    const result = selectBestAvailableReviewSuggestion([weak, strong]);
    expect(result?.suggestionId).toBe('strong-matcher');
  });

  it('evidenceHash is used as stable tiebreaker when all else equal', () => {
    const altA = makeAlternative({ suggestionId: 'same-1', rank: 1, scoreBasisPoints: 10000, confidence: 'EXACT_FALLBACK', matcher: 'NORMALIZED_HISTORY', evidenceHash: 'aaa-hash' });
    const altB = makeAlternative({ suggestionId: 'same-2', rank: 1, scoreBasisPoints: 10000, confidence: 'EXACT_FALLBACK', matcher: 'NORMALIZED_HISTORY', evidenceHash: 'zzz-hash' });
    const result = selectBestAvailableReviewSuggestion([altA, altB]);
    expect(result?.evidenceHash).toBe('aaa-hash');
  });

  it('reversing input array order does not change the selected prefill', () => {
    const alts = [
      makeAlternative({ suggestionId: 'a1', rank: 2, scoreBasisPoints: 5000, evidenceHash: 'h-a1' }),
      makeAlternative({ suggestionId: 'a2', rank: 1, scoreBasisPoints: 9000, evidenceHash: 'h-a2' }),
      makeAlternative({ suggestionId: 'a3', rank: 1, scoreBasisPoints: 7000, evidenceHash: 'h-a3' }),
    ];
    const forward = selectBestAvailableReviewSuggestion(alts);
    const reversed = selectBestAvailableReviewSuggestion([...alts].reverse());
    expect(forward?.suggestionId).toBe(reversed?.suggestionId);
    expect(forward?.suggestionId).toBe('a2');
  });

  // ── Safety ────────────────────────────────────────────────────────────────

  it('conflicting alternatives remain visible in alternatives array', () => {
    const queue = buildEvidenceRichReviewQueue([
      makeTransaction({
        id: 'tx-conflict',
        categorizationSuggestions: [
          completeSuggestion({ id: 'sg-1', projectId: 'project-1', evidenceHash: 'hash-sg1', transactionId: 'tx-conflict' }),
          completeSuggestion({ id: 'sg-2', projectId: 'project-2', evidenceHash: 'hash-sg2', transactionId: 'tx-conflict', project: { id: 'project-2', code: 'FTK', name: 'For the King', workspaceId: 'workspace-1', isActive: true } }),
        ],
      }),
    ] as any, { categories: [], projects: [], transactionTypes: [] }, { page: 1, pageSize: 25, state: 'all' }, 'workspace-1');
    expect(queue.transactions[0].alternatives).toHaveLength(2);
  });

  it('no TransactionBooking is created (sideEffects guard)', () => {
    const queue = buildEvidenceRichReviewQueue([
      makeTransaction({
        id: 'tx-1',
        categorizationSuggestions: [completeSuggestion({ producerKey: 'owner-history', producerVersion: 'v2' })],
      }),
    ] as any, { categories: [], projects: [], transactionTypes: [] }, { page: 1, pageSize: 25, state: 'all' }, 'workspace-1');
    expect(queue.transactions[0].sideEffects.createsTransactionBooking).toBe(false);
  });

  it('no ReviewDecision is created (sideEffects guard)', () => {
    const queue = buildEvidenceRichReviewQueue([
      makeTransaction({
        id: 'tx-1',
        categorizationSuggestions: [completeSuggestion()],
      }),
    ] as any, { categories: [], projects: [], transactionTypes: [] }, { page: 1, pageSize: 25, state: 'all' }, 'workspace-1');
    expect(queue.transactions[0].sideEffects.closesPeriod).toBe(false);
  });
});

describe('classifyProducerTier', () => {
  it('classifies owner-history-v2 exact match', () => {
    const alt = makeAlternative({ producerKey: 'owner-history', producerVersion: 'v2' });
    expect(classifyProducerTier(alt)).toBe('OWNER_HISTORY_V2');
  });

  it('classifies null/null as LEGACY_UNOWNED', () => {
    const alt = makeAlternative({ producerKey: null, producerVersion: null });
    expect(classifyProducerTier(alt)).toBe('LEGACY_UNOWNED');
  });

  it('classifies unknown key/version as UNRECOGNIZED', () => {
    const alt = makeAlternative({ producerKey: 'future-ai', producerVersion: '1.0' });
    expect(classifyProducerTier(alt)).toBe('UNRECOGNIZED');
  });

  it('classifies owner-history with wrong version as UNRECOGNIZED', () => {
    const alt = makeAlternative({ producerKey: 'owner-history', producerVersion: 'v1' });
    expect(classifyProducerTier(alt)).toBe('UNRECOGNIZED');
  });

  it('classifies key without version as UNRECOGNIZED', () => {
    const alt = makeAlternative({ producerKey: 'owner-history', producerVersion: null });
    expect(classifyProducerTier(alt)).toBe('UNRECOGNIZED');
  });

  it('unrecognized suggestions never selected as prefill even when eligible', () => {
    const unrecognized = makeAlternative({
      suggestionId: 'unknown-prod',
      producerKey: 'future-ai',
      producerVersion: '3.0',
      eligible: true,
      evidenceHash: 'h-unk',
    });
    const legacyEligible = makeAlternative({
      suggestionId: 'legacy-ok',
      producerKey: null,
      producerVersion: null,
      eligible: true,
      evidenceHash: 'h-leg',
    });
    expect(selectBestAvailableReviewSuggestion([unrecognized, legacyEligible])?.suggestionId).toBe('legacy-ok');
  });

  it('unknown producer alone returns null (no fallback)', () => {
    const unrecognized = makeAlternative({
      suggestionId: 'unk',
      producerKey: 'future-ai',
      producerVersion: 'v99',
      eligible: true,
      evidenceHash: 'h-unk',
    });
    expect(selectBestAvailableReviewSuggestion([unrecognized])).toBeNull();
  });
});

describe('checkPrefillEligibility', () => {
  const baseSuggestion = (overrides?: any) => ({
    id: 'sg-1',
    workspaceId: 'ws-1',
    projectId: 'p-1',
    transactionTypeId: 'tt-1',
    categoryId: 'cat-1',
    producerKey: null as string | null,
    producerVersion: null as string | null,
    project: { id: 'p-1', workspaceId: 'ws-1', isActive: true, code: 'YA', name: 'YA' },
    transactionType: { id: 'tt-1', workspaceId: 'ws-1', isActive: true, direction: 'credit' as const, literalName: 'Schenking in' },
    category: { id: 'cat-1', workspaceId: 'ws-1', isActive: true, name: 'Giften' },
    rank: 1,
    confidence: 'EXACT_FALLBACK' as const,
    matcher: 'NORMALIZED_HISTORY' as const,
    scoreBasisPoints: 10000,
    evidence: {},
    evidenceHash: 'h',
    planHash: null,
    status: 'PENDING' as const,
    createdAt: new Date(),
    resolvedAt: null,
    transactionId: 'tx-1',
    ...overrides,
  });

  const baseTrustedContext = (overrides?: Partial<ReviewPrefillTrustedContext>): ReviewPrefillTrustedContext => ({
    expectedWorkspaceId: 'ws-1',
    expectedTransactionId: 'tx-1',
    transactionDirection: 'credit' as const,
    ...overrides,
  });

  it('eligible when all conditions met', () => {
    const result = checkPrefillEligibility(baseSuggestion() as any, baseTrustedContext());
    expect(result.eligible).toBe(true);
    expect(result.reasons).toEqual([]);
  });

  it('flags INCOMPLETE_TRIPLE when projectId is null', () => {
    const sg = baseSuggestion({ projectId: null });
    const r = checkPrefillEligibility(sg as any, baseTrustedContext());
    expect(r.eligible).toBe(false);
    expect(r.reasons).toContain('INCOMPLETE_TRIPLE');
  });

  it('flags PROJECT_UNAVAILABLE when project is null', () => {
    const sg = baseSuggestion({ project: null });
    const r = checkPrefillEligibility(sg as any, baseTrustedContext());
    expect(r.eligible).toBe(false);
    expect(r.reasons).toContain('PROJECT_UNAVAILABLE');
  });

  it('flags PROJECT_INACTIVE', () => {
    const sg = baseSuggestion({ project: { id: 'p-1', workspaceId: 'ws-1', isActive: false, code: 'YA', name: 'YA' } });
    const r = checkPrefillEligibility(sg as any, baseTrustedContext());
    expect(r.eligible).toBe(false);
    expect(r.reasons).toContain('PROJECT_INACTIVE');
  });

  it('flags TRANSACTION_TYPE_DIRECTION_MISMATCH', () => {
    const sg = baseSuggestion({ transactionType: { id: 'tt-1', workspaceId: 'ws-1', isActive: true, direction: 'debit' as const, literalName: 'Schenking in' } });
    const r = checkPrefillEligibility(sg as any, baseTrustedContext());
    expect(r.eligible).toBe(false);
    expect(r.reasons).toContain('TRANSACTION_TYPE_DIRECTION_MISMATCH');
  });

  it('eligible when transactionType direction is null', () => {
    const sg = baseSuggestion({ transactionType: { id: 'tt-1', workspaceId: 'ws-1', isActive: true, direction: null, literalName: 'Schenking in' } });
    const r = checkPrefillEligibility(sg as any, baseTrustedContext());
    expect(r.eligible).toBe(true);
  });

  it('flags CATEGORY_INACTIVE', () => {
    const sg = baseSuggestion({ category: { id: 'cat-1', workspaceId: 'ws-1', isActive: false, name: 'Giften' } });
    const r = checkPrefillEligibility(sg as any, baseTrustedContext());
    expect(r.eligible).toBe(false);
    expect(r.reasons).toContain('CATEGORY_INACTIVE');
  });

  it('flags WORKSPACE_MISMATCH when project is in different workspace', () => {
    const sg = baseSuggestion({ project: { id: 'p-1', workspaceId: 'ws-OTHER', isActive: true, code: 'YA', name: 'YA' } });
    const r = checkPrefillEligibility(sg as any, baseTrustedContext());
    expect(r.eligible).toBe(false);
    expect(r.reasons).toContain('WORKSPACE_MISMATCH');
  });

  it('flags TRANSACTION_MISMATCH when suggestion belongs to different transaction', () => {
    const sg = baseSuggestion({ transactionId: 'tx-OTHER' });
    const r = checkPrefillEligibility(sg as any, baseTrustedContext({ expectedTransactionId: 'tx-1' }));
    expect(r.eligible).toBe(false);
    expect(r.reasons).toContain('TRANSACTION_MISMATCH');
  });

  it('flags TRANSACTION_MISMATCH when transactionId is missing', () => {
    const sg = baseSuggestion({ transactionId: undefined });
    const r = checkPrefillEligibility(sg as any, baseTrustedContext());
    expect(r.eligible).toBe(false);
    expect(r.reasons).toContain('TRANSACTION_MISMATCH');
  });

  it('flags SUGGESTION_NOT_PENDING when status is missing', () => {
    const sg = baseSuggestion({ status: undefined });
    const r = checkPrefillEligibility(sg as any, baseTrustedContext());
    expect(r.eligible).toBe(false);
    expect(r.reasons).toContain('SUGGESTION_NOT_PENDING');
  });

  it('flags SUGGESTION_NOT_PENDING when status is not pending', () => {
    const sg = baseSuggestion({ status: 'EXPIRED' });
    const r = checkPrefillEligibility(sg as any, baseTrustedContext());
    expect(r.eligible).toBe(false);
    expect(r.reasons).toContain('SUGGESTION_NOT_PENDING');
  });

  it('accepts an exact transaction match with pending status', () => {
    const sg = baseSuggestion({ transactionId: 'tx-1', status: 'PENDING' });
    const r = checkPrefillEligibility(sg as any, baseTrustedContext());
    expect(r.eligible).toBe(true);
    expect(r.reasons).not.toContain('TRANSACTION_MISMATCH');
    expect(r.reasons).not.toContain('SUGGESTION_NOT_PENDING');
  });

  it('flags WORKSPACE_MISMATCH when trusted expectedWorkspaceId differs from suggestion workspaceId', () => {
    const sg = baseSuggestion({ workspaceId: 'ws-1' });
    const r = checkPrefillEligibility(sg as any, baseTrustedContext({ expectedWorkspaceId: 'ws-DIFFERENT' }));
    expect(r.eligible).toBe(false);
    expect(r.reasons).toContain('WORKSPACE_MISMATCH');
  });

  it('flags UNRECOGNIZED_PRODUCER for unknown producer', () => {
    const sg = baseSuggestion({ producerKey: 'future-ai', producerVersion: 'v99' });
    const r = checkPrefillEligibility(sg as any, baseTrustedContext());
    expect(r.eligible).toBe(false);
    expect(r.reasons).toContain('UNRECOGNIZED_PRODUCER');
  });

  it('allows legacy (null/null) producer', () => {
    const sg = baseSuggestion({ producerKey: null, producerVersion: null });
    const r = checkPrefillEligibility(sg as any, baseTrustedContext());
    expect(r.eligible).toBe(true);
    expect(r.reasons).not.toContain('UNRECOGNIZED_PRODUCER');
  });

  it('allows owner-history-v2 producer', () => {
    const sg = baseSuggestion({ producerKey: 'owner-history', producerVersion: 'v2' });
    const r = checkPrefillEligibility(sg as any, baseTrustedContext());
    expect(r.eligible).toBe(true);
    expect(r.reasons).not.toContain('UNRECOGNIZED_PRODUCER');
  });

  it('accumulates multiple reasons', () => {
    const sg = baseSuggestion({
      projectId: null,
      project: null,
      transactionTypeId: null,
      transactionType: null,
      producerKey: 'bad-producer',
      producerVersion: 'v1',
    });
    const r = checkPrefillEligibility(sg as any, baseTrustedContext());
    expect(r.eligible).toBe(false);
    expect(r.reasons.length).toBeGreaterThan(1);
    expect(r.reasons).toContain('INCOMPLETE_TRIPLE');
    expect(r.reasons).toContain('PROJECT_UNAVAILABLE');
  });
});
