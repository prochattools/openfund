-- Add duplicate-send protection: ensure each dispatch identity (snapshot + recipients + content) is unique
ALTER TABLE "ReportDispatch" ADD CONSTRAINT "ReportDispatch_unique_dispatch_identity" UNIQUE ("reportSnapshotId", "recipientHash", "contentHash");
