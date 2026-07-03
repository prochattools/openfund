-- Create enums
CREATE TYPE "RuleMatchType" AS ENUM ('regex', 'contains', 'startsWith', 'endsWith');
CREATE TYPE "RuleMatchField" AS ENUM ('description', 'counterparty', 'reference', 'source');
CREATE TYPE "TransactionClassificationSource" AS ENUM ('none', 'rule', 'history', 'import', 'manual');

-- Alter Transaction table
ALTER TABLE "Transaction"
  ADD COLUMN "classificationSource" "TransactionClassificationSource" NOT NULL DEFAULT 'none',
  ADD COLUMN "classificationRuleId" TEXT;
CREATE INDEX "Transaction_classificationRuleId_idx" ON "Transaction"("classificationRuleId");

-- Create CategorizationRule table
CREATE TABLE "CategorizationRule" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "importBatchId" TEXT,
    "ledgerId" TEXT,
    "categoryId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "pattern" TEXT NOT NULL,
    "matchType" "RuleMatchType" NOT NULL DEFAULT 'regex',
    "matchField" "RuleMatchField" NOT NULL DEFAULT 'description',
    "priority" INTEGER NOT NULL DEFAULT 100,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastMatchedAt" TIMESTAMP(3),

    CONSTRAINT "CategorizationRule_pkey" PRIMARY KEY ("id")
);

-- Indexes for CategorizationRule
CREATE INDEX "CategorizationRule_userId_isActive_priority_idx" ON "CategorizationRule"("userId", "isActive", "priority");
CREATE INDEX "CategorizationRule_ledgerId_idx" ON "CategorizationRule"("ledgerId");

-- Add foreign keys
ALTER TABLE "Transaction"
  ADD CONSTRAINT "Transaction_classificationRuleId_fkey" FOREIGN KEY ("classificationRuleId") REFERENCES "CategorizationRule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CategorizationRule"
  ADD CONSTRAINT "CategorizationRule_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "CategorizationRule_importBatchId_fkey" FOREIGN KEY ("importBatchId") REFERENCES "ImportBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "CategorizationRule_ledgerId_fkey" FOREIGN KEY ("ledgerId") REFERENCES "Ledger"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "CategorizationRule_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Update updatedAt to use trigger-compatible default
ALTER TABLE "CategorizationRule"
  ALTER COLUMN "updatedAt" DROP DEFAULT;
