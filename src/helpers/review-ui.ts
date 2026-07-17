import type { EvidenceRichReviewItem } from '@/libs/api';

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

export const getReviewConfirmLabel = (input: {
  admin: boolean;
  busy: boolean;
  changed: boolean;
}): string => {
  if (!input.admin) return 'Alleen beheerder';
  if (input.busy) return 'Opslaan…';
  return input.changed ? 'Wijzigingen bevestigen' : 'Bevestigen';
};
