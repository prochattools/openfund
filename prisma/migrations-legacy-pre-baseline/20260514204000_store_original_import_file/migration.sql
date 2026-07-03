-- Store original imported ING files on the import batch.
-- Monthly ING CSV exports are small enough for database retention and auditability.

ALTER TABLE "ImportBatch"
  ADD COLUMN IF NOT EXISTS "fileSizeBytes" INTEGER,
  ADD COLUMN IF NOT EXISTS "fileSha256" TEXT,
  ADD COLUMN IF NOT EXISTS "originalFile" BYTEA;

CREATE INDEX IF NOT EXISTS "ImportBatch_userId_fileSha256_idx" ON "ImportBatch"("userId", "fileSha256");
