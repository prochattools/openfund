import { deriveMainCategoryId, firstNonEmpty } from './category-labels';
import { deriveCategoryNames, type TransactionCategoryNameInput } from './transaction-category-names';

export type ServerCategory = {
  id: string;
  name: string;
  parentId: string | null;
  color?: string | null;
};

export type ServerCategoryTransaction = TransactionCategoryNameInput & {
  categoryId?: string | null;
};

export const DEFAULT_CATEGORY_COLOR_PALETTE = [
  '#4C6EF5',
  '#15AABF',
  '#40C057',
  '#FCC419',
  '#FF6B6B',
  '#7950F2',
  '#F06595',
  '#20C997',
];

export const mergeCategoriesWithServer = <TCategory extends ServerCategory>(
  current: TCategory[],
  apiTransactions: ServerCategoryTransaction[],
  colorPalette: string[] = DEFAULT_CATEGORY_COLOR_PALETTE,
): TCategory[] => {
  if (!apiTransactions.length) return current;

  const next = current.map((category) => ({ ...category })) as TCategory[];
  const byId = new Map(next.map((category) => [category.id, category] as const));

  const ensureCategory = (id: string | null, name: string | null, parentId: string | null) => {
    if (!id || !name) return;
    const existing = byId.get(id);
    if (existing) {
      const updated = {
        ...existing,
        name: existing.name || name,
        parentId: parentId ?? existing.parentId ?? null,
      } as TCategory;
      const index = next.findIndex((category) => category.id === id);
      if (index >= 0) {
        next[index] = updated;
      }
      byId.set(id, updated);
      return;
    }

    const color = colorPalette[next.length % colorPalette.length];
    const created = {
      id,
      name,
      parentId,
      color,
    } as TCategory;
    next.push(created);
    byId.set(id, created);
  };

  apiTransactions.forEach((tx) => {
    const {
      mainName,
      subName,
      suggestedMainName,
      suggestedSubName,
      rawMainName,
      rawSubName,
    } = deriveCategoryNames(tx);

    const mainLabel = firstNonEmpty([mainName, suggestedMainName, rawMainName]);
    const subLabel = firstNonEmpty([subName, suggestedSubName, rawSubName]);
    const mainId = deriveMainCategoryId(mainLabel);

    if (mainId && mainLabel) {
      ensureCategory(mainId, mainLabel, null);
    }

    if (tx.categoryId && subLabel) {
      ensureCategory(tx.categoryId, subLabel, mainId ?? null);
    }
  });

  return next;
};
