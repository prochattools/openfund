export type LedgerMeta = {
  id: string;
  month: number;
  year: number;
  lockedAt: string | null;
  lockedBy: string | null;
  lockNote: string | null;
};

export type ApiLedgerMeta = LedgerMeta;

export type UploadImportSummary = {
  importedCount: number;
  autoCategorizedCount: number;
  pendingReviewCount: number;
  message?: string;
  duplicateCount?: number;
  errorCount?: number;
  totalRows?: number;
  format?: string;
  batchId?: string;
  errors?: Array<{ rowNumber: number; message: string }>;
};

export type ImportSummary = {
  importedCount: number;
  autoCategorized: number;
  reviewCount: number;
  message?: string;
  duplicateCount?: number;
  errorCount?: number;
  totalRows?: number;
  format?: string;
  batchId?: string;
  errors?: Array<{ rowNumber: number; message: string }>;
};

export const mapLedgerMeta = (ledgers: ApiLedgerMeta[] | undefined | null): LedgerMeta[] =>
  Array.isArray(ledgers)
    ? ledgers.map((ledger) => ({
        id: ledger.id,
        month: ledger.month,
        year: ledger.year,
        lockedAt: ledger.lockedAt,
        lockedBy: ledger.lockedBy,
        lockNote: ledger.lockNote,
      }))
    : [];

export const mapUploadSummary = (summary: UploadImportSummary): ImportSummary => ({
  importedCount: summary.importedCount,
  autoCategorized: summary.autoCategorizedCount,
  reviewCount: summary.pendingReviewCount,
  message: summary.message,
  duplicateCount: summary.duplicateCount,
  errorCount: summary.errorCount,
  totalRows: summary.totalRows,
  format: summary.format,
  batchId: summary.batchId,
  errors: summary.errors,
});
