import crypto from 'node:crypto';
import type {
  MerchantAliasMatchEvidence,
  MerchantAliasRecord,
  MerchantAliasResolutionResult,
} from './merchantAliasResolver';
import type {
  MerchantFingerprintSignalType,
  MerchantFingerprintStrength,
} from './merchantFingerprintExtractor';

export const MERCHANT_IDENTITY_PLAN_VERSION = 'merchant-identity-plan-v1';

export type MerchantIdentityStatus =
  | 'PROPOSED'
  | 'ACTIVE'
  | 'CONFLICTED'
  | 'MERGED'
  | 'DEPRECATED';

export type MerchantIdentityRecord = {
  id: string;
  workspaceId: string;
  status: MerchantIdentityStatus;
  mergedIntoMerchantId: string | null;
};

export type MerchantFingerprintOwnershipRecord = {
  id: string;
  workspaceId: string;
  merchantId: string | null;
  signalType: MerchantFingerprintSignalType;
  valueHash: string;
  strength: MerchantFingerprintStrength;
  status: 'OBSERVED' | 'MATCHED' | 'CONFLICTED' | 'DEPRECATED';
  evidenceHash: string;
};

export type MerchantIdentityPlanAction =
  | 'RESOLVE_CONFLICT'
  | 'MERGE_MERCHANTS'
  | 'SPLIT_MERCHANT'
  | 'REASSIGN_KNOWLEDGE'
  | 'DEPRECATE_ALIAS'
  | 'DEPRECATE_MERCHANT';

export type MerchantIdentityPlanErrorCode =
  | 'MISSING_WORKSPACE'
  | 'MISSING_ACTOR'
  | 'MISSING_REASON'
  | 'MISSING_REQUEST_KEY'
  | 'CROSS_WORKSPACE_INPUT'
  | 'MISSING_MERCHANT'
  | 'DUPLICATE_MERCHANT_ID'
  | 'SAME_SOURCE_AND_TARGET'
  | 'MERGE_CYCLE'
  | 'MISSING_AFFECTED_RECORDS'
  | 'UNKNOWN_ALIAS'
  | 'UNKNOWN_FINGERPRINT'
  | 'UNRESOLVED_ALIAS_COLLISION'
  | 'UNRESOLVED_STRONG_FINGERPRINT_COLLISION'
  | 'UNASSIGNED_SPLIT_RECORD'
  | 'MULTIPLY_ASSIGNED_SPLIT_RECORD'
  | 'INVALID_CONFLICT_INTENT'
  | 'SELECTED_MERCHANT_NOT_IN_EVIDENCE'
  | 'CONFLICT_EVIDENCE_DISCARDED';

export type MerchantIdentityPlanIssue = {
  code: MerchantIdentityPlanErrorCode;
  message: string;
};

export type MerchantOwnershipSnapshot = {
  merchants: Array<{
    id: string;
    status: MerchantIdentityStatus;
    mergedIntoMerchantId: string | null;
  }>;
  aliases: Array<{
    id: string;
    merchantId: string;
    status: MerchantAliasRecord['status'];
  }>;
  fingerprints: Array<{
    id: string;
    merchantId: string | null;
    status: MerchantFingerprintOwnershipRecord['status'];
  }>;
};

export type MerchantRollbackStep = {
  recordType: 'MERCHANT' | 'ALIAS' | 'FINGERPRINT' | 'CONFLICT';
  recordId: string;
  restore: Record<string, string | null>;
};

export type MerchantIdentityPlan = {
  action: MerchantIdentityPlanAction;
  workspaceId: string;
  actorId: string;
  requestKey: string;
  planVersion: string;
  planHash: string;
  reason: string;
  sourceMerchantIds: string[];
  targetMerchantIds: string[];
  affectedAliasIds: string[];
  affectedFingerprintIds: string[];
  beforeState: MerchantOwnershipSnapshot;
  proposedAfterState: MerchantOwnershipSnapshot;
  supportingEvidence: MerchantAliasMatchEvidence[];
  conflictingEvidence: MerchantAliasMatchEvidence[];
  validationWarnings: string[];
  blockingErrors: MerchantIdentityPlanIssue[];
  rollbackPlan: MerchantRollbackStep[];
  administratorConfirmationRequired: true;
};

type CommonPlanInput = {
  workspaceId: string;
  actorId: string;
  requestKey: string;
  reason: string;
  merchants: readonly MerchantIdentityRecord[];
  aliases: readonly MerchantAliasRecord[];
  fingerprints: readonly MerchantFingerprintOwnershipRecord[];
  supportingEvidence?: readonly MerchantAliasMatchEvidence[];
  conflictingEvidence?: readonly MerchantAliasMatchEvidence[];
};

export type MergeMerchantPlanInput = CommonPlanInput & {
  action: 'MERGE_MERCHANTS';
  targetMerchantId: string;
  sourceMerchantIds: readonly string[];
  affectedAliasIds: readonly string[];
  affectedFingerprintIds: readonly string[];
};

export type SplitAssignment = {
  merchantId: string;
  aliasIds: readonly string[];
  fingerprintIds: readonly string[];
};

export type SplitMerchantPlanInput = CommonPlanInput & {
  action: 'SPLIT_MERCHANT';
  sourceMerchantId: string;
  plannedMerchantIds: readonly string[];
  affectedAliasIds: readonly string[];
  affectedFingerprintIds: readonly string[];
  assignments: readonly SplitAssignment[];
};

export type ConflictResolutionPlanInput = CommonPlanInput & {
  action: 'RESOLVE_CONFLICT';
  resolution: MerchantAliasResolutionResult;
  intent: 'SELECT_MERCHANT' | 'ABSTAIN' | 'DISMISS';
  selectedMerchantId?: string;
};

export type ReassignKnowledgePlanInput = CommonPlanInput & {
  action: 'REASSIGN_KNOWLEDGE';
  targetMerchantId: string;
  affectedAliasIds: readonly string[];
  affectedFingerprintIds: readonly string[];
};

export type DeprecateAliasPlanInput = CommonPlanInput & {
  action: 'DEPRECATE_ALIAS';
  aliasId: string;
};

export type DeprecateMerchantPlanInput = CommonPlanInput & {
  action: 'DEPRECATE_MERCHANT';
  merchantId: string;
};

export type MerchantIdentityPlanInput =
  | MergeMerchantPlanInput
  | SplitMerchantPlanInput
  | ConflictResolutionPlanInput
  | ReassignKnowledgePlanInput
  | DeprecateAliasPlanInput
  | DeprecateMerchantPlanInput;

const sortedUnique = (values: readonly string[]): string[] =>
  [...new Set(values)].sort((left, right) => left.localeCompare(right));

const stableValue = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nested]) => [key, stableValue(nested)]),
    );
  }
  return value;
};

const stableHash = (value: unknown): string =>
  crypto.createHash('sha256').update(JSON.stringify(stableValue(value))).digest('hex');

const evidenceSort = (
  left: MerchantAliasMatchEvidence,
  right: MerchantAliasMatchEvidence,
): number =>
  left.precedence - right.precedence
  || left.merchantId.localeCompare(right.merchantId)
  || left.aliasId.localeCompare(right.aliasId);

const snapshot = (
  merchants: readonly MerchantIdentityRecord[],
  aliases: readonly MerchantAliasRecord[],
  fingerprints: readonly MerchantFingerprintOwnershipRecord[],
): MerchantOwnershipSnapshot => ({
  merchants: merchants
    .map(({ id, status, mergedIntoMerchantId }) => ({ id, status, mergedIntoMerchantId }))
    .sort((left, right) => left.id.localeCompare(right.id)),
  aliases: aliases
    .map(({ id, merchantId, status }) => ({ id, merchantId, status }))
    .sort((left, right) => left.id.localeCompare(right.id)),
  fingerprints: fingerprints
    .map(({ id, merchantId, status }) => ({ id, merchantId, status }))
    .sort((left, right) => left.id.localeCompare(right.id)),
});

const commonErrors = (input: CommonPlanInput): MerchantIdentityPlanIssue[] => {
  const issues: MerchantIdentityPlanIssue[] = [];
  if (!input.workspaceId.trim()) issues.push({ code: 'MISSING_WORKSPACE', message: 'workspaceId is required' });
  if (!input.actorId.trim()) issues.push({ code: 'MISSING_ACTOR', message: 'actorId is required' });
  if (!input.reason.trim()) issues.push({ code: 'MISSING_REASON', message: 'reason is required' });
  if (!input.requestKey.trim()) issues.push({ code: 'MISSING_REQUEST_KEY', message: 'requestKey is required' });

  const workspaceId = input.workspaceId.trim();
  if (
    workspaceId
    && (
      input.merchants.some((record) => record.workspaceId !== workspaceId)
      || input.aliases.some((record) => record.workspaceId !== workspaceId)
      || input.fingerprints.some((record) => record.workspaceId !== workspaceId)
    )
  ) {
    issues.push({ code: 'CROSS_WORKSPACE_INPUT', message: 'all merchant knowledge records must belong to the requested workspace' });
  }

  const merchantIds = input.merchants.map((record) => record.id);
  if (new Set(merchantIds).size !== merchantIds.length) {
    issues.push({ code: 'DUPLICATE_MERCHANT_ID', message: 'merchant identities must be unique' });
  }
  return issues;
};

const detectMergeCycle = (
  merchants: readonly MerchantIdentityRecord[],
  sourceIds: readonly string[],
  targetId: string,
): boolean => {
  const targetMap = new Map(merchants.map((merchant) => [merchant.id, merchant.mergedIntoMerchantId]));
  for (const sourceId of sourceIds) targetMap.set(sourceId, targetId);

  for (const start of targetMap.keys()) {
    const visited = new Set<string>();
    let cursor: string | null | undefined = start;
    while (cursor) {
      if (visited.has(cursor)) return true;
      visited.add(cursor);
      cursor = targetMap.get(cursor);
    }
  }
  return false;
};

const validateAffectedIds = (
  aliases: readonly MerchantAliasRecord[],
  fingerprints: readonly MerchantFingerprintOwnershipRecord[],
  aliasIds: readonly string[],
  fingerprintIds: readonly string[],
): MerchantIdentityPlanIssue[] => {
  const issues: MerchantIdentityPlanIssue[] = [];
  const aliasSet = new Set(aliases.map((record) => record.id));
  const fingerprintSet = new Set(fingerprints.map((record) => record.id));
  if (aliasIds.length === 0 && fingerprintIds.length === 0) {
    issues.push({ code: 'MISSING_AFFECTED_RECORDS', message: 'explicit alias or fingerprint IDs are required' });
  }
  for (const id of sortedUnique(aliasIds)) {
    if (!aliasSet.has(id)) issues.push({ code: 'UNKNOWN_ALIAS', message: `unknown alias: ${id}` });
  }
  for (const id of sortedUnique(fingerprintIds)) {
    if (!fingerprintSet.has(id)) issues.push({ code: 'UNKNOWN_FINGERPRINT', message: `unknown fingerprint: ${id}` });
  }
  return issues;
};

const collisionErrors = (
  aliases: readonly MerchantAliasRecord[],
  fingerprints: readonly MerchantFingerprintOwnershipRecord[],
  aliasIds: readonly string[],
  fingerprintIds: readonly string[],
  targetMerchantId: string,
): MerchantIdentityPlanIssue[] => {
  const issues: MerchantIdentityPlanIssue[] = [];
  const selectedAliasIds = new Set(aliasIds);
  const selectedFingerprintIds = new Set(fingerprintIds);

  const aliasesAfter = aliases.map((record) => ({
    ...record,
    merchantId: selectedAliasIds.has(record.id) ? targetMerchantId : record.merchantId,
  }));
  const activeAliases = aliasesAfter.filter((record) => record.status === 'APPROVED' || record.status === 'TRUSTED');
  const aliasGroups = new Map<string, Set<string>>();
  for (const record of activeAliases) {
    const key = `${record.signalType}:${record.valueHash}`;
    if (!aliasGroups.has(key)) aliasGroups.set(key, new Set());
    aliasGroups.get(key)?.add(record.merchantId);
  }
  if ([...aliasGroups.values()].some((merchants) => merchants.size > 1)) {
    issues.push({ code: 'UNRESOLVED_ALIAS_COLLISION', message: 'active alias collision remains after the proposed change' });
  }

  const fingerprintsAfter = fingerprints.map((record) => ({
    ...record,
    merchantId: selectedFingerprintIds.has(record.id) ? targetMerchantId : record.merchantId,
  }));
  const strongMatched = fingerprintsAfter.filter((record) => record.status === 'MATCHED' && record.strength === 'STRONG');
  const fingerprintGroups = new Map<string, Set<string>>();
  for (const record of strongMatched) {
    const key = `${record.signalType}:${record.valueHash}`;
    if (!fingerprintGroups.has(key)) fingerprintGroups.set(key, new Set());
    if (record.merchantId) fingerprintGroups.get(key)?.add(record.merchantId);
  }
  if ([...fingerprintGroups.values()].some((merchants) => merchants.size > 1)) {
    issues.push({ code: 'UNRESOLVED_STRONG_FINGERPRINT_COLLISION', message: 'strong fingerprint collision remains after the proposed change' });
  }
  return issues;
};

const buildPlan = (input: MerchantIdentityPlanInput): MerchantIdentityPlan => {
  const blockingErrors = commonErrors(input);
  const merchants = input.merchants.map((record) => ({ ...record }));
  const aliases = input.aliases.map((record) => ({ ...record }));
  const fingerprints = input.fingerprints.map((record) => ({ ...record }));
  const beforeState = snapshot(merchants, aliases, fingerprints);
  const rollbackPlan: MerchantRollbackStep[] = [];
  const validationWarnings: string[] = [];
  const supportingEvidence = [...(input.supportingEvidence ?? [])].sort(evidenceSort);
  const conflictingEvidence = [...(input.conflictingEvidence ?? [])].sort(evidenceSort);
  let sourceMerchantIds: string[] = [];
  let targetMerchantIds: string[] = [];
  let affectedAliasIds: string[] = [];
  let affectedFingerprintIds: string[] = [];

  const merchantById = new Map(merchants.map((merchant) => [merchant.id, merchant]));
  const aliasById = new Map(aliases.map((alias) => [alias.id, alias]));
  const fingerprintById = new Map(fingerprints.map((fingerprint) => [fingerprint.id, fingerprint]));

  if (input.action === 'MERGE_MERCHANTS') {
    sourceMerchantIds = sortedUnique(input.sourceMerchantIds);
    targetMerchantIds = [input.targetMerchantId];
    affectedAliasIds = sortedUnique(input.affectedAliasIds);
    affectedFingerprintIds = sortedUnique(input.affectedFingerprintIds);

    if (sourceMerchantIds.length !== input.sourceMerchantIds.length) {
      blockingErrors.push({ code: 'DUPLICATE_MERCHANT_ID', message: 'source merchant IDs must not repeat' });
    }
    if (sourceMerchantIds.includes(input.targetMerchantId)) {
      blockingErrors.push({ code: 'SAME_SOURCE_AND_TARGET', message: 'merge source and target must differ' });
    }
    for (const id of [...sourceMerchantIds, input.targetMerchantId]) {
      if (!merchantById.has(id)) blockingErrors.push({ code: 'MISSING_MERCHANT', message: `unknown merchant: ${id}` });
    }
    blockingErrors.push(...validateAffectedIds(aliases, fingerprints, affectedAliasIds, affectedFingerprintIds));
    if (detectMergeCycle(merchants, sourceMerchantIds, input.targetMerchantId)) {
      blockingErrors.push({ code: 'MERGE_CYCLE', message: 'proposed merge creates a merchant cycle' });
    }
    blockingErrors.push(...collisionErrors(aliases, fingerprints, affectedAliasIds, affectedFingerprintIds, input.targetMerchantId));

    for (const id of sourceMerchantIds) {
      const merchant = merchantById.get(id);
      if (!merchant) continue;
      rollbackPlan.push({ recordType: 'MERCHANT', recordId: id, restore: { status: merchant.status, mergedIntoMerchantId: merchant.mergedIntoMerchantId } });
      merchant.status = 'MERGED';
      merchant.mergedIntoMerchantId = input.targetMerchantId;
    }
    for (const id of affectedAliasIds) {
      const record = aliasById.get(id);
      if (!record) continue;
      rollbackPlan.push({ recordType: 'ALIAS', recordId: id, restore: { merchantId: record.merchantId, status: record.status } });
      record.merchantId = input.targetMerchantId;
    }
    for (const id of affectedFingerprintIds) {
      const record = fingerprintById.get(id);
      if (!record) continue;
      rollbackPlan.push({ recordType: 'FINGERPRINT', recordId: id, restore: { merchantId: record.merchantId, status: record.status } });
      record.merchantId = input.targetMerchantId;
    }
  }

  if (input.action === 'SPLIT_MERCHANT') {
    sourceMerchantIds = [input.sourceMerchantId];
    targetMerchantIds = sortedUnique(input.plannedMerchantIds);
    affectedAliasIds = sortedUnique(input.affectedAliasIds);
    affectedFingerprintIds = sortedUnique(input.affectedFingerprintIds);

    if (!merchantById.has(input.sourceMerchantId)) {
      blockingErrors.push({ code: 'MISSING_MERCHANT', message: `unknown source merchant: ${input.sourceMerchantId}` });
    }
    if (targetMerchantIds.length !== input.plannedMerchantIds.length || targetMerchantIds.includes(input.sourceMerchantId)) {
      blockingErrors.push({ code: 'DUPLICATE_MERCHANT_ID', message: 'planned merchant IDs must be unique and differ from the source' });
    }
    blockingErrors.push(...validateAffectedIds(aliases, fingerprints, affectedAliasIds, affectedFingerprintIds));

    const aliasAssignments = new Map<string, string[]>();
    const fingerprintAssignments = new Map<string, string[]>();
    for (const assignment of input.assignments) {
      if (!targetMerchantIds.includes(assignment.merchantId)) {
        blockingErrors.push({ code: 'MISSING_MERCHANT', message: `assignment target is not planned: ${assignment.merchantId}` });
      }
      for (const id of assignment.aliasIds) {
        aliasAssignments.set(id, [...(aliasAssignments.get(id) ?? []), assignment.merchantId]);
      }
      for (const id of assignment.fingerprintIds) {
        fingerprintAssignments.set(id, [...(fingerprintAssignments.get(id) ?? []), assignment.merchantId]);
      }
    }
    for (const id of affectedAliasIds) {
      const targets = aliasAssignments.get(id) ?? [];
      if (targets.length === 0) blockingErrors.push({ code: 'UNASSIGNED_SPLIT_RECORD', message: `alias is unassigned: ${id}` });
      if (targets.length > 1) blockingErrors.push({ code: 'MULTIPLY_ASSIGNED_SPLIT_RECORD', message: `alias is multiply assigned: ${id}` });
    }
    for (const id of affectedFingerprintIds) {
      const targets = fingerprintAssignments.get(id) ?? [];
      if (targets.length === 0) blockingErrors.push({ code: 'UNASSIGNED_SPLIT_RECORD', message: `fingerprint is unassigned: ${id}` });
      if (targets.length > 1) blockingErrors.push({ code: 'MULTIPLY_ASSIGNED_SPLIT_RECORD', message: `fingerprint is multiply assigned: ${id}` });
    }

    const source = merchantById.get(input.sourceMerchantId);
    if (source) {
      rollbackPlan.push({ recordType: 'MERCHANT', recordId: source.id, restore: { status: source.status, mergedIntoMerchantId: source.mergedIntoMerchantId } });
      source.status = 'CONFLICTED';
    }
    for (const plannedId of targetMerchantIds) {
      if (!merchantById.has(plannedId)) {
        merchants.push({ id: plannedId, workspaceId: input.workspaceId, status: 'PROPOSED', mergedIntoMerchantId: null });
        merchantById.set(plannedId, merchants[merchants.length - 1]);
        rollbackPlan.push({ recordType: 'MERCHANT', recordId: plannedId, restore: { status: null, mergedIntoMerchantId: null } });
      }
    }
    for (const id of affectedAliasIds) {
      const record = aliasById.get(id);
      const target = aliasAssignments.get(id)?.[0];
      if (!record || !target) continue;
      rollbackPlan.push({ recordType: 'ALIAS', recordId: id, restore: { merchantId: record.merchantId, status: record.status } });
      record.merchantId = target;
    }
    for (const id of affectedFingerprintIds) {
      const record = fingerprintById.get(id);
      const target = fingerprintAssignments.get(id)?.[0];
      if (!record || !target) continue;
      rollbackPlan.push({ recordType: 'FINGERPRINT', recordId: id, restore: { merchantId: record.merchantId, status: record.status } });
      record.merchantId = target;
    }
  }

  if (input.action === 'RESOLVE_CONFLICT') {
    supportingEvidence.push(...input.resolution.supportingEvidence);
    conflictingEvidence.push(...input.resolution.conflictingEvidence);
    supportingEvidence.sort(evidenceSort);
    conflictingEvidence.sort(evidenceSort);
    const evidenceMerchantIds = sortedUnique([
      ...supportingEvidence.map((evidence) => evidence.merchantId),
      ...conflictingEvidence.map((evidence) => evidence.merchantId),
    ]);

    if (input.resolution.workspaceId !== input.workspaceId) {
      blockingErrors.push({ code: 'CROSS_WORKSPACE_INPUT', message: 'resolution evidence belongs to another workspace' });
    }
    if (input.intent === 'SELECT_MERCHANT') {
      if (!input.selectedMerchantId || !evidenceMerchantIds.includes(input.selectedMerchantId)) {
        blockingErrors.push({ code: 'SELECTED_MERCHANT_NOT_IN_EVIDENCE', message: 'selected merchant must appear in preserved conflict evidence' });
      } else {
        targetMerchantIds = [input.selectedMerchantId];
      }
    }
    if (!['SELECT_MERCHANT', 'ABSTAIN', 'DISMISS'].includes(input.intent)) {
      blockingErrors.push({ code: 'INVALID_CONFLICT_INTENT', message: 'explicit conflict intent is required' });
    }
    if (input.resolution.status === 'CONFLICTED' && conflictingEvidence.length === 0) {
      blockingErrors.push({ code: 'CONFLICT_EVIDENCE_DISCARDED', message: 'conflicting resolution evidence must be preserved' });
    }
    rollbackPlan.push({ recordType: 'CONFLICT', recordId: input.requestKey, restore: { status: 'OPEN', merchantId: null } });
    if (input.intent !== 'SELECT_MERCHANT') {
      validationWarnings.push('Conflict remains untrusted; no alias or fingerprint becomes trusted automatically.');
    }
  }

  if (input.action === 'REASSIGN_KNOWLEDGE') {
    targetMerchantIds = [input.targetMerchantId];
    affectedAliasIds = sortedUnique(input.affectedAliasIds);
    affectedFingerprintIds = sortedUnique(input.affectedFingerprintIds);
    if (!merchantById.has(input.targetMerchantId)) {
      blockingErrors.push({ code: 'MISSING_MERCHANT', message: `unknown target merchant: ${input.targetMerchantId}` });
    }
    blockingErrors.push(...validateAffectedIds(aliases, fingerprints, affectedAliasIds, affectedFingerprintIds));
    blockingErrors.push(...collisionErrors(aliases, fingerprints, affectedAliasIds, affectedFingerprintIds, input.targetMerchantId));
    for (const id of affectedAliasIds) {
      const record = aliasById.get(id);
      if (!record) continue;
      sourceMerchantIds.push(record.merchantId);
      rollbackPlan.push({ recordType: 'ALIAS', recordId: id, restore: { merchantId: record.merchantId, status: record.status } });
      record.merchantId = input.targetMerchantId;
    }
    for (const id of affectedFingerprintIds) {
      const record = fingerprintById.get(id);
      if (!record) continue;
      if (record.merchantId) sourceMerchantIds.push(record.merchantId);
      rollbackPlan.push({ recordType: 'FINGERPRINT', recordId: id, restore: { merchantId: record.merchantId, status: record.status } });
      record.merchantId = input.targetMerchantId;
    }
    sourceMerchantIds = sortedUnique(sourceMerchantIds);
  }

  if (input.action === 'DEPRECATE_ALIAS') {
    affectedAliasIds = [input.aliasId];
    const record = aliasById.get(input.aliasId);
    if (!record) blockingErrors.push({ code: 'UNKNOWN_ALIAS', message: `unknown alias: ${input.aliasId}` });
    if (record) {
      sourceMerchantIds = [record.merchantId];
      rollbackPlan.push({ recordType: 'ALIAS', recordId: record.id, restore: { merchantId: record.merchantId, status: record.status } });
      record.status = 'DEPRECATED';
    }
  }

  if (input.action === 'DEPRECATE_MERCHANT') {
    sourceMerchantIds = [input.merchantId];
    const record = merchantById.get(input.merchantId);
    if (!record) blockingErrors.push({ code: 'MISSING_MERCHANT', message: `unknown merchant: ${input.merchantId}` });
    if (record) {
      rollbackPlan.push({ recordType: 'MERCHANT', recordId: record.id, restore: { status: record.status, mergedIntoMerchantId: record.mergedIntoMerchantId } });
      record.status = 'DEPRECATED';
    }
  }

  const proposedAfterState = snapshot(merchants, aliases, fingerprints);
  const hashInput = {
    action: input.action,
    workspaceId: input.workspaceId.trim(),
    actorId: input.actorId.trim(),
    requestKey: input.requestKey.trim(),
    reason: input.reason.trim(),
    sourceMerchantIds: sortedUnique(sourceMerchantIds),
    targetMerchantIds: sortedUnique(targetMerchantIds),
    affectedAliasIds,
    affectedFingerprintIds,
    beforeState,
    proposedAfterState,
    supportingEvidence,
    conflictingEvidence,
    validationWarnings,
    blockingErrors,
    rollbackPlan,
    planVersion: MERCHANT_IDENTITY_PLAN_VERSION,
  };

  return {
    action: input.action,
    workspaceId: input.workspaceId.trim(),
    actorId: input.actorId.trim(),
    requestKey: input.requestKey.trim(),
    planVersion: MERCHANT_IDENTITY_PLAN_VERSION,
    planHash: stableHash(hashInput),
    reason: input.reason.trim(),
    sourceMerchantIds: sortedUnique(sourceMerchantIds),
    targetMerchantIds: sortedUnique(targetMerchantIds),
    affectedAliasIds,
    affectedFingerprintIds,
    beforeState,
    proposedAfterState,
    supportingEvidence,
    conflictingEvidence,
    validationWarnings,
    blockingErrors,
    rollbackPlan: rollbackPlan.sort((left, right) =>
      left.recordType.localeCompare(right.recordType) || left.recordId.localeCompare(right.recordId)),
    administratorConfirmationRequired: true,
  };
};

export const planMerchantIdentityChange = (
  input: MerchantIdentityPlanInput,
): MerchantIdentityPlan => buildPlan(input);
