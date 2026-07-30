import crypto from 'node:crypto';
import type {
  SuggestionConfidence,
  SuggestionMatcher,
  TransactionDirection,
} from '@prisma/client';
import {
  evaluateMerchantRetrievalAnchor,
  merchantAnchorContribution,
  type EvaluatedMerchantRetrievalAnchor,
  type MerchantRetrievalAnchor,
} from './merchantRetrievalAnchor';
import { compareHistoricalFactualDirections } from './historicalDirectionCompatibilityService';

export const HISTORY_SUGGESTION_ALGORITHM_VERSION = 'history-v1';

export const HISTORY_SUGGESTION_COMPONENT_WEIGHTS = Object.freeze({
  exactIban: 3600,
  exactCounterparty: 2200,
  exactDescription: 1400,
  exactPurpose: 1000,
  tokenSimilarityMaximum: 1400,
  sameAccount: 500,
  exactAmount: 450,
  recurringMonth: 150,
  recencyMaximum: 400,
  merchantAnchorMaximum: 1500,
  frequencyMaximum: 800,
});

export type HistorySuggestionFacts = {
  transactionId: string;
  date: Date;
  accountId: string | null;
  direction: TransactionDirection;
  amountMinor: bigint;
  counterparty: string | null;
  counterpartyIban: string | null;
  description: string;
  paymentPurpose: string | null;
};

export type ApprovedHistoryBooking = HistorySuggestionFacts & {
  bookingId: string;
  projectId: string;
  transactionTypeId: string;
  categoryId: string;
  bookingEvidenceHash: string;
  merchantId?: string | null;
};

export type HistorySuggestionEvidence = {
  algorithmVersion: string;
  reason: string;
  targetTransactionId: string;
  matchedHistoricalTransactionIds: string[];
  matchedBookingIds: string[];
  historicalEvidenceHashes: string[];
  features: {
    exactIbanMatches: number;
    exactCounterpartyMatches: number;
    exactDescriptionMatches: number;
    exactPurposeMatches: number;
    exactAmountMatches: number;
    sameAccountMatches: number;
    recurringMonthMatches: number;
    maximumTokenSimilarityBasisPoints: number;
    compatibleHistoryCount: number;
    merchantAnchorMatches: number;
    maximumMerchantAnchorContributionBasisPoints: number;
  };
  merchantAnchor: {
    state: EvaluatedMerchantRetrievalAnchor['state'];
    anchorVersion: string;
    resolutionVersion: string;
    evidenceHash: string;
    evaluationHash: string;
    supportingEvidenceCount: number;
    conflictingEvidenceCount: number;
  };
  safeguards: {
    completeTriple: true;
    directionCompatible: true;
    createsTransactionBooking: false;
    requiresAdministratorApproval: true;
  };
};

export type RankedHistorySuggestion = {
  rank: number;
  projectId: string;
  transactionTypeId: string;
  categoryId: string;
  matcher: SuggestionMatcher;
  confidence: SuggestionConfidence;
  scoreBasisPoints: number;
  evidence: HistorySuggestionEvidence;
  evidenceHash: string;
};

type ScoredHistory = {
  history: ApprovedHistoryBooking;
  scoreBasisPoints: number;
  tokenSimilarityBasisPoints: number;
  exactIban: boolean;
  exactCounterparty: boolean;
  exactDescription: boolean;
  exactPurpose: boolean;
  exactAmount: boolean;
  sameAccount: boolean;
  recurringMonth: boolean;
  recencyContributionBasisPoints: number;
  merchantAnchorContributionBasisPoints: number;
};

type CandidateGroup = {
  projectId: string;
  transactionTypeId: string;
  categoryId: string;
  scored: ScoredHistory[];
};

const STOP_WORDS = new Set([
  'aan', 'af', 'bij', 'de', 'een', 'en', 'het', 'in', 'met', 'naar', 'of', 'op', 'over',
  'per', 'te', 'ter', 'van', 'voor', 'via', 'your', 'payment', 'betaling', 'omschrijving',
]);

const normalizeText = (value: string | null | undefined): string =>
  (value ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');

const normalizeIban = (value: string | null | undefined): string =>
  (value ?? '').replace(/\s+/g, '').toUpperCase();

const textTokens = (...values: Array<string | null | undefined>): string[] =>
  Array.from(new Set(
    normalizeText(values.filter(Boolean).join(' '))
      .split(' ')
      .filter((token) => token.length >= 3 && !STOP_WORDS.has(token)),
  )).sort();

const tokenSimilarityBasisPoints = (
  leftValues: Array<string | null | undefined>,
  rightValues: Array<string | null | undefined>,
): number => {
  const left = new Set(textTokens(...leftValues));
  const right = new Set(textTokens(...rightValues));
  if (left.size === 0 || right.size === 0) return 0;
  let intersection = 0;
  for (const token of left) {
    if (right.has(token)) intersection += 1;
  }
  const union = left.size + right.size - intersection;
  return union === 0 ? 0 : Math.round((intersection * 10000) / union);
};

const stableValue = (value: unknown): unknown => {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'bigint') return value.toString();
  if (Array.isArray(value)) return value.map(stableValue);
  if (typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, stableValue(entry)]),
    );
  }
  return value;
};

const evidenceHash = (value: unknown): string =>
  crypto.createHash('sha256').update(JSON.stringify(stableValue(value))).digest('hex');

const tripleKey = (booking: Pick<ApprovedHistoryBooking, 'projectId' | 'transactionTypeId' | 'categoryId'>): string =>
  `${booking.projectId}|${booking.transactionTypeId}|${booking.categoryId}`;

const scoreHistory = (
  target: HistorySuggestionFacts,
  history: ApprovedHistoryBooking,
  merchantAnchor: EvaluatedMerchantRetrievalAnchor,
): ScoredHistory => {
  const targetIban = normalizeIban(target.counterpartyIban);
  const historyIban = normalizeIban(history.counterpartyIban);
  const exactIban = Boolean(targetIban && historyIban && targetIban === historyIban);
  const targetCounterparty = normalizeText(target.counterparty);
  const historyCounterparty = normalizeText(history.counterparty);
  const exactCounterparty = Boolean(targetCounterparty && targetCounterparty === historyCounterparty);
  const targetDescription = normalizeText(target.description);
  const historyDescription = normalizeText(history.description);
  const exactDescription = Boolean(targetDescription && targetDescription === historyDescription);
  const targetPurpose = normalizeText(target.paymentPurpose);
  const historyPurpose = normalizeText(history.paymentPurpose);
  const exactPurpose = Boolean(targetPurpose && targetPurpose === historyPurpose);
  const exactAmount = target.amountMinor === history.amountMinor;
  const sameAccount = Boolean(target.accountId && target.accountId === history.accountId);
  const recurringMonth = target.date.getUTCMonth() === history.date.getUTCMonth();
  const similarity = tokenSimilarityBasisPoints(
    [target.counterparty, target.description, target.paymentPurpose],
    [history.counterparty, history.description, history.paymentPurpose],
  );
  const ageDays = Math.max(0, Math.floor((target.date.getTime() - history.date.getTime()) / 86400000));
  const recency = target.date >= history.date ? Math.max(0, 400 - Math.min(400, ageDays)) : 0;
  const merchantAnchorContributionBasisPoints = merchantAnchorContribution({
    anchor: merchantAnchor,
    historicalMerchantId: history.merchantId,
  });

  let score = 0;
  if (exactIban) score += 3600;
  if (exactCounterparty) score += 2200;
  if (exactDescription) score += 1400;
  if (exactPurpose) score += 1000;
  score += Math.round((similarity * 1400) / 10000);
  if (sameAccount) score += 500;
  if (exactAmount) score += 450;
  if (recurringMonth) score += 150;
  score += recency;
  score += merchantAnchorContributionBasisPoints;

  return {
    history,
    scoreBasisPoints: Math.min(10000, score),
    tokenSimilarityBasisPoints: similarity,
    exactIban,
    exactCounterparty,
    exactDescription,
    exactPurpose,
    exactAmount,
    sameAccount,
    recurringMonth,
    recencyContributionBasisPoints: recency,
    merchantAnchorContributionBasisPoints,
  };
};

const chooseMatcher = (items: ScoredHistory[]): SuggestionMatcher => {
  if (items.some((item) => item.exactIban || (item.exactCounterparty && item.exactDescription))) {
    return 'NORMALIZED_HISTORY';
  }
  if (items.some((item) => item.tokenSimilarityBasisPoints >= 3500)) {
    return 'FUZZY_HISTORY';
  }
  if (items.some((item) => item.exactCounterparty || item.exactDescription || item.exactPurpose)) {
    return 'BEST_HISTORY';
  }
  return 'DIRECTION_DEFAULT';
};

const chooseConfidence = (
  matcher: SuggestionMatcher,
  scoreBasisPoints: number,
): SuggestionConfidence => {
  if (matcher === 'NORMALIZED_HISTORY' && scoreBasisPoints >= 7000) return 'EXACT_FALLBACK';
  if (matcher === 'FUZZY_HISTORY' && scoreBasisPoints >= 4500) return 'FUZZY';
  if (matcher === 'BEST_HISTORY' && scoreBasisPoints >= 3000) return 'OVERALL';
  return 'DEFAULT';
};

const reasonFor = (
  matcher: SuggestionMatcher,
  items: ScoredHistory[],
): string => {
  const strongest = items[0]!;
  if (matcher === 'NORMALIZED_HISTORY' && strongest.exactIban) {
    return 'Beste lokale suggestie op basis van dezelfde tegenpartij-IBAN en goedgekeurde historische boekingen.';
  }
  if (matcher === 'NORMALIZED_HISTORY') {
    return 'Beste lokale suggestie op basis van dezelfde genormaliseerde tegenpartij en omschrijving.';
  }
  if (matcher === 'FUZZY_HISTORY') {
    return 'Beste lokale suggestie op basis van overeenkomstige tegenpartij- en omschrijvingsteksten.';
  }
  if (matcher === 'BEST_HISTORY') {
    return 'Beste complete historische boeking voor de beschikbare transactie-evidence.';
  }
  return 'Lage-zekerheidssuggestie op basis van de meest voorkomende complete historische boeking met dezelfde richting.';
};

const buildCandidate = (
  target: HistorySuggestionFacts,
  group: CandidateGroup,
  rank: number,
  algorithmVersion: string,
  merchantAnchor: EvaluatedMerchantRetrievalAnchor,
): RankedHistorySuggestion => {
  const sorted = [...group.scored].sort((left, right) => {
    if (left.scoreBasisPoints !== right.scoreBasisPoints) return right.scoreBasisPoints - left.scoreBasisPoints;
    const dateDiff = right.history.date.getTime() - left.history.date.getTime();
    if (dateDiff !== 0) return dateDiff;
    return left.history.transactionId.localeCompare(right.history.transactionId);
  });
  const strongest = sorted[0]!;
  const frequencyBoost = Math.min(800, Math.max(0, sorted.length - 1) * 100);
  const scoreBasisPoints = Math.min(10000, strongest.scoreBasisPoints + frequencyBoost);
  const matcher = chooseMatcher(sorted);
  const selected = sorted.slice(0, 5);
  const evidence: HistorySuggestionEvidence = {
    algorithmVersion,
    reason: reasonFor(matcher, sorted),
    targetTransactionId: target.transactionId,
    matchedHistoricalTransactionIds: selected.map((item) => item.history.transactionId),
    matchedBookingIds: selected.map((item) => item.history.bookingId),
    historicalEvidenceHashes: selected.map((item) => item.history.bookingEvidenceHash),
    features: {
      exactIbanMatches: sorted.filter((item) => item.exactIban).length,
      exactCounterpartyMatches: sorted.filter((item) => item.exactCounterparty).length,
      exactDescriptionMatches: sorted.filter((item) => item.exactDescription).length,
      exactPurposeMatches: sorted.filter((item) => item.exactPurpose).length,
      exactAmountMatches: sorted.filter((item) => item.exactAmount).length,
      sameAccountMatches: sorted.filter((item) => item.sameAccount).length,
      recurringMonthMatches: sorted.filter((item) => item.recurringMonth).length,
      maximumTokenSimilarityBasisPoints: Math.max(...sorted.map((item) => item.tokenSimilarityBasisPoints)),
      compatibleHistoryCount: sorted.length,
      merchantAnchorMatches: sorted.filter((item) => item.merchantAnchorContributionBasisPoints > 0).length,
      maximumMerchantAnchorContributionBasisPoints: Math.max(
        0,
        ...sorted.map((item) => item.merchantAnchorContributionBasisPoints),
      ),
    },
    merchantAnchor: {
      state: merchantAnchor.state,
      anchorVersion: merchantAnchor.anchorVersion,
      resolutionVersion: merchantAnchor.resolutionVersion,
      evidenceHash: merchantAnchor.evidenceHash,
      evaluationHash: merchantAnchor.evaluationHash,
      supportingEvidenceCount: merchantAnchor.supportingEvidence.length,
      conflictingEvidenceCount: merchantAnchor.conflictingEvidence.length,
    },
    safeguards: {
      completeTriple: true,
      directionCompatible: true,
      createsTransactionBooking: false,
      requiresAdministratorApproval: true,
    },
  };
  const hashPayload = {
    algorithmVersion,
    targetTransactionId: target.transactionId,
    rank,
    projectId: group.projectId,
    transactionTypeId: group.transactionTypeId,
    categoryId: group.categoryId,
    matcher,
    scoreBasisPoints,
    evidence,
  };

  return {
    rank,
    projectId: group.projectId,
    transactionTypeId: group.transactionTypeId,
    categoryId: group.categoryId,
    matcher,
    confidence: chooseConfidence(matcher, scoreBasisPoints),
    scoreBasisPoints,
    evidence,
    evidenceHash: evidenceHash(hashPayload),
  };
};

export type HistoryScoreComponents = {
  exactIbanBasisPoints: number;
  exactCounterpartyBasisPoints: number;
  exactDescriptionBasisPoints: number;
  exactPurposeBasisPoints: number;
  tokenSimilarityBasisPoints: number;
  tokenSimilarityContributionBasisPoints: number;
  sameAccountBasisPoints: number;
  exactAmountBasisPoints: number;
  recurringMonthBasisPoints: number;
  recencyBasisPoints: number;
  merchantAnchorBasisPoints: number;
  historyScoreBasisPoints: number;
  exactIbanMatched: boolean;
};

export const evaluateHistoryScoreComponents = (
  target: HistorySuggestionFacts,
  history: ApprovedHistoryBooking,
  options: {
    workspaceId?: string;
    merchantAnchor?: MerchantRetrievalAnchor | null;
    merchantAnchorEnabled?: boolean;
  } = {},
): HistoryScoreComponents => {
  const merchantAnchor = evaluateMerchantRetrievalAnchor({
    workspaceId: options.workspaceId ?? '',
    transactionId: target.transactionId,
    anchor: options.merchantAnchor,
    enabled: options.merchantAnchorEnabled,
  });
  const scored = scoreHistory(target, history, merchantAnchor);
  return {
    exactIbanBasisPoints: scored.exactIban ? HISTORY_SUGGESTION_COMPONENT_WEIGHTS.exactIban : 0,
    exactCounterpartyBasisPoints: scored.exactCounterparty ? HISTORY_SUGGESTION_COMPONENT_WEIGHTS.exactCounterparty : 0,
    exactDescriptionBasisPoints: scored.exactDescription ? HISTORY_SUGGESTION_COMPONENT_WEIGHTS.exactDescription : 0,
    exactPurposeBasisPoints: scored.exactPurpose ? HISTORY_SUGGESTION_COMPONENT_WEIGHTS.exactPurpose : 0,
    tokenSimilarityBasisPoints: scored.tokenSimilarityBasisPoints,
    tokenSimilarityContributionBasisPoints: Math.round(
      (scored.tokenSimilarityBasisPoints * HISTORY_SUGGESTION_COMPONENT_WEIGHTS.tokenSimilarityMaximum) / 10000,
    ),
    sameAccountBasisPoints: scored.sameAccount ? HISTORY_SUGGESTION_COMPONENT_WEIGHTS.sameAccount : 0,
    exactAmountBasisPoints: scored.exactAmount ? HISTORY_SUGGESTION_COMPONENT_WEIGHTS.exactAmount : 0,
    recurringMonthBasisPoints: scored.recurringMonth ? HISTORY_SUGGESTION_COMPONENT_WEIGHTS.recurringMonth : 0,
    recencyBasisPoints: scored.recencyContributionBasisPoints,
    merchantAnchorBasisPoints: scored.merchantAnchorContributionBasisPoints,
    historyScoreBasisPoints: scored.scoreBasisPoints,
    exactIbanMatched: scored.exactIban,
  };
};

export const rankHistorySuggestions = (
  target: HistorySuggestionFacts,
  approvedHistory: ApprovedHistoryBooking[],
  options: {
    algorithmVersion?: string;
    limit?: number;
    workspaceId?: string;
    merchantAnchor?: MerchantRetrievalAnchor | null;
    merchantAnchorEnabled?: boolean;
  } = {},
): RankedHistorySuggestion[] => {
  const algorithmVersion = options.algorithmVersion ?? HISTORY_SUGGESTION_ALGORITHM_VERSION;
  const limit = Math.max(1, Math.min(3, options.limit ?? 3));
  const merchantAnchor = evaluateMerchantRetrievalAnchor({
    workspaceId: options.workspaceId ?? '',
    transactionId: target.transactionId,
    anchor: options.merchantAnchor,
    enabled: options.merchantAnchorEnabled,
  });
  const compatible = approvedHistory
    .filter((history) =>
      compareHistoricalFactualDirections(history.direction, target.direction).compatible
      && history.transactionId !== target.transactionId
      && history.date.getTime() <= target.date.getTime(),
    )
    .map((history) => scoreHistory(target, history, merchantAnchor));

  const groups = new Map<string, CandidateGroup>();
  for (const scored of compatible) {
    const key = tripleKey(scored.history);
    const group = groups.get(key) ?? {
      projectId: scored.history.projectId,
      transactionTypeId: scored.history.transactionTypeId,
      categoryId: scored.history.categoryId,
      scored: [],
    };
    group.scored.push(scored);
    groups.set(key, group);
  }

  return Array.from(groups.values())
    .map((group) => buildCandidate(target, group, 0, algorithmVersion, merchantAnchor))
    .sort((left, right) => {
      if (left.scoreBasisPoints !== right.scoreBasisPoints) return right.scoreBasisPoints - left.scoreBasisPoints;
      const leftKey = `${left.projectId}|${left.transactionTypeId}|${left.categoryId}`;
      const rightKey = `${right.projectId}|${right.transactionTypeId}|${right.categoryId}`;
      return leftKey.localeCompare(rightKey);
    })
    .slice(0, limit)
    .map((candidate, index) => {
      const rank = index + 1;
      const evidence = { ...candidate.evidence };
      return {
        ...candidate,
        rank,
        evidenceHash: evidenceHash({
          algorithmVersion,
          targetTransactionId: target.transactionId,
          rank,
          projectId: candidate.projectId,
          transactionTypeId: candidate.transactionTypeId,
          categoryId: candidate.categoryId,
          matcher: candidate.matcher,
          scoreBasisPoints: candidate.scoreBasisPoints,
          evidence,
        }),
      };
    });
};
