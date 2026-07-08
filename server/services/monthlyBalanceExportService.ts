import { ReportLineKind } from '@prisma/client';
import { hashEvidence } from './reviewDecisionService';
import {
  generateHtmlArtifact,
  generatePdfArtifact,
  generateXlsxArtifact,
  sha256OfBuffer,
  type ArtifactSnapshotInput,
} from './reportArtifactService';
import type { ReportLineInput } from './periodCloseService';
import type {
  MonthlyReconciliationLine,
  MonthlyReconciliationResult,
} from './monthlyReconciliationService';

export class MonthlyBalanceExportError extends Error {
  statusCode: number;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = 'MonthlyBalanceExportError';
    this.statusCode = statusCode;
  }
}

export type MonthlyBalanceExportInput = {
  reconciliation: MonthlyReconciliationResult;
  generatedBy: string;
  generatedAt?: Date;
};

export type MonthlyBalanceExportStatus = 'FINAL' | 'DRAFT';

export type MonthlyBalanceExportResult = {
  status: MonthlyBalanceExportStatus;
  statusLabel: string;
  reason: string | null;
  snapshot: ArtifactSnapshotInput;
  html: Buffer;
  xlsx: Buffer;
  pdf: Buffer;
  artifacts: {
    htmlSha256: string;
    xlsxSha256: string;
    pdfSha256: string;
  };
  validatorVersion: string;
};

const toReportLine = (
  line: MonthlyReconciliationLine,
  lineKind: ReportLineKind,
): ReportLineInput => {
  if (lineKind === ReportLineKind.REPORTING_CLASS) {
    return {
      lineKind,
      reportingClass: line.groupKey,
      literalProjectLabel: line.literalProjectLabel,
      literalTypeLabel: line.literalTypeLabel,
      literalCategoryLabel: line.literalCategoryLabel,
      direction: line.direction,
      amountMinor: BigInt(line.amountMinor),
      transactionCount: line.transactionCount,
      sortOrder: line.sortOrder,
    };
  }

  return {
    lineKind,
    projectId: line.projectId ?? undefined,
    transactionTypeId: line.transactionTypeId ?? undefined,
    categoryId: line.categoryId ?? undefined,
    literalProjectLabel: line.literalProjectLabel,
    literalTypeLabel: line.literalTypeLabel,
    literalCategoryLabel: line.literalCategoryLabel,
    direction: line.direction,
    amountMinor: BigInt(line.amountMinor),
    transactionCount: line.transactionCount,
    sortOrder: line.sortOrder,
  };
};

const buildSnapshotHash = (input: MonthlyBalanceExportInput): string =>
  hashEvidence({
    workspaceId: input.reconciliation.workspaceId,
    accountId: input.reconciliation.accountId,
    year: input.reconciliation.year,
    month: input.reconciliation.month,
    status: input.reconciliation.status,
    closingBalanceMinor: input.reconciliation.closingBalanceMinor,
    transactionCount: input.reconciliation.transactionCount,
    validatorVersion: input.reconciliation.validatorVersion,
    sourceFileHashes: input.reconciliation.sourceFileHashes,
  });

export const buildMonthlyBalanceExportPreview = (
  input: MonthlyBalanceExportInput,
): Omit<MonthlyBalanceExportResult, 'pdf' | 'artifacts'> => {
  if (!input.generatedBy) {
    throw new MonthlyBalanceExportError('Aanmaker ontbreekt.');
  }

  const reconciliation = input.reconciliation;
  const status: MonthlyBalanceExportStatus = reconciliation.closeEligible ? 'FINAL' : 'DRAFT';
  const statusLabel = reconciliation.closeEligible ? 'FINAL' : 'DRAFT / NOT CLOSED';
  const reason = reconciliation.closeEligible ? null : reconciliation.reasons.join('; ');
  const generatedAt = input.generatedAt ?? new Date();
  const snapshotHash = buildSnapshotHash(input);

  const snapshot: ArtifactSnapshotInput = {
    snapshotId: `monthly-balance-${reconciliation.year}-${String(reconciliation.month).padStart(2, '0')}-${reconciliation.accountId}`,
    snapshotHash,
    kind: 'MONTHLY',
    year: reconciliation.year,
    month: reconciliation.month,
    statusLabel,
    openingBalanceMinor: reconciliation.openingBalanceMinor,
    incomeMinor: reconciliation.incomeMinor,
    expenseMinor: reconciliation.expenseMinor,
    netMinor: reconciliation.netMinor,
    closingBalanceMinor: reconciliation.closingBalanceMinor,
    transactionCount: reconciliation.transactionCount,
    generatedBy: input.generatedBy,
    generatedAt,
    lines: [
      ...reconciliation.categoryLines.map((line) => toReportLine(line, ReportLineKind.CATEGORY)),
      ...reconciliation.subcategoryLines.map((line) => toReportLine(line, ReportLineKind.REPORTING_CLASS)),
    ],
  };

  return {
    status,
    statusLabel,
    reason,
    snapshot,
    html: generateHtmlArtifact(snapshot),
    xlsx: generateXlsxArtifact(snapshot),
    validatorVersion: reconciliation.validatorVersion,
  };
};

export const buildMonthlyBalanceExportArtifacts = async (
  input: MonthlyBalanceExportInput,
): Promise<MonthlyBalanceExportResult> => {
  const base = buildMonthlyBalanceExportPreview(input);
  const pdf = await generatePdfArtifact(base.snapshot);

  return {
    ...base,
    pdf,
    artifacts: {
      htmlSha256: sha256OfBuffer(base.html),
      xlsxSha256: sha256OfBuffer(base.xlsx),
      pdfSha256: sha256OfBuffer(pdf),
    },
  };
};
