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

type TxClient = Prisma.TransactionClient;

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
  };
};

const buildProposedCandidate = (
  transaction: ReviewTransaction,
  alternatives: ReviewEvidenceAlternative[],
): ReviewDimensionCandidate | null => {
  const current = makeCandidate({
    projectId: transaction.projectId,
    projectCode: transaction.project?.code ?? null,
    projectLabel: transaction.project?.name ?? null,
    transactionTypeId: transaction.transactionTypeId,
    transactionTypeLabel: transaction.transactionType?.literalName ?? null,
    categoryId: transaction.categoryId,
    categoryLabel: transaction.category?.name ?? null,
  });

  if (current.complete) return current;

  if (transaction.transactionBooking) {
    return makeCandidate({
      projectId: transaction.transactionBooking.projectId,
      projectCode: transaction.transactionBooking.project?.code ?? null,
      projectLabel: transaction.transactionBooking.literalProjectLabel,
      transactionTypeId: transaction.transactionBooking.transactionTypeId,
      transactionTypeLabel: transaction.transactionBooking.literalTypeLabel,
      categoryId: transaction.transactionBooking.categoryId,
      categoryLabel: transaction.transactionBooking.literalCategoryLabel,
    });
  }

  const rankOne = alternatives.find((alternative) => alternative.rank === 1 && alternative.complete)
    ?? alternatives.find((alternative) => alternative.complete);
  if (rankOne) {
    return makeCandidate({
      projectId: rankOne.projectId,
      projectCode: rankOne.projectCode,
      projectLabel: rankOne.projectLabel,
      transactionTypeId: rankOne.transactionTypeId,
      transactionTypeLabel: rankOne.transactionTypeLabel,
      categoryId: rankOne.categoryId,
      categoryLabel: rankOne.categoryLabel,
    });
  }

  return null;
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

  const completeAlternativeKeys = uniqueSorted(
    alternatives
      .filter((alternative) => alternative.complete)
      .map(candidateKey),
  );

  if (completeAlternativeKeys.length > 1) {
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

const buildReviewItem = (transaction: ReviewTransaction): EvidenceRichReviewItem => {
  const alternatives = transaction.categorizationSuggestions.map(buildAlternative);
  const proposed = buildProposedCandidate(transaction, alternatives);
  const deterministicStatus = classifyReviewStatus(transaction, proposed, alternatives);
  const reason = buildStatusReason(deterministicStatus, proposed, alternatives);
  const evidenceHashes = uniqueSorted([
    ...alternatives.flatMap((alternative) => alternative.evidenceHashes),
    ...(transaction.transactionBooking ? [transaction.transactionBooking.evidenceHash] : []),
  ]);
  const matchedRuleIds = uniqueSorted([
    ...alternatives.flatMap((alternative) => alternative.matchedRuleIds),
    ...(transaction.classificationRuleId ? [transaction.classificationRuleId] : []),
    ...(transaction.transactionBooking?.ruleId ? [transaction.transactionBooking.ruleId] : []),
  ]);
  const historicalRecordIds = uniqueSorted([
    ...alternatives.flatMap((alternative) => alternative.historicalRecordIds),
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
): EvidenceRichReviewQueue => {
  const orderedItems = sortItems(filterItems(transactions.map(buildReviewItem), options));
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
  options: ReviewQueueOptions,
): Promise<EvidenceRichReviewQueue> => {
  const where: Prisma.TransactionWhereInput = {
    userId,
    OR: [
      { transactionBooking: null },
      { categoryId: null },
      { projectId: null },
      { transactionTypeId: null },
      { classificationSource: 'none' },
      { classificationSource: 'import' },
    ],
  };
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
      select: {
        id: true,
        name: true,
      },
      orderBy: {
        name: 'asc',
      },
    }),
    db.project.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    }),
    db.transactionType.findMany({
      where: { isActive: true },
      select: { id: true, workspaceId: true, literalName: true, direction: true, isActive: true, isHistorical: true, sortOrder: true, createdAt: true, updatedAt: true },
      orderBy: [{ sortOrder: 'asc' }, { literalName: 'asc' }],
    }),
  ]);

  return buildEvidenceRichReviewQueue(
    transactions as ReviewTransaction[],
    { categories, projects, transactionTypes },
    options,
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
