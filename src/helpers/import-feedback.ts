export type ImportSummaryWithMessage = {
  importedCount: number;
  autoCategorized?: number;
  autoCategorizedCount?: number;
  reviewCount?: number;
  pendingReviewCount?: number;
  duplicateCount?: number;
  errorCount?: number;
  message?: string;
  totalRows?: number;
  batchId?: string;
  errors?: Array<{ rowNumber: number; message: string }>;
};

export type ImportFeedbackCounts = {
  imported: number;
  auto: number;
  review: number;
  duplicates: number;
  errors: number;
};

export const getImportFeedbackCounts = (summary: ImportSummaryWithMessage): ImportFeedbackCounts => ({
  imported: summary.importedCount ?? 0,
  auto: summary.autoCategorized ?? summary.autoCategorizedCount ?? 0,
  review: summary.reviewCount ?? summary.pendingReviewCount ?? 0,
  duplicates: summary.duplicateCount ?? 0,
  errors: summary.errorCount ?? 0,
});

export const buildDutchImportMessage = (summary: ImportSummaryWithMessage) => {
  const { imported, auto, review, duplicates, errors } = getImportFeedbackCounts(summary);

  const parts = [
    imported === 1 ? '1 transactie toegevoegd' : `${imported} transacties toegevoegd`,
  ];

  if (auto > 0) {
    parts.push(auto === 1 ? '1 automatisch gecategoriseerd' : `${auto} automatisch gecategoriseerd`);
  }
  if (review > 0) {
    parts.push(review === 1 ? '1 te beoordelen' : `${review} te beoordelen`);
  }
  if (duplicates > 0) {
    parts.push(duplicates === 1 ? '1 dubbele transactie genegeerd' : `${duplicates} dubbele transacties genegeerd`);
  }
  if (errors > 0) {
    parts.push(errors === 1 ? '1 rij overgeslagen' : `${errors} rijen overgeslagen`);
  }

  return `Import voltooid. ${parts.join('. ')}.`;
};

export const getImportFeedbackMessage = (summary: ImportSummaryWithMessage) =>
  summary.message ?? buildDutchImportMessage(summary);
