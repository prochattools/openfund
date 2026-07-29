# Yeshua Academy Finance — Implementation Plan

Status: authoritative execution plan  
Depends on: `docs/PHILOSOPHY.md`, `docs/STRATEGY.md`, `docs/ROADMAP.md`  
Persistent run: `agent-f961650b-de17-4282-ab18-7a716cc72958`  
Commit policy: commit coherent validated local slices when the current task explicitly requires them; do not push without explicit owner approval

## Purpose

This file converts the roadmap into concise, unambiguous tasks that an AI coding agent can execute safely. It is the authoritative source for task order, current status, acceptance criteria, and validation.

## Current authentication contract

The production authentication standardization is deployed in
`f9e967f54632f86bad2ef3c5774334a48cda85ad` (`fix: restore authenticated
finance data scope`) on 2026-07-14. Clerk is the only
production provider and is configured for email sign-in only. `/sign-in` is
the canonical public authentication route; public application sign-up is
disabled, there is no supported `/sign-up` route, and Google/social providers
are disabled. Protected API routes require a server-verified Clerk
`__session` token, map the verified identity to an active local `User` and
active `WorkspaceMembership`, and derive `admin` or `viewer` from that
membership. Missing or invalid sessions return `401` JSON; authenticated users
without workspace access return `403`; `/review` and `/reports` redirect
unauthenticated browser requests to `/sign-in`. Client identity headers are
ignored, review/accounting/evaluation reads remain read-only, and mutations
remain administrator-only. No opening-balance repair or suggestion backfill is
part of this authentication work.

The current running production build SHA is verified from the no-cache
deployment-info endpoint after each release. The previous final
documentation/release-evidence commit was `df1ccb009769a89e33b3393e0e546d3caa90f174`;
the application implementation commit remains the separate `f9e967f` value
above.

Release configuration: GitHub Actions requires the named
`NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` secret and validates its publishable-key
shape before Docker execution. Dokploy supplies `AUTH_PROVIDER=clerk`,
`NEXT_PUBLIC_AUTH_PROVIDER=clerk`, the public Clerk variables, runtime-only
`CLERK_SECRET_KEY`, `NEXT_PUBLIC_SIGN_IN_URL=/sign-in`,
`NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in`, `NEXT_PUBLIC_SIGN_UP_URL=/sign-in`,
`NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-in`, application URLs, CORS origin, and
the configured active `DEFAULT_WORKSPACE_ID`. Ory is historical only and has
been removed from the production authentication path; no Ory variables or
cookie fallbacks are present in Dokploy. The active
finance administrator is pre-provisioned locally and its verified Clerk
primary email matches case-insensitively; the identity is not recorded here.
The 221 unresolved transactions and 663 review-only suggestions remain unchanged.

Unauthenticated production smoke tests passed: the three protected APIs return
`401` JSON and `/review` plus `/reports` redirect to `/sign-in`; `/sign-up`
redirects to `/sign-in`. No financial or review mutation was attempted.

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
Phase 3 local/sanitized historical loading: complete; its historical production gate was superseded by the completed Phase 11 import
Phase 4 monthly import/review workflow: complete for local/app behavior; future real owner monthly files remain operator-controlled
Production schema cutover: complete 2026-07-07; schema finance deployed on PostgreSQL 15.8; 4 migrations; 30 tables; evidence in docs/PRODUCTION_SCHEMA_CUTOVER_EVIDENCE_NL.md
Production historical import: complete 2026-07-07; 902 transactions (268 2024 + 413 2025 + 221 2026), 681 bookings, 4 source files, 2026 partial/open and not closed; evidence in docs/PRODUCTION_HISTORICAL_IMPORT_EVIDENCE_NL.md
Production secret rotation: complete 2026-07-07; finance_user credential rotated; old credential rejected; new credential verified; historical totals re-verified; evidence in docs/PRODUCTION_SECRET_ROTATION_EVIDENCE_NL.md
Production runtime credential update: complete 2026-07-07; final retained credential applied; Dokploy env updated; app redeployed; health check passed; evidence in docs/PRODUCTION_RUNTIME_DATABASE_CREDENTIAL_EVIDENCE_NL.md
App/provider secret remediation: complete 2026-07-08; all provider secrets (Clerk, Resend, New Relic, Request Access Secret) rotated and applied to Dokploy runtime; app redeployed; health and production readiness verified; evidence in docs/PRODUCTION_APP_PROVIDER_SECRET_ROTATION_EVIDENCE_NL.md
Phase 17 — Month-by-month accounting reconciliation and administrator reporting: COMPLETE (2026-07-09; formula-based monthly chaining model; read-only production audit passed; baseline controls: 2024 closing 1218415, 2025 closing 1035086, 2026 partial closing 783725)
Phase 18 — Cent-exact accounting integrity and opening-balance repair: COMPLETE; implementation and the one-time owner-approved production repair completed 2026-07-14; never repeat
Phase 19 — History-based review prefill: DEPLOYED AND COMPLETE in f9e967f54632f86bad2ef3c5774334a48cda85ad; controlled history-v1 suggestion persistence completed with 663 review-only suggestions; 221 administrator decisions remain pending
Production session authentication hardening: Clerk-only standardization is deployed; workspace configuration is valid, unauthenticated denial/redirect checks pass, and authenticated production reads return the populated finance dataset. The client waits for Clerk session readiness before loading finance data, preventing a transient sign-in `401` from becoming a permanent empty state.
Production ownership diagnosis: a read-only audit confirmed the authenticated administrator is already the owner of the 902 imported transactions, 663 persisted review-only suggestions, 681 bookings, and approved opening balance. No `FINANCE_DATA_OWNER_USER_ID` variable, ownership reassignment, migration, reimport, or data copy was required.
Current gate: do not repeat the completed opening-balance repair. Classification remains pending with 221 unresolved transactions and close remains blocked; all 663 pending suggestions remain review-only and administrator booking decisions are still separately gated.

Current review category contract: production review options are flat `{ id, name }` records because the deployed `Category` model has no parent relation. The Review page presents one authoritative category selector and approval sends only `projectId`, `transactionTypeId`, `categoryId`, and an optional reason. Legacy main/subcategory fields remain display-only compatibility data and are not authoritative booking dimensions. The Phase 18/19 implementation, authentication hardening, and controlled suggestion persistence are deployed; no administrator decision has been submitted for the 221 unresolved transactions.
Historical RC7 release-evidence gate: Phase 17 complete; superseded by the
deployed Phase 18/19 and Clerk session-readiness release above.
```

## Authoritative Progress

```text
Previous roadmap through Phase 17: 100%
Phase 18: complete; implementation deployed and the one-time production repair restored the approved cash controls
Phase 19: implementation deployed; the controlled history-v1 backfill persisted 663 pending suggestions; chronological evaluation and review prefill are live; administrator decisions remain owner-gated
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

The detailed Phase 18 and Phase 19 acceptance criteria below are historical
implementation evidence. Their later approved production outcomes are recorded
in the current position above.

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

## Phase 19 — History-based review prefill

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
- Project, transaction type, flat category, confidence, and reason are prefilled and visible.
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
- Historical implementation acceptance: no production backfill, deployment, external provider, commit, or push occurred without separate owner approval. The later controlled persistence is recorded above.

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

Controlled production suggestion persistence evidence:

- On 2026-07-14 at 08:48:46 UTC (09:48:46 Europe/Lisbon), the existing deployed `history-v1` implementation was executed exactly once on commit `6b7ddba217103d7fdb8e0291710686feb3e2836f`.
- The request returned HTTP 201 with `status: CREATED`, `dryRun: false`, `writesPerformed: true`, `unresolvedTransactionCount: 221`, `completeRankOneCount: 221`, `uncoveredTransactionCount: 0`, `plannedSuggestionCount: 663`, `createdSuggestionCount: 663`, and `expiredSuggestionCount: 0`.
- The response reported `createsCategorizationSuggestion: true`, `expiresPendingSuggestion: false`, `createsTransactionBooking: false`, `closesPeriod: false`, and `mutatesBankFacts: false`. The 663 transaction-level proposal rows are intentionally not reproduced in this document.
- Post-execution review exposes 663 pending suggestions: ranks 1, 2, and 3 each contain 221 rows; all rows are complete and evidence-bearing; no direction conflicts were found.
- Persisted distribution: `DEFAULT` 656 and `OVERALL` 7; matchers are `NORMALIZED_HISTORY` 353, `FUZZY_HISTORY` 152, `DIRECTION_DEFAULT` 151, and `BEST_HISTORY` 7. The three primary `OVERALL` candidates and 218 primary `DEFAULT` candidates remain administrator decisions.
- The execution guard `ALLOW_SUGGESTION_BACKFILL_EXECUTION` was disabled immediately afterward and independently verified disabled in Dokploy. No unrelated runtime environment field changed.
- Post-execution controls remain `cashStatus: PASSED`, `classificationStatus: PENDING`, `closeStatus: BLOCKED`, 902 transactions, 221 unresolved transactions, zero duplicate fingerprints, and zero running-balance errors. No `TransactionBooking`, `ReviewDecision`, transaction finalization, period close, report snapshot, bank-fact, opening-balance, or migration write occurred.

## Exact next execution sequence

Phases 0–9 are complete as a published RC4 owner-decision handoff through `f2f7cbb`. Phase 10 production schema cutover was completed on 2026-07-07: PostgreSQL 15.8, database finance, schema finance, 4 migrations applied, 30 tables verified. Evidence: `docs/PRODUCTION_SCHEMA_CUTOVER_EVIDENCE_NL.md`.

The Phase 18/19 implementation and production authentication hardening use
application implementation commit `f9e967f54632f86bad2ef3c5774334a48cda85ad`;
the running build SHA is verified externally from the no-cache
deployment-info endpoint after each release. The one-time
owner-approved opening-balance repair is complete; it must not be executed
again. Cash integrity passes, while the 221 unresolved 2026 transactions keep
classification pending and close blocked.

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




---

## Transaction Review and Intelligence Program — executable plan

Status: **roadmap aligned; Program Phase 4 is NEXT after Phase 2/3 closeout evidence**

Architecture: `docs/ACCOUNTING_INTEGRITY_AND_REVIEW_PREFILL.md`  
Roadmap: `docs/ROADMAP.md`  
Persistent handoff: `docs/finance-rebuild-run.md`

### Durable execution contract

This repository is the source of truth. Chat history is not durable project memory. Before selecting or executing work, an agent must read the four documents above, verify source/branch/HEAD/worktree, and confirm the current task from the persistent handoff. After each coherent slice, update the handoff with changed paths, validation, commits, blockers, and the exact next task.

The seven program phases and their dependencies are governed by `docs/ROADMAP.md`. This section preserves Phase 2 implementation history and governs Phase 2/3 closeout plus the exact Phase 4 handoff.

Normalized planning estimate — not an official product metric:

| Program phase | Estimated completion | Current gate |
|---|---:|---|
| Phase 1 | 40% | Freeze corrected 221-item benchmark and dimension-level labels. |
| Phase 2 | 90% | Complete documented production closeout and acceptance evidence. |
| Phase 3 | 95% | Complete Phase 3.8E and consolidated Phase 3.9 validation/rollback evidence. |
| Phase 4 | 0% | Next after Phase 2/3 exit gates. |
| Phase 5 | 0% | Blocked until all Phase 4 contracts and the pre-AI baseline pass. |
| Phase 6 | 0% | Not started. |
| Phase 7 | 0% | Not started. |
| **Normalized seven-phase total** | **32%** | Equal-weight estimate, rounded. |

Merchant merge, split, and knowledge-reassignment confirmation are explicitly deferrable and are not blockers for Phase 3 acceptance, Phase 4, or bounded Phase 5 shadow inference. They remain separately approved administrator capabilities and must not be implemented opportunistically.

## IMPLEMENTED — Program Phase 2: server-paginated compact review table; production closeout pending

### Objective

Redesign `/review` (`Te beoordelen`) so a reviewer can scan, edit, and individually confirm a large unresolved queue efficiently without weakening accounting integrity.

### Verified current implementation areas

Current source inspection has identified these existing surfaces:

- `src/app/review/page.tsx` — route entry;
- `src/ui/FinanceReviewPage.tsx` — current card-oriented review UI;
- `src/helpers/review-page.ts` — review formatting and payload helpers;
- `src/helpers/api-transaction-mapper.ts` — API-to-ledger mapping;
- `src/context/ledger-context.tsx` — review/ledger client state;
- `src/libs/api.ts` — `EvidenceRichReviewItem` and review client contract;
- `server/routes/review.ts` — review read and individual decision routes;
- `server/services/reviewQueueService.ts` — evidence-rich unresolved queue;
- `server/services/reviewDecisionService.ts` — transactional audited confirmation.

Relevant targeted tests must be located and read before editing. A listed file changes only when exact current source proves it necessary.

### Required API contract

The read route must accept server-side pagination:

```http
GET /api/review?page=1&pageSize=25
```

Allowed `pageSize` values are `25`, `50`, and `100`; default is `25`. Invalid values must be handled consistently with existing route-validation conventions.

The response must retain the existing transaction and option data while adding:

```json
{
  "pagination": {
    "page": 1,
    "pageSize": 25,
    "totalItems": 221,
    "totalPages": 9,
    "hasPreviousPage": false,
    "hasNextPage": true
  }
}
```

Filter and sort parameter names must follow current repository conventions after exact route inspection. Required Phase 2 capabilities are:

- reliability/confidence band;
- transaction direction;
- project;
- category;
- unresolved or incomplete state;
- default sort: lowest reliability, then highest absolute amount/materiality, then oldest unresolved date.

`new merchant` and `conflicting history` are reserved for later phases because those first-class signals do not yet exist.

### Required UI behavior

Use one compact row per transaction. Every row visibly includes date, counterparty, description/payment purpose, amount, project, transaction type, category, reliability, and an individual confirmation action.

Project, transaction type, and category are editable inline and searchable where supported by the existing component system. The primary action reads `Confirm` when unchanged and `Confirm changes` or an equivalent Dutch label after edits. A successful confirmation shows bounded success feedback, updates the remaining count and current page safely, and then removes or refreshes the row without making another unresolved transaction unreachable.

Each row includes expandable evidence/details for proposal source, deterministic/history evidence, alternatives, supporting/conflicting evidence, and dimension confidence where available.

Reliability presentation uses color plus text plus score:

- green: very reliable, provisional `>=95%`;
- amber: review carefully, provisional `75–94%`;
- red: uncertain, provisional `<75%`;
- gray: insufficient evidence.

These are provisional product bands, not calibrated probabilities. The UI must not rely on color alone. Desktop uses a compact table or table-like list; mobile uses a responsive stacked-row treatment without losing the individual confirm action.

### Integrity requirements

- Reads remain side-effect free.
- Suggestions remain distinct from `TransactionBooking`.
- Individual confirmation continues through the existing audited manual-classification path.
- Administrator authorization remains enforced.
- Viewer access remains read-only.
- Locked-period protections remain intact.
- Confirmation remains transactional.
- Bulk confirmation remains unavailable.
- No Bedrock, AI inference, merchant schema, vector retrieval, or automatic booking is added.

### Acceptance criteria

1. With 221 unresolved records and page size 25, metadata reports nine pages.
2. Every unresolved record is reachable exactly once under stable filters and sort.
3. Pagination is applied in the server/service query, not by slicing a fully loaded client queue.
4. One row represents one transaction and exposes all required visible fields.
5. Every row has its own confirm action.
6. Inline edits use the existing audited decision path.
7. Reading a suggestion never creates a booking.
8. Confirmation creates accounting truth transactionally and records audit evidence.
9. Administrator, viewer, and unauthenticated behavior remain correct.
10. Locked-period rejection remains correct.
11. Bulk confirmation is absent or explicitly rejected.
12. Reliability meaning is available without color.
13. Mobile review remains usable.
14. Confirmation updates page and remaining counts without skipping or duplicating unresolved records.
15. Existing financial-integrity controls remain unchanged.

### Smallest meaningful validation

Before validation, locate exact package scripts and targeted tests. Run only the smallest relevant set unless repository policy requires more:

- review queue service tests;
- review route/API response-shape tests;
- review decision/integrity tests;
- pagination first/middle/last/out-of-range and page-size tests;
- filter and default-sort tests;
- authorization and viewer-read-only tests;
- locked-period tests;
- suggestion-versus-booking separation tests;
- targeted review UI/component/helper tests;
- affected TypeScript type checks;
- responsive/mobile verification where existing tooling supports it.

Perform at most one bounded repair attempt for a clear validation failure. Review the final diff and run the documentation/roadmap consistency guard if available.

### Completion and checkpoint policy

After the largest coherent validated Phase 2 slice:

1. persist changed paths and exact behavior completed in `docs/finance-rebuild-run.md`;
2. persist all validation commands and exit results;
3. persist blockers and remaining acceptance criteria;
4. write the exact next task so a new conversation can resume without chat context;
5. commit only explicit Phase 2 paths if policy permits and validation passes;
6. do not push.

### Program Phase 1 and future phases

Program Phase 1 benchmark/instrumentation supports later calibration and remains partially open for the corrected 221-item benchmark freeze. Program Phase 2 implementation is complete with production closeout pending. Program Phase 3 is in acceptance closeout, Program Phase 4 is next, and Program Phases 5–7 remain gated future work to improve accuracy, evidence, calibration, and reviewer experience for the 221 unresolved transactions and future review queues. Later phases must not bypass their documented entry gates.

Future work is governed by:

- implemented accounting/review entrypoint: `docs/ACCOUNTING_INTEGRITY_AND_REVIEW_PREFILL.md`;
- invariants: `docs/architecture/ARCHITECTURAL_INVARIANTS.md`;
- system boundaries: `docs/architecture/SYSTEM_ARCHITECTURE.md`;
- Merchant Knowledge: `docs/architecture/MERCHANT_KNOWLEDGE_ARCHITECTURE.md`;
- Decision Engine: `docs/architecture/DECISION_ENGINE_ARCHITECTURE.md`;
- phase order and gates: `docs/ROADMAP.md`.

For every future slice, exact files, symbols, schema surfaces, APIs, and commands must be verified from current source before editing. The functional areas below are anticipated boundaries, not claims that specific files must change.

## CLOSEOUT — Program Phase 3: Merchant Knowledge Layer

**Implementation progress:** Phase 3.1–3.7 core Merchant Knowledge contracts, schema/migration design, deterministic fingerprints, workspace-scoped alias resolution, pure conflict/merge/split/reassignment/deprecation planning, dry-run backfill planning, and retrieval-anchor integration are complete. Phase 3.8A read contracts, Phase 3.8B read-only administrator UI, Phase 3.8C plan previews, and Phase 3.8D individual confirmation for alias deprecation, merchant deprecation, and conflict resolution are complete. The additive schema and canonical migration `20260719095000_add_merchant_knowledge` remain replay-validated, application-compatible, and guarded by server-only capabilities. Phase 3.8E authenticated production acceptance and Phase 3.9 consolidated validation/rollback evidence remain. Merge, split, and knowledge-reassignment confirmation are explicitly deferred optional administrator capabilities and are not blockers for Phase 3 closeout, Phase 4, or bounded Phase 5 shadow inference.

**Phase objective:** create stable workspace-scoped merchant evidence that improves deterministic categorization and confirmed-history retrieval without changing raw bank facts or creating bookings.

**Phase prerequisites:** Program Phase 2 complete; invariants and Merchant Knowledge architecture approved; current source and workspace model verified.

**Phase exclusions:** no Bedrock, no AI inference, no automatic booking, no destructive backfill, and no silent merchant merge.

### Phase 3 bounded slices

| Slice | Objective and prerequisites | Anticipated areas, tests, and validation | Completion evidence and rollback |
|---|---|---|---|
| 3.1 Domain and data-contract design — COMPLETE | Define merchant identity, alias, fingerprint, resolution result, conflict, merge/split, audit/provenance, workspace isolation, retrieval anchor, and dry-run backfill contracts after verifying current workspace, transaction, suggestion, booking, review, history, fingerprint, and audit models. | Completed in `docs/architecture/MERCHANT_KNOWLEDGE_ARCHITECTURE.md` under “Program Phase 3.1 — Source-grounded domain and data contracts”; no schema, migration, service, API, UI, backfill, Bedrock, or AI code changed. | Approved source-grounded additive contract with raw-fact separation, confirmed-history-only retrieval, explicit abstention, no booking side effects, and exact Phase 3.2 design questions. Rollback by reverting documentation before schema work. |
| 3.2 Additive schema and migration planning — COMPLETE | Resolve audit, resolution persistence, alias privacy, source identifiers, PostgreSQL partial uniqueness, UI data boundaries, exact models/enums/indexes, migration order, replay validation, rollback, and 221-item measurement requirements after full Prisma and migration inspection. | Completed in `docs/MERCHANT_KNOWLEDGE_SCHEMA_PROPOSAL.md`; no Prisma schema or migration file changed. Proposal defines additive models, restrictive relations, raw-SQL partial indexes, disposable replay expectations, and a source-grounded future change map. | Approved implementation-ready schema/migration design with no destructive operation, no transaction/booking/review rewrite, no suggestion seed, safe-disable behavior, and Phase 3.3 as the exact next task. Rollback by reverting documentation before implementation. |
| 3.3 Deterministic fingerprint extraction — COMPLETE | Extract versioned merchant fingerprints only from currently proven immutable bank facts, without altering source fields or reusing import-deduplication fingerprints. | Implemented pure `server/services/merchantFingerprintExtractor.ts` and focused tests. Supported signals are validated counterparty IBAN/account evidence, normalized counterparty, payment purpose, and deterministic recurring-pattern input components. Creditor/card identifiers abstain because current imports do not expose reliable first-class values. | Deterministic SHA-256 hashes, masked IBAN display, stable ordering, explicit abstentions, workspace-required caller context, no input mutation, no persistence, and no booking/suggestion/review side effects. Disable by leaving the pure extractor unused; Phase 3.4 workspace-scoped alias resolution is next. |
| 3.4 Workspace-scoped alias resolution — COMPLETE | Resolve caller-supplied approved/trusted aliases against Phase 3.3 fingerprints within one required workspace using explicit precedence. | Implemented pure `server/services/merchantAliasResolver.ts` and focused tests. The resolver rejects cross-workspace records, ignores observed/proposed/deprecated/rejected aliases, resolves only when the strongest matching signal is unambiguous, preserves weaker supporting/conflicting evidence, and performs no lookup or write. | Versioned deterministic resolution, stable evidence ordering, explicit abstention for missing context/no match/no fingerprints, explicit conflict for strongest-signal collisions, no input mutation, and no persistence or booking side effects. Disable by leaving the pure resolver unused; Phase 3.5 conflict, merge, and split controls are next. |
| 3.5 Conflict, merge, and split controls — COMPLETE | Preserve ambiguity and produce administrator-confirmed plans for conflict resolution, merchant merges, splits, explicit knowledge reassignment, and deprecation without applying changes. | Implemented pure `server/services/merchantIdentityPlanService.ts` and focused tests. Plans require workspace, actor, request key, reason, explicit affected alias/fingerprint IDs, deterministic hashes, preserved evidence, collision/cycle checks, before/after snapshots, blocking errors, warnings, and reversible rollback steps. | Versioned input-order-independent plans only; cross-workspace data, duplicate/same IDs, cycles, unresolved alias/strong-fingerprint collisions, incomplete split partitions, missing intent, and discarded conflict evidence are rejected. No persistence or financial side effects. Phase 3.6 dry-run backfill is next. |
| 3.6 Dry-run backfill — COMPLETE | Measure known/new merchant coverage, alias consolidation, collisions, conflicts, unresolved cases, correction reuse, and retrieval-anchor readiness over the 221 unresolved transactions before any write. | Implemented pure `server/services/merchantBackfillPlanner.ts` and focused tests. The planner composes Phase 3.3 extraction and Phase 3.4 alias resolution, validates workspace/run/version/idempotency inputs, sorts transactions by date and ID, clamps server-style pages, calculates full-input metrics, and emits stable source/parameter/result/evidence hashes plus explicit no-side-effect flags. | Bounded paginated dry-run reports for page sizes 25/50/100, first/middle/final/empty/out-of-range pages, complete reachability, deterministic ordering, duplicate/cross-workspace rejection, known/new/conflicted/unresolved states, approved-correction-only reuse, and no persistence or financial side effects. Phase 3.7 retrieval-anchor integration is next. |
| 3.7 Retrieval-anchor integration — COMPLETE | Expose caller-supplied merchant resolution as optional, versioned, conflict-aware evidence for confirmed-history retrieval without expanding trusted history. | Implemented pure `server/services/merchantRetrievalAnchor.ts` and integrated it into `server/services/historySuggestionService.ts`. Only a READY, workspace/transaction-matching, conflict-free anchor can add a bounded 1,200-basis-point score to an eligible confirmed booking with the same optional merchant ID. Missing, disabled, unresolved, conflicted, stale, expired, cross-workspace, and non-matching anchors contribute zero while preserving anchor/evidence provenance. | Existing direction, date, target-self, complete-triple, grouping, ordering, and tie-breaking safeguards remain authoritative. Feature disablement reproduces prior non-merchant scoring; no booking, write, query, persistence, suggestion trust expansion, or financial side effect exists. Phase 3.8 separately approved UI/admin tooling is next. |
| 3.8 UI/admin tooling, separately approved — PHASE 3.8D `DEPRECATE_ALIAS`, `DEPRECATE_MERCHANT`, AND `RESOLVE_CONFLICT` CONFIRMATIONS COMPLETE; REMAINING ACTIONS UNSTARTED | Define a separate `/merchant-knowledge` workflow for authenticated read-only inspection and individually confirmed administrator actions without mixing merchant identity maintenance into `/review`. | Completed in `docs/MERCHANT_ADMIN_TOOLING_DESIGN.md`. The design specifies authenticated viewer reads, server-authoritative `requireAdmin` mutations, feature-disabled-by-default exposure, read/query, preview, transactional confirmation, dedicated audit, redaction, evidence/rollback, mobile/accessibility, and no-bulk contracts. Phase 3.8A read contracts, Phase 3.8B read-only UI, and Phase 3.8C administrator-only preview contracts are implemented. The first two bounded Phase 3.8D transactions are implemented for individual `DEPRECATE_ALIAS` and `DEPRECATE_MERCHANT` confirmation with server-authoritative administrator access, in-transaction plan/evidence revalidation, soft deprecation, deterministic idempotency, and atomic `MerchantIdentityDecision` plus `MerchantAuditEvent` persistence. Individual `RESOLVE_CONFLICT` confirmation is implemented for `SELECT_MERCHANT`, `ABSTAIN`, and `DISMISS` with server-authoritative administrator access, canonical conflict-state hashing, in-transaction candidate/status/resolution-link/evidence revalidation, atomic conflict/resolution/decision/audit persistence, deterministic idempotency, and no alias/fingerprint trust or financial side effects. Merge, split, and knowledge-reassignment confirmation remain unstarted. | Approved smallest slices: 3.8A read-only capability/query contracts, 3.8B read-only page, 3.8C admin plan preview, 3.8D individual transactional confirmation, and 3.8E production acceptance. No booking or bank-fact mutation is permitted; disabling the server capability must return the application to current behavior. |
| 3.9 Validation and rollback evidence | Prove Phase 3 improves identity consistency without weakening accounting. | Targeted domain, service, workspace, audit, migration, backfill, and no-booking tests; affected type checks and builds; secret scan and diff review. | Signed Phase 3 validation, dry-run evidence, disable path, and exact Phase 4 handoff. |

### Phase 2 and Phase 3 executable exit criteria

Program Phase 2 closes only when current production acceptance evidence confirms authenticated administrator and viewer behavior, all 221 unresolved transactions remain reachable and individually confirmable, pagination/filtering/risk ordering/mobile/accessibility behavior is current, authorization and locked-period protections pass, and no suggestion becomes a booking without explicit administrator confirmation.

Program Phase 3 closes only when Phase 3.8E authenticated production acceptance and rollback rehearsal plus Phase 3.9 consolidated validation prove workspace isolation, deterministic matching/conflict behavior, replay-safe schema state, safe disablement, retrieval-anchor correctness, privacy redaction, and zero booking or bank-fact mutation.

Merchant merge, merchant split, and knowledge-reassignment confirmation are deferred, optional administrator capabilities. They are not Phase 3 exit blockers because pure plans, previews, evidence hashes, rollback contracts, and safe-disabled mutation boundaries already exist. They must not delay Phase 4 or bounded Phase 5 shadow inference.

The exact next implementation task is Phase 4.1 only. It must define a side-effect-free, workspace-scoped confirmed-history eligibility contract over current bookings and review decisions; exclude pending, rejected, generated, superseded, and otherwise ineligible suggestions or decisions; preserve provenance and locked-period rules; emit a reproducible eligible-history set; and add focused contamination/isolation/no-write tests.

Phase 5 may begin only when all Phase 4 slices pass, the corrected 221-item deterministic pre-AI baseline is frozen and reproducible, candidate and Decision contracts are versioned and valid-ID constrained, every eligible item receives a deterministic Decision or explicit abstention, and provider/privacy/security/cost plus no-booking/no-contamination gates are approved.

## NEXT — Program Phase 4: Retrieval and Decision Foundation

**Phase objective:** build a deterministic, side-effect-free Decision foundation that retrieves only confirmed history and generates valid candidates for the 221-transaction benchmark.

**Phase prerequisites:** Phase 3 validated; confirmed-history eligibility rules approved; Decision Engine architecture approved.

**Phase exclusions:** no Bedrock, no Sonnet, no automatic booking, and no learning from suggestions.

### Phase 4 bounded slices

| Slice | Objective and prerequisites | Anticipated areas, tests, and validation | Completion evidence and rollback |
|---|---|---|---|
| 4.1 Confirmed-history eligibility contract — COMPLETE | Defines exactly which human-confirmed bookings may be retrieved and excludes suggestions, rejections, generated decisions, superseded outcomes, cross-workspace records, incomplete dimensions, and missing provenance. | `server/services/confirmedHistoryEligibilityService.ts`, `suggestionBackfillService.ts`, focused eligibility/backfill/history/review/auth tests; deterministic provenance, workspace, lock, supersession, contamination, zero-write, server build, full build, diff, and scan validation. | Reproducible `confirmed-history-v1` eligible-history set with explicit exclusion reasons and privacy-safe provenance. Rollback restores the prior direct booked-transaction history query. |
| 4.2 Retrieval scoring and bounded queries — COMPLETE | Ranks only `confirmed-history-v1` examples using the existing deterministic `history-v1` weights plus bounded query controls, Merchant Knowledge anchor support when the historical merchant identity matches, component scores, privacy-safe evidence summaries, threshold abstention, and stable retrieval hashes. | `deterministicHistoryRetrievalService.ts`, bounded eligibility loader controls, additive component-score export, backfill integration, focused retrieval/anchor/eligibility/history/backfill/auth tests, server/full builds, diff and scans. | Versioned `deterministic-history-retrieval-v1` output; 500-row default/1,000 hard bound, three candidates, five-year lookback, 3,000-bps threshold, stable tie-breaking/hashes, and rollback to the prior direct `history-v1` path. |
| 4.3 Supporting and conflicting evidence — COMPLETE | Adds deterministic, privacy-safe supporting and conflicting evidence for project, transaction type, and category over `deterministic-history-retrieval-v1` candidates without changing Phase 4.2 weights, bounds, thresholds, ranking, or tie-breaking. | `deterministicRetrievalEvidenceService.ts`, evidence-aware backfill abstention, focused agreement/conflict/sparse/privacy/anchor/workspace tests, Phase 4.1–4.2 regressions, server/full builds, diff and scans. | Versioned `deterministic-retrieval-evidence-v1` output with stable dimension evidence hashes, explicit material-conflict/insufficient-evidence abstention, 90% competing-score ratio, 3,000-bps competing-score floor, and rollback to Phase 4.2 retrieval-only output. |
| 4.4 Restricted candidate generation — COMPLETE | Generates only active, exact-ID, workspace-scoped project/type/category candidates supported by Phase 4.3 evidence, with inherited direction compatibility, deterministic ordering/hashes, bounded diagnostics, and explicit abstention for conflict, insufficiency, or empty dimensions. | `restrictedRetrievalCandidateService.ts`, candidate-gated backfill integration, focused candidate/fixture tests, Phase 4.1–4.3 and dimension/auth regressions, server/full builds, diff and scans. | Versioned `restricted-retrieval-candidates-v1` sets; five-candidate defaults, ten-candidate hard caps, ten-alternative default, 25-alternative hard cap, and rollback to Phase 4.3 evidence-only gating. |
| 4.5 Conceptual Decision contract — COMPLETE | Defines a pure, in-memory, privacy-safe `deterministic-decision-v1` DTO over Phase 4.1–4.4 outputs without changing booking truth or persisting Decisions. | `deterministicDecisionService.ts`, in-memory backfill gate, focused Decision/replay/staleness/privacy tests, Phase 4.1–4.4 and auth regressions, server/full builds, diff and scans. | Auditable overall/per-dimension `PROPOSED`, `ABSTAINED`, `CONFLICTED`, and `INCOMPLETE` representation with selected/allowed candidates, uncalibrated confidence placeholders, replay identity, stable hashes, and rollback to direct Phase 4.4 gating. |
| 4.6 Deterministic orchestration — COMPLETE | Combines optional rule and Merchant Knowledge contributors with mandatory retrieval, evidence, candidate, and `deterministic-decision-v1` identities through a pure `deterministic-orchestration-v1` envelope without model inference. | `deterministicDecisionOrchestrationService.ts`, in-memory backfill gate, focused contributor/agreement/conflict/replay/privacy tests, Phase 4.1–4.5 and auth regressions, server/full builds, diff and scans. | Canonically ordered contributors, `rule-history-agreement-v1` priority, optional Merchant failure isolation, mandatory Decision fail-closed behavior, deterministic replay/orchestration hashes, no invented timeout contract, and rollback to direct Phase 4.5 Decision gating. |
| 4.7 Isolation and integrity validation — COMPLETE | Proves the complete deterministic Phase 4 pipeline is workspace-scoped, read-only, privacy-safe at its externally consumable boundaries, deterministic under replay, and unable to book, mutate facts, bypass locks, or persist conceptual Decisions/orchestration. | `deterministicPhase4Integrity.test.ts`, full Phase 4.1–4.7 plus booking/review/period/ledger/auth regressions, server/full builds, diff and scans. | Integrity report showing zero planning writes/transactions, strict suggestion-versus-booking separation, locked-period/ledger preservation, stale-identity rejection, and rollback by removing the test-only proof. |
| 4.8 Benchmark baseline — COMPLETE | Uses the authoritative database-backed 2026 open-statement cohort and current administrator-confirmed booking/review outcomes without duplicating the 221 rows into fixtures. | `deterministicBenchmarkEvaluationService.ts`, `deterministicBenchmarkRunnerService.ts`, `runDeterministicBenchmark.ts`, focused tests, and `benchmark:deterministic` package script. Focused 21/21 and affected regressions 131/131 pass. Server and full builds pass. High-risk and secret-material scans clean. | Live read-only execution succeeded: sourceId `finance-db-open-statement-2026-221`; totalSourceRows 221; sourceHash `524b03d6f105798144a958804a1f9efaa554ef09d81fd59d9523813738f75a0d`; reportHash `526c3b6686b4db0a3be06dc8809f07329fbd8d569b2bc8e3d255fa27c376da46`; replay verified; zero writes; zero Prisma transactions. All 221 rows are `UNLABELED_PENDING_CONFIRMATION` — no confirmed labels exist yet. Phase 5 gate: `PHASE_5_GATE_UNDECIDABLE` / `NO_COMMITTED_NUMERIC_ACCEPTANCE_THRESHOLDS`. Starting commit: `6fd0024`. |

## TODO — Program Phase 5: AI Decision Engine

**Phase objective:** add constrained Bedrock Claude Haiku shadow inference to the Decision Engine while preserving human confirmation and trusted-history purity.

**Phase prerequisites:** Phase 4 retrieval, candidate, and Decision contracts validated; privacy, security, provider, and cost design approved.

**Phase exclusions:** no direct booking, no client-side model access, no learning from unconfirmed output, no Sonnet fallback, and no routine Opus use.

### Phase 5 bounded slices

| Slice | Objective and prerequisites | Anticipated areas, tests, and validation | Completion evidence and rollback |
|---|---|---|---|
| 5.1 Server-side Bedrock boundary | Define a trusted server-only inference adapter after verifying runtime and configuration conventions. | Configuration/client boundary subject to source verification; missing config, disabled provider, secret isolation, workspace, and no-browser-credential tests. | Provider adapter can be disabled without affecting review. Rollback removes its contribution. |
| 5.2 Structured request and response contracts | Send minimum approved context and require schema-constrained structured output. | Decision/inference DTOs subject to source verification; schema, payload minimization, size-limit, malformed-output, and privacy tests. | Versioned safe contract with no secret or unrelated data exposure. Rollback returns deterministic-only Decisions. |
| 5.3 Valid-ID enforcement | Reject every model selection outside supplied candidate sets. | Output validator; project/type/category membership, direction compatibility, stale candidate, and abstention tests. | Out-of-set IDs never reach review. Rollback disables model contribution. |
| 5.4 Haiku shadow inference | Run Haiku only in shadow mode over approved benchmark and eligible review items. | Inference orchestration subject to source verification; no-prefill/no-booking, idempotency, duplicate-decision, workspace, and side-effect tests. | Shadow results stored or reported separately from reviewer-visible truth. Rollback deletes derived shadow output. |
| 5.5 Versioning | Record model, prompt, retrieval, candidate-set, Decision Engine, evidence, and configuration versions. | Provenance/version contracts; missing-version, stale-decision, reproducibility, and serialization tests. | Every shadow decision is attributable and comparable. Rollback marks prior decisions stale. |
| 5.6 Timeout, retry, budget, and abstention | Fail closed under provider or budget pressure. | Bounded retry/timeouts, rate and budget controls, invalid response, partial failure, and fallback-to-review tests. | Failures yield abstention or deterministic-only Decisions. Disable switch is verified. |
| 5.7 Security and privacy verification | Prove server-only access, least-data payloads, safe logs, and workspace isolation. | Security review, secret scan, log-redaction, cross-workspace, retention, and provider-request evidence. | Approved privacy/security checkpoint. Rollback disables provider access. |
| 5.8 No-booking integrity | Prove model output cannot create accounting truth or trusted learning data. | Booking, review-decision, locked-period, audit, and trusted-history contamination tests; affected builds/type checks. | Zero AI-created bookings and zero unconfirmed learning examples. Rollback leaves manual review unchanged. |

## TODO — Program Phase 6: Evaluation, Calibration, and Observability

**Phase objective:** prove whether the new intelligence improves the 221 categorizations, calibrate confidence, define Sonnet escalation, and make quality, latency, and cost observable.

**Phase prerequisites:** Phase 5 shadow output; corrected benchmark labels frozen; benchmark separation rules approved.

**Phase exclusions:** no automatic booking, no broad rollout, and no Sonnet use outside the approved fallback policy.

### Phase 6 bounded slices

| Slice | Objective and prerequisites | Anticipated areas, tests, and validation | Completion evidence and rollback |
|---|---|---|---|
| 6.1 Benchmark finalization | Freeze corrected labels, inclusion rules, versions, and leakage controls for the 221 transactions. | Benchmark fixtures/reporting subject to source verification; completeness, version, leakage, and reproducibility tests. | Immutable benchmark version and data-quality report. Rollback creates a new benchmark version rather than rewriting history. |
| 6.2 Per-dimension metrics | Measure project, type, category, complete classification, top-three, coverage, and abstention. | Evaluation services; metric-definition, denominator, edge-case, and reproducibility tests. | Comparable deterministic, Haiku, and later Sonnet scorecards. Rollback removes derived reports. |
| 6.3 Confidence calibration | Convert rule/retrieval/model signals into calibrated per-dimension and combined confidence. | Calibration services subject to source verification; holdout, calibration error, monotonicity, sparse-band, and version tests. | Versioned calibration profiles with measured precision. Rollback reverts to uncalibrated/gray presentation. |
| 6.4 False-high-confidence measurement | Identify and explain wrong green-band decisions. | Evaluation/evidence reporting; band-boundary, false-positive, materiality, and conflict tests. | Auditable list and rate of false high-confidence cases. Rollback tightens or disables the band. |
| 6.5 Sonnet escalation policy | Define deterministic triggers for ambiguity, conflict, novelty, or materiality. | Routing policy subject to source verification; trigger, non-trigger, budget, model-version, and no-booking tests. | Reproducible fallback policy with measured incremental value. Disable Sonnet independently. |
| 6.6 Observability and cost metrics | Track latency, failures, tokens, cost, cache behavior, escalation, and correction outcomes safely. | Observability boundaries; metric semantics, privacy, workspace aggregation, missing-event, and alert tests. | Operational dashboard/report contract with no secret or sensitive-detail leakage. Rollback disables telemetry consumers. |
| 6.7 Shadow-mode reporting | Compare deterministic, Haiku, and approved Sonnet outcomes against human truth. | Reporting/evaluation boundaries; version comparison, drift, known/new merchant, correction-rate, and cost tests. | Repeatable shadow report for rollout review. Rollback deletes derived reports only. |
| 6.8 Rollout gate review | Decide whether precision, calibration, safety, cost, and rollback criteria permit Phase 7. | Architecture, accounting, privacy, and owner review; consistency guards and evidence checklist. | Explicit go/no-go decision and thresholds. No-go leaves all AI in shadow mode. |

## TODO — Program Phase 7: Controlled Rollout

**Phase objective:** expose only calibrated, evidence-backed suggestions to reviewers while retaining individual human confirmation and safe disable/rollback controls.

**Phase prerequisites:** Phase 6 go decision; green-band precision gate satisfied; production disable and rollback controls verified.

**Phase exclusions:** automatic booking is not included by default and no integrity or authorization control may be bypassed.

### Phase 7 bounded slices

| Slice | Objective and prerequisites | Anticipated areas, tests, and validation | Completion evidence and rollback |
|---|---|---|---|
| 7.1 Controlled reviewer exposure | Enable approved suggestions for a bounded reviewer cohort or workspace scope. | Review/feature-control surfaces subject to source verification; authorization, cohort, no-booking, and disable tests. | Limited exposure with explicit provenance. Disable returns to deterministic/manual review. |
| 7.2 Confidence-band presentation | Present calibrated per-dimension and combined confidence with evidence and no color-only meaning. | Existing review UI/helpers subject to source verification; accessibility, stale-profile, conflict, mobile, and viewer tests. | Reviewers can distinguish reliable, uncertain, and abstained dimensions. Rollback shows gray/unavailable confidence. |
| 7.3 Safe disable controls | Provide server-side controls that stop Haiku, Sonnet, calibration exposure, or all AI contributions independently. | Configuration/feature boundaries; default-off, failure, authorization, and restoration tests. | Verified kill switches with documented state. Rollback activates deterministic-only mode. |
| 7.4 Budget and escalation monitoring | Enforce approved cost and Sonnet limits in production. | Budget/routing observability; limit, alert, overrun, retry, and degraded-mode tests. | No unbounded inference spend; exceeded budgets degrade safely. |
| 7.5 Production acceptance | Verify desktop/mobile review, API behavior, console/network, authorization, evidence, and no-booking integrity. | Existing approved browser/runtime tooling; targeted tests and build when code changes. | Factual production evidence with unsafe confirmation left unexecuted unless explicitly approved. Rollback disables AI exposure. |
| 7.6 Rollback rehearsal | Demonstrate removal of AI contribution without loss of review availability or accounting state. | Deployment/configuration rehearsal; state, cache, stale-decision, and recovery checks. | Reproducible rollback evidence and recovery time. |
| 7.7 Roadmap and handoff closeout | Record outcomes, residual risks, metrics, commits, and exact next task. | Documentation consistency, release evidence, secret scan, and diff review. | Phase 7 status reflects factual production evidence. Any automation proposal requires a separate approved roadmap phase. |

## Future-program completion rule

No future phase is complete merely because code exists. Completion requires validated improvement against the 221-transaction benchmark, preserved suggestion-versus-booking separation, administrator-only confirmation, locked-period enforcement, workspace isolation, confirmed-outcomes-only learning, operational rollback evidence, and an updated persistent handoff. Automatic booking remains outside the default Program Phase 3–7 scope.
