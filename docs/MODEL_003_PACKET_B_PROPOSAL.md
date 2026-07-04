# MODEL-003 Packet B proposal — review-decision behavior transition

Status: owner-approved; implementation completed and validated; commit not approved  
Run: `agent-f961650b-de17-4282-ab18-7a716cc72958`  
Source: `yeshuaacademy-finance`  
Baseline commit: `019691091bb1b4b75d1c822d05f3d4e08cadface`  
Scope: proposal only

## Purpose

MODEL-003 Packet B changes the review workflow from legacy transaction-field mutation to an explicit financial decision boundary.

Packet A already added additive persistence for:

- `TransactionBooking`
- `CategorizationSuggestion`
- `ReviewDecision`
- `BookingSource`
- `SuggestionConfidence`
- `SuggestionMatcher`
- `SuggestionStatus`
- `ReviewDecisionAction`

Packet B must now use those records for administrator classification decisions while preserving legacy read compatibility.

This proposal does not implement Packet B. It defines the bounded implementation plan, file scope, acceptance criteria, validation, and stop conditions.

## Current committed state reviewed

Current committed baseline: `019691091bb1b4b75d1c822d05f3d4e08cadface`.

Reviewed live behavior:

- `server/routes/review.ts` returns review rows from legacy `Transaction` fields and category choices.
- `updateTransactionCategory` requires admin, checks locked ledger state, mutates `Transaction.categoryId`, sets `classificationSource = manual`, clears `classificationRuleId`, and writes a generic `AuditLog`.
- `clearReviewQueue` calls `reviewQueueService.clearReviewQueue` and bulk-converts matching transactions to `manual`.
- `server/services/reviewQueueService.ts` currently updates many non-manual categorized transactions to `classificationSource = manual`.
- `server/services/categorizationService.ts` has `confirmTransactions`, which also bulk-marks selected non-manual transactions as manual.
- `categorizeTransaction` still returns a legacy category-only rule result.
- Existing tests assert the current bulk-confirm behavior and must be changed in Packet B.
- `src/libs/api.ts` exposes `fetchReview`, `updateCategory`, and `clearReviewQueue` client functions that map to legacy routes.

Reviewed Packet A constraints:

- Packet A is additive and committed.
- Legacy `Transaction` fields remain for compatibility.
- No Packet B behavior exists yet.
- No financial data has been imported or backfilled.
- `.graphifyignore` and `graphify-out/` remain unrelated and must stay untouched.

## Packet B implementation boundary

Packet B is behavior-only over the committed Packet A persistence. It may use existing additive tables but must not create a new migration unless implementation discovers a hard blocker that cannot be solved safely without owner approval.

Allowed implementation themes:

1. Add one focused review-decision service.
2. Update review mutation routes to call that service.
3. Disable unsafe bulk-confirm mutations.
4. Keep legacy fields as compatibility mirrors.
5. Add targeted route, service, and helper tests.
6. Update documentation handoff with validation evidence.

Explicit exclusions:

- No Prisma schema change unless stopped for owner approval.
- No migration creation unless stopped for owner approval.
- No Packet C legacy read migration.
- No import workflow rewrite.
- No historical data import or backfill.
- No rule-model transition to complete three-dimension rules.
- No report or reconciliation rewrite except tests proving existing lock checks remain respected.
- No Docker, dependency, environment, or production configuration change.
- No `.graphifyignore` or `graphify-out/` change.
- No push.

## Proposed implementation files

Expected code files:

- `server/services/reviewDecisionService.ts` — new service owning atomic decision writes.
- `server/routes/review.ts` — replace legacy category mutation and unsafe clear behavior with service calls or explicit rejection.
- `server/services/reviewQueueService.ts` — remove or replace unsafe bulk conversion behavior.
- `server/services/categorizationService.ts` — remove or reject unsafe `confirmTransactions` behavior where it creates manual truth without decisions.
- `src/libs/api.ts` — update client API wrappers only if route contracts change.
- `src/helpers/review-page.ts` — update helper behavior only if route response shape changes.

Expected tests:

- `tests/services/reviewDecisionService.test.ts` — new atomic decision service tests.
- `tests/routes/review.test.ts` or existing route test file if one already owns review routes.
- `tests/services/reviewQueueService.test.ts` — update unsafe bulk-confirm expectations.
- `tests/services/categorizationService.test.ts` — update `confirmTransactions` expectations.
- `tests/helpers/reviewPage.test.ts` and API helper tests only if response or client contract changes.

Expected documentation updates:

- `docs/MODEL_003_PACKET_B_PROPOSAL.md`
- `docs/MODEL_003_CLASSIFICATION_RECORDS_PROPOSAL.md`
- `docs/IMPLEMENTATION_PLAN.md`
- `docs/finance-rebuild-run.md`

## Required service contract

Create a service that performs review decisions in one database transaction.

Suggested exported functions:

```ts
assignManualBooking(txClient, params)
acceptSuggestion(txClient, params)
changeBooking(txClient, params)
removeBooking(txClient, params)
rejectSuggestion(txClient, params)
rejectUnsafeBulkConfirmation()
```

The exact names may change during implementation, but the service boundary must stay explicit.

Every financial mutation must validate:

1. Request actor exists and is ADMIN.
2. Actor has active ADMIN membership in the transaction workspace.
3. Transaction exists and belongs to the same workspace as selected dimensions, suggestion, and current booking.
4. Locked ledger period remains protected.
5. Manual assignment and booking changes include all three dimensions: `projectId`, `transactionTypeId`, and `categoryId`.
6. Suggestion acceptance references a pending suggestion owned by the transaction workspace.
7. Partial suggestions must be completed with explicit dimensions before acceptance.
8. `REMOVE_BOOKING` requires a reason.
9. `CHANGE_BOOKING` records before and after dimension state.
10. Evidence is canonicalized and hashed before write.

Every accepted mutation must atomically:

1. Create, update, or remove `TransactionBooking`.
2. Append one immutable `ReviewDecision`.
3. Resolve the accepted or rejected `CategorizationSuggestion` where applicable.
4. Mirror compatible legacy fields on `Transaction` during compatibility:
   - `categoryId`
   - `projectId`
   - `transactionTypeId`
   - `classificationSource = manual` for administrator decisions
   - `classificationRuleId = null` for manual decisions
5. Write supplemental `AuditLog` only as investigation support, not financial truth.

If any step fails, no booking, decision, suggestion, legacy mirror, or audit row may change.

## API transition

### Review read route

`GET /api/review` should continue to support the existing UI while optionally returning Packet A data:

- unresolved transactions;
- current `TransactionBooking` if present;
- pending `CategorizationSuggestion` rows ranked by status/rank;
- dimension choices for project, type, and category;
- legacy fields until UI migration is complete.

The route must not treat raw metadata or category-only state as final financial truth.

### Manual assignment route

The existing `PATCH /api/transactions/:id/category` route is category-only and cannot create a complete final booking.

Packet B must choose one safe path:

- preferred: add a new explicit review-decision route that requires all three dimensions;
- compatibility: keep the old route but reject category-only updates with a Dutch error explaining that `Klant`, `Type`, and `Category` are required;
- temporary compatibility: allow the old route only if the request supplies all three dimensions and is handled by the new review-decision service.

No route may mark a transaction as final manual truth with category alone.

### Clear review queue route

`POST /api/review/clear` must stop bulk-converting financial truth.

Allowed behavior:

- return a 409 or 400 Dutch error explaining that bulk approval is disabled because every transaction needs an explicit administrator decision; or
- convert it into a non-financial UI housekeeping endpoint with no financial mutation.

It must not update `Transaction.classificationSource` or create bookings without per-transaction decisions.

## Suggestion handling

Packet B is not required to generate new suggestions from imports or history.

It must support explicit suggestion rows that already exist or are created by tests:

- accept pending suggestion;
- reject pending suggestion;
- expire pending suggestion only if needed for service tests;
- preserve evidence and evidence hash;
- do not mutate suggestion dimensions, matcher, rank, score, confidence, or evidence.

Suggestion acceptance must create a booking only when all three dimensions are known from the suggestion and/or explicit administrator completion.

## Rule and historical limits

The existing `CategorizationRule` model remains category-only and user-scoped. Packet B must not claim category-only rules can create complete three-dimension `RULE` bookings.

Rules:

- Existing `categorizeTransaction` may continue returning legacy category-only rule data for import compatibility.
- Packet B must not create `RULE` bookings from category-only rule state.
- Historical replay and rule-model transition remain later work.

## Locked period behavior

Packet B must preserve existing locked-ledger protection.

If reconciliation locks are enabled and the transaction ledger is locked, mutation routes must reject booking assignment, booking change, booking removal, and suggestion acceptance with the existing Dutch locked-month error or an equivalent Dutch message.

## Evidence hash requirements

Packet B must introduce deterministic evidence hashing for service-created decisions.

The implementation should add a small pure helper, preferably in the review-decision service file unless reuse requires a separate helper:

- canonical JSON serialization with stable key ordering;
- string hash using Node `crypto` SHA-256;
- no volatile timestamp in the hash unless the timestamp is part of the decision evidence.

Targeted tests must prove stable hashes for reordered object keys.

## Suggested bounded task split

Packet B should be implemented as one bounded commit-sized work unit if validation stays manageable. Stop and ask for approval if it grows beyond the files listed above or requires schema changes.

### Step B1 — service boundary

Create the review-decision service and tests.

Acceptance:

- manual assignment requires all three dimensions;
- assignment creates or replaces `TransactionBooking`;
- assignment appends `ReviewDecision`;
- legacy transaction fields are mirrored in the same transaction;
- locked periods reject mutation;
- VIEWER or inactive membership cannot mutate;
- evidence hash is deterministic.

### Step B2 — route transition

Update review mutation routes and route tests.

Acceptance:

- category-only legacy route cannot silently create manual truth;
- explicit full-dimension assignment route or compatibility handler calls the service;
- clear review queue no longer bulk-converts financial truth;
- Dutch errors are returned for unsafe bulk actions and incomplete dimensions.

### Step B3 — legacy bulk helper removal/rejection

Update `clearReviewQueue` and `confirmTransactions` tests and behavior.

Acceptance:

- `clearReviewQueue` does not call `transaction.updateMany` to set `manual`;
- `confirmTransactions` cannot mark transactions manual without decisions;
- tests document the rejection path.

### Step B4 — client compatibility

Update client wrappers/helpers only if route contracts change.

Acceptance:

- existing UI compiles;
- API helpers expose the new explicit mutation path or properly surface the Dutch rejection error;
- no UI flow pretends category-only assignment is complete financial truth.

## Validation requirements

Minimum validation after Packet B implementation:

1. Focused review-decision service tests.
2. Focused review route tests.
3. Updated `reviewQueueService` and `categorizationService` tests.
4. Any changed helper/API tests.
5. Full test suite.
6. Server TypeScript build.
7. Production build.
8. High-risk scan over changed executable paths.
9. Documentation secret-material and runtime-execution scans.
10. Final `git status --short` confirming only approved paths and excluded Graphify artifacts.

Disposable database validation is not required for Packet B if no migration is added. If any schema or migration need emerges, stop for owner approval before changing it.

## Stop conditions

Stop before implementation or during implementation if any of these occur:

- schema or migration change appears necessary;
- service route changes require broad UI rewrites outside review helpers/API wrappers;
- existing data needs backfill or migration;
- production configuration or environment changes appear necessary;
- Graphify artifacts would be modified;
- validation fails twice for the same unclear reason;
- Packet B would need to include import, historical replay, rule-model transition, reports, or reconciliation rewrite.

## Proposed commit message after separate approval

```text
feat: enforce review decisions for classification changes
```

No commit is authorized by this proposal. Packet B implementation and any later commit require separate owner approval.



## Packet B implementation evidence

Packet B was implemented after owner approval of this bounded proposal. The implementation remains uncommitted.

Implemented files:

- `server/services/reviewDecisionService.ts`
- `server/routes/review.ts`
- `server/services/reviewQueueService.ts`
- `server/services/categorizationService.ts`
- `server/services/ruleEngine.ts`
- `src/libs/api.ts`
- `tests/services/reviewDecisionService.test.ts`
- `tests/routes/review.test.ts`
- `tests/services/reviewQueueService.test.ts`
- `tests/services/categorizationService.test.ts`
- `tests/services/ruleEngine.test.ts`
- documentation handoff updates

Implementation summary:

- Added an atomic review-decision service for manual booking assignment.
- Added deterministic canonical evidence hashing.
- Created or updated `TransactionBooking`, appended `ReviewDecision`, mirrored legacy transaction fields, and wrote supplemental `AuditLog` inside the service boundary.
- Required all three dimensions for manual assignment: `projectId`, `transactionTypeId`, and `categoryId`.
- Preserved locked-ledger rejection and admin-only mutation checks.
- Rejected unsafe `clearReviewQueue`, `confirmTransactions`, and category-only rule application bulk paths instead of marking rows manual.
- Updated the legacy category endpoint so category-only requests return a Dutch incomplete-dimensions error and full-dimension requests route through the service.
- Updated the client API wrapper to allow full-dimension payloads and surface Dutch server errors.
- Did not change Prisma schema or migrations.
- Did not import or backfill financial data.
- Did not change production configuration, Docker, dependencies, environment files, `.graphifyignore`, or `graphify-out/`.

Validation evidence:

- Focused Packet B tests passed: 16 tests across review-decision, review-route, review-queue, and categorization service coverage.
- Rule-engine focused tests passed: 9 tests.
- Server TypeScript build passed after repairing two type-check issues.
- Full suite passed: 55 files passed; 251 tests passed; 1 optional test skipped.
- Production build passed with 18 routes; the existing SWC lockfile warning remained pre-existing and no generated files changed.
- High-risk scan over server and test executable paths reported no findings.
- High-risk scan over `src/libs/api.ts` reported pre-existing client fetch/upload patterns; the Packet B diff in that file only expands the existing `updateCategory` payload and preserves server error text.

Current gate:

- Review Packet B diff and decide whether to commit. Do not push. Do not start Packet C, import financial data, create migrations, or change production configuration without separate approval.
