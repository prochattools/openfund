-- MODEL-003 Packet A: add immutable classification record persistence.
-- This migration is additive: it does not change existing transaction classification behavior.

-- CreateEnum
CREATE TYPE "BookingSource" AS ENUM ('HISTORICAL', 'RULE', 'MANUAL');

-- CreateEnum
CREATE TYPE "SuggestionConfidence" AS ENUM ('EXACT_FALLBACK', 'FUZZY', 'OVERALL', 'DEFAULT');

-- CreateEnum
CREATE TYPE "SuggestionMatcher" AS ENUM ('NORMALIZED_HISTORY', 'FUZZY_HISTORY', 'BEST_HISTORY', 'DIRECTION_DEFAULT', 'RULE_CANDIDATE');

-- CreateEnum
CREATE TYPE "SuggestionStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "ReviewDecisionAction" AS ENUM ('ACCEPT_SUGGESTION', 'ASSIGN_MANUALLY', 'CHANGE_BOOKING', 'REMOVE_BOOKING');

-- CreateTable
CREATE TABLE "TransactionBooking" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "transactionTypeId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "source" "BookingSource" NOT NULL,
    "ruleId" TEXT,
    "historicalSourceTransactionId" TEXT,
    "historicalMatchKey" TEXT,
    "evidence" JSONB NOT NULL,
    "evidenceHash" TEXT NOT NULL,
    "confirmedBy" TEXT,
    "confirmedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "literalProjectLabel" TEXT NOT NULL,
    "literalTypeLabel" TEXT NOT NULL,
    "literalCategoryLabel" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TransactionBooking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CategorizationSuggestion" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "projectId" TEXT,
    "transactionTypeId" TEXT,
    "categoryId" TEXT,
    "confidence" "SuggestionConfidence" NOT NULL,
    "matcher" "SuggestionMatcher" NOT NULL,
    "rank" INTEGER NOT NULL,
    "scoreBasisPoints" INTEGER,
    "evidence" JSONB NOT NULL,
    "evidenceHash" TEXT NOT NULL,
    "status" "SuggestionStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "CategorizationSuggestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReviewDecision" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "suggestionId" TEXT,
    "action" "ReviewDecisionAction" NOT NULL,
    "beforeBookingId" TEXT,
    "beforeProjectId" TEXT,
    "beforeTypeId" TEXT,
    "beforeCategoryId" TEXT,
    "afterBookingId" TEXT,
    "afterProjectId" TEXT,
    "afterTypeId" TEXT,
    "afterCategoryId" TEXT,
    "actorId" TEXT NOT NULL,
    "actorEmail" TEXT,
    "reason" TEXT,
    "evidence" JSONB NOT NULL,
    "evidenceHash" TEXT NOT NULL,
    "decidedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReviewDecision_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TransactionBooking_transactionId_key" ON "TransactionBooking"("transactionId");
CREATE INDEX "TransactionBooking_workspaceId_source_confirmedAt_idx" ON "TransactionBooking"("workspaceId", "source", "confirmedAt");
CREATE INDEX "TransactionBooking_projectId_idx" ON "TransactionBooking"("projectId");
CREATE INDEX "TransactionBooking_transactionTypeId_idx" ON "TransactionBooking"("transactionTypeId");
CREATE INDEX "TransactionBooking_categoryId_idx" ON "TransactionBooking"("categoryId");
CREATE INDEX "TransactionBooking_ruleId_idx" ON "TransactionBooking"("ruleId");
CREATE INDEX "TransactionBooking_historicalSourceTransactionId_idx" ON "TransactionBooking"("historicalSourceTransactionId");
CREATE INDEX "TransactionBooking_transactionId_evidenceHash_idx" ON "TransactionBooking"("transactionId", "evidenceHash");

CREATE INDEX "CategorizationSuggestion_workspaceId_transactionId_status_r_idx" ON "CategorizationSuggestion"("workspaceId", "transactionId", "status", "rank");
CREATE INDEX "CategorizationSuggestion_workspaceId_status_createdAt_idx" ON "CategorizationSuggestion"("workspaceId", "status", "createdAt");
CREATE INDEX "CategorizationSuggestion_transactionId_status_idx" ON "CategorizationSuggestion"("transactionId", "status");
CREATE INDEX "CategorizationSuggestion_categoryId_idx" ON "CategorizationSuggestion"("categoryId");
CREATE INDEX "CategorizationSuggestion_projectId_idx" ON "CategorizationSuggestion"("projectId");
CREATE INDEX "CategorizationSuggestion_transactionTypeId_idx" ON "CategorizationSuggestion"("transactionTypeId");
CREATE INDEX "CategorizationSuggestion_transactionId_matcher_evidenceHash_idx" ON "CategorizationSuggestion"("transactionId", "matcher", "evidenceHash");

CREATE INDEX "ReviewDecision_workspaceId_transactionId_decidedAt_idx" ON "ReviewDecision"("workspaceId", "transactionId", "decidedAt");
CREATE INDEX "ReviewDecision_workspaceId_actorId_decidedAt_idx" ON "ReviewDecision"("workspaceId", "actorId", "decidedAt");
CREATE INDEX "ReviewDecision_workspaceId_action_decidedAt_idx" ON "ReviewDecision"("workspaceId", "action", "decidedAt");
CREATE INDEX "ReviewDecision_suggestionId_idx" ON "ReviewDecision"("suggestionId");
CREATE INDEX "ReviewDecision_beforeBookingId_idx" ON "ReviewDecision"("beforeBookingId");
CREATE INDEX "ReviewDecision_afterBookingId_idx" ON "ReviewDecision"("afterBookingId");

-- AddForeignKey
ALTER TABLE "TransactionBooking" ADD CONSTRAINT "TransactionBooking_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "FinanceWorkspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TransactionBooking" ADD CONSTRAINT "TransactionBooking_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TransactionBooking" ADD CONSTRAINT "TransactionBooking_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TransactionBooking" ADD CONSTRAINT "TransactionBooking_transactionTypeId_fkey" FOREIGN KEY ("transactionTypeId") REFERENCES "TransactionType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TransactionBooking" ADD CONSTRAINT "TransactionBooking_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TransactionBooking" ADD CONSTRAINT "TransactionBooking_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "CategorizationRule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TransactionBooking" ADD CONSTRAINT "TransactionBooking_historicalSourceTransactionId_fkey" FOREIGN KEY ("historicalSourceTransactionId") REFERENCES "Transaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CategorizationSuggestion" ADD CONSTRAINT "CategorizationSuggestion_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "FinanceWorkspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CategorizationSuggestion" ADD CONSTRAINT "CategorizationSuggestion_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CategorizationSuggestion" ADD CONSTRAINT "CategorizationSuggestion_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CategorizationSuggestion" ADD CONSTRAINT "CategorizationSuggestion_transactionTypeId_fkey" FOREIGN KEY ("transactionTypeId") REFERENCES "TransactionType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CategorizationSuggestion" ADD CONSTRAINT "CategorizationSuggestion_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ReviewDecision" ADD CONSTRAINT "ReviewDecision_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "FinanceWorkspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReviewDecision" ADD CONSTRAINT "ReviewDecision_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReviewDecision" ADD CONSTRAINT "ReviewDecision_suggestionId_fkey" FOREIGN KEY ("suggestionId") REFERENCES "CategorizationSuggestion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReviewDecision" ADD CONSTRAINT "ReviewDecision_beforeBookingId_fkey" FOREIGN KEY ("beforeBookingId") REFERENCES "TransactionBooking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReviewDecision" ADD CONSTRAINT "ReviewDecision_beforeProjectId_fkey" FOREIGN KEY ("beforeProjectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReviewDecision" ADD CONSTRAINT "ReviewDecision_beforeTypeId_fkey" FOREIGN KEY ("beforeTypeId") REFERENCES "TransactionType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReviewDecision" ADD CONSTRAINT "ReviewDecision_beforeCategoryId_fkey" FOREIGN KEY ("beforeCategoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReviewDecision" ADD CONSTRAINT "ReviewDecision_afterBookingId_fkey" FOREIGN KEY ("afterBookingId") REFERENCES "TransactionBooking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReviewDecision" ADD CONSTRAINT "ReviewDecision_afterProjectId_fkey" FOREIGN KEY ("afterProjectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReviewDecision" ADD CONSTRAINT "ReviewDecision_afterTypeId_fkey" FOREIGN KEY ("afterTypeId") REFERENCES "TransactionType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReviewDecision" ADD CONSTRAINT "ReviewDecision_afterCategoryId_fkey" FOREIGN KEY ("afterCategoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
