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
Current gate: SAFE-009 requires explicit owner commit approval
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

Status: `BLOCKED`

Blocker: owner must explicitly approve a commit after reviewing validation evidence.

Actions after approval:

1. Stage only the explicitly listed changed paths.
2. Commit with a focused message.
3. Record commit hash and message in the handoff and implementation plan.

## Phase 2 — Financial domain model

### MODEL-001 — Specify exact domain entities and invariants

Status: `TODO`

Dependencies: SAFE-009, or an explicit owner instruction to proceed without committing Phase 1

Files:

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

- Documentation review only; no schema write in this task.

### MODEL-002 — Implement explicit `Klant`, `Type`, and `Category` model

Status: `TODO`

Dependencies: MODEL-001 and owner approval of proposed schema

Files:

- `prisma/schema.prisma`
- new Prisma migration
- affected server services and tests

Acceptance:

- Every final transaction can reference all three required dimensions.
- Literal historical labels are retained.
- Existing categories migrate without silent merges.

Validation:

- Prisma validate/generate.
- Migration on disposable database.
- Targeted model tests, full tests, both builds.

### MODEL-003 — Implement immutable suggestion and review-decision records

Status: `TODO`

Dependencies: MODEL-002

Acceptance:

- Suggestion stores category, confidence, evidence, alternatives, and matcher/rule provenance.
- Review decision stores administrator, timestamp, previous/final values, and reason where required.
- Final transaction state cannot be inferred solely from raw JSON metadata.

Validation:

- Targeted service/API tests.
- Full tests and builds.

### MODEL-004 — Implement statement controls and source-file retention model

Status: `TODO`

Dependencies: MODEL-002

Acceptance:

- Stores original file bytes unchanged, hash, filename, size, account, period, row count, opening, income, expenses, and closing.
- Original file can be downloaded byte-identically.
- Duplicate file hashes cannot create duplicate statements.

Validation:

- Upload/download byte comparison tests.
- Statement-control tests.

### MODEL-005 — Implement period-close, report-snapshot, and dispatch model

Status: `TODO`

Dependencies: MODEL-002

Acceptance:

- Closed period controls and report figures are immutable.
- Reopen metadata and report-send metadata are auditable.

Validation:

- Model/service tests and disposable migration.

## Phase 3 — Historical data foundation

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

Status: `TODO`

Dependencies: HIST-004

Acceptance:

- Dutch preview shows account, period, counts, duplicates, overlap, and statement totals before commit.
- Failed controls prevent commit.

### FLOW-002 — Implement deterministic automatic categorization service

Status: `TODO`

Dependencies: FLOW-001 and MODEL-003

Acceptance:

- Only approved unique rules and complete exact replays finalize categories.
- Conflicting matches produce review suggestions.

### FLOW-003 — Implement evidence-rich Dutch review queue

Status: `TODO`

Dependencies: FLOW-002

Acceptance:

- Shows date, counterparty, IBAN, amount, direction, full payment purpose, proposed `Klant`, `Type`, `Category`, evidence, confidence, and alternatives.
- Administrator can approve or choose exact historical labels.
- No unsafe bulk acceptance.

### FLOW-004 — Implement explicit rule creation from approved decision

Status: `TODO`

Dependencies: FLOW-003

Acceptance:

- Rule creation is a separate administrator choice.
- Rule conditions and expected category are previewed before activation.
- Ambiguous or broad rules are rejected.

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

1. Owner reviews the governance documents, Phase 1 diff, and validation evidence.
2. If the owner explicitly approves a commit, execute SAFE-009 using only the intended paths.
3. Record the commit hash in this plan and `docs/finance-rebuild-run.md`.
4. Begin MODEL-001 as a documentation-only schema proposal; do not change Prisma until the owner approves that proposal.
5. If the owner requests revisions instead, update the named task and rerun its required validation before committing.
