-- Create new enums
CREATE TYPE "TransactionDirection" AS ENUM ('credit', 'debit');
CREATE TYPE "ImportBatchStatus" AS ENUM ('pending', 'completed', 'failed');

-- Create Account table
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- Create ImportBatch table
CREATE TABLE "ImportBatch" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "fileType" TEXT,
    "status" "ImportBatchStatus" NOT NULL DEFAULT 'pending',
    "totalRows" INTEGER NOT NULL DEFAULT 0,
    "importedRows" INTEGER NOT NULL DEFAULT 0,
    "duplicateRows" INTEGER NOT NULL DEFAULT 0,
    "errorRows" INTEGER NOT NULL DEFAULT 0,
    "autoCategorizedRows" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImportBatch_pkey" PRIMARY KEY ("id")
);

-- Extend Transaction table
ALTER TABLE "Transaction"
    ADD COLUMN "accountId" TEXT,
    ADD COLUMN "importBatchId" TEXT,
    ADD COLUMN "amountMinor" BIGINT,
    ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'EUR',
    ADD COLUMN "direction" "TransactionDirection" NOT NULL DEFAULT 'credit',
    ADD COLUMN "counterparty" TEXT,
    ADD COLUMN "reference" TEXT,
    ADD COLUMN "hash" TEXT,
    ADD COLUMN "sourceFile" TEXT,
    ADD COLUMN "rawRow" JSONB,
    ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Populate amountMinor, direction, hash for existing rows
UPDATE "Transaction"
SET
    "amountMinor" = ROUND("amount" * 100)::BIGINT,
    "direction" = CASE WHEN "amount" >= 0 THEN 'credit'::"TransactionDirection" ELSE 'debit'::"TransactionDirection" END,
    "hash" = md5(
        concat_ws(
            '|',
            "userId",
            to_char(("date" AT TIME ZONE 'UTC'), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
            coalesce("normalizedKey", ''),
            ROUND("amount" * 100)::TEXT
        )
    ),
    "updatedAt" = COALESCE("updatedAt", CURRENT_TIMESTAMP);

-- Ensure new columns are not null where required
ALTER TABLE "Transaction"
    ALTER COLUMN "amountMinor" SET NOT NULL,
    ALTER COLUMN "hash" SET NOT NULL;

-- Drop old indexes relying on amount float
DROP INDEX IF EXISTS "Transaction_userId_normalizedKey_amount_idx";
DROP INDEX IF EXISTS "Transaction_userId_date_amount_normalizedKey_key";

-- Remove legacy amount column
ALTER TABLE "Transaction" DROP COLUMN IF EXISTS "amount";

-- Create new indexes and constraints
CREATE UNIQUE INDEX "Account_userId_identifier_key" ON "Account"("userId", "identifier");
CREATE INDEX "Account_userId_idx" ON "Account"("userId");

CREATE INDEX "ImportBatch_userId_startedAt_idx" ON "ImportBatch"("userId", "startedAt");

CREATE UNIQUE INDEX "Transaction_hash_key" ON "Transaction"("hash");
CREATE INDEX "Transaction_userId_normalizedKey_amountMinor_idx" ON "Transaction"("userId", "normalizedKey", "amountMinor");
CREATE INDEX "Transaction_userId_accountId_date_idx" ON "Transaction"("userId", "accountId", "date");

-- Add foreign keys
ALTER TABLE "Account"
    ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ImportBatch"
    ADD CONSTRAINT "ImportBatch_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Transaction"
    ADD CONSTRAINT "Transaction_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    ADD CONSTRAINT "Transaction_importBatchId_fkey" FOREIGN KEY ("importBatchId") REFERENCES "ImportBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
