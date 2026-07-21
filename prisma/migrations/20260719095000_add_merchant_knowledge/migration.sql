-- CreateEnum
CREATE TYPE "MerchantStatus" AS ENUM ('PROPOSED', 'ACTIVE', 'CONFLICTED', 'MERGED', 'DEPRECATED');

-- CreateEnum
CREATE TYPE "MerchantKnowledgeSignalType" AS ENUM ('IBAN', 'CREDITOR_IDENTIFIER', 'CARD_DESCRIPTOR', 'APPROVED_ALIAS', 'NORMALIZED_COUNTERPARTY', 'PAYMENT_PURPOSE', 'RECURRING_PATTERN');

-- CreateEnum
CREATE TYPE "MerchantAliasStatus" AS ENUM ('OBSERVED', 'PROPOSED', 'APPROVED', 'TRUSTED', 'DEPRECATED', 'REJECTED');

-- CreateEnum
CREATE TYPE "MerchantFingerprintStatus" AS ENUM ('OBSERVED', 'MATCHED', 'CONFLICTED', 'DEPRECATED');

-- CreateEnum
CREATE TYPE "MerchantFingerprintStrength" AS ENUM ('STRONG', 'MEDIUM', 'WEAK');

-- CreateEnum
CREATE TYPE "MerchantResolutionStatus" AS ENUM ('RESOLVED', 'CONFLICTED', 'ABSTAINED');

-- CreateEnum
CREATE TYPE "MerchantConflictStatus" AS ENUM ('OPEN', 'RESOLVED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "MerchantIdentityDecisionAction" AS ENUM ('CREATE_MERCHANT', 'MERGE_MERCHANTS', 'SPLIT_MERCHANT', 'ASSIGN_ALIAS', 'REASSIGN_ALIAS', 'DEPRECATE_ALIAS', 'DEPRECATE_MERCHANT', 'RESOLVE_CONFLICT');

-- CreateEnum
CREATE TYPE "MerchantBackfillRunStatus" AS ENUM ('PLANNED', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateTable
CREATE TABLE "Merchant" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "canonicalName" TEXT NOT NULL,
    "normalizedCanonicalName" TEXT NOT NULL,
    "status" "MerchantStatus" NOT NULL DEFAULT 'PROPOSED',
    "mergedIntoMerchantId" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deprecatedAt" TIMESTAMP(3),
    CONSTRAINT "Merchant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MerchantAlias" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "merchantId" TEXT,
    "sourceTransactionId" TEXT,
    "signalType" "MerchantKnowledgeSignalType" NOT NULL,
    "normalizedValue" TEXT NOT NULL,
    "valueHash" TEXT NOT NULL,
    "status" "MerchantAliasStatus" NOT NULL DEFAULT 'OBSERVED',
    "confidenceBasisPoints" INTEGER,
    "normalizationVersion" TEXT NOT NULL,
    "evidenceHash" TEXT NOT NULL,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deprecatedAt" TIMESTAMP(3),
    CONSTRAINT "MerchantAlias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MerchantFingerprint" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "merchantId" TEXT,
    "sourceTransactionId" TEXT NOT NULL,
    "signalType" "MerchantKnowledgeSignalType" NOT NULL,
    "normalizedValue" TEXT,
    "valueHash" TEXT NOT NULL,
    "status" "MerchantFingerprintStatus" NOT NULL DEFAULT 'OBSERVED',
    "strength" "MerchantFingerprintStrength" NOT NULL,
    "extractionVersion" TEXT NOT NULL,
    "evidenceHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deprecatedAt" TIMESTAMP(3),
    CONSTRAINT "MerchantFingerprint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MerchantResolution" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "merchantId" TEXT,
    "status" "MerchantResolutionStatus" NOT NULL,
    "engineVersion" TEXT NOT NULL,
    "inputHash" TEXT NOT NULL,
    "evidence" JSONB NOT NULL,
    "evidenceHash" TEXT NOT NULL,
    "confidenceBasisPoints" INTEGER,
    "abstentionCode" TEXT,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validUntil" TIMESTAMP(3),
    "backfillRunId" TEXT,
    CONSTRAINT "MerchantResolution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MerchantConflict" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "resolutionId" TEXT,
    "conflictKey" TEXT NOT NULL,
    "status" "MerchantConflictStatus" NOT NULL DEFAULT 'OPEN',
    "candidateMerchantIds" JSONB NOT NULL,
    "supportingSignals" JSONB NOT NULL,
    "conflictingSignals" JSONB NOT NULL,
    "evidenceHash" TEXT NOT NULL,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "resolvedById" TEXT,
    "resolutionReason" TEXT,
    CONSTRAINT "MerchantConflict_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MerchantIdentityDecision" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "action" "MerchantIdentityDecisionAction" NOT NULL,
    "sourceMerchantId" TEXT,
    "targetMerchantId" TEXT,
    "aliasId" TEXT,
    "fingerprintId" TEXT,
    "conflictId" TEXT,
    "actorId" TEXT,
    "reason" TEXT NOT NULL,
    "beforeState" JSONB NOT NULL,
    "afterState" JSONB NOT NULL,
    "evidence" JSONB NOT NULL,
    "evidenceHash" TEXT NOT NULL,
    "decisionVersion" TEXT NOT NULL,
    "decidedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MerchantIdentityDecision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MerchantAuditEvent" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "actorId" TEXT,
    "requestId" TEXT,
    "beforeState" JSONB NOT NULL,
    "afterState" JSONB NOT NULL,
    "evidenceHash" TEXT NOT NULL,
    "schemaVersion" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MerchantAuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MerchantBackfillRun" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "runKey" TEXT NOT NULL,
    "status" "MerchantBackfillRunStatus" NOT NULL DEFAULT 'PLANNED',
    "dryRun" BOOLEAN NOT NULL DEFAULT true,
    "sourceSnapshotHash" TEXT NOT NULL,
    "engineVersion" TEXT NOT NULL,
    "parameters" JSONB NOT NULL,
    "summary" JSONB NOT NULL,
    "createdById" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MerchantBackfillRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MerchantBackfillResult" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "proposedMerchantId" TEXT,
    "resolutionStatus" "MerchantResolutionStatus" NOT NULL,
    "matchedSignalType" "MerchantKnowledgeSignalType",
    "knownMerchant" BOOLEAN NOT NULL,
    "aliasConsolidated" BOOLEAN NOT NULL DEFAULT false,
    "fingerprintCollision" BOOLEAN NOT NULL DEFAULT false,
    "conflictDetected" BOOLEAN NOT NULL DEFAULT false,
    "retrievalAnchorReady" BOOLEAN NOT NULL DEFAULT false,
    "correctionReusable" BOOLEAN NOT NULL DEFAULT false,
    "evidence" JSONB NOT NULL,
    "evidenceHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MerchantBackfillResult_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Merchant_workspaceId_status_normalizedCanonicalName_idx" ON "Merchant"("workspaceId", "status", "normalizedCanonicalName");
CREATE INDEX "Merchant_workspaceId_mergedIntoMerchantId_idx" ON "Merchant"("workspaceId", "mergedIntoMerchantId");
CREATE INDEX "MerchantAlias_workspaceId_signalType_normalizedValue_status_idx" ON "MerchantAlias"("workspaceId", "signalType", "normalizedValue", "status");
CREATE INDEX "MerchantAlias_workspaceId_merchantId_status_idx" ON "MerchantAlias"("workspaceId", "merchantId", "status");
CREATE INDEX "MerchantAlias_sourceTransactionId_idx" ON "MerchantAlias"("sourceTransactionId");
CREATE INDEX "MerchantAlias_valueHash_idx" ON "MerchantAlias"("valueHash");
CREATE UNIQUE INDEX "MerchantFingerprint_workspaceId_sourceTransactionId_signalT_key" ON "MerchantFingerprint"("workspaceId", "sourceTransactionId", "signalType", "extractionVersion", "valueHash");
CREATE INDEX "MerchantFingerprint_workspaceId_signalType_valueHash_status_idx" ON "MerchantFingerprint"("workspaceId", "signalType", "valueHash", "status");
CREATE INDEX "MerchantFingerprint_workspaceId_merchantId_status_idx" ON "MerchantFingerprint"("workspaceId", "merchantId", "status");
CREATE INDEX "MerchantFingerprint_sourceTransactionId_idx" ON "MerchantFingerprint"("sourceTransactionId");
CREATE UNIQUE INDEX "MerchantResolution_workspaceId_transactionId_engineVersion__key" ON "MerchantResolution"("workspaceId", "transactionId", "engineVersion", "inputHash");
CREATE INDEX "MerchantResolution_workspaceId_transactionId_generatedAt_idx" ON "MerchantResolution"("workspaceId", "transactionId", "generatedAt");
CREATE INDEX "MerchantResolution_workspaceId_merchantId_status_generatedA_idx" ON "MerchantResolution"("workspaceId", "merchantId", "status", "generatedAt");
CREATE INDEX "MerchantResolution_backfillRunId_idx" ON "MerchantResolution"("backfillRunId");
CREATE INDEX "MerchantConflict_workspaceId_status_openedAt_idx" ON "MerchantConflict"("workspaceId", "status", "openedAt");
CREATE INDEX "MerchantConflict_workspaceId_transactionId_status_idx" ON "MerchantConflict"("workspaceId", "transactionId", "status");
CREATE INDEX "MerchantConflict_resolutionId_idx" ON "MerchantConflict"("resolutionId");
CREATE INDEX "MerchantIdentityDecision_workspaceId_action_decidedAt_idx" ON "MerchantIdentityDecision"("workspaceId", "action", "decidedAt");
CREATE INDEX "MerchantIdentityDecision_sourceMerchantId_idx" ON "MerchantIdentityDecision"("sourceMerchantId");
CREATE INDEX "MerchantIdentityDecision_targetMerchantId_idx" ON "MerchantIdentityDecision"("targetMerchantId");
CREATE INDEX "MerchantIdentityDecision_conflictId_idx" ON "MerchantIdentityDecision"("conflictId");
CREATE INDEX "MerchantAuditEvent_workspaceId_entityType_entityId_createdA_idx" ON "MerchantAuditEvent"("workspaceId", "entityType", "entityId", "createdAt");
CREATE INDEX "MerchantAuditEvent_workspaceId_actorId_createdAt_idx" ON "MerchantAuditEvent"("workspaceId", "actorId", "createdAt");
CREATE INDEX "MerchantAuditEvent_requestId_idx" ON "MerchantAuditEvent"("requestId");
CREATE UNIQUE INDEX "MerchantBackfillRun_workspaceId_runKey_key" ON "MerchantBackfillRun"("workspaceId", "runKey");
CREATE INDEX "MerchantBackfillRun_workspaceId_status_createdAt_idx" ON "MerchantBackfillRun"("workspaceId", "status", "createdAt");
CREATE UNIQUE INDEX "MerchantBackfillResult_runId_transactionId_key" ON "MerchantBackfillResult"("runId", "transactionId");
CREATE INDEX "MerchantBackfillResult_workspaceId_resolutionStatus_knownMe_idx" ON "MerchantBackfillResult"("workspaceId", "resolutionStatus", "knownMerchant");
CREATE INDEX "MerchantBackfillResult_workspaceId_conflictDetected_fingerp_idx" ON "MerchantBackfillResult"("workspaceId", "conflictDetected", "fingerprintCollision");
CREATE INDEX "MerchantBackfillResult_workspaceId_retrievalAnchorReady_idx" ON "MerchantBackfillResult"("workspaceId", "retrievalAnchorReady");
CREATE INDEX "MerchantBackfillResult_proposedMerchantId_idx" ON "MerchantBackfillResult"("proposedMerchantId");

-- PostgreSQL partial uniqueness not expressible in Prisma schema
CREATE UNIQUE INDEX "MerchantAlias_active_workspace_signal_value_key"
ON "MerchantAlias"("workspaceId", "signalType", "valueHash")
WHERE "status" IN ('APPROVED', 'TRUSTED') AND "deprecatedAt" IS NULL;

CREATE UNIQUE INDEX "MerchantFingerprint_active_strong_workspace_signal_value_key"
ON "MerchantFingerprint"("workspaceId", "signalType", "valueHash")
WHERE "status" = 'MATCHED' AND "strength" = 'STRONG' AND "deprecatedAt" IS NULL;

CREATE UNIQUE INDEX "MerchantConflict_open_workspace_transaction_key"
ON "MerchantConflict"("workspaceId", "transactionId", "conflictKey")
WHERE "status" = 'OPEN';

-- AddForeignKey
ALTER TABLE "Merchant" ADD CONSTRAINT "Merchant_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "FinanceWorkspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Merchant" ADD CONSTRAINT "Merchant_mergedIntoMerchantId_fkey" FOREIGN KEY ("mergedIntoMerchantId") REFERENCES "Merchant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Merchant" ADD CONSTRAINT "Merchant_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Merchant" ADD CONSTRAINT "Merchant_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MerchantAlias" ADD CONSTRAINT "MerchantAlias_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "FinanceWorkspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MerchantAlias" ADD CONSTRAINT "MerchantAlias_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MerchantAlias" ADD CONSTRAINT "MerchantAlias_sourceTransactionId_fkey" FOREIGN KEY ("sourceTransactionId") REFERENCES "Transaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MerchantAlias" ADD CONSTRAINT "MerchantAlias_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MerchantFingerprint" ADD CONSTRAINT "MerchantFingerprint_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "FinanceWorkspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MerchantFingerprint" ADD CONSTRAINT "MerchantFingerprint_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MerchantFingerprint" ADD CONSTRAINT "MerchantFingerprint_sourceTransactionId_fkey" FOREIGN KEY ("sourceTransactionId") REFERENCES "Transaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MerchantResolution" ADD CONSTRAINT "MerchantResolution_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "FinanceWorkspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MerchantResolution" ADD CONSTRAINT "MerchantResolution_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MerchantResolution" ADD CONSTRAINT "MerchantResolution_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MerchantResolution" ADD CONSTRAINT "MerchantResolution_backfillRunId_fkey" FOREIGN KEY ("backfillRunId") REFERENCES "MerchantBackfillRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MerchantConflict" ADD CONSTRAINT "MerchantConflict_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "FinanceWorkspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MerchantConflict" ADD CONSTRAINT "MerchantConflict_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MerchantConflict" ADD CONSTRAINT "MerchantConflict_resolutionId_fkey" FOREIGN KEY ("resolutionId") REFERENCES "MerchantResolution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MerchantConflict" ADD CONSTRAINT "MerchantConflict_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MerchantIdentityDecision" ADD CONSTRAINT "MerchantIdentityDecision_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "FinanceWorkspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MerchantIdentityDecision" ADD CONSTRAINT "MerchantIdentityDecision_sourceMerchantId_fkey" FOREIGN KEY ("sourceMerchantId") REFERENCES "Merchant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MerchantIdentityDecision" ADD CONSTRAINT "MerchantIdentityDecision_targetMerchantId_fkey" FOREIGN KEY ("targetMerchantId") REFERENCES "Merchant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MerchantIdentityDecision" ADD CONSTRAINT "MerchantIdentityDecision_aliasId_fkey" FOREIGN KEY ("aliasId") REFERENCES "MerchantAlias"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MerchantIdentityDecision" ADD CONSTRAINT "MerchantIdentityDecision_fingerprintId_fkey" FOREIGN KEY ("fingerprintId") REFERENCES "MerchantFingerprint"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MerchantIdentityDecision" ADD CONSTRAINT "MerchantIdentityDecision_conflictId_fkey" FOREIGN KEY ("conflictId") REFERENCES "MerchantConflict"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MerchantIdentityDecision" ADD CONSTRAINT "MerchantIdentityDecision_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MerchantAuditEvent" ADD CONSTRAINT "MerchantAuditEvent_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "FinanceWorkspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MerchantAuditEvent" ADD CONSTRAINT "MerchantAuditEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MerchantBackfillRun" ADD CONSTRAINT "MerchantBackfillRun_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "FinanceWorkspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MerchantBackfillRun" ADD CONSTRAINT "MerchantBackfillRun_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MerchantBackfillResult" ADD CONSTRAINT "MerchantBackfillResult_runId_fkey" FOREIGN KEY ("runId") REFERENCES "MerchantBackfillRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MerchantBackfillResult" ADD CONSTRAINT "MerchantBackfillResult_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "FinanceWorkspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MerchantBackfillResult" ADD CONSTRAINT "MerchantBackfillResult_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MerchantBackfillResult" ADD CONSTRAINT "MerchantBackfillResult_proposedMerchantId_fkey" FOREIGN KEY ("proposedMerchantId") REFERENCES "Merchant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
