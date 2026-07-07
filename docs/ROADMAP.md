# Yeshua Academy Finance — Roadmap

Status: authoritative  
Depends on: `docs/PHILOSOPHY.md`, `docs/STRATEGY.md`  
Execution detail: `docs/IMPLEMENTATION_PLAN.md`

## Roadmap rules

- Phases are ordered by accounting dependency, not visual priority.
- A later phase may begin only when the required controls from earlier phases are validated.
- Historical facts and owner decisions are never rewritten to simplify implementation.
- Every phase ends with tests, builds, financial-control validation, diff review, and documentation updates.
- No production import, deployment, or migration occurs without an explicit approved task.

## Current position

```text
Phase 0 — Governance and verified controls       COMPLETE
Phase 1 — Safe categorization foundation         COMPLETE
Phase 2 — Financial domain and historical model  COMPLETE
Phase 3 — Historical loading and truth fixtures  COMPLETE_LOCAL_OWNER_GATED_PRODUCTION
Phase 4 — Monthly import and review workflow     COMPLETE_LOCAL_APP_WORKFLOW
Phase 5 — Reconciliation, close, and snapshots   COMPLETE
Phase 6 — Visual reports and distribution        COMPLETE
Phase 7 — Dutch UX and authorization hardening   COMPLETE
Phase 8 — Infrastructure and deployment          COMPLETE (local readiness; production gated)
Phase 9 — Operational hardening and handoff      COMPLETE (published RC4 handoff; owner decisions gated)
Phase 9 post-push evidence and decision hardening COMPLETE (published at f2f7cbb; next decision selection gated)
Phase 10 — Production schema cutover             COMPLETE (2026-07-07; finance schema deployed; historical import gated)
Phase 11 — Production historical import          COMPLETE (2026-07-07; 2024/2025 concluded data imported; 2026 partial open statement imported and not closed; 902 transactions, 681 bookings)
```

## Phase 0 — Governance and verified controls

Status: **complete**

### Outcomes

- Establish the product philosophy, strategy, roadmap, and AI implementation plan.
- Record owner decisions and accounting principles.
- Verify the 2024, 2025, and supplied 2026 source controls.
- Audit the current application and obsolete Docker Compose file.
- Preserve a resumable rebuild handoff.

### Verified financial baselines

| Period | Transactions | Opening | Income | Expenses | Closing |
| --- | ---: | ---: | ---: | ---: | ---: |
| 2024 | 268 | EUR 1,721.86 | EUR 32,267.19 | EUR 21,804.90 | EUR 12,184.15 |
| 2025 | 413 | EUR 12,184.15 | EUR 91,642.44 | EUR 93,475.73 | EUR 10,350.86 |
| 2026-01-01 through 2026-07-01 | 221 | EUR 10,350.86 | EUR 58,784.08 | EUR 61,297.69 | EUR 7,837.25 |

### Exit evidence

- `docs/PHILOSOPHY.md`
- `docs/STRATEGY.md`
- `docs/ROADMAP.md`
- `docs/IMPLEMENTATION_PLAN.md`
- `docs/finance-rebuild-run.md`

## Phase 1 — Safe categorization foundation

Status: **complete; validated and committed as `925a609`**

### Outcomes

- Parse ING payment purpose as first-class structured evidence.
- Allow approved deterministic rules to use payment purpose.
- Remove unsafe amount-only, popularity, and broad historical automatic fallbacks.
- Keep fuzzy and heuristic results as suggestions only.
- Store proposed and final category state separately.
- Use Dutch review placeholder wording.
- Add regression tests proving uncertain matches cannot auto-book.

### Current state

Implemented, validated, and committed as `925a609` (`fix: make finance categorization review-safe`). All 229 tests passed, the server and production builds passed, and executable/test paths passed the full high-risk security scan. Documentation scans contained no secret-material or runtime-execution findings.

### Exit criteria

- Complete test suite passes.
- Server TypeScript build passes.
- Next.js production build passes.
- Security scan passes for all changed paths.
- Diff confirms no financial import, infrastructure, production configuration, or unrelated changes.
- Owner reviews changes before any commit.

## Phase 2 — Financial domain and historical model

Status: **complete through MODEL-005; MODEL-001, MODEL-002, MIGRATE-001, MODEL-003 Packet A, MODEL-003 Packet B, and MODEL-004/005 committed**

### Outcomes

- Model `Klant`, `Type`, and `Category` as explicit required dimensions.
- Preserve original historical labels exactly.
- Model category aliases or interpretation metadata without rewriting history.
- Add explicit suggestion, review-decision, statement-control, period-close, report-snapshot, and report-dispatch concepts.
- Define immutable source-file retention and download behavior.
- Define administrator versus view-only permissions server-side.

### Important design constraint

Schema changes must be derived from verified workflow needs. Do not create a generic accounting schema or speculative abstraction layer.

### Current checkpoint

- `docs/DOMAIN_MODEL.md` is approved and defines the accepted entities, fields, relationships, invariants, and migration order.
- MODEL-001 is complete as documentation only and committed as `73daabd`.
- MODEL-002 added workspace ownership plus explicit `Klant`, `Type`, and category dimensions, validated them on isolated PostgreSQL, and committed them with MIGRATE-001 as `d2afb18735dce113a69d9ad40c3c8e4b3ce562df`.
- MIGRATE-001 normalized the active migration history to a generated baseline plus the unchanged MODEL-002 migration, with the 17 legacy migrations archived byte-identically.
- `docs/MODEL_003_CLASSIFICATION_RECORDS_PROPOSAL.md` was owner-approved and Packet A added additive persistence for immutable bookings, suggestions, and review decisions.
- MODEL-003 Packet A deployed cleanly to disposable PostgreSQL, had no database-to-schema drift, passed focused tests, full tests, server build, production build, and executable high-risk scan, and was committed as `019691091bb1b4b75d1c822d05f3d4e08cadface`.
- `docs/MODEL_003_PACKET_B_PROPOSAL.md` defined the bounded behavior-transition proposal; Packet B routes manual review changes through an atomic review-decision service, rejects unsafe bulk/manual-truth shortcuts, and was committed as `b3b8afd`.
- MODEL-004/005 added additive statement-control, source-file retention, period-close, report-snapshot, approval, and dispatch models plus focused service boundaries and tests; disposable local PostgreSQL validation applied all four active migrations, reported no schema drift, and was committed as `49386ad`.
- July 2026 remains partial and cannot authorize a monthly close.
- No financial import, Docker, dependency, environment, production configuration, `.graphifyignore`, or `graphify-out/` change has been made for MODEL-004/005.

### Exit criteria

- Prisma schema and migration are reviewed.
- Domain invariants have targeted tests.
- Existing import, ledger, review, and report APIs compile against the new model.
- Migration works on a disposable PostgreSQL database.

## Phase 3 — Historical loading and truth fixtures

Status: **complete local/sanitized; production import owner-gated** — sanitized fixtures, owner-approved local rehearsal adapter, retained-byte hashing, disposable local database rehearsal, and guarded dry-run command service are complete. Historical production import remains blocked until explicit owner approval.

### Outcomes

- Build an exact local/rehearsal loader for the concluded 2024 and 2025 workbooks.
- Read dates only from the raw ING `Date` field.
- Use the final transaction columns and resolved `Verduidelijking` sheets.
- Preserve literal `Klant`, `Type`, and `Category` values.
- Preserve `FR` history and use the first literal 2025 `FTK` transaction as the practical transition point.
- Import the supplied 2026 statement as open, with July remaining incomplete.
- Store source files unchanged and downloadable in owner-approved local rehearsal or future approved production import.

### Current checkpoint

- Sanitized fixture-derived import planning and local DB rehearsal are implemented.
- Sanitized rehearsal stores `SourceFile.sha256` as the hash of retained synthetic bytes, while source inventory hashes remain metadata.
- Owner-approved local rehearsal reads only the approved owner files from absolute paths outside Git, verifies expected hashes, persists exact retained bytes to disposable local PostgreSQL, and validates the 2024, 2025, and 2026 controls.
- The 2026 source remains partial/open and not close-eligible; no production import has occurred.
- A guarded owner historical import command service now defaults to dry-run, returns only sanitized summaries, blocks production execution, and enforces local-only rehearsal database targets.
- No owner source files, raw row dumps, generated output, production configuration, `.env`, `.graphifyignore`, or `graphify-out/` artifacts are committed.
- Production historical import remains an owner-gated task; local/sanitized historical loading machinery is complete.

### Exit criteria

- 2024 loads exactly 268 rows and reconciles to EUR 12,184.15.
- 2025 loads exactly 413 rows, opens at EUR 12,184.15, and closes at EUR 10,350.86.
- 2026 partial statement loads exactly 221 rows and closes at EUR 7,837.25.
- Running-balance continuity errors equal zero.
- Source file hashes and downloaded bytes match the originals in owner-approved local rehearsal; production import requires owner approval.
- No historical label is changed.

## Phase 4 — Monthly import and review workflow

Status: **complete for local/app workflow** — FLOW-001 through FLOW-004 are implemented and validated; future real owner monthly files remain operator-controlled through the guarded import workflow.

### Outcomes

- Provide one clear Dutch monthly ING import workflow.
- Show account, period, row count, duplicates, overlap, opening, income, expenses, and closing before committing.
- Reject invalid controls before ledger changes.
- Retain exact supplied CSV bytes as the hash basis for preview source-file evidence.
- Keep FLOW-001 preview-only: no transaction bookings, period closes, historical production import, or production configuration changes.
- Apply only approved deterministic rules automatically.
- Final categorization decisions require exactly one complete deterministic source, or an approved rule and exact historical replay that agree on all three dimensions.
- Conflicting, incomplete, ambiguous, or non-exact matches remain review suggestions or unmatched.
- Rank fuzzy suggestions without booking them.
- Show full payment purpose and matching evidence in the review queue.
- Require explicit administrator approval or categorization.
- Allow deliberate rule creation from confirmed decisions.
- Preview rule conditions and expected `Klant`, `Type`, and `Category` before activation.
- Reject broad, ambiguous, duplicate, conflicting, incomplete, or non-exact rule candidates.
- Keep rule preview and activation separate from transaction booking and period close writes.
- Remove or disable unsafe bulk-confirm actions.

### Exit criteria

- No unresolved transaction is counted as final categorized data.
- Duplicate and overlapping imports cannot duplicate ledger facts.
- Administrator review decisions are auditable.
- View-only users cannot mutate transactions or rules.

## Phase 5 — Reconciliation, close, and immutable snapshots

Status: **complete** (CLOSE-001, CLOSE-002, CLOSE-003, and CLOSE-004 all done)

### Outcomes

- Add statement-level opening, income, expenses, and closing controls.
- Add category-total control differences.
- Block close when any transaction is unresolved.
- Block close when any difference is not EUR 0.00.
- Lock a complete month into an immutable period-close snapshot.
- Require an administrator reason and audit event to reopen.
- Isolate reopen lookup by workspace so cross-workspace closes are indistinguishable from missing closes.
- Keep partial July 2026 open until a complete export is supplied.

### Exit criteria

- Closing formula and category controls agree exactly to the cent.
- Closed periods are immutable through normal workflows.
- Reopen behavior is restricted, reasoned, and audited.
- Year opening follows previous year closing unless an audited adjustment exists.

## Phase 6 — Visual reports and controlled distribution

Status: **complete** — REPORT-001 through REPORT-005 complete.

### Outcomes

- Build Dutch monthly and yearly reports from closed snapshots only.
- Show opening, income, expenses, net movement, and closing.
- Show totals by `Klant`, `Type`, and `Category` using literal historical wording.
- Separate transfers, savings, deposits, refunds, reversals, and restricted-purpose movements from ordinary operating subtotals while preserving every euro.
- Add month trends and transaction drill-down.
- Generate HTML email and XLSX from the same snapshot; keep PDF as a placeholder until a PDF renderer is owner-approved.
- Require a separate final administrator approval click before sending.
- Store report and dispatch hashes, recipients, sender, time, and metadata-only result; real e-mail sending remains blocked.

### Exit criteria

- UI, HTML, XLSX, and PDF placeholder artifacts include the same snapshot evidence; real rendered PDF output requires owner approval of a dependency.
- Sent reports reference a locked immutable snapshot.
- A report cannot be sent from an open or unbalanced period.
- Original source files remain separately downloadable.

## Phase 7 — Dutch UX and authorization hardening

Status: **complete** — UX-001, AUTH-001, and UX-002 done.

### Outcomes (achieved)

- Dutch text audit test suite covers auth, import feedback, email, review, settings, report snapshot, and navigation surfaces.
- Every mutation route enforced with `requireAdmin`; 24 admin mutation policy tests pass.
- Navigation centralized in `src/helpers/navigation.ts` with canonical Dutch `FINANCE_NAV_ITEMS`.
- `FinanceAppFrame.tsx` uses the canonical nav helper; no SaaS/marketing/billing surfaces in nav.

### Exit criteria (met)

- No English user-facing application text remains, except original external ING evidence.
- Authorization tests cover every financial mutation route.
- The main monthly workflow is usable without technical knowledge.

## Phase 8 — Infrastructure and deployment

Status: **complete (local readiness; production gated)** — INFRA-001 documented as `13a32a5`; INFRA-002 local PostgreSQL Compose readiness committed as `dce8b9f`; INFRA-003 production cutover plan committed as `1cf2402`; RC3 local backup/restore evidence recorded as `3ac4bfc`.

### Outcomes

- Confirm a currently supported PostgreSQL major version compatible with Prisma and the application.
- Replace the obsolete WordPress/MySQL/Postgres Compose file with a local PostgreSQL-only setup.
- Mirror database `finance`, schema `finance`, role `finance_user`, and optional `finance_shadow`.
- Use local placeholder credentials, a named volume, and a health check.
- Validate migrations and all financial fixtures on a disposable database.
- Prepare a separate production migration and cutover plan.

### Exit criteria

- `docker compose config` passes.
- Disposable database setup, Prisma migrations, tests, builds, and financial fixtures pass.
- No destructive command runs automatically at container startup.
- Production remains untouched until explicit cutover approval.

## Phase 9 — Operational hardening and handoff

Status: **complete (published RC4 handoff; owner decisions gated)** — OPS-001 (Dutch admin guide) committed as `d51cfad`; OPS-002 (backup/restore rehearsal) guards and dry-run support committed as `77ebbbd`; OPS-003 (final readiness audit) committed as `8d5978c`; RC2/RC3 hardening: backup rehearsal explicit flags (`519b69e`), validate:release-candidate strengthened (`bb666ae`), release manifest generator (`6341be4`), production blocker guard audit (`73d8072`), owner handoff bundle (`0a8c04d`), RC2 readiness evidence (`fd1a6c2`, `4f9cedf`), live local backup/restore evidence (`3ac4bfc`), API route smoke coverage (`9b209c7`), RC4 handoff polish (`7ce6e6d`, `43bfb90`, `42a6f49`, `43137b5`, `33d08c4`), roadmap closeout and owner-review prep (`d942705`, `d07a32f`, `35688c4`, `b3cfc57`, `0a64649`, `0a3904e`), owner acceptance hardening (`a8280c2`, `7e71404`, `18a6802`, `ee473bd`, `6353546`), and post-push owner-decision handoff commits (`e07be8f`, `a5ab4a8`, `949823a`, `84d13d7`, `3866a43`, `f2f7cbb`) published to `origin/main`. Current gate: owner decision selection; recommended next decision is `postgres-version`.

Remaining blockers before production:

- Real PDF renderer dependency requires owner approval.
- Live local backup/restore rehearsal is complete for RC3; production backup/restore remains gated by owner approval.
- Production cutover requires explicit owner approval (see `docs/PRODUCTION_CUTOVER_PLAN_NL.md`).
- Historical production import (2024/2025/2026) requires owner approval and dry-run acceptance.
- Real email sending requires configured Resend provider and owner approval.
- Post-push verification confirms owner-decision handoff commit `f2f7cbb` on `origin/main`; no new push is needed for the published handoff.
- Push for future local commits, secret rotation, and PostgreSQL production version confirmation are represented in the owner decision matrix, decision briefs, and approval-intake validator; they remain owner-gated.
- Local PostgreSQL 15.17 rehearsal evidence is recorded in `docs/POSTGRES_VERSION_EVIDENCE_NL.md`; it does not resolve the production PostgreSQL version blocker.
- PostgreSQL production version must be confirmed before cutover and is the recommended next low-risk owner decision.
- Owner acceptance checklist, owner decision menu, decision briefs, approval-intake validation, and post-push evidence are prepared; they do not approve any gated action.

### Outcomes

- Add backup, restore, retention, and disaster-recovery procedures.
- Verify original-file download and snapshot reproducibility.
- Add administrator operating instructions for monthly import, review, close, report approval, and reopening.
- Remove obsolete documentation and mark historical plans clearly.
- Complete security, privacy, and dependency review.
- Establish release and rollback procedures.

### Exit criteria

- A new administrator can perform the complete workflow from documentation.
- Backup and restore are tested.
- All authoritative documentation agrees with code and deployed behavior.
- No unresolved critical accounting or security issue remains.

## Future features requiring a new owner decision

These are not part of the current committed roadmap:

- additional banks or bank formats;
- budgets and forecasts;
- accrual accounting;
- invoice administration;
- payroll;
- tax or ANBI filing automation;
- restricted-fund balance accounting beyond current cash reporting;
- external accountant portal;
- automated scheduled sending;
- autonomous AI categorization.

Adding any of these requires an explicit philosophy and strategy review before implementation planning.
