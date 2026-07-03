-- Add importFingerprint column to transactions for canonical deduplication
ALTER TABLE "Transaction"
ADD COLUMN "importFingerprint" TEXT;

-- Ensure uniqueness per user + fingerprint (null values allowed for legacy rows)
CREATE UNIQUE INDEX "Transaction_userId_importFingerprint_key"
ON "Transaction"("userId", "importFingerprint");
