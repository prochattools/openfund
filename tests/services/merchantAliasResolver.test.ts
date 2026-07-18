import { describe, expect, it } from 'vitest';
import type { ExtractedMerchantFingerprint } from '../../server/services/merchantFingerprintExtractor';
import {
  MERCHANT_ALIAS_RESOLUTION_VERSION,
  resolveMerchantAlias,
  type MerchantAliasRecord,
} from '../../server/services/merchantAliasResolver';

const fingerprint = (
  signalType: ExtractedMerchantFingerprint['signalType'],
  valueHash: string,
): ExtractedMerchantFingerprint => ({
  signalType,
  normalizedValue: `normalized-${signalType.toLowerCase()}`,
  valueHash,
  strength: signalType === 'IBAN' ? 'STRONG' : signalType === 'NORMALIZED_COUNTERPARTY' ? 'MEDIUM' : 'WEAK',
  extractionVersion: 'merchant-fingerprint-v1',
  sourceField: signalType === 'IBAN'
    ? 'rawRow.counterpartyIban'
    : signalType === 'NORMALIZED_COUNTERPARTY'
      ? 'transaction.counterparty'
      : signalType === 'PAYMENT_PURPOSE'
        ? 'rawRow.paymentPurpose'
        : 'transaction.recurringPatternComponents',
  evidenceDisplayValue: null,
});

const alias = (overrides: Partial<MerchantAliasRecord> = {}): MerchantAliasRecord => ({
  id: 'alias-1',
  workspaceId: 'workspace-1',
  merchantId: 'merchant-1',
  signalType: 'IBAN',
  valueHash: 'hash-iban',
  status: 'TRUSTED',
  evidenceHash: 'evidence-1',
  ...overrides,
});

describe('merchant alias resolver', () => {
  it('resolves one merchant from the strongest unambiguous trusted alias', () => {
    const result = resolveMerchantAlias({
      workspaceId: 'workspace-1',
      fingerprints: [
        fingerprint('IBAN', 'hash-iban'),
        fingerprint('NORMALIZED_COUNTERPARTY', 'hash-name'),
      ],
      aliases: [
        alias(),
        alias({
          id: 'alias-name',
          signalType: 'NORMALIZED_COUNTERPARTY',
          valueHash: 'hash-name',
          status: 'APPROVED',
        }),
      ],
    });

    expect(result).toMatchObject({
      workspaceId: 'workspace-1',
      resolutionVersion: MERCHANT_ALIAS_RESOLUTION_VERSION,
      status: 'RESOLVED',
      merchantId: 'merchant-1',
      strongestSignalType: 'IBAN',
      reason: null,
    });
    expect(result.supportingEvidence.map((item) => item.aliasId)).toEqual(['alias-1', 'alias-name']);
    expect(result.conflictingEvidence).toEqual([]);
  });

  it('uses explicit precedence and does not let weaker evidence override IBAN', () => {
    const result = resolveMerchantAlias({
      workspaceId: 'workspace-1',
      fingerprints: [
        fingerprint('IBAN', 'hash-iban'),
        fingerprint('NORMALIZED_COUNTERPARTY', 'hash-name'),
        fingerprint('PAYMENT_PURPOSE', 'hash-purpose'),
      ],
      aliases: [
        alias(),
        alias({
          id: 'alias-name',
          merchantId: 'merchant-2',
          signalType: 'NORMALIZED_COUNTERPARTY',
          valueHash: 'hash-name',
        }),
        alias({
          id: 'alias-purpose',
          merchantId: 'merchant-2',
          signalType: 'PAYMENT_PURPOSE',
          valueHash: 'hash-purpose',
        }),
      ],
    });

    expect(result.status).toBe('RESOLVED');
    expect(result.merchantId).toBe('merchant-1');
    expect(result.strongestSignalType).toBe('IBAN');
    expect(result.supportingEvidence.map((item) => item.aliasId)).toEqual(['alias-1']);
    expect(result.conflictingEvidence.map((item) => item.aliasId)).toEqual([
      'alias-name',
      'alias-purpose',
    ]);
  });

  it('abstains when workspace context is missing', () => {
    const result = resolveMerchantAlias({
      workspaceId: '   ',
      fingerprints: [fingerprint('IBAN', 'hash-iban')],
      aliases: [alias()],
    });

    expect(result).toMatchObject({
      status: 'ABSTAINED',
      merchantId: null,
      reason: 'MISSING_WORKSPACE_CONTEXT',
    });
  });

  it('rejects cross-workspace alias records without leaking evidence', () => {
    const result = resolveMerchantAlias({
      workspaceId: 'workspace-1',
      fingerprints: [fingerprint('IBAN', 'hash-iban')],
      aliases: [alias({ workspaceId: 'workspace-2' })],
    });

    expect(result).toMatchObject({
      status: 'ABSTAINED',
      merchantId: null,
      reason: 'CROSS_WORKSPACE_ALIAS',
      supportingEvidence: [],
      conflictingEvidence: [],
    });
  });

  it('ignores observed, proposed, deprecated, and rejected aliases', () => {
    const statuses: MerchantAliasRecord['status'][] = [
      'OBSERVED',
      'PROPOSED',
      'DEPRECATED',
      'REJECTED',
    ];
    const result = resolveMerchantAlias({
      workspaceId: 'workspace-1',
      fingerprints: [fingerprint('IBAN', 'hash-iban')],
      aliases: statuses.map((status, index) => alias({ id: `alias-${index}`, status })),
    });

    expect(result).toMatchObject({
      status: 'ABSTAINED',
      merchantId: null,
      reason: 'NO_TRUSTED_MATCH',
    });
  });

  it('returns conflict when the strongest signal maps to multiple merchants', () => {
    const result = resolveMerchantAlias({
      workspaceId: 'workspace-1',
      fingerprints: [fingerprint('IBAN', 'hash-iban')],
      aliases: [
        alias({ id: 'alias-a', merchantId: 'merchant-a' }),
        alias({ id: 'alias-b', merchantId: 'merchant-b' }),
      ],
    });

    expect(result).toMatchObject({
      status: 'CONFLICTED',
      merchantId: null,
      strongestSignalType: 'IBAN',
      reason: 'STRONGEST_SIGNAL_COLLISION',
      supportingEvidence: [],
    });
    expect(result.conflictingEvidence.map((item) => item.merchantId)).toEqual([
      'merchant-a',
      'merchant-b',
    ]);
  });

  it('abstains when there are no supported fingerprints', () => {
    const result = resolveMerchantAlias({
      workspaceId: 'workspace-1',
      fingerprints: [],
      aliases: [alias()],
    });

    expect(result).toMatchObject({
      status: 'ABSTAINED',
      reason: 'NO_SUPPORTED_FINGERPRINTS',
    });
  });

  it('abstains when no trusted alias matches supplied fingerprints', () => {
    const result = resolveMerchantAlias({
      workspaceId: 'workspace-1',
      fingerprints: [fingerprint('NORMALIZED_COUNTERPARTY', 'hash-name')],
      aliases: [alias()],
    });

    expect(result).toMatchObject({
      status: 'ABSTAINED',
      reason: 'NO_TRUSTED_MATCH',
    });
  });

  it('returns deterministic evidence ordering independent of input order', () => {
    const fingerprints = [
      fingerprint('PAYMENT_PURPOSE', 'hash-purpose'),
      fingerprint('IBAN', 'hash-iban'),
      fingerprint('NORMALIZED_COUNTERPARTY', 'hash-name'),
    ];
    const aliases = [
      alias({ id: 'z-purpose', signalType: 'PAYMENT_PURPOSE', valueHash: 'hash-purpose' }),
      alias({ id: 'z-name', signalType: 'NORMALIZED_COUNTERPARTY', valueHash: 'hash-name' }),
      alias({ id: 'z-iban' }),
    ];

    const first = resolveMerchantAlias({ workspaceId: 'workspace-1', fingerprints, aliases });
    const second = resolveMerchantAlias({
      workspaceId: 'workspace-1',
      fingerprints: [...fingerprints].reverse(),
      aliases: [...aliases].reverse(),
    });

    expect(second).toEqual(first);
    expect(first.supportingEvidence.map((item) => item.signalType)).toEqual([
      'IBAN',
      'NORMALIZED_COUNTERPARTY',
      'PAYMENT_PURPOSE',
    ]);
  });

  it('does not mutate fingerprints or alias records', () => {
    const fingerprints = [fingerprint('IBAN', 'hash-iban')];
    const aliases = [alias()];
    const fingerprintsBefore = JSON.stringify(fingerprints);
    const aliasesBefore = JSON.stringify(aliases);

    resolveMerchantAlias({ workspaceId: 'workspace-1', fingerprints, aliases });

    expect(JSON.stringify(fingerprints)).toBe(fingerprintsBefore);
    expect(JSON.stringify(aliases)).toBe(aliasesBefore);
  });
});
