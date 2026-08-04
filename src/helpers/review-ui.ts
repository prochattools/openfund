import type {
  EvidenceRichReviewItem,
  ReviewCategoryOption,
  ReviewPrefillMetadata,
  ReviewProjectOption,
  ReviewTransactionTypeOption,
} from '@/libs/api';

export type ReviewConfidenceFilter = 'all' | 'green' | 'amber' | 'red' | 'gray';

export type ReviewReliability = {
  band: Exclude<ReviewConfidenceFilter, 'all'>;
  score: number | null;
  label: string;
  className: string;
};

export const getReviewReliability = (item: EvidenceRichReviewItem): ReviewReliability => {
  const first = item.alternatives[0];
  if (item.deterministicStatus === 'conflict') {
    return { band: 'red', score: 60, label: 'Onzeker', className: 'border-rose-300 bg-rose-50 text-rose-800' };
  }
  if (item.deterministicStatus === 'finalized' || first?.confidence === 'EXACT_FALLBACK') {
    return { band: 'green', score: 97, label: 'Zeer betrouwbaar', className: 'border-emerald-300 bg-emerald-50 text-emerald-800' };
  }
  if (first?.confidence === 'OVERALL') {
    return { band: 'amber', score: 85, label: 'Controleer zorgvuldig', className: 'border-amber-300 bg-amber-50 text-amber-900' };
  }
  if (first?.confidence === 'FUZZY') {
    return { band: 'red', score: 60, label: 'Onzeker', className: 'border-rose-300 bg-rose-50 text-rose-800' };
  }
  return { band: 'gray', score: null, label: 'Onvoldoende bewijs', className: 'border-stone-300 bg-stone-100 text-stone-700' };
};

export const canConfirmReviewRow = (input: {
  admin: boolean;
  busy: boolean;
  projectId: string;
  transactionTypeId: string;
  categoryId: string;
}): boolean => Boolean(
  input.admin
  && !input.busy
  && input.projectId
  && input.transactionTypeId
  && input.categoryId,
);

export type ReviewSelectionIssueCode =
  | 'missing-project-id'
  | 'unavailable-project'
  | 'missing-transaction-type-id'
  | 'unavailable-transaction-type'
  | 'wrong-direction-transaction-type'
  | 'missing-category-id'
  | 'unavailable-category';

export type ReviewSelectionIssue = {
  field: 'project' | 'transactionType' | 'category';
  code: ReviewSelectionIssueCode;
  message: string;
  rawId: string | null;
};

export type ReviewSelectionValidity = {
  canConfirm: boolean;
  projectVisible: boolean;
  transactionTypeVisible: boolean;
  categoryVisible: boolean;
  issues: ReviewSelectionIssue[];
};

const hasId = (value: string) => value.trim().length > 0;

const includesId = <T extends { id: string }>(items: T[], id: string): boolean =>
  items.some((item) => item.id === id);

export const getReviewSelectionValidity = (input: {
  admin: boolean;
  busy: boolean;
  projectId: string;
  transactionTypeId: string;
  categoryId: string;
  projects: ReviewProjectOption[];
  transactionTypes: ReviewTransactionTypeOption[];
  compatibleTransactionTypes: ReviewTransactionTypeOption[];
  categories: ReviewCategoryOption[];
}): ReviewSelectionValidity => {
  const issues: ReviewSelectionIssue[] = [];

  const projectVisible = hasId(input.projectId) && includesId(input.projects, input.projectId);
  const transactionTypeVisible = hasId(input.transactionTypeId)
    && includesId(input.compatibleTransactionTypes, input.transactionTypeId);
  const transactionTypeExists = hasId(input.transactionTypeId)
    && includesId(input.transactionTypes, input.transactionTypeId);
  const categoryVisible = hasId(input.categoryId) && includesId(input.categories, input.categoryId);

  if (!hasId(input.projectId)) {
    issues.push({
      field: 'project',
      code: 'missing-project-id',
      message: 'Kies een geldige Klant.',
      rawId: null,
    });
  } else if (!projectVisible) {
    issues.push({
      field: 'project',
      code: 'unavailable-project',
      message: 'De voorgestelde Klant is niet meer beschikbaar. Kies een geldige Klant.',
      rawId: input.projectId,
    });
  }

  if (!hasId(input.transactionTypeId)) {
    issues.push({
      field: 'transactionType',
      code: 'missing-transaction-type-id',
      message: 'Kies een geldig transactietype.',
      rawId: null,
    });
  } else if (!transactionTypeVisible) {
    issues.push({
      field: 'transactionType',
      code: transactionTypeExists
        ? 'wrong-direction-transaction-type'
        : 'unavailable-transaction-type',
      message: transactionTypeExists
        ? 'Het voorgestelde transactietype is niet beschikbaar voor deze richting. Kies een geldig transactietype voordat je bevestigt.'
        : 'Het voorgestelde transactietype is niet meer beschikbaar. Kies een geldig transactietype.',
      rawId: input.transactionTypeId,
    });
  }

  if (!hasId(input.categoryId)) {
    issues.push({
      field: 'category',
      code: 'missing-category-id',
      message: 'Kies een geldige categorie.',
      rawId: null,
    });
  } else if (!categoryVisible) {
    issues.push({
      field: 'category',
      code: 'unavailable-category',
      message: 'De voorgestelde categorie is niet meer beschikbaar. Kies een geldige categorie.',
      rawId: input.categoryId,
    });
  }

  return {
    canConfirm: Boolean(input.admin && !input.busy && issues.length === 0),
    projectVisible,
    transactionTypeVisible,
    categoryVisible,
    issues,
  };
};

export const getReviewConfirmLabel = (input: {
  admin: boolean;
  busy: boolean;
  changed: boolean;
}): string => {
  if (!input.admin) return 'Alleen beheerder';
  if (input.busy) return 'Opslaan…';
  return input.changed ? 'Wijzigingen bevestigen' : 'Bevestigen';
};

export type ReviewPrefillTone = 'neutral' | 'warning' | 'muted';

export type ReviewPrefillPresentation = {
  label: string;
  tone: ReviewPrefillTone;
};

export const getReviewPrefillPresentation = (prefill: ReviewPrefillMetadata): ReviewPrefillPresentation => {
  switch (prefill.source) {
    case 'OWNER_HISTORY_V2':
      return { label: 'Beste beschikbare historische match', tone: 'neutral' };
    case 'LEGACY_HISTORY_FALLBACK':
      return { label: 'Zwakke historische fallback — zorgvuldig controleren', tone: 'warning' };
    case 'EXISTING_BOOKING':
      return { label: 'Bestaande boeking', tone: 'neutral' };
    case 'AUTHORITATIVE_TRANSACTION':
      return { label: 'Bestaande classificatie', tone: 'neutral' };
    case 'NONE':
    default:
      return { label: 'Geen geldig voorstel', tone: 'muted' };
  }
};
