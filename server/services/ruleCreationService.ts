import type { CategorizationRule, Prisma, RuleMatchField, RuleMatchType } from '@prisma/client';
import { canonicalizeEvidence, hashEvidence, INCOMPLETE_DIMENSIONS_MESSAGE, type ReviewDecisionActor } from './reviewDecisionService';
import { createRule, matchesRule, type RuleCondition, type RuleEvaluationContext } from './ruleEngine';

type TxClient = Prisma.TransactionClient;

type RuleCreationDbClient = Pick<
  TxClient,
  'transaction' | 'reviewDecision' | 'project' | 'transactionType' | 'category' | 'categorizationRule'
>;

type RuleCreationConditionField = RuleCondition['field'];
type RuleCreationConditionMatchType = RuleCondition['matchType'];

export type RuleCreationCondition = {
  field: RuleCreationConditionField;
  matchType: RuleCreationConditionMatchType;
  value: string;
};

export type RuleCreationDimensionPreview = {
  projectId: string;
  projectLabel: string;
  transactionTypeId: string;
  transactionTypeLabel: string;
  categoryId: string;
  categoryLabel: string;
};

export type RuleCreationPreviewInput = {
  actor: ReviewDecisionActor;
  transactionId: string;
  reviewDecisionId?: string | null;
  projectId?: string | null;
  transactionTypeId?: string | null;
  categoryId?: string | null;
  label?: string | null;
  conditions?: RuleCreationCondition[];
  confidence?: string | null;
};

export type RuleCreationActivationInput = RuleCreationPreviewInput & {
  previewHash?: string | null;
  explicitConfirmation?: boolean;
};

export type RuleCreationPreview = {
  transactionId: string;
  reviewDecisionId: string | null;
  label: string;
  conditions: RuleCreationCondition[];
  expected: RuleCreationDimensionPreview | null;
  matchedTransactionIds: string[];
  activationAllowed: boolean;
  rejectionReasons: string[];
  previewHash: string;
  sideEffects: {
    createsTransactionBooking: false;
    closesPeriod: false;
  };
};

export class RuleCreationError extends Error {
  statusCode: number;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = 'RuleCreationError';
    this.statusCode = statusCode;
  }
}

const BROAD_VALUES = new Set(['*', '%', '.*', '^.*$', '.+', '^.+$', 'all', 'alles']);
const TEXT_FIELDS = new Set<RuleCreationConditionField>(['payee', 'counterparty', 'description', 'paymentPurpose', 'source', 'reference']);
const SAFE_CONFIDENCE = new Set(['deterministic', 'exact', 'exact_fallback', 'rule']);

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const readRawValue = (raw: unknown, key: string): string | null => {
  if (!isPlainObject(raw)) return null;
  const direct = raw[key];
  if (typeof direct === 'string') return direct;
  const columns = raw.columns;
  if (isPlainObject(columns) && typeof columns[key] === 'string') {
    return columns[key];
  }
  return null;
};

const normalizeOptional = (value: string | null | undefined): string | null => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
};

const assertAdminActor = (actor: ReviewDecisionActor) => {
  if (actor.role && actor.role !== 'admin') {
    throw new RuleCreationError('Alleen beheerders mogen regels activeren.', 403);
  }
};

const assertCompleteDimensions = (input: RuleCreationPreviewInput) => {
  if (!input.projectId || !input.transactionTypeId || !input.categoryId) {
    throw new RuleCreationError(INCOMPLETE_DIMENSIONS_MESSAGE, 400);
  }
};

const uniqueSorted = (values: string[]): string[] => Array.from(new Set(values)).sort();

const sanitizeConditions = (conditions: RuleCreationCondition[] | undefined): RuleCreationCondition[] =>
  (Array.isArray(conditions) ? conditions : [])
    .map((condition) => ({
      field: condition.field,
      matchType: condition.matchType,
      value: String(condition.value ?? '').trim(),
    }))
    .filter((condition) => condition.value.length > 0);

const validateConditions = (conditions: RuleCreationCondition[]): string[] => {
  const reasons: string[] = [];
  if (!conditions.length) {
    reasons.push('Voeg minimaal een specifieke regelvoorwaarde toe.');
    return reasons;
  }

  const hasTextCondition = conditions.some((condition) => TEXT_FIELDS.has(condition.field));

  for (const condition of conditions) {
    if (!['payee', 'counterparty', 'description', 'paymentPurpose', 'amount', 'source', 'reference'].includes(condition.field)) {
      reasons.push(`Voorwaardeveld "${condition.field}" wordt niet ondersteund.`);
      continue;
    }
    if (!['contains', 'startsWith', 'endsWith', 'equals', 'regex'].includes(condition.matchType)) {
      reasons.push(`Vergelijking "${condition.matchType}" wordt niet ondersteund.`);
      continue;
    }

    const normalized = condition.value.trim().toLowerCase();
    if (BROAD_VALUES.has(normalized)) {
      reasons.push('De regelvoorwaarde is te breed om veilig te activeren.');
    }
    if (condition.field === 'amount' && !hasTextCondition) {
      reasons.push('Een bedrag alleen is te breed; combineer het met omschrijving, tegenpartij, kenmerk of betalingskenmerk.');
    }
    if (TEXT_FIELDS.has(condition.field) && normalized.length < 4) {
      reasons.push('Tekstvoorwaarden moeten minimaal vier tekens bevatten.');
    }
    if (condition.matchType === 'regex') {
      try {
        const regex = new RegExp(condition.value, 'i');
        if (regex.test('veiligheidscontrole') && regex.test('andere volledige omschrijving')) {
          reasons.push('De regex is te breed om veilig te activeren.');
        }
      } catch {
        reasons.push('De regex is ongeldig.');
      }
    }
  }

  return uniqueSorted(reasons);
};

const buildPaymentPurpose = (transaction: { rawRow?: Prisma.JsonValue | null; reference?: string | null }): string | null =>
  normalizeOptional(readRawValue(transaction.rawRow, 'Notifications'))
  ?? normalizeOptional(readRawValue(transaction.rawRow, 'Notification'))
  ?? transaction.reference
  ?? null;

const buildEvaluationContext = (transaction: {
  description: string;
  normalizedKey?: string | null;
  counterparty?: string | null;
  reference?: string | null;
  source?: string | null;
  amountMinor?: bigint | number | null;
  rawRow?: Prisma.JsonValue | null;
}): RuleEvaluationContext => ({
  description: transaction.description,
  normalizedDescription: transaction.normalizedKey ?? transaction.description.toLowerCase(),
  counterparty: transaction.counterparty ?? null,
  paymentPurpose: buildPaymentPurpose(transaction),
  reference: transaction.reference ?? null,
  source: transaction.source ?? null,
  amountMinor: transaction.amountMinor ?? null,
});

const fakeRule = (input: {
  id?: string;
  userId: string;
  categoryId: string;
  conditions: RuleCreationCondition[];
}): CategorizationRule => ({
  id: input.id ?? 'rule-preview',
  userId: input.userId,
  importBatchId: null,
  ledgerId: null,
  categoryId: input.categoryId,
  label: 'Regelvoorbeeld',
  pattern: input.conditions[0]?.value ?? null,
  matchType: null,
  matchField: null,
  conditions: input.conditions as unknown as Prisma.JsonValue,
  priority: 100,
  isActive: true,
  createdBy: null,
  createdAt: new Date(0),
  updatedAt: new Date(0),
  lastMatchedAt: null,
});

const conditionKey = (conditions: RuleCreationCondition[]): string =>
  canonicalizeEvidence(conditions.map((condition) => ({
    field: condition.field,
    matchType: condition.matchType,
    value: condition.value.trim().toLowerCase(),
  })));

const dimensionKey = (value: { projectId?: string | null; transactionTypeId?: string | null; categoryId?: string | null }): string | null => {
  if (!value.projectId || !value.transactionTypeId || !value.categoryId) return null;
  return [value.projectId, value.transactionTypeId, value.categoryId].join('|');
};

const labelForRule = (input: RuleCreationPreviewInput, expected: RuleCreationDimensionPreview): string => {
  const explicit = input.label?.trim();
  if (explicit) return explicit;
  return `Beoordeeld: ${expected.projectLabel} / ${expected.transactionTypeLabel} / ${expected.categoryLabel}`;
};

const legacyMatchField = (field: RuleCreationConditionField): RuleMatchField => {
  switch (field) {
    case 'counterparty':
      return 'counterparty';
    case 'reference':
      return 'reference';
    case 'source':
      return 'source';
    case 'description':
    case 'paymentPurpose':
    case 'payee':
    case 'amount':
    default:
      return 'description';
  }
};

const legacyMatchType = (matchType: RuleCreationConditionMatchType): RuleMatchType => {
  if (matchType === 'startsWith' || matchType === 'endsWith' || matchType === 'regex') return matchType;
  return 'contains';
};

const isApprovedDecision = (
  transaction: {
    projectId?: string | null;
    transactionTypeId?: string | null;
    categoryId?: string | null;
    classificationSource?: string | null;
    transactionBooking?: { projectId: string; transactionTypeId: string; categoryId: string } | null;
  },
  expectedKey: string,
): boolean =>
  dimensionKey(transaction.transactionBooking ?? {}) === expectedKey
  || (
    transaction.classificationSource === 'manual'
    && dimensionKey(transaction) === expectedKey
  );

const matchesExpectedDecision = (decision: {
  afterProjectId?: string | null;
  afterTypeId?: string | null;
  afterCategoryId?: string | null;
} | null, input: RuleCreationPreviewInput): boolean =>
  Boolean(
    decision
    && decision.afterProjectId === input.projectId
    && decision.afterTypeId === input.transactionTypeId
    && decision.afterCategoryId === input.categoryId,
  );

const buildPreviewHash = (preview: Omit<RuleCreationPreview, 'previewHash'>): string =>
  hashEvidence({
    transactionId: preview.transactionId,
    reviewDecisionId: preview.reviewDecisionId,
    label: preview.label,
    conditions: preview.conditions,
    expected: preview.expected,
    matchedTransactionIds: preview.matchedTransactionIds,
    activationAllowed: preview.activationAllowed,
    rejectionReasons: preview.rejectionReasons,
  });

export const previewRuleCreation = async (
  db: RuleCreationDbClient,
  input: RuleCreationPreviewInput,
): Promise<RuleCreationPreview> => {
  assertAdminActor(input.actor);
  assertCompleteDimensions(input);

  const conditions = sanitizeConditions(input.conditions);
  const conditionRejections = validateConditions(conditions);
  const confidence = input.confidence?.trim().toLowerCase();
  const rejectionReasons = [...conditionRejections];

  if (confidence && !SAFE_CONFIDENCE.has(confidence)) {
    rejectionReasons.push('Alleen exacte of deterministische beslissingen mogen een actieve regel worden.');
  }

  const transaction = await db.transaction.findFirst({
    where: { id: input.transactionId, userId: input.actor.userId },
    include: {
      transactionBooking: true,
    },
  });

  if (!transaction) {
    throw new RuleCreationError('Transactie niet gevonden.', 404);
  }

  const [project, transactionType, category, reviewDecision, existingRules, candidateTransactions] = await Promise.all([
    db.project.findUnique({ where: { id: input.projectId } }),
    db.transactionType.findUnique({ where: { id: input.transactionTypeId } }),
    db.category.findUnique({ where: { id: input.categoryId } }),
    input.reviewDecisionId
      ? db.reviewDecision.findFirst({
          where: {
            id: input.reviewDecisionId,
            transactionId: input.transactionId,
          },
        })
      : Promise.resolve(null),
    db.categorizationRule.findMany({
      where: { userId: input.actor.userId, isActive: true },
    }),
    db.transaction.findMany({
      where: { userId: input.actor.userId },
      include: {
        transactionBooking: true,
      },
    }),
  ]);

  if (!project || !transactionType || !category) {
    rejectionReasons.push(INCOMPLETE_DIMENSIONS_MESSAGE);
  } else if (
    project.workspaceId !== transactionType.workspaceId
    || project.workspaceId !== category.workspaceId
  ) {
    rejectionReasons.push('Klant, type en categorie moeten bij dezelfde werkruimte horen.');
  }

  const expectedKey = dimensionKey(input);
  if (!expectedKey) {
    rejectionReasons.push(INCOMPLETE_DIMENSIONS_MESSAGE);
  } else if (
    input.reviewDecisionId
      ? !matchesExpectedDecision(reviewDecision, input)
      : !isApprovedDecision(transaction, expectedKey)
  ) {
    rejectionReasons.push('Maak eerst een beoordeelde boeking met dezelfde Klant, Type en Categorie.');
  }

  const rule = fakeRule({
    userId: input.actor.userId,
    categoryId: input.categoryId!,
    conditions,
  });
  if (!matchesRule(rule, buildEvaluationContext(transaction))) {
    rejectionReasons.push('De regelvoorwaarden matchen de beoordeelde transactie niet.');
  }

  const matchedTransactions = candidateTransactions.filter((candidate) =>
    matchesRule(rule, buildEvaluationContext(candidate)),
  );
  const matchedTransactionIds = uniqueSorted(matchedTransactions.map((candidate) => candidate.id));
  const matchedDimensionKeys = uniqueSorted(
    matchedTransactions
      .map((candidate) => dimensionKey(candidate.transactionBooking ?? candidate))
      .filter((key): key is string => Boolean(key)),
  );

  if (!matchedTransactionIds.length) {
    rejectionReasons.push('De regel levert geen voorbeeldmatches op.');
  }
  if (matchedDimensionKeys.some((key) => key !== expectedKey)) {
    rejectionReasons.push('De regel matcht transacties met een andere Klant, Type of Categorie.');
  }

  const newConditionKey = conditionKey(conditions);
  const duplicateRule = existingRules.find((existing) =>
    conditionKey(sanitizeConditions(existing.conditions as unknown as RuleCreationCondition[])) === newConditionKey
    && existing.categoryId === input.categoryId,
  );
  if (duplicateRule) {
    rejectionReasons.push('Er bestaat al een actieve regel met dezelfde voorwaarden.');
  }

  const conflictingRule = existingRules.find((existing) =>
    existing.categoryId !== input.categoryId
    && (
      conditionKey(sanitizeConditions(existing.conditions as unknown as RuleCreationCondition[])) === newConditionKey
      || matchesRule(existing, buildEvaluationContext(transaction))
    ),
  );
  if (conflictingRule) {
    rejectionReasons.push('Er bestaat al een actieve regel die dezelfde transactie anders categoriseert.');
  }

  const expected = project && transactionType && category
    ? {
        projectId: project.id,
        projectLabel: project.name,
        transactionTypeId: transactionType.id,
        transactionTypeLabel: transactionType.literalName,
        categoryId: category.id,
        categoryLabel: category.name,
      }
    : null;

  const previewWithoutHash: Omit<RuleCreationPreview, 'previewHash'> = {
    transactionId: input.transactionId,
    reviewDecisionId: input.reviewDecisionId ?? null,
    label: expected ? labelForRule(input, expected) : input.label?.trim() ?? 'Beoordeelde regel',
    conditions,
    expected,
    matchedTransactionIds,
    activationAllowed: rejectionReasons.length === 0,
    rejectionReasons: uniqueSorted(rejectionReasons),
    sideEffects: {
      createsTransactionBooking: false,
      closesPeriod: false,
    },
  };

  return {
    ...previewWithoutHash,
    previewHash: buildPreviewHash(previewWithoutHash),
  };
};

export const activateRuleCreation = async (
  db: RuleCreationDbClient,
  input: RuleCreationActivationInput,
) => {
  if (!input.explicitConfirmation) {
    throw new RuleCreationError('Bevestig expliciet dat deze regel geactiveerd mag worden.', 400);
  }

  const preview = await previewRuleCreation(db, input);
  if (preview.previewHash !== input.previewHash) {
    throw new RuleCreationError('Het regelvoorbeeld is gewijzigd. Bekijk de regel opnieuw voordat je activeert.', 409);
  }
  if (!preview.activationAllowed || !preview.expected) {
    throw new RuleCreationError(preview.rejectionReasons[0] ?? 'Deze regel is niet veilig genoeg om te activeren.', 409);
  }

  const firstCondition = preview.conditions[0]!;
  const createdBy = input.actor.actorEmail ?? input.actor.actorId ?? input.actor.userId;
  const rule = await createRule(db as TxClient, input.actor.userId, {
    label: preview.label,
    pattern: firstCondition.value,
    matchType: legacyMatchType(firstCondition.matchType),
    matchField: legacyMatchField(firstCondition.field),
    categoryId: preview.expected.categoryId,
    priority: 100,
    isActive: true,
    createdBy,
    conditions: preview.conditions,
  });

  return {
    preview,
    rule,
    sideEffects: {
      createsTransactionBooking: false,
      closesPeriod: false,
    },
  };
};
