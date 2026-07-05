# Yeshua Academy Finance — Implementation Plan

Status: authoritative execution plan  
Depends on: `docs/PHILOSOPHY.md`, `docs/STRATEGY.md`, `docs/ROADMAP.md`  
Persistent run: `agent-f961650b-de17-4282-ab18-7a716cc72958`  
Commit policy: do not commit until the owner explicitly approves

## Purpose

This file converts the roadmap into concise, unambiguous tasks that an AI coding agent can execute safely. It is the authoritative source for task order, current status, acceptance criteria, and validation.

## Status legend

- `DONE`: implementation and required validation completed.
- `IMPLEMENTED`: code exists, but required validation is not complete.
- `CURRENT`: the exact next task.
- `TODO`: ready after dependencies are complete.
- `BLOCKED`: cannot proceed until the named blocker is resolved.
- `DEFERRED`: intentionally outside the current implementation phase.

## AI execution contract

For every task:

1. Lock source `yeshuaacademy-finance` and resume run `agent-f961650b-de17-4282-ab18-7a716cc72958`.
2. Read this plan and the exact files named by the task.
3. Verify Git status and do not overwrite unrelated changes.
4. Make the smallest coherent change that satisfies the task.
5. Add or update targeted tests.
6. Run the task validation exactly as specified.
7. Make at most one bounded repair attempt for a validation failure.
8. Update this plan and `docs/finance-rebuild-run.md` with evidence.
9. Do not import production data, alter production configuration, or change infrastructure unless the task explicitly permits it.
10. Do not commit until the owner explicitly approves.

A task is not complete merely because code was written. Its acceptance criteria and validation must pass.

## Current position

```text
Governance documentation: complete
Phase 1 implementation: complete
Phase 1 validation: 229 tests passed; server and production builds passed
Security review: executable/test paths clean; documentation scans clean
Phase 1 commit: 925a609 fix: make finance categorization review-safe
MODEL-001 domain proposal: approved after review; schema unchanged
MODEL-001 documentation commit: 73daabd docs: approve financial domain model
MODEL-002 additive schema slice: implemented, database-validated, and committed as d2afb18
MIGRATE-001 repository normalization: done and committed as d2afb18; local PostgreSQL database validation completed against the current active chain
MODEL-003 classification records: Packet A committed as 0196910; Packet B committed as b3b8afd
MODEL-004/005 statement, close, snapshot, and dispatch models: committed as 49386ad after disposable local PostgreSQL migration validation
Phase 3 Packet D sanitized local DB rehearsal writer: implemented and locally validated; no real historical import, production config, push, or Graphify changes
Phase 3 Packet E retained source hash hardening: implemented; no real owner-file import, production config, push, or Graphify changes
Phase 3 Packet F owner-approved local rehearsal: implemented and locally validated with owner files outside Git; no production import, production config, push, or Graphify changes
Phase 3 Packet G guarded dry-run service: implemented; default dry-run only, production execution blocked, no production import, production config, push, or Graphify changes
Phase 4 FLOW-001 monthly import preview foundation: implemented; retained-byte preview controls only, no bookings, period close, production import, production config, push, or Graphify changes
Phase 4 FLOW-002 deterministic categorization decisions: implemented; complete deterministic rule/replay decisions only, no bookings, period close, production import, production config, push, or Graphify changes
Phase 4 FLOW-003 evidence-rich Dutch review queue: implemented; admin-only read evidence, no bookings, period close, production import, production config, push, or Graphify changes
Current gate: FLOW-004 explicit rule creation from approved decisions; historical production import remains operator-gated
```

## Phase 0 — Governance and discovery

### GOV-001 — Create product philosophy

Status: `DONE`

Files:

- `docs/PHILOSOPHY.md`

Acceptance:

- Defines what the application is, how financial truth is handled, automation limits, Dutch-only UI, roles, source preservation, and lean product boundaries.
- Records owner decisions and decision hierarchy.

Validation:

- File exists and is readable.
- Content agrees with `docs/finance-rebuild-run.md`.

### GOV-002 — Create high-level strategy

Status: `DONE`

Files:

- `docs/STRATEGY.md`

Acceptance:

- Defines mission, strategic goals, pillars, delivery strategy, success measures, constraints, and non-goals.
- Does not introduce features outside the philosophy.

Validation:

- File exists and references `docs/PHILOSOPHY.md`.

### GOV-003 — Create phased roadmap

Status: `DONE`

Files:

- `docs/ROADMAP.md`

Acceptance:

- Covers governance, safe categorization, domain model, historical loading, monthly workflow, close, reports, Dutch UX, infrastructure, and hardening.
- Separates committed phases from owner-decision future features.

Validation:

- File exists and references philosophy, strategy, and this implementation plan.

### GOV-004 — Create AI implementation plan

Status: `DONE`

Files:

- `docs/IMPLEMENTATION_PLAN.md`

Acceptance:

- Contains unambiguous task IDs, statuses, dependencies, acceptance criteria, and validation.
- Marks already completed Phase 1 work accurately.

Validation:

- File exists and identifies `SAFE-006` as the next task.

### GOV-005 — Link authoritative documents and retire legacy plan authority

Status: `DONE`

Dependencies: GOV-001 through GOV-004

Files:

- `README.md`
- `docs/yeshua-ledger-lite-discovery-plan.md`
- `docs/finance-rebuild-run.md`

Actions:

1. Add a README section linking the four authoritative documents.
2. Add a clear historical/superseded notice to the old discovery plan without deleting it.
3. Update the rebuild handoff to state that philosophy, strategy, roadmap, and implementation plan govern future work.

Acceptance:

- A maintainer can identify the authoritative document hierarchy from README.
- The legacy discovery plan cannot be mistaken for the current plan.

Validation:

- Read the changed sections.
- Run `git diff` for the three files.

## Phase 1 — Safe categorization foundation

### SAFE-001 — Parse payment purpose as structured evidence

Status: `DONE`

Files changed:

- `lib/import/types.ts`
- `lib/import/normalizers.ts`
- `lib/import/csv_ING.ts`
- `lib/import/xlsx.ts`

Implemented behavior:

- Adds `paymentPurpose` and `normalizedPaymentPurpose` to normalized transactions.
- Preserves complete ING `Notifications` text.
- Keeps original external source columns unchanged.

Acceptance:

- CSV and XLSX parsers return original and normalized payment purpose.
- Empty payment purpose is safe.

Tests:

- `tests/import/normalizers.test.ts`
- `tests/import/parsers.test.ts`

### SAFE-002 — Permit approved rules to use payment purpose

Status: `DONE`

Files changed:

- `server/services/ruleEngine.ts`
- `server/services/categorizationService.ts`

Implemented behavior:

- Adds `paymentPurpose` as a rule condition field.
- Passes structured purpose evidence into rule evaluation.

Acceptance:

- A rule requiring counterparty and purpose text matches only when both conditions match.

Tests:

- `tests/services/ruleEngine.test.ts`
- `tests/services/categorizationService.test.ts`

### SAFE-003 — Remove unsafe automatic fallbacks

Status: `DONE`

Files changed:

- `server/services/categorizationService.ts`

Implemented behavior:

- Removes source/amount-history fallback.
- Removes normalized-description-history fallback.
- Removes global-popularity fallback.
- Returns a final category only for an approved active rule.

Acceptance:

- The service does not query transaction history when no approved rule matches.
- No popular category can be finalized automatically.

Tests:

- `tests/services/categorizationService.test.ts`

### SAFE-004 — Separate proposed categories from final bookings

Status: `DONE`

Files changed:

- `server/services/importService.ts`

Implemented behavior:

- Exact complete historical replays may remain final `history` matches.
- Approved rules may remain final `rule` matches.
- Fuzzy ledger matches, best-history guesses, description/account/amount reuse, and direction defaults are review-only.
- Stores `suggestedCategoryId` separately from final `categoryId` in suggestion metadata.
- Unresolved transactions use the review category and `classificationSource: import`.

Acceptance:

- Fuzzy or heuristic evidence never writes its proposed category as the final booked category.
- Review metadata retains proposed category and confidence.

Tests:

- `tests/import/integration.test.ts`

### SAFE-005 — Use Dutch review placeholder wording

Status: `DONE`

Files changed:

- `server/services/importService.ts`
- `src/helpers/review-page.ts`
- `tests/helpers/reviewPage.test.ts`

Implemented behavior:

- New review placeholder is `Beoordeling nodig`.
- Existing English placeholder values remain recognized for backward compatibility.

Acceptance:

- Dutch placeholder is excluded from normal selectable categories.

### SAFE-006 — Correct remaining review-confidence assertion

Status: `DONE`

Dependencies: SAFE-001 through SAFE-005

Files:

- `tests/import/integration.test.ts`

Action:

- Change the single remaining expected suggestion confidence from `fuzzy` to `overall` in the test that keeps account/counterparty history guesses in review.

Acceptance:

- Test still asserts:
  - `autoCategorizedCount` is zero;
  - `pendingReviewCount` is one;
  - final category is not `cat-history`;
  - `classificationSource` is `import`;
  - suggested category metadata is `cat-history`;
  - confidence is `overall`.

Validation:

- Complete suite passed in `validation-ac16934d-7e51-4284-9914-1231816ed7bf`.
- Result: 51 test files passed; 229 tests passed, including the added normalized-fallback review regression.

### SAFE-007 — Validate Phase 1 builds

Status: `DONE`

Dependencies: SAFE-006

Actions:

1. Run `npm run build:server`.
2. Run `npm run build`.

Acceptance:

- Server TypeScript build passed in `validation-3fc58e7d-130f-407a-9313-1befd26ff2d8`.
- Prisma generation and Next.js production build passed in `validation-1cdb6122-650a-4be0-af29-038453621e64`.
- The existing lockfile/SWC warning is recorded as non-blocking; it did not change files or fail the build.

### SAFE-008 — Review and security-scan Phase 1

Status: `DONE`

Dependencies: SAFE-007

Actions:

1. Review complete diff for all changed Phase 1 and governance paths.
2. Confirm no financial source files, secrets, `.env`, production configuration, database migrations, or Docker changes are included.
3. Run `forbidden_all_high_risk` over executable and test paths.
4. Run secret-material and runtime-execution scans over documentation paths.
5. Review documentation-only upload-keyword findings as expected workflow language, not executable network behavior.
6. Update this plan and `docs/finance-rebuild-run.md` with validation evidence.

Acceptance:

- Diff is limited to intended governance documentation, categorization safety, parsing, and tests.
- Executable and test paths have no high-risk findings.
- Documentation has no secret-material or runtime-execution findings.
- Six upload-keyword findings are confirmed as legitimate descriptions of the ING import workflow.
- No commit is created.

### SAFE-009 — Owner review and optional commit

Status: `DONE`

Commit:

- Hash: `925a609`
- Message: `fix: make finance categorization review-safe`
- Scope: 21 explicit governance and Phase 1 paths
- Excluded: `.graphifyignore`, `graphify-out/`, financial source files, Docker, dependencies, Prisma migrations, and production configuration

## Phase 2 — Financial domain model

### MODEL-001 — Specify exact domain entities and invariants

Status: `DONE`

Dependencies: SAFE-009

Approval:

- Final owner approval granted after full review of revised `docs/DOMAIN_MODEL.md`.
- The four MODEL-001 documentation files were authorized for a focused commit.
- `.graphifyignore` and `graphify-out/` remained excluded.

Commit:

- Hash: `73daabd`
- Message: `docs: approve financial domain model`
- Scope: `docs/DOMAIN_MODEL.md`, `docs/IMPLEMENTATION_PLAN.md`, `docs/ROADMAP.md`, and `docs/finance-rebuild-run.md`
- Excluded: `.graphifyignore`, `graphify-out/`, Prisma, migrations, financial source files, Docker, dependencies, and production configuration

Review revisions resolved:

- non-negative `amountMinor` with sign determined only by explicit direction;
- shared `FinanceWorkspace` ownership separated from human users, memberships, roles, and actor evidence;
- exact historical replay provenance on every `HISTORICAL` automatic booking;
- account- and period-scoped statement reconciliation with partial July 2026 unable to close;
- explicit report-line discriminator and application-level HTML/XLSX/PDF completeness.

Files:

- `docs/DOMAIN_MODEL.md`
- `docs/IMPLEMENTATION_PLAN.md`
- `docs/finance-rebuild-run.md`
- `prisma/schema.prisma` for inspection only

Action:

- Write the exact proposed fields and relationships for `Klant`, `Type`, `Category`, historical labels, suggestions, decisions, statement controls, period closes, report snapshots, dispatches, and retained source files.

Acceptance:

- Every field exists to satisfy a confirmed workflow.
- Historical labels cannot be overwritten by canonical metadata.
- Suggestions cannot be mistaken for final bookings.

Validation:

- Reviewed `docs/DOMAIN_MODEL.md` against the current Prisma schema and the review, import-file, reconciliation, reporting, email, and audit contracts.
- Final secret-material scan after the owner-review revisions: no findings.
- Final runtime-execution scan after the owner-review revisions: no findings.
- Final documentation diff reviewed; only `docs/DOMAIN_MODEL.md`, this plan, the roadmap, and the rebuild handoff changed.
- `prisma/schema.prisma` remains unchanged; no migration or implementation write occurred.

### MODEL-002 — Implement explicit `Klant`, `Type`, and `Category` model

Status: `IMPLEMENTED`

Dependencies: MODEL-001 and owner approval of proposed schema

Files:

- `prisma/schema.prisma`
- `prisma/migrations/20260703001200_add_workspace_dimensions/migration.sql`
- `tests/services/model002DomainSchema.test.ts`
- `server/services/importService.ts`, `server/services/categorizationService.ts`, and `server/routes/review.ts` inspected for compatibility; no write required because the additive schema preserves the legacy category contract.

Implemented:

- Added `FinanceWorkspace`, `WorkspaceMembership`, and `WorkspaceRole`.
- Added workspace-scoped `Project` (`Klant`) and `TransactionType` (`Type`).
- Added workspace scope and historical metadata to the existing `Category` model while retaining exact labels under the legacy `name` field.
- Added optional `projectId` and `transactionTypeId` relations to `Transaction`; existing `categoryId` remains intact.
- Seeded one Yeshua Academy workspace and one `ADMIN` membership per existing user without changing actor identities.
- Preserved every existing field, category label, transaction, and financial record; no historical-data import occurs.

Acceptance:

- Every transaction can reference all three required dimensions independently.
- Literal historical category labels are retained byte-for-byte in the existing `name` field.
- Existing categories are assigned to the default workspace without rename, deletion, or merge.
- The legacy global category-name uniqueness remains temporarily for service compatibility; workspace compound uniqueness is also present.

Validation:

- Focused MODEL-002 tests: 3 static tests passed; 1 guarded disposable-database test skipped because no local admin URL is configured.
- Full suite after the validation-test update: 52 test files, 232 tests passed, and 1 database test skipped.
- High-risk security scan over schema, migration, and test: no findings.
- `prisma format`: passed.
- Prisma Client generation: passed during production `prebuild`.
- Server TypeScript build: passed after the review update.
- Next.js production build: passed after the review update; 18 routes generated.
- Direct `prisma validate` remains environment-blocked because no standalone `DATABASE_URL` is available.
- The new migration itself remains additive: tables, columns, indexes, and foreign keys only; no category rename, category delete, transaction insert, or destructive `DROP`.
- Empty-database migration review found three pre-schema replay defects before MODEL-002 runs: `20241121_add_categorization_rule_conditions` and `20241125_add_categorization_rule_conditions` alter `CategorizationRule` before it is created and duplicate the same column addition; `20250226140000_import_fingerprint` alters `Transaction` before the finance initializer creates it.
- `20251003194500_ledger_init` is the first finance-schema initializer, but no individual legacy migration represents the complete pre-MODEL-002 state.
- Therefore the full migration history cannot be replayed safely on a fresh disposable database in its current form; this is independent of the MODEL-002 SQL content.

Review decision: revisions required before `DONE`, approval, or commit:

- `docs/MIGRATION_HISTORY_NORMALIZATION_PROPOSAL.md` defines the exact inventory, baseline commit, active and archived layout, commands, isolated-database checks, existing-database adoption controls, and rollback boundaries.
- The owner approved the proposal as the MIGRATE-001 implementation specification.
- The 17 pre-MODEL-002 migration directories are archived byte-identically; `0_finance_baseline` is generated from the audited pre-MODEL-002 snapshot; the MODEL-002 migration remains unchanged after the baseline.
- No real or production database operation, migration metadata change, or commit is authorized.

### MIGRATE-001 — Normalize the Prisma migration history

Status: `DONE`

Dependencies: MODEL-002 review finding and owner approval of `docs/MIGRATION_HISTORY_NORMALIZATION_PROPOSAL.md`

Changed files:

- `docs/MIGRATION_HISTORY_NORMALIZATION_PROPOSAL.md`
- `docs/IMPLEMENTATION_PLAN.md`
- `docs/finance-rebuild-run.md`
- `prisma/migrations/0_finance_baseline/migration.sql`
- `prisma/migrations-legacy-pre-baseline/MANIFEST.md`
- `prisma/migrations-legacy-pre-baseline/SHA256SUMS`
- `prisma/migrations-legacy-pre-baseline/PRE_MODEL002_SCHEMA.prisma`
- the 17 byte-identical archived pre-MODEL-002 migration directories
- the unchanged active `prisma/migrations/20260703001200_add_workspace_dimensions/migration.sql`
- `tests/services/model002DomainSchema.test.ts`
- `scripts/validate-migrate-001.mjs`

Implemented:

- Archived all 17 pre-MODEL-002 migration directories byte-identically.
- Recorded original migration hashes and verified them through focused tests.
- Stored and formatted the audited pre-MODEL-002 Prisma schema snapshot.
- Generated `0_finance_baseline` with `prisma migrate diff --from-empty` from that snapshot.
- Reduced the active history to the baseline followed by the unchanged MODEL-002 migration.
- Added tests for active order, archive integrity, MODEL-002 hash stability, data-free baseline contents, and localhost-only disposable database validation.
- Added a guarded localhost-only validation runner for disposable database preparation, financial and relational invariant verification, and cleanup.

Fresh-database validation:

- Created a uniquely named empty database through peer-authenticated PostgreSQL on the local `/tmp` socket.
- `prisma migrate deploy` applied `0_finance_baseline` and MODEL-002 in order.
- `prisma migrate status` reported the schema up to date.
- Database-to-current-schema diff reported no difference.
- Database-backed `prisma validate` and Prisma Client 6.19.3 generation passed.
- Both finished migration rows and the deterministic default workspace were verified.

Existing-database adoption validation:

- Created a separate disposable database containing the pre-MODEL-002 schema and seeded financial fixtures.
- Preserved one user, two exact historical category labels, one account, and two transactions.
- Preserved transaction count `2`, total minor amount `19134`, credit total `12345`, debit total `6789`, and the exact fixture date range.
- `prisma migrate resolve --applied 0_finance_baseline` recorded the baseline without replaying it.
- `prisma migrate deploy` applied only MODEL-002.
- Migration status was up to date and database-to-current-schema diff reported no difference.
- Category IDs and literal names, transaction totals and dates, user identity, and table counts remained unchanged.
- The default workspace, ADMIN membership, nullable new dimensions, seven expected foreign keys, and five expected unique indexes were verified.

Cleanup and final regression validation:

- Dropped both uniquely named disposable databases and removed the `.migrate001-validation-*` workspace.
- Reran idempotent cleanup with no repository changes.
- Focused normalized-history tests: 6 passed; only the optional environment-driven database test skipped.
- Full suite: 52 files, 235 tests passed, 1 optional test skipped.
- Baseline snapshot `prisma format`: passed.
- Server TypeScript build passed.
- Prisma Client generation and Next.js production build passed with 18 routes.
- High-risk scan over schema, migrations, audit snapshot, test, and validation runner: no findings.
- Documentation secret-material and runtime-execution scans: no findings.
- No real or production database, financial-data import, Docker, dependency, environment, production configuration, `.graphifyignore`, or `graphify-out/` change occurred.

Current-chain local PostgreSQL validation, 2026-07-04:

- Brain documentation was read first. The applicable convention is OrbStack as the local container runtime, plain `postgres:16` for local databases, one local database port in the `5400-5499` range, and persistent standalone definitions under `brain/operations/database/standalone/<app>/docker-compose.yml` when a project needs a permanent local database.
- No documented persistent Yeshua Finance local database stack existed, so validation used a temporary localhost-only disposable OrbStack Postgres container on `localhost:5458`; the container was stopped and removed afterward.
- `SYSTEM_DATABASE_URL` targeted only the local `postgres` maintenance database at `localhost:5458`; username and password were present and the localhost guard passed. No production, Dokploy, MCP bridge, remote, or `10.0.2.4` database was used.
- The active migration directories were exactly `prisma/migrations/0_finance_baseline`, `prisma/migrations/20260703001200_add_workspace_dimensions`, and `prisma/migrations/20260703193000_add_classification_records`.
- Guarded marker test `tests/services/model002DomainSchema.test.ts` executed the database replay and passed with `7 passed` and no skip.
- Fresh current-chain database `yaf_migrate001_fresh_20260704122427_8458`: `prisma migrate deploy` applied all three migrations; `prisma migrate status` reported the database schema up to date; `prisma validate` was valid; `prisma generate` passed; `prisma migrate diff` reported no difference.
- Adoption rehearsal database `yaf_migrate001_adopt_20260704122514_32649`: applied `0_finance_baseline` manually; seeded only a synthetic fixture with one user, two categories, one account, and two transactions; `prisma migrate resolve --applied 0_finance_baseline` passed; `prisma migrate deploy` applied MODEL-002 and MODEL-003 Packet A migrations successfully.
- Adoption validation confirmed original counts, IDs, labels, transaction total `19134`, credit total `12345`, debit total `6789`, and date range `2026-01-05 10:00:00` through `2026-02-06 11:30:00` remained stable.
- MODEL-002 workspace and membership structures existed; MODEL-003 tables, enums, and foreign-key relations existed; no external historical finance data was inserted. Historical import remains a later task.
- Both disposable databases were dropped. No `.env`, production config, Prisma schema, migration, test, server, source, `.graphifyignore`, or `graphify-out/` file was changed by this validation task. No commit or push was made.

Current gate:

- Committed as `d2afb18735dce113a69d9ad40c3c8e4b3ce562df`. Do not push without explicit approval.

### MODEL-003 — Implement immutable suggestion and review-decision records

Status: `PACKET_B_IMPLEMENTED_VALIDATED`

Dependencies: MODEL-002 and MIGRATE-001 committed as `d2afb18735dce113a69d9ad40c3c8e4b3ce562df`; MIGRATE-001 local PostgreSQL validation completed against the current active chain; Packet A committed as `019691091bb1b4b75d1c822d05f3d4e08cadface`; Packet B implemented and validated but commit not approved

Design gate file:

- `docs/MODEL_003_CLASSIFICATION_RECORDS_PROPOSAL.md`

Design decisions prepared for owner review:

- `TransactionBooking` is the current final three-dimension classification and unresolved transactions have no booking.
- `CategorizationSuggestion` is append-only ranked evidence and never becomes final without an explicit `ReviewDecision`.
- `ReviewDecision` is immutable administrator decision history and is the financial source of truth; generic `AuditLog` is supplementary.
- Existing `Transaction` classification fields remain during additive compatibility and are not dropped in the first implementation slice.
- Backfill is conservative: no missing dimension, actor, suggestion, decision, rule provenance, or historical replay evidence may be fabricated.
- The existing category-only rule model cannot authorize a final three-dimension `RULE` booking until a later approved rule-model transition exists.
- Review writes must validate workspace, ADMIN membership, unlocked-period state, dimensions, suggestion state, provenance, booking update, decision append, compatibility mirroring, and supplemental audit in one database transaction.
- Unsafe `clearReviewQueue` / `confirmTransactions` bulk conversion must be removed, disabled, or rejected; it must not become manual truth without per-transaction decisions.

Packet A implementation evidence:

- Added additive Prisma models/enums for `TransactionBooking`, `CategorizationSuggestion`, and `ReviewDecision`.
- Added `prisma/migrations/20260703193000_add_classification_records/migration.sql`.
- Added `tests/services/model003ClassificationRecords.test.ts` and updated migration-history coverage.
- Preserved all legacy `Transaction` classification fields and did not import or backfill financial data.
- Disposable PostgreSQL deploy applied all three active migrations and database-to-schema diff reported no difference.
- Focused MODEL-003 tests passed: 6 tests passed.
- Full suite passed: 53 files passed; 241 tests passed; 1 optional test skipped.
- Server TypeScript build passed.
- Prisma Client generation and Next.js production build passed with 18 routes.
- Packet A executable high-risk scan reported no findings.

Packet B proposal:

- `docs/MODEL_003_PACKET_B_PROPOSAL.md`

Prepared Packet B boundary:

- Add one atomic review-decision service over Packet A tables.
- Route review mutations through that service.
- Disable or reject unsafe `clearReviewQueue` / `confirmTransactions` bulk conversion.
- Keep legacy `Transaction` fields as compatibility mirrors.
- Add targeted service, route, helper, and API tests as needed.
- Stop before schema/migration, import, production configuration, Graphify, or broad UI changes.

Packet B implementation evidence:

- Added `server/services/reviewDecisionService.ts` as the atomic review-decision service.
- Updated review mutation route, review queue helper, categorization bulk-confirm helper, rule application, client API wrapper, and targeted tests.
- Manual review assignment now requires `projectId`, `transactionTypeId`, and `categoryId`.
- Unsafe bulk confirmation and category-only rule application now reject with a Dutch explanation instead of creating manual truth.
- Legacy `Transaction` fields remain compatibility mirrors.
- No schema, migration, financial-data import, production configuration, Docker, dependency, environment, `.graphifyignore`, or `graphify-out/` change was made.
- Focused Packet B tests passed: 16 tests.
- Rule-engine focused tests passed: 9 tests.
- Server TypeScript build passed.
- Full suite passed: 55 files passed; 251 tests passed; 1 optional test skipped.
- Production build passed with 18 routes and the pre-existing SWC lockfile warning.
- Server/test executable high-risk scan reported no findings; `src/libs/api.ts` scan findings were pre-existing client fetch/upload patterns and the diff only expands the existing category endpoint payload/error handling.

Current gate:

- Review Packet B diff and decide whether to commit. Do not push, import financial data, create migrations, modify production configuration, or touch `.graphifyignore` / `graphify-out/` without separate approval.

### MODEL-004 — Implement statement controls and source-file retention model

Status: `DONE`

Dependencies: MODEL-002

Acceptance:

- Stores original file bytes unchanged, hash, filename, size, account, period, row count, opening, income, expenses, and closing.
- Original file can be downloaded byte-identically.
- Duplicate file hashes cannot create duplicate statements.

Validation:

- Upload/download byte comparison tests.
- Statement-control tests.

Implementation evidence:

- Added additive Prisma models and migration `20260704143000_add_statement_close_report_models` for `SourceFile`, `BankStatement`, and `StatementPeriod`.
- Added `server/services/statementControlService.ts` for SHA-256 retained-file hashing, byte-identical download, exact statement total checks, duplicate source-file rejection, and period creation.
- Added `tests/services/statementControlService.test.ts`; focused tests passed: 4 tests.
- Disposable local PostgreSQL validation used existing OrbStack Postgres on `localhost:5452` and disposable database `yaf_model004005_validate_20260704170627_16917`; no production, Dokploy, MCP bridge, or `10.0.2.4` database was used, and the disposable database was dropped afterward.
- `prisma migrate deploy` applied all four active migrations including `20260704143000_add_statement_close_report_models`; `prisma migrate status` reported the schema up to date; `prisma validate` and `prisma generate` passed; `prisma migrate diff` reported no difference.
- Focused MODEL-004 tests passed: 4 tests.
- Migration-chain marker passed: 6 passed, 1 skipped.
- Full suite passed: 57 files, 261 tests passed, 1 skipped.
- Server TypeScript build and production build passed; production build generated 18 routes and retained the pre-existing SWC lockfile warning.
- Changed executable/test path scan found only expected local-only database guard and Prisma datasource references; documentation secret-material and risky runtime-execution scans reported no findings.
- Committed as `49386ad feat: add statement controls and close reporting models`.

### MODEL-005 — Implement period-close, report-snapshot, and dispatch model

Status: `DONE`

Dependencies: MODEL-002

Acceptance:

- Closed period controls and report figures are immutable.
- Reopen metadata and report-send metadata are auditable.

Validation:

- Model/service tests and disposable migration.

Implementation evidence:

- Added additive Prisma models and migration coverage for `PeriodClose`, `ReportSnapshot`, `ReportSnapshotPeriodClose`, `ReportSnapshotLine`, `ReportArtifact`, `ReportApproval`, `ReportDispatch`, and `ReportDispatchRecipient`.
- Added `server/services/periodCloseService.ts` for balanced-close enforcement, immutable close hashing, audited reopen metadata, frozen snapshot creation, report approval, and dispatch recipient hashing.
- Added `tests/services/periodCloseService.test.ts`; focused tests passed: 6 tests.
- Disposable local PostgreSQL validation used existing OrbStack Postgres on `localhost:5452` and disposable database `yaf_model004005_validate_20260704170627_16917`; no production, Dokploy, MCP bridge, or `10.0.2.4` database was used, and the disposable database was dropped afterward.
- `prisma migrate deploy` applied all four active migrations including `20260704143000_add_statement_close_report_models`; `prisma migrate status` reported the schema up to date; `prisma validate` and `prisma generate` passed; `prisma migrate diff` reported no difference.
- Focused MODEL-005 tests passed: 6 tests.
- Migration-chain marker passed: 6 passed, 1 skipped.
- Full suite passed: 57 files, 261 tests passed, 1 skipped.
- Server TypeScript build and production build passed; production build generated 18 routes and retained the pre-existing SWC lockfile warning.
- Changed executable/test path scan found only expected local-only database guard and Prisma datasource references; documentation secret-material and risky runtime-execution scans reported no findings.
- Committed as `49386ad feat: add statement controls and close reporting models`.

## Phase 3 — Historical data foundation

### HIST-000 — Rehearse sanitized fixture import locally

Status: `DONE`

Dependencies: MODEL-004 through MODEL-005 and Phase 3 Packet C planner

Acceptance:

- Uses only fixture-derived import plans.
- Writes only synthetic retained source bytes.
- Creates statement, period, transaction, dimension, and booking records in a disposable local database.
- Keeps the partial 2026 statement not close-eligible.
- Does not read owner source files or import real historical data.

Validation:

- Disposable local PostgreSQL validation used existing Brain/OrbStack Postgres on `localhost:5452`.
- Disposable migration database `yaf_packetd_rehearsal_20260704195805_69949` applied all four active migrations with `prisma migrate deploy`, reported up to date with `prisma migrate status`, passed `prisma validate`, passed `prisma generate`, and reported no difference with `prisma migrate diff`.
- The disposable migration database was dropped after validation.
- DB-backed rehearsal test created and dropped its own unique disposable local database.
- Focused historical import rehearsal tests passed: 2 tests.
- Focused historical import planner tests passed: 3 tests.
- Focused MODEL-002 additive domain schema tests passed: 7 tests.
- Full suite passed: 63 files, 273 tests.
- Server TypeScript build passed.
- Production build passed with 18 routes and retained the pre-existing Next/SWC lockfile warning.
- Changed executable/test scan found only expected local-only database guard, fixture reads, and disposable database create/drop operations.
- Secret-material scan found only placeholder/local database URL examples.

Packet E hardening:

- Sanitized rehearsal now stores the SHA-256 of the retained synthetic bytes in `SourceFile.sha256`.
- Planner/source inventory hashes are preserved only as sanitized metadata and are not faked as retained-byte hashes.
- The DB-backed rehearsal test asserts `SourceFile.sha256` equals the hash of `SourceFile.content`, retained content is synthetic, fixture row labels are absent, and repeated rehearsal remains idempotent.
- Added a pure owner-local rehearsal adapter design for the future approved gate; it validates absolute owner paths outside Git and local-only database targets, but does not read files or execute an import.
- No Prisma schema or migration change was required.

Packet F owner-approved local rehearsal:

- Added an owner-local rehearsal adapter that reads only the four approved absolute owner source paths outside Git, verifies their expected SHA-256 hashes, parses 2024/2025 workbooks plus the 2026 ING CSV/PDF pair, and builds deterministic import plans.
- Added retained-byte support to the rehearsal writer so the disposable local database stores exact source bytes and verifies `SourceFile.sha256` against `SourceFile.content`.
- The real 2026 ING CSV is normalized into chronological order before control computation; the source rows themselves remain retained unchanged.
- Sanitized controls matched the verified baselines: 2024 has 268 rows and closes at EUR 12,184.15; 2025 has 413 rows and closes at EUR 10,350.86; the 2026 partial statement has 221 rows and closes at EUR 7,837.25.
- Owner-local rehearsal created only disposable local PostgreSQL databases on `localhost:5452`, dropped them after validation, and left no disposable rehearsal or migration databases behind.
- Focused owner-local rehearsal, sanitized rehearsal, planner, and owner-file adapter tests passed; the full suite passed with 65 files and 277 tests.
- No production, Dokploy, MCP bridge, `10.0.2.4`, `.env`, `.graphifyignore`, `graphify-out/`, owner-file copy, raw row dump, generated output commit, or push occurred.

Packet G guarded dry-run service:

- Added `server/services/historicalOwnerImportCommandService.ts` as the production-safe service surface for future CLI/UI wiring.
- Default mode is `dry-run`; it reuses the owner-local parser/planner to return only sanitized file names, hashes, row counts, control totals, duplicate counts, and close eligibility.
- The service returns no raw rows, no payment-purpose text, no counterparty values, and no retained file bytes.
- Production mode is represented as `production-blocked`; Packet G intentionally does not perform production writes.
- Future production execution remains blocked without an explicit production option, reviewed dry-run acceptance, an operator confirmation token, and a source-bound confirmation token.
- Rehearsal mode refuses non-local DB targets and always rejects `10.0.2.4`.
- Focused command-service tests cover dry-run defaults, sanitized output, production blocking, hash mismatch blocking, local-only rehearsal guards, owner paths inside Git, and 2024/2025/2026 close eligibility.
- No Prisma schema or migration change was required.
- Validation passed: focused command-service tests (8 tests), owner-local rehearsal tests (2 tests), sanitized rehearsal service tests (2 tests), historical import planner tests (3 tests), full suite (66 files, 285 tests), Prisma validate/generate, server build, production build (18 routes), `git diff --check`, changed executable/test high-risk scan, documentation secret-material scan, and changed-documentation runtime scan.
- Disposable local rehearsal databases created during validation were dropped; the final cleanup check found zero matching disposable databases.
- No production, Dokploy, MCP bridge, `10.0.2.4`, `.env`, `.graphifyignore`, `graphify-out/`, owner-file copy, raw row dump, generated output commit, or push occurred.

### HIST-001 — Build exact concluded-workbook parser

Status: `TODO`

Dependencies: MODEL-002 through MODEL-004

Acceptance:

- Reads exact source sheets and columns.
- Derives dates only from raw ING `Date`.
- Preserves literal `Klant`, `Type`, and `Category`.
- Uses resolved `Verduidelijking` content as interpretation evidence.

Validation:

- Fixture tests against copies or sanitized deterministic fixtures.

### HIST-002 — Load and reconcile 2024 in disposable database

Status: `TODO`

Dependencies: HIST-001

Acceptance:

- 268 transactions.
- Opening EUR 1,721.86.
- Income EUR 32,267.19.
- Expenses EUR 21,804.90.
- Closing EUR 12,184.15.
- Literal labels unchanged.

### HIST-003 — Load and reconcile 2025 in disposable database

Status: `TODO`

Dependencies: HIST-002

Acceptance:

- 413 transactions.
- Opening EUR 12,184.15.
- Income EUR 91,642.44.
- Expenses EUR 93,475.73.
- Closing EUR 10,350.86.
- FR history unchanged.
- First literal FTK transaction defines practical transition point.

### HIST-004 — Import supplied 2026 statement as open

Status: `TODO`

Dependencies: HIST-003

Acceptance:

- 221 transactions.
- Opening EUR 10,350.86.
- Income EUR 58,784.08.
- Expenses EUR 61,297.69.
- Closing EUR 7,837.25.
- Zero running-balance continuity errors.
- July remains open.
- Categorization runs in safe suggestion mode.

## Phase 4 — Monthly import and review

### FLOW-001 — Implement controlled ING import preview

Status: `IMPLEMENTED`

Dependencies: HIST-004 production execution remains operator-gated; Packet G dry-run evidence is available

Acceptance:

- Dutch preview shows account, period, counts, duplicates, overlap, and statement totals before commit.
- Failed controls prevent commit.
- Original uploaded CSV bytes are hashed with retained-byte semantics and represented as a SourceFile-compatible preview summary.
- Duplicate import fingerprints are detected against existing transactions when a duplicate lookup is supplied.
- The preview does not create `Transaction`, `TransactionBooking`, `PeriodClose`, report, dispatch, production import, or production configuration records.
- The `/api/upload/preview` route returns a Dutch preview response and leaves `/api/upload` import behavior unchanged.
- 2026-style partial/open statements remain not close-eligible.

Validation:

- Focused monthly import preview service and route tests cover retained-byte hashing, statement totals, running-balance success/failure, duplicate fingerprints, non-booking behavior, partial close blocking, non-CSV rejection, malformed ING CSV rejection, and sanitized output.
- Full validation passed and is recorded in `docs/finance-rebuild-run.md`: focused monthly preview tests, ING CSV parser regression, historical owner import command regression, full suite, Prisma validate/generate, server build, production build, diff check, executable/test high-risk scan, and documentation scans.

### FLOW-002 — Implement deterministic automatic categorization service

Status: `IMPLEMENTED`

Dependencies: FLOW-001 and MODEL-003

Acceptance:

- Only approved unique rules and complete exact replays finalize categories.
- Conflicting matches produce review suggestions.
- Finalization requires a complete `projectId`, `transactionTypeId`, and `categoryId`.
- A single approved complete deterministic rule can finalize a candidate.
- A complete exact historical replay can finalize a candidate.
- Rule and historical replay agreement can finalize a candidate.
- Multiple rules, multiple historical dimension triples, missing dimensions, non-exact confidence, or rule/history disagreement do not finalize.
- The service returns sanitized deterministic evidence and side-effect flags, but creates no `TransactionBooking`, `PeriodClose`, production import, or production configuration records.
- Monthly preview can optionally summarize deterministic categorization counts without exposing per-row evidence or creating transactions/bookings/closes.

Validation:

- Focused deterministic categorization tests cover unique complete rules, inactive/unapproved rules, multiple rules, complete and partial historical replay, ambiguous historical replay, rule/history agreement, rule/history conflict, mixed complete/partial evidence, missing dimensions, sanitized evidence, and no booking/close side effects.
- Full validation passed and is recorded in `docs/finance-rebuild-run.md`: focused deterministic categorization tests, monthly preview regression, categorization service, rule engine, review queue, review decision, full suite, Prisma validate/generate, server build, production build, diff check, executable/test high-risk scan, and documentation scans.

### FLOW-003 — Implement evidence-rich Dutch review queue

Status: `IMPLEMENTED`

Dependencies: FLOW-002

Acceptance:

- Shows date, counterparty, IBAN, amount, direction, full payment purpose, proposed `Klant`, `Type`, `Category`, evidence, confidence, and alternatives.
- Shows deterministic statuses for finalized candidates, review suggestions, conflicts, and unmatched items.
- Preserves exact `Klant`, `Type`, and `Category` labels from existing dimension records.
- Route/API output is admin-only and does not return retained file bytes, source-file contents, owner workbook dumps, or raw source rows.
- Queue display creates no `TransactionBooking` or `PeriodClose` records.
- Administrator approval still flows only through the existing reviewed-decision path with complete `projectId`, `transactionTypeId`, and `categoryId`.
- Unsafe bulk acceptance remains disabled.

Validation:

- Focused review queue tests cover enriched Dutch evidence, deterministic sorting, finalized candidates, conflicts, incomplete candidates, alternatives, historical hashes, rule ids, sanitization, and no booking/close side effects.
- Focused review route tests cover admin-only behavior and evidence-rich read responses without approving anything.
- Focused review page helper tests cover Dutch evidence status and summary labels.
- Full validation passed and is recorded in `docs/finance-rebuild-run.md`: review queue, review decision, review route, review page, deterministic categorization, monthly import preview, full suite, Prisma validate/generate, server build, production build, diff check, executable/test high-risk scan, and documentation scans.

### FLOW-004 — Implement explicit rule creation from approved decision

Status: `IMPLEMENTED`

Dependencies: FLOW-003

Acceptance:

- Rule creation is a separate administrator choice.
- Rule conditions and expected `Klant`, `Type`, and `Category` are previewed before activation.
- Activation requires an explicit confirmation and the current preview hash.
- Ambiguous, broad, duplicate, conflicting, incomplete, or non-exact rules are rejected.
- Rule preview and activation do not create `TransactionBooking`, `PeriodClose`, production import, or production configuration records.
- The implementation uses the existing `CategorizationRule` persistence model; complete expected dimensions are previewed and validated before activation, while the current rule row remains category-scoped until a later schema slice adds first-class rule dimensions.

Validation:

- Focused rule creation service tests cover preview-only behavior, explicit activation, hash validation, broad/ambiguous rejection, conflicting active rule rejection, and admin-only access.
- Focused review route tests cover admin-only preview/activation routes and confirm preview does not activate a rule.
- Focused review page helper tests cover Dutch rule creation activation labels.
- Surrounding rule engine, categorization, review queue, review decision, deterministic categorization, and monthly import preview regressions passed locally.
- Full validation passed and is recorded in `docs/finance-rebuild-run.md`: focused FLOW-004 tests, surrounding review/categorization regressions, full suite, Prisma validate/generate, server build, production build, diff check, changed executable/test high-risk scan, and documentation scans.

## Phase 5 — Reconciliation and close

### CLOSE-001 — Implement statement reconciliation controls

Status: `TODO`

Dependencies: FLOW-003

Acceptance:

- Opening + income - expenses equals closing exactly.
- Transaction totals and statement totals agree.

### CLOSE-002 — Implement category control totals

Status: `TODO`

Dependencies: CLOSE-001

Acceptance:

- Sum of category income equals total income.
- Sum of category expenses equals total expenses.
- All three dimensions are present for every final transaction.

### CLOSE-003 — Implement strict close gate and lock

Status: `TODO`

Dependencies: CLOSE-002

Acceptance:

- No unresolved reviews.
- All differences are EUR 0.00.
- Partial periods cannot close.
- Closed snapshot is immutable.

### CLOSE-004 — Implement audited reopen

Status: `TODO`

Dependencies: CLOSE-003

Acceptance:

- Administrator-only.
- Requires reason.
- Writes audit event.
- Invalidates later report approval where necessary.

## Phase 6 — Reports and distribution

### REPORT-001 — Implement snapshot-based monthly report

Status: `TODO`

Dependencies: CLOSE-003

Acceptance:

- Dutch visual report shows balances and totals by exact `Klant`, `Type`, and `Category`.
- Every figure drills down to transactions.

### REPORT-002 — Implement snapshot-based yearly report

Status: `TODO`

Dependencies: REPORT-001

Acceptance:

- Uses closed months only.
- Year opening, movement, and closing reconcile.
- Historical wording remains literal.

### REPORT-003 — Implement operating versus transfer presentation

Status: `TODO`

Dependencies: REPORT-001

Acceptance:

- Transfers, savings, deposits, refunds, reversals, and restricted-purpose movements remain fully accounted for but do not distort ordinary operating subtotals.

### REPORT-004 — Generate HTML, XLSX, and PDF from one snapshot

Status: `TODO`

Dependencies: REPORT-001

Acceptance:

- All formats contain identical totals and snapshot ID.
- Original source file remains a separate download.

### REPORT-005 — Implement separate report approval and send

Status: `TODO`

Dependencies: REPORT-004

Acceptance:

- Administrator must click final approval after close.
- Server generates content from locked snapshot.
- Dispatch records recipients, sender, hashes, time, and result.

## Phase 7 — Dutch UX and authorization

### UX-001 — Audit and translate all user-facing text

Status: `TODO`

Dependencies: core workflows implemented

Acceptance:

- No English UI text remains except original ING evidence.
- Reports and emails are Dutch.

### AUTH-001 — Enforce administrator mutations and view-only access

Status: `TODO`

Dependencies: MODEL-003

Acceptance:

- Only administrators can import, categorize, approve, rule-manage, close, reopen, approve reports, or send.
- All other users can view only.
- Enforcement is server-side and tested.

### UX-002 — Simplify navigation and remove unrelated surfaces

Status: `TODO`

Dependencies: UX-001 and AUTH-001

Acceptance:

- Navigation is limited to the confirmed financial workflow.
- SaaS, marketing, billing, and unrelated features are absent.

## Phase 8 — Infrastructure

### INFRA-001 — Select and validate PostgreSQL version

Status: `DEFERRED`

Dependencies: financial workflow stable

Acceptance:

- Choose a currently supported version compatible with Prisma and validated migrations.
- Do not update merely for freshness.

### INFRA-002 — Replace obsolete Docker Compose locally

Status: `DEFERRED`

Dependencies: INFRA-001

Acceptance:

- PostgreSQL-only local Compose.
- Pinned major version, health check, named volume, placeholder credentials.
- Database/schema/role match documented architecture.
- No production changes.

### INFRA-003 — Prepare separate production cutover plan

Status: `DEFERRED`

Dependencies: INFRA-002

Acceptance:

- Includes backup, migration, validation, rollback, and explicit owner approval.

## Phase 9 — Hardening and handoff

### OPS-001 — Write Dutch administrator operating guide

Status: `TODO`

Acceptance:

- Covers import, review, rule creation, close, report approval, send, downloads, and reopen.

### OPS-002 — Test backup and restore

Status: `TODO`

Acceptance:

- Restored database and retained files reproduce closed snapshots and downloads.

### OPS-003 — Final documentation and code alignment audit

Status: `TODO`

Acceptance:

- Philosophy, strategy, roadmap, implementation plan, README, schema, APIs, UI, and operations agree.
- Legacy documents are clearly historical.

## Exact next execution sequence

1. Stage only `docs/DOMAIN_MODEL.md`, `docs/IMPLEMENTATION_PLAN.md`, `docs/ROADMAP.md`, and `docs/finance-rebuild-run.md`.
2. Exclude `.graphifyignore`, `graphify-out/`, and every code, schema, migration, financial-source, Docker, dependency, and production-configuration path.
3. Commit the four approved MODEL-001 documentation files with a focused message.
4. Record the commit hash in this plan and `docs/finance-rebuild-run.md`.
5. After the documentation checkpoint is recorded, prepare MODEL-002 as a bounded schema implementation task; do not modify Prisma during the documentation commit.
