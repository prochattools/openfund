import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  DETERMINISTIC_ORCHESTRATION_VERSION,
  DeterministicOrchestrationError,
  orchestrateDeterministicDecision,
} from '../../server/services/deterministicDecisionOrchestrationService';
import { buildDeterministicDecision } from '../../server/services/deterministicDecisionService';
import { buildRestrictedRetrievalCandidates } from '../../server/services/restrictedRetrievalCandidateService';
import { buildDeterministicRetrievalEvidence } from '../../server/services/deterministicRetrievalEvidenceService';
import { retrieveDeterministicConfirmedHistory } from '../../server/services/deterministicHistoryRetrievalService';
import {
  CONFIRMED_HISTORY_ELIGIBILITY_VERSION,
  type EligibleConfirmedHistoryBooking,
} from '../../server/services/confirmedHistoryEligibilityService';
import {
  decideDeterministicCategorization,
  type DeterministicRuleCandidate,
} from '../../server/services/deterministicCategorizationService';
import {
  evaluateMerchantRetrievalAnchor,
  MERCHANT_RETRIEVAL_ANCHOR_VERSION,
  type MerchantRetrievalAnchor,
} from '../../server/services/merchantRetrievalAnchor';
import type { HistorySuggestionFacts } from '../../server/services/historySuggestionService';

const workspaceId = 'workspace-1';
const transactionId = 'target-1';

const target = (): HistorySuggestionFacts => ({
  transactionId,
  date: new Date('2026-07-01T00:00:00.000Z'),
  accountId: 'account-1',
  direction: 'credit',
  amountMinor: 5000n,
  counterparty: 'Stichting Alpha',
  counterpartyIban: 'NL11BANK0123456789',
  description: 'Maandelijkse gift juli',
  paymentPurpose: 'Gift project YA',
});

const history = (): EligibleConfirmedHistoryBooking => ({
  transactionId: 'history-1',
  date: new Date('2025-07-01T00:00:00.000Z'),
  accountId: 'account-1',
  direction: 'credit',
  amountMinor: 5000n,
  counterparty: 'Stichting Alpha',
  counterpartyIban: 'NL11BANK0123456789',
  description: 'Maandelijkse gift juli',
  paymentPurpose: 'Gift project YA',
  bookingId: 'booking-1',
  projectId: 'project-a',
  transactionTypeId: 'type-a',
  categoryId: 'category-a',
  bookingEvidenceHash: 'booking-hash-1',
  confirmedHistory: {
    eligibilityVersion: CONFIRMED_HISTORY_ELIGIBILITY_VERSION,
    workspaceId,
    transactionId: 'history-1',
    bookingId: 'booking-1',
    reviewDecisionId: 'decision-1',
    reviewAction: 'ASSIGN_MANUALLY',
    actorId: 'admin-user',
    bookingSource: 'MANUAL',
    bookingEvidenceHash: 'booking-hash-1',
    decisionEvidenceHash: 'decision-hash-1',
    confirmedAt: '2025-07-01T10:00:00.000Z',
    decidedAt: '2025-07-01T10:00:01.000Z',
    projectId: 'project-a',
    transactionTypeId: 'type-a',
    categoryId: 'category-a',
    ledgerLockedAt: null,
    provenanceHash: 'provenance-history-1',
  },
});

const buildDecision = () => {
  const targetFacts = target();
  const retrieval = retrieveDeterministicConfirmedHistory({
    workspaceId,
    target: targetFacts,
    eligibleHistory: [history()],
    minimumScoreBasisPoints: 0,
  });
  const evidence = buildDeterministicRetrievalEvidence({
    workspaceId,
    target: targetFacts,
    eligibleHistory: [history()],
    retrieval,
  });
  const candidates = buildRestrictedRetrievalCandidates({
    workspaceId,
    evidence,
    projectRecords: [{ id: 'project-a', workspaceId, isActive: true }],
    transactionTypeRecords: [{ id: 'type-a', workspaceId, isActive: true }],
    categoryRecords: [{ id: 'category-a', workspaceId, isActive: true }],
  });
  return buildDeterministicDecision({
    workspaceId,
    transactionFactHash: 'transaction-fact-hash',
    retrieval,
    evidence,
    candidates,
  });
};

const rule = (overrides: Partial<DeterministicRuleCandidate> = {}) => decideDeterministicCategorization({
  transaction: {
    transactionId,
    importFingerprint: 'fingerprint-1',
    exactReplayKey: 'exact-key-1',
  },
  ruleCandidates: [{
    ruleId: 'rule-1',
    active: true,
    approved: true,
    confidence: 'deterministic',
    projectId: 'project-a',
    transactionTypeId: 'type-a',
    categoryId: 'category-a',
    evidenceHash: 'rule-evidence-1',
    ...overrides,
  }],
});

const merchantAnchor = (overrides: Partial<MerchantRetrievalAnchor> = {}) => evaluateMerchantRetrievalAnchor({
  workspaceId,
  transactionId,
  anchor: {
    workspaceId,
    transactionId,
    merchantId: 'merchant-1',
    anchorVersion: MERCHANT_RETRIEVAL_ANCHOR_VERSION,
    resolutionVersion: 'merchant-alias-resolution-v1',
    evidenceHash: 'merchant-evidence-1',
    sourceState: 'RESOLVED',
    supportingEvidence: [{
      aliasId: 'alias-1',
      merchantId: 'merchant-1',
      signalType: 'IBAN',
      fingerprintHash: 'fingerprint-hash-1',
      aliasStatus: 'TRUSTED',
      precedence: 10,
      evidenceHash: 'alias-evidence-1',
    }],
    conflictingEvidence: [],
    stale: false,
    expired: false,
    readiness: 'READY',
    ...overrides,
  },
});

describe('Program Phase 4.6 deterministic orchestration', () => {
  it('returns a deterministic matched Decision with canonical contributor order', () => {
    const decision = buildDecision();
    const first = orchestrateDeterministicDecision({
      workspaceId,
      targetTransactionId: transactionId,
      decision,
      ruleResult: rule(),
      merchantAnchor: merchantAnchor(),
    });
    const second = orchestrateDeterministicDecision({
      workspaceId,
      targetTransactionId: transactionId,
      decision,
      ruleResult: rule(),
      merchantAnchor: merchantAnchor({
        supportingEvidence: [...merchantAnchor().supportingEvidence].reverse(),
      }),
    });

    expect(first.orchestrationVersion).toBe(DETERMINISTIC_ORCHESTRATION_VERSION);
    expect(first.status).toBe('MATCHED');
    expect(first.finalDecision).toEqual(decision);
    expect(first.contributors.map((item) => item.contributor)).toEqual([
      'RULE', 'MERCHANT', 'RETRIEVAL', 'EVIDENCE', 'CANDIDATES', 'DECISION',
    ]);
    expect(first.contributors.find((item) => item.contributor === 'RULE')).toMatchObject({
      status: 'MATCHED',
      reason: 'RULE_AGREES_WITH_DECISION',
    });
    expect(first.orchestrationHash).toMatch(/^[a-f0-9]{64}$/);
    expect(second).toEqual(first);
  });

  it('permits a valid history Decision when optional rule and merchant contributors are unavailable', () => {
    const result = orchestrateDeterministicDecision({
      workspaceId,
      targetTransactionId: transactionId,
      decision: buildDecision(),
    });

    expect(result.status).toBe('MATCHED');
    expect(result.contributors.find((item) => item.contributor === 'RULE')?.status).toBe('UNAVAILABLE');
    expect(result.contributors.find((item) => item.contributor === 'MERCHANT')?.status).toBe('UNAVAILABLE');
  });

  it('returns conflict when a finalized rule disagrees with the Decision', () => {
    const result = orchestrateDeterministicDecision({
      workspaceId,
      targetTransactionId: transactionId,
      decision: buildDecision(),
      ruleResult: rule({ projectId: 'project-b' }),
    });

    expect(result).toMatchObject({
      status: 'CONFLICTED',
      reason: 'RULE_CONFLICTS_WITH_DECISION',
      finalDecision: null,
    });
  });

  it('preserves Merchant Knowledge ready, stale, and conflict states without mutating the Decision', () => {
    const ready = orchestrateDeterministicDecision({
      workspaceId,
      targetTransactionId: transactionId,
      decision: buildDecision(),
      merchantAnchor: merchantAnchor(),
    });
    expect(ready.status).toBe('MATCHED');
    expect(ready.contributors.find((item) => item.contributor === 'MERCHANT')).toMatchObject({
      status: 'MATCHED',
      reason: 'MERCHANT_READY',
    });

    const stale = orchestrateDeterministicDecision({
      workspaceId,
      targetTransactionId: transactionId,
      decision: buildDecision(),
      merchantAnchor: merchantAnchor({ stale: true }),
    });
    expect(stale.status).toBe('MATCHED');
    expect(stale.contributors.find((item) => item.contributor === 'MERCHANT')?.status).toBe('STALE');

    const conflicted = orchestrateDeterministicDecision({
      workspaceId,
      targetTransactionId: transactionId,
      decision: buildDecision(),
      merchantAnchor: merchantAnchor({
        sourceState: 'CONFLICTED',
        conflictingEvidence: [{
          aliasId: 'alias-2',
          merchantId: 'merchant-2',
          signalType: 'IBAN',
          fingerprintHash: 'fingerprint-hash-2',
          aliasStatus: 'TRUSTED',
          precedence: 10,
          evidenceHash: 'alias-evidence-2',
        }],
      }),
    });
    expect(conflicted).toMatchObject({ status: 'CONFLICTED', reason: 'MERCHANT_CONFLICT', finalDecision: null });
  });

  it.each([
    ['ABSTAINED', 'ABSTAINED', 'DECISION_ABSTAINED'],
    ['CONFLICTED', 'CONFLICTED', 'DECISION_CONFLICTED'],
    ['INCOMPLETE', 'ABSTAINED', 'DECISION_INCOMPLETE'],
  ] as const)('propagates a %s mandatory Decision', (decisionStatus, status, reason) => {
    const decision = { ...buildDecision(), status: decisionStatus };
    const result = orchestrateDeterministicDecision({
      workspaceId,
      targetTransactionId: transactionId,
      decision,
    });

    expect(result.status).toBe(status);
    expect(result.reason).toBe(reason);
    expect(result.finalDecision).toBeNull();
  });

  it('rejects workspace, transaction, and stale orchestration identities', () => {
    const decision = buildDecision();
    expect(() => orchestrateDeterministicDecision({
      workspaceId: 'workspace-2',
      targetTransactionId: transactionId,
      decision,
    })).toThrowError(expect.objectContaining({ code: 'workspace_mismatch' }));
    expect(() => orchestrateDeterministicDecision({
      workspaceId,
      targetTransactionId: 'target-2',
      decision,
    })).toThrowError(expect.objectContaining({ code: 'transaction_mismatch' }));
    expect(() => orchestrateDeterministicDecision({
      workspaceId,
      targetTransactionId: transactionId,
      decision,
      expectedOrchestrationHash: 'stale',
    })).toThrowError(expect.objectContaining({ code: 'stale_orchestration' }));
  });

  it('returns privacy-safe contributor metadata and explicit zero-side-effect declarations', () => {
    const result = orchestrateDeterministicDecision({
      workspaceId,
      targetTransactionId: transactionId,
      decision: buildDecision(),
      ruleResult: rule(),
      merchantAnchor: merchantAnchor(),
    });
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain('NL11BANK0123456789');
    expect(serialized).not.toContain('Stichting Alpha');
    expect(serialized).not.toContain('Maandelijkse gift juli');
    expect(serialized).not.toContain('Gift project YA');
    expect(result.sideEffects).toEqual({
      readOnly: true,
      previewOnly: true,
      createsTransactionBooking: false,
      createsCategorizationSuggestion: false,
      mutatesBankFacts: false,
      mutatesReviewDecisions: false,
      mutatesPeriodState: false,
      mutatesLedgerRecords: false,
      mutatesMerchantKnowledge: false,
      persistsDecision: false,
      invokesExternalModel: false,
    });

    const source = fs.readFileSync(path.join(process.cwd(), 'server/services/deterministicDecisionOrchestrationService.ts'), 'utf8');
    expect(source).not.toMatch(/\.(create|update|delete|upsert|createMany|updateMany|deleteMany)\s*\(/);
    expect(source).not.toContain('$transaction');
    expect(source).not.toMatch(/OpenAI|Claude|Bedrock|invokeModel|generateText/i);
  });

  it('uses typed orchestration errors', () => {
    const error = new DeterministicOrchestrationError('stale_orchestration', 'stale');
    expect(error).toMatchObject({
      name: 'DeterministicOrchestrationError',
      code: 'stale_orchestration',
      message: 'stale',
    });
  });
});
