import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {
  buildOwnerHistoricalLocalRehearsal,
  type OwnerHistoricalLocalRehearsalSummary,
  type OwnerHistoricalOpenStatementSummary,
  type OwnerHistoricalPlanSummary,
} from '../../lib/import/historicalOwnerLocalRehearsal';
import {
  REQUIRED_OWNER_SOURCE_ROLES,
  type OwnerHistoricalSourceDescriptor,
  type OwnerHistoricalSourceRole,
} from '../../lib/import/historicalOwnerFileAdapter';
import type { HistoricalControlTotals } from '../../lib/import/historicalControls';

export type HistoricalOwnerImportRequestedMode = 'dry-run' | 'rehearsal' | 'production';
export type HistoricalOwnerImportCommandMode = 'dry-run' | 'rehearsal' | 'production-blocked';
export type HistoricalOwnerImportSourceAvailability = 'available' | 'missing' | 'invalid';
export type HistoricalOwnerImportDatabaseClassification = 'none' | 'local' | 'non-local' | 'forbidden';

export type HistoricalOwnerImportCommandInput = {
  repoRoot: string;
  sources?: OwnerHistoricalSourceDescriptor[];
  requestedMode?: HistoricalOwnerImportRequestedMode;
  databaseUrl?: string | null;
  productionOptionConfirmed?: boolean;
  dryRunSummaryAccepted?: boolean;
  operatorConfirmationToken?: string | null;
  productionConfirmationToken?: string | null;
};

export type SanitizedControlTotals = {
  openingBalanceMinor: string;
  incomeMinor: string;
  expenseMinor: string;
  netMinor: string;
  closingBalanceMinor: string;
  transactionCount: number;
  creditCount: number;
  debitCount: number;
};

export type SanitizedOwnerSourceFileSummary = {
  filename: string;
  sha256: string;
  sizeBytes: number;
};

export type SanitizedHistoricalStatementSummary = {
  filename: string;
  sha256: string;
  rowCount: number;
  coverageStatus: 'COMPLETE' | 'PARTIAL';
  closePermitted: boolean;
  closeReason: string | null;
  controlTotals: SanitizedControlTotals;
  duplicateFingerprintCount?: number;
  literalDimensionCoverage?: {
    klantRows: number;
    typeRows: number;
    categoryRows: number;
  };
};

export type SanitizedHistoricalOwnerImportSummary = {
  files: Record<OwnerHistoricalSourceRole, SanitizedOwnerSourceFileSummary>;
  concluded2024: SanitizedHistoricalStatementSummary;
  concluded2025: SanitizedHistoricalStatementSummary;
  openStatement: SanitizedHistoricalStatementSummary & {
    pdfFilename: string;
    pdfSha256: string;
  };
  duplicateFingerprintCount: number;
};

export type HistoricalOwnerImportDatabaseTarget = {
  classification: HistoricalOwnerImportDatabaseClassification;
  host: string | null;
  port: string | null;
  database: string | null;
  reason: string | null;
};

export type HistoricalOwnerImportConfirmationState = {
  productionOptionConfirmed: boolean;
  dryRunSummaryAccepted: boolean;
  operatorConfirmationRequired: boolean;
  operatorConfirmationValid: boolean;
  productionConfirmationRequired: boolean;
  productionConfirmationValid: boolean;
  expectedOperatorConfirmationToken: string;
  expectedProductionConfirmationToken: string | null;
};

export type HistoricalOwnerImportCommandResult = {
  mode: HistoricalOwnerImportCommandMode;
  requestedMode: HistoricalOwnerImportRequestedMode;
  defaultedToDryRun: boolean;
  writesDatabase: false;
  productionExecutionPerformed: false;
  sourceAvailability: HistoricalOwnerImportSourceAvailability;
  sourceInventory: Record<OwnerHistoricalSourceRole, SanitizedOwnerSourceFileSummary> | null;
  importPlanSummary: SanitizedHistoricalOwnerImportSummary | null;
  duplicateFingerprintCount: number | null;
  databaseTarget: HistoricalOwnerImportDatabaseTarget;
  confirmationState: HistoricalOwnerImportConfirmationState;
  executionBlockedReasons: string[];
};

export const DEFAULT_OWNER_HISTORICAL_SOURCES: OwnerHistoricalSourceDescriptor[] = [
  {
    role: 'concludedWorkbook2024',
    absolutePath: '/Users/Office/Documents/Church/Yeshua Academy/Administratie/2026/YA financieel jaar 2024.xlsx',
    expectedSha256: '844699610889c6986fec305cdbb7b760da3dfc1d556ab9d0e160c854e1bc7f9f',
    mediaType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  },
  {
    role: 'concludedWorkbook2025',
    absolutePath: '/Users/Office/Documents/Church/Yeshua Academy/Administratie/2026/YA financieel jaar 2025 v2.xlsx',
    expectedSha256: 'd3913b876f3a6b8ddc3d19c49ef9778125e5e109a7d3ac330afbb3d6d8d7b2ff',
    mediaType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  },
  {
    role: 'openStatementCsv2026',
    absolutePath: '/Users/Office/Documents/Church/Yeshua Academy/Administratie/2026/NL89INGB0006369960_2026-01-01_2026-07-01.csv',
    expectedSha256: '768912927a7bb3b545616631e6d5360479a90b0bc6448faa3f225925636d31d3',
    mediaType: 'text/csv',
  },
  {
    role: 'openStatementPdf2026',
    absolutePath: '/Users/Office/Documents/Church/Yeshua Academy/Administratie/2026/NL89INGB0006369960_2026-01-01_2026-07-01.pdf',
    expectedSha256: '5e830a365fe0d87f67e883f24239f60674ed85a174e65db6520136511a6d58d2',
    mediaType: 'application/pdf',
  },
];

const LOCAL_DATABASE_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);
const FORBIDDEN_DATABASE_HOSTS = new Set(['10.0.2.4']);
const OPERATOR_CONFIRMATION_TOKEN = 'I_UNDERSTAND_THIS_WOULD_IMPORT_OWNER_HISTORY';

const hashBuffer = (content: Buffer): string =>
  crypto.createHash('sha256').update(content).digest('hex');

const toSafeDatabaseHost = (host: string): string =>
  host.replace(/^\[/, '').replace(/\]$/, '');

const emptyFileSummary = (): Record<OwnerHistoricalSourceRole, SanitizedOwnerSourceFileSummary> =>
  Object.fromEntries(
    REQUIRED_OWNER_SOURCE_ROLES.map((role) => [role, { filename: '', sha256: '', sizeBytes: 0 }]),
  ) as Record<OwnerHistoricalSourceRole, SanitizedOwnerSourceFileSummary>;

const summarizeControlTotals = (totals: HistoricalControlTotals): SanitizedControlTotals => ({
  openingBalanceMinor: totals.openingBalanceMinor.toString(),
  incomeMinor: totals.incomeMinor.toString(),
  expenseMinor: totals.expenseMinor.toString(),
  netMinor: (totals.incomeMinor - totals.expenseMinor).toString(),
  closingBalanceMinor: totals.closingBalanceMinor.toString(),
  transactionCount: totals.transactionCount,
  creditCount: totals.creditCount,
  debitCount: totals.debitCount,
});

const summarizeConcludedPlan = (plan: OwnerHistoricalPlanSummary): SanitizedHistoricalStatementSummary => ({
  filename: plan.filename,
  sha256: plan.sha256,
  rowCount: plan.rowCount,
  coverageStatus: plan.statementPeriod.coverageStatus,
  closePermitted: plan.statementPeriod.closePermitted,
  closeReason: plan.statementPeriod.closeReason,
  controlTotals: summarizeControlTotals(plan.controlTotals),
  duplicateFingerprintCount: plan.duplicateFingerprintCount,
  literalDimensionCoverage: plan.literalDimensionCoverage,
});

const summarizeOpenStatement = (summary: OwnerHistoricalOpenStatementSummary) => ({
  filename: summary.csvFilename,
  sha256: summary.csvSha256,
  pdfFilename: summary.pdfFilename,
  pdfSha256: summary.pdfSha256,
  rowCount: summary.rowCount,
  coverageStatus: summary.statementPeriod.coverageStatus,
  closePermitted: summary.statementPeriod.closePermitted,
  closeReason: summary.statementPeriod.closeReason,
  controlTotals: summarizeControlTotals(summary.controlTotals),
});

const sanitizeOwnerSummary = (
  summary: OwnerHistoricalLocalRehearsalSummary,
): SanitizedHistoricalOwnerImportSummary => ({
  files: summary.files,
  concluded2024: summarizeConcludedPlan(summary.concluded.concluded2024),
  concluded2025: summarizeConcludedPlan(summary.concluded.concluded2025),
  openStatement: summarizeOpenStatement(summary.openStatement),
  duplicateFingerprintCount: summary.duplicateFingerprintCount,
});

export const classifyHistoricalOwnerImportDatabase = (
  databaseUrl?: string | null,
): HistoricalOwnerImportDatabaseTarget => {
  if (!databaseUrl) {
    return {
      classification: 'none',
      host: null,
      port: null,
      database: null,
      reason: 'No database URL was supplied.',
    };
  }

  try {
    const parsed = new URL(databaseUrl);
    const host = toSafeDatabaseHost(parsed.hostname);
    const database = parsed.pathname.replace(/^\//, '') || null;
    if (FORBIDDEN_DATABASE_HOSTS.has(host)) {
      return {
        classification: 'forbidden',
        host,
        port: parsed.port || null,
        database,
        reason: 'The database host is explicitly forbidden for historical owner import commands.',
      };
    }
    if (LOCAL_DATABASE_HOSTS.has(host)) {
      return {
        classification: 'local',
        host,
        port: parsed.port || null,
        database,
        reason: null,
      };
    }
    return {
      classification: 'non-local',
      host,
      port: parsed.port || null,
      database,
      reason: 'The database host is not local.',
    };
  } catch {
    return {
      classification: 'forbidden',
      host: null,
      port: null,
      database: null,
      reason: 'The database URL could not be parsed.',
    };
  }
};

const preflightSources = (sources: OwnerHistoricalSourceDescriptor[], repoRoot: string) => {
  const resolvedRepoRoot = path.resolve(repoRoot);
  const blockedReasons: string[] = [];
  const files = emptyFileSummary();

  for (const role of REQUIRED_OWNER_SOURCE_ROLES) {
    if (!sources.some((source) => source.role === role)) {
      blockedReasons.push(`Missing owner historical source descriptor: ${role}.`);
    }
  }

  for (const source of sources) {
    const absolutePath = path.resolve(source.absolutePath);
    if (!path.isAbsolute(source.absolutePath)) {
      blockedReasons.push(`Owner historical source path must be absolute: ${source.role}.`);
      continue;
    }
    if (absolutePath === resolvedRepoRoot || absolutePath.startsWith(`${resolvedRepoRoot}${path.sep}`)) {
      blockedReasons.push(`Owner historical source must stay outside the Git repository: ${source.role}.`);
      continue;
    }
    if (!fs.existsSync(absolutePath)) {
      blockedReasons.push(`Owner historical source file is missing: ${source.role}.`);
      continue;
    }
    const stat = fs.statSync(absolutePath);
    if (!stat.isFile()) {
      blockedReasons.push(`Owner historical source path must be a file: ${source.role}.`);
      continue;
    }
    const content = fs.readFileSync(absolutePath);
    const sha256 = hashBuffer(content);
    if (source.expectedSha256 && source.expectedSha256 !== sha256) {
      blockedReasons.push(`Owner historical source hash mismatch: ${source.role}.`);
      continue;
    }
    files[source.role] = {
      filename: path.basename(source.absolutePath),
      sha256,
      sizeBytes: content.byteLength,
    };
  }

  const missing = blockedReasons.some((reason) => reason.includes('is missing'));
  const sourceAvailability: HistoricalOwnerImportSourceAvailability =
    blockedReasons.length ? (missing ? 'missing' : 'invalid') : 'available';
  return {
    sourceAvailability,
    blockedReasons,
    files: blockedReasons.length ? null : files,
  };
};

const buildProductionConfirmationToken = (summary: SanitizedHistoricalOwnerImportSummary | null): string | null => {
  if (!summary) return null;
  const tokenBasis = [
    summary.files.concludedWorkbook2024.sha256,
    summary.files.concludedWorkbook2025.sha256,
    summary.files.openStatementCsv2026.sha256,
    summary.files.openStatementPdf2026.sha256,
    summary.concluded2024.rowCount,
    summary.concluded2025.rowCount,
    summary.openStatement.rowCount,
  ].join(':');
  const digest = crypto.createHash('sha256').update(tokenBasis).digest('hex').slice(0, 16).toUpperCase();
  return `CONFIRM_OWNER_HISTORY_${digest}`;
};

export const buildHistoricalOwnerImportCommand = async (
  input: HistoricalOwnerImportCommandInput,
): Promise<HistoricalOwnerImportCommandResult> => {
  const requestedMode = input.requestedMode ?? 'dry-run';
  const sources = input.sources ?? DEFAULT_OWNER_HISTORICAL_SOURCES;
  const databaseTarget = classifyHistoricalOwnerImportDatabase(input.databaseUrl);
  const preflight = preflightSources(sources, input.repoRoot);

  let importPlanSummary: SanitizedHistoricalOwnerImportSummary | null = null;
  let sourceInventory: Record<OwnerHistoricalSourceRole, SanitizedOwnerSourceFileSummary> | null = preflight.files;
  const executionBlockedReasons = [...preflight.blockedReasons];

  if (preflight.sourceAvailability === 'available') {
    const bundle = await buildOwnerHistoricalLocalRehearsal({
      repoRoot: input.repoRoot,
      sources,
    });
    importPlanSummary = sanitizeOwnerSummary(bundle.summary);
    sourceInventory = importPlanSummary.files;
  }

  if (databaseTarget.classification === 'forbidden') {
    executionBlockedReasons.push(databaseTarget.reason ?? 'The database target is forbidden.');
  }

  if (requestedMode === 'rehearsal') {
    if (databaseTarget.classification === 'none') {
      executionBlockedReasons.push('Rehearsal mode requires an explicit local disposable database URL.');
    } else if (databaseTarget.classification !== 'local') {
      executionBlockedReasons.push('Rehearsal mode only allows localhost, 127.0.0.1, or ::1 database targets.');
    }
  }

  const expectedProductionConfirmationToken = buildProductionConfirmationToken(importPlanSummary);
  const operatorConfirmationValid = input.operatorConfirmationToken === OPERATOR_CONFIRMATION_TOKEN;
  const productionConfirmationValid =
    Boolean(expectedProductionConfirmationToken) &&
    input.productionConfirmationToken === expectedProductionConfirmationToken;

  if (requestedMode === 'production') {
    if (!input.productionOptionConfirmed) {
      executionBlockedReasons.push('Production mode requires an explicit production command option.');
    }
    if (!input.dryRunSummaryAccepted) {
      executionBlockedReasons.push('Production mode requires a reviewed dry-run summary.');
    }
    if (!operatorConfirmationValid) {
      executionBlockedReasons.push('Production mode requires the operator confirmation token.');
    }
    if (!productionConfirmationValid) {
      executionBlockedReasons.push('Production mode requires the source-bound production confirmation token.');
    }
    executionBlockedReasons.push('Production execution is intentionally blocked in Packet G.');
  }

  return {
    mode: requestedMode === 'production' ? 'production-blocked' : requestedMode,
    requestedMode,
    defaultedToDryRun: input.requestedMode == null,
    writesDatabase: false,
    productionExecutionPerformed: false,
    sourceAvailability: preflight.sourceAvailability,
    sourceInventory,
    importPlanSummary,
    duplicateFingerprintCount: importPlanSummary?.duplicateFingerprintCount ?? null,
    databaseTarget,
    confirmationState: {
      productionOptionConfirmed: input.productionOptionConfirmed === true,
      dryRunSummaryAccepted: input.dryRunSummaryAccepted === true,
      operatorConfirmationRequired: requestedMode === 'production',
      operatorConfirmationValid,
      productionConfirmationRequired: requestedMode === 'production',
      productionConfirmationValid,
      expectedOperatorConfirmationToken: OPERATOR_CONFIRMATION_TOKEN,
      expectedProductionConfirmationToken,
    },
    executionBlockedReasons,
  };
};
