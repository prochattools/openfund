import { describe, expect, it } from 'vitest';
import {
  extractMerchantFingerprints,
  type MerchantFingerprintInput,
} from '../../server/services/merchantFingerprintExtractor';
import type { MerchantAliasRecord } from '../../server/services/merchantAliasResolver';
import type { MerchantIdentityRecord } from '../../server/services/merchantIdentityPlanService';
import {
  planMerchantBackfill,
  type ApprovedMerchantCorrection,
  type MerchantBackfillPlannerInput,
} from '../../server/services/merchantBackfillPlanner';

const workspaceId = 'workspace-1';

const transaction = (
  id: string,
  overrides: Partial<MerchantFingerprintInput> = {},
): MerchantFingerprintInput => ({
  workspaceId,
  transactionId: id,
  date: new Date(`2026-06-${String((Number(id.replace(/\D/g, '')) % 20) + 1).padStart(2, '0')}T00:00:00.000Z`),
  accountId: 'account-1',
  direction: 'credit',
  amountMinor: 5000n,
  counterparty: `Counterparty ${id}`,
  reference: `Gift ${id}`,
  rawRow: {
    'Counterparty IBAN': 'NL91 ABNA 0417 1643 00',
    Notifications: `Gift ${id}`,
  },
  ...overrides,
});

const merchants: MerchantIdentityRecord[] = [
  { id: 'merchant-1', workspaceId, status: 'ACTIVE', mergedIntoMerchantId: null },
  { id: 'merchant-2', workspaceId, status: 'ACTIVE', mergedIntoMerchantId: null },
];

const ibanHash = extractMerchantFingerprints(transaction('tx-1')).fingerprints
  .find((item) => item.signalType === 'IBAN')?.valueHash as string;

const trustedAlias = (overrides: Partial<MerchantAliasRecord> = {}): MerchantAliasRecord => ({
  id: 'alias-1',
  workspaceId,
  merchantId: 'merchant-1',
  signalType: 'IBAN',
  valueHash: ibanHash,
  status: 'TRUSTED',
  evidenceHash: 'evidence-alias-1',
  ...overrides,
});

const baseInput = (overrides: Partial<MerchantBackfillPlannerInput> = {}): MerchantBackfillPlannerInput => ({
  workspaceId,
  runKey: 'benchmark-221-v1',
  engineVersion: 'merchant-backfill-engine-v1',
  transactions: [transaction('tx-1')],
  merchants,
  aliases: [trustedAlias()],
  ...overrides,
});

const resultFor = (report: ReturnType<typeof planMerchantBackfill>, id: string) =>
  report.results.find((item) => item.transactionId === id);

describe('merchant backfill planner', () => {
  it('produces deterministic hashes and input-order-independent output', () => {
    const transactions = [transaction('tx-3'), transaction('tx-1'), transaction('tx-2')];
    const first = planMerchantBackfill(baseInput({ transactions }));
    const second = planMerchantBackfill(baseInput({
      transactions: [...transactions].reverse(),
      merchants: [...merchants].reverse(),
      aliases: [trustedAlias({ id: 'alias-z' }), trustedAlias({ id: 'alias-a' })].reverse(),
    }));
    const third = planMerchantBackfill(baseInput({
      transactions: [...transactions].reverse(),
      merchants: [...merchants].reverse(),
      aliases: [trustedAlias()],
    }));

    expect(third).toEqual(first);
    expect(first.sourceSnapshotHash).toMatch(/^[a-f0-9]{64}$/);
    expect(first.parametersHash).toMatch(/^[a-f0-9]{64}$/);
    expect(first.results.every((item) => item.resultId.match(/^[a-f0-9]{64}$/))).toBe(true);
    expect(first.results.every((item) => item.evidenceHash.match(/^[a-f0-9]{64}$/))).toBe(true);
    expect(second.results.map((item) => item.transactionId)).toEqual(first.results.map((item) => item.transactionId));
  });

  it('defaults to page size 25 and supports 25, 50, and 100', () => {
    const transactions = Array.from({ length: 55 }, (_, index) => transaction(`tx-${index + 1}`));
    const defaultPage = planMerchantBackfill(baseInput({ transactions, aliases: [] }));
    const page50 = planMerchantBackfill(baseInput({ transactions, aliases: [], pageSize: 50 }));
    const page100 = planMerchantBackfill(baseInput({ transactions, aliases: [], pageSize: 100 }));
    const unsupported = planMerchantBackfill(baseInput({ transactions, aliases: [], pageSize: 10 }));

    expect(defaultPage.pagination.pageSize).toBe(25);
    expect(defaultPage.results).toHaveLength(25);
    expect(page50.pagination.pageSize).toBe(50);
    expect(page50.results).toHaveLength(50);
    expect(page100.pagination.pageSize).toBe(100);
    expect(page100.results).toHaveLength(55);
    expect(unsupported.pagination.pageSize).toBe(25);
  });

  it('handles first, middle, final, empty, and out-of-range pages with full reachability', () => {
    const transactions = Array.from({ length: 55 }, (_, index) => transaction(`tx-${index + 1}`));
    const pages = [1, 2, 3].map((page) => planMerchantBackfill(baseInput({
      transactions,
      aliases: [],
      page,
      pageSize: 25,
    })));
    const reached = pages.flatMap((report) => report.results.map((item) => item.transactionId));
    const outOfRange = planMerchantBackfill(baseInput({ transactions, aliases: [], page: 99 }));
    const empty = planMerchantBackfill(baseInput({ transactions: [], aliases: [] }));

    expect(pages[0].pagination).toMatchObject({ page: 1, totalItems: 55, totalPages: 3, hasPreviousPage: false, hasNextPage: true });
    expect(pages[1].pagination).toMatchObject({ page: 2, hasPreviousPage: true, hasNextPage: true });
    expect(pages[2].pagination).toMatchObject({ page: 3, hasPreviousPage: true, hasNextPage: false });
    expect(new Set(reached).size).toBe(55);
    expect(outOfRange.pagination.page).toBe(3);
    expect(outOfRange.results).toEqual(pages[2].results);
    expect(empty.pagination).toEqual({ page: 1, pageSize: 25, totalItems: 0, totalPages: 0, hasPreviousPage: false, hasNextPage: false });
    expect(empty.results).toEqual([]);
  });

  it('rejects duplicate transactions, duplicate prior IDs, and cross-workspace input', () => {
    expect(() => planMerchantBackfill(baseInput({
      transactions: [transaction('tx-1'), transaction('tx-1')],
    }))).toThrow('duplicate transaction IDs');
    expect(() => planMerchantBackfill(baseInput({
      priorResultIds: ['result-1', 'result-1'],
    }))).toThrow('duplicate prior result IDs');
    expect(() => planMerchantBackfill(baseInput({
      transactions: [transaction('tx-1', { workspaceId: 'workspace-2' })],
    }))).toThrow('requested workspace');
  });

  it('classifies a trusted alias as a known merchant and retrieval anchor', () => {
    const report = planMerchantBackfill(baseInput());
    const result = resultFor(report, 'tx-1');

    expect(result).toMatchObject({
      state: 'KNOWN_MERCHANT',
      merchantId: 'merchant-1',
      knownMerchant: true,
      newMerchantCandidate: false,
      retrievalAnchorReady: true,
    });
    expect(report.metrics.knownMerchantCoverageBasisPoints).toBe(10_000);
    expect(report.metrics.retrievalAnchorCoverageBasisPoints).toBe(10_000);
  });

  it('classifies usable unmatched fingerprints only as a new merchant proposal', () => {
    const report = planMerchantBackfill(baseInput({ aliases: [] }));
    const result = resultFor(report, 'tx-1');

    expect(result).toMatchObject({
      state: 'NEW_MERCHANT_CANDIDATE',
      merchantId: null,
      knownMerchant: false,
      newMerchantCandidate: true,
      retrievalAnchorReady: false,
    });
    expect(report.metrics.newMerchantRateBasisPoints).toBe(10_000);
  });

  it('reports strongest-signal conflicts and fingerprint collisions', () => {
    const report = planMerchantBackfill(baseInput({
      aliases: [
        trustedAlias({ id: 'alias-a', merchantId: 'merchant-1' }),
        trustedAlias({ id: 'alias-b', merchantId: 'merchant-2' }),
      ],
    }));
    const result = resultFor(report, 'tx-1');

    expect(result).toMatchObject({
      state: 'CONFLICTED',
      merchantId: null,
      conflictDetected: true,
      fingerprintCollision: true,
      retrievalAnchorReady: false,
    });
    expect(result?.conflictingEvidence).toHaveLength(2);
    expect(report.metrics.merchantConflictRateBasisPoints).toBe(10_000);
    expect(report.metrics.fingerprintCollisionRateBasisPoints).toBe(10_000);
  });

  it('reports no-fingerprint abstention as unresolved', () => {
    const report = planMerchantBackfill(baseInput({
      transactions: [transaction('tx-1', {
        accountId: null,
        amountMinor: 0n,
        counterparty: null,
        reference: null,
        rawRow: {},
      })],
      aliases: [],
    }));
    const result = resultFor(report, 'tx-1');

    expect(result).toMatchObject({
      state: 'UNRESOLVED',
      unresolved: true,
      newMerchantCandidate: false,
    });
    expect(result?.abstentionReasons).toEqual(expect.arrayContaining([
      'ALIAS:NO_SUPPORTED_FINGERPRINTS',
      'IBAN:MISSING_VALUE',
      'NORMALIZED_COUNTERPARTY:MISSING_VALUE',
      'PAYMENT_PURPOSE:MISSING_VALUE',
      'RECURRING_PATTERN:INSUFFICIENT_RECURRING_COMPONENTS',
    ]));
    expect(report.metrics.unresolvedMerchantRateBasisPoints).toBe(10_000);
  });

  it('reports alias consolidation when a known merchant has unmatched usable fingerprints', () => {
    const report = planMerchantBackfill(baseInput());
    const result = resultFor(report, 'tx-1');

    expect(result?.aliasConsolidationOpportunity).toBe(true);
    expect(report.metrics.aliasConsolidationCount).toBe(1);
  });

  it('reports approved correction reuse only from explicit approved correction knowledge', () => {
    const correction: ApprovedMerchantCorrection = {
      id: 'correction-1',
      workspaceId,
      merchantId: 'merchant-1',
      signalType: 'IBAN',
      valueHash: ibanHash,
      status: 'APPROVED',
      evidenceHash: 'correction-evidence-1',
    };
    const approved = planMerchantBackfill(baseInput({ approvedCorrections: [correction] }));
    const unconfirmedInput = {
      ...baseInput({ approvedCorrections: [] }),
      unconfirmedSuggestions: [{ signalType: 'IBAN', valueHash: ibanHash }],
    } as MerchantBackfillPlannerInput;
    const withoutApproved = planMerchantBackfill(unconfirmedInput);

    expect(resultFor(approved, 'tx-1')).toMatchObject({
      correctionReuseCandidate: true,
      correctionIds: ['correction-1'],
    });
    expect(resultFor(withoutApproved, 'tx-1')).toMatchObject({
      correctionReuseCandidate: false,
      correctionIds: [],
    });
  });

  it('calculates complete aggregate metrics, abstentions, and signal coverage', () => {
    const report = planMerchantBackfill(baseInput({
      transactions: [
        transaction('tx-1'),
        transaction('tx-2', { rawRow: {}, counterparty: null, reference: null, accountId: null, amountMinor: 0n }),
      ],
    }));

    expect(report.metrics).toMatchObject({
      processedCount: 2,
      knownMerchantCount: 1,
      knownMerchantCoverageBasisPoints: 5000,
      unresolvedMerchantCount: 1,
      unresolvedMerchantRateBasisPoints: 5000,
      retrievalAnchorReadyCount: 1,
      retrievalAnchorCoverageBasisPoints: 5000,
    });
    expect(report.metrics.signalCoverage.IBAN).toBe(1);
    expect(report.metrics.signalCoverage.NORMALIZED_COUNTERPARTY).toBe(1);
    expect(report.metrics.abstentionReasonDistribution['ALIAS:NO_SUPPORTED_FINGERPRINTS']).toBe(1);
  });

  it('returns the exact no-side-effect flags', () => {
    const report = planMerchantBackfill(baseInput());
    expect(report.sideEffects).toEqual({
      writesMerchantKnowledge: false,
      createsTransactionBooking: false,
      mutatesBankFacts: false,
      changesTrustedHistory: false,
    });
  });

  it('does not mutate caller input and uses no clock or random output', () => {
    const input = baseInput();
    const before = structuredClone(input);
    const first = planMerchantBackfill(input);
    const second = planMerchantBackfill(input);

    expect(input).toEqual(before);
    expect(second).toEqual(first);
    expect(JSON.stringify(first)).not.toMatch(/createdAt|generatedAt|timestamp|random/i);
  });
});
