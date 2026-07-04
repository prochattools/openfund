import crypto from 'node:crypto';
import { cashDeltaMinor, computeHistoricalTotals, type HistoricalControlTotals } from './historicalControls';
import type { ParsedHistoricalWorkbookRow } from './historicalWorkbookParser';
import type { ParsedHistoricalIngCsvStatement, ParsedIngCsvRow } from './ingCsvParser';
import { parseVerduidelijkingRows, type VerduidelijkingEvidenceRow } from './verduidelijkingParser';
import { normalizeWhitespace } from './normalizers';

export type HistoricalSourceFilePlan = {
  kind: 'HISTORICAL_WORKBOOK_XLSX' | 'BANK_EXPORT_CSV' | 'BANK_STATEMENT_PDF';
  originalFilename: string;
  mediaType: string;
  sha256: string;
  sizeBytes?: number;
};

export type HistoricalTransactionPlan = {
  fingerprint: string;
  rowNumber: number;
  date: string;
  direction: 'credit' | 'debit';
  amountMinor: bigint;
  cashDeltaMinor: bigint;
  accountIdentifier: string | null;
  counterparty: string | null;
  code: string | null;
  klant: string | null;
  type: string | null;
  category: string | null;
  paymentPurpose: string | null;
  normalizedPaymentPurpose: string;
  reference: string | null;
  rawRow: Record<string, unknown>;
};

export type HistoricalStatementPlan = {
  sourceFile: HistoricalSourceFilePlan;
  supportingPdfFile: HistoricalSourceFilePlan | null;
  periodStart: string | null;
  periodEnd: string | null;
  coverageStatus: 'COMPLETE' | 'PARTIAL';
  sourceIsOpenPartial: boolean;
  rowCount: number;
  totals: HistoricalControlTotals;
  transactionFingerprints: string[];
};

export type HistoricalStatementPeriodPlan = {
  periodStart: string | null;
  periodEnd: string | null;
  coverageStatus: 'COMPLETE' | 'PARTIAL';
  openingBalanceMinor: bigint;
  closingBalanceMinor: bigint;
  incomeMinor: bigint;
  expenseMinor: bigint;
  netMinor: bigint;
  transactionCount: number;
  closePermitted: boolean;
  closeReason: string | null;
};

export type HistoricalImportPlan = {
  workbook: {
    sourceFile: HistoricalSourceFilePlan;
    statement: HistoricalStatementPlan;
    period: HistoricalStatementPeriodPlan;
    transactions: HistoricalTransactionPlan[];
    clarificationEvidence: VerduidelijkingEvidenceRow[];
  };
  openStatement: {
    sourceFile: HistoricalSourceFilePlan;
    supportingPdfFile: HistoricalSourceFilePlan | null;
    statement: HistoricalStatementPlan;
    period: HistoricalStatementPeriodPlan;
    transactions: HistoricalTransactionPlan[];
    clarificationEvidence: VerduidelijkingEvidenceRow[];
  };
  validationFindings: string[];
  duplicateFingerprints: string[];
};

export type HistoricalPlannerInput = {
  concludedWorkbook: {
    filename: string;
    mediaType: string;
    sha256: string;
    rows: ParsedHistoricalWorkbookRow[];
  };
  openStatement: {
    filename: string;
    mediaType: string;
    sha256: string;
    pdfFilename?: string | null;
    pdfMediaType?: string | null;
    pdfSha256?: string | null;
    statement: ParsedHistoricalIngCsvStatement;
  };
  clarificationRows: Record<string, unknown>[];
};

export type HistoricalPlannerResult = {
  plan: HistoricalImportPlan;
  findings: string[];
};

const fingerprint = (parts: Array<string | bigint | null | undefined>): string =>
  crypto.createHash('sha256')
    .update(parts.map((part) => (part == null ? '' : String(part))).join('|'))
    .digest('hex');

const normalizeLabel = (value: string | null | undefined): string | null => {
  if (!value) return null;
  const text = normalizeWhitespace(value);
  return text.length ? text : null;
};

const buildTransactionPlan = (row: ParsedHistoricalWorkbookRow | ParsedIngCsvRow): HistoricalTransactionPlan => ({
  fingerprint: fingerprint([
    row.accountIdentifier,
    row.date.toISOString(),
    row.amountMinor,
    row.direction,
    row.counterparty,
    row.reference,
    row.paymentPurpose,
  ]),
  rowNumber: row.rowNumber,
  date: row.date.toISOString(),
  direction: row.direction,
  amountMinor: row.amountMinor,
  cashDeltaMinor: cashDeltaMinor(row),
  accountIdentifier: row.accountIdentifier ?? null,
  counterparty: row.counterparty ?? null,
  code: row.code ?? null,
  klant: 'customerLabel' in row ? normalizeLabel(row.customerLabel) : null,
  type: 'typeLabel' in row ? normalizeLabel(row.typeLabel) : null,
  category: 'categoryLabel' in row ? normalizeLabel(row.categoryLabel) : null,
  paymentPurpose: row.paymentPurpose ?? null,
  normalizedPaymentPurpose: row.normalizedPaymentPurpose,
  reference: row.reference ?? null,
  rawRow: row.rawRow,
});

const buildSourceFile = (input: { kind: HistoricalSourceFilePlan['kind']; filename: string; mediaType: string; sha256: string; sizeBytes?: number }): HistoricalSourceFilePlan => ({
  kind: input.kind,
  originalFilename: input.filename,
  mediaType: input.mediaType,
  sha256: input.sha256,
  sizeBytes: input.sizeBytes,
});

const detectDuplicates = (fingerprints: string[]): string[] => {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const fingerprintValue of fingerprints) {
    if (seen.has(fingerprintValue)) {
      duplicates.add(fingerprintValue);
    }
    seen.add(fingerprintValue);
  }
  return [...duplicates].sort();
};

const buildStatementPlan = (
  sourceFile: HistoricalSourceFilePlan,
  supportingPdfFile: HistoricalSourceFilePlan | null,
  rows: Array<ParsedHistoricalWorkbookRow | ParsedIngCsvRow>,
  coverageStatus: 'COMPLETE' | 'PARTIAL',
  periodStart: Date | null,
  periodEnd: Date | null,
): HistoricalStatementPlan => {
  const transactions = rows.map(buildTransactionPlan);
  const totals = computeHistoricalTotals(rows);
  const transactionFingerprints = transactions.map((tx) => tx.fingerprint);
  return {
    sourceFile,
    supportingPdfFile,
    periodStart: periodStart?.toISOString() ?? null,
    periodEnd: periodEnd?.toISOString() ?? null,
    coverageStatus,
    sourceIsOpenPartial: coverageStatus === 'PARTIAL',
    rowCount: rows.length,
    totals,
    transactionFingerprints,
  };
};

const buildPeriodPlan = (statement: HistoricalStatementPlan): HistoricalStatementPeriodPlan => ({
  periodStart: statement.periodStart,
  periodEnd: statement.periodEnd,
  coverageStatus: statement.coverageStatus,
  openingBalanceMinor: statement.totals.openingBalanceMinor,
  closingBalanceMinor: statement.totals.closingBalanceMinor,
  incomeMinor: statement.totals.incomeMinor,
  expenseMinor: statement.totals.expenseMinor,
  netMinor: statement.totals.incomeMinor - statement.totals.expenseMinor,
  transactionCount: statement.totals.transactionCount,
  closePermitted: statement.coverageStatus === 'COMPLETE',
  closeReason: statement.coverageStatus === 'COMPLETE' ? null : 'Partial/open statements cannot be closed.',
});

export const planHistoricalImport = (input: HistoricalPlannerInput): HistoricalPlannerResult => {
  const findings: string[] = [];
  const workbookRows = input.concludedWorkbook.rows;
  const workbookFingerprints = workbookRows.map((row) =>
    fingerprint([
      row.accountIdentifier,
      row.date.toISOString(),
      row.amountMinor,
      row.direction,
      row.counterparty,
      row.reference,
      row.paymentPurpose,
      row.customerLabel,
      row.typeLabel,
      row.categoryLabel,
    ]),
  );
  const workbookStatement = buildStatementPlan(
    buildSourceFile({
      kind: 'HISTORICAL_WORKBOOK_XLSX',
      filename: input.concludedWorkbook.filename,
      mediaType: input.concludedWorkbook.mediaType,
      sha256: input.concludedWorkbook.sha256,
    }),
    null,
    workbookRows,
    'COMPLETE',
    workbookRows[0]?.date ?? null,
    workbookRows[workbookRows.length - 1]?.date ?? null,
  );
  const workbookPeriod = buildPeriodPlan(workbookStatement);
  const workbookTransactions = workbookRows.map(buildTransactionPlan);

  const statementRows = input.openStatement.statement.rows;
  const statementFingerprints = statementRows.map((row) => buildTransactionPlan(row).fingerprint);
  const openStatement = buildStatementPlan(
    buildSourceFile({
      kind: 'BANK_EXPORT_CSV',
      filename: input.openStatement.filename,
      mediaType: input.openStatement.mediaType,
      sha256: input.openStatement.sha256,
    }),
    input.openStatement.pdfFilename && input.openStatement.pdfSha256
      ? buildSourceFile({
          kind: 'BANK_STATEMENT_PDF',
          filename: input.openStatement.pdfFilename,
          mediaType: input.openStatement.pdfMediaType ?? 'application/pdf',
          sha256: input.openStatement.pdfSha256,
        })
      : null,
    statementRows,
    input.openStatement.statement.coverageStatus,
    input.openStatement.statement.periodStart,
    input.openStatement.statement.periodEnd,
  );
  const statementPeriod = buildPeriodPlan(openStatement);
  const openStatementTransactions = statementRows.map(buildTransactionPlan);

  const clarificationEvidence = parseVerduidelijkingRows(input.clarificationRows);
  const duplicateFingerprints = [
    ...detectDuplicates(workbookFingerprints),
    ...detectDuplicates(statementFingerprints),
  ];

  if (openStatement.coverageStatus === 'PARTIAL' && openStatementPeriodCloseForbidden(statementPeriod)) {
    findings.push('Open/partial 2026 statement is not eligible for period close planning.');
  }

  return {
    plan: {
      workbook: {
        sourceFile: workbookStatement.sourceFile,
        statement: workbookStatement,
        period: workbookPeriod,
        transactions: workbookTransactions,
        clarificationEvidence,
      },
      openStatement: {
        sourceFile: openStatement.sourceFile,
        supportingPdfFile: openStatement.supportingPdfFile,
        statement: openStatement,
        period: statementPeriod,
        transactions: openStatementTransactions,
        clarificationEvidence,
      },
      validationFindings: findings,
      duplicateFingerprints,
    },
    findings,
  };
};

const openStatementPeriodCloseForbidden = (period: HistoricalStatementPeriodPlan): boolean => !period.closePermitted;

