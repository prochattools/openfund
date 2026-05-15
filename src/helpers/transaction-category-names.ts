import { distinctFrom, firstNonEmpty, splitCategoryLabel } from './category-labels';

export type TransactionCategoryNameInput = {
  mainCategoryName?: string | null;
  categoryName?: string | null;
  suggestedMainCategoryName?: string | null;
  suggestedSubCategoryName?: string | null;
  rawMainCategoryName?: string | null;
  rawCategoryName?: string | null;
};

export type TransactionCategoryNames = {
  mainName: string | null;
  subName: string | null;
  suggestedMainName: string | null;
  suggestedSubName: string | null;
  rawMainName: string | null;
  rawSubName: string | null;
};

export const deriveCategoryNames = (tx: TransactionCategoryNameInput): TransactionCategoryNames => {
  const fromCategory = splitCategoryLabel(tx.categoryName ?? null);
  const fromSuggestedSub = splitCategoryLabel(tx.suggestedSubCategoryName ?? null);
  const fromSuggestedMain = splitCategoryLabel(tx.suggestedMainCategoryName ?? null);
  const fromRawSub = splitCategoryLabel(tx.rawCategoryName ?? null);
  const fromRawMain = splitCategoryLabel(tx.rawMainCategoryName ?? null);

  const mainCandidates = [
    tx.mainCategoryName,
    fromSuggestedMain.main,
    fromRawMain.main,
    fromCategory.main,
    fromSuggestedSub.main,
    fromRawSub.main,
  ];

  const mainName = firstNonEmpty(mainCandidates);

  const subCandidatesPrimary = [
    distinctFrom(fromCategory.sub, mainName),
    distinctFrom(fromSuggestedSub.sub, mainName),
    distinctFrom(fromRawSub.sub, mainName),
  ];

  const subName =
    firstNonEmpty(subCandidatesPrimary) ??
    firstNonEmpty([fromCategory.sub, fromSuggestedSub.sub, fromRawSub.sub]) ??
    mainName ??
    null;

  const suggestedMainName = firstNonEmpty([
    fromSuggestedMain.main,
    fromRawMain.main,
    mainName,
  ]);

  const suggestedSubName =
    firstNonEmpty([
      distinctFrom(fromSuggestedSub.sub, mainName),
      distinctFrom(fromRawSub.sub, mainName),
      subName,
    ]) ?? subName ?? null;

  const rawMainName = fromRawMain.main;
  const rawSubName = distinctFrom(fromRawSub.sub, rawMainName) ?? fromRawSub.sub ?? rawMainName;

  return {
    mainName: mainName ?? null,
    subName: subName ?? null,
    suggestedMainName: suggestedMainName ?? null,
    suggestedSubName: suggestedSubName ?? null,
    rawMainName: rawMainName ?? null,
    rawSubName: rawSubName ?? null,
  };
};
