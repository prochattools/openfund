import { describe, expect, it } from 'vitest';
import {
  OWNER_HISTORY_PROPOSAL_VERSION,
  buildOwnerHistoryProposalPlan,
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
});

const booking = (id: string, typeId: string, direction: 'credit' | 'debit', overrides: Partial<FakeBooking> = {}): FakeBooking => ({
  id,
  workspaceId: WORKSPACE_ID,
  source: 'HISTORICAL',
  projectId: 'project-ya',
  transactionTypeId: typeId,
  categoryId: 'category-gifts',
  evidenceHash: `hash-${id}`,
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

  it('disqualifies evidence when same type has both credit and debit bookings', async () => {
    const creditBooking = booking('b4', 'type-mixed', 'credit');
    const debitBooking = booking('b5', 'type-mixed', 'debit');
    const db = makePrisma([creditBooking, debitBooking], [openTx('open-2', 'credit')]);
    const plan = await buildOwnerHistoryProposalPlan(db as never, { workspaceId: WORKSPACE_ID });

    expect(plan.counts.disqualifiedDirectionConflict).toBe(2);
    expect(plan.counts.eligibleEvidence).toBe(0);
    expect(plan.proposals).toHaveLength(0);
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
    expect(plan.counts.uncovered + plan.counts.abstainedWeak).toBe(1);
  });

  it('returns deterministic planHash for identical inputs', async () => {
    const bookings = [booking('b8', 'type-credit', 'credit')];
    const txs = [openTx('open-5', 'credit')];
    const db = makePrisma(bookings, txs);

    const plan1 = await buildOwnerHistoryProposalPlan(db as never, { workspaceId: WORKSPACE_ID });
    const plan2 = await buildOwnerHistoryProposalPlan(db as never, { workspaceId: WORKSPACE_ID });

    expect(plan1.planHash).toBe(plan2.planHash);
    expect(plan1.planHash).toHaveLength(64);
  });

  it('returns different planHash when proposals differ', async () => {
    const bookings = [booking('b9', 'type-credit', 'credit')];
    const db1 = makePrisma(bookings, [openTx('open-6', 'credit')]);
    const db2 = makePrisma(bookings, [openTx('open-7', 'credit', 'Andere Stichting')]);

    const plan1 = await buildOwnerHistoryProposalPlan(db1 as never, { workspaceId: WORKSPACE_ID });
    const plan2 = await buildOwnerHistoryProposalPlan(db2 as never, { workspaceId: WORKSPACE_ID });

    expect(plan1.planHash).not.toBe(plan2.planHash);
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
