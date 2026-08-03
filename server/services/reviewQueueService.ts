import type {
  Category,
  Account,
  CategorizationRule,
  CategorizationSuggestion,
  Prisma,
  Project,
  SuggestionConfidence,
  SuggestionMatcher,
  Transaction,
  TransactionBooking,
  TransactionClassificationSource,
  TransactionDirection,
  TransactionType,
} from '@prisma/client';
import { rejectUnsafeBulkConfirmation } from './reviewDecisionService';
import {
  OWNER_HISTORY_PRODUCER_KEY,
  OWNER_HISTORY_PRODUCER_VERSION,
} from './ownerHistoryProposalEvidenceService';

export { OWNER_HISTORY_PRODUCER_KEY, OWNER_HISTORY_PRODUCER_VERSION };

type TxClient = Prisma.TransactionClient;

export type ReviewSuggestionProducerTier =
  | 'OWNER_HISTORY_V2'
  | 'LEGACY_UNOWNED'
  | 'UNRECOGNIZED';

export const classifyProducerTier = (alt: ReviewEvidenceAlternative): ReviewSuggestionProducerTier => {
  if (alt.producerKey === OWNER_HISTORY_PRODUCER_KEY && alt.producerVersion === OWNER_HISTORY_PRODUCER_VERSION) {
    return 'OWNER_HISTORY_V2';
  }
  if (alt.producerKey === null && alt.producerVersion === null) {
    return 'LEGACY_UNOWNED';
  }
  return 'UNRECOGNIZED';
};

export type ReviewPrefillIneligibilityReason =
  | 'INCOMPLETE_TRIPLE'
  | 'PROJECT_UNAVAILABLE'
  | 'PROJECT_INACTIVE'
  | 'TRANSACTION_TYPE_UNAVAILABLE'
  | 'TRANSACTION_TYPE_INACTIVE'
  | 'TRANSACTION_TYPE_DIRECTION_MISMATCH'
  | 'CATEGORY_UNAVAILABLE'
  | 'CATEGORY_INACTIVE'
  | 'WORKSPACE_MISMATCH'
  | 'TRANSACTION_MISMATCH'
  | 'UNRECOGNIZED_PRODUCER'
  | 'INVALID_TRUSTED_CONTEXT'
  | 'SUGGESTION_NOT_PENDING';

export type ReviewPrefillEligibility = Readonly<{
  eligible: boolean;
  reasons: ReviewPrefillIneligibilityReason[];
}>;

export type ReviewPrefillTrustedContext = Readonly<{
  expectedWorkspaceId: string;
  expectedTransactionId: string;
  transactionDirection: TransactionDirection;
}>;

export const checkPrefillEligibility = (
  suggestion: ReviewTransaction['categorizationSuggestions'][number],
  trustedContext: ReviewPrefillTrustedContext,
): ReviewPrefillEligibility => {
  const { expectedWorkspaceId, expectedTransactionId, transactionDirection } = trustedContext;
  const reasons: ReviewPrefillIneligibilityReason[] = [];

  // 1. Fail closed: trusted context must supply non-empty workspace and transaction IDs.
  if (!expectedWorkspaceId) {
    reasons.push('INVALID_TRUSTED_CONTEXT');
    return { eligible: false, reasons };
  }
  if (!expectedTransactionId) {
    reasons.push('INVALID_TRUSTED_CONTEXT');
    return { eligible: false, reasons };
  }

  // 2. Check suggestion belongs to the expected transaction.
  if (suggestion.transactionId !== expectedTransactionId) {
    reasons.push('TRANSACTION_MISMATCH');
  }

  // 3. Check suggestion is currently pending.
  if (suggestion.status !== 'PENDING') {
    reasons.push('SUGGESTION_NOT_PENDING');
  }

  // 4. Check triple completeness
  if (!suggestion.projectId || !suggestion.transactionTypeId || !suggestion.categoryId) {
    reasons.push('INCOMPLETE_TRIPLE');
  }

  // 5. Check project
  if (!suggestion.project) {
    reasons.push('PROJECT_UNAVAILABLE');
  } else if (!suggestion.project.isActive) {
    reasons.push('PROJECT_INACTIVE');
  }

  // 6. Check transaction type
  if (!suggestion.transactionType) {
    reasons.push('TRANSACTION_TYPE_UNAVAILABLE');
  } else if (!suggestion.transactionType.isActive) {
    reasons.push('TRANSACTION_TYPE_INACTIVE');
  } else if (suggestion.transactionType.direction !== null && suggestion.transactionType.direction !== transactionDirection) {
    reasons.push('TRANSACTION_TYPE_DIRECTION_MISMATCH');
  }

  // 7. Check category
  if (!suggestion.category) {
    reasons.push('CATEGORY_UNAVAILABLE');
  } else if (!suggestion.category.isActive) {
    reasons.push('CATEGORY_INACTIVE');
  }

  // 8. Check workspace: suggestion itself and all three related records must match expectedWorkspaceId.
  if (
    suggestion.workspaceId !== expectedWorkspaceId
    || (suggestion.project && suggestion.project.workspaceId !== expectedWorkspaceId)
    || (suggestion.transactionType && suggestion.transactionType.workspaceId !== expectedWorkspaceId)
    || (suggestion.category && suggestion.category.workspaceId !== expectedWorkspaceId)
  ) {
    reasons.push('WORKSPACE_MISMATCH');
  }

  // 9. Check producer tier is recognized
  const tier = classifyProducerTier({ producerKey: suggestion.producerKey, producerVersion: suggestion.producerVersion } as ReviewEvidenceAlternative);
  if (tier === 'UNRECOGNIZED') {
    reasons.push('UNRECOGNIZED_PRODUCER');
  }

  return {
    eligible: reasons.length === 0,
    reasons,
  };
};

export type ReviewEvidenceStatus = 'finalized' | 'review_suggested' | 'conflict' | 'unmatched';

export type ReviewCategoryOption = Pick<Category, 'id' | 'name'>;

export type ReviewDimensionCandidate = {
  projectId: string | null;
  projectCode: string | null;
  projectLabel: string | null;
  transactionTypeId: string | null;
  transactionTypeLabel: string | null;
  categoryId: string | null;
  categoryLabel: string | null;
  complete: boolean;
};

export type ReviewEvidenceAlternative = ReviewDimensionCandidate & {
  suggestionId: string;
  rank: number;
  matcher: SuggestionMatcher;
  confidence: SuggestionConfidence;
  confidenceLabel: string;
  reason: string;
  matchedRuleIds: string[];
  historicalRecordIds: string[];
  evidenceHashes: string[];
  evidenceHash: string;
  producerKey: string | null;
  producerVersion: string | null;
  scoreBasisPoints: number | null;
  eligible: boolean;
};

export type PrefillSource =
  | 'AUTHORITATIVE_TRANSACTION'
  | 'EXISTING_BOOKING'
  | 'OWNER_HISTORY_V2'
  | 'LEGACY_HISTORY_FALLBACK'
  | 'NONE';

export type ReviewPrefillMetadata = {
  source: PrefillSource;
  complete: boolean;
  weakFallback: boolean;
  scoreBasisPoints: number | null;
  confidence: SuggestionConfidence | null;
  matcher: SuggestionMatcher | null;
};

export type EvidenceRichReviewItem = {
  id: string;
  transactionId: string;
  previewFingerprint: string | null;
  displayDate: string;
  rawIngDate: string;
  counterparty: string | null;
  counterpartyIban: string | null;
  accountIdentifier: string | null;
  accountName: string | null;
  amount: number;
  amountMinor: string;
  currency: string;
  direction: TransactionDirection;
  directionLabel: string;
  description: string;
  paymentPurpose: string | null;
  source: string;
  deterministicStatus: ReviewEvidenceStatus;
  statusLabel: string;
  reason: string;
  proposed: ReviewDimensionCandidate | null;
  prefill: ReviewPrefillMetadata;
  alternatives: ReviewEvidenceAlternative[];
  evidence: {
    matchedRuleIds: string[];
    historicalRecordIds: string[];
    evidenceHashes: string[];
    importFingerprint: string | null;
    exactReplayKey: string | null;
    reason: string;
  };
  safeDeterministicCandidate: boolean;
  requiresAdministratorApproval: true;
  sideEffects: {
    createsTransactionBooking: false;
    closesPeriod: false;
  };
};

export type ReviewPagination = {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
};

export type ReviewReliabilityBand = 'green' | 'amber' | 'red' | 'gray';
export type ReviewStateFilter = 'all' | 'incomplete';

export type ReviewQueueOptions = {
  page: number;
  pageSize: number;
  confidence?: ReviewReliabilityBand | null;
  direction?: TransactionDirection | null;
  projectId?: string | null;
  categoryId?: string | null;
  state?: ReviewStateFilter;
};

export type EvidenceRichReviewQueue = {
  transactions: EvidenceRichReviewItem[];
  categories: ReviewCategoryOption[];
  projects: Project[];
  transactionTypes: TransactionType[];
  pagination: ReviewPagination;
  message: string;
};

type ReviewQueueDbClient = Pick<TxClient, 'transaction' | 'category' | 'project' | 'transactionType'>;

type RawRecord = Record<string, unknown>;

const isPlainObject = (value: unknown): value is RawRecord =>
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

const getStringArray = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0);
  }
  if (typeof value === 'string' && value.trim()) {
    return [value.trim()];
  }
  return [];
};

const uniqueSorted = (values: string[]): string[] => Array.from(new Set(values)).sort();

const getEvidenceField = (evidence: unknown, keys: string[]): unknown => {
  if (!isPlainObject(evidence)) return undefined;
  for (const key of keys) {
    if (evidence[key] !== undefined) return evidence[key];
  }
  return undefined;
};

const extractEvidenceReason = (evidence: unknown): string | null => {
  const value = getEvidenceField(evidence, ['reason', 'reden', 'message']);
  return typeof value === 'string' && value.trim() ? value.trim() : null;
};

const extractRuleIds = (evidence: unknown, fallback?: string | null): string[] =>
  uniqueSorted([
    ...getStringArray(getEvidenceField(evidence, ['matchedRuleIds', 'ruleIds', 'ruleId'])),
    ...(fallback ? [fallback] : []),
  ]);

const extractHistoricalRecordIds = (evidence: unknown): string[] =>
  uniqueSorted(getStringArray(getEvidenceField(evidence, ['historicalRecordIds', 'historicalRecordId', 'historicalSourceTransactionId'])));

const extractEvidenceHashes = (evidence: unknown, fallback?: string | null): string[] =>
  uniqueSorted([
    ...getStringArray(getEvidenceField(evidence, ['historicalEvidenceHashes', 'ruleEvidenceHashes', 'evidenceHashes', 'evidenceHash'])),
    ...(fallback ? [fallback] : []),
  ]);

const extractExactReplayKey = (evidence: unknown): string | null => {
  const value = getEvidenceField(evidence, ['matchedExactReplayKey', 'exactReplayKey', 'historicalMatchKey']);
  return typeof value === 'string' && value.trim() ? value.trim() : null;
};

const makeCandidate = (input: {
  projectId?: string | null;
  projectCode?: string | null;
  projectLabel?: string | null;
  transactionTypeId?: string | null;
  transactionTypeLabel?: string | null;
  categoryId?: string | null;
  categoryLabel?: string | null;
}): ReviewDimensionCandidate => ({
  projectId: input.projectId ?? null,
  projectCode: input.projectCode ?? null,
  projectLabel: input.projectLabel ?? null,
  transactionTypeId: input.transactionTypeId ?? null,
  transactionTypeLabel: input.transactionTypeLabel ?? null,
  categoryId: input.categoryId ?? null,
  categoryLabel: input.categoryLabel ?? null,
  complete: Boolean(input.projectId && input.transactionTypeId && input.categoryId),
});

const candidateKey = (candidate: ReviewDimensionCandidate): string =>
  [candidate.projectId ?? '', candidate.transactionTypeId ?? '', candidate.categoryId ?? ''].join('|');

const classifyConfidence = (confidence: SuggestionConfidence): string => {
  switch (confidence) {
    case 'EXACT_FALLBACK':
      return 'exacte historische suggestie';
    case 'FUZZY':
      return 'waarschijnlijke suggestie';
    case 'OVERALL':
      return 'beste historische suggestie';
    case 'DEFAULT':
    default:
      return 'handmatige controle nodig';
  }
};

const classifyMatcher = (matcher: SuggestionMatcher): string => {
  switch (matcher) {
    case 'RULE_CANDIDATE':
      return 'Regelkandidaat gevonden.';
    case 'NORMALIZED_HISTORY':
      return 'Historische omschrijving lijkt overeen te komen.';
    case 'FUZZY_HISTORY':
      return 'Onzekere historische overeenkomst gevonden.';
    case 'BEST_HISTORY':
      return 'Beste historische alternatief gevonden.';
    case 'DIRECTION_DEFAULT':
    default:
      return 'Alleen de transactierichting geeft een aanwijzing.';
  }
};

const statusLabel = (status: ReviewEvidenceStatus): string => {
  switch (status) {
    case 'finalized':
      return 'Veilige deterministische kandidaat';
    case 'conflict':
      return 'Conflict, handmatig beoordelen';
    case 'review_suggested':
      return 'Suggestie, handmatig beoordelen';
    case 'unmatched':
    default:
      return 'Geen match, handmatig classificeren';
  }
};

const signedAmount = (amountMinor: bigint | number, direction: TransactionDirection): number => {
  const amount = Number(amountMinor) / 100;
  return direction === 'debit' ? -Math.abs(amount) : Math.abs(amount);
};

type ReviewSuggestion = CategorizationSuggestion & {
  project: Project | null;
  transactionType: TransactionType | null;
  category: Category | null;
};

type ReviewTransaction = Transaction & {
  account: Account | null;
  project: Project | null;
  transactionType: TransactionType | null;
  category: Category | null;
  classificationRule: Pick<CategorizationRule, 'id' | 'label'> | null;
  transactionBooking: (TransactionBooking & {
    project: Project;
    transactionType: TransactionType;
    category: Category;
  }) | null;
  categorizationSuggestions: ReviewSuggestion[];
};

const buildAlternative = (
  suggestion: ReviewTransaction['categorizationSuggestions'][number],
  trustedContext: ReviewPrefillTrustedContext,
): ReviewEvidenceAlternative => {
  const candidate = makeCandidate({
    projectId: suggestion.projectId,
    projectCode: suggestion.project?.code ?? null,
    projectLabel: suggestion.project?.name ?? null,
    transactionTypeId: suggestion.transactionTypeId,
    transactionTypeLabel: suggestion.transactionType?.literalName ?? null,
    categoryId: suggestion.categoryId,
    categoryLabel: suggestion.category?.name ?? null,
  });
  const reason = extractEvidenceReason(suggestion.evidence)
    ?? `${classifyMatcher(suggestion.matcher)} ${candidate.complete ? 'Controleer en keur bewust goed.' : 'Klant, type of categorie ontbreekt.'}`;

  const eligibility = checkPrefillEligibility(suggestion, trustedContext);

  return {
    ...candidate,
    suggestionId: suggestion.id,
    rank: suggestion.rank,
    matcher: suggestion.matcher,
    confidence: suggestion.confidence,
    confidenceLabel: classifyConfidence(suggestion.confidence),
    reason,
    matchedRuleIds: extractRuleIds(suggestion.evidence),
    historicalRecordIds: extractHistoricalRecordIds(suggestion.evidence),
    evidenceHashes: extractEvidenceHashes(suggestion.evidence, suggestion.evidenceHash),
    evidenceHash: suggestion.evidenceHash,
    producerKey: suggestion.producerKey ?? null,
    producerVersion: suggestion.producerVersion ?? null,
    scoreBasisPoints: suggestion.scoreBasisPoints ?? null,
    eligible: eligibility.eligible,
  };
};

const CONFIDENCE_ORDER: Record<SuggestionConfidence, number> = {
  EXACT_FALLBACK: 4,
  FUZZY: 3,
  OVERALL: 2,
  DEFAULT: 1,
};

const MATCHER_ORDER: Record<SuggestionMatcher, number> = {
  RULE_CANDIDATE: 5,
  NORMALIZED_HISTORY: 4,
  FUZZY_HISTORY: 3,
  BEST_HISTORY: 2,
  DIRECTION_DEFAULT: 1,
};

const isOwnerHistoryV2 = (alt: ReviewEvidenceAlternative): boolean =>
  alt.producerKey === OWNER_HISTORY_PRODUCER_KEY && alt.producerVersion === OWNER_HISTORY_PRODUCER_VERSION;

const compareAlternatives = (a: ReviewEvidenceAlternative, b: ReviewEvidenceAlternative): number => {
  // higher scoreBasisPoints wins (null counts as 0)
  const scoreDiff = (b.scoreBasisPoints ?? 0) - (a.scoreBasisPoints ?? 0);
  if (scoreDiff !== 0) return scoreDiff;
  // stronger confidence wins
  const confidenceDiff = CONFIDENCE_ORDER[b.confidence] - CONFIDENCE_ORDER[a.confidence];
  if (confidenceDiff !== 0) return confidenceDiff;
  // lower rank wins
  const rankDiff = a.rank - b.rank;
  if (rankDiff !== 0) return rankDiff;
  // stronger matcher wins
  const matcherDiff = MATCHER_ORDER[b.matcher] - MATCHER_ORDER[a.matcher];
  if (matcherDiff !== 0) return matcherDiff;
  // lexicographically smaller evidenceHash wins (stable)
  if (a.evidenceHash < b.evidenceHash) return -1;
  if (a.evidenceHash > b.evidenceHash) return 1;
  // lexicographically smaller suggestionId wins (stable)
  return a.suggestionId.localeCompare(b.suggestionId);
};

export const selectBestAvailableReviewSuggestion = (
  alternatives: ReviewEvidenceAlternative[],
): ReviewEvidenceAlternative | null => {
  // Tier A: eligible owner-history-v2 suggestions
  const eligibleTierA = alternatives.filter(
    (alt) => alt.eligible && classifyProducerTier(alt) === 'OWNER_HISTORY_V2',
  );
  if (eligibleTierA.length > 0) {
    return [...eligibleTierA].sort(compareAlternatives)[0];
  }

  // Tier B: eligible legacy/unowned suggestions
  const eligibleTierB = alternatives.filter(
    (alt) => alt.eligible && classifyProducerTier(alt) === 'LEGACY_UNOWNED',
  );
  if (eligibleTierB.length > 0) {
    return [...eligibleTierB].sort(compareAlternatives)[0];
  }

  return null;
};

export type ReviewPrefillSelectionInput = Readonly<{
  authoritativeTransaction: Readonly<{
    projectId: string | null;
    projectCode: string | null;
    projectLabel: string | null;
    transactionTypeId: string | null;
    transactionTypeLabel: string | null;
    categoryId: string | null;
    categoryLabel: string | null;
  }>;
  existingBooking: Readonly<{
    projectId: string;
    projectCode: string | null;
    projectLabel: string | null;
    transactionTypeId: string;
    transactionTypeLabel: string | null;
    categoryId: string;
    categoryLabel: string | null;
  }> | null;
  alternatives: ReviewEvidenceAlternative[];
}>;

export const selectReviewPrefill = (
  input: ReviewPrefillSelectionInput,
): Readonly<{
  proposed: ReviewDimensionCandidate | null;
  prefill: ReviewPrefillMetadata;
  selectedSuggestion: ReviewEvidenceAlternative | null;
}> => {
  const { authoritativeTransaction, existingBooking, alternatives } = input;

  // Tier 1: authoritative transaction classification (all three IDs non-null)
  const authCandidate = makeCandidate(authoritativeTransaction);
  if (authCandidate.complete) {
    return {
      proposed: authCandidate,
      prefill: {
        source: 'AUTHORITATIVE_TRANSACTION',
        complete: true,
        weakFallback: false,
        scoreBasisPoints: null,
        confidence: null,
        matcher: null,
      },
      selectedSuggestion: null,
    };
  }

  // Tier 2: existing booking
  if (existingBooking !== null) {
    const bookingCandidate = makeCandidate(existingBooking);
    return {
      proposed: bookingCandidate,
      prefill: {
        source: 'EXISTING_BOOKING',
        complete: bookingCandidate.complete,
        weakFallback: false,
        scoreBasisPoints: null,
        confidence: null,
        matcher: null,
      },
      selectedSuggestion: null,
    };
  }

  // Tier 3 & 4: suggestion-based (owner-history-v2 > legacy)
  const best = selectBestAvailableReviewSuggestion(alternatives);
  if (best) {
    const bestCandidate = makeCandidate({
      projectId: best.projectId,
      projectCode: best.projectCode,
      projectLabel: best.projectLabel,
      transactionTypeId: best.transactionTypeId,
      transactionTypeLabel: best.transactionTypeLabel,
      categoryId: best.categoryId,
      categoryLabel: best.categoryLabel,
    });
    const source: PrefillSource = isOwnerHistoryV2(best) ? 'OWNER_HISTORY_V2' : 'LEGACY_HISTORY_FALLBACK';
    return {
      proposed: bestCandidate,
      prefill: {
        source,
        complete: bestCandidate.complete,
        weakFallback: source === 'LEGACY_HISTORY_FALLBACK',
        scoreBasisPoints: best.scoreBasisPoints,
        confidence: best.confidence,
        matcher: best.matcher,
      },
      selectedSuggestion: best,
    };
  }

  return {
    proposed: null,
    prefill: {
      source: 'NONE',
      complete: false,
      weakFallback: false,
      scoreBasisPoints: null,
      confidence: null,
      matcher: null,
    },
    selectedSuggestion: null,
  };
};

type ProposedResult = {
  proposed: ReviewDimensionCandidate | null;
  prefill: ReviewPrefillMetadata;
  selectedSuggestion: ReviewEvidenceAlternative | null;
};

const buildProposedResult = (
  transaction: ReviewTransaction,
  alternatives: ReviewEvidenceAlternative[],
): ProposedResult => {
  return selectReviewPrefill({
    authoritativeTransaction: {
      projectId: transaction.projectId,
      projectCode: transaction.project?.code ?? null,
      projectLabel: transaction.project?.name ?? null,
      transactionTypeId: transaction.transactionTypeId,
      transactionTypeLabel: transaction.transactionType?.literalName ?? null,
      categoryId: transaction.categoryId,
      categoryLabel: transaction.category?.name ?? null,
    },
    existingBooking: transaction.transactionBooking
      ? {
          projectId: transaction.transactionBooking.projectId,
          projectCode: transaction.transactionBooking.project?.code ?? null,
          projectLabel: transaction.transactionBooking.literalProjectLabel,
          transactionTypeId: transaction.transactionBooking.transactionTypeId,
          transactionTypeLabel: transaction.transactionBooking.literalTypeLabel,
          categoryId: transaction.transactionBooking.categoryId,
          categoryLabel: transaction.transactionBooking.literalCategoryLabel,
        }
      : null,
    alternatives,
  });
};

const hasDeterministicSource = (source: TransactionClassificationSource | null): boolean =>
  source === 'rule' || source === 'history';

const classifyReviewStatus = (
  transaction: ReviewTransaction,
  proposed: ReviewDimensionCandidate | null,
  alternatives: ReviewEvidenceAlternative[],
): ReviewEvidenceStatus => {
  if (proposed?.complete && hasDeterministicSource(transaction.classificationSource)) {
    return 'finalized';
  }

  // Conflict is only meaningful when multiple eligible, recognized, complete alternatives disagree.
  // Ineligible or unrecognized suggestions must not create a false conflict.
  const eligibleCompleteKeys = uniqueSorted(
    alternatives
      .filter((alt) => alt.eligible && alt.complete && classifyProducerTier(alt) !== 'UNRECOGNIZED')
      .map(candidateKey),
  );

  if (eligibleCompleteKeys.length > 1) {
    return 'conflict';
  }

  if (alternatives.length || proposed) {
    return 'review_suggested';
  }

  return 'unmatched';
};

const buildStatusReason = (
  status: ReviewEvidenceStatus,
  proposed: ReviewDimensionCandidate | null,
  alternatives: ReviewEvidenceAlternative[],
): string => {
  if (status === 'finalized') {
    return 'Deze transactie heeft een complete deterministische kandidaat. Een beheerder moet de boeking nog expliciet goedkeuren.';
  }
  if (status === 'conflict') {
    return 'Er zijn meerdere complete alternatieven. Kies handmatig de juiste Klant, Type en Categorie.';
  }
  if (alternatives.some((alternative) => !alternative.complete) || (proposed && !proposed.complete)) {
    return 'Er is een onvolledige kandidaat. Klant, Type en Categorie moeten compleet zijn voordat er geboekt mag worden.';
  }
  if (status === 'review_suggested') {
    return 'Er is een suggestie, maar deze is niet automatisch geboekt.';
  }
  return 'Er is geen deterministische match gevonden. Classificeer deze transactie handmatig.';
};

const reliabilityBand = (item: EvidenceRichReviewItem): ReviewReliabilityBand => {
  const first = item.alternatives[0];
  if (item.deterministicStatus === 'conflict') return 'red';
  if (item.deterministicStatus === 'finalized' || first?.confidence === 'EXACT_FALLBACK') return 'green';
  if (first?.confidence === 'OVERALL') return 'amber';
  if (first?.confidence === 'FUZZY') return 'red';
  return 'gray';
};

const reliabilityRank: Record<ReviewReliabilityBand, number> = {
  red: 0,
  gray: 1,
  amber: 2,
  green: 3,
};

const filterItems = (items: EvidenceRichReviewItem[], options: ReviewQueueOptions): EvidenceRichReviewItem[] =>
  items.filter((item) => {
    if (options.confidence && reliabilityBand(item) !== options.confidence) return false;
    if (options.direction && item.direction !== options.direction) return false;
    if (options.projectId && item.proposed?.projectId !== options.projectId) return false;
    if (options.categoryId && item.proposed?.categoryId !== options.categoryId) return false;
    if (options.state === 'incomplete' && item.proposed?.complete === true) return false;
    return true;
  });

const sortItems = (items: EvidenceRichReviewItem[]): EvidenceRichReviewItem[] =>
  [...items].sort((left, right) => {
    const reliabilityDifference = reliabilityRank[reliabilityBand(left)] - reliabilityRank[reliabilityBand(right)];
    if (reliabilityDifference !== 0) return reliabilityDifference;
    const amountDifference = Math.abs(right.amount) - Math.abs(left.amount);
    if (amountDifference !== 0) return amountDifference;
    const leftTime = new Date(left.displayDate).getTime();
    const rightTime = new Date(right.displayDate).getTime();
    if (leftTime !== rightTime) return leftTime - rightTime;
    return left.transactionId.localeCompare(right.transactionId);
  });

export const buildReviewQueueTransactionWhere = (userId: string): Prisma.TransactionWhereInput => ({
  userId,
  OR: [
    { transactionBooking: null },
    { categoryId: null },
    { projectId: null },
    { transactionTypeId: null },
    { classificationSource: 'none' },
    { classificationSource: 'import' },
  ],
});

// Order alternatives deterministically:
// 1. selected eligible OWNER_HISTORY_V2 (if any)
// 2. remaining eligible OWNER_HISTORY_V2 by canonical comparator
// 3. eligible LEGACY_UNOWNED by canonical comparator
// 4. ineligible recognized (OWNER_HISTORY_V2 and LEGACY_UNOWNED) — stable
// 5. UNRECOGNIZED — stable
const orderAlternatives = (
  alternatives: ReviewEvidenceAlternative[],
  selected: ReviewEvidenceAlternative | null,
): ReviewEvidenceAlternative[] => {
  const selectedId = selected?.suggestionId;
  const tierScore = (alt: ReviewEvidenceAlternative): number => {
    const tier = classifyProducerTier(alt);
    if (alt.eligible && tier === 'OWNER_HISTORY_V2') return alt.suggestionId === selectedId ? 0 : 1;
    if (alt.eligible && tier === 'LEGACY_UNOWNED') return 2;
    if (!alt.eligible && tier !== 'UNRECOGNIZED') return 3;
    return 4;
  };
  return [...alternatives].sort((a, b) => {
    const tierDiff = tierScore(a) - tierScore(b);
    if (tierDiff !== 0) return tierDiff;
    // Within eligible tiers, use canonical comparator
    if ((tierScore(a) === 1 || tierScore(a) === 2) && (tierScore(b) === 1 || tierScore(b) === 2)) {
      return compareAlternatives(a, b);
    }
    // Stable tiebreak
    if (a.evidenceHash < b.evidenceHash) return -1;
    if (a.evidenceHash > b.evidenceHash) return 1;
    return a.suggestionId.localeCompare(b.suggestionId);
  });
};

const buildReviewItem = (transaction: ReviewTransaction, trustedContext: ReviewPrefillTrustedContext): EvidenceRichReviewItem => {
  const rawAlts = transaction.categorizationSuggestions.map((s) => buildAlternative(s, trustedContext));
  const { proposed, prefill, selectedSuggestion } = buildProposedResult(transaction, rawAlts);
  const alternatives = orderAlternatives(rawAlts, selectedSuggestion);
  const deterministicStatus = classifyReviewStatus(transaction, proposed, rawAlts);
  const reason = buildStatusReason(deterministicStatus, proposed, rawAlts);
  const evidenceHashes = uniqueSorted([
    ...rawAlts.flatMap((alternative) => alternative.evidenceHashes),
    ...(transaction.transactionBooking ? [transaction.transactionBooking.evidenceHash] : []),
  ]);
  const matchedRuleIds = uniqueSorted([
    ...rawAlts.flatMap((alternative) => alternative.matchedRuleIds),
    ...(transaction.classificationRuleId ? [transaction.classificationRuleId] : []),
    ...(transaction.transactionBooking?.ruleId ? [transaction.transactionBooking.ruleId] : []),
  ]);
  const historicalRecordIds = uniqueSorted([
    ...rawAlts.flatMap((alternative) => alternative.historicalRecordIds),
    ...(transaction.transactionBooking?.historicalSourceTransactionId ? [transaction.transactionBooking.historicalSourceTransactionId] : []),
  ]);
  const rawIngDate = normalizeOptional(readRawValue(transaction.rawRow, 'Date')) ?? transaction.date.toISOString().slice(0, 10);
  const paymentPurpose =
    normalizeOptional(readRawValue(transaction.rawRow, 'Notifications'))
    ?? normalizeOptional(readRawValue(transaction.rawRow, 'Notification'))
    ?? transaction.reference
    ?? null;

  return {
    id: transaction.id,
    transactionId: transaction.id,
    previewFingerprint: transaction.importFingerprint ?? null,
    displayDate: transaction.date.toISOString(),
    rawIngDate,
    counterparty: transaction.counterparty ?? null,
    counterpartyIban: transaction.counterparty ?? normalizeOptional(readRawValue(transaction.rawRow, 'Counterparty')),
    accountIdentifier: transaction.account?.identifier ?? normalizeOptional(readRawValue(transaction.rawRow, 'Account')),
    accountName: transaction.account?.name ?? null,
    amount: signedAmount(transaction.amountMinor, transaction.direction),
    amountMinor: transaction.amountMinor.toString(),
    currency: transaction.currency,
    direction: transaction.direction,
    directionLabel: transaction.direction === 'debit' ? 'Afschrijving' : 'Bijschrijving',
    description: transaction.description,
    paymentPurpose,
    source: transaction.source,
    deterministicStatus,
    statusLabel: statusLabel(deterministicStatus),
    reason,
    proposed,
    prefill,
    alternatives,
    evidence: {
      matchedRuleIds,
      historicalRecordIds,
      evidenceHashes,
      importFingerprint: transaction.importFingerprint ?? null,
      exactReplayKey: extractExactReplayKey(transaction.transactionBooking?.evidence),
      reason,
    },
    safeDeterministicCandidate: deterministicStatus === 'finalized',
    requiresAdministratorApproval: true,
    sideEffects: {
      createsTransactionBooking: false,
      closesPeriod: false,
    },
  };
};

export const buildEvidenceRichReviewQueue = (
  transactions: ReviewTransaction[],
  dimensions: Pick<EvidenceRichReviewQueue, 'categories' | 'projects' | 'transactionTypes'>,
  options: ReviewQueueOptions = { page: 1, pageSize: 25, state: 'all' },
  workspaceId?: string,
): EvidenceRichReviewQueue => {
  const orderedItems = sortItems(filterItems(transactions.map((tx) => {
    const trustedContext: ReviewPrefillTrustedContext = {
      expectedWorkspaceId: workspaceId ?? '',  // empty string causes INVALID_TRUSTED_CONTEXT fail-closed
      expectedTransactionId: tx.id,
      transactionDirection: tx.direction,
    };
    return buildReviewItem(tx, trustedContext);
  }), options));
  const totalItems = orderedItems.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / options.pageSize));
  const page = Math.min(options.page, totalPages);
  const start = (page - 1) * options.pageSize;

  return {
    transactions: orderedItems.slice(start, start + options.pageSize),
    categories: dimensions.categories,
    projects: dimensions.projects,
    transactionTypes: dimensions.transactionTypes,
    pagination: {
      page,
      pageSize: options.pageSize,
      totalItems,
      totalPages,
      hasPreviousPage: page > 1,
      hasNextPage: page < totalPages,
    },
    message: 'Beoordelingsrij geladen. Er zijn geen boekingen of periodeafsluitingen gemaakt.',
  };
};

export const getEvidenceRichReviewQueue = async (
  db: ReviewQueueDbClient,
  userId: string,
  workspaceId: string,
  options: ReviewQueueOptions,
): Promise<EvidenceRichReviewQueue> => {
  const where = buildReviewQueueTransactionWhere(userId);
  const [transactions, categories, projects, transactionTypes] = await Promise.all([
    db.transaction.findMany({
      where,
      include: {
        account: true,
        project: true,
        transactionType: true,
        category: true,
        classificationRule: {
          select: {
            id: true,
            label: true,
          },
        },
        transactionBooking: {
          include: {
            project: true,
            transactionType: true,
            category: true,
          },
        },
        categorizationSuggestions: {
          where: {
            status: 'PENDING',
          },
          include: {
            project: true,
            transactionType: true,
            category: true,
          },
          orderBy: {
            rank: 'asc',
          },
        },
      },
      orderBy: [
        { date: 'asc' },
        { id: 'asc' },
      ],
    }),
    db.category.findMany({
      where: { workspaceId },
      select: {
        id: true,
        name: true,
      },
      orderBy: {
        name: 'asc',
      },
    }),
    db.project.findMany({
      where: { isActive: true, workspaceId },
      orderBy: { name: 'asc' },
    }),
    db.transactionType.findMany({
      where: { isActive: true, workspaceId },
      select: { id: true, workspaceId: true, literalName: true, direction: true, isActive: true, isHistorical: true, sortOrder: true, createdAt: true, updatedAt: true },
      orderBy: [{ sortOrder: 'asc' }, { literalName: 'asc' }],
    }),
  ]);

  return buildEvidenceRichReviewQueue(
    transactions as ReviewTransaction[],
    { categories, projects, transactionTypes },
    options,
    workspaceId,
  );
};

/**
 * Bulk clearing the review queue is no longer a financial mutation.
 *
 * MODEL-003 requires every transaction to be reviewed through an explicit
 * ReviewDecision and TransactionBooking write. Keeping this helper preserves
 * the existing route boundary while preventing silent manual truth creation.
 */
export const clearReviewQueue = async (_tx: TxClient, _userId: string): Promise<number> => {
  return rejectUnsafeBulkConfirmation();
};
