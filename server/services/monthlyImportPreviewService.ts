import { buildImportFingerprint } from './transactionFingerprint';
import {
  checkRunningBalanceContinuity,
  computeHistoricalTotals,
  type HistoricalControlCheck,
} from '../../lib/import/historicalControls';
import { parseHistoricalIngCsvStatement, type ParsedIngCsvRow } from '../../lib/import/ingCsvParser';
import { hashSourceContent } from './statementControlService';
import { normalizeWhitespace, toISODateString } from '../../lib/import/normalizers';
import type {
  DeterministicCategorizationResult,
  DeterministicTransactionFacts,
} from './deterministicCategorizationService';

export class MonthlyImportPreviewError extends Error {
  statusCode: number;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = 'MonthlyImportPreviewError';
    this.statusCode = statusCode;
  }
}

export type MonthlyImportDuplicateLookupInput = {
  workspaceId: string;
  accountId?: string | null;
  accountIdentifier?: string | null;
  fingerprints: string[];
};

export type MonthlyImportDuplicateLookup = (
  input: MonthlyImportDuplicateLookupInput,
) => Promise<Set<string> | string[]>;

export type MonthlyImportPreviewInput = {
  workspaceId: string;
  accountId?: string | null;
  accountIdentifier?: string | null;
  actorId?: string | null;
  originalFilename: string;
  mediaType: string;
  retainedCsvBytes: Buffer | Uint8Array | string;
  expectedPeriodStart?: Date | null;
  expectedPeriodEnd?: Date | null;
};

export type MonthlyImportPreviewOptions = {
  findExistingImportFingerprints?: MonthlyImportDuplicateLookup;
  categorizePreviewTransactions?: (
    input: MonthlyImportPreviewCategorizationInput,
  ) => Promise<DeterministicCategorizationResult[]>;
};

export type MonthlyImportPreviewSourceFile = {
  filename: string;
  mediaType: string;
  sizeBytes: number;
  sha256: string;
  retainedBytesHash: string;
};

export type MonthlyImportPreviewTotals = {
  openingBalanceMinor: string;
  incomeMinor: string;
  expenseMinor: string;
  netMinor: string;
  closingBalanceMinor: string;
};

export type MonthlyImportPreviewRunningBalanceFinding = {
  rowNumber: number;
  expectedBalanceMinor: string | null;
  actualBalanceMinor: string | null;
  message: string;
};

export type MonthlyImportPreviewCategorizationInput = {
  workspaceId: string;
  accountId: string | null;
  accountIdentifier: string | null;
  transactions: DeterministicTransactionFacts[];
};

export type MonthlyImportPreviewCategorizationSummary = {
  finalizedCandidateCount: number;
  reviewSuggestedCount: number;
  conflictCount: number;
  unmatchedCount: number;
  createsTransactionBookings: false;
  closesPeriod: false;
};

export type MonthlyImportPreview = {
  sourceFile: MonthlyImportPreviewSourceFile;
  workspaceId: string;
  accountId: string | null;
  accountIdentifier: string | null;
  uploadedBy: string | null;
  rowCount: number;
  periodStart: string | null;
  periodEnd: string | null;
  coverageStatus: 'COMPLETE' | 'PARTIAL';
  openingBalanceMinor: string;
  incomeMinor: string;
  expenseMinor: string;
  closingBalanceMinor: string;
  totals: MonthlyImportPreviewTotals;
  duplicateCount: number;
  newTransactionCount: number;
  potentialDuplicateTransactionFingerprints: string[];
  runningBalance: {
    valid: boolean;
    findings: MonthlyImportPreviewRunningBalanceFinding[];
  };
  closeEligibility: {
    eligible: boolean;
    reasons: string[];
  };
  booking: {
    createsTransactions: false;
    createsTransactionBookings: false;
    closesPeriod: false;
  };
  categorization: MonthlyImportPreviewCategorizationSummary | null;
};

const CSV_MEDIA_TYPES = new Set([
  'text/csv',
  'application/csv',
  'application/vnd.ms-excel',
]);

const toRetainedBuffer = (content: Buffer | Uint8Array | string): Buffer => {
  if (Buffer.isBuffer(content)) return Buffer.from(content);
  if (typeof content === 'string') return Buffer.from(content, 'utf8');
  return Buffer.from(content);
};

const isCsvUpload = (filename: string, mediaType: string): boolean => {
  const normalizedFilename = filename.toLowerCase();
  const normalizedMediaType = mediaType.toLowerCase().split(';')[0]?.trim() ?? '';
  return normalizedFilename.endsWith('.csv') && CSV_MEDIA_TYPES.has(normalizedMediaType);
};

const rowDescription = (row: ParsedIngCsvRow): string =>
  normalizeWhitespace(String(row.rawRow['Name / Description'] ?? ''));

const buildPreviewFingerprint = (row: ParsedIngCsvRow): string =>
  buildImportFingerprint({
    accountIdentifier: row.accountIdentifier ?? '',
    date: row.date,
    amountMinor: row.amountMinor,
    description: rowDescription(row),
    counterparty: row.counterparty,
    reference: row.reference,
    raw: row.rawRow,
  });

const sortForStatementControls = (rows: ParsedIngCsvRow[]): ParsedIngCsvRow[] =>
  [...rows].sort((left, right) => {
    const byDate = left.date.getTime() - right.date.getTime();
    return byDate === 0 ? left.rowNumber - right.rowNumber : byDate;
  });

const normalizeExistingFingerprints = (value: Set<string> | string[]): Set<string> =>
  value instanceof Set ? value : new Set(value);

const collectRepeatedFingerprints = (fingerprints: string[]): Set<string> => {
  const seen = new Set<string>();
  const repeated = new Set<string>();
  for (const fingerprint of fingerprints) {
    if (seen.has(fingerprint)) {
      repeated.add(fingerprint);
    }
    seen.add(fingerprint);
  }
  return repeated;
};

const countDuplicateRows = (fingerprints: string[], existingFingerprints: Set<string>): number => {
  const seenInUpload = new Set<string>();
  let duplicateRows = 0;
  for (const fingerprint of fingerprints) {
    if (existingFingerprints.has(fingerprint) || seenInUpload.has(fingerprint)) {
      duplicateRows += 1;
    }
    seenInUpload.add(fingerprint);
  }
  return duplicateRows;
};

const serializeFinding = (finding: HistoricalControlCheck): MonthlyImportPreviewRunningBalanceFinding => ({
  rowNumber: finding.rowNumber ?? 0,
  expectedBalanceMinor: finding.expectedBalanceMinor == null ? null : finding.expectedBalanceMinor.toString(),
  actualBalanceMinor: finding.actualBalanceMinor == null ? null : finding.actualBalanceMinor.toString(),
  message: finding.message ?? 'Saldoverloop sluit niet aan.',
});

const readAccountIdentifier = (rows: ParsedIngCsvRow[], fallback?: string | null): string | null => {
  if (fallback) return fallback;
  return rows.find((row) => row.accountIdentifier)?.accountIdentifier ?? null;
};

const summarizeCategorization = (
  results: DeterministicCategorizationResult[],
): MonthlyImportPreviewCategorizationSummary => ({
  finalizedCandidateCount: results.filter((result) => result.status === 'finalized').length,
  reviewSuggestedCount: results.filter((result) => result.status === 'review_suggested').length,
  conflictCount: results.filter((result) => result.status === 'conflict').length,
  unmatchedCount: results.filter((result) => result.status === 'unmatched').length,
  createsTransactionBookings: false,
  closesPeriod: false,
});

export const buildMonthlyImportPreview = async (
  input: MonthlyImportPreviewInput,
  options: MonthlyImportPreviewOptions = {},
): Promise<MonthlyImportPreview> => {
  if (!input.workspaceId) {
    throw new MonthlyImportPreviewError('Werkruimte ontbreekt.');
  }
  if (!input.originalFilename || !input.mediaType || !isCsvUpload(input.originalFilename, input.mediaType)) {
    throw new MonthlyImportPreviewError('Upload een ING CSV-bestand voor de importvoorbeeldweergave.');
  }

  const retainedBytes = toRetainedBuffer(input.retainedCsvBytes);
  if (!retainedBytes.byteLength) {
    throw new MonthlyImportPreviewError('Het CSV-bestand is leeg.');
  }

  const sourceHash = hashSourceContent(retainedBytes);
  let statement;
  try {
    statement = await parseHistoricalIngCsvStatement(retainedBytes, {
      periodStart: input.expectedPeriodStart ?? null,
      periodEnd: input.expectedPeriodEnd ?? null,
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'Onbekende parserfout.';
    throw new MonthlyImportPreviewError(`Dit ING CSV-bestand kan niet worden ingelezen: ${detail}`);
  }

  if (!statement.rows.length) {
    throw new MonthlyImportPreviewError('Het ING CSV-bestand bevat geen transacties.');
  }

  const controlRows = sortForStatementControls(statement.rows);
  const totals = computeHistoricalTotals(controlRows);
  const runningChecks = checkRunningBalanceContinuity(controlRows);
  const runningFindings = runningChecks.filter((check) => !check.valid).map(serializeFinding);
  const fingerprints = controlRows.map(buildPreviewFingerprint);
  const repeatedFingerprints = collectRepeatedFingerprints(fingerprints);
  const existingFingerprints = options.findExistingImportFingerprints
    ? normalizeExistingFingerprints(await options.findExistingImportFingerprints({
        workspaceId: input.workspaceId,
        accountId: input.accountId ?? null,
        accountIdentifier: input.accountIdentifier ?? readAccountIdentifier(controlRows),
        fingerprints,
      }))
    : new Set<string>();

  const potentialDuplicateTransactionFingerprints = [...new Set([
    ...repeatedFingerprints,
    ...existingFingerprints,
  ])].sort();
  const duplicateCount = countDuplicateRows(fingerprints, existingFingerprints);
  const accountIdentifier = readAccountIdentifier(controlRows, input.accountIdentifier);
  const categorizationResults = options.categorizePreviewTransactions
    ? await options.categorizePreviewTransactions({
        workspaceId: input.workspaceId,
        accountId: input.accountId ?? null,
        accountIdentifier,
        transactions: fingerprints.map((fingerprint) => ({
          importFingerprint: fingerprint,
        })),
      })
    : null;
  const closeReasons: string[] = [];
  if (statement.coverageStatus !== 'COMPLETE') {
    closeReasons.push('Gedeeltelijke of open afschriften kunnen niet worden gesloten.');
  }
  if (runningFindings.length) {
    closeReasons.push('Het saldoverloop sluit niet overal aan.');
  }
  if (duplicateCount > 0) {
    closeReasons.push('Dubbele transacties moeten eerst worden beoordeeld.');
  }

  const netMinor = totals.incomeMinor - totals.expenseMinor;

  return {
    sourceFile: {
      filename: input.originalFilename,
      mediaType: input.mediaType,
      sizeBytes: retainedBytes.byteLength,
      sha256: sourceHash,
      retainedBytesHash: sourceHash,
    },
    workspaceId: input.workspaceId,
    accountId: input.accountId ?? null,
    accountIdentifier,
    uploadedBy: input.actorId ?? null,
    rowCount: statement.rowCount,
    periodStart: statement.periodStart ? toISODateString(statement.periodStart) : null,
    periodEnd: statement.periodEnd ? toISODateString(statement.periodEnd) : null,
    coverageStatus: statement.coverageStatus,
    openingBalanceMinor: totals.openingBalanceMinor.toString(),
    incomeMinor: totals.incomeMinor.toString(),
    expenseMinor: totals.expenseMinor.toString(),
    closingBalanceMinor: totals.closingBalanceMinor.toString(),
    totals: {
      openingBalanceMinor: totals.openingBalanceMinor.toString(),
      incomeMinor: totals.incomeMinor.toString(),
      expenseMinor: totals.expenseMinor.toString(),
      netMinor: netMinor.toString(),
      closingBalanceMinor: totals.closingBalanceMinor.toString(),
    },
    duplicateCount,
    newTransactionCount: Math.max(0, statement.rowCount - duplicateCount),
    potentialDuplicateTransactionFingerprints,
    runningBalance: {
      valid: runningFindings.length === 0,
      findings: runningFindings,
    },
    closeEligibility: {
      eligible: closeReasons.length === 0,
      reasons: closeReasons,
    },
    booking: {
      createsTransactions: false,
      createsTransactionBookings: false,
      closesPeriod: false,
    },
    categorization: categorizationResults ? summarizeCategorization(categorizationResults) : null,
  };
};
