-- Add direction field to TransactionType as the typed enum (not raw TEXT)
ALTER TABLE "TransactionType" ADD COLUMN "direction" "TransactionDirection";

-- Remove the legacy global unique constraint on Category.name.
-- The workspace-scoped compound index (Category_workspaceId_name_key) remains
-- and provides the correct per-workspace uniqueness guarantee.
DROP INDEX IF EXISTS "Category_name_key";
