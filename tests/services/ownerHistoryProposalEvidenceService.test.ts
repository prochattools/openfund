import { describe, expect, it } from 'vitest';
import {
  OWNER_HISTORY_PROPOSAL_VERSION,
  OWNER_HISTORY_PRODUCER_KEY,
  OWNER_HISTORY_PRODUCER_VERSION,
  buildOwnerHistoryProposalPlan,
  executeOwnerHistoryProposalPlan,
} from '../../server/services/ownerHistoryProposalEvidenceService';

const WORKSPACE_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const USER_ID = 'user-1';

type FakeCandidate = {
  id: string;
  userId: string;
  date: Date;
  accountId: string | null;
  direction: 'credit' | 'debit';
  amountMinor: bigint;
  counterparty: string | null;
  reference: string | null;
  description: string;
  rawRow: unknown;
  ledger: { lockedAt: Date | null } | null;
  transactionBooking: {
    id: string;
    workspaceId: string;
    projectId: string;
    transactionTypeId: string;
    categoryId: string;
    source: 'HISTORICAL' | 'MANUAL';
    evidenceHash: string;
    confirmedBy: string | null;
    confirmedAt: Date;
    project: { workspaceId: string };
    transactionType: { workspaceId: string };
    category: { workspaceId: string };
  } | null;
  reviewDecisions: Array<{
    id: string;
    workspaceId: string;
    transactionId: string;
    suggestionId: string | null;
    action: 'ACCEPT_SUGGESTION' | 'ASSIGN_MANUALLY' | 'CHANGE_BOOKING' | 'REMOVE_BOOKING';
    afterBookingId: string | null;
    afterProjectId: string | null;
    afterTypeId: string | null;
    afterCategoryId: string | null;
    actorId: string;
    evidenceHash: string;
    decidedAt: Date;
    suggestion: { workspaceId: string; status: string } | null;
  }>;
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

const confirmedCandidate = (
  id: string,
  direction: 'credit' | 'debit',
  action: 'ACCEPT_SUGGESTION' | 'ASSIGN_MANUALLY' | 'CHANGE_BOOKING' = 'ASSIGN_MANUALLY',
  overrides: Partial<FakeCandidate> = {},
): FakeCandidate => ({
  id: `tx-${id}`,
  userId: USER_ID,
  date: new Date('2024-06-01T00:00:00.000Z'),
  accountId: 'acc-1',
  direction,
  amountMinor: 5000n,
  counterparty: 'Stichting Alpha',
  reference: null,
  description: 'Gift YA',
  rawRow: null,
  ledger: { lockedAt: null },
  transactionBooking: {
    id: `booking-${id}`,
    workspaceId: WORKSPACE_ID,
    projectId: 'project-ya',
    transactionTypeId: `type-${direction}`,
    categoryId: 'category-gifts',
    source: action === 'ACCEPT_SUGGESTION' ? 'HISTORICAL' : 'MANUAL',
    evidenceHash: `hash-${id}`,
    confirmedBy: USER_ID,
    confirmedAt: new Date('2024-06-02T00:00:00.000Z'),
    project: { workspaceId: WORKSPACE_ID },
    transactionType: { workspaceId: WORKSPACE_ID },
    category: { workspaceId: WORKSPACE_ID },
  },
  reviewDecisions: [{
    id: `decision-${id}`,
    workspaceId: WORKSPACE_ID,
    transactionId: `tx-${id}`,
    suggestionId: action === 'ACCEPT_SUGGESTION' ? `suggestion-${id}` : null,
    action,
    afterBookingId: `booking-${id}`,
    afterProjectId: 'project-ya',
    afterTypeId: `type-${direction}`,
    afterCategoryId: 'category-gifts',
    actorId: USER_ID,
    evidenceHash: `decision-evidence-${id}`,
    decidedAt: new Date('2024-06-02T00:00:01.000Z'),
    suggestion: action === 'ACCEPT_SUGGESTION'
      ? { workspaceId: WORKSPACE_ID, status: 'ACCEPTED' }
      : null,
  }],
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

const makePrisma = (candidates: FakeCandidate[], openTxs: FakeOpenTx[]) => ({
  transaction: {
    findMany: async ({ where }: { where: Record<string, unknown> }) => {
      if (where.transactionBooking === null) {
        return openTxs;
      }
      if (where.transactionBooking && typeof where.transactionBooking === 'object' && 'is' in where.transactionBooking) {
        return candidates;
      }
      return [];
    },
  },
  categorizationSuggestion: {
    findMany: async () => [],
  },
});

const makeExecutionPrisma = (
  candidates: FakeCandidate[],
  openTxs: FakeOpenTx[],
  initialSuggestions: Array<{ id: string; transactionId: string; evidenceHash: string; status: string; evidence: unknown; producerKey?: string | null; producerVersion?: string | null; planHash?: string | null }> = [],
) => {
  const suggestions = [...initialSuggestions];
  const db = {
    ...makePrisma(candidates, openTxs),
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

describe('buildOwnerHistoryProposalPlan', () => {
  it('returns sideEffects with all false except requiresAdministratorApproval', async () => {
    const db = makePrisma([], []);
    const plan = await buildOwnerHistoryProposalPlan(db as never, { workspaceId: WORKSPACE_ID, userId: USER_ID });

    expect(plan.sideEffects.writesPerformed).toBe(false);
    expect(plan.sideEffects.createsTransactionBooking).toBe(false);
    expect(plan.sideEffects.createsReviewDecision).toBe(false);
    expect(plan.sideEffects.requiresAdministratorApproval).toBe(true);
  });

  it('records provenance proof showing it qualifies under confirmedHistoryEligibilityService', async () => {
    const db = makePrisma([confirmedCandidate('b1', 'credit')], []);
    const plan = await buildOwnerHistoryProposalPlan(db as never, { workspaceId: WORKSPACE_ID, userId: USER_ID });

    expect(plan.provenanceProof.qualifiesUnderConfirmedHistoryEligibilityService).toBe(true);
    expect(plan.provenanceProof.exclusionReason).toBeNull();
    expect(plan.provenanceProof.evidenceBookingsLoadedFromSource).toBe('CONFIRMED_HISTORY_ELIGIBILITY');
    expect(plan.provenanceProof.reviewDecisionRequired).toBe(true);
    expect(plan.provenanceProof.eligibilityVersion).toBeDefined();
  });

  it('counts evidence candidates and open transactions from confirmed history', async () => {
    const candidates = [confirmedCandidate('b1', 'credit'), confirmedCandidate('b2', 'credit')];
    const txs = [openTx('open-1', 'credit')];
    const db = makePrisma(candidates, txs);
    const plan = await buildOwnerHistoryProposalPlan(db as never, { workspaceId: WORKSPACE_ID, userId: USER_ID });

    expect(plan.counts.evidenceCandidates).toBe(2);
    expect(plan.counts.openTransactions).toBe(1);
  });

  it('accepts MANUAL source bookings confirmed via ASSIGN_MANUALLY', async () => {
    const candidates = [confirmedCandidate('manual-1', 'credit', 'ASSIGN_MANUALLY')];
    const txs = [openTx('open-manual', 'credit')];
    const db = makePrisma(candidates, txs);
    const plan = await buildOwnerHistoryProposalPlan(db as never, { workspaceId: WORKSPACE_ID, userId: USER_ID });

    expect(plan.counts.eligibleEvidence).toBe(1);
    expect(plan.proposals.length).toBeGreaterThan(0);
    expect(plan.proposals[0]!.rank1.projectId).toBe('project-ya');
  });

  it('accepts bookings confirmed via ACCEPT_SUGGESTION', async () => {
    const candidates = [confirmedCandidate('accept-1', 'credit', 'ACCEPT_SUGGESTION')];
    const txs = [openTx('open-accept', 'credit')];
    const db = makePrisma(candidates, txs);
    const plan = await buildOwnerHistoryProposalPlan(db as never, { workspaceId: WORKSPACE_ID, userId: USER_ID });

    expect(plan.counts.eligibleEvidence).toBe(1);
    expect(plan.proposals.length).toBeGreaterThan(0);
  });

  it('accepts bookings confirmed via CHANGE_BOOKING', async () => {
    const candidates = [confirmedCandidate('change-1', 'credit', 'CHANGE_BOOKING')];
    const txs = [openTx('open-change', 'credit')];
    const db = makePrisma(candidates, txs);
    const plan = await buildOwnerHistoryProposalPlan(db as never, { workspaceId: WORKSPACE_ID, userId: USER_ID });

    expect(plan.counts.eligibleEvidence).toBe(1);
    expect(plan.proposals.length).toBeGreaterThan(0);
  });

  it('allows a mixed historical Type to provide evidence within each factual direction partition', async () => {
    const creditCandidate = confirmedCandidate('b4', 'credit');
    const debitCandidate = confirmedCandidate('b5', 'debit');
    const db = makePrisma([creditCandidate, debitCandidate], [openTx('open-2-credit', 'credit'), openTx('open-2-debit', 'debit')]);
    const plan = await buildOwnerHistoryProposalPlan(db as never, { workspaceId: WORKSPACE_ID, userId: USER_ID });

    expect(plan.counts.eligibleEvidence).toBe(2);
    expect(plan.proposals.map((proposal) => proposal.transactionId).sort()).toEqual(['open-2-credit', 'open-2-debit']);
  });

  it('produces proposals for open transactions matched by eligible evidence', async () => {
    const candidates = [confirmedCandidate('b6', 'credit')];
    const txs = [openTx('open-3', 'credit')];
    const db = makePrisma(candidates, txs);
    const plan = await buildOwnerHistoryProposalPlan(db as never, { workspaceId: WORKSPACE_ID, userId: USER_ID });

    expect(plan.proposals.length).toBeGreaterThan(0);
    const proposal = plan.proposals.find((p) => p.transactionId === 'open-3');
    expect(proposal).toBeDefined();
    expect(proposal!.rank1.projectId).toBe('project-ya');
    expect(proposal!.rank1.transactionTypeId).toBe('type-credit');
    expect(proposal!.rank1.categoryId).toBe('category-gifts');
  });

  it('does not produce proposals for open transactions with wrong direction', async () => {
    const candidates = [confirmedCandidate('b7', 'credit')];
    const txs = [openTx('open-4', 'debit')];
    const db = makePrisma(candidates, txs);
    const plan = await buildOwnerHistoryProposalPlan(db as never, { workspaceId: WORKSPACE_ID, userId: USER_ID });

    expect(plan.proposals).toHaveLength(0);
    expect(plan.counts.abstainedNoFactualDirectionMatch).toBe(1);
  });

  it('returns deterministic planHash for identical inputs', async () => {
    const candidates = [confirmedCandidate('b8', 'credit')];
    const txs = [openTx('open-5', 'credit')];
    const db = makePrisma(candidates, txs);

    const plan1 = await buildOwnerHistoryProposalPlan(db as never, { workspaceId: WORKSPACE_ID, userId: USER_ID });
    const plan2 = await buildOwnerHistoryProposalPlan(db as never, { workspaceId: WORKSPACE_ID, userId: USER_ID });

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
    const base = makeExecutionPrisma([confirmedCandidate('b-ownership-hash', 'credit')], [target]);
    const basePlan = await buildOwnerHistoryProposalPlan(base.db as never, { workspaceId: WORKSPACE_ID, userId: USER_ID });
    const owned = makeExecutionPrisma([confirmedCandidate('b-ownership-hash', 'credit')], [target], [{
      id: 'owned-for-hash', transactionId: target.id, evidenceHash: basePlan.proposals[0]!.rank1.evidenceHash, status: 'PENDING', evidence: {},
      producerKey: OWNER_HISTORY_PRODUCER_KEY, producerVersion: OWNER_HISTORY_PRODUCER_VERSION,
    }]);
    const ownedPlan = await buildOwnerHistoryProposalPlan(owned.db as never, { workspaceId: WORKSPACE_ID, userId: USER_ID });

    expect(ownedPlan.planHash).not.toBe(basePlan.planHash);
    expect(ownedPlan.persistence.plannedCreateCount).toBe(0);
    expect(ownedPlan.persistence.existingOwnedSuggestionCount).toBe(1);
  });

  it('excludes self evidence and evidence newer than the target', async () => {
    const self = confirmedCandidate('b-self', 'credit');
    const newer = confirmedCandidate('b-newer', 'credit', 'ASSIGN_MANUALLY', {
      id: 'tx-newer',
      date: new Date('2027-01-01T00:00:00.000Z'),
      reviewDecisions: [{
        id: 'decision-newer',
        workspaceId: WORKSPACE_ID,
        transactionId: 'tx-newer',
        suggestionId: null,
        action: 'ASSIGN_MANUALLY',
        afterBookingId: 'booking-newer',
        afterProjectId: 'project-ya',
        afterTypeId: 'type-credit',
        afterCategoryId: 'category-gifts',
        actorId: USER_ID,
        evidenceHash: 'decision-evidence-newer',
        decidedAt: new Date('2027-01-02T00:00:00.000Z'),
        suggestion: null,
      }],
      transactionBooking: {
        id: 'booking-newer',
        workspaceId: WORKSPACE_ID,
        projectId: 'project-ya',
        transactionTypeId: 'type-credit',
        categoryId: 'category-gifts',
        source: 'MANUAL',
        evidenceHash: 'hash-newer',
        confirmedBy: USER_ID,
        confirmedAt: new Date('2027-01-02T00:00:00.000Z'),
        project: { workspaceId: WORKSPACE_ID },
        transactionType: { workspaceId: WORKSPACE_ID },
        category: { workspaceId: WORKSPACE_ID },
      },
    });
    const target: FakeOpenTx = { id: self.id, date: new Date('2026-06-15T00:00:00.000Z'), direction: 'credit', amountMinor: 5000n, counterparty: 'Stichting Alpha', description: 'Gift YA', accountId: 'acc-1', rawRow: null };
    const plan = await buildOwnerHistoryProposalPlan(makePrisma([self, newer], [target]) as never, { workspaceId: WORKSPACE_ID, userId: USER_ID });

    expect(plan.proposals).toHaveLength(0);
    expect(plan.counts.abstainedNoRankedCandidate).toBe(1);
  });

  it('rejects stale hashes and is idempotent for a matching hash', async () => {
    const { db, suggestions } = makeExecutionPrisma([confirmedCandidate('b-execute', 'credit')], [openTx('open-execute', 'credit')]);
    const plan = await buildOwnerHistoryProposalPlan(db as never, { workspaceId: WORKSPACE_ID, userId: USER_ID });

    const stale = await executeOwnerHistoryProposalPlan(db as never, {
      workspaceId: WORKSPACE_ID, userId: USER_ID, execute: true, executionAllowed: true, confirmedPlanHash: 'stale',
    });
    const first = await executeOwnerHistoryProposalPlan(db as never, {
      workspaceId: WORKSPACE_ID, userId: USER_ID, execute: true, executionAllowed: true, confirmedPlanHash: plan.planHash,
    });
    const replay = await executeOwnerHistoryProposalPlan(db as never, {
      workspaceId: WORKSPACE_ID, userId: USER_ID, execute: true, executionAllowed: true, confirmedPlanHash: plan.planHash,
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
      [confirmedCandidate('b-owned', 'credit')],
      [target],
      [unrelated],
    );
    const plan = await buildOwnerHistoryProposalPlan(db as never, { workspaceId: WORKSPACE_ID, userId: USER_ID });

    const result = await executeOwnerHistoryProposalPlan(db as never, {
      workspaceId: WORKSPACE_ID,
      userId: USER_ID,
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
    const { db, suggestions } = makeExecutionPrisma([confirmedCandidate('b-exact-owner', 'credit')], [target], [ownedStale, otherProducer]);
    const plan = await buildOwnerHistoryProposalPlan(db as never, { workspaceId: WORKSPACE_ID, userId: USER_ID });
    const result = await executeOwnerHistoryProposalPlan(db as never, {
      workspaceId: WORKSPACE_ID, userId: USER_ID, execute: true, executionAllowed: true, confirmedPlanHash: plan.planHash,
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
    const candidates = [confirmedCandidate('b9', 'credit')];
    const db1 = makePrisma(candidates, [openTx('open-6', 'credit')]);
    const db2 = makePrisma(candidates, [openTx('open-7', 'credit', 'Andere Stichting')]);

    const plan1 = await buildOwnerHistoryProposalPlan(db1 as never, { workspaceId: WORKSPACE_ID, userId: USER_ID });
    const plan2 = await buildOwnerHistoryProposalPlan(db2 as never, { workspaceId: WORKSPACE_ID, userId: USER_ID });

    expect(plan1.planHash).not.toBe(plan2.planHash);
  });

  it('is invariant to equivalent evidence ordering and changes when factual direction changes', async () => {
    const credit = confirmedCandidate('b-order-credit', 'credit');
    const debit = confirmedCandidate('b-order-debit', 'debit');
    const target = openTx('open-order', 'credit');

    const first = await buildOwnerHistoryProposalPlan(makePrisma([credit, debit], [target]) as never, { workspaceId: WORKSPACE_ID, userId: USER_ID });
    const reordered = await buildOwnerHistoryProposalPlan(makePrisma([debit, credit], [target]) as never, { workspaceId: WORKSPACE_ID, userId: USER_ID });
    const changedDirection = await buildOwnerHistoryProposalPlan(makePrisma([credit, debit], [{ ...target, direction: 'debit' }]) as never, { workspaceId: WORKSPACE_ID, userId: USER_ID });

    expect(reordered.planHash).toBe(first.planHash);
    expect(changedDirection.planHash).not.toBe(first.planHash);
  });

  it('excludes candidates without review decisions via confirmed history eligibility', async () => {
    const noDecision = confirmedCandidate('b-no-decision', 'credit', 'ASSIGN_MANUALLY', {
      reviewDecisions: [],
    });
    const plan = await buildOwnerHistoryProposalPlan(makePrisma([noDecision], [openTx('open-no-decision', 'credit')]) as never, { workspaceId: WORKSPACE_ID, userId: USER_ID });

    expect(plan.counts.eligibleEvidence).toBe(0);
    expect(plan.provenanceProof.exclusionSummary).toHaveProperty('MISSING_REVIEW_DECISION');
  });

  it('excludes candidates whose latest decision is REMOVE_BOOKING', async () => {
    const removed = confirmedCandidate('b-removed', 'credit', 'ASSIGN_MANUALLY', {
      reviewDecisions: [{
        id: 'decision-removed',
        workspaceId: WORKSPACE_ID,
        transactionId: 'tx-b-removed',
        suggestionId: null,
        action: 'REMOVE_BOOKING',
        afterBookingId: null,
        afterProjectId: null,
        afterTypeId: null,
        afterCategoryId: null,
        actorId: USER_ID,
        evidenceHash: 'decision-evidence-removed',
        decidedAt: new Date('2024-06-03T00:00:00.000Z'),
        suggestion: null,
      }],
    });
    const plan = await buildOwnerHistoryProposalPlan(makePrisma([removed], [openTx('open-removed', 'credit')]) as never, { workspaceId: WORKSPACE_ID, userId: USER_ID });

    expect(plan.counts.eligibleEvidence).toBe(0);
    expect(plan.provenanceProof.exclusionSummary).toHaveProperty('REMOVED_BY_LATEST_DECISION');
  });

  it('no longer depends on transactionBooking source=HISTORICAL — MANUAL source is eligible', async () => {
    const manualSource = confirmedCandidate('b-manual-source', 'credit', 'ASSIGN_MANUALLY');
    expect(manualSource.transactionBooking!.source).toBe('MANUAL');
    const db = makePrisma([manualSource], [openTx('open-manual-source', 'credit')]);
    const plan = await buildOwnerHistoryProposalPlan(db as never, { workspaceId: WORKSPACE_ID, userId: USER_ID });

    expect(plan.counts.eligibleEvidence).toBe(1);
    expect(plan.proposals).toHaveLength(1);
    expect(plan.proposals[0]!.rank1.projectId).toBe('project-ya');
  });

  it('suggestions stay PENDING only — never creates TransactionBooking or ReviewDecision', async () => {
    const { db, suggestions } = makeExecutionPrisma([confirmedCandidate('b-pending-only', 'credit')], [openTx('open-pending-only', 'credit')]);
    const plan = await buildOwnerHistoryProposalPlan(db as never, { workspaceId: WORKSPACE_ID, userId: USER_ID });
    const result = await executeOwnerHistoryProposalPlan(db as never, {
      workspaceId: WORKSPACE_ID, userId: USER_ID, execute: true, executionAllowed: true, confirmedPlanHash: plan.planHash,
    });

    expect(result.sideEffects.createsTransactionBooking).toBe(false);
    expect(result.sideEffects.createsReviewDecision).toBe(false);
    expect(result.sideEffects.mutatesBankFacts).toBe(false);
    expect(result.sideEffects.createsCategorizationSuggestion).toBe(true);
    for (const s of suggestions) {
      expect(s.status).toBe('PENDING');
    }
  });

  it('embeds algorithmVersion in the result', async () => {
    const db = makePrisma([], []);
    const plan = await buildOwnerHistoryProposalPlan(db as never, { workspaceId: WORKSPACE_ID, userId: USER_ID });
    expect(plan.algorithmVersion).toBe(OWNER_HISTORY_PROPOSAL_VERSION);
  });
});
