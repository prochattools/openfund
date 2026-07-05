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
Phase 2 — Financial domain and historical model  IN PROGRESS
Phase 3 — Historical loading and truth fixtures  IN PROGRESS
Phase 4 — Monthly import and review workflow     PLANNED
Phase 5 — Reconciliation, close, and snapshots   PLANNED
Phase 6 — Visual reports and distribution        PLANNED
Phase 7 — Dutch UX and authorization hardening   PLANNED
Phase 8 — Infrastructure and deployment          PLANNED
Phase 9 — Operational hardening and handoff      PLANNED
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

Status: **in progress; guarded dry-run service completed through Packet G**

### Outcomes

- Build an exact loader for the concluded 2024 and 2025 workbooks.
- Read dates only from the raw ING `Date` field.
- Use the final transaction columns and resolved `Verduidelijking` sheets.
- Preserve literal `Klant`, `Type`, and `Category` values.
- Preserve `FR` history and use the first literal 2025 `FTK` transaction as the practical transition point.
- Import the supplied 2026 statement as open, with July remaining incomplete.
- Store source files unchanged and downloadable.

### Current checkpoint

- Sanitized fixture-derived import planning and local DB rehearsal are implemented.
- Sanitized rehearsal stores `SourceFile.sha256` as the hash of retained synthetic bytes, while source inventory hashes remain metadata.
- Owner-approved local rehearsal reads only the approved owner files from absolute paths outside Git, verifies expected hashes, persists exact retained bytes to disposable local PostgreSQL, and validates the 2024, 2025, and 2026 controls.
- The 2026 source remains partial/open and not close-eligible; no production import has occurred.
- A guarded owner historical import command service now defaults to dry-run, returns only sanitized summaries, blocks production execution, and enforces local-only rehearsal database targets.
- No owner source files, raw row dumps, generated output, production configuration, `.env`, `.graphifyignore`, or `graphify-out/` artifacts are committed.

### Exit criteria

- 2024 loads exactly 268 rows and reconciles to EUR 12,184.15.
- 2025 loads exactly 413 rows, opens at EUR 12,184.15, and closes at EUR 10,350.86.
- 2026 partial statement loads exactly 221 rows and closes at EUR 7,837.25.
- Running-balance continuity errors equal zero.
- Source file hashes and downloaded bytes match the originals.
- No historical label is changed.

## Phase 4 — Monthly import and review workflow

Status: **planned**

### Outcomes

- Provide one clear Dutch monthly ING upload workflow.
- Show account, period, row count, duplicates, overlap, opening, income, expenses, and closing before committing.
- Reject invalid controls before ledger changes.
- Apply only approved deterministic rules automatically.
- Rank fuzzy suggestions without booking them.
- Show full payment purpose and matching evidence in the review queue.
- Require explicit administrator approval or categorization.
- Allow deliberate rule creation from confirmed decisions.
- Remove or disable unsafe bulk-confirm actions.

### Exit criteria

- No unresolved transaction is counted as final categorized data.
- Duplicate and overlapping imports cannot duplicate ledger facts.
- Administrator review decisions are auditable.
- View-only users cannot mutate transactions or rules.

## Phase 5 — Reconciliation, close, and immutable snapshots

Status: **planned**

### Outcomes

- Add statement-level opening, income, expenses, and closing controls.
- Add category-total control differences.
- Block close when any transaction is unresolved.
- Block close when any difference is not EUR 0.00.
- Lock a complete month into an immutable period-close snapshot.
- Require an administrator reason and audit event to reopen.
- Keep partial July 2026 open until a complete export is supplied.

### Exit criteria

- Closing formula and category controls agree exactly to the cent.
- Closed periods are immutable through normal workflows.
- Reopen behavior is restricted, reasoned, and audited.
- Year opening follows previous year closing unless an audited adjustment exists.

## Phase 6 — Visual reports and controlled distribution

Status: **planned**

### Outcomes

- Build Dutch monthly and yearly reports from closed snapshots only.
- Show opening, income, expenses, net movement, and closing.
- Show totals by `Klant`, `Type`, and `Category` using literal historical wording.
- Separate transfers, savings, deposits, refunds, reversals, and restricted-purpose movements from ordinary operating subtotals while preserving every euro.
- Add month trends and transaction drill-down.
- Generate HTML email, XLSX, and PDF from the same snapshot.
- Require a separate final administrator approval click before sending.
- Store report and dispatch hashes, recipients, sender, time, and result.

### Exit criteria

- UI, HTML, XLSX, and PDF totals are identical.
- Sent reports reference a locked immutable snapshot.
- A report cannot be sent from an open or unbalanced period.
- Original uploaded files remain separately downloadable.

## Phase 7 — Dutch UX and authorization hardening

Status: **planned**

### Outcomes

- Translate every user-facing screen, label, validation message, error, report, and email into Dutch.
- Keep external ING source columns unchanged when displaying evidence.
- Ensure administrator-only actions are enforced server-side.
- Make all non-administrators view-only.
- Simplify navigation around Importeren, Beoordelen, Administratie, Rapportages, and Instellingen.
- Remove remaining SaaS, marketing, billing, and unrelated product surfaces.

### Exit criteria

- No English user-facing application text remains, except original external ING evidence.
- Authorization tests cover every financial mutation.
- The main monthly workflow is usable without technical knowledge.

## Phase 8 — Infrastructure and deployment

Status: **planned; deliberately deferred**

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

Status: **planned**

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
