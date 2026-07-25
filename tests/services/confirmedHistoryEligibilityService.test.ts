import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import {
  CONFIRMED_HISTORY_ELIGIBILITY_VERSION,
  evaluateConfirmedHistoryEligibility,
  loadConfirmedHistoryEligibility,
  type ConfirmedHistoryCandidate,
} from '../../server/services/confirmedHistoryEligibilityService';

const workspaceId = '11111111-1111-4111-8111-111111111111';
const otherWorkspaceId = '22222222-2222-4222-8222-222222222222';

const candidate = (
  id: string,
  action: ConfirmedHistoryCandidate['reviewDecisions'][number]['action'] = 'ASSIGN_MANUALLY',
  overrides: Partial<ConfirmedHistoryCandidate> = {},
): ConfirmedHistoryCandidate => ({
  id,
  userId: 'admin-user',
  date: new Date('2026-06-01T00:00:00.000Z'),
  accountId: 'account-1',
  direction: 'credit',
  amountMinor: 5000n,
  counterparty: 'Stichting Alpha',
  reference: 'Gift YA juni',
  description: 'Maandelijkse gift',
  rawRow: {
    'Counterparty IBAN': 'NL11BANK0123456789',
    Notifications: 'Gift YA juni',
  },
  ledger: { lockedAt: null },
  transactionBooking: {
    id: `booking-${id}`,
    workspaceId,
    projectId: 'project-ya',
    transactionTypeId: 'type-gift-in',
    categoryId: 'category-gifts',
    source: action === 'ACCEPT_SUGGESTION' ? 'HISTORICAL' : 'MANUAL',
    evidenceHash: `booking-evidence-${id}`,
    confirmedBy: 'admin-user',
    confirmedAt: new Date('2026-06-02T10:00:00.000Z'),
    project: { workspaceId },
    transactionType: { workspaceId },
    category: { workspaceId },
  },
  reviewDecisions: [{
    id: `decision-${id}`,
    workspaceId,
    transactionId: id,
    suggestionId: action === 'ACCEPT_SUGGESTION' ? `suggestion-${id}` : null,
    action,
    afterBookingId: action === 'REMOVE_BOOKING' ? null : `booking-${id}`,
    afterProjectId: action === 'REMOVE_BOOKING' ? null : 'project-ya',
    afterTypeId: action === 'REMOVE_BOOKING' ? null : 'type-gift-in',
    afterCategoryId: action === 'REMOVE_BOOKING' ? null : 'category-gifts',
    actorId: 'admin-user',
    evidenceHash: `decision-evidence-${id}`,
    decidedAt: new Date('2026-06-02T10:00:01.000Z'),
    suggestion: action === 'ACCEPT_SUGGESTION'
      ? { workspaceId, status: 'ACCEPTED' }
      : null,
  }],
  ...overrides,
});

const evaluate = (candidates: ConfirmedHistoryCandidate[]) =>
  evaluateConfirmedHistoryEligibility({ workspaceId, candidates });

describe('Program Phase 4.1 confirmed-history eligibility', () => {
  it.each(['ACCEPT_SUGGESTION', 'ASSIGN_MANUALLY', 'CHANGE_BOOKING'] as const)(
    'accepts a current complete booking confirmed by %s',
    (action) => {
      const result = evaluate([candidate(`eligible-${action}`, action)]);

      expect(result.eligibleHistory).toHaveLength(1);
      expect(result.exclusions).toEqual([]);
      expect(result.sideEffects).toEqual({
        writesPerformed: false,
        createsTransactionBooking: false,
        createsCategorizationSuggestion: false,
        mutatesBankFacts: false,
        mutatesPeriodState: false,
        invokesExternalModel: false,
      });
      expect(result.eligibleHistory[0]).toMatchObject({
        projectId: 'project-ya',
        transactionTypeId: 'type-gift-in',
        categoryId: 'category-gifts',
        confirmedHistory: {
          eligibilityVersion: CONFIRMED_HISTORY_ELIGIBILITY_VERSION,
          reviewAction: action,
          actorId: 'admin-user',
          workspaceId,
        },
      });
      expect(result.eligibleHistory[0]!.confirmedHistory.provenanceHash).toMatch(/^[a-f0-9]{64}$/);
    },
  );

  it('excludes removal, superseded booking, incomplete dimensions, and missing provenance', () => {
    const removed = candidate('removed', 'REMOVE_BOOKING');
    const superseded = candidate('superseded', 'CHANGE_BOOKING');
    superseded.reviewDecisions[0]!.afterBookingId = 'booking-old';
    const incomplete = candidate('incomplete');
    incomplete.transactionBooking!.categoryId = '';
    const missingProvenance = candidate('missing-provenance');
    missingProvenance.reviewDecisions[0]!.evidenceHash = '';

    const result = evaluate([removed, superseded, incomplete, missingProvenance]);

    expect(result.eligibleHistory).toEqual([]);
    expect(result.exclusions).toEqual([
      { transactionId: 'incomplete', reason: 'INCOMPLETE_DIMENSIONS' },
      { transactionId: 'missing-provenance', reason: 'MISSING_DECISION_PROVENANCE' },
      { transactionId: 'removed', reason: 'REMOVED_BY_LATEST_DECISION' },
      { transactionId: 'superseded', reason: 'CURRENT_BOOKING_SUPERSEDED' },
    ]);
  });

  it('uses only the latest decision and excludes a later removal', () => {
    const record = candidate('latest-removal', 'ASSIGN_MANUALLY');
    record.reviewDecisions.push({
      ...record.reviewDecisions[0]!,
      id: 'decision-latest-removal',
      action: 'REMOVE_BOOKING',
      afterBookingId: null,
      afterProjectId: null,
      afterTypeId: null,
      afterCategoryId: null,
      decidedAt: new Date('2026-06-03T10:00:00.000Z'),
    });

    expect(evaluate([record])).toMatchObject({
      eligibleHistory: [],
      exclusions: [{ transactionId: 'latest-removal', reason: 'REMOVED_BY_LATEST_DECISION' }],
    });
  });

  it.each(['PENDING', 'REJECTED', 'EXPIRED'] as const)(
    'excludes accepted-suggestion provenance when the suggestion is %s',
    (status) => {
      const record = candidate(`suggestion-${status}`, 'ACCEPT_SUGGESTION');
      record.reviewDecisions[0]!.suggestion = { workspaceId, status };

      expect(evaluate([record])).toMatchObject({
        eligibleHistory: [],
        exclusions: [{ transactionId: `suggestion-${status}`, reason: 'SUGGESTION_NOT_CONFIRMED' }],
      });
    },
  );

  it('excludes generated booked history without a human review decision', () => {
    const record = candidate('generated-without-human');
    record.reviewDecisions = [];
    record.transactionBooking!.source = 'RULE';

    expect(evaluate([record])).toMatchObject({
      eligibleHistory: [],
      exclusions: [{ transactionId: 'generated-without-human', reason: 'MISSING_REVIEW_DECISION' }],
    });
  });

  it('excludes cross-workspace bookings, decisions, suggestions, and dimensions', () => {
    const booking = candidate('cross-booking');
    booking.transactionBooking!.workspaceId = otherWorkspaceId;
    const decision = candidate('cross-decision');
    decision.reviewDecisions[0]!.workspaceId = otherWorkspaceId;
    const suggestion = candidate('cross-suggestion', 'ACCEPT_SUGGESTION');
    suggestion.reviewDecisions[0]!.suggestion = { workspaceId: otherWorkspaceId, status: 'ACCEPTED' };
    const dimension = candidate('cross-dimension');
    dimension.transactionBooking!.category.workspaceId = otherWorkspaceId;

    const result = evaluate([booking, decision, suggestion, dimension]);

    expect(result.eligibleHistory).toEqual([]);
    expect(result.exclusions).toEqual([
      { transactionId: 'cross-booking', reason: 'CROSS_WORKSPACE' },
      { transactionId: 'cross-decision', reason: 'CROSS_WORKSPACE' },
      { transactionId: 'cross-dimension', reason: 'CROSS_WORKSPACE' },
      { transactionId: 'cross-suggestion', reason: 'SUGGESTION_NOT_CONFIRMED' },
    ]);
  });

  it('is deterministic and preserves locked-period provenance without mutating period state', () => {
    const later = candidate('later');
    later.date = new Date('2026-06-05T00:00:00.000Z');
    const locked = candidate('locked');
    locked.ledger = { lockedAt: new Date('2026-07-01T00:00:00.000Z') };

    const first = evaluate([later, locked]);
    const second = evaluate([locked, later]);

    expect(first).toEqual(second);
    expect(first.eligibleHistory.map((item) => item.transactionId)).toEqual(['locked', 'later']);
    expect(first.eligibleHistory[0]!.confirmedHistory.ledgerLockedAt).toBe('2026-07-01T00:00:00.000Z');
    expect(first.sideEffects.mutatesPeriodState).toBe(false);
  });

  it('loads eligibility through one read query and performs no writes or transaction', async () => {
    const findMany = vi.fn().mockResolvedValue([candidate('loaded')]);
    const db = { transaction: { findMany } } as any;

    const result = await loadConfirmedHistoryEligibility(db, { workspaceId, userId: 'admin-user' });

    expect(result.eligibleHistory).toHaveLength(1);
    expect(findMany).toHaveBeenCalledTimes(1);
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        userId: 'admin-user',
        transactionBooking: { is: { workspaceId } },
      },
    }));
  });

  it('contains no write, booking, suggestion, bank-fact, backfill execution, or AI path', () => {
    const source = fs.readFileSync(path.join(process.cwd(), 'server/services/confirmedHistoryEligibilityService.ts'), 'utf8');
    expect(source).not.toMatch(/\.(create|update|delete|upsert|createMany|updateMany|deleteMany)\s*\(/);
    expect(source).not.toContain('$transaction');
    expect(source).not.toMatch(/OpenAI|Claude|Bedrock|invokeModel|generateText/i);
    expect(source).not.toMatch(/transactionBooking\.(create|update|delete)|categorizationSuggestion\.(create|update|delete)/);
  });
});
