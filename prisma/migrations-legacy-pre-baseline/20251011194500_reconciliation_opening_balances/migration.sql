-- Add reconciliation fields to ledger
ALTER TABLE "Ledger"
  ADD COLUMN "lockedAt" TIMESTAMP(3),
  ADD COLUMN "lockedBy" TEXT,
  ADD COLUMN "lockNote" TEXT;

-- Create OpeningBalance table
CREATE TABLE "OpeningBalance" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "effectiveDate" TIMESTAMP(3) NOT NULL,
    "amountMinor" BIGINT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "note" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lockedAt" TIMESTAMP(3),
    "lockedBy" TEXT,

    CONSTRAINT "OpeningBalance_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OpeningBalance_accountId_effectiveDate_key" ON "OpeningBalance"("accountId", "effectiveDate");
CREATE INDEX "OpeningBalance_accountId_effectiveDate_idx" ON "OpeningBalance"("accountId", "effectiveDate");

ALTER TABLE "OpeningBalance"
  ADD CONSTRAINT "OpeningBalance_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
