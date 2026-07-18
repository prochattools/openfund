import { describe, expect, it } from 'vitest';
import {
  evaluateMerchantRetrievalAnchor,
  merchantAnchorContribution,
  MERCHANT_RETRIEVAL_ANCHOR_SCORE_BASIS_POINTS,
  MERCHANT_RETRIEVAL_ANCHOR_VERSION,
  type MerchantRetrievalAnchor,
} from '../../server/services/merchantRetrievalAnchor';

const evidence = (aliasId: string, merchantId: string, precedence: number) => ({
  aliasId,
  merchantId,
  signalType: 'IBAN' as const,
  fingerprintHash: `fingerprint-${aliasId}`,
  aliasStatus: 'TRUSTED' as const,
  precedence,
  evidenceHash: `evidence-${aliasId}`,
});

const readyAnchor = (overrides: Partial<MerchantRetrievalAnchor> = {}): MerchantRetrievalAnchor => ({
  workspaceId: 'workspace-1',
  transactionId: 'target-1',
  merchantId: 'merchant-1',
  anchorVersion: MERCHANT_RETRIEVAL_ANCHOR_VERSION,
  resolutionVersion: 'merchant-alias-resolution-v1',
  evidenceHash: 'anchor-evidence-1',
  sourceState: 'RESOLVED',
  supportingEvidence: [
    evidence('alias-z', 'merchant-1', 30),
    evidence('alias-a', 'merchant-1', 10),
  ],
  conflictingEvidence: [],
  stale: false,
  expired: false,
  readiness: 'READY',
  ...overrides,
});

describe('merchant retrieval anchor', () => {
  it('evaluates a deterministic workspace-matching ready anchor', () => {
    const anchor = readyAnchor();
    const first = evaluateMerchantRetrievalAnchor({
      workspaceId: 'workspace-1',
      transactionId: 'target-1',
      anchor,
    });
    const second = evaluateMerchantRetrievalAnchor({
      workspaceId: 'workspace-1',
      transactionId: 'target-1',
      anchor: readyAnchor({
        supportingEvidence: [...anchor.supportingEvidence].reverse(),
      }),
    });

    expect(first).toMatchObject({
      state: 'READY',
      usable: true,
      merchantId: 'merchant-1',
      anchorVersion: MERCHANT_RETRIEVAL_ANCHOR_VERSION,
      resolutionVersion: 'merchant-alias-resolution-v1',
      evidenceHash: 'anchor-evidence-1',
      scoreContributionBasisPoints: MERCHANT_RETRIEVAL_ANCHOR_SCORE_BASIS_POINTS,
    });
    expect(first.supportingEvidence.map((item) => item.aliasId)).toEqual(['alias-a', 'alias-z']);
    expect(second).toEqual(first);
    expect(first.evaluationHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('returns missing when no anchor exists or the feature is disabled', () => {
    const missing = evaluateMerchantRetrievalAnchor({
      workspaceId: 'workspace-1',
      transactionId: 'target-1',
    });
    const disabled = evaluateMerchantRetrievalAnchor({
      workspaceId: 'workspace-1',
      transactionId: 'target-1',
      anchor: readyAnchor(),
      enabled: false,
    });

    expect(missing).toMatchObject({ state: 'MISSING', usable: false, scoreContributionBasisPoints: 0 });
    expect(disabled).toMatchObject({ state: 'MISSING', usable: false, scoreContributionBasisPoints: 0 });
  });

  it('returns cross-workspace when workspace or transaction identity differs', () => {
    const workspaceMismatch = evaluateMerchantRetrievalAnchor({
      workspaceId: 'workspace-1',
      transactionId: 'target-1',
      anchor: readyAnchor({ workspaceId: 'workspace-2' }),
    });
    const transactionMismatch = evaluateMerchantRetrievalAnchor({
      workspaceId: 'workspace-1',
      transactionId: 'target-1',
      anchor: readyAnchor({ transactionId: 'target-2' }),
    });

    expect(workspaceMismatch.state).toBe('CROSS_WORKSPACE');
    expect(transactionMismatch.state).toBe('CROSS_WORKSPACE');
    expect(workspaceMismatch.scoreContributionBasisPoints).toBe(0);
    expect(transactionMismatch.scoreContributionBasisPoints).toBe(0);
  });

  it('returns unresolved when merchant identity is missing', () => {
    const result = evaluateMerchantRetrievalAnchor({
      workspaceId: 'workspace-1',
      transactionId: 'target-1',
      anchor: readyAnchor({ merchantId: null, sourceState: 'UNRESOLVED' }),
    });

    expect(result).toMatchObject({ state: 'UNRESOLVED', usable: false, merchantId: null, scoreContributionBasisPoints: 0 });
  });

  it('returns conflicted and preserves conflicting evidence', () => {
    const result = evaluateMerchantRetrievalAnchor({
      workspaceId: 'workspace-1',
      transactionId: 'target-1',
      anchor: readyAnchor({
        sourceState: 'CONFLICTED',
        conflictingEvidence: [
          evidence('alias-b', 'merchant-2', 10),
          evidence('alias-a', 'merchant-1', 10),
        ],
      }),
    });

    expect(result).toMatchObject({ state: 'CONFLICTED', usable: false, scoreContributionBasisPoints: 0 });
    expect(result.conflictingEvidence.map((item) => item.aliasId)).toEqual(['alias-a', 'alias-b']);
  });

  it('returns stale for caller-supplied stale or expired state without clock access', () => {
    const stale = evaluateMerchantRetrievalAnchor({
      workspaceId: 'workspace-1',
      transactionId: 'target-1',
      anchor: readyAnchor({ stale: true }),
    });
    const expired = evaluateMerchantRetrievalAnchor({
      workspaceId: 'workspace-1',
      transactionId: 'target-1',
      anchor: readyAnchor({ expired: true }),
    });

    expect(stale).toMatchObject({ state: 'STALE', usable: false, scoreContributionBasisPoints: 0 });
    expect(expired).toMatchObject({ state: 'STALE', usable: false, scoreContributionBasisPoints: 0 });
  });

  it('contributes 1,200 points only to matching merchant history', () => {
    const evaluated = evaluateMerchantRetrievalAnchor({
      workspaceId: 'workspace-1',
      transactionId: 'target-1',
      anchor: readyAnchor(),
    });

    expect(merchantAnchorContribution({ anchor: evaluated, historicalMerchantId: 'merchant-1' }))
      .toBe(1200);
    expect(merchantAnchorContribution({ anchor: evaluated, historicalMerchantId: 'merchant-2' }))
      .toBe(0);
    expect(merchantAnchorContribution({ anchor: evaluated, historicalMerchantId: null }))
      .toBe(0);
  });

  it('gives zero contribution for every non-ready state', () => {
    const anchors = [
      undefined,
      readyAnchor({ merchantId: null, sourceState: 'UNRESOLVED' }),
      readyAnchor({ sourceState: 'CONFLICTED', conflictingEvidence: [evidence('alias-x', 'merchant-2', 10)] }),
      readyAnchor({ stale: true }),
      readyAnchor({ workspaceId: 'workspace-2' }),
    ];

    for (const anchor of anchors) {
      const evaluated = evaluateMerchantRetrievalAnchor({
        workspaceId: 'workspace-1',
        transactionId: 'target-1',
        anchor,
      });
      expect(merchantAnchorContribution({ anchor: evaluated, historicalMerchantId: 'merchant-1' })).toBe(0);
    }
  });

  it('does not mutate anchor evidence', () => {
    const anchor = readyAnchor();
    const before = JSON.stringify(anchor);
    evaluateMerchantRetrievalAnchor({
      workspaceId: 'workspace-1',
      transactionId: 'target-1',
      anchor,
    });
    expect(JSON.stringify(anchor)).toBe(before);
  });
});
