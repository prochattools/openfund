export type ImportFormat = 'xlsx_initial' | 'csv_ing';

export interface NormalizedTransaction {
  accountIdentifier: string;
  accountName: string | null;
  currency: string;
  date: Date;
  description: string;
  counterparty: string | null;
  paymentPurpose: string | null;
  normalizedPaymentPurpose: string;
  amountMinor: bigint;
  reference: string | null;
  normalizedDescription: string;
  source: string;
  raw: Record<string, unknown>;
}

export interface ParsedRowSuccess extends NormalizedTransaction {
  rowNumber: number;
}

export interface ParsedRowError {
  rowNumber: number;
  message: string;
  raw: Record<string, unknown> | null;
}

export interface ParseResult {
  successes: ParsedRowSuccess[];
  errors: ParsedRowError[];
  format: ImportFormat;
}

export interface ImportSummaryRowError {
  rowNumber: number;
  message: string;
}

export interface ImportSummary {
  filename: string;
  format: ImportFormat;
  totalRows: number;
  importedCount: number;
  duplicateCount: number;
  errorCount: number;
  autoCategorizedCount: number;
  pendingReviewCount: number;
  batchId: string;
  errors: ImportSummaryRowError[];
}
