-- Additive ownership provenance for derived categorization suggestions.
-- Existing rows intentionally remain unowned (NULL) and are never backfilled here.
ALTER TABLE "CategorizationSuggestion"
  ADD COLUMN "producerKey" TEXT,
  ADD COLUMN "producerVersion" TEXT,
  ADD COLUMN "planHash" TEXT;

CREATE INDEX "CategorizationSuggestion_owner_lookup_idx"
  ON "CategorizationSuggestion"("workspaceId", "transactionId", "producerKey", "producerVersion", "status");

CREATE UNIQUE INDEX "CategorizationSuggestion_owner_evidence_key"
  ON "CategorizationSuggestion"("workspaceId", "transactionId", "producerKey", "producerVersion", "evidenceHash");
