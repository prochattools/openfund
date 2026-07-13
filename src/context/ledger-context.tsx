'use client';

import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  fetchLedger,
  fetchReview,
  uploadImportFile,
  fetchCategorizationRules,
  createCategorizationRule,
  updateCategorizationRule,
  deleteCategorizationRule,
  clearReviewQueue as clearReviewQueueRequest,
  updateCategory,
  isClientAdmin,
  type EvidenceRichReviewResponse,
  type ReviewProjectOption,
  type ReviewTransactionTypeOption,
} from '@/libs/api';
import { buildTransactionFromRow, createLedgerId as createId } from '@/helpers/client-row-transaction';
import { parseCsvFile } from '@/helpers/client-csv-parser';
import { mapApiTransaction, type ApiLedgerTransaction, type LedgerTransaction } from '@/helpers/api-transaction-mapper';
import { normalizeRuleResponse, sortRules, type RuleCondition, type RuleInput, type RuleSummary } from '@/helpers/rule-summaries';
import { ensureCategoryIndex, type CategoryTree } from '@/helpers/category-tree';
import { deriveCategoryNames } from '@/helpers/transaction-category-names';
import { mergeCategoriesWithServer } from '@/helpers/server-category-merge';
import { categorizeTransactions } from '@/helpers/offline-categorization';
import { buildLedgerSummary, filterReviewTransactions } from '@/helpers/ledger-summary';
import { mapLedgerMeta, mapUploadSummary, type ImportSummary, type LedgerMeta } from '@/helpers/ledger-response-mappers';
import { mergeLedgerWithReview } from '@/helpers/review-response-mapper';

type UUID = string;

type ApiLedgerSummary = {
  total: number;
  reviewCount: number;
  autoCategorized: number;
  totalAmount: number;
};

type ApiLedgerResponse = {
  transactions: ApiLedgerTransaction[];
  summary: ApiLedgerSummary;
  ledgers?: Array<{
    id: string;
    month: number;
    year: number;
    lockedAt: string | null;
    lockedBy: string | null;
    lockNote: string | null;
  }>;
};

export interface Category {
  id: UUID;
  name: string;
  parentId: UUID | null;
  color?: string | null;
}

interface LedgerState {
  transactions: LedgerTransaction[];
  categories: Category[];
  reviewProjects: ReviewProjectOption[];
  reviewTransactionTypes: ReviewTransactionTypeOption[];
}

interface LedgerContextValue {
  transactions: LedgerTransaction[];
  categories: Category[];
  categoryTree: CategoryTree;
  summary: {
    total: number;
    reviewCount: number;
    autoCategorized: number;
    totalAmount: number;
  };
  reviewTransactions: LedgerTransaction[];
  reviewProjects: ReviewProjectOption[];
  reviewTransactionTypes: ReviewTransactionTypeOption[];
  importCsv: (file: File) => Promise<ImportSummary>;
  refreshLedger: () => Promise<void>;
  assignCategory: (
    transactionId: UUID,
    options: {
      categoryId: UUID;
      projectId: UUID;
      transactionTypeId: UUID;
      mainCategoryId?: UUID | null;
      reason?: string | null;
    }
  ) => Promise<void>;
  clearReviewQueue: () => Promise<void>;
  clearAll: () => void;
  serverPipelineEnabled: boolean;
  rules: RuleSummary[];
  refreshRules: () => Promise<void>;
  createRule: (payload: RuleInput) => Promise<void>;
  updateRule: (id: string, payload: Partial<RuleInput>) => Promise<void>;
  deleteRule: (id: string) => Promise<void>;
  ledgerMeta: LedgerMeta[];
}

const LedgerContext = createContext<LedgerContextValue | undefined>(undefined);

const PIPELINE_MODE = process.env.NEXT_PUBLIC_IMPORT_PIPELINE_MODE ?? 'server';
const USE_SERVER_PIPELINE = PIPELINE_MODE !== 'client';

const REVIEW_MAIN_CATEGORY: Category = {
  id: 'cat-review',
  name: 'Review',
  parentId: null,
  color: '#FF922B',
};

const REVIEW_SUB_CATEGORY: Category = {
  id: 'sub-review-needs-category',
  name: 'Needs manual categorization',
  parentId: REVIEW_MAIN_CATEGORY.id,
  color: '#FFA94D',
};

const DEFAULT_STATE: LedgerState = {
  categories: [REVIEW_MAIN_CATEGORY, REVIEW_SUB_CATEGORY],
  transactions: [],
  reviewProjects: [],
  reviewTransactionTypes: [],
};

export const LedgerProvider = ({ children }: { children: ReactNode }) => {
  const [state, setState] = useState<LedgerState>(DEFAULT_STATE);
  const [rules, setRules] = useState<RuleSummary[]>([]);
  const [ledgerMeta, setLedgerMeta] = useState<LedgerMeta[]>([]);

  const refreshRules = useCallback(async () => {
    if (!USE_SERVER_PIPELINE) return;
    try {
      const response = await fetchCategorizationRules();
      if (!Array.isArray(response)) {
        return;
      }
      const normalized = response.map(normalizeRuleResponse).sort(sortRules);
      setRules(normalized);
    } catch (error) {
      console.error('Categorisatieregels konden niet worden geladen', error);
    }
  }, []);

  const refreshFromServer = useCallback(async () => {
    if (!USE_SERVER_PIPELINE) {
      return;
    }

    try {
      const reviewPromise: Promise<EvidenceRichReviewResponse | null> = isClientAdmin()
        ? fetchReview().catch((error: unknown): null => {
            console.error('Beoordelingssuggesties konden niet worden geladen', error);
            return null;
          })
        : Promise.resolve(null);
      const [payload, reviewPayload]: [ApiLedgerResponse, EvidenceRichReviewResponse | null] = await Promise.all([
        fetchLedger(),
        reviewPromise,
      ]);
      const mapped = payload.transactions.map(mapApiTransaction);
      const reviewMerge = mergeLedgerWithReview(mapped, reviewPayload);

      setState((current) => {
        const serverCategories = mergeCategoriesWithServer(current.categories, payload.transactions);
        const categoriesById = new Map(serverCategories.map((category) => [category.id, category]));
        for (const category of reviewMerge.categories) {
          categoriesById.set(category.id, category);
        }

        return {
          categories: Array.from(categoriesById.values()),
          transactions: reviewMerge.transactions,
          reviewProjects: reviewMerge.projects,
          reviewTransactionTypes: reviewMerge.transactionTypes,
        };
      });
      setLedgerMeta(mapLedgerMeta(payload.ledgers));
      await refreshRules();
    } catch (error) {
      console.error('Grootboek kon niet worden vernieuwd via de API', error);
    }
  }, [refreshRules]);

  const createRule = useCallback(async (payload: RuleInput) => {
    if (!USE_SERVER_PIPELINE) {
      throw new Error('Regelbeheer is niet beschikbaar in offline modus.');
    }
    const result = await createCategorizationRule(payload);
    const normalized = normalizeRuleResponse(result);
    setRules((current) => [normalized, ...current.filter((rule) => rule.id !== normalized.id)].sort(sortRules));
  }, []);

  const updateRule = useCallback(async (id: string, payload: Partial<RuleInput>) => {
    if (!USE_SERVER_PIPELINE) {
      throw new Error('Regelbeheer is niet beschikbaar in offline modus.');
    }
    const result = await updateCategorizationRule(id, payload);
    const normalized = normalizeRuleResponse(result);
    setRules((current) => [normalized, ...current.filter((rule) => rule.id !== id)].sort(sortRules));
  }, []);

  const deleteRule = useCallback(async (id: string) => {
    if (!USE_SERVER_PIPELINE) {
      throw new Error('Regelbeheer is niet beschikbaar in offline modus.');
    }
    await deleteCategorizationRule(id);
    setRules((current) => current.filter((rule) => rule.id !== id));
  }, []);

  useEffect(() => {
    if (USE_SERVER_PIPELINE) {
      refreshFromServer();
    }
  }, [refreshFromServer]);

  const { map: categoryIndex, tree: categoryTree } = useMemo(
    () => ensureCategoryIndex(state.categories),
    [state.categories],
  );

  const summary = useMemo(
    () => buildLedgerSummary(state.transactions),
    [state.transactions],
  );

  const reviewTransactions = useMemo(
    () => filterReviewTransactions(state.transactions),
    [state.transactions],
  );

  const importCsv = useCallback(
    async (file: File): Promise<ImportSummary> => {
      if (USE_SERVER_PIPELINE) {
        const formData = new FormData();
        formData.append('file', file);

        const summary = await uploadImportFile(formData);

        return mapUploadSummary(summary);
      }

      const rows = await parseCsvFile(file);
      const prepared = rows
        .map((row) => buildTransactionFromRow(row))
        .filter((tx): tx is NonNullable<ReturnType<typeof buildTransactionFromRow>> => Boolean(tx));

      if (!prepared.length) {
        return { importedCount: 0, autoCategorized: 0, reviewCount: 0 };
      }

      const existingKeys = new Set(
        state.transactions.map((tx) => `${tx.date}|${tx.amount}|${tx.normalizedKey}`),
      );

      const uniqueIncoming = prepared.filter((tx) => {
        const key = `${tx.date}|${tx.amount}|${tx.normalizedKey}`;
        if (existingKeys.has(key)) {
          return false;
        }
        existingKeys.add(key);
        return true;
      });

      if (!uniqueIncoming.length) {
        return { importedCount: 0, autoCategorized: 0, reviewCount: 0 };
      }

      const normalized = uniqueIncoming.map<LedgerTransaction>((tx) => ({
        id: tx.id,
        date: tx.date,
        description: tx.description,
        amount: tx.amount,
        direction: tx.direction,
        source: tx.source,
        accountLabel: tx.accountLabel,
        accountIdentifier: tx.accountIdentifier,
        normalizedKey: tx.normalizedKey,
        notificationDetail: tx.notificationDetail ?? null,
        counterpartyAccount: tx.counterpartyAccount ?? null,
        ledgerMonth: tx.ledgerMonth,
        ledgerYear: tx.ledgerYear,
        createdAt: tx.createdAt,
        categoryId: null,
        categoryName: null,
        mainCategoryId: null,
        mainCategoryName: null,
        autoCategorized: false,
        needsManualCategory: true,
      }));

      const { transactions: categorized, autoCategorized } = categorizeTransactions(
        normalized,
        state.transactions,
        categoryIndex,
        {
          categoryId: REVIEW_SUB_CATEGORY.id,
          categoryName: REVIEW_SUB_CATEGORY.name,
          mainCategoryId: REVIEW_MAIN_CATEGORY.id,
          mainCategoryName: REVIEW_MAIN_CATEGORY.name,
        },
      );

      setState((current) => ({
        ...current,
        transactions: [...categorized, ...current.transactions],
      }));

      const reviewCount = categorized.filter((tx) => tx.needsManualCategory).length;

      return {
        importedCount: categorized.length,
        autoCategorized,
        reviewCount,
      };
    },
    [state.transactions, categoryIndex],
  );

  const refreshLedger = useCallback(async () => {
    await refreshFromServer();
  }, [refreshFromServer]);

  const assignCategory = useCallback(
    async (
      transactionId: UUID,
      {
        categoryId,
        projectId,
        transactionTypeId,
        mainCategoryId,
        reason,
      }: {
        categoryId: UUID;
        projectId: UUID;
        transactionTypeId: UUID;
        mainCategoryId?: UUID | null;
        reason?: string | null;
      },
    ) => {
      if (USE_SERVER_PIPELINE) {
        await updateCategory(transactionId, {
          categoryId,
          projectId,
          transactionTypeId,
          reason,
        });
        await refreshFromServer();
        return;
      }

      const categoryName: string | undefined = undefined;
      setState((current) => {
        const tx = current.transactions.find((item) => item.id === transactionId);
        if (!tx) {
          return current;
        }

        let nextCategories = [...current.categories];
        let { map: categoryIndexLocal, tree: treeLocal } = ensureCategoryIndex(nextCategories);

        const rebuildIndexes = () => {
          const refreshed = ensureCategoryIndex(nextCategories);
          categoryIndexLocal = refreshed.map;
          treeLocal = refreshed.tree;
        };

        let resolvedCategoryId = categoryId ?? null;
        let resolvedCategoryName: string | null = null;
        let resolvedMainId = mainCategoryId ?? null;
        let resolvedMainName: string | null = null;

        const ensureMainCategory = (id: string | null): Category | null => {
          if (!id) return null;
          return categoryIndexLocal.get(id) ?? null;
        };

        if (categoryName && categoryName.trim().length) {
          const trimmed = categoryName.trim();
          const siblingLookup = resolvedMainId
            ? (treeLocal.byParent[resolvedMainId] ?? []).find(
                (cat) => cat.name.toLowerCase() === trimmed.toLowerCase(),
              )
            : nextCategories.find(
                (cat) => !cat.parentId && cat.name.toLowerCase() === trimmed.toLowerCase(),
              );

          if (siblingLookup) {
            resolvedCategoryId = siblingLookup.id;
            resolvedCategoryName = siblingLookup.name;
            resolvedMainId = siblingLookup.parentId ?? resolvedMainId;
          } else {
            const newCategory: Category = {
              id: createId(),
              name: trimmed,
              parentId: resolvedMainId ?? null,
            };
            nextCategories = [...nextCategories, newCategory];
            rebuildIndexes();
            resolvedCategoryId = newCategory.id;
            resolvedCategoryName = newCategory.name;
            if (newCategory.parentId) {
              const parent = ensureMainCategory(newCategory.parentId);
              resolvedMainId = parent?.id ?? null;
              resolvedMainName = parent?.name ?? null;
            } else {
              resolvedMainId = newCategory.id;
              resolvedMainName = newCategory.name;
            }
          }
        }

        if (resolvedCategoryId && !resolvedCategoryName) {
          const category = categoryIndexLocal.get(resolvedCategoryId);
          resolvedCategoryName = category?.name ?? null;
          resolvedMainId = category?.parentId ?? resolvedMainId;
        }

        if (resolvedMainId && !resolvedMainName) {
          const main = ensureMainCategory(resolvedMainId);
          resolvedMainName = main?.name ?? null;
        }

        if (resolvedCategoryId && !resolvedMainId) {
          const category = categoryIndexLocal.get(resolvedCategoryId);
          if (category?.parentId) {
            const main = ensureMainCategory(category.parentId);
            resolvedMainId = main?.id ?? null;
            resolvedMainName = main?.name ?? null;
          }
        }

        const updatedTransactions = current.transactions.map((item) =>
          item.id === transactionId
            ? {
                ...item,
                categoryId: resolvedCategoryId,
                categoryName: resolvedCategoryName,
                mainCategoryId: resolvedMainId,
                mainCategoryName: resolvedMainName,
                autoCategorized: false,
                needsManualCategory: !resolvedCategoryId,
                classificationSource: 'manual',
                classificationRuleId: null,
                classificationRuleLabel: null,
              }
            : item,
        );

        return {
          ...current,
          categories: nextCategories,
          transactions: updatedTransactions,
        };
      });
    },
    [refreshFromServer],
  );

  const clearReviewQueue = useCallback(async () => {
    await clearReviewQueueRequest();
    await refreshFromServer();
  }, [refreshFromServer]);

  const clearAll = useCallback(() => {
    setState(DEFAULT_STATE);
  }, []);

  const value = useMemo<LedgerContextValue>(
    () => ({
      transactions: state.transactions,
      categories: state.categories,
      categoryTree,
      summary,
      reviewTransactions,
      reviewProjects: state.reviewProjects,
      reviewTransactionTypes: state.reviewTransactionTypes,
      importCsv,
      refreshLedger,
      assignCategory,
      clearReviewQueue,
      clearAll,
      serverPipelineEnabled: USE_SERVER_PIPELINE,
      rules,
      refreshRules,
      createRule,
      updateRule,
      deleteRule,
      ledgerMeta,
    }),
    [state.transactions, state.categories, state.reviewProjects, state.reviewTransactionTypes, categoryTree, summary, reviewTransactions, importCsv, refreshLedger, assignCategory, clearReviewQueue, clearAll, rules, refreshRules, createRule, updateRule, deleteRule, ledgerMeta],
  );

  return <LedgerContext.Provider value={value}>{children}</LedgerContext.Provider>;
};

export const useLedger = (): LedgerContextValue => {
  const context = useContext(LedgerContext);
  if (!context) {
    throw new Error('useLedger must be used within a LedgerProvider');
  }
  return context;
};
