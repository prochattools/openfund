-- Add deliveryKey column for stable dispatch idempotency.
-- The delivery key uniquely identifies a report dispatch intent (workspace, period, recipients)
-- and remains the same across snapshot regenerations.
-- This enables true idempotency: same month + same recipients + same evidence = same dispatch.

-- Step 1: Add nullable deliveryKey column
ALTER TABLE "ReportDispatch" ADD COLUMN "deliveryKey" TEXT;

-- Step 2: Backfill existing records with synthetic keys to maintain uniqueness
-- For backward compatibility, use sha256(reportSnapshotId || ':' || recipientHash || ':' || contentHash)
-- This preserves the old constraint semantics while preparing for the new column.
UPDATE "ReportDispatch"
SET "deliveryKey" = encode(
  sha256(("reportSnapshotId" || ':' || "recipientHash" || ':' || "contentHash")::bytea),
  'hex'
)
WHERE "deliveryKey" IS NULL;

-- Step 3: Make column NOT NULL after backfill
ALTER TABLE "ReportDispatch" ALTER COLUMN "deliveryKey" SET NOT NULL;

-- Step 4: Add unique constraint on deliveryKey (the new primary idempotency key)
CREATE UNIQUE INDEX "ReportDispatch_deliveryKey_key" ON "ReportDispatch"("deliveryKey");

-- Note: The old constraint @@unique([reportSnapshotId, recipientHash, contentHash])
-- is retained as a secondary invariant. It still prevents bugs where the same snapshot
-- sends to the same recipients with identical content twice. It costs only index space
-- and provides defense-in-depth.
