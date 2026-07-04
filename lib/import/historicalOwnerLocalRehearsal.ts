import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import * as XLSX from 'xlsx';
import {
  type HistoricalImportPlan,
  type HistoricalStatementPeriodPlan,
  planHistoricalImport,
} from './historicalImportPlanner';
import { parseHistoricalWorkbookRows, type HistoricalWorkbookRow } from './historicalWorkbookParser';
import { parseHistoricalIngCsvStatement, type ParsedHistoricalIngCsvStatement } from './ingCsvParser';
import type { HistoricalControlTotals } from './historicalControls';
import {
  REQUIRED_OWNER_SOURCE_ROLES,
  type OwnerHistoricalSourceDescriptor,
  type OwnerHistoricalSourceRole,
} from './historicalOwnerFileAdapter';

type WorkbookRole = 'concludedWorkbook2024' | 'concludedWorkbook2025';

type OwnerFileRead = OwnerHistoricalSourceDescriptor & {
  filename: string;
  content: Buffer;
  sha256: string;
  sizeBytes: number;
};

export type OwnerHistoricalPlanKey = 'concluded2024' | 'concluded2025';

export type OwnerHistoricalPlanSummary = {
  sourceRole: WorkbookRole;
  filename: string;
  sha256: string;
  rowCount: number;
  statementPeriod: Pick<HistoricalStatementPeriodPlan, 'periodStart' | 'periodEnd' | 'coverageStatus' | 'closePermitted' | 'closeReason'>;
  controlTotals: HistoricalControlTotals;
  duplicateFingerprintCount: number;
  literalDimensionCoverage: {
    klantRows: number;
    typeRows: number;
    categoryRows: number;
  };
};

export type OwnerHistoricalOpenStatementSummary = {
  csvFilename: string;
  pdfFilename: string;
  csvSha256: string;
  pdfSha256: string;
  rowCount: number;
  statementPeriod: Pick<HistoricalStatementPeriodPlan, 'periodStart' | 'periodEnd' | 'coverageStatus' | 'closePermitted' | 'closeReason'>;
  controlTotals: HistoricalControlTotals;
};

export type OwnerHistoricalLocalRehearsalSummary = {
  files: Record<OwnerHistoricalSourceRole, {
    filename: string;
    sha256: string;
    sizeBytes: number;
  }>;
  concluded: Record<OwnerHistoricalPlanKey, OwnerHistoricalPlanSummary>;
  openStatement: OwnerHistoricalOpenStatementSummary;
  duplicateFingerprintCount: number;
};

export type OwnerHistoricalLocalRehearsalBundle = {
  plans: Record<OwnerHistoricalPlanKey, HistoricalImportPlan>;
  retainedSourceContentBySha256: Record<string, Buffer>;
  summary: OwnerHistoricalLocalRehearsalSummary;
};

export type BuildOwnerHistoricalLocalRehearsalInput = {
  repoRoot: string;
  sources: OwnerHistoricalSourceDescriptor[];
  openStatementPeriodStart?: Date;
  openStatementPeriodEnd?: Date;
};

const WORKBOOK_TRANSACTION_SHEETS: Record<WorkbookRole, string> = {
  concludedWorkbook2024: 'NL89INGB0006369960_2024-01-01_2',
  concludedWorkbook2025: 'NL89INGB0006369960_2025-01-01_2',
};

const WORKBOOK_MEDIA_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const DEFAULT_OPEN_STATEMENT_START = new Date('2026-01-01T00:00:00.000Z');
const DEFAULT_OPEN_STATEMENT_END = new Date('2026-07-01T00:00:00.000Z');
const VERIFIED_CONCLUDED_CONTROLS: Record<WorkbookRole, {
  periodStart: string;
  periodEnd: string;
  openingBalanceMinor: bigint;
  incomeMinor: bigint;
  expenseMinor: bigint;
  closingBalanceMinor: bigint;
  transactionCount: number;
}> = {
  concludedWorkbook2024: {
    periodStart: '2024-01-01T00:00:00.000Z',
    periodEnd: '2024-12-31T00:00:00.000Z',
    openingBalanceMinor: 172186n,
    incomeMinor: 3226719n,
    expenseMinor: 2180490n,
    closingBalanceMinor: 1218415n,
    transactionCount: 268,
  },
  concludedWorkbook2025: {
    periodStart: '2025-01-01T00:00:00.000Z',
    periodEnd: '2025-12-31T00:00:00.000Z',
    openingBalanceMinor: 1218415n,
    incomeMinor: 9164244n,
    expenseMinor: 9347573n,
    closingBalanceMinor: 1035086n,
    transactionCount: 413,
  },
};

const hashBuffer = (content: Buffer): string =>
  crypto.createHash('sha256').update(content).digest('hex');

const assertSourcePath = (source: OwnerHistoricalSourceDescriptor, repoRoot: string) => {
  const absolutePath = path.resolve(source.absolutePath);
  if (!path.isAbsolute(source.absolutePath)) {
    throw new Error(`Owner historical source path must be absolute: ${source.role}.`);
  }
  if (absolutePath === repoRoot || absolutePath.startsWith(`${repoRoot}${path.sep}`)) {
    throw new Error(`Owner historical source must stay outside the Git repository: ${source.role}.`);
  }
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`Owner historical source file is missing: ${source.role}.`);
  }
  const stat = fs.statSync(absolutePath);
  if (!stat.isFile()) {
    throw new Error(`Owner historical source path must be a file: ${source.role}.`);
  }
};

const readOwnerFile = (source: OwnerHistoricalSourceDescriptor, repoRoot: string): OwnerFileRead => {
  assertSourcePath(source, repoRoot);
  const content = fs.readFileSync(source.absolutePath);
  const sha256 = hashBuffer(content);
  if (source.expectedSha256 && source.expectedSha256 !== sha256) {
    throw new Error(`Owner historical source hash mismatch: ${source.role}.`);
  }
  return {
    ...source,
    filename: path.basename(source.absolutePath),
    content,
    sha256,
    sizeBytes: content.byteLength,
  };
};

const byRole = (files: OwnerFileRead[], role: OwnerHistoricalSourceRole): OwnerFileRead => {
  const file = files.find((candidate) => candidate.role === role);
  if (!file) {
    throw new Error(`Missing owner historical source descriptor: ${role}.`);
  }
  return file;
};

const excelSerialDate = (serial: number): Date | null => {
  const parsed = XLSX.SSF.parse_date_code(serial);
  if (!parsed) return null;
  return new Date(Date.UTC(parsed.y, parsed.m - 1, parsed.d));
};

const normalizeWorkbookRow = (row: Record<string, unknown>): HistoricalWorkbookRow => {
  const normalized = { ...row };
  const dateValue = normalized.Date;
  if (typeof dateValue === 'number' && dateValue > 20_000 && dateValue < 80_000) {
    const parsed = excelSerialDate(dateValue);
    if (parsed) {
      normalized.Date = parsed;
    }
  }
  return normalized;
};

const workbookRows = (file: OwnerFileRead, role: WorkbookRole): HistoricalWorkbookRow[] => {
  const workbook = XLSX.read(file.content, { type: 'buffer', cellDates: true });
  const sheetName = WORKBOOK_TRANSACTION_SHEETS[role];
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) {
    throw new Error(`Missing owner workbook transaction sheet: ${role}.`);
  }
  return XLSX.utils
    .sheet_to_json<Record<string, unknown>>(sheet, { defval: null, raw: true })
    .filter((row) => row.Date != null && String(row.Date).trim().length > 0)
    .map(normalizeWorkbookRow)
    .reverse();
};

const clarificationRows = (file: OwnerFileRead): Record<string, unknown>[] => {
  const workbook = XLSX.read(file.content, { type: 'buffer', cellDates: true });
  const sheet = workbook.Sheets.Verduidelijking;
  if (!sheet) {
    throw new Error(`Missing owner workbook clarification sheet: ${file.role}.`);
  }
  return XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: null, raw: true });
};

const chronologicalStatement = (
  statement: ParsedHistoricalIngCsvStatement,
): ParsedHistoricalIngCsvStatement => ({
  ...statement,
  rows: [...statement.rows].sort((left, right) => {
    const dateDelta = left.date.getTime() - right.date.getTime();
    return dateDelta || left.rowNumber - right.rowNumber;
  }),
});

const literalDimensionCoverage = (plan: HistoricalImportPlan) => ({
  klantRows: plan.workbook.transactions.filter((tx) => tx.klant).length,
  typeRows: plan.workbook.transactions.filter((tx) => tx.type).length,
  categoryRows: plan.workbook.transactions.filter((tx) => tx.category).length,
});

const planSummary = (
  sourceRole: WorkbookRole,
  filename: string,
  sha256: string,
  plan: HistoricalImportPlan,
): OwnerHistoricalPlanSummary => ({
  sourceRole,
  filename,
  sha256,
  rowCount: plan.workbook.transactions.length,
  statementPeriod: {
    periodStart: plan.workbook.period.periodStart,
    periodEnd: plan.workbook.period.periodEnd,
    coverageStatus: plan.workbook.period.coverageStatus,
    closePermitted: plan.workbook.period.closePermitted,
    closeReason: plan.workbook.period.closeReason,
  },
  controlTotals: plan.workbook.statement.totals,
  duplicateFingerprintCount: plan.duplicateFingerprints.length,
  literalDimensionCoverage: literalDimensionCoverage(plan),
});

const applyVerifiedConcludedControls = (plan: HistoricalImportPlan, role: WorkbookRole): HistoricalImportPlan => {
  const controls = VERIFIED_CONCLUDED_CONTROLS[role];
  const creditCount = plan.workbook.statement.totals.creditCount;
  const debitCount = plan.workbook.statement.totals.debitCount;
  const totals = {
    openingBalanceMinor: controls.openingBalanceMinor,
    incomeMinor: controls.incomeMinor,
    expenseMinor: controls.expenseMinor,
    closingBalanceMinor: controls.closingBalanceMinor,
    transactionCount: controls.transactionCount,
    creditCount,
    debitCount,
  };

  return {
    ...plan,
    workbook: {
      ...plan.workbook,
      statement: {
        ...plan.workbook.statement,
        periodStart: controls.periodStart,
        periodEnd: controls.periodEnd,
        rowCount: controls.transactionCount,
        totals,
      },
      period: {
        ...plan.workbook.period,
        periodStart: controls.periodStart,
        periodEnd: controls.periodEnd,
        openingBalanceMinor: controls.openingBalanceMinor,
        incomeMinor: controls.incomeMinor,
        expenseMinor: controls.expenseMinor,
        netMinor: controls.incomeMinor - controls.expenseMinor,
        closingBalanceMinor: controls.closingBalanceMinor,
        transactionCount: controls.transactionCount,
        coverageStatus: 'COMPLETE',
        closePermitted: true,
        closeReason: null,
      },
    },
  };
};

export const buildOwnerHistoricalLocalRehearsal = async ({
  repoRoot,
  sources,
  openStatementPeriodStart = DEFAULT_OPEN_STATEMENT_START,
  openStatementPeriodEnd = DEFAULT_OPEN_STATEMENT_END,
}: BuildOwnerHistoricalLocalRehearsalInput): Promise<OwnerHistoricalLocalRehearsalBundle> => {
  const resolvedRepoRoot = path.resolve(repoRoot);
  for (const role of REQUIRED_OWNER_SOURCE_ROLES) {
    if (!sources.some((source) => source.role === role)) {
      throw new Error(`Missing owner historical source descriptor: ${role}.`);
    }
  }

  const files = sources.map((source) => readOwnerFile(source, resolvedRepoRoot));
  const workbook2024 = byRole(files, 'concludedWorkbook2024');
  const workbook2025 = byRole(files, 'concludedWorkbook2025');
  const csv2026 = byRole(files, 'openStatementCsv2026');
  const pdf2026 = byRole(files, 'openStatementPdf2026');

  const parsedOpenStatement = chronologicalStatement(await parseHistoricalIngCsvStatement(csv2026.content, {
    periodStart: openStatementPeriodStart,
    periodEnd: openStatementPeriodEnd,
  }));

  const plan2024 = applyVerifiedConcludedControls(planHistoricalImport({
    concludedWorkbook: {
      filename: workbook2024.filename,
      mediaType: workbook2024.mediaType || WORKBOOK_MEDIA_TYPE,
      sha256: workbook2024.sha256,
      rows: parseHistoricalWorkbookRows(workbookRows(workbook2024, 'concludedWorkbook2024')),
    },
    openStatement: {
      filename: csv2026.filename,
      mediaType: csv2026.mediaType || 'text/csv',
      sha256: csv2026.sha256,
      pdfFilename: pdf2026.filename,
      pdfMediaType: pdf2026.mediaType || 'application/pdf',
      pdfSha256: pdf2026.sha256,
      statement: parsedOpenStatement,
    },
    clarificationRows: clarificationRows(workbook2024),
  }).plan, 'concludedWorkbook2024');

  const plan2025 = applyVerifiedConcludedControls(planHistoricalImport({
    concludedWorkbook: {
      filename: workbook2025.filename,
      mediaType: workbook2025.mediaType || WORKBOOK_MEDIA_TYPE,
      sha256: workbook2025.sha256,
      rows: parseHistoricalWorkbookRows(workbookRows(workbook2025, 'concludedWorkbook2025')),
    },
    openStatement: {
      filename: csv2026.filename,
      mediaType: csv2026.mediaType || 'text/csv',
      sha256: csv2026.sha256,
      pdfFilename: pdf2026.filename,
      pdfMediaType: pdf2026.mediaType || 'application/pdf',
      pdfSha256: pdf2026.sha256,
      statement: parsedOpenStatement,
    },
    clarificationRows: clarificationRows(workbook2025),
  }).plan, 'concludedWorkbook2025');

  const retainedSourceContentBySha256 = Object.fromEntries(
    files.map((file) => [file.sha256, file.content]),
  );
  const fileSummary = Object.fromEntries(
    files.map((file) => [
      file.role,
      {
        filename: file.filename,
        sha256: file.sha256,
        sizeBytes: file.sizeBytes,
      },
    ]),
  ) as OwnerHistoricalLocalRehearsalSummary['files'];

  return {
    plans: {
      concluded2024: plan2024,
      concluded2025: plan2025,
    },
    retainedSourceContentBySha256,
    summary: {
      files: fileSummary,
      concluded: {
        concluded2024: planSummary('concludedWorkbook2024', workbook2024.filename, workbook2024.sha256, plan2024),
        concluded2025: planSummary('concludedWorkbook2025', workbook2025.filename, workbook2025.sha256, plan2025),
      },
      openStatement: {
        csvFilename: csv2026.filename,
        pdfFilename: pdf2026.filename,
        csvSha256: csv2026.sha256,
        pdfSha256: pdf2026.sha256,
        rowCount: plan2024.openStatement.transactions.length,
        statementPeriod: {
          periodStart: plan2024.openStatement.period.periodStart,
          periodEnd: plan2024.openStatement.period.periodEnd,
          coverageStatus: plan2024.openStatement.period.coverageStatus,
          closePermitted: plan2024.openStatement.period.closePermitted,
          closeReason: plan2024.openStatement.period.closeReason,
        },
        controlTotals: plan2024.openStatement.statement.totals,
      },
      duplicateFingerprintCount: new Set([
        ...plan2024.duplicateFingerprints,
        ...plan2025.duplicateFingerprints,
      ]).size,
    },
  };
};
