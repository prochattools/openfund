import { describe, expect, it } from 'vitest';
import {
  OWNER_HISTORY_PROPOSAL_VERSION,
  OWNER_HISTORY_PRODUCER_KEY,
  OWNER_HISTORY_PRODUCER_VERSION,
  buildOwnerHistoryProposalPlan,
  executeOwnerHistoryProposalPlan,
} from '../../server/services/ownerHistoryProposalEvidenceService';

const WORKSPACE_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

type FakeBooking = {
  id: string;
  workspaceId: string;
  source: 'HISTORICAL' | 'RULE' | 'MANUAL';
  projectId: string | null;
  transactionTypeId: string | null;
  categoryId: string | null;
  evidenceHash: string;
  project: { workspaceId: string; isActive: boolean };
  transactionType: { workspaceId: string; isActive: boolean };
  category: { workspaceId: string; isActive: boolean };
  transaction: {
    id: string;
    date: Date;
    direction: 'credit' | 'debit';
    amountMinor: bigint;
    counterparty: string | null;
    description: string;
    accountId: string | null;
    rawRow: unknown;
    reviewDecisions: { id: string }[];
  };
};

type FakeOpenTx = {
  id: string;
  date: Date;
  direction: 'credit' | 'debit';
  amountMinor: bigint;
  counterparty: string | null;
  description: string;
  accountId: string | null;
  rawRow: unknown;
};

const makePrisma = (bookings: FakeBooking[], openTxs: FakeOpenTx[]) => ({
  transactionBooking: {
    findMany: async ({ where }: { where: { workspaceId: string; source: string } }) =>
      bookings.filter((b) => b.workspaceId === where.workspaceId && b.source === where.source),
  },
  transaction: {
    findMany: async () => openTxs,
  },
  categorizationSuggestion: {
    findMany: async () => [],
  },
});

const makeExecutionPrisma = (
  bookings: FakeBooking[],
  openTxs: FakeOpenTx[],
  initialSuggestions: Array<{ id: string; transactionId: string; evidenceHash: string; status: string; evidence: unknown; producerKey?: string | null; producerVersion?: string | null; planHash?: string | null }> = [],
) => {
  const suggestions = [...initialSuggestions];
  const db = {
    ...makePrisma(bookings, openTxs),
    categorizationSuggestion: {
      findMany: async ({ where }: { where?: { producerKey?: string; producerVersion?: string } } = {}) => suggestions.filter((suggestion) =>
        (!where?.producerKey || suggestion.producerKey === where.producerKey)
        && (!where?.producerVersion || suggestion.producerVersion === where.producerVersion),
      ),
      updateMany: async ({ where }: { where: { id: { in: string[] } } }) => {
        const matches = suggestions.filter((suggestion) => where.id.in.includes(suggestion.id) && suggestion.status === 'PENDING');
        matches.forEach((suggestion) => { suggestion.status = 'EXPIRED'; });
        return { count: matches.length };
      },
      createMany: async ({ data }: { data: Array<{ transactionId: string; evidenceHash: string; evidence: unknown; producerKey?: string; producerVersion?: string; planHash?: string }> }) => {
        const newSuggestions = data.filter((entry) => !suggestions.some((suggestion) => suggestion.transactionId === entry.transactionId && suggestion.evidenceHash === entry.evidenceHash));
        newSuggestions.forEach((entry, index) => suggestions.push({
          id: `suggestion-${suggestions.length + index}`,
          transactionId: entry.transactionId,
          evidenceHash: entry.evidenceHash,
          status: 'PENDING',
          evidence: entry.evidence,
          producerKey: entry.producerKey ?? null,
          producerVersion: entry.producerVersion ?? null,
          planHash: entry.planHash ?? null,
        }));
        return { count: newSuggestions.length };
      },
    },
    $transaction: async (callback: (tx: unknown) => unknown) => callback(db),
  };
  return { db, suggestions };
};

const booking = (id: string, typeId: string, direction: 'credit' | 'debit', overrides: Partial<FakeBooking> = {}): FakeBooking => ({
  id,
  workspaceId: WORKSPACE_ID,
  source: 'HISTORICAL',
  projectId: 'project-ya',
  transactionTypeId: typeId,
  categoryId: 'category-gifts',
  evidenceHash: `hash-${id}`,
  project: { workspaceId: WORKSPACE_ID, isActive: true },
  transactionType: { workspaceId: WORKSPACE_ID, isActive: true },
  category: { workspaceId: WORKSPACE_ID, isActive: true },
  transaction: {
    id: `tx-${id}`,
    date: new Date('2024-06-01T00:00:00.000Z'),
    direction,
    amountMinor: 5000n,
    counterparty: 'Stichting Alpha',
    description: 'Gift YA',
    accountId: 'acc-1',
    rawRow: null,
    reviewDecisions: [],
  },
  ...overrides,
});

const openTx = (id: string, direction: 'credit' | 'debit', counterparty: string = 'Stichting Alpha'): FakeOpenTx => ({
  id,
  date: new Date('2026-06-15T00:00:00.000Z'),
  direction,
  amountMinor: 5000n,
  counterparty,
  description: 'Gift YA',
  accountId: 'acc-1',
  rawRow: null,
});

describe('buildOwnerHistoryProposalPlan', () => {
  it('returns sideEffects with all false except requiresAdministratorApproval', async () => {
    const db = makePrisma([], []);
    const plan = await buildOwnerHistoryProposalPlan(db as never, { workspaceId: WORKSPACE_ID });

    expect(plan.sideEffects.writesPerformed).toBe(false);
    expect(plan.sideEffects.createsTransactionBooking).toBe(false);
    expect(plan.sideEffects.createsReviewDecision).toBe(false);
    expect(plan.sideEffects.requiresAdministratorApproval).toBe(true);
  });

  it('records provenance proof showing it does NOT qualify under confirmedHistoryEligibilityService', async () => {
    const db = makePrisma([], []);
    const plan = await buildOwnerHistoryProposalPlan(db as never, { workspaceId: WORKSPACE_ID });

    expect(plan.provenanceProof.qualifiesUnderConfirmedHistoryEligibilityService).toBe(false);
    expect(plan.provenanceProof.exclusionReason).toBe('MISSING_REVIEW_DECISION');
    expect(plan.provenanceProof.evidenceBookingsLoadedFromSource).toBe('HISTORICAL');
  });

  it('counts evidence candidates and open transactions', async () => {
    const bookings = [booking('b1', 'type-credit', 'credit'), booking('b2', 'type-credit', 'credit')];
    const txs = [openTx('open-1', 'credit')];
    const db = makePrisma(bookings, txs);
    const plan = await buildOwnerHistoryProposalPlan(db as never, { workspaceId: WORKSPACE_ID });

    expect(plan.counts.evidenceCandidates).toBe(2);
    expect(plan.counts.openTransactions).toBe(1);
  });

  it('disqualifies evidence with incomplete triples (missing projectId)', async () => {
    const incomplete = booking('b3', 'type-credit', 'credit', { projectId: null });
    const db = makePrisma([incomplete], []);
    const plan = await buildOwnerHistoryProposalPlan(db as never, { workspaceId: WORKSPACE_ID });

    expect(plan.counts.disqualifiedIncomplete).toBe(1);
    expect(plan.counts.eligibleEvidence).toBe(0);
  });

  it('allows a mixed historical Type to provide evidence within each factual direction partition', async () => {
    const creditBooking = booking('b4', 'type-mixed', 'credit');
    const debitBooking = booking('b5', 'type-mixed', 'debit');
    const db = makePrisma([creditBooking, debitBooking], [openTx('open-2-credit', 'credit'), openTx('open-2-debit', 'debit')]);
    const plan = await buildOwnerHistoryProposalPlan(db as never, { workspaceId: WORKSPACE_ID });

    expect(plan.counts.eligibleEvidence).toBe(2);
    expect(plan.proposals.map((proposal) => proposal.transactionId).sort()).toEqual(['open-2-credit', 'open-2-debit']);
  });

  it('produces proposals for open transactions matched by eligible evidence', async () => {
    const bookings = [booking('b6', 'type-credit', 'credit')];
    const txs = [openTx('open-3', 'credit')];
    const db = makePrisma(bookings, txs);
    const plan = await buildOwnerHistoryProposalPlan(db as never, { workspaceId: WORKSPACE_ID });

    expect(plan.proposals.length).toBeGreaterThan(0);
    const proposal = plan.proposals.find((p) => p.transactionId === 'open-3');
    expect(proposal).toBeDefined();
    expect(proposal!.rank1.projectId).toBe('project-ya');
    expect(proposal!.rank1.transactionTypeId).toBe('type-credit');
    expect(proposal!.rank1.categoryId).toBe('category-gifts');
  });

  it('does not produce proposals for open transactions with wrong direction', async () => {
    const bookings = [booking('b7', 'type-credit', 'credit')];
    const txs = [openTx('open-4', 'debit')];
    const db = makePrisma(bookings, txs);
    const plan = await buildOwnerHistoryProposalPlan(db as never, { workspaceId: WORKSPACE_ID });

    expect(plan.proposals).toHaveLength(0);
    expect(plan.counts.abstainedNoFactualDirectionMatch).toBe(1);
  });

  it('returns deterministic planHash for identical inputs', async () => {
    const bookings = [booking('b8', 'type-credit', 'credit')];
    const txs = [openTx('open-5', 'credit')];
    const db = makePrisma(bookings, txs);

    const plan1 = await buildOwnerHistoryProposalPlan(db as never, { workspaceId: WORKSPACE_ID });
    const plan2 = await buildOwnerHistoryProposalPlan(db as never, { workspaceId: WORKSPACE_ID });

    expect(plan1.planHash).toBe(plan2.planHash);
    expect(plan1.planHash).toHaveLength(64);
    expect(plan1.persistence).toMatchObject({
      producerKey: OWNER_HISTORY_PRODUCER_KEY,
      producerVersion: OWNER_HISTORY_PRODUCER_VERSION,
      rankPersistence: 'RANK_1_ONLY',
      plannedCreateCount: 1,
      plannedExpirationCount: 0,
    });
  });

  it('binds owned-suggestion state into the plan hash without claiming unowned rows', async () => {
    const target = openTx('open-ownership-hash', 'credit');
    const base = makeExecutionPrisma([booking('b-ownership-hash', 'type-credit', 'credit')], [target]);
    const basePlan = await buildOwnerHistoryProposalPlan(base.db as never, { workspaceId: WORKSPACE_ID });
    const owned = makeExecutionPrisma([booking('b-ownership-hash', 'type-credit', 'credit')], [target], [{
      id: 'owned-for-hash', transactionId: target.id, evidenceHash: basePlan.proposals[0]!.rank1.evidenceHash, status: 'PENDING', evidence: {},
      producerKey: OWNER_HISTORY_PRODUCER_KEY, producerVersion: OWNER_HISTORY_PRODUCER_VERSION,
    }]);
    const ownedPlan = await buildOwnerHistoryProposalPlan(owned.db as never, { workspaceId: WORKSPACE_ID });

    expect(ownedPlan.planHash).not.toBe(basePlan.planHash);
    expect(ownedPlan.persistence.plannedCreateCount).toBe(0);
    expect(ownedPlan.persistence.existingOwnedSuggestionCount).toBe(1);
  });

  it('excludes self evidence and evidence newer than the target', async () => {
    const self = booking('b-self', 'type-credit', 'credit');
    const newer = booking('b-newer', 'type-credit', 'credit', {
      transaction: { ...self.transaction, id: 'tx-newer', date: new Date('2027-01-01T00:00:00.000Z') },
    });
    const target = { ...openTx('tx-self', 'credit'), id: 'tx-self', date: new Date('2026-06-15T00:00:00.000Z') };
    const selfWithTargetId = { ...self, transaction: { ...self.transaction, id: target.id } };
    const plan = await buildOwnerHistoryProposalPlan(makePrisma([selfWithTargetId, newer], [target]) as never, { workspaceId: WORKSPACE_ID });

    expect(plan.proposals).toHaveLength(0);
    expect(plan.counts.abstainedNoRankedCandidate).toBe(1);
  });

  it('rejects stale hashes and is idempotent for a matching hash', async () => {
    const { db, suggestions } = makeExecutionPrisma([booking('b-execute', 'type-credit', 'credit')], [openTx('open-execute', 'credit')]);
    const plan = await buildOwnerHistoryProposalPlan(db as never, { workspaceId: WORKSPACE_ID });

    const stale = await executeOwnerHistoryProposalPlan(db as never, {
      workspaceId: WORKSPACE_ID, execute: true, executionAllowed: true, confirmedPlanHash: 'stale',
    });
    const first = await executeOwnerHistoryProposalPlan(db as never, {
      workspaceId: WORKSPACE_ID, execute: true, executionAllowed: true, confirmedPlanHash: plan.planHash,
    });
    const replay = await executeOwnerHistoryProposalPlan(db as never, {
      workspaceId: WORKSPACE_ID, execute: true, executionAllowed: true, confirmedPlanHash: plan.planHash,
    });

    expect(stale.status).toBe('HASH_DRIFT');
    expect(first.createdSuggestionCount).toBeGreaterThan(0);
    expect(replay.createdSuggestionCount).toBe(0);
    expect(replay.expiredSuggestionCount).toBe(0);
    expect(replay.writesPerformed).toBe(false);
    expect(suggestions).toHaveLength(first.createdSuggestionCount);
  });

  it('preserves unrelated pending suggestions during v2 execution', async () => {
    const target = openTx('open-owned', 'credit');
    const unrelated = {
      id: 'manual-suggestion',
      transactionId: target.id,
      evidenceHash: 'manual-evidence',
      status: 'PENDING',
      evidence: { algorithmVersion: 'manual-review-v1' },
      producerKey: null,
      producerVersion: null,
    };
    const { db, suggestions } = makeExecutionPrisma(
      [booking('b-owned', 'type-credit', 'credit')],
      [target],
      [unrelated],
    );
    const plan = await buildOwnerHistoryProposalPlan(db as never, { workspaceId: WORKSPACE_ID });

    const result = await executeOwnerHistoryProposalPlan(db as never, {
      workspaceId: WORKSPACE_ID,
      execute: true,
      executionAllowed: true,
      confirmedPlanHash: plan.planHash,
    });

    expect(result.expiredSuggestionCount).toBe(0);
    expect(suggestions.find((suggestion) => suggestion.id === unrelated.id)?.status).toBe('PENDING');
  });

  it('expires only exact owner-history-v2 suggestions and persists rank 1 only', async () => {
    const target = openTx('open-exact-owner', 'credit');
    const ownedStale = {
      id: 'owned-stale', transactionId: target.id, evidenceHash: 'old-owned-evidence', status: 'PENDING', evidence: {},
      producerKey: OWNER_HISTORY_PRODUCER_KEY, producerVersion: OWNER_HISTORY_PRODUCER_VERSION,
    };
    const otherProducer = {
      id: 'other-producer', transactionId: target.id, evidenceHash: 'other-evidence', status: 'PENDING', evidence: {},
      producerKey: 'history-backfill', producerVersion: 'v1',
    };
    const { db, suggestions } = makeExecutionPrisma([booking('b-exact-owner', 'type-credit', 'credit')], [target], [ownedStale, otherProducer]);
    const plan = await buildOwnerHistoryProposalPlan(db as never, { workspaceId: WORKSPACE_ID });
    const result = await executeOwnerHistoryProposalPlan(db as never, {
      workspaceId: WORKSPACE_ID, execute: true, executionAllowed: true, confirmedPlanHash: plan.planHash,
    });

    expect(plan.persistence.rankPersistence).toBe('RANK_1_ONLY');
    expect(plan.persistence.plannedCreateCount).toBe(1);
    expect(plan.persistence.plannedExpirationCount).toBe(1);
    expect(result.expiredSuggestionCount).toBe(1);
    expect(result.createdSuggestionCount).toBe(1);
    expect(suggestions.find((suggestion) => suggestion.id === ownedStale.id)?.status).toBe('EXPIRED');
    expect(suggestions.find((suggestion) => suggestion.id === otherProducer.id)?.status).toBe('PENDING');
    const created = suggestions.find((suggestion) => suggestion.id !== ownedStale.id && suggestion.id !== otherProducer.id);
    expect(created?.producerKey).toBe(OWNER_HISTORY_PRODUCER_KEY);
    expect(created?.producerVersion).toBe(OWNER_HISTORY_PRODUCER_VERSION);
    expect(created?.planHash).toBe(plan.planHash);
    expect(created?.status).toBe('PENDING');
  });

  it('returns different planHash when proposals differ', async () => {
    const bookings = [booking('b9', 'type-credit', 'credit')];
    const db1 = makePrisma(bookings, [openTx('open-6', 'credit')]);
    const db2 = makePrisma(bookings, [openTx('open-7', 'credit', 'Andere Stichting')]);

    const plan1 = await buildOwnerHistoryProposalPlan(db1 as never, { workspaceId: WORKSPACE_ID });
    const plan2 = await buildOwnerHistoryProposalPlan(db2 as never, { workspaceId: WORKSPACE_ID });

    expect(plan1.planHash).not.toBe(plan2.planHash);
  });

  it('is invariant to equivalent evidence ordering and changes when factual direction changes', async () => {
    const credit = booking('b-order-credit', 'type-mixed', 'credit');
    const debit = booking('b-order-debit', 'type-mixed', 'debit');
    const target = openTx('open-order', 'credit');

    const first = await buildOwnerHistoryProposalPlan(makePrisma([credit, debit], [target]) as never, { workspaceId: WORKSPACE_ID });
    const reordered = await buildOwnerHistoryProposalPlan(makePrisma([debit, credit], [target]) as never, { workspaceId: WORKSPACE_ID });
    const changedDirection = await buildOwnerHistoryProposalPlan(makePrisma([credit, debit], [{ ...target, direction: 'debit' }]) as never, { workspaceId: WORKSPACE_ID });

    expect(reordered.planHash).toBe(first.planHash);
    expect(changedDirection.planHash).not.toBe(first.planHash);
  });

  it('excludes cross-workspace and inactive triples without mutating source history', async () => {
    const crossWorkspace = booking('b-cross', 'type-credit', 'credit', {
      project: { workspaceId: 'other-workspace', isActive: true },
    });
    const inactive = booking('b-inactive', 'type-credit', 'credit', {
      transactionType: { workspaceId: WORKSPACE_ID, isActive: false },
    });
    const plan = await buildOwnerHistoryProposalPlan(makePrisma([crossWorkspace, inactive], []) as never, { workspaceId: WORKSPACE_ID });

    expect(plan.counts.disqualifiedCrossWorkspace).toBe(1);
    expect(plan.counts.disqualifiedInactiveOrUnauthorizedTriple).toBe(1);
    expect(plan.counts.eligibleEvidence).toBe(0);
    expect(plan.sideEffects.writesPerformed).toBe(false);
  });

  it('embeds algorithmVersion in the result', async () => {
    const db = makePrisma([], []);
    const plan = await buildOwnerHistoryProposalPlan(db as never, { workspaceId: WORKSPACE_ID });
    expect(plan.algorithmVersion).toBe(OWNER_HISTORY_PROPOSAL_VERSION);
  });

  it('ignores RULE and MANUAL bookings — only HISTORICAL source qualifies as evidence', async () => {
    const ruleBooking: FakeBooking = { ...booking('b10', 'type-credit', 'credit'), source: 'RULE' };
    const db = makePrisma([ruleBooking], [openTx('open-8', 'credit')]);
    const plan = await buildOwnerHistoryProposalPlan(db as never, { workspaceId: WORKSPACE_ID });

    expect(plan.counts.evidenceCandidates).toBe(0);
    expect(plan.proposals).toHaveLength(0);
  });
});
