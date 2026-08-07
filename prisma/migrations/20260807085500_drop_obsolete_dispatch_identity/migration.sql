-- Remove the obsolete snapshot/recipient/content uniqueness rule.
-- Stable monthly delivery idempotency is enforced by ReportDispatch.deliveryKey.
-- IF EXISTS keeps this migration safe whether the earlier constraint succeeded or failed.
ALTER TABLE "ReportDispatch"
DROP CONSTRAINT IF EXISTS "ReportDispatch_unique_dispatch_identity";
