CREATE TABLE "LedgerLock" (
    "id" TEXT NOT NULL,
    "ledgerId" TEXT NOT NULL,
    "lockedAt" TIMESTAMP(3) NOT NULL,
    "lockedBy" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LedgerLock_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "LedgerLock_ledgerId_key" ON "LedgerLock"("ledgerId");

ALTER TABLE "LedgerLock"
  ADD CONSTRAINT "LedgerLock_ledgerId_fkey" FOREIGN KEY ("ledgerId") REFERENCES "Ledger"("id") ON DELETE CASCADE ON UPDATE CASCADE;
