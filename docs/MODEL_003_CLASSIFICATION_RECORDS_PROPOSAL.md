# MODEL-003 classification records proposal

Status: owner-approved; Packet A committed; Packet B implemented and validated; commit not approved  
Run: `agent-f961650b-de17-4282-ab18-7a716cc72958`  
Source: `yeshuaacademy-finance`  
Baseline commit: `d2afb18735dce113a69d9ad40c3c8e4b3ce562df`  
Scope: MODEL-003 Packet A additive persistence

## Purpose

MODEL-003 turns the approved classification aggregate into an implementation-ready contract for immutable suggestions, explicit review decisions, and current final bookings.

This proposal does not implement schema, migrations, services, routes, tests, imports, or production configuration. It defines the exact target contract and the safe sequencing required before implementation may begin.

## Governing invariants

The proposal follows these approved invariants from `docs/DOMAIN_MODEL.md`:

1. A suggestion is never a final booking.
2. Fuzzy, normalized fallback, popularity, amount-only, and heuristic matches remain suggestions.
3. Only an approved deterministic rule or a complete raw historical replay may create a final automatic booking.
4. Every final booking has exactly one `Klant`, one `Type`, and one `Category`.
5. Generic `AuditLog` supports investigation but is not the only source of truth for financial decisions.
6. Financial records belong to a `FinanceWorkspace`; human identities and roles are separate actor and membership data.

## Current implementation facts

The committed baseline still has a legacy compatibility model:

- final category and partial dimension state live directly on `Transaction` through `categoryId`, `projectId`, `transactionTypeId`, `classificationSource`, and `classificationRuleId`;
- `CategorizationRule` remains category-only and user-scoped, even though MODEL-002 added workspace, project, and type dimensions;
- `updateTransactionCategory` mutates `Transaction` and writes a generic `AuditLog`;
- `confirmTransactions` and `clearReviewQueue` bulk-convert transaction state to `manual`;
- review suggestions are not yet explicit ranked records.

MODEL-003 must therefore be additive first. It must not drop legacy transaction fields in the first implementation slice.

## Target records

### `TransactionBooking`

`TransactionBooking` is the current final classification for one transaction.

Required fields:

- `id: String` — primary key.
- `workspaceId: String` — financial ownership boundary.
- `transactionId: String` — unique one-to-one relation to `Transaction`.
- `projectId: String` — required final `Klant` dimension.
- `transactionTypeId: String` — required final `Type` dimension.
- `categoryId: String` — required final `Category` dimension.
- `source: BookingSource` — `HISTORICAL`, `RULE`, or `MANUAL`.
- `ruleId: String?` — required when `source = RULE`.
- `historicalSourceTransactionId: String?` — required when `source = HISTORICAL`.
- `historicalMatchKey: String?` — required when `source = HISTORICAL`.
- `evidence: Json` — immutable decision or match evidence.
- `evidenceHash: String` — hash of canonical evidence.
- `confirmedBy: String?` — actor ID for administrator-confirmed or manual bookings.
- `confirmedAt: DateTime`.
- `literalProjectLabel: String` — exact reporting label at decision time.
- `literalTypeLabel: String` — exact reporting label at decision time.
- `literalCategoryLabel: String` — exact reporting label at decision time.
- `createdAt: DateTime`.
- `updatedAt: DateTime`.

Rules:

- Absence of `TransactionBooking` means unresolved.
- A transaction may have at most one current booking.
- All three dimensions are required.
- Literal labels are immutable snapshots for reporting and audit history.
- `RULE` bookings require an approved rule that can prove all three dimensions, the exact applied rule version, `ruleId`, and matching evidence hash.
- `HISTORICAL` bookings require a complete raw historical replay, a source transaction reference, a deterministic match key, and matched-field evidence.
- `MANUAL` bookings require an administrator decision in the same database transaction.
- Source-specific provenance is validated atomically with booking creation, replacement, or removal.

### `CategorizationSuggestion`

`CategorizationSuggestion` is append-only proposed classification evidence. It is not final truth.

Required fields:

- `id: String` — primary key.
- `workspaceId: String` — financial ownership boundary.
- `transactionId: String`.
- `projectId: String?`.
- `transactionTypeId: String?`.
- `categoryId: String?`.
- `confidence: SuggestionConfidence` — `EXACT_FALLBACK`, `FUZZY`, `OVERALL`, or `DEFAULT`.
- `matcher: SuggestionMatcher` — `NORMALIZED_HISTORY`, `FUZZY_HISTORY`, `BEST_HISTORY`, `DIRECTION_DEFAULT`, or `RULE_CANDIDATE`.
- `rank: Int`.
- `scoreBasisPoints: Int?` — optional integer 0 through 10000; no floating-point persistence.
- `evidence: Json` — matched fields, compared transaction or rule IDs, and competing candidates.
- `evidenceHash: String` — hash of canonical evidence.
- `status: SuggestionStatus` — `PENDING`, `ACCEPTED`, `REJECTED`, or `EXPIRED`.
- `createdAt: DateTime`.
- `resolvedAt: DateTime?`.

Rules:

- Suggestions never populate `TransactionBooking` without a `ReviewDecision`.
- Suggestion evidence, dimensions, matcher, rank, score, and confidence are immutable after creation.
- Only `status` and `resolvedAt` may change, and only through approved transitions.
- Competing categories remain visible as separate ranked suggestions.
- A weaker suggestion does not overwrite a stronger suggestion.
- Suggestions may be partial; a partial suggestion cannot be accepted until missing dimensions are supplied by the decision.

### `ReviewDecision`

`ReviewDecision` is immutable administrator decision history.

Required fields:

- `id: String` — primary key.
- `workspaceId: String` — financial ownership boundary.
- `transactionId: String`.
- `suggestionId: String?`.
- `action: ReviewDecisionAction` — `ACCEPT_SUGGESTION`, `ASSIGN_MANUALLY`, `CHANGE_BOOKING`, or `REMOVE_BOOKING`.
- `beforeBookingId: String?`.
- `beforeProjectId: String?`.
- `beforeTypeId: String?`.
- `beforeCategoryId: String?`.
- `afterBookingId: String?`.
- `afterProjectId: String?`.
- `afterTypeId: String?`.
- `afterCategoryId: String?`.
- `actorId: String`.
- `actorEmail: String?` — snapshot at decision time.
- `reason: String?`.
- `evidence: Json` — canonical decision context.
- `evidenceHash: String`.
- `decidedAt: DateTime`.

Rules:

- Decisions are append-only and are never updated or deleted.
- The decision and booking update happen in the same database transaction.
- A locked period cannot be changed without a later audited reopen workflow.
- `REMOVE_BOOKING` requires a reason.
- `CHANGE_BOOKING` requires before and after dimensions.
- `ACCEPT_SUGGESTION` requires `suggestionId` and either a complete suggestion or explicit completion of missing dimensions.
- `ASSIGN_MANUALLY` requires all three after dimensions and administrator context.
- Generic `AuditLog` may be written in the same transaction, but `ReviewDecision` is the financial source of truth.

## Enums

### `BookingSource`

- `HISTORICAL`
- `RULE`
- `MANUAL`

### `SuggestionConfidence`

- `EXACT_FALLBACK`
- `FUZZY`
- `OVERALL`
- `DEFAULT`

### `SuggestionMatcher`

- `NORMALIZED_HISTORY`
- `FUZZY_HISTORY`
- `BEST_HISTORY`
- `DIRECTION_DEFAULT`
- `RULE_CANDIDATE`

### `SuggestionStatus`

- `PENDING`
- `ACCEPTED`
- `REJECTED`
- `EXPIRED`

Allowed transitions:

- `PENDING` to `ACCEPTED`.
- `PENDING` to `REJECTED`.
- `PENDING` to `EXPIRED`.

No other transition is allowed.

### `ReviewDecisionAction`

- `ACCEPT_SUGGESTION`
- `ASSIGN_MANUALLY`
- `CHANGE_BOOKING`
- `REMOVE_BOOKING`

## Database constraints and indexes

### `TransactionBooking`

Required constraints and indexes:

- primary key on `id`;
- unique `transactionId`;
- foreign key `workspaceId` to `FinanceWorkspace` with restricted delete;
- foreign key `transactionId` to `Transaction` with restricted delete;
- foreign key `projectId` to `Project` with restricted delete;
- foreign key `transactionTypeId` to `TransactionType` with restricted delete;
- foreign key `categoryId` to `Category` with restricted delete;
- optional foreign key `ruleId` to `CategorizationRule` with restricted delete;
- optional self or transaction foreign key for `historicalSourceTransactionId` with restricted delete;
- index on `(workspaceId, source, confirmedAt)`;
- index on `(projectId)`;
- index on `(transactionTypeId)`;
- index on `(categoryId)`;
- index on `(ruleId)`;
- unique or indexed `evidenceHash` per transaction where useful for replay verification.

Cross-workspace references are forbidden. Service validation must prove transaction, dimensions, suggestion, rule, and actor membership all belong to the same workspace before writing.

### `CategorizationSuggestion`

Required constraints and indexes:

- primary key on `id`;
- foreign key `workspaceId` to `FinanceWorkspace` with restricted delete;
- foreign key `transactionId` to `Transaction` with restricted delete;
- optional foreign keys to `Project`, `TransactionType`, and `Category` with restricted delete;
- index on `(workspaceId, transactionId, status, rank)`;
- index on `(workspaceId, status, createdAt)`;
- index on `(transactionId, status)`;
- index on `(categoryId)`;
- index on `(projectId)`;
- index on `(transactionTypeId)`;
- evidence hash recorded for deterministic comparison.

The implementation should prevent duplicate active suggestions with identical transaction, dimensions, matcher, and evidence hash unless a new import or matcher version intentionally creates a new ranked candidate.

### `ReviewDecision`

Required constraints and indexes:

- primary key on `id`;
- foreign key `workspaceId` to `FinanceWorkspace` with restricted delete;
- foreign key `transactionId` to `Transaction` with restricted delete;
- optional foreign key `suggestionId` to `CategorizationSuggestion` with restricted delete;
- optional before and after dimension foreign keys with restricted delete;
- optional before and after booking references with restricted delete or nullable historical reference behavior that preserves decision rows;
- index on `(workspaceId, transactionId, decidedAt)`;
- index on `(workspaceId, actorId, decidedAt)`;
- index on `(workspaceId, action, decidedAt)`;
- index on `(suggestionId)`.

Review decisions must survive later booking changes.

## Compatibility authority phases

### Phase A — additive persistence

Phase A creates the new tables and enums only.

Authority during Phase A:

- Existing `Transaction` classification fields remain operational authority.
- New tables may be backfilled only where source evidence is deterministic.
- No route or service switches to the new tables in Phase A.
- No legacy transaction fields are dropped or made non-null.
- No final booking is fabricated from incomplete dimensions.

Purpose:

- allow schema and migration review;
- allow database validation on disposable PostgreSQL;
- allow integrity tests before behavior changes.

### Phase B — behavioral transition

Phase B introduces the service boundary that creates and changes final classification state.

Authority during Phase B:

- `TransactionBooking` becomes authoritative for new review decisions.
- Legacy transaction fields remain as a compatibility projection for existing UI and reports.
- Every write through the review workflow updates `TransactionBooking`, appends `ReviewDecision`, resolves suggestions if applicable, and mirrors compatible fields back to `Transaction` in the same database transaction.
- Read APIs may return both legacy fields and new booking or suggestion fields until UI migration is complete.

No later phase may treat legacy raw JSON metadata or category-only legacy state as complete financial truth.

### Phase C — legacy read migration, later and separate

Phase C is not part of MODEL-003 implementation approval.

It may later move read paths to `TransactionBooking` and stop relying on legacy transaction fields, but only after reports, review UI, import workflow, and reconciliation tests prove equivalence.

## Existing-data mapping

Backfill must be deterministic and conservative.

### `classificationSource = none`

- If no final category and no complete dimensions exist, no `TransactionBooking` is created.
- The transaction remains unresolved.
- Suggestions may be created only from explicit, reproducible suggestion evidence.

### `classificationSource = import`

- Treat as unresolved or suggested legacy state unless all three dimensions and evidence exist.
- Do not create a final booking from import state alone.
- Preserve any existing category or metadata as compatibility state, not as final truth.

### `classificationSource = manual`

- If category, project, and type are all present and a reliable actor decision exists, create a `MANUAL` booking and a matching `ReviewDecision`.
- If actor identity is unknown, do not fabricate `actorId`; either leave legacy state as compatibility-only or create a clearly marked system migration decision only if explicitly approved later.
- If only category is present, do not create a complete final booking.

### `classificationSource = rule`

- The existing rule model is category-only and cannot prove a complete three-dimension booking by itself.
- If the transaction has all three dimensions and the rule can be linked to approved three-dimension provenance after a later rule transition, a `RULE` booking may be created.
- Until that rule transition exists, category-only rule state remains compatibility state or suggestion evidence only.

### `classificationSource = history`

- A `HISTORICAL` booking may be created only when a complete raw historical replay key, source transaction, all three dimensions, and canonical matched-field evidence are available.
- Normalized fallback, fuzzy, popularity, amount-only, or incomplete historical matches remain suggestions.
- Do not infer missing dimensions from category alone.

### Unknown or inconsistent state

- Preserve existing transaction fields.
- Do not create `TransactionBooking`.
- Add validation reporting for manual review in the implementation packet.

## Provenance and evidence hash

Evidence must be canonical, deterministic, and auditable.

Requirements:

- Store the exact source fields used for the decision or suggestion.
- Store matched transaction or rule IDs where applicable.
- Store rule version and rule condition snapshot for rule-based decisions.
- Store historical match key and compared raw historical fields for historical replay.
- Store administrator decision context for manual decisions.
- Generate `evidenceHash` from canonical JSON with stable key ordering, stable primitive serialization, and no volatile timestamps unless they are part of the decision.
- The evidence hash must be generated before the transaction commits and stored with the record it protects.

No evidence hash may be generated from UI display labels alone when source fields are required.

## Atomic write boundary

The future review decision service must perform the following in one database transaction:

1. Resolve transaction and workspace.
2. Verify actor is an active ADMIN member of that workspace.
3. Verify the period is not locked.
4. Verify all selected dimensions belong to the same workspace and are active unless historical use is explicitly allowed.
5. Verify suggestion status and ownership where a suggestion is accepted or rejected.
6. Validate source-specific provenance.
7. Create, replace, or remove the current `TransactionBooking`.
8. Append the immutable `ReviewDecision`.
9. Resolve the accepted or rejected suggestion where applicable.
10. Mirror compatibility fields on `Transaction` during Phase B.
11. Write supplemental `AuditLog` if still required by existing investigation tooling.

If any step fails, no booking, decision, suggestion status, legacy mirror, or audit row may change.

## Authorization and workspace scope

Rules:

- VIEWER membership is read-only.
- ADMIN membership is required for assigning, changing, accepting, rejecting, or removing classifications.
- Actor snapshots store `actorId` and `actorEmail` at decision time.
- The actor identity is separate from financial ownership.
- A request-level `userId` must not be treated as a workspace boundary.
- The service must prevent cross-workspace references among transaction, dimensions, suggestion, rule, booking, and decision.

## Bulk-confirm transition

The current broad queue-clear behavior must not survive as a bulk conversion of suggestions into manual truth.

Required transition:

- Remove or disable `clearReviewQueue` as a financial mutation endpoint.
- Reject unsafe bulk confirmation with a Dutch error explaining that each transaction needs an explicit administrator decision.
- Keep any future bulk action limited to non-financial UI housekeeping or explicit per-transaction decision inputs.
- Replace `confirmTransactions` with the atomic review-decision service; it must not mark rows manual without writing `ReviewDecision` and `TransactionBooking`.

## API behavior transition

Phase B API behavior should be explicit:

- Review queue reads unresolved transactions and pending suggestions.
- Each transaction returns current booking if present, pending suggestions ranked by confidence and rank, and required dimension choices.
- Accepting a suggestion requires an explicit endpoint that writes one `ReviewDecision`.
- Manual assignment requires all three dimensions.
- Changing a booking records previous and new dimensions.
- Removing a booking records a reason and leaves the transaction unresolved.

The UI may continue to receive legacy fields during compatibility, but those fields are projections, not the financial source of truth.

## Rollback and no-data-loss behavior

Phase A rollback:

- Because Phase A is additive, rollback can remove the new empty or backfilled tables only before Phase B uses them as authority.
- Legacy transaction fields remain intact.

Phase B rollback:

- Once Phase B writes decisions, rollback must preserve `ReviewDecision` and `TransactionBooking` records.
- If application behavior must revert, legacy mirror fields remain available for read compatibility, but financial decision rows must not be deleted.

Data-loss rules:

- No legacy classification fields are dropped in MODEL-003.
- No suggestion, decision, or booking evidence is synthesized without source evidence.
- Backfill reports unresolved or incomplete rows instead of inventing missing dimensions or actors.

## Implementation sequencing

### Packet A — additive persistence

Purpose: add persistence structures and validation without changing behavior.

Allowed files:

- `prisma/schema.prisma`
- a new `prisma/migrations/*_add_classification_records/migration.sql`
- `tests/services/model003ClassificationRecords.test.ts`
- relevant documentation handoff updates

Acceptance:

- new models and enums compile;
- migration is additive;
- no legacy transaction fields are dropped;
- disposable PostgreSQL deployment succeeds;
- structural tests verify constraints, indexes, enums, and no destructive SQL;
- existing full suite and builds pass;
- security scans pass.

### Packet B — behavioral transition

Purpose: make review decisions and bookings the write boundary.

Allowed files:

- a new classification or review-decision service;
- `server/routes/review.ts`;
- `server/services/reviewQueueService.ts` and `server/services/categorizationService.ts` only where necessary;
- API response mappers and review UI helpers only where necessary;
- targeted route, service, and helper tests;
- documentation handoff updates.

Acceptance:

- each administrator classification mutation appends `ReviewDecision` and updates `TransactionBooking` atomically;
- unsafe bulk confirmation is removed, disabled, or rejected;
- suggestion acceptance resolves suggestion status and writes a booking;
- manual assignment requires all three dimensions;
- changing or removing a booking records before and after state;
- VIEWER users cannot mutate;
- locked-period behavior remains protected;
- legacy fields are mirrored only for compatibility;
- full tests and builds pass;
- security scans pass.

## Explicit non-goals for this design gate

- No Prisma schema edit.
- No migration creation.
- No service, route, UI, helper, or test implementation.
- No historical data import.
- No 2026 ING import.
- No Docker, dependency, environment, or production configuration change.
- No `.graphifyignore` or `graphify-out/` change.
- No commit or push.

## Approval checklist

Before MODEL-003 implementation begins, the owner must approve:

1. The three-record boundary.
2. The compatibility authority phases.
3. The conservative existing-data mapping.
4. The provenance and evidence-hash requirements.
5. The append-only decision and suggestion lifecycle.
6. The atomic review write boundary.
7. The ADMIN-only mutation and workspace validation rules.
8. The removal or rejection of unsafe bulk confirmation.
9. The two-packet implementation sequence.

Until approval, MODEL-003 remains design-only.



## Packet A implementation evidence

Packet A was implemented after owner approval of this proposal.

Implemented files:

- `prisma/schema.prisma`
- `prisma/migrations/20260703193000_add_classification_records/migration.sql`
- `tests/services/model003ClassificationRecords.test.ts`
- `tests/services/model002DomainSchema.test.ts`
- documentation handoff updates

Implementation summary:

- Added `TransactionBooking`, `CategorizationSuggestion`, and `ReviewDecision` models.
- Added `BookingSource`, `SuggestionConfidence`, `SuggestionMatcher`, `SuggestionStatus`, and `ReviewDecisionAction` enums.
- Added additive migration SQL only; no legacy transaction fields were dropped, altered, or backfilled.
- Updated migration-history structural coverage to include the approved MODEL-003 Packet A migration.
- Added structural tests proving model shape, enum values, migration additivity, and legacy compatibility retention.

Validation evidence:

- Prisma schema formatted successfully.
- Prisma schema validated successfully with a localhost-only dummy `DATABASE_URL`.
- Disposable PostgreSQL database `model003_packet_a_f961650b_20260703` was created through the local `/tmp` socket.
- `prisma migrate deploy` applied `0_finance_baseline`, `20260703001200_add_workspace_dimensions`, and `20260703193000_add_classification_records` successfully.
- Database-to-schema diff reported no difference after repairing the expected Prisma-truncated suggestion index name.
- Focused MODEL-003 structural tests passed: 6 tests passed.
- Full suite passed: 53 files passed; 241 tests passed; 1 optional test skipped.
- Server TypeScript build passed.
- Prisma Client generation passed.
- Next.js production build passed with 18 routes; the SWC lockfile warning remained pre-existing and no generated files changed.
- High-risk scan over Packet A executable paths reported no findings.

Packet B was intentionally deferred from Packet A. No import workflow, review route, review service, UI helper, financial data, production configuration, Docker, dependency, `.graphifyignore`, or `graphify-out/` change was made as part of Packet A.

## Packet B proposal and implementation evidence

Prepared proposal:

- `docs/MODEL_003_PACKET_B_PROPOSAL.md`

The Packet B proposal reviews the committed Packet A state and the current legacy review behavior. It proposes a bounded behavior transition around one atomic review-decision service, review-route mutation changes, unsafe bulk-confirm rejection, compatibility mirrors, and targeted validation. It explicitly excludes schema or migration changes, financial-data import, historical replay, rule-model transition, production configuration, Docker, dependencies, Graphify artifacts, commit, and push without separate approval.

Packet B is now implemented and validated in the worktree. The implementation evidence and current commit gate are recorded in `docs/MODEL_003_PACKET_B_PROPOSAL.md`.
