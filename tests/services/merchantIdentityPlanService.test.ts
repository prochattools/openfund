import { describe, expect, it } from 'vitest';
import type { MerchantAliasResolutionResult } from '../../server/services/merchantAliasResolver';
import {
  MERCHANT_IDENTITY_PLAN_VERSION,
  planMerchantIdentityChange,
  type MerchantFingerprintOwnershipRecord,
  type MerchantIdentityRecord,
} from '../../server/services/merchantIdentityPlanService';
import type { MerchantAliasRecord } from '../../server/services/merchantAliasResolver';

const merchants: MerchantIdentityRecord[] = [
  { id: 'merchant-a', workspaceId: 'workspace-1', status: 'ACTIVE', mergedIntoMerchantId: null },
  { id: 'merchant-b', workspaceId: 'workspace-1', status: 'ACTIVE', mergedIntoMerchantId: null },
  { id: 'merchant-c', workspaceId: 'workspace-1', status: 'ACTIVE', mergedIntoMerchantId: null },
];

const aliases: MerchantAliasRecord[] = [
  {
    id: 'alias-a',
    workspaceId: 'workspace-1',
    merchantId: 'merchant-a',
    signalType: 'IBAN',
    valueHash: 'hash-a',
    status: 'TRUSTED',
    evidenceHash: 'evidence-a',
  },
  {
    id: 'alias-b',
    workspaceId: 'workspace-1',
    merchantId: 'merchant-b',
    signalType: 'NORMALIZED_COUNTERPARTY',
    valueHash: 'hash-b',
    status: 'APPROVED',
    evidenceHash: 'evidence-b',
  },
];

const fingerprints: MerchantFingerprintOwnershipRecord[] = [
  {
    id: 'fingerprint-a',
    workspaceId: 'workspace-1',
    merchantId: 'merchant-a',
    signalType: 'IBAN',
    valueHash: 'fingerprint-hash-a',
    strength: 'STRONG',
    status: 'MATCHED',
    evidenceHash: 'fingerprint-evidence-a',
  },
  {
    id: 'fingerprint-b',
    workspaceId: 'workspace-1',
    merchantId: 'merchant-b',
    signalType: 'NORMALIZED_COUNTERPARTY',
    valueHash: 'fingerprint-hash-b',
    strength: 'MEDIUM',
    status: 'MATCHED',
    evidenceHash: 'fingerprint-evidence-b',
  },
];

const common = {
  workspaceId: 'workspace-1',
  actorId: 'admin-1',
  requestKey: 'request-1',
  reason: 'Administrator verified merchant identity',
  merchants,
  aliases,
  fingerprints,
};

const mergeInput = () => ({
  ...common,
  action: 'MERGE_MERCHANTS' as const,
  targetMerchantId: 'merchant-b',
  sourceMerchantIds: ['merchant-a'],
  affectedAliasIds: ['alias-a'],
  affectedFingerprintIds: ['fingerprint-a'],
});

const conflictResolution: MerchantAliasResolutionResult = {
  workspaceId: 'workspace-1',
  resolutionVersion: 'merchant-alias-resolution-v1',
  status: 'CONFLICTED',
  merchantId: null,
  strongestSignalType: 'IBAN',
  reason: 'STRONGEST_SIGNAL_COLLISION',
  supportingEvidence: [],
  conflictingEvidence: [
    {
      aliasId: 'alias-a',
      merchantId: 'merchant-a',
      signalType: 'IBAN',
      fingerprintHash: 'hash-a',
      aliasStatus: 'TRUSTED',
      precedence: 10,
      evidenceHash: 'evidence-a',
    },
    {
      aliasId: 'alias-b',
      merchantId: 'merchant-b',
      signalType: 'IBAN',
      fingerprintHash: 'hash-a',
      aliasStatus: 'APPROVED',
      precedence: 10,
      evidenceHash: 'evidence-b',
    },
  ],
};

const errorCodes = (plan: ReturnType<typeof planMerchantIdentityChange>) =>
  plan.blockingErrors.map((error) => error.code);

describe('merchant identity plan service', () => {
  it('creates a deterministic merge plan with explicit reassignment and rollback', () => {
    const plan = planMerchantIdentityChange(mergeInput());

    expect(plan).toMatchObject({
      action: 'MERGE_MERCHANTS',
      workspaceId: 'workspace-1',
      actorId: 'admin-1',
      planVersion: MERCHANT_IDENTITY_PLAN_VERSION,
      sourceMerchantIds: ['merchant-a'],
      targetMerchantIds: ['merchant-b'],
      affectedAliasIds: ['alias-a'],
      affectedFingerprintIds: ['fingerprint-a'],
      blockingErrors: [],
      administratorConfirmationRequired: true,
    });
    expect(plan.proposedAfterState.merchants.find((item) => item.id === 'merchant-a')).toMatchObject({
      status: 'MERGED',
      mergedIntoMerchantId: 'merchant-b',
    });
    expect(plan.proposedAfterState.aliases.find((item) => item.id === 'alias-a')?.merchantId).toBe('merchant-b');
    expect(plan.proposedAfterState.fingerprints.find((item) => item.id === 'fingerprint-a')?.merchantId).toBe('merchant-b');
    expect(plan.rollbackPlan).toEqual(expect.arrayContaining([
      expect.objectContaining({ recordType: 'MERCHANT', recordId: 'merchant-a', restore: { status: 'ACTIVE', mergedIntoMerchantId: null } }),
      expect.objectContaining({ recordType: 'ALIAS', recordId: 'alias-a', restore: { merchantId: 'merchant-a', status: 'TRUSTED' } }),
      expect.objectContaining({ recordType: 'FINGERPRINT', recordId: 'fingerprint-a', restore: { merchantId: 'merchant-a', status: 'MATCHED' } }),
    ]));
    expect(plan.planHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('is input-order independent for merge plans', () => {
    const first = planMerchantIdentityChange(mergeInput());
    const second = planMerchantIdentityChange({
      ...mergeInput(),
      merchants: [...merchants].reverse(),
      aliases: [...aliases].reverse(),
      fingerprints: [...fingerprints].reverse(),
    });

    expect(second).toEqual(first);
  });

  it('rejects same source and target and duplicate source merchants', () => {
    const plan = planMerchantIdentityChange({
      ...mergeInput(),
      targetMerchantId: 'merchant-a',
      sourceMerchantIds: ['merchant-a', 'merchant-a'],
    });

    expect(errorCodes(plan)).toEqual(expect.arrayContaining([
      'DUPLICATE_MERCHANT_ID',
      'SAME_SOURCE_AND_TARGET',
    ]));
  });

  it('rejects cross-workspace records', () => {
    const plan = planMerchantIdentityChange({
      ...mergeInput(),
      aliases: [{ ...aliases[0], workspaceId: 'workspace-2' }],
    });

    expect(errorCodes(plan)).toContain('CROSS_WORKSPACE_INPUT');
  });

  it('rejects merge cycles', () => {
    const plan = planMerchantIdentityChange({
      ...common,
      merchants: [
        { ...merchants[0], mergedIntoMerchantId: 'merchant-b', status: 'MERGED' },
        merchants[1],
      ],
      aliases: [],
      fingerprints: [],
      action: 'MERGE_MERCHANTS',
      targetMerchantId: 'merchant-a',
      sourceMerchantIds: ['merchant-b'],
      affectedAliasIds: [],
      affectedFingerprintIds: [],
    });

    expect(errorCodes(plan)).toContain('MERGE_CYCLE');
  });

  it('rejects unresolved active alias collisions', () => {
    const plan = planMerchantIdentityChange({
      ...mergeInput(),
      aliases: [
        ...aliases,
        {
          ...aliases[0],
          id: 'alias-collision',
          merchantId: 'merchant-c',
        },
      ],
    });

    expect(errorCodes(plan)).toContain('UNRESOLVED_ALIAS_COLLISION');
  });

  it('rejects unresolved strong fingerprint collisions', () => {
    const plan = planMerchantIdentityChange({
      ...mergeInput(),
      fingerprints: [
        ...fingerprints,
        {
          ...fingerprints[0],
          id: 'fingerprint-collision',
          merchantId: 'merchant-c',
        },
      ],
    });

    expect(errorCodes(plan)).toContain('UNRESOLVED_STRONG_FINGERPRINT_COLLISION');
  });

  it('creates a deterministic split plan with explicit partitions and rollback', () => {
    const input = {
      ...common,
      action: 'SPLIT_MERCHANT' as const,
      sourceMerchantId: 'merchant-a',
      plannedMerchantIds: ['planned-y', 'planned-x'],
      affectedAliasIds: ['alias-a'],
      affectedFingerprintIds: ['fingerprint-a'],
      assignments: [
        { merchantId: 'planned-x', aliasIds: ['alias-a'], fingerprintIds: [] },
        { merchantId: 'planned-y', aliasIds: [], fingerprintIds: ['fingerprint-a'] },
      ],
    };
    const plan = planMerchantIdentityChange(input);
    const reordered = planMerchantIdentityChange({
      ...input,
      plannedMerchantIds: [...input.plannedMerchantIds].reverse(),
      assignments: [...input.assignments].reverse(),
    });

    expect(plan.blockingErrors).toEqual([]);
    expect(plan.targetMerchantIds).toEqual(['planned-x', 'planned-y']);
    expect(plan.proposedAfterState.aliases.find((item) => item.id === 'alias-a')?.merchantId).toBe('planned-x');
    expect(plan.proposedAfterState.fingerprints.find((item) => item.id === 'fingerprint-a')?.merchantId).toBe('planned-y');
    expect(plan.proposedAfterState.merchants.find((item) => item.id === 'merchant-a')?.status).toBe('CONFLICTED');
    expect(reordered.planHash).toBe(plan.planHash);
  });

  it('rejects split records that are unassigned or multiply assigned', () => {
    const unassigned = planMerchantIdentityChange({
      ...common,
      action: 'SPLIT_MERCHANT',
      sourceMerchantId: 'merchant-a',
      plannedMerchantIds: ['planned-x', 'planned-y'],
      affectedAliasIds: ['alias-a'],
      affectedFingerprintIds: ['fingerprint-a'],
      assignments: [{ merchantId: 'planned-x', aliasIds: ['alias-a'], fingerprintIds: [] }],
    });
    const multiplyAssigned = planMerchantIdentityChange({
      ...common,
      action: 'SPLIT_MERCHANT',
      sourceMerchantId: 'merchant-a',
      plannedMerchantIds: ['planned-x', 'planned-y'],
      affectedAliasIds: ['alias-a'],
      affectedFingerprintIds: [],
      assignments: [
        { merchantId: 'planned-x', aliasIds: ['alias-a'], fingerprintIds: [] },
        { merchantId: 'planned-y', aliasIds: ['alias-a'], fingerprintIds: [] },
      ],
    });

    expect(errorCodes(unassigned)).toContain('UNASSIGNED_SPLIT_RECORD');
    expect(errorCodes(multiplyAssigned)).toContain('MULTIPLY_ASSIGNED_SPLIT_RECORD');
  });

  it('plans explicit conflict resolution while preserving all evidence', () => {
    const selected = planMerchantIdentityChange({
      ...common,
      action: 'RESOLVE_CONFLICT',
      resolution: conflictResolution,
      intent: 'SELECT_MERCHANT',
      selectedMerchantId: 'merchant-a',
    });
    const abstained = planMerchantIdentityChange({
      ...common,
      action: 'RESOLVE_CONFLICT',
      resolution: conflictResolution,
      intent: 'ABSTAIN',
    });
    const dismissed = planMerchantIdentityChange({
      ...common,
      action: 'RESOLVE_CONFLICT',
      resolution: conflictResolution,
      intent: 'DISMISS',
    });

    expect(selected.blockingErrors).toEqual([]);
    expect(selected.targetMerchantIds).toEqual(['merchant-a']);
    expect(selected.conflictingEvidence).toHaveLength(2);
    expect(abstained.validationWarnings).toContain('Conflict remains untrusted; no alias or fingerprint becomes trusted automatically.');
    expect(dismissed.validationWarnings).toContain('Conflict remains untrusted; no alias or fingerprint becomes trusted automatically.');
  });

  it('rejects conflict selection outside preserved evidence', () => {
    const plan = planMerchantIdentityChange({
      ...common,
      action: 'RESOLVE_CONFLICT',
      resolution: conflictResolution,
      intent: 'SELECT_MERCHANT',
      selectedMerchantId: 'merchant-c',
    });

    expect(errorCodes(plan)).toContain('SELECTED_MERCHANT_NOT_IN_EVIDENCE');
    expect(plan.conflictingEvidence).toHaveLength(2);
  });

  it('plans explicit reassignment and deprecation operations', () => {
    const reassignment = planMerchantIdentityChange({
      ...common,
      action: 'REASSIGN_KNOWLEDGE',
      targetMerchantId: 'merchant-c',
      affectedAliasIds: ['alias-a'],
      affectedFingerprintIds: ['fingerprint-a'],
    });
    const aliasDeprecation = planMerchantIdentityChange({
      ...common,
      action: 'DEPRECATE_ALIAS',
      aliasId: 'alias-a',
    });
    const merchantDeprecation = planMerchantIdentityChange({
      ...common,
      action: 'DEPRECATE_MERCHANT',
      merchantId: 'merchant-a',
    });

    expect(reassignment.blockingErrors).toEqual([]);
    expect(reassignment.proposedAfterState.aliases.find((item) => item.id === 'alias-a')?.merchantId).toBe('merchant-c');
    expect(aliasDeprecation.proposedAfterState.aliases.find((item) => item.id === 'alias-a')?.status).toBe('DEPRECATED');
    expect(merchantDeprecation.proposedAfterState.merchants.find((item) => item.id === 'merchant-a')?.status).toBe('DEPRECATED');
  });

  it('rejects missing workspace, actor, reason, request key, and implicit bulk changes', () => {
    const plan = planMerchantIdentityChange({
      ...mergeInput(),
      workspaceId: '',
      actorId: '',
      reason: ' ',
      requestKey: '',
      affectedAliasIds: [],
      affectedFingerprintIds: [],
    });

    expect(errorCodes(plan)).toEqual(expect.arrayContaining([
      'MISSING_WORKSPACE',
      'MISSING_ACTOR',
      'MISSING_REASON',
      'MISSING_REQUEST_KEY',
      'MISSING_AFFECTED_RECORDS',
    ]));
  });

  it('does not mutate caller-supplied merchant knowledge or resolution evidence', () => {
    const input = mergeInput();
    const before = JSON.stringify(input);
    planMerchantIdentityChange(input);
    expect(JSON.stringify(input)).toBe(before);

    const conflictInput = {
      ...common,
      action: 'RESOLVE_CONFLICT' as const,
      resolution: conflictResolution,
      intent: 'ABSTAIN' as const,
    };
    const conflictBefore = JSON.stringify(conflictInput);
    planMerchantIdentityChange(conflictInput);
    expect(JSON.stringify(conflictInput)).toBe(conflictBefore);
  });
});
