import type { LedgerTransaction } from './api-transaction-mapper';
import type { EvidenceRichReviewItem, ReviewEvidenceStatus } from '@/libs/api';

export type ReviewCategory = {
  id: string;
  name: string;
  parentId: string | null;
};

const reviewEuroFormatter = new Intl.NumberFormat('nl-NL', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 2,
});

export const formatReviewEuro = (value: number): string => reviewEuroFormatter.format(value);

export const getReviewSuggestedLabel = (transaction: LedgerTransaction): string =>
  transaction.suggestedSubCategoryName
  ?? transaction.categoryName
  ?? transaction.suggestedMainCategoryName
  ?? transaction.mainCategoryName
  ?? 'Geen suggestie';

export const canAcceptReviewSuggestion = (canReview: boolean, mainId: string, subId: string): boolean =>
  Boolean(canReview && (subId || mainId));

export const parseReviewDate = (value: string): Date => {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date(0) : parsed;
};

export const getSuggestedMain = (transaction: LedgerTransaction): string =>
  transaction.mainCategoryId ?? transaction.suggestedMainCategoryName ?? transaction.rawMainCategoryName ?? '';

export const getSuggestedSub = (transaction: LedgerTransaction): string =>
  transaction.categoryId ?? transaction.suggestedSubCategoryName ?? transaction.rawCategoryName ?? '';

export const normalizeLabel = (value: string | null | undefined): string =>
  (value ?? '').trim().toLowerCase();

export const findCategoryIdByName = (
  categories: ReviewCategory[],
  name: string | null | undefined,
): string => {
  const normalized = normalizeLabel(name);
  if (!normalized) return '';
  return categories.find((category) => normalizeLabel(category.name) === normalized)?.id ?? '';
};

export const isReviewPlaceholderCategory = (category: ReviewCategory): boolean => {
  const normalized = normalizeLabel(category.name);
  return category.id === 'cat-review'
    || category.id === 'sub-review-needs-category'
    || normalized === 'beoordeling nodig'
    || normalized === 'handmatige categorisatie nodig'
    || normalized === 'review'
    || normalized === 'needs review'
    || normalized === 'needs manual categorization';
};

export const translateSuggestionConfidence = (
  confidence: LedgerTransaction['suggestionConfidence'],
): string => {
  switch (confidence) {
    case 'exact':
      return 'volledige historische match';
    case 'rule':
      return 'categorisatieregel';
    case 'description':
      return 'omschrijving herkend';
    case 'account':
      return 'rekening herkend';
    case 'overall':
      return 'beste historische suggestie';
    case 'fuzzy':
      return 'waarschijnlijke suggestie';
    case 'review':
      return 'handmatige controle nodig';
    default:
      return 'geen volledige historische match';
  }
};

export const translateReviewEvidenceStatus = (status: ReviewEvidenceStatus): string => {
  switch (status) {
    case 'finalized':
      return 'veilige deterministische kandidaat';
    case 'conflict':
      return 'conflict, handmatig beoordelen';
    case 'review_suggested':
      return 'suggestie, handmatig beoordelen';
    case 'unmatched':
    default:
      return 'geen match, handmatig classificeren';
  }
};

export const getReviewEvidenceSummary = (item: Pick<EvidenceRichReviewItem, 'deterministicStatus' | 'alternatives' | 'evidence'>): string => {
  const parts = [translateReviewEvidenceStatus(item.deterministicStatus)];
  if (item.evidence.matchedRuleIds.length) {
    parts.push(`${item.evidence.matchedRuleIds.length} regel${item.evidence.matchedRuleIds.length === 1 ? '' : 's'}`);
  }
  if (item.evidence.historicalRecordIds.length || item.evidence.evidenceHashes.length) {
    parts.push('historisch bewijs');
  }
  if (item.alternatives.length) {
    parts.push(item.alternatives.length === 1 ? '1 alternatief' : `${item.alternatives.length} alternatieven`);
  }
  return parts.join(' · ');
};

export const resolveDefaultReviewSelection = (
  transaction: LedgerTransaction,
  mainCategories: ReviewCategory[],
  subcategories: Record<string, ReviewCategory[]>,
): { mainId: string; subId: string } => {
  const suggestedMain = getSuggestedMain(transaction);
  const mainId = transaction.mainCategoryId
    ?? (typeof suggestedMain === 'string' && suggestedMain.startsWith('main:')
      ? suggestedMain
      : findCategoryIdByName(mainCategories, suggestedMain));
  const initialSubs = mainId ? subcategories[mainId] ?? [] : [];
  const suggestedSub = getSuggestedSub(transaction);
  const subId = transaction.categoryId
    ?? (typeof suggestedSub === 'string' && suggestedSub.includes(' — ')
      ? ''
      : findCategoryIdByName(initialSubs, suggestedSub));

  return {
    mainId: mainId ?? '',
    subId: subId ?? '',
  };
};

export const buildReviewSubcategoryMap = (
  mainCategories: ReviewCategory[],
  byParent: Record<string, ReviewCategory[]>,
): Record<string, ReviewCategory[]> => {
  const result: Record<string, ReviewCategory[]> = {};
  mainCategories.forEach((main) => {
    result[main.id] = (byParent[main.id] ?? []).filter((category) => !isReviewPlaceholderCategory(category));
  });
  return result;
};
