import { describe, expect, it } from 'vitest';
import { runOwnerHistoryProposalExecuteCli } from '../../server/cli/runOwnerHistoryProposalExecute';
import type { OwnerHistoryProposalPlan } from '../../server/services/ownerHistoryProposalEvidenceService';

const minimalEnv = { DATABASE_URL: 'postgresql://finance_user:x@localhost:5433/finance?schema=finance', DEFAULT_WORKSPACE_ID: 'ws-1', DEFAULT_USER_ID: 'user-1' };

const makePlan = (overrides: Partial<OwnerHistoryProposalPlan> = {}): OwnerHistoryProposalPlan => ({
  algorithmVersion: 'owner-history-proposal-v2',
  workspaceId: 'ws-1',
  planHash: 'abc123',
  sideEffects: { writesPerformed: false, createsTransactionBooking: false, createsReviewDecision: false, requiresAdministratorApproval: true },
  provenanceProof: { evidenceBookingsLoadedFromSource: 'HISTORICAL', reviewDecisionRequired: false, qualifiesUnderConfirmedHistoryEligibilityService: false, exclusionReason: 'MISSING_REVIEW_DECISION' },
  counts: { evidenceCandidates: 10, disqualifiedIncomplete: 0, disqualifiedCrossWorkspace: 0, disqualifiedInactiveOrUnauthorizedTriple: 0, disqualifiedMissingSourceDirection: 0, eligibleEvidence: 10, openTransactions: 5, covered: 4, uncovered: 1, abstainedWeak: 1, abstainedMissingTargetDirection: 0, abstainedNoFactualDirectionMatch: 0, abstainedNoRankedCandidate: 0, abstained: 1 },
  matcherDistribution: { NORMALIZED_HISTORY: 4 },
  confidenceDistribution: { DEFAULT: 4 },
  persistence: { producerKey: 'owner-history', producerVersion: 'v2', rankPersistence: 'RANK_1_ONLY', existingOwnedSuggestionCount: 4, plannedCreateCount: 0, plannedExpirationCount: 0, ownershipStateHash: 'hash' },
  proposals: [],
  ...overrides,
});

describe('runOwnerHistoryProposalExecuteCli', () => {
  it('requires database, workspace, and user env vars', async () => {
    const output: string[] = [];
    const code = await runOwnerHistoryProposalExecuteCli({
      args: [], env: {},
      createDb: async () => { throw new Error('must not connect'); },
      write: (v) => output.push(v),
    });
    expect(code).toBe(2);
    expect(JSON.parse(output[0]!)).toMatchObject({ ok: false, errorCode: 'DATABASE_OR_WORKSPACE_REQUIRED' });
  });

  it('requires --confirmed-hash when --execute is passed', async () => {
    const output: string[] = [];
    const code = await runOwnerHistoryProposalExecuteCli({
      args: ['--execute'], env: minimalEnv,
      createDb: async () => { throw new Error('must not connect'); },
      write: (v) => output.push(v),
    });
    expect(code).toBe(2);
    expect(JSON.parse(output[0]!)).toMatchObject({ ok: false, errorCode: 'CONFIRMED_HASH_REQUIRED' });
  });

  it('dry-run returns planHash and confirms no writes without --execute', async () => {
    const plan = makePlan();
    const output: string[] = [];
    const code = await runOwnerHistoryProposalExecuteCli({
      args: [], env: minimalEnv,
      createDb: async () => ({
        db: { transactionBooking: { findMany: async () => [] }, transaction: { findMany: async () => [] }, categorizationSuggestion: { findMany: async () => [] }, $transaction: async (fn: (db: unknown) => unknown) => fn({}) } as never,
        disconnect: async () => {},
      }),
      write: (v) => output.push(v),
    });
    const result = JSON.parse(output[0]!);
    expect(code).toBe(0);
    expect(result.ok).toBe(true);
    expect(result.dryRun).toBe(true);
    expect(result.writesPerformed).toBe(false);
    expect(typeof result.planHash).toBe('string');
    expect(result.persistence.plannedCreateCount).toBe(0);
    expect(result.persistence.plannedExpirationCount).toBe(0);
    expect(result.nextStep).toContain('--confirmed-hash');
  });

  it('execute with correct hash returns CREATED status', async () => {
    const output: string[] = [];
    let capturedHash = '';
    let callCount = 0;
    const mockDb = {
      transactionBooking: { findMany: async () => [] },
      transaction: { findMany: async () => [] },
      categorizationSuggestion: { findMany: async () => [], updateMany: async () => ({ count: 0 }), createMany: async () => ({ count: 0 }) },
      $transaction: async (fn: (db: unknown) => unknown) => fn(mockDb),
    } as never;

    // First: dry-run to get hash
    await runOwnerHistoryProposalExecuteCli({
      args: [], env: minimalEnv,
      createDb: async () => ({ db: mockDb, disconnect: async () => {} }),
      write: (v) => { if (callCount++ === 0) capturedHash = JSON.parse(v).planHash; },
    });

    // Execute with confirmed hash
    const code = await runOwnerHistoryProposalExecuteCli({
      args: ['--execute', '--confirmed-hash', capturedHash], env: minimalEnv,
      createDb: async () => ({ db: mockDb, disconnect: async () => {} }),
      write: (v) => output.push(v),
    });
    const result = JSON.parse(output[0]!);
    expect(code).toBe(0);
    expect(result.ok).toBe(true);
    expect(result.status).toBe('CREATED');
    expect(result.dryRun).toBe(false);
    expect(result.sideEffects.createsTransactionBooking).toBe(false);
    expect(result.sideEffects.createsReviewDecision).toBe(false);
    expect(result.sideEffects.mutatesBankFacts).toBe(false);
  });

  it('execute with wrong hash returns HASH_DRIFT and exits 1', async () => {
    const output: string[] = [];
    const mockDb = {
      transactionBooking: { findMany: async () => [] },
      transaction: { findMany: async () => [] },
      categorizationSuggestion: { findMany: async () => [] },
      $transaction: async (fn: (db: unknown) => unknown) => fn(mockDb),
    } as never;

    const code = await runOwnerHistoryProposalExecuteCli({
      args: ['--execute', '--confirmed-hash', 'wrong-hash'], env: minimalEnv,
      createDb: async () => ({ db: mockDb, disconnect: async () => {} }),
      write: (v) => output.push(v),
    });
    const result = JSON.parse(output[0]!);
    expect(code).toBe(1);
    expect(result.ok).toBe(false);
    expect(result.status).toBe('HASH_DRIFT');
  });
});
