# Yeshua Academy Finance — Implementation Plan

Status: authoritative execution plan  
Depends on: `docs/PHILOSOPHY.md`, `docs/STRATEGY.md`, `docs/ROADMAP.md`  
Persistent run: `agent-f961650b-de17-4282-ab18-7a716cc72958`  
Commit policy: commit coherent validated local slices when the current task explicitly requires them; do not push without explicit owner approval

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
Phase 4 FLOW-004 explicit rule creation from approved decisions: implemented; committed as c5d6312
Phase 5 CLOSE-001 statement reconciliation controls: implemented; read-only preview, no period close, no report snapshot, no bookings, no production import, production config, push, or Graphify changes
Phase 5 CLOSE-002 category control totals: implemented; category income/expense totals reconcile exactly to statement totals, CLOSE-001 account-filter hardened, combined close evidence includes real category differences, no period close, no report snapshot, no bookings, no production import, production config, push, or Graphify changes
Phase 5 CLOSE-003 strict close gate and lock: implemented; period may close only when CLOSE-001 and CLOSE-002 are both complete and balanced with all differences EUR 0.00; partial/open periods, unresolved reviews, missing dimensions, duplicate active closes, stale hash, and non-admin actors are rejected; creates exactly one PeriodClose, no report snapshots or dispatches; no Prisma migration required; no production import, production config, push, or Graphify changes
Phase 6 REPORT-001 through REPORT-005: committed as a24ef3e, 9e4dc45, d1430c2, dbf23e4, ba372d6
Phase 7 UX-001 Dutch text audit: committed as 7d58726
Phase 7 AUTH-001 admin mutation policy: committed as 0d70f51
Phase 7 UX-002 navigation simplification: committed as 20ff64b
Phase 9 OPS-001 Dutch admin guide: committed as d51cfad
Phase 8 INFRA-001 PostgreSQL compatibility note: documented in docs/INFRASTRUCTURE_READINESS.md
Phase 8 INFRA-002 local Docker Compose cleanup: docker-compose.local.yml created; original docker-compose.yml retained
Phase 8 INFRA-003 production cutover plan: docs/PRODUCTION_CUTOVER_PLAN_NL.md created (documentation-only; no production commands executed)
Phase 9 OPS-002 backup/restore rehearsal: scripts/backup-restore-rehearsal.mjs and tests/ops/backupRestoreRehearsal.test.ts implemented; 18 unit tests pass
Phase 9 OPS-003 documentation alignment: docs/FINAL_READINESS_AUDIT_NL.md created; ROADMAP.md, IMPLEMENTATION_PLAN.md updated; committed as 8d5978c
Phase 9 RC2-001 backup rehearsal explicit flags: safe default + --live-local --confirm-disposable required; 28 unit tests; committed as 519b69e
Phase 9 RC2-002 validate:release-candidate strengthened: prisma validate (local placeholder), prisma generate, git diff --check added; packageScriptSafety.test.ts (11 tests); committed as bb666ae
Phase 9 RC2-003 release manifest generator: scripts/generate-release-manifest.mjs; docs/RELEASE_MANIFEST_NL.md; releaseManifest.test.ts (12 tests); committed as 6341be4
Phase 9 RC2-004 production blocker guard audit: tests/ops/productionBlockerGuards.test.ts (24 tests); committed as 73d8072
Phase 9 RC2-005 owner handoff bundle: docs/OWNER_HANDOFF_NL.md; committed as 0a8c04d
Phase 9 RC3 evidence: final readiness counts corrected (`4f9cedf`), live local backup/restore evidence recorded (`3ac4bfc`), API route smoke coverage added (`9b209c7`)
Phase 9 RC4 evidence: release evidence corrected (`7ce6e6d`), manifest refreshed (`43bfb90`), owner go/no-go preflight added (`42a6f49`), push readiness checklist added (`43137b5`), release evidence consistency checks added (`33d08c4`), roadmap closeout guards added (`d942705`), validated-through evidence refreshed (`d07a32f`), owner decision preflight/matrix added (`35688c4`), post-approval prompt pack added (`b3cfc57`), push readiness preflight added (`0a64649`), owner review index added (`0a3904e`)
Phase 9 RC4 final hardening: final docs consistency audit added (`scripts/final-docs-consistency-audit.mjs`, `tests/ops/finalDocsConsistencyAudit.test.ts`, `docs/FINAL_DOCS_CONSISTENCY_AUDIT_NL.md`), repo contamination guard added (`tests/ops/repoContaminationGuard.test.ts`), final docs link integrity guard added (`tests/ops/finalDocsLinkIntegrity.test.ts`), safe command inventory added (`docs/SAFE_COMMAND_INVENTORY_NL.md`), final owner review preflight added (`scripts/final-owner-review-preflight.mjs`, `tests/ops/finalOwnerReviewPreflight.test.ts`), package scripts extended (`preflight:final-owner-review`, `audit:final-docs`), package script safety tests extended to 26
Phase 9 owner acceptance hardening: owner acceptance checklist, owner decision menu, static package preflight scripts, generated menu doc, and final doc links added; published basiscommit `6353546` was verified on `origin/main`; all remaining owner actions remain gated
Phase 9 post-push owner-decision handoff: post-push verification evidence (`e07be8f`), owner decision briefs (`a5ab4a8`), decision brief guards (`949823a`), approval-intake validator (`84d13d7`), post-push owner preflight package scripts (`3866a43`), and final handoff update (`f2f7cbb`) are published to `origin/main`
Phase 3 local/sanitized historical loading: complete; production historical import remains owner-gated
Phase 4 monthly import/review workflow: complete for local/app behavior; future real owner monthly files remain operator-controlled
Production schema cutover: complete 2026-07-07; schema finance deployed on PostgreSQL 15.8; 4 migrations; 30 tables; evidence in docs/PRODUCTION_SCHEMA_CUTOVER_EVIDENCE_NL.md
Production historical import: complete 2026-07-07; 902 transactions (268 2024 + 413 2025 + 221 2026), 681 bookings, 4 source files, 2026 partial/open and not closed; evidence in docs/PRODUCTION_HISTORICAL_IMPORT_EVIDENCE_NL.md
Production secret rotation: complete 2026-07-07; finance_user credential rotated; old credential rejected; new credential verified; historical totals re-verified; evidence in docs/PRODUCTION_SECRET_ROTATION_EVIDENCE_NL.md
Production runtime credential update: complete 2026-07-07; final retained credential applied; Dokploy env updated; app redeployed; health check passed; evidence in docs/PRODUCTION_RUNTIME_DATABASE_CREDENTIAL_EVIDENCE_NL.md
App/provider secret remediation: complete 2026-07-08; all provider secrets (Clerk, Resend, New Relic, Request Access Secret) rotated and applied to Dokploy runtime; app redeployed; health and production readiness verified; evidence in docs/PRODUCTION_APP_PROVIDER_SECRET_ROTATION_EVIDENCE_NL.md
Phase 17 — Month-by-month accounting reconciliation and administrator reporting: COMPLETE (2026-07-09; formula-based monthly chaining model; read-only production audit passed; baseline controls: 2024 closing 1218415, 2025 closing 1035086, 2026 partial closing 783725)
Phase 18 — Cent-exact accounting integrity and opening-balance repair: COMPLETE; implementation deployed in 7cbbfa10a2c9bb1809aa7bce288388f3936a4152 and the one-time owner-approved production repair completed 2026-07-14
Phase 19 — Local history-based review prefill: IMPLEMENTED AND DEPLOYED in 7cbbfa10a2c9bb1809aa7bce288388f3936a4152; evaluation and review prefill are live, while production backfill remains unexecuted
Production session authentication hardening: DEPLOYED in 7cbbfa10a2c9bb1809aa7bce288388f3936a4152; unauthenticated API reads return 401 JSON, unauthenticated review/report pages redirect to sign-in, permitted reads succeed, and viewer mutations remain 403
Current gate: do not repeat the completed opening-balance repair. Classification remains pending with 221 unresolved transactions and close remains blocked; suggestion backfill, suggestion persistence, booking approval, and migration remain separately gated.
Historical RC7 release-evidence gate: Current gate: Phase 17 complete.
```

## Authoritative Progress

```text
Previous roadmap through Phase 17: 100%
Phase 18: complete; implementation deployed and the one-time production repair restored the approved cash controls
Phase 19: implementation deployed; chronological 681-sample evaluation and review prefill are live; production backfill and suggestion persistence remain unexecuted and owner-gated
Phase 0 — Governance and verified controls: 100%
Phase 1 — Safe categorization foundation: 100%
Phase 2 — Financial domain and historical model: 100%
Phase 3 — Historical loading and truth fixtures: 100%
Phase 4 — Monthly import and review workflow: 100%
Phase 5 — Reconciliation, close, and snapshots: 100%
Phase 6 — Visual reports and distribution: 100%
Phase 7 — Dutch UX and authorization hardening: 100%
Phase 8 — Infrastructure and deployment: 100%
Phase 9 — Operational hardening and handoff: 100%
Phase 10 — Production schema cutover: 100%
Phase 11 — Production historical import: 100%
Phase 12 — Production secret rotation: 100%
Phase 13 — Production runtime credential update: 100%
Phase 14 — App/provider secret remediation: 100%
Phase 15 — Real PDF renderer: 100%
Phase 16 — Real email sending: 100% — bounded production send verified
Phase 17 — Month-by-month accounting reconciliation and administrator reporting: complete; formula-based monthly chaining model; production audit passed
Remaining blockers: none for Phase 17; 2026 open year categorization is owner-gated outside Phase 17 scope
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
5. Review documentation-only import-keyword findings as expected workflow language, not executable network behavior.
6. Update this plan and `docs/finance-rebuild-run.md` with validation evidence.

Acceptance:

- Diff is limited to intended governance documentation, categorization safety, parsing, and tests.
- Executable and test paths have no high-risk findings.
- Documentation has no secret-material or runtime-execution findings.
- Six import-keyword findings are confirmed as legitimate descriptions of the ING import workflow.
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
- Server/test executable high-risk scan reported no findings; `src/libs/api.ts` scan findings were pre-existing client request/import patterns and the diff only expands the existing category endpoint payload/error handling.

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

- Source-file byte comparison tests.
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

Status: `DONE_LOCAL_ONLY`

Dependencies: MODEL-002 through MODEL-004

Acceptance:

- Reads exact source sheets and columns.
- Derives dates only from raw ING `Date`.
- Preserves literal `Klant`, `Type`, and `Category`.
- Uses resolved `Verduidelijking` content as interpretation evidence.

Validation:

- Fixture tests against copies or sanitized deterministic fixtures.

### HIST-002 — Load and reconcile 2024 in disposable database

Status: `DONE_LOCAL_ONLY`

Dependencies: HIST-001

Acceptance:

- 268 transactions.
- Opening EUR 1,721.86.
- Income EUR 32,267.19.
- Expenses EUR 21,804.90.
- Closing EUR 12,184.15.
- Literal labels unchanged.

### HIST-003 — Load and reconcile 2025 in disposable database

Status: `DONE_LOCAL_ONLY`

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

Status: `DONE_LOCAL_ONLY`

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

Status: `DONE_LOCAL_APP_WORKFLOW`

Phase 4 FLOW-001 through FLOW-004 are complete for local/app behavior. Monthly import preview is preview-only; deterministic categorization returns safe candidates and suggestions without writes; the review queue is evidence-rich and Dutch; manual booking requires explicit admin decisions with all three dimensions; rule creation has a separate preview and explicit activation path. Future real owner monthly files remain operator-controlled through the guarded import workflow.

### FLOW-001 — Implement controlled ING import preview

Status: `IMPLEMENTED`

Dependencies: HIST-004 production execution remains operator-gated; Packet G dry-run evidence is available

Acceptance:

- Dutch preview shows account, period, counts, duplicates, overlap, and statement totals before commit.
- Failed controls prevent commit.
- Original supplied CSV bytes are hashed with retained-byte semantics and represented as a SourceFile-compatible preview summary.
- Duplicate import fingerprints are detected against existing transactions when a duplicate lookup is supplied.
- The preview does not create `Transaction`, `TransactionBooking`, `PeriodClose`, report, dispatch, production import, or production configuration records.
- The monthly import preview route returns a Dutch preview response and leaves existing import behavior unchanged.
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
- Focused review route tests cover authenticated read access, production unauthenticated denial, and evidence-rich read responses without approving anything.
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
- Focused review route tests cover authenticated read access plus admin-only preview/activation routes and confirm preview does not activate a rule.
- Focused review page helper tests cover Dutch rule creation activation labels.
- Surrounding rule engine, categorization, review queue, review decision, deterministic categorization, and monthly import preview regressions passed locally.
- Full validation passed and is recorded in `docs/finance-rebuild-run.md`: focused FLOW-004 tests, surrounding review/categorization regressions, full suite, Prisma validate/generate, server build, production build, diff check, changed executable/test high-risk scan, and documentation scans.

## Phase 5 — Reconciliation and close

### CLOSE-001 — Implement statement reconciliation controls

Status: `DONE`

Dependencies: FLOW-003

Files:

- `server/services/statementReconciliationControlService.ts`
- `server/routes/statementReconciliationPreview.ts`
- `server/index.ts`
- `tests/services/statementReconciliationControlService.test.ts`
- `tests/routes/statementReconciliationPreview.test.ts`

Acceptance:

- Opening + income - expenses equals closing exactly.
- Transaction totals and statement totals agree.
- Partial/open statements are not close-eligible.
- Unresolved or missing-booking transactions make preview incomplete.
- Exact minor-unit string differences are returned.
- No PeriodClose, ReportSnapshot, approval, dispatch, or booking is created.
- `toBalancedReconciliationEvidence` produces evidence accepted by `assertCanClose` only for valid BALANCED+COMPLETE previews.
- Route is admin-only and read-only.

Validation:

- Full validation passed and is recorded in `docs/finance-rebuild-run.md`: focused statement reconciliation tests (20+4), surrounding statement control / period close / reconciliation service / review / monthly import preview regressions, full suite (341 tests), Prisma validate/generate, server build, production build, diff check.

### CLOSE-002 — Implement category control totals

Status: `IMPLEMENTED`

Dependencies: CLOSE-001

Files:

- `server/services/categoryControlTotalsService.ts`
- `server/routes/statementReconciliationPreview.ts` (extended + account filter hardened)
- `tests/services/categoryControlTotalsService.test.ts`
- `tests/routes/statementReconciliationPreview.test.ts` (extended)

Acceptance:

- Sum of category income equals total income.
- Sum of category expenses equals total expenses.
- All three dimensions are present for every final transaction.
- CLOSE-001 route account filter hardened to filter by `accountId`.
- Category income/expense differences are real computed values from booked transactions.
- Combined close control evidence is accepted by `assertCanClose` only when both statement and category controls are balanced/complete.
- Literal `Klant`, `Type`, and `Category` labels are preserved from `TransactionBooking`.
- Lines are sorted deterministically.
- No PeriodClose, ReportSnapshot, approval, dispatch, booking, or audit mutation occurs.

Validation:

- Focused category control totals tests: 24 passed.
- Route tests: 8 passed.
- Existing CLOSE-001 reconciliation service tests: 20 passed.
- Full suite: 369 tests passed.
- Server TypeScript build passed.
- Production build passed with 18 routes and the pre-existing Next/SWC lockfile warning.
- `git diff --check` passed.
- No Prisma schema or migration was required.

### CLOSE-003 — Implement strict close gate and lock

Status: `DONE`

Dependencies: CLOSE-002

Files changed:

- `server/services/strictPeriodCloseService.ts` (new)
- `server/routes/strictPeriodClose.ts` (new)
- `server/index.ts` (route registered)
- `tests/services/strictPeriodCloseService.test.ts` (new, 21 tests)
- `tests/routes/strictPeriodClose.test.ts` (new, 10 tests)
- `docs/IMPLEMENTATION_PLAN.md`
- `docs/ROADMAP.md`
- `docs/finance-rebuild-run.md`

Implemented behavior:

- `executeStrictPeriodClose` builds CLOSE-001 statement reconciliation preview and CLOSE-002 category controls from live DB state, then runs `toCombinedReconciliationEvidence` and `createPeriodClose` only when all gates pass.
- Rejects: partial/open coverage, unresolved review items, missing booking dimensions (project/type/category), non-zero statement differences, non-zero category differences, transaction count mismatch, existing active CLOSED period for the same statementPeriodId, stale close-control hash, missing explicit confirmation, viewer/non-admin actor.
- `buildCloseControlHashFromParts` produces a deterministic SHA-256 hash over statementPeriodId, ledgerId, period dates, statement totals, booked totals, category differences, close eligibility, and combined validator version.
- POST `/api/reconciliation/statement-periods/:id/close` — admin-only, requires `ledgerId`, `workspaceId`, `confirmed: true`, and optionally `expectedCloseControlHash`; runs entire close inside a Prisma transaction; returns 201 with close summary.
- Creates exactly one `PeriodClose` through `createPeriodClose`; creates no report snapshots, approvals, artifacts, dispatches, or transaction bookings.
- No Prisma schema or migration required.

Acceptance:

- No unresolved reviews.
- All differences are EUR 0.00.
- Partial periods cannot close.
- Closed snapshot is immutable (duplicate CLOSED close for same period is rejected 409).
- Admin-only; viewer is rejected 403.
- Stale hash is rejected 409; missing confirmation is rejected 400.
- 75/75 test files pass; 400 tests pass; server TypeScript build passes.

### CLOSE-004 — Implement audited reopen

Status: `DONE`

Dependencies: CLOSE-003

Files changed:

- `server/services/auditedPeriodReopenService.ts` (new)
- `server/routes/auditedPeriodReopen.ts` (new)
- `server/index.ts` (route registered)
- `server/services/strictPeriodCloseService.ts` (hash helper hardened)
- `tests/services/auditedPeriodReopenService.test.ts` (new, 13 tests)
- `tests/routes/auditedPeriodReopen.test.ts` (new, 8 tests)
- `tests/services/strictPeriodCloseService.test.ts` (4 hash hardening tests added)

Implemented behavior:

- `executeAuditedReopen` accepts actor, workspaceId, periodCloseId, and reason.
- Requires admin actor; rejects viewer/non-admin with 403.
- Requires non-empty reason; rejects blank reason with 400.
- Finds the `PeriodClose` by ID and workspaceId; missing or cross-workspace close is rejected with the same 404.
- Rejects already reopened close or non-CLOSED close with 409.
- Updates close to `REOPENED` status, stores `reopenedBy`, `reopenedAt`, `reopenReason`.
- Finds report snapshots linked through `ReportSnapshotPeriodClose`.
- Revokes active approvals by setting `revokedBy`, `revokedAt`, `revokeReason`.
- Does not delete approvals or snapshots.
- Writes exactly one audit event with action `period.close.reopened`.
- Creates no `PeriodClose`, `ReportSnapshot`, `ReportArtifact`, `ReportDispatch`, or `TransactionBooking`.
- Returns close id, prior/new status, reopenedAt, revokedApprovalCount, affectedReportSnapshotIds, and side-effect flags.
- POST `/api/reconciliation/period-closes/:id/reopen` — admin-only, requires `reason` and workspace id from header/body, passes workspaceId into the service, runs entire operation inside Prisma transaction, returns 200 with reopen summary.
- CLOSE-003 hash helper hardening: removed unsafe exported `buildCloseControlHash(combined)` that risked hashing accountId as statementPeriodId with blank ledgerId. Kept only `buildCloseControlHashFromParts(statementPeriodId, ledgerId, combined)`.

Acceptance:

- Administrator-only.
- Requires reason.
- Requires workspace id and isolates the close lookup by workspace.
- Writes audit event.
- Invalidates later report approval where necessary.
- No Prisma schema or migration required.

Validation:

- Focused audited reopen service tests: 13 tests passed.
- Focused audited reopen route tests: 8 tests passed.
- Hash hardening tests: 4 tests passed.
- Full suite: 425 tests passed (3 skipped); `prisma validate` passed with a sanitized local-only URL; `prisma generate` passed; `npm run build:server` passed; `npm run build` passed with 18 routes.
- No fixture files, `.env`, production config, `.graphifyignore`, or `graphify-out/` changes.

## Phase 6 — Reports and distribution

### REPORT-001 — Implement snapshot-based monthly report

Status: `DONE`

Dependencies: CLOSE-003

Acceptance:

- Dutch visual report shows balances and totals by exact `Klant`, `Type`, and `Category`.
- Every figure drills down to transactions.

Evidence:
- `server/services/reportSnapshotService.ts` — `generateMonthlyReportSnapshot` implemented.
- 9 monthly report snapshot tests pass; hash deterministic, version increment, rejects reopened.
- `npm test -- --test-name-pattern "monthly report"`: 9 tests pass.

### REPORT-002 — Implement snapshot-based yearly report

Status: `DONE`

Dependencies: REPORT-001

Acceptance:

- Uses closed months only.
- Year opening, movement, and closing reconcile.
- Historical wording remains literal.

Evidence:
- `server/services/reportSnapshotService.ts` — `generateYearlyReportSnapshot` implemented.
- 8 yearly report snapshot tests pass; opening + income - expense = closing.
- `npm test -- --test-name-pattern "yearly report"`: 8 tests pass.

### REPORT-003 — Implement operating versus transfer presentation

Status: `DONE`

Dependencies: REPORT-001

Acceptance:

- Transfers, savings, deposits, refunds, reversals, and restricted-purpose movements remain fully accounted for but do not distort ordinary operating subtotals.

Evidence:
- `server/services/reportSnapshotService.ts` — `classifyReportLinePresentation`, `classifyReportLines`, `computePresentationTotals` implemented.
- 8 presentation classification tests pass; OPERATING/TRANSFER/DEPOSIT/REFUND/RESTRICTED classification correct.
- `npm test -- --test-name-pattern "report presentation"`: tests pass (included in snapshot pattern).

### REPORT-004 — Generate HTML, XLSX, and PDF from one snapshot

Status: `DONE`

Dependencies: REPORT-001

Acceptance:

- All formats contain identical totals and snapshot ID.
- Original source file remains a separate download.

Evidence:
- `server/services/reportArtifactService.ts` — HTML, XLSX, and real PDF artifact generation.
- PDF renderer completed with owner-approved `pdfkit`; artifacts store `application/pdf` bytes and return `pdfBlocker: null`.
- `npm test -- --test-name-pattern "report artifact"`: report artifact tests pass.
- `npm run build:server` passes; no production, e-mail, or runtime secret changes introduced.

### REPORT-005 — Implement separate report approval and send

Status: `DONE`

Dependencies: REPORT-004

Acceptance:

- Administrator must click final approval after close.
- Server generates content from locked snapshot.
- Dispatch records recipients, sender, hashes, time, and result.

Evidence:
- `server/services/reportApprovalDispatchService.ts` — `approveSnapshot`, `prepareDispatch` implemented.
- No email sending; `sendsEmail: false`, `callsExternalProvider: false` on all side-effect records.
- `npm test -- --test-name-pattern "report approval"`: 7 tests pass.
- `npm test -- --test-name-pattern "report dispatch"`: 7 tests pass.
- Routes registered in `server/index.ts`; `server/routes/reportSnapshots.ts` with 6 handlers.

## Phase 7 — Dutch UX and authorization

### UX-001 — Audit and translate all user-facing text

Status: `DONE`

Dependencies: core workflows implemented

Evidence:

- `tests/helpers/dutchTextAudit.test.ts` — 20 tests covering auth guard, import feedback, email, review, settings, report snapshot, and navigation surfaces.
- Commit: `7d58726 test: add Dutch text audit and navigation helper tests`

Acceptance:

- No English UI text remains except original ING evidence.
- Reports and emails are Dutch.

### AUTH-001 — Enforce administrator mutations and view-only access

Status: `DONE`

Dependencies: MODEL-003

Evidence:

- `tests/auth/adminMutationPolicy.test.ts` — 24 tests; every mutation route verified to return 403 Dutch error for viewer role.
- Commit: `0d70f51 test: add admin mutation policy enforcement tests`

Acceptance:

- Only administrators can import, categorize, approve, rule-manage, close, reopen, approve reports, or send.
- All other users can view only.
- Enforcement is server-side and tested.

### UX-002 — Simplify navigation and remove unrelated surfaces

Status: `DONE`

Dependencies: UX-001 and AUTH-001

Evidence:

- `src/helpers/navigation.ts` — canonical `FINANCE_NAV_ITEMS` Dutch nav helper.
- `src/ui/FinanceAppFrame.tsx` — uses canonical nav helper; no SaaS/marketing/billing surfaces.
- `tests/helpers/navigation.test.ts` — 13 tests covering non-empty, Dutch labels, no English SaaS labels, workflow completeness, getNavLabel helper.
- Commit: `20ff64b feat: centralize navigation in canonical Dutch helper`

Acceptance:

- Navigation is limited to the confirmed financial workflow.
- SaaS, marketing, billing, and unrelated features are absent.

## Phase 8 — Infrastructure

### INFRA-001 — Select and validate PostgreSQL version

Status: `IMPLEMENTED`

Evidence:

- `docs/INFRASTRUCTURE_READINESS.md` — documents Prisma 6.x version, active migration chain (4 migrations),
  local validation conventions, PostgreSQL version recommendation criteria, and requirement to confirm
  production version before cutover.
- `docs/POSTGRES_VERSION_EVIDENCE_NL.md` — records local PostgreSQL 15.17 backup/restore rehearsal evidence only; production PostgreSQL version remains not confirmed.

Dependencies: financial workflow stable

Acceptance:

- Choose a currently supported version compatible with Prisma and validated migrations.
- Do not update merely for freshness.

### INFRA-002 — Replace obsolete Docker Compose locally

Status: `IMPLEMENTED`

Evidence:

- `docker-compose.local.yml` — PostgreSQL 16 only; localhost-only port mapping (`127.0.0.1:5432:5432`);
  placeholder credentials only; named volume `finance_local_db`; healthcheck included.
- `docs/INFRASTRUCTURE_READINESS.md` §Lokale Docker Compose — usage instructions documented.
- Original `docker-compose.yml` (WordPress/MySQL/Postgres) is left in place and not deleted; it is the
  production Dokploy descriptor and must not be removed without explicit owner approval.

Dependencies: INFRA-001

Acceptance:

- PostgreSQL-only local Compose.
- Pinned major version, health check, named volume, placeholder credentials.
- Database/schema/role match documented architecture.
- No production changes.

### INFRA-003 — Prepare separate production cutover plan

Status: `IMPLEMENTED`

Evidence:

- `docs/PRODUCTION_CUTOVER_PLAN_NL.md` — Dutch operator-facing plan including: scope and non-goals,
  required owner approvals, secret rotation, backup before cutover, migration dry-run, migration
  execution, post-migration validation, historical import gate, report/PDF/email limitations, rollback
  plan, no-force-push rules, and explicit confirmation that no production commands were executed.

Dependencies: INFRA-002

Acceptance:

- Includes backup, migration, validation, rollback, and explicit owner approval.

## Phase 9 — Hardening and handoff

### OPS-001 — Write Dutch administrator operating guide

Status: `DONE`

Evidence:

- `docs/ADMIN_OPERATING_GUIDE_NL.md` — 16-section Dutch guide covering rollen, ING CSV import, deterministische categorisatie, beoordelingsrij, handmatige keuze dimensies, regel aanmaken, reconciliatie, categoriecontroles, periode afsluiten, periode heropenen, rapporten, artefacten, goedkeuring + verzendmetadata, bronbestand-downloads, wat niet te doen, probleemoplossing.
- Commit: `d51cfad docs: add Dutch administrator operating guide (OPS-001)`

Acceptance:

- Covers import, review, rule creation, close, report approval, send, downloads, and reopen.

### OPS-002 — Test backup and restore

Status: `IMPLEMENTED`

Evidence:

- `docs/BACKUP_RESTORE_REHEARSAL_NL.md` — Dutch step-by-step local rehearsal guide.
- `scripts/backup-restore-rehearsal.mjs` — guarded rehearsal script; rejects non-local hosts,
  10.0.2.4, Dokploy hosts, and production-like database names; creates and drops only
  `yaf_rehearsal_*` disposable databases; never prints secrets.
- `tests/ops/backupRestoreRehearsal.test.ts` — 18 unit tests covering URL guards, command
  construction, and no-secret guarantees.
- Live pg_dump/pg_restore requires `pg_dump`/`pg_restore` to be installed locally; the
  script supports `--dry-run` mode for environments without PostgreSQL client tools.

Acceptance:

- Restored database and retained files reproduce closed snapshots and downloads.

### OPS-003 — Final documentation and code alignment audit

Status: `DONE`

Evidence:

- `docs/FINAL_READINESS_AUDIT_NL.md` — complete audit document; full suite 83 files / 535 tests; builds and Prisma validated.
- Committed as `8d5978c docs: add final readiness audit (OPS-003)`.

Acceptance:

- Philosophy, strategy, roadmap, implementation plan, README, schema, APIs, UI, and operations agree.
- Legacy documents are clearly historical.
- Phase statuses in ROADMAP.md and IMPLEMENTATION_PLAN.md agree with committed code.
- Validation: `npm test`, `npm run build:server`, `npm run build`, `npx prisma validate`, `npx prisma generate`, `git diff --check`.

## Phase 18 — Cent-exact accounting integrity and opening-balance repair

### ACC-001 — Document architecture, reuse assessment, and safety boundaries

Status: `DONE`

Evidence:

- `docs/ACCOUNTING_INTEGRITY_AND_REVIEW_PREFILL.md`
- `docs/ROADMAP.md` Phase 18 and Phase 19
- Existing reconciliation, audit, opening-balance, suggestion, review, booking, and decision models were reviewed before planning.

Acceptance:

- Explains what the capability is, how it works, why local-first was selected, what existing code is reused, and which alternatives are rejected.
- Preserves integer-minor accounting, immutable source facts, suggestion/final-booking separation, human approval, and production-write gates.

### ACC-002 — Implement read-only cent-exact accounting audit

Status: `DONE`

Dependencies: ACC-001

Expected files:

- `server/services/accountingAuditService.ts` (new orchestration service)
- `server/routes/accountingAudit.ts` (new read-only route)
- `src/app/api/accounting/audit/route.ts` (direct Next route)
- targeted service and route tests

Acceptance:

- `GET /api/accounting/audit` is read-only.
- Reuses `monthlyReconciliationService` and `monthlyReconciliationAuditService`; no parallel financial arithmetic engine.
- Returns monthly and yearly integer minor-unit controls, coverage, continuity, duplicates, running-balance errors, unresolved counts, and approved baseline comparisons.
- Every difference is a decimal integer string; no floating-point euro aggregation.
- Partial/open periods expose unresolved counts without pretending they are close-eligible.
- Creates no opening balances, bookings, closes, snapshots, suggestions, review decisions, or audit events.

Validation:

- Focused audit service tests with 2024, 2025, and supplied 2026 baselines.
- Route authorization/read-only tests.
- Server type check and production build.

Evidence:

- `tests/services/accountingAuditService.test.ts`: 4 passed.
- `tests/routes/accountingIntegrityRoutes.test.ts`: 4 passed.
- Monthly reconciliation regression marker: 7 passed across audit, script, and evidence-consistency coverage.
- `npm run build`: passed after one bounded relative-import repair.
- Production route manifest includes `/api/accounting/audit`.

### ACC-003 — Implement dry-run-first idempotent opening-balance repair

Status: `DONE`

Dependencies: ACC-002

Expected files:

- `server/services/openingBalanceRepairService.ts` (new)
- `server/routes/openingBalanceRepair.ts` (new admin route)
- direct Next route or existing API registration consistent with current architecture
- targeted service and route tests

Acceptance:

- Approved target is 172186 minor units, 2024-01-01 UTC, for the verified ING account.
- Default mode is dry-run and performs zero writes.
- Results are `WOULD_CREATE`, `ALREADY_CORRECT`, `CONFLICT`, or `ACCOUNT_NOT_FOUND`.
- Execute mode requires administrator authorization and an explicit confirmation flag.
- Locked or conflicting records are never overwritten.
- Successful execution creates exactly one opening-balance record and one audit event in one transaction.
- No production execution occurs during implementation or validation.

Validation:

- Idempotency, conflict, lock, wrong-account, dry-run no-write, authorization, and audit tests.
- Accounting audit fixture changes from known missing-opening failure to exact approved controls only after explicit test execution.

Evidence:

- `tests/services/openingBalanceRepairService.test.ts`: 5 passed.
- `tests/routes/accountingIntegrityRoutes.test.ts`: administrator restriction, dry-run default, and environment execution gate passed.
- No database write, production execution, migration, deployment, commit, or push occurred during implementation validation.
- Owner-approved production execution occurred exactly once at 2026-07-13 23:23:50 UTC (2026-07-14 00:23:50 Europe/Lisbon) on deployed commit `7cbbfa10a2c9bb1809aa7bce288388f3936a4152`.
- HTTP 201 returned `CREATED`; OpeningBalance `4c8c0d0b-2e2b-4557-868f-1174842680a9` and audit log `769c1cde-992f-403d-8614-c6d0e4238440` were created in the approved transaction.
- Pre-repair control was expected 172186, actual 0, difference -172186. Post-repair control is expected 172186, actual 172186, difference 0.
- Post-repair `cashStatus` is `PASSED`; `classificationStatus` remains `PENDING`, `closeStatus` remains `BLOCKED`, and 221 transactions remain unresolved.
- The execution guard was set back to `false` immediately after the request and the same deployed build was reloaded. No suggestion backfill, suggestion persistence, transaction approval, migration, TransactionBooking, period close, report snapshot, or bank-fact mutation occurred.

### ACC-004 — Validate and document accounting-integrity evidence

Status: `DONE`

Dependencies: ACC-003

Acceptance:

- Focused tests pass.
- Full relevant accounting/reconciliation tests pass.
- Server and production builds pass.
- Documentation states actual implementation and limitations.
- No production write, deployment, migration, or commit occurs without separate owner approval.

## Phase 19 — Local history-based review prefill

### SUGGEST-001 — Approve local-first algorithm and reuse contract

Status: `DONE`

Dependencies: ACC-001

Evidence:

- `docs/ACCOUNTING_INTEGRITY_AND_REVIEW_PREFILL.md`
- Existing `CategorizationSuggestion`, `TransactionBooking`, `ReviewDecision`, deterministic categorization, and evidence-rich review queue are retained.

Acceptance:

- External AI and autonomous booking remain deferred.
- Prediction target is one complete project/type/category triple.
- Scores, ranks, evidence, and hashes are deterministic and integer-based.

### SUGGEST-002 — Implement pure history-based candidate ranking

Status: `DONE`

Dependencies: ACC-004, SUGGEST-001

Expected files:

- `server/services/historySuggestionService.ts` (new pure ranking core)
- focused tests and historical evaluation fixtures

Acceptance:

- Uses approved booking history only.
- Uses direction, IBAN, normalized counterparty, description/payment-purpose tokens, account, amount support, recurrence, frequency, and recency.
- Rejects direction-incompatible candidates.
- Produces up to three complete triples with deterministic integer `scoreBasisPoints`, matcher, confidence, evidence, and stable hash.
- Identical inputs and algorithm version produce identical output.
- Amount-only, popularity-only, or direction-only evidence cannot become high confidence.
- Creates no database records.

### SUGGEST-003 — Implement dry-run-first suggestion backfill

Status: `DONE`

Dependencies: SUGGEST-002

Expected files:

- `server/services/suggestionBackfillService.ts`
- `server/routes/suggestionBackfill.ts`
- `src/app/api/categorization/suggestions/backfill/route.ts`
- targeted service and route tests

Acceptance:

- `POST /api/categorization/suggestions/backfill` defaults to dry-run.
- Dry-run reports unresolved count, complete rank-one coverage, matcher/confidence distributions, and planned writes while performing zero writes.
- Explicit execution creates or replaces only pending suggestions for unresolved transactions.
- Suggestions use existing schema fields, immutable evidence, evidence hashes, and algorithm version.
- No `TransactionBooking`, period close, report snapshot, source-file, or bank-transaction mutation occurs.

### SUGGEST-004 — Prefill review with rank-one complete suggestion

Status: `DONE`

Dependencies: SUGGEST-003

Acceptance:

- Review items expose rank one as `proposed` when complete.
- Project, transaction type, category, derived main category, confidence, and reason are prefilled and visible.
- Administrator can approve, choose an alternative, or manually correct dimensions.
- Existing `ReviewDecision` and final-booking flow remain authoritative.
- No uncertain bulk-approval action is added.

### SUGGEST-005 — Evaluate historical prediction quality

Status: `DONE`

Dependencies: SUGGEST-002

Acceptance:

- Evaluate chronological holdout and safe leave-one-out cases over approved historical bookings.
- Report top-one complete-triple accuracy, top-three accuracy, coverage, and confidence calibration.
- Metrics are deterministic and versioned.
- Weak confidence bands remain visibly weak; no accuracy claim is made without measured evidence.
- External AI remains out of scope unless a later owner-approved phase is added.

### SUGGEST-006 — Validate and document review-prefill evidence

Status: `DONE`

Dependencies: SUGGEST-003, SUGGEST-004, SUGGEST-005

Acceptance:

- Focused suggestion, backfill, review, and no-side-effect tests pass.
- Server and production builds pass.
- Documentation describes actual feature behavior, algorithm version, metrics, and administrator workflow.
- No production backfill, deployment, external provider, commit, or push occurs without separate owner approval.

Evidence:

- Algorithm version: `history-v1`.
- Chronological evaluation: 681 samples, 679 covered (99.71%), 489 top-one correct (72.02%), 539 top-three correct (79.38%).
- Safe leave-one-out evaluation: 681 samples, 679 covered (99.71%), 502 top-one correct (73.93%), 556 top-three correct (81.89%).
- Chronological confidence calibration: FUZZY 88.64%, OVERALL 100.00%, DEFAULT 31.09%; therefore DEFAULT remains visibly low-confidence and review-only.
- Client loads `/api/ledger` and `/api/review` concurrently for authenticated users, merges proposals without setting final booking fields, and exposes project/type/category alternatives.
- Review approval requires `projectId`, `transactionTypeId`, and `categoryId`; the direct Next PATCH route delegates to `updateTransactionCategory`, which retains `ReviewDecision` and `TransactionBooking` authority.
- Focused tests passed: history ranker 5, backfill 4, review queue 3, review decision 8, review helper 12, review mapper 2, direct route 2, API transaction mapper 3, accounting audit 4, monthly reconciliation marker 7, owner evaluation 1.
- `npm run build` passed after one bounded catch-callback return-type annotation; route manifest includes `/api/transactions/[id]/category`.
- No execution flags were enabled and no production suggestion, booking, opening-balance repair, or migration occurred during validation. The validated Phase 18/19 and authentication slice was later committed and deployed as `7cbbfa10a2c9bb1809aa7bce288388f3936a4152`.

## Exact next execution sequence

Phases 0–9 are complete as a published RC4 owner-decision handoff through `f2f7cbb`. Phase 10 production schema cutover was completed on 2026-07-07: PostgreSQL 15.8, database finance, schema finance, 4 migrations applied, 30 tables verified. Evidence: `docs/PRODUCTION_SCHEMA_CUTOVER_EVIDENCE_NL.md`.

The Phase 18/19 implementation and production authentication hardening are deployed as `7cbbfa10a2c9bb1809aa7bce288388f3936a4152`. The one-time owner-approved opening-balance repair is complete; it must not be executed again. Cash integrity passes, while the 221 unresolved 2026 transactions keep classification pending and close blocked.

Remaining owner-gated decisions:

1. ~~Approve and implement real PDF renderer dependency~~ — DONE 2026-07-08 with `pdfkit`. Evidence: `docs/REAL_PDF_RENDERER_EVIDENCE_NL.md`.
2. ~~Approve or defer production cutover~~ — DONE 2026-07-07.
3. ~~Historical production import~~ — DONE 2026-07-07. 2024 (268 tx), 2025 (413 tx), 2026 partial open (221 tx) imported. 902 total transactions, 681 bookings, 4 source files. 2026 partial/open, not closed. Evidence: `docs/PRODUCTION_HISTORICAL_IMPORT_EVIDENCE_NL.md`.
4. Complete bounded real email production verification after runtime test-recipient input is present.
5. ~~Supply and apply final Clerk, Resend, and New Relic provider replacement keys outside Git~~ — DONE 2026-07-08.
5. Rotate finance_user database password (appeared in chat session; required before long-term production use). Note: this rotation will also unblock item 3 above.
6. Run and confirm live local backup/restore rehearsal with PostgreSQL tools.

See `docs/OWNER_DECISION_PACK_NL.md` for decision checkboxes and next-step prompts.
See `docs/PRODUCTION_HISTORICAL_IMPORT_EVIDENCE_NL.md` for import evidence.
