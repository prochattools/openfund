export type OfflineCategory = {
  id: string;
  name: string;
  parentId: string | null;
};

export type OfflineLedgerTransaction = {
  source: string;
  amount: number;
  normalizedKey: string;
  categoryId: string | null;
  categoryName: string | null;
  mainCategoryId: string | null;
  mainCategoryName: string | null;
};

export type CategorySuggestion = {
  categoryId: string | null;
  categoryName: string | null;
  mainCategoryId: string | null;
  mainCategoryName: string | null;
};

type SuggestionRecord = {
  suggestion: CategorySuggestion;
  count: number;
  lastSeen: number;
};

type SuggestionHistory = Map<string, Map<string, SuggestionRecord>>;

export const sanitizeKey = (value?: string | null): string | null => {
  if (!value) return null;
  const trimmed = value.trim().toLowerCase();
  return trimmed.length ? trimmed : null;
};

export const makeDirectHistoryKey = (source: string | null | undefined, amount: number): string | null => {
  if (!source && source !== '') return null;
  const normalizedSource = sanitizeKey(source ?? '');
  if (!normalizedSource) return null;
  return `${normalizedSource}|${amount}`;
};

export const suggestionIdentifier = (suggestion: CategorySuggestion): string =>
  `${suggestion.mainCategoryId ?? 'null'}::${suggestion.categoryId ?? 'null'}`;

export const ensureSuggestionNames = (
  suggestion: CategorySuggestion,
  categoryIndex: Map<string, OfflineCategory>,
): CategorySuggestion => {
  let { categoryId, categoryName, mainCategoryId, mainCategoryName } = suggestion;

  if (categoryId) {
    const category = categoryIndex.get(categoryId);
    categoryName = categoryName ?? category?.name ?? null;
    if (!mainCategoryId && category?.parentId) {
      mainCategoryId = category.parentId;
    }
  }

  if (mainCategoryId) {
    const mainCategory = categoryIndex.get(mainCategoryId);
    mainCategoryName = mainCategoryName ?? mainCategory?.name ?? null;
  }

  if (!categoryId && !mainCategoryId) {
    return {
      categoryId: null,
      categoryName: null,
      mainCategoryId: null,
      mainCategoryName: null,
    };
  }

  return {
    categoryId,
    categoryName: categoryName ?? null,
    mainCategoryId,
    mainCategoryName: mainCategoryName ?? null,
  };
};

const registerSuggestion = (
  history: SuggestionHistory,
  key: string | null,
  suggestion: CategorySuggestion,
  order: number,
) => {
  if (!key) return;
  const bucket = history.get(key) ?? new Map<string, SuggestionRecord>();
  const recordKey = suggestionIdentifier(suggestion);
  const record = bucket.get(recordKey);
  if (record) {
    record.count += 1;
    record.lastSeen = order;
  } else {
    bucket.set(recordKey, {
      suggestion,
      count: 1,
      lastSeen: order,
    });
  }
  history.set(key, bucket);
};

const pickBestSuggestion = (history: SuggestionHistory, key: string | null): CategorySuggestion | null => {
  if (!key) return null;
  const bucket = history.get(key);
  if (!bucket) return null;

  let best: SuggestionRecord | null = null;
  bucket.forEach((record) => {
    if (!best) {
      best = record;
      return;
    }
    if (record.count > best.count) {
      best = record;
      return;
    }
    if (record.count === best.count && record.lastSeen > best.lastSeen) {
      best = record;
    }
  });

  if (!best) return null;
  const { suggestion } = best;
  return {
    categoryId: suggestion.categoryId,
    categoryName: suggestion.categoryName,
    mainCategoryId: suggestion.mainCategoryId,
    mainCategoryName: suggestion.mainCategoryName,
  };
};

const buildSuggestionFromTransaction = (
  tx: OfflineLedgerTransaction,
  categoryIndex: Map<string, OfflineCategory>,
): CategorySuggestion | null => {
  const suggestion = ensureSuggestionNames(
    {
      categoryId: tx.categoryId,
      categoryName: tx.categoryName,
      mainCategoryId: tx.mainCategoryId,
      mainCategoryName: tx.mainCategoryName,
    },
    categoryIndex,
  );

  if (!suggestion.categoryId && !suggestion.mainCategoryId) {
    return null;
  }

  return suggestion;
};

export const categorizeTransactions = <TTransaction extends OfflineLedgerTransaction>(
  incoming: TTransaction[],
  history: TTransaction[],
  categoryIndex: Map<string, OfflineCategory>,
  reviewCategory: CategorySuggestion,
): { transactions: TTransaction[]; autoCategorized: number } => {
  let autoCategorized = 0;
  let sequence = 0;

  const nextOrder = () => {
    sequence += 1;
    return sequence;
  };

  const sourceHistory: SuggestionHistory = new Map();
  const descriptionHistory: SuggestionHistory = new Map();
  const directHistory: SuggestionHistory = new Map();
  const overallHistory: SuggestionHistory = new Map();

  const recordTransaction = (tx: TTransaction) => {
    const suggestion = buildSuggestionFromTransaction(tx, categoryIndex);
    if (!suggestion) {
      return;
    }

    const normalizedSuggestion = ensureSuggestionNames(suggestion, categoryIndex);

    if (normalizedSuggestion.mainCategoryId === reviewCategory.mainCategoryId) {
      return;
    }

    const order = nextOrder();

    registerSuggestion(
      directHistory,
      makeDirectHistoryKey(tx.source, tx.amount),
      normalizedSuggestion,
      order,
    );
    registerSuggestion(sourceHistory, sanitizeKey(tx.source), normalizedSuggestion, order);
    registerSuggestion(descriptionHistory, sanitizeKey(tx.normalizedKey), normalizedSuggestion, order);
    registerSuggestion(overallHistory, '__overall__', normalizedSuggestion, order);
  };

  history.forEach(recordTransaction);

  const results = incoming.map((tx) => {
    const directKey = makeDirectHistoryKey(tx.source, tx.amount);
    const directSuggestion = pickBestSuggestion(directHistory, directKey);

    if (directSuggestion) {
      const normalized = ensureSuggestionNames(directSuggestion, categoryIndex);
      const enriched = {
        ...tx,
        categoryId: normalized.categoryId,
        categoryName: normalized.categoryName,
        mainCategoryId: normalized.mainCategoryId,
        mainCategoryName: normalized.mainCategoryName,
        autoCategorized: true,
        needsManualCategory: false,
      };
      autoCategorized += 1;
      recordTransaction(enriched);
      return enriched;
    }

    const fallbackSuggestion =
      pickBestSuggestion(sourceHistory, sanitizeKey(tx.source)) ??
      pickBestSuggestion(descriptionHistory, sanitizeKey(tx.normalizedKey)) ??
      pickBestSuggestion(overallHistory, '__overall__');

    if (fallbackSuggestion) {
      const normalized = ensureSuggestionNames(fallbackSuggestion, categoryIndex);
      return {
        ...tx,
        categoryId: normalized.categoryId,
        categoryName: normalized.categoryName,
        mainCategoryId: normalized.mainCategoryId,
        mainCategoryName: normalized.mainCategoryName,
        autoCategorized: false,
        needsManualCategory: true,
      };
    }

    return {
      ...tx,
      categoryId: reviewCategory.categoryId,
      categoryName: reviewCategory.categoryName,
      mainCategoryId: reviewCategory.mainCategoryId,
      mainCategoryName: reviewCategory.mainCategoryName,
      autoCategorized: false,
      needsManualCategory: true,
    };
  });

  return { transactions: results, autoCategorized };
};
