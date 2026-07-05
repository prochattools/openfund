import { describe, expect, it } from 'vitest';
import {
  decideDeterministicCategorization,
  type DeterministicHistoricalReplayCandidate,
  type DeterministicRuleCandidate,
} from '../../server/services/deterministicCategorizationService';

const transaction = {
  transactionId: 'tx-preview-1',
  importFingerprint: 'fingerprint-1',
  exactReplayKey: 'exact-key-1',
};

const completeRule = (overrides: Partial<DeterministicRuleCandidate> = {}): DeterministicRuleCandidate => ({
  ruleId: 'rule-1',
  active: true,
  approved: true,
  confidence: 'deterministic',
  projectId: 'project-1',
  transactionTypeId: 'type-1',
  categoryId: 'cat-1',
  evidenceHash: 'rule-evidence-1',
  ...overrides,
});

const historicalReplay = (
  overrides: Partial<DeterministicHistoricalReplayCandidate> = {},
): DeterministicHistoricalReplayCandidate => ({
  historicalRecordId: 'history-1',
  evidenceHash: 'history-evidence-1',
  exactReplayKey: 'exact-key-1',
  importFingerprint: 'fingerprint-1',
  confidence: 'exact',
  projectId: 'project-1',
  transactionTypeId: 'type-1',
  categoryId: 'cat-1',
  ...overrides,
});

describe('deterministic categorization service', () => {
  it('finalizes an approved unique complete rule', () => {
    const result = decideDeterministicCategorization({
      transaction,
      ruleCandidates: [completeRule()],
    });

    expect(result).toMatchObject({
      status: 'finalized',
      source: 'rule',
      projectId: 'project-1',
      transactionTypeId: 'type-1',
      categoryId: 'cat-1',
      evidence: {
        matchedRuleIds: ['rule-1'],
        reason: 'One approved complete deterministic rule matched.',
      },
      sideEffects: {
        createsTransactionBooking: false,
        closesPeriod: false,
      },
    });
    expect(result.evidenceHash).toHaveLength(64);
  });

  it('does not finalize inactive or unapproved rules', () => {
    expect(decideDeterministicCategorization({
      transaction,
      ruleCandidates: [completeRule({ active: false })],
    }).status).toBe('unmatched');

    expect(decideDeterministicCategorization({
      transaction,
      ruleCandidates: [completeRule({ approved: false })],
    }).status).toBe('unmatched');
  });

  it('keeps multiple matching rules as review suggestions', () => {
    const result = decideDeterministicCategorization({
      transaction,
      ruleCandidates: [
        completeRule({ ruleId: 'rule-1', evidenceHash: 'rule-evidence-1' }),
        completeRule({ ruleId: 'rule-2', evidenceHash: 'rule-evidence-2' }),
      ],
    });

    expect(result.status).toBe('review_suggested');
    expect(result.projectId).toBeNull();
    expect(result.suggestions).toHaveLength(2);
    expect(result.evidence.reason).toBe('Multiple matching rules require review.');
  });

  it('finalizes a complete exact historical replay', () => {
    const result = decideDeterministicCategorization({
      transaction,
      historicalReplayCandidates: [historicalReplay()],
    });

    expect(result).toMatchObject({
      status: 'finalized',
      source: 'historical_replay',
      projectId: 'project-1',
      transactionTypeId: 'type-1',
      categoryId: 'cat-1',
      evidence: {
        historicalRecordIds: ['history-1'],
        historicalEvidenceHashes: ['history-evidence-1'],
        matchedExactReplayKey: 'exact-key-1',
        reason: 'One complete exact historical replay matched.',
      },
    });
  });

  it('keeps partial historical replay in review', () => {
    const result = decideDeterministicCategorization({
      transaction,
      historicalReplayCandidates: [historicalReplay({ transactionTypeId: null })],
    });

    expect(result.status).toBe('review_suggested');
    expect(result.projectId).toBeNull();
    expect(result.suggestions[0]).toMatchObject({
      source: 'historical_replay',
      reason: 'Historical replay is missing project, type, or category.',
    });
  });

  it('keeps multiple historical replay dimension triples in review', () => {
    const result = decideDeterministicCategorization({
      transaction,
      historicalReplayCandidates: [
        historicalReplay({ historicalRecordId: 'history-1', evidenceHash: 'history-evidence-1' }),
        historicalReplay({
          historicalRecordId: 'history-2',
          evidenceHash: 'history-evidence-2',
          projectId: 'project-2',
        }),
      ],
    });

    expect(result.status).toBe('review_suggested');
    expect(result.suggestions).toHaveLength(2);
    expect(result.evidence.reason).toBe('Multiple historical replay dimension triples require review.');
  });

  it('finalizes when rule and historical replay agree', () => {
    const result = decideDeterministicCategorization({
      transaction,
      ruleCandidates: [completeRule()],
      historicalReplayCandidates: [historicalReplay()],
    });

    expect(result).toMatchObject({
      status: 'finalized',
      source: 'rule_and_historical_replay',
      projectId: 'project-1',
      transactionTypeId: 'type-1',
      categoryId: 'cat-1',
    });
    expect(result.evidence.matchedRuleIds).toEqual(['rule-1']);
    expect(result.evidence.historicalRecordIds).toEqual(['history-1']);
  });

  it('returns conflict when rule and historical replay disagree', () => {
    const result = decideDeterministicCategorization({
      transaction,
      ruleCandidates: [completeRule({ projectId: 'project-rule' })],
      historicalReplayCandidates: [historicalReplay({ projectId: 'project-history' })],
    });

    expect(result.status).toBe('conflict');
    expect(result.projectId).toBeNull();
    expect(result.suggestions).toHaveLength(2);
    expect(result.evidence.reason).toBe('Rule and historical replay disagree.');
  });

  it('does not finalize when complete evidence is mixed with partial evidence', () => {
    const result = decideDeterministicCategorization({
      transaction,
      ruleCandidates: [completeRule()],
      historicalReplayCandidates: [historicalReplay({ transactionTypeId: null })],
    });

    expect(result.status).toBe('review_suggested');
    expect(result.projectId).toBeNull();
    expect(result.suggestions).toHaveLength(1);
    expect(result.suggestions[0]).toMatchObject({
      source: 'historical_replay',
      reason: 'Historical replay is missing project, type, or category.',
    });
    expect(result.sideEffects).toEqual({
      createsTransactionBooking: false,
      closesPeriod: false,
    });
  });

  it('does not finalize missing rule dimensions or non-deterministic confidence', () => {
    const missingDimension = decideDeterministicCategorization({
      transaction,
      ruleCandidates: [completeRule({ projectId: null })],
    });
    const fuzzyRule = decideDeterministicCategorization({
      transaction,
      ruleCandidates: [completeRule({ confidence: 'fuzzy' })],
    });

    expect(missingDimension.status).toBe('review_suggested');
    expect(fuzzyRule.status).toBe('review_suggested');
    expect(missingDimension.projectId).toBeNull();
    expect(fuzzyRule.projectId).toBeNull();
  });

  it('returns sanitized evidence without raw row dumps', () => {
    const result = decideDeterministicCategorization({
      transaction,
      ruleCandidates: [completeRule()],
      historicalReplayCandidates: [historicalReplay()],
    });
    const serialized = JSON.stringify(result);

    expect(serialized).toContain('rule-1');
    expect(serialized).toContain('history-evidence-1');
    expect(serialized).not.toContain('rawRow');
    expect(serialized).not.toContain('paymentPurpose');
    expect(serialized).not.toContain('counterparty');
    expect(serialized).not.toContain('Notifications');
    expect(result.sideEffects).toEqual({
      createsTransactionBooking: false,
      closesPeriod: false,
    });
  });
});
