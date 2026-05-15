export type CategoryLike = {
  id: string;
  name: string;
  parentId: string | null;
  color?: string | null;
};

export type CategoryTree<TCategory extends CategoryLike = CategoryLike> = {
  main: TCategory[];
  byParent: Record<string, TCategory[]>;
};

export const ensureCategoryIndex = <TCategory extends CategoryLike>(
  categories: TCategory[],
): { map: Map<string, TCategory>; tree: CategoryTree<TCategory> } => {
  const map = new Map<string, TCategory>();
  const byParent: Record<string, TCategory[]> = {};

  categories.forEach((category) => {
    map.set(category.id, category);
    if (category.parentId) {
      if (!byParent[category.parentId]) {
        byParent[category.parentId] = [];
      }
      byParent[category.parentId]!.push(category);
    }
  });

  const main = categories.filter((category) => !category.parentId).sort((a, b) => a.name.localeCompare(b.name));
  Object.values(byParent).forEach((list) => list.sort((a, b) => a.name.localeCompare(b.name)));

  return {
    map,
    tree: {
      main,
      byParent,
    },
  };
};
