import { describe, expect, it } from 'vitest';
import {
  buildReviewSubcategoryMap,
  canActivateRuleCreation,
  canAcceptReviewSuggestion,
  findCategoryIdByName,
  formatReviewEuro,
  getRuleCreationStatusLabel,
  getReviewSuggestedLabel,
  getReviewEvidenceSummary,
  getSuggestedMain,
  getSuggestedSub,
  isReviewPlaceholderCategory,
  normalizeLabel,
  parseReviewDate,
  resolveDefaultReviewSelection,
  translateReviewEvidenceStatus,
  translateSuggestionConfidence,
} from '../../src/helpers/review-page';
import type { LedgerTransaction } from '../../src/helpers/api-transaction-mapper';

const makeTx = (overrides: Partial<LedgerTransaction>): LedgerTransaction => ({
  id: 'tx-default',
  date: '2026-05-15T00:00:00.000Z',
  description: 'Test',
  amount: 0,
  direction: 'credit',
  source: 'Test',
  accountLabel: null,
  accountIdentifier: null,
  normalizedKey: 'test',
  notificationDetail: null,
  counterpartyAccount: null,
  categoryId: null,
  categoryName: null,
  mainCategoryId: null,
  mainCategoryName: null,
  ledgerMonth: 5,
  ledgerYear: 2026,
  createdAt: '2026-05-15T00:00:00.000Z',
  autoCategorized: false,
  needsManualCategory: true,
  ...overrides,
});

describe('review page helpers', () => {
  it('parses dates safely for review rendering', () => {
    expect(parseReviewDate('2026-05-15T00:00:00.000Z').toISOString()).toBe('2026-05-15T00:00:00.000Z');
    expect(parseReviewDate('geen datum').toISOString()).toBe('1970-01-01T00:00:00.000Z');
  });

  it('normalizes labels and finds categories by name case-insensitively', () => {
    const categories = [{ id: 'cat-gifts', name: ' Giften ', parentId: 'main-income' }];

    expect(normalizeLabel('  GIFTEN  ')).toBe('giften');
    expect(findCategoryIdByName(categories, 'giften')).toBe('cat-gifts');
    expect(findCategoryIdByName(categories, 'onbekend')).toBe('');
  });

  it('detects review placeholder categories', () => {
    expect(isReviewPlaceholderCategory({ id: 'cat-review', name: 'Iets', parentId: null })).toBe(true);
    expect(isReviewPlaceholderCategory({ id: 'x', name: 'Beoordeling nodig', parentId: null })).toBe(true);
    expect(isReviewPlaceholderCategory({ id: 'x', name: 'Needs manual categorization', parentId: null })).toBe(true);
    expect(isReviewPlaceholderCategory({ id: 'cat-gifts', name: 'Giften', parentId: null })).toBe(false);
  });

  it('resolves suggested main and sub values in fallback order', () => {
    expect(getSuggestedMain(makeTx({ mainCategoryId: 'main-income', suggestedMainCategoryName: 'Inkomsten' }))).toBe('main-income');
    expect(getSuggestedMain(makeTx({ suggestedMainCategoryName: 'Inkomsten', rawMainCategoryName: 'Raw' }))).toBe('Inkomsten');
    expect(getSuggestedSub(makeTx({ categoryId: 'cat-gifts', suggestedSubCategoryName: 'Giften' }))).toBe('cat-gifts');
    expect(getSuggestedSub(makeTx({ suggestedSubCategoryName: 'Giften', rawCategoryName: 'Raw' }))).toBe('Giften');
  });

  it('translates suggestion confidence values to Dutch labels', () => {
    expect(translateSuggestionConfidence('exact')).toBe('volledige historische match');
    expect(translateSuggestionConfidence('rule')).toBe('categorisatieregel');
    expect(translateSuggestionConfidence('description')).toBe('omschrijving herkend');
    expect(translateSuggestionConfidence('account')).toBe('rekening herkend');
    expect(translateSuggestionConfidence('overall')).toBe('beste historische suggestie');
    expect(translateSuggestionConfidence('fuzzy')).toBe('waarschijnlijke suggestie');
    expect(translateSuggestionConfidence('review')).toBe('handmatige controle nodig');
    expect(translateSuggestionConfidence(null)).toBe('geen volledige historische match');
  });

  it('translates evidence-rich review status and summary labels', () => {
    expect(translateReviewEvidenceStatus('finalized')).toBe('veilige deterministische kandidaat');
    expect(translateReviewEvidenceStatus('conflict')).toBe('conflict, handmatig beoordelen');
    expect(translateReviewEvidenceStatus('review_suggested')).toBe('suggestie, handmatig beoordelen');
    expect(translateReviewEvidenceStatus('unmatched')).toBe('geen match, handmatig classificeren');

    expect(getReviewEvidenceSummary({
      deterministicStatus: 'conflict',
      alternatives: [{ suggestionId: 'suggestion-1' }, { suggestionId: 'suggestion-2' }] as any,
      evidence: {
        matchedRuleIds: ['rule-1'],
        historicalRecordIds: ['history-1'],
        evidenceHashes: [],
      },
    })).toBe('conflict, handmatig beoordelen · 1 regel · historisch bewijs · 2 alternatieven');
  });

  it('labels rule creation preview activation states', () => {
    expect(canActivateRuleCreation(null)).toBe(false);
    expect(getRuleCreationStatusLabel(null)).toBe('Maak eerst een regelvoorbeeld');
    expect(canActivateRuleCreation({
      activationAllowed: false,
      previewHash: 'hash-1',
      expected: {
        projectId: 'project-1',
        projectLabel: 'Yeshua Academy',
        transactionTypeId: 'type-1',
        transactionTypeLabel: 'Schenking in',
        categoryId: 'cat-1',
        categoryLabel: 'Giften',
      },
    })).toBe(false);
    expect(getRuleCreationStatusLabel({
      activationAllowed: false,
      rejectionReasons: ['De regelvoorwaarde is te breed om veilig te activeren.'],
      matchedTransactionIds: [],
    })).toBe('De regelvoorwaarde is te breed om veilig te activeren.');
    expect(canActivateRuleCreation({
      activationAllowed: true,
      previewHash: 'hash-1',
      expected: {
        projectId: 'project-1',
        projectLabel: 'Yeshua Academy',
        transactionTypeId: 'type-1',
        transactionTypeLabel: 'Schenking in',
        categoryId: 'cat-1',
        categoryLabel: 'Giften',
      },
    })).toBe(true);
    expect(getRuleCreationStatusLabel({
      activationAllowed: true,
      rejectionReasons: [],
      matchedTransactionIds: ['tx-1', 'tx-2'],
    })).toBe('Regel kan worden geactiveerd voor 2 voorbeeldmatches');
  });

  it('formats review display values and accept-action availability', () => {
    expect(formatReviewEuro(1234.56)).toBe('€ 1.234,56');
    expect(getReviewSuggestedLabel(makeTx({ suggestedSubCategoryName: 'Giften', categoryName: 'Fallback' }))).toBe('Giften');
    expect(getReviewSuggestedLabel(makeTx({ categoryName: 'Bankkosten' }))).toBe('Bankkosten');
    expect(getReviewSuggestedLabel(makeTx({ suggestedMainCategoryName: 'Inkomsten' }))).toBe('Inkomsten');
    expect(getReviewSuggestedLabel(makeTx({ mainCategoryName: 'Uitgaven' }))).toBe('Uitgaven');
    expect(getReviewSuggestedLabel(makeTx({}))).toBe('Geen suggestie');
    expect(canAcceptReviewSuggestion(true, 'main-income', '')).toBe(true);
    expect(canAcceptReviewSuggestion(true, '', 'cat-gifts')).toBe(true);
    expect(canAcceptReviewSuggestion(false, 'main-income', 'cat-gifts')).toBe(false);
    expect(canAcceptReviewSuggestion(true, '', '')).toBe(false);
  });

  it('resolves default review selection from ids or category names', () => {
    const mainCategories = [{ id: 'main-income', name: 'Inkomsten', parentId: null }];
    const subcategories = {
      'main-income': [{ id: 'cat-gifts', name: 'Giften', parentId: 'main-income' }],
    };

    expect(resolveDefaultReviewSelection(makeTx({ mainCategoryId: 'main-income', categoryId: 'cat-gifts' }), mainCategories, subcategories)).toEqual({
      mainId: 'main-income',
      subId: 'cat-gifts',
    });
    expect(resolveDefaultReviewSelection(makeTx({ suggestedMainCategoryName: 'Inkomsten', suggestedSubCategoryName: 'Giften' }), mainCategories, subcategories)).toEqual({
      mainId: 'main-income',
      subId: 'cat-gifts',
    });
    expect(resolveDefaultReviewSelection(makeTx({ suggestedMainCategoryName: 'main:income', suggestedSubCategoryName: 'Inkomsten — Giften' }), mainCategories, subcategories)).toEqual({
      mainId: 'main:income',
      subId: '',
    });
  });

  it('builds subcategory maps without review placeholders', () => {
    expect(buildReviewSubcategoryMap(
      [{ id: 'main-income', name: 'Inkomsten', parentId: null }],
      {
        'main-income': [
          { id: 'cat-gifts', name: 'Giften', parentId: 'main-income' },
          { id: 'sub-review-needs-category', name: 'Review', parentId: 'main-income' },
        ],
      },
    )).toEqual({
      'main-income': [{ id: 'cat-gifts', name: 'Giften', parentId: 'main-income' }],
    });
  });
});
