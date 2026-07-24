# Yeshua Academy Finance — Merchant Knowledge Schema and Migration Proposal

Status: APPROVED  
Owner: merchant-domain and data owners  
Canonical for: Program Phase 3.2 additive schema and migration design  
Last reviewed: 2026-07-18  
Depends on: `docs/architecture/MERCHANT_KNOWLEDGE_ARCHITECTURE.md`, `docs/architecture/ARCHITECTURAL_INVARIANTS.md`, `prisma/schema.prisma`  
Related documents: `docs/IMPLEMENTATION_PLAN.md`, `docs/ACCOUNTING_INTEGRITY_AND_REVIEW_PREFILL.md`, `docs/finance-rebuild-run.md`

## Implementation status

This document is an implementation-ready proposal only. It does not modify `prisma/schema.prisma`, create or apply a migration, write merchant knowledge, alter transactions, alter bookings, alter review decisions, or introduce services, APIs, UI, Bedrock, or AI inference.

## Source-grounded constraints

The current repository uses PostgreSQL through Prisma, UUID string primary keys, explicit workspace relations for modern financial models, `onDelete: Restrict` for accounting and evidence records, additive SQL migrations, static schema/migration guards, and optional disposable local PostgreSQL replay tests. The active chain is a normalized baseline followed by additive workspace, classification, and statement/report migrations.

Current contracts that must remain unchanged:

- `Transaction` retains immutable imported facts and import-deduplication fingerprints.
- `TransactionBooking` remains the only confirmed accounting classification.
- `CategorizationSuggestion` remains unconfirmed suggestion evidence.
- `ReviewDecision` remains the audited human confirmation/correction record.
- Merchant knowledge must not contain project, transaction-type, or category defaults that could be mistaken for accounting truth.

## Resolved Phase 3.1 design decisions

### 1. Audit persistence

**Decision:** introduce a dedicated append-only `MerchantAuditEvent` model.

The current `AuditLog` is user-scoped and generic. Extending it with merchant-specific workspace semantics would mix legacy ownership with a new workspace-scoped domain. `MerchantAuditEvent` therefore owns merchant provenance and references `FinanceWorkspace` directly. Optional actor linkage uses `onDelete: SetNull`, while actor display/reference data needed for historical interpretation is retained in the event payload.

### 2. Resolution persistence

**Decision:** persist immutable historical `MerchantResolution` rows; derive the current result by querying the latest valid row for `(workspaceId, transactionId)`.

No mutable current-result pointer is proposed initially. This avoids synchronization and deletion hazards while preserving reproducibility across engine versions. An idempotency key prevents duplicate rows for the same transaction facts and engine input.

### 3. Alias privacy

**Decision:** do not persist unrestricted raw alias examples by default.

Persist:

- normalized value required for deterministic matching;
- SHA-256 `valueHash` for evidence identity;
- source transaction relation when available;
- optional redacted display sample only when explicitly approved later.

The initial proposal excludes full raw descriptors, payment purposes, card numbers, and bank payload copies from alias tables. Original values remain on the immutable transaction/raw-row source under existing retention rules.

### 4. Stable source identifiers

Current support:

- **IBAN/account identifier:** usable when extracted from `Transaction.rawRow` by `transactionSuggestionFacts`; must be normalized and masked in presentation.
- **Normalized counterparty:** available from `Transaction.counterparty`.
- **Payment purpose:** available when extracted from `rawRow`; may be absent by import format.
- **Recurring pattern:** derivable from workspace-scoped transaction dates, direction, account, merchant candidate, and bounded amount behavior.

Not yet consistently available as first-class parsed fields:

- creditor identifier;
- stable card/payment descriptor identifier.

The schema supports those signal types, but Phase 3.3 extraction must abstain when the current import does not expose a reliable value. Description or amount similarity alone cannot create trusted merchant identity.

### 5. PostgreSQL uniqueness

**Decision:** use ordinary Prisma indexes for lookup and raw SQL partial unique indexes for active/trusted state constraints.

Prisma schema declarations cannot express all required conditional uniqueness. The later SQL migration must create:

```sql
CREATE UNIQUE INDEX "MerchantAlias_workspace_type_value_active_key"
ON "MerchantAlias" ("workspaceId", "signalType", "normalizedValue")
WHERE "status" IN ('APPROVED', 'TRUSTED');

CREATE UNIQUE INDEX "MerchantFingerprint_workspace_type_hash_active_key"
ON "MerchantFingerprint" ("workspaceId", "signalType", "valueHash")
WHERE "status" = 'MATCHED' AND "strength" = 'STRONG';

CREATE UNIQUE INDEX "MerchantConflict_workspace_transaction_key_open_key"
ON "MerchantConflict" ("workspaceId", "transactionId", "conflictKey")
WHERE "status" = 'OPEN';
```

Merged, deprecated, rejected, and historical rows remain auditable and do not block a later valid active mapping. Static tests must assert these raw SQL indexes because Prisma `@@unique` cannot represent their predicates.

### 6. Merchant-maintenance UI

**Decision:** initial schema supports future UI evidence and audit needs but contains no UI-specific presentation state.

The schema includes reason, evidence, actor, status, and timestamps needed for an individual administrator workflow. Saved filters, table preferences, bulk operations, drafts, and display-only fields are excluded.

## Proposed enums

```prisma
enum MerchantStatus {
  PROPOSED
  ACTIVE
  CONFLICTED
  MERGED
  DEPRECATED
}

enum MerchantKnowledgeSignalType {
  IBAN
  CREDITOR_IDENTIFIER
  CARD_DESCRIPTOR
  APPROVED_ALIAS
  NORMALIZED_COUNTERPARTY
  PAYMENT_PURPOSE
  RECURRING_PATTERN
}

enum MerchantAliasStatus {
  OBSERVED
  PROPOSED
  APPROVED
  TRUSTED
  DEPRECATED
  REJECTED
}

enum MerchantFingerprintStatus {
  OBSERVED
  MATCHED
  CONFLICTED
  DEPRECATED
}

enum MerchantFingerprintStrength {
  STRONG
  MEDIUM
  WEAK
}

enum MerchantResolutionStatus {
  RESOLVED
  CONFLICTED
  ABSTAINED
}

enum MerchantConflictStatus {
  OPEN
  RESOLVED
  DISMISSED
}

enum MerchantIdentityDecisionAction {
  CREATE_MERCHANT
  MERGE_MERCHANTS
  SPLIT_MERCHANT
  ASSIGN_ALIAS
  REASSIGN_ALIAS
  DEPRECATE_ALIAS
  DEPRECATE_MERCHANT
  RESOLVE_CONFLICT
}

enum MerchantBackfillRunStatus {
  PLANNED
  RUNNING
  COMPLETED
  FAILED
  CANCELLED
}
```

## Proposed models

The following is exact conceptual Prisma design. Relation collection names on existing models may be adjusted during Phase 3.3 only to satisfy Prisma relation naming, without changing the contract.

### Merchant

```prisma
model Merchant {
  id                      String         @id @default(uuid())
  workspaceId             String
  canonicalName           String
  normalizedCanonicalName String
  status                  MerchantStatus @default(PROPOSED)
  mergedIntoMerchantId    String?
  version                 Int            @default(1)
  createdById             String?
  updatedById             String?
  createdAt               DateTime       @default(now())
  updatedAt               DateTime       @default(now()) @updatedAt
  deprecatedAt            DateTime?

  workspace               FinanceWorkspace @relation(fields: [workspaceId], references: [id], onDelete: Restrict)
  mergedIntoMerchant      Merchant?        @relation("MerchantMergeTarget", fields: [mergedIntoMerchantId], references: [id], onDelete: Restrict)
  mergedSourceMerchants   Merchant[]        @relation("MerchantMergeTarget")
  createdBy               User?             @relation("MerchantCreatedBy", fields: [createdById], references: [id], onDelete: SetNull)
  updatedBy               User?             @relation("MerchantUpdatedBy", fields: [updatedById], references: [id], onDelete: SetNull)
  aliases                 MerchantAlias[]
  fingerprints            MerchantFingerprint[]
  resolutions             MerchantResolution[]

  @@index([workspaceId, status, normalizedCanonicalName])
  @@index([workspaceId, mergedIntoMerchantId])
}
```

- **Mutable:** display name, status, merge target, version, update actor.
- **Immutable:** ID, workspace, creation provenance.
- **Delete behavior:** no hard delete in normal operations; use `MERGED` or `DEPRECATED`.
- **No accounting defaults:** no project/type/category fields.

### MerchantAlias

```prisma
model MerchantAlias {
  id                    String                    @id @default(uuid())
  workspaceId           String
  merchantId            String?
  sourceTransactionId   String?
  signalType            MerchantKnowledgeSignalType
  normalizedValue       String
  valueHash             String
  status                MerchantAliasStatus       @default(OBSERVED)
  confidenceBasisPoints Int?
  normalizationVersion  String
  evidenceHash          String
  approvedById          String?
  approvedAt            DateTime?
  createdAt             DateTime                  @default(now())
  updatedAt             DateTime                  @default(now()) @updatedAt
  deprecatedAt          DateTime?

  workspace             FinanceWorkspace @relation(fields: [workspaceId], references: [id], onDelete: Restrict)
  merchant              Merchant?        @relation(fields: [merchantId], references: [id], onDelete: Restrict)
  sourceTransaction     Transaction?     @relation(fields: [sourceTransactionId], references: [id], onDelete: Restrict)
  approvedBy            User?            @relation(fields: [approvedById], references: [id], onDelete: SetNull)

  @@index([workspaceId, signalType, normalizedValue, status])
  @@index([workspaceId, merchantId, status])
  @@index([sourceTransactionId])
  @@index([valueHash])
}
```

- `merchantId` is nullable while observed/proposed/conflicted.
- Full raw examples are excluded; traceability uses `sourceTransactionId` and `valueHash`.
- Partial SQL uniqueness governs approved/trusted aliases.

### MerchantFingerprint

```prisma
model MerchantFingerprint {
  id                   String                    @id @default(uuid())
  workspaceId          String
  merchantId           String?
  sourceTransactionId  String
  signalType           MerchantKnowledgeSignalType
  normalizedValue      String?
  valueHash            String
  status               MerchantFingerprintStatus @default(OBSERVED)
  strength             MerchantFingerprintStrength
  extractionVersion    String
  evidenceHash         String
  createdAt            DateTime                  @default(now())
  updatedAt            DateTime                  @default(now()) @updatedAt
  deprecatedAt         DateTime?

  workspace            FinanceWorkspace @relation(fields: [workspaceId], references: [id], onDelete: Restrict)
  merchant             Merchant?        @relation(fields: [merchantId], references: [id], onDelete: Restrict)
  sourceTransaction    Transaction      @relation(fields: [sourceTransactionId], references: [id], onDelete: Restrict)

  @@unique([workspaceId, sourceTransactionId, signalType, extractionVersion, valueHash])
  @@index([workspaceId, signalType, valueHash, status])
  @@index([workspaceId, merchantId, status])
  @@index([sourceTransactionId])
}
```

- `normalizedValue` may be null for privacy-sensitive signals when only the hash is required.
- Import `Transaction.importFingerprint` is never reused.
- Partial SQL uniqueness governs active strong matches.

### MerchantResolution

```prisma
model MerchantResolution {
  id                 String                   @id @default(uuid())
  workspaceId        String
  transactionId      String
  merchantId         String?
  status             MerchantResolutionStatus
  engineVersion      String
  inputHash          String
  evidence           Json
  evidenceHash       String
  confidenceBasisPoints Int?
  abstentionCode     String?
  generatedAt        DateTime                 @default(now())
  validUntil         DateTime?
  backfillRunId      String?

  workspace          FinanceWorkspace      @relation(fields: [workspaceId], references: [id], onDelete: Restrict)
  transaction        Transaction           @relation(fields: [transactionId], references: [id], onDelete: Restrict)
  merchant           Merchant?             @relation(fields: [merchantId], references: [id], onDelete: Restrict)
  backfillRun        MerchantBackfillRun?  @relation(fields: [backfillRunId], references: [id], onDelete: Restrict)

  @@unique([workspaceId, transactionId, engineVersion, inputHash])
  @@index([workspaceId, transactionId, generatedAt])
  @@index([workspaceId, merchantId, status, generatedAt])
  @@index([backfillRunId])
}
```

- Append-only historical outcomes.
- Current resolution is the latest non-expired row for the transaction and approved engine policy.
- `merchantId` is required only for `RESOLVED`; service validation enforces status consistency.

### MerchantConflict

```prisma
model MerchantConflict {
  id                  String                 @id @default(uuid())
  workspaceId         String
  transactionId       String
  resolutionId        String?
  conflictKey         String
  status              MerchantConflictStatus @default(OPEN)
  candidateMerchantIds Json
  supportingSignals   Json
  conflictingSignals  Json
  evidenceHash        String
  openedAt            DateTime               @default(now())
  resolvedAt          DateTime?
  resolvedById        String?
  resolutionReason    String?

  workspace           FinanceWorkspace   @relation(fields: [workspaceId], references: [id], onDelete: Restrict)
  transaction         Transaction        @relation(fields: [transactionId], references: [id], onDelete: Restrict)
  resolution          MerchantResolution? @relation(fields: [resolutionId], references: [id], onDelete: Restrict)
  resolvedBy          User?              @relation(fields: [resolvedById], references: [id], onDelete: SetNull)

  @@index([workspaceId, status, openedAt])
  @@index([workspaceId, transactionId, status])
  @@index([resolutionId])
}
```

- Open conflict forces merchant-resolution abstention.
- Partial SQL uniqueness prevents duplicate active conflict rows.

#### Administrator-confirmed conflict-resolution persistence

The following Phase 3.8D mapping is normative and requires no Prisma schema change.

Shared requirements:

- only `MerchantConflict.status = OPEN` may be confirmed;
- conflict state identity is a canonical SHA-256 hash over conflict/workspace/transaction IDs, status, ordered candidate merchant IDs, privacy-safe ordered supporting/conflicting signal identity, evidence hash, resolution ID, opened timestamp, and existing resolved actor/timestamp/reason fields;
- all candidate, signal, evidence, transaction, and workspace data is reloaded from authoritative persistence inside the transaction;
- every confirmed intent writes one `MerchantIdentityDecision` and one `MerchantAuditEvent` atomically with the conflict transition and any approved `MerchantResolution` row;
- historical `MerchantResolution`, conflict evidence, aliases, fingerprints, merchants, transactions, bookings, reviews, suggestions, ledger data, period state, and reports are never rewritten.

`SELECT_MERCHANT`:

- create one append-only `MerchantResolution`;
- `status = RESOLVED`;
- `merchantId = selectedMerchantId`;
- `engineVersion = merchant-admin-conflict-resolution-v1`;
- `inputHash = SHA-256(canonical JSON of { conflictStateHash, intent: SELECT_MERCHANT, selectedMerchantId, planVersion, planHash })`;
- `evidence` contains only canonical conflict identity, transaction ID, ordered candidate IDs, privacy-safe signal identity, original conflict evidence hash, conflict state hash, intent, selected merchant ID, plan version/hash, request hash, actor ID, and reason;
- `evidenceHash = SHA-256(canonical evidence JSON)`;
- `confidenceBasisPoints = null`;
- `abstentionCode = null`;
- `validUntil = null`;
- `backfillRunId = null`;
- update the conflict to `status = RESOLVED`, link `resolutionId`, and set `resolvedAt`, `resolvedById`, and `resolutionReason`;
- set `MerchantIdentityDecision.targetMerchantId = selectedMerchantId`.

`ABSTAIN`:

- create one append-only `MerchantResolution`;
- `status = ABSTAINED`;
- `merchantId = null`;
- `engineVersion = merchant-admin-conflict-resolution-v1`;
- `inputHash = SHA-256(canonical JSON of { conflictStateHash, intent: ABSTAIN, selectedMerchantId: null, planVersion, planHash })`;
- `evidence` uses the same canonical fields as `SELECT_MERCHANT`, without a selected merchant;
- `evidenceHash = SHA-256(canonical evidence JSON)`;
- `confidenceBasisPoints = null`;
- `abstentionCode = ADMIN_CONFIRMED_ABSTENTION`;
- `validUntil = null`;
- `backfillRunId = null`;
- update the conflict to `status = RESOLVED`, link `resolutionId`, and set `resolvedAt`, `resolvedById`, and `resolutionReason`;
- keep `MerchantIdentityDecision.targetMerchantId = null`;
- the terminal conflict status plus `MerchantResolution.status = ABSTAINED` distinguishes confirmed abstention from automatic abstention while a conflict remains `OPEN`.

`DISMISS`:

- create no `MerchantResolution`;
- require existing `resolutionId = null`;
- update the conflict to `status = DISMISSED`, keep `resolutionId = null`, and set `resolvedAt`, `resolvedById`, and `resolutionReason`;
- keep `MerchantIdentityDecision.targetMerchantId = null`;
- do not invent a dismissed resolution status.

For all intents, `MerchantIdentityDecision.conflictId` is required. Idempotency hashes workspace ID, conflict ID, intent, selected merchant ID or null, conflict state hash, conflict evidence hash, plan version, plan hash, reason, and request key. Identical retries return the prior decision; conflicting reuse rejects.

### MerchantIdentityDecision

```prisma
model MerchantIdentityDecision {
  id                 String                         @id @default(uuid())
  workspaceId        String
  action             MerchantIdentityDecisionAction
  sourceMerchantId   String?
  targetMerchantId   String?
  aliasId            String?
  fingerprintId      String?
  conflictId         String?
  actorId            String?
  reason             String
  beforeState        Json
  afterState         Json
  evidence           Json
  evidenceHash       String
  decisionVersion    String
  decidedAt          DateTime                       @default(now())

  workspace          FinanceWorkspace    @relation(fields: [workspaceId], references: [id], onDelete: Restrict)
  sourceMerchant     Merchant?           @relation("MerchantDecisionSource", fields: [sourceMerchantId], references: [id], onDelete: Restrict)
  targetMerchant     Merchant?           @relation("MerchantDecisionTarget", fields: [targetMerchantId], references: [id], onDelete: Restrict)
  alias              MerchantAlias?      @relation(fields: [aliasId], references: [id], onDelete: Restrict)
  fingerprint        MerchantFingerprint? @relation(fields: [fingerprintId], references: [id], onDelete: Restrict)
  conflict           MerchantConflict?   @relation(fields: [conflictId], references: [id], onDelete: Restrict)
  actor              User?               @relation(fields: [actorId], references: [id], onDelete: SetNull)

  @@index([workspaceId, action, decidedAt])
  @@index([sourceMerchantId])
  @@index([targetMerchantId])
  @@index([conflictId])
}
```

- Append-only decision record.
- Merge/split detail that is not relationally singular remains in versioned `beforeState`/`afterState` JSON.
- Decisions never rewrite `TransactionBooking` or `ReviewDecision`.

### MerchantAuditEvent

```prisma
model MerchantAuditEvent {
  id             String   @id @default(uuid())
  workspaceId    String
  entityType     String
  entityId       String
  action         String
  actorId        String?
  requestId      String?
  beforeState    Json
  afterState     Json
  evidenceHash   String
  schemaVersion  String
  createdAt      DateTime @default(now())

  workspace      FinanceWorkspace @relation(fields: [workspaceId], references: [id], onDelete: Restrict)
  actor          User?            @relation(fields: [actorId], references: [id], onDelete: SetNull)

  @@index([workspaceId, entityType, entityId, createdAt])
  @@index([workspaceId, actorId, createdAt])
  @@index([requestId])
}
```

- Append-only, workspace-scoped, and separate from the current generic user audit table.
- No hard deletion in normal operation.

### MerchantBackfillRun

Persisting dry-run plans is justified because the 221-item benchmark requires reproducible coverage/collision metrics and later batches require idempotency.

```prisma
model MerchantBackfillRun {
  id                  String                    @id @default(uuid())
  workspaceId         String
  runKey               String
  status               MerchantBackfillRunStatus @default(PLANNED)
  dryRun               Boolean                   @default(true)
  sourceSnapshotHash   String
  engineVersion        String
  parameters           Json
  summary              Json
  createdById          String?
  startedAt            DateTime?
  completedAt          DateTime?
  createdAt            DateTime                  @default(now())

  workspace            FinanceWorkspace          @relation(fields: [workspaceId], references: [id], onDelete: Restrict)
  createdBy            User?                     @relation(fields: [createdById], references: [id], onDelete: SetNull)
  results              MerchantBackfillResult[]
  resolutions          MerchantResolution[]

  @@unique([workspaceId, runKey])
  @@index([workspaceId, status, createdAt])
}
```

### MerchantBackfillResult

```prisma
model MerchantBackfillResult {
  id                    String                   @id @default(uuid())
  runId                 String
  workspaceId           String
  transactionId         String
  proposedMerchantId    String?
  resolutionStatus      MerchantResolutionStatus
  matchedSignalType     MerchantKnowledgeSignalType?
  knownMerchant         Boolean
  aliasConsolidated     Boolean                  @default(false)
  fingerprintCollision  Boolean                  @default(false)
  conflictDetected      Boolean                  @default(false)
  retrievalAnchorReady  Boolean                  @default(false)
  correctionReusable    Boolean                  @default(false)
  evidence              Json
  evidenceHash          String
  createdAt             DateTime                 @default(now())

  run                   MerchantBackfillRun @relation(fields: [runId], references: [id], onDelete: Cascade)
  workspace             FinanceWorkspace    @relation(fields: [workspaceId], references: [id], onDelete: Restrict)
  transaction           Transaction         @relation(fields: [transactionId], references: [id], onDelete: Restrict)
  proposedMerchant      Merchant?           @relation(fields: [proposedMerchantId], references: [id], onDelete: Restrict)

  @@unique([runId, transactionId])
  @@index([workspaceId, resolutionStatus, knownMerchant])
  @@index([workspaceId, conflictDetected, fingerprintCollision])
  @@index([workspaceId, retrievalAnchorReady])
  @@index([proposedMerchantId])
}
```

- Backfill results are derived evidence, not merchant writes and not booking truth.
- Cascade from disposable/derived run to results is acceptable; all other merchant and financial relations remain restrictive.

## Relation additions required later

A later schema implementation will need collection relations on `FinanceWorkspace`, `Transaction`, `User`, and merchant models. Those additions are additive and do not alter existing scalar fields or accounting behavior.

## Deterministic migration sequence

### Step 1 — Enums

- **Intent:** create the nine merchant enums above.
- **Risk:** short catalog locks only; no table rewrite.
- **Expected size:** metadata only.
- **Backfill:** none.
- **Transaction:** include in the migration transaction generated/maintained by Prisma SQL.
- **Validation:** query `pg_type`/`pg_enum` for exact labels.
- **Rollback/safe disable:** unused enums may remain if rollback avoids destructive SQL; full rollback only on disposable databases.
- **Compatibility:** current application ignores them.

### Step 2 — Core merchant identity

- **Intent:** create `Merchant` and restrictive workspace/user/self relations plus lookup indexes.
- **Risk:** new-table creation only.
- **Expected size:** initially zero; expected less than or equal to the number of distinct workspace counterparties, well below the 902 current transactions.
- **Backfill:** none in migration.
- **Validation:** zero rows, valid foreign keys/indexes, no existing table changes except additive relation metadata in Prisma.
- **Rollback:** safe-disable by leaving table unused; destructive drop only on disposable rollback.

### Step 3 — Aliases and fingerprints

- **Intent:** create `MerchantAlias` and `MerchantFingerprint` with restrictive foreign keys and ordinary indexes.
- **Risk:** new tables/indexes only.
- **Expected size:** several observations per transaction; low thousands for the current corpus.
- **Backfill:** none in migration.
- **Validation:** empty tables; foreign keys; idempotency unique key on fingerprints.
- **Rollback:** services disabled; tables remain empty or derived rows can be removed by an approved later rollback.

### Step 4 — Conflicts and identity decisions

- **Intent:** create `MerchantConflict` and `MerchantIdentityDecision`.
- **Risk:** new tables/indexes only.
- **Expected size:** much smaller than transaction count.
- **Backfill:** none.
- **Validation:** restrictive relations, nullable action targets, append-only test expectations.
- **Rollback:** no consumer enabled; leave unused.

### Step 5 — Resolution history

- **Intent:** create append-only `MerchantResolution` and idempotency/index contracts.
- **Risk:** new table/indexes only.
- **Expected size:** approximately one row per processed transaction per engine/input version; 221 benchmark rows per version initially.
- **Backfill:** none in migration.
- **Validation:** unique input key and latest-resolution lookup index.
- **Rollback:** disable resolution reads; existing review continues unchanged.

### Step 6 — Audit/provenance

- **Intent:** create `MerchantAuditEvent` and actor/workspace relations.
- **Risk:** new table/indexes only.
- **Expected size:** proportional to merchant maintenance actions, not transaction volume.
- **Backfill:** none.
- **Validation:** workspace index, append-only service contract, actor deletion preserves event via `SetNull`.
- **Rollback:** leave table unused; no fallback to generic audit is required for unimplemented merchant actions.

### Step 7 — PostgreSQL partial unique indexes

- **Intent:** add the three raw SQL partial indexes for active aliases, strong matched fingerprints, and open conflicts.
- **Risk:** index creation on empty new tables; negligible. Later production index changes require separate planning.
- **Expected size:** empty at migration time.
- **Backfill:** none.
- **Validation:** inspect `pg_indexes.indexdef` and exercise duplicate allowed/blocked fixtures in disposable PostgreSQL.
- **Prisma limitation:** predicates are not expressible through standard Prisma schema attributes; migration SQL and static tests are authoritative.
- **Rollback:** drop only in disposable rollback; production safe-disable leaves indexes in place.

### Step 8 — Dry-run/backfill structures

- **Intent:** create `MerchantBackfillRun` and `MerchantBackfillResult` last.
- **Risk:** new tables/indexes only.
- **Expected size:** one result per included transaction per run; about 221 for benchmark-only runs and 902 for a full current corpus run.
- **Backfill:** none during migration.
- **Validation:** workspace/run uniqueness, result idempotency, cascade limited to derived run/results.
- **Rollback:** delete a derived run and its results; no merchant, transaction, review, or booking record changes.

## Migration-wide safety requirements

The future migration must:

- contain no `DROP TABLE`, `DROP COLUMN`, destructive `ALTER`, transaction rewrite, booking rewrite, review-decision rewrite, suggestion-to-merchant seed, or trusted-history seed;
- contain no `INSERT`, `UPDATE`, or `DELETE` against `Transaction`, `TransactionBooking`, `ReviewDecision`, or `CategorizationSuggestion`;
- remain fully compatible while every merchant table is empty and no service reads it;
- use `onDelete: Restrict` for merchant knowledge linked to financial/evidence records, except derived backfill results cascading from their run and optional actor relations using `SetNull`;
- apply through the active SQL migration chain on a disposable local PostgreSQL database;
- pass `prisma validate`, `prisma generate`, `prisma migrate deploy`, `prisma migrate status`, and database-to-schema diff checks in a separately approved implementation task;
- add static tests asserting additive-only SQL, partial-index predicates, workspace relations, immutable existing models, and active migration order.

## 221-transaction measurement support

The proposed design supports:

- **known merchant coverage:** `MerchantBackfillResult.knownMerchant` and `proposedMerchantId`;
- **new merchant rate:** unresolved/proposed merchant outcomes grouped by run;
- **alias consolidation:** `aliasConsolidated` plus merchant/alias relations;
- **fingerprint collision rate:** `fingerprintCollision` and conflict evidence;
- **merchant conflict rate:** `conflictDetected` and `MerchantConflict.status`;
- **unresolved merchant rate:** `MerchantResolutionStatus.ABSTAINED`/`CONFLICTED`;
- **correction reuse:** `correctionReusable`, approved aliases, and identity decisions;
- **known-versus-new categorization accuracy:** join benchmark transaction IDs and confirmed review/booking outcomes to backfill results without copying classification defaults into Merchant;
- **false merchant merge rate:** merge decisions, later correction/split decisions, and audit history;
- **retrieval-anchor coverage:** `retrievalAnchorReady` and resolved merchant IDs.

Indexes are designed for workspace/run/status aggregation and transaction/merchant joins without scanning unrelated workspaces.

## Source-grounded future change map

| Current area | Future interaction | Why required | Required tests | Phase 3.2 changes now |
|---|---|---|---|---|
| `prisma/schema.prisma` | Add enums, models, relations, and ordinary indexes in Phase 3.3. | Persist workspace-scoped merchant knowledge and derived benchmark evidence. | Static schema guards, Prisma validation/generation, relation and immutability checks. | no |
| `prisma/migrations/<timestamp>_add_merchant_knowledge/migration.sql` | New additive SQL migration in Phase 3.3, including partial unique indexes. | Deploy the approved empty schema safely. | Additive SQL guard, partial-index tests, active-order test, disposable replay and drift check. | no |
| `tests/services/model002DomainSchema.test.ts` migration-order conventions | Extend or add a dedicated model test rather than rewriting historical hash assertions. | Active migration list and disposable replay must include the new migration. | Exact active order, migration application, no drift, cleanup. | no |
| `tests/services/model003ClassificationRecords.test.ts` additive guard pattern | Reuse its no-drop/no-update/no-seed assertions in a new merchant schema test. | Protect financial records and suggestion purity. | Forbidden SQL patterns and required table/index/FK assertions. | no |
| `server/services/transactionSuggestionFacts.ts` | Phase 3.3+ fingerprint extraction reads IBAN/purpose source facts. | Populate deterministic signals without raw-fact mutation. | Source extraction, missing field, masking, immutable input. | no |
| `server/services/historySuggestionService.ts` | Later accept validated merchant retrieval anchors. | Improve confirmed-history precision. | Confirmed-booking-only, workspace, known/new merchant, conflict abstention. | no |
| `server/services/suggestionBackfillService.ts` | Reuse planning/idempotency/no-side-effect conventions. | Dry-run benchmark and coverage reporting. | Deterministic ordering, no writes, counts, collision/conflict metrics. | no |
| `server/services/auditLogService.ts` | Remains unchanged; future merchant services write `MerchantAuditEvent`. | Avoid mixing user-scoped generic audit with workspace merchant provenance. | Merchant-specific append-only audit tests. | no |
| `server/services/reviewDecisionService.ts` | No merchant-driven booking changes. | Preserve accounting authority. | Existing authorization, lock, audit, and transactional booking tests. | no |
| `server/services/transactionFingerprint.ts` | No interaction; remains import deduplication only. | Prevent identity-semantic coupling. | Existing fingerprint tests plus merchant separation guard. | no |

## Explicit exclusions

This proposal does not authorize implementation, migration creation, migration application, data backfill, merchant resolution, UI, Bedrock, AI inference, automatic booking, or use of unconfirmed suggestions as merchant truth.
