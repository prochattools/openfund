import { deriveMainCategoryId, splitCategoryLabel } from './category-labels';

export type RuleConditionField = 'payee' | 'counterparty' | 'description' | 'amount' | 'source' | 'reference';
export type RuleConditionMatchType = 'contains' | 'startsWith' | 'endsWith' | 'equals' | 'regex';
export type RuleCondition = {
  field: RuleConditionField;
  matchType: RuleConditionMatchType;
  value: string;
};

export type RuleSummary = {
  id: string;
  label: string;
  pattern: string;
  matchType: string;
  matchField: string;
  categoryId: string;
  categoryName?: string | null;
  mainCategoryId?: string | null;
  mainCategoryName?: string | null;
  conditions?: RuleCondition[] | null;
  priority: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type RuleInput = {
  label: string;
  pattern?: string;
  mainCategoryId?: string;
  categoryId: string;
  matchType?: string;
  matchField?: string;
  conditions?: RuleCondition[];
  priority?: number;
  isActive?: boolean;
};

export const normalizeRuleResponse = (rule: any): RuleSummary => {
  const safeConditions = Array.isArray(rule.conditions) ? (rule.conditions as RuleCondition[]) : null;
  const categoryLabel = rule.category?.name ?? null;
  const category = splitCategoryLabel(categoryLabel);

  return {
    id: rule.id,
    label: rule.label,
    pattern: rule.pattern,
    matchType: rule.matchType,
    matchField: rule.matchField,
    categoryId: rule.categoryId,
    categoryName: categoryLabel,
    mainCategoryId: deriveMainCategoryId(category.main),
    mainCategoryName: category.main,
    conditions: safeConditions,
    priority: rule.priority,
    isActive: rule.isActive,
    createdAt: rule.createdAt,
    updatedAt: rule.updatedAt,
  };
};

export const sortRules = (a: RuleSummary, b: RuleSummary) => {
  if (a.priority !== b.priority) {
    return b.priority - a.priority;
  }
  return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
};
