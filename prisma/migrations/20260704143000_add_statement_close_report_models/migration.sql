-- Add MODEL-004 statement controls and MODEL-005 close/report records.
-- Additive only: no existing table, column, enum, or data is removed or rewritten.

CREATE TYPE "StatementCoverageStatus" AS ENUM ('COMPLETE', 'PARTIAL');
CREATE TYPE "PeriodCloseStatus" AS ENUM ('CLOSED', 'REOPENED', 'SUPERSEDED');
CREATE TYPE "ReportKind" AS ENUM ('MONTHLY', 'YEARLY');
CREATE TYPE "ReportLineKind" AS ENUM ('PROJECT', 'TRANSACTION_TYPE', 'CATEGORY', 'REPORTING_CLASS', 'TOTAL');
CREATE TYPE "ReportArtifactFormat" AS ENUM ('HTML', 'XLSX', 'PDF');
CREATE TYPE "DispatchStatus" AS ENUM ('PENDING', 'SENT', 'FAILED');

CREATE TABLE "SourceFile" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mediaType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "content" BYTEA NOT NULL,
    "uploadedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SourceFile_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BankStatement" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "sourceFileId" TEXT NOT NULL,
    "supportingPdfFileId" TEXT,
    "importBatchId" TEXT,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "coverageStatus" "StatementCoverageStatus" NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "openingBalanceMinor" BIGINT NOT NULL,
    "incomeMinor" BIGINT NOT NULL,
    "expenseMinor" BIGINT NOT NULL,
    "netMinor" BIGINT NOT NULL,
    "closingBalanceMinor" BIGINT NOT NULL,
    "transactionCount" INTEGER NOT NULL,
    "bankAccountIdentifier" TEXT NOT NULL,
    "acceptedBy" TEXT,
    "acceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BankStatement_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StatementPeriod" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "statementId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "coverageStatus" "StatementCoverageStatus" NOT NULL,
    "openingBalanceMinor" BIGINT NOT NULL,
    "incomeMinor" BIGINT NOT NULL,
    "expenseMinor" BIGINT NOT NULL,
    "netMinor" BIGINT NOT NULL,
    "closingBalanceMinor" BIGINT NOT NULL,
    "transactionCount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StatementPeriod_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PeriodClose" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "ledgerId" TEXT NOT NULL,
    "statementId" TEXT NOT NULL,
    "statementPeriodId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "status" "PeriodCloseStatus" NOT NULL DEFAULT 'CLOSED',
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "openingBalanceMinor" BIGINT NOT NULL,
    "incomeMinor" BIGINT NOT NULL,
    "expenseMinor" BIGINT NOT NULL,
    "netMinor" BIGINT NOT NULL,
    "closingBalanceMinor" BIGINT NOT NULL,
    "transactionCount" INTEGER NOT NULL,
    "classificationHash" TEXT NOT NULL,
    "sourceDataHash" TEXT NOT NULL,
    "closedBy" TEXT NOT NULL,
    "closedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reopenedBy" TEXT,
    "reopenedAt" TIMESTAMP(3),
    "reopenReason" TEXT,
    "reconciliationEvidence" JSONB NOT NULL,

    CONSTRAINT "PeriodClose_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ReportSnapshot" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "kind" "ReportKind" NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER,
    "version" INTEGER NOT NULL,
    "openingBalanceMinor" BIGINT NOT NULL,
    "incomeMinor" BIGINT NOT NULL,
    "expenseMinor" BIGINT NOT NULL,
    "netMinor" BIGINT NOT NULL,
    "closingBalanceMinor" BIGINT NOT NULL,
    "transactionCount" INTEGER NOT NULL,
    "snapshotHash" TEXT NOT NULL,
    "generatedBy" TEXT NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReportSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ReportSnapshotPeriodClose" (
    "reportSnapshotId" TEXT NOT NULL,
    "periodCloseId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,

    CONSTRAINT "ReportSnapshotPeriodClose_pkey" PRIMARY KEY ("reportSnapshotId", "periodCloseId")
);

CREATE TABLE "ReportSnapshotLine" (
    "id" TEXT NOT NULL,
    "reportSnapshotId" TEXT NOT NULL,
    "lineKind" "ReportLineKind" NOT NULL,
    "projectId" TEXT,
    "transactionTypeId" TEXT,
    "categoryId" TEXT,
    "literalProjectLabel" TEXT,
    "literalTypeLabel" TEXT,
    "literalCategoryLabel" TEXT,
    "direction" "TransactionDirection",
    "reportingClass" TEXT,
    "amountMinor" BIGINT NOT NULL,
    "transactionCount" INTEGER NOT NULL,
    "sortOrder" INTEGER NOT NULL,

    CONSTRAINT "ReportSnapshotLine_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ReportArtifact" (
    "id" TEXT NOT NULL,
    "reportSnapshotId" TEXT NOT NULL,
    "format" "ReportArtifactFormat" NOT NULL,
    "filename" TEXT NOT NULL,
    "mediaType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "content" BYTEA NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReportArtifact_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ReportApproval" (
    "id" TEXT NOT NULL,
    "reportSnapshotId" TEXT NOT NULL,
    "approvedBy" TEXT NOT NULL,
    "approvedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "snapshotHash" TEXT NOT NULL,
    "revokedBy" TEXT,
    "revokedAt" TIMESTAMP(3),
    "revokeReason" TEXT,

    CONSTRAINT "ReportApproval_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ReportDispatch" (
    "id" TEXT NOT NULL,
    "reportSnapshotId" TEXT NOT NULL,
    "reportApprovalId" TEXT NOT NULL,
    "status" "DispatchStatus" NOT NULL DEFAULT 'PENDING',
    "fromAddress" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "recipientHash" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "providerMessageId" TEXT,
    "sentBy" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReportDispatch_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ReportDispatchRecipient" (
    "id" TEXT NOT NULL,
    "reportDispatchId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,

    CONSTRAINT "ReportDispatchRecipient_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SourceFile_workspaceId_sha256_key" ON "SourceFile"("workspaceId", "sha256");
CREATE INDEX "SourceFile_workspaceId_createdAt_idx" ON "SourceFile"("workspaceId", "createdAt");

CREATE UNIQUE INDEX "BankStatement_sourceFileId_key" ON "BankStatement"("sourceFileId");
CREATE UNIQUE INDEX "BankStatement_workspaceId_accountId_periodStart_periodEnd_key" ON "BankStatement"("workspaceId", "accountId", "periodStart", "periodEnd");
CREATE INDEX "BankStatement_workspaceId_accountId_periodStart_periodEnd_idx" ON "BankStatement"("workspaceId", "accountId", "periodStart", "periodEnd");
CREATE INDEX "BankStatement_importBatchId_idx" ON "BankStatement"("importBatchId");
CREATE INDEX "BankStatement_supportingPdfFileId_idx" ON "BankStatement"("supportingPdfFileId");

CREATE UNIQUE INDEX "StatementPeriod_statementId_accountId_periodStart_periodEnd_key" ON "StatementPeriod"("statementId", "accountId", "periodStart", "periodEnd");
CREATE INDEX "StatementPeriod_workspaceId_accountId_periodStart_periodEnd_idx" ON "StatementPeriod"("workspaceId", "accountId", "periodStart", "periodEnd");

CREATE UNIQUE INDEX "PeriodClose_ledgerId_version_key" ON "PeriodClose"("ledgerId", "version");
CREATE INDEX "PeriodClose_workspaceId_periodStart_periodEnd_status_idx" ON "PeriodClose"("workspaceId", "periodStart", "periodEnd", "status");
CREATE INDEX "PeriodClose_statementPeriodId_idx" ON "PeriodClose"("statementPeriodId");

CREATE UNIQUE INDEX "ReportSnapshot_workspaceId_kind_year_month_version_key" ON "ReportSnapshot"("workspaceId", "kind", "year", "month", "version");
CREATE INDEX "ReportSnapshot_workspaceId_kind_year_month_idx" ON "ReportSnapshot"("workspaceId", "kind", "year", "month");
CREATE INDEX "ReportSnapshot_snapshotHash_idx" ON "ReportSnapshot"("snapshotHash");

CREATE INDEX "ReportSnapshotPeriodClose_periodCloseId_idx" ON "ReportSnapshotPeriodClose"("periodCloseId");

CREATE INDEX "ReportSnapshotLine_reportSnapshotId_lineKind_sortOrder_idx" ON "ReportSnapshotLine"("reportSnapshotId", "lineKind", "sortOrder");
CREATE INDEX "ReportSnapshotLine_projectId_idx" ON "ReportSnapshotLine"("projectId");
CREATE INDEX "ReportSnapshotLine_transactionTypeId_idx" ON "ReportSnapshotLine"("transactionTypeId");
CREATE INDEX "ReportSnapshotLine_categoryId_idx" ON "ReportSnapshotLine"("categoryId");

CREATE UNIQUE INDEX "ReportArtifact_reportSnapshotId_format_key" ON "ReportArtifact"("reportSnapshotId", "format");
CREATE INDEX "ReportArtifact_sha256_idx" ON "ReportArtifact"("sha256");

CREATE UNIQUE INDEX "ReportApproval_reportSnapshotId_snapshotHash_key" ON "ReportApproval"("reportSnapshotId", "snapshotHash");
CREATE INDEX "ReportApproval_reportSnapshotId_approvedAt_idx" ON "ReportApproval"("reportSnapshotId", "approvedAt");

CREATE INDEX "ReportDispatch_reportSnapshotId_createdAt_idx" ON "ReportDispatch"("reportSnapshotId", "createdAt");
CREATE INDEX "ReportDispatch_reportApprovalId_idx" ON "ReportDispatch"("reportApprovalId");
CREATE INDEX "ReportDispatch_status_createdAt_idx" ON "ReportDispatch"("status", "createdAt");

CREATE INDEX "ReportDispatchRecipient_reportDispatchId_idx" ON "ReportDispatchRecipient"("reportDispatchId");

ALTER TABLE "SourceFile" ADD CONSTRAINT "SourceFile_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "FinanceWorkspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "BankStatement" ADD CONSTRAINT "BankStatement_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "FinanceWorkspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BankStatement" ADD CONSTRAINT "BankStatement_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BankStatement" ADD CONSTRAINT "BankStatement_sourceFileId_fkey" FOREIGN KEY ("sourceFileId") REFERENCES "SourceFile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BankStatement" ADD CONSTRAINT "BankStatement_supportingPdfFileId_fkey" FOREIGN KEY ("supportingPdfFileId") REFERENCES "SourceFile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BankStatement" ADD CONSTRAINT "BankStatement_importBatchId_fkey" FOREIGN KEY ("importBatchId") REFERENCES "ImportBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "StatementPeriod" ADD CONSTRAINT "StatementPeriod_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "FinanceWorkspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StatementPeriod" ADD CONSTRAINT "StatementPeriod_statementId_fkey" FOREIGN KEY ("statementId") REFERENCES "BankStatement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StatementPeriod" ADD CONSTRAINT "StatementPeriod_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PeriodClose" ADD CONSTRAINT "PeriodClose_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "FinanceWorkspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PeriodClose" ADD CONSTRAINT "PeriodClose_ledgerId_fkey" FOREIGN KEY ("ledgerId") REFERENCES "Ledger"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PeriodClose" ADD CONSTRAINT "PeriodClose_statementId_fkey" FOREIGN KEY ("statementId") REFERENCES "BankStatement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PeriodClose" ADD CONSTRAINT "PeriodClose_statementPeriodId_fkey" FOREIGN KEY ("statementPeriodId") REFERENCES "StatementPeriod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ReportSnapshot" ADD CONSTRAINT "ReportSnapshot_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "FinanceWorkspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ReportSnapshotPeriodClose" ADD CONSTRAINT "ReportSnapshotPeriodClose_reportSnapshotId_fkey" FOREIGN KEY ("reportSnapshotId") REFERENCES "ReportSnapshot"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReportSnapshotPeriodClose" ADD CONSTRAINT "ReportSnapshotPeriodClose_periodCloseId_fkey" FOREIGN KEY ("periodCloseId") REFERENCES "PeriodClose"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ReportSnapshotLine" ADD CONSTRAINT "ReportSnapshotLine_reportSnapshotId_fkey" FOREIGN KEY ("reportSnapshotId") REFERENCES "ReportSnapshot"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReportSnapshotLine" ADD CONSTRAINT "ReportSnapshotLine_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReportSnapshotLine" ADD CONSTRAINT "ReportSnapshotLine_transactionTypeId_fkey" FOREIGN KEY ("transactionTypeId") REFERENCES "TransactionType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReportSnapshotLine" ADD CONSTRAINT "ReportSnapshotLine_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ReportArtifact" ADD CONSTRAINT "ReportArtifact_reportSnapshotId_fkey" FOREIGN KEY ("reportSnapshotId") REFERENCES "ReportSnapshot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ReportApproval" ADD CONSTRAINT "ReportApproval_reportSnapshotId_fkey" FOREIGN KEY ("reportSnapshotId") REFERENCES "ReportSnapshot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ReportDispatch" ADD CONSTRAINT "ReportDispatch_reportSnapshotId_fkey" FOREIGN KEY ("reportSnapshotId") REFERENCES "ReportSnapshot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReportDispatch" ADD CONSTRAINT "ReportDispatch_reportApprovalId_fkey" FOREIGN KEY ("reportApprovalId") REFERENCES "ReportApproval"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ReportDispatchRecipient" ADD CONSTRAINT "ReportDispatchRecipient_reportDispatchId_fkey" FOREIGN KEY ("reportDispatchId") REFERENCES "ReportDispatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
