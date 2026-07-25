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

## Current authentication standardization

The Clerk-only authentication hardening is configured for email sign-in only.
`/sign-in` is the canonical public authentication route; public application
sign-up is disabled, `/sign-up` is unsupported, and Google/social providers are
disabled. The server verifies the Clerk session, maps the verified primary
email to an active local `User` and `WorkspaceMembership`, and derives
administrator/viewer permissions from that membership. A Clerk account alone
never grants finance access. Protected APIs return `401` JSON for missing or
invalid sessions, protected pages redirect to `/sign-in`, client identity
headers are ignored, and all financial mutations remain administrator-only.
No financial data, opening balance, suggestion, or review decision is changed
by this slice.

The deployed release uses the GitHub Actions publishable-key secret and the
Dokploy Clerk runtime variables, including the configured active workspace UUID.
Current application implementation commit:
`f9e967f54632f86bad2ef3c5774334a48cda85ad`.
The current running production build SHA is verified from the no-cache
deployment-info endpoint after each release; it is not duplicated here as a
self-referential static value.
The Clerk secret remains runtime-only. Ory is historical only; no Ory variables
or generic cookie fallbacks are present. Dokploy uses the four sign-in-only route variables:
`NEXT_PUBLIC_SIGN_IN_URL`, `NEXT_PUBLIC_CLERK_SIGN_IN_URL`,
`NEXT_PUBLIC_SIGN_UP_URL`, and `NEXT_PUBLIC_CLERK_SIGN_UP_URL`. The active
finance administrator was verified against the local `ADMIN` membership
without recording the identity. Unauthenticated API/page smoke tests pass.
The 221 unresolved transactions and 663 review-only suggestions remain
unchanged.

The empty authenticated-portal report was diagnosed as a client timing race:
`LedgerProvider` could fetch before Clerk had established the session, swallow
the transient `401`, and remain empty. The client now waits for Clerk readiness
and refreshes when the signed-in state becomes available. A read-only production
ownership audit confirmed the authenticated administrator already owns the
finance dataset; no `FINANCE_DATA_OWNER_USER_ID` configuration or ownership
reassignment was needed.

## Current position

```text
Phase 0 — Governance and verified controls       COMPLETE
Phase 1 — Safe categorization foundation         COMPLETE
Phase 2 — Financial domain and historical model  COMPLETE
Phase 3 — Historical loading and truth fixtures  COMPLETE (historical local gate superseded by Phase 11 production import)
Phase 4 — Monthly import and review workflow     COMPLETE_LOCAL_APP_WORKFLOW
Phase 5 — Reconciliation, close, and snapshots   COMPLETE
Phase 6 — Visual reports and distribution        COMPLETE
Phase 7 — Dutch UX and authorization hardening   COMPLETE
Phase 8 — Infrastructure and deployment          COMPLETE (local readiness; production gated)
Phase 9 — Operational hardening and handoff      COMPLETE (published RC4 handoff; owner decisions gated)
Phase 9 post-push evidence and decision hardening COMPLETE (published at f2f7cbb; next decision selection gated)
Phase 10 — Production schema cutover             COMPLETE (2026-07-07; finance schema deployed; Phase 11 completed the historical import)
Phase 11 — Production historical import          COMPLETE (2026-07-07; 2024/2025 concluded data imported; 2026 partial open statement imported and not closed; 902 transactions, 681 bookings)
Phase 12 — Production secret rotation            COMPLETE (2026-07-07; finance_user credential rotated; old credential rejected; new credential verified; historical totals re-verified)
Phase 13 — Production runtime credential update  COMPLETE (2026-07-07; final retained credential applied; Dokploy env updated; redeploy triggered; app health verified)
Phase 14 — App/provider secret remediation       COMPLETE (2026-07-08; Clerk, Resend, and New Relic provider keys rotated and applied to Dokploy runtime; app redeployed; health/readiness verified)
Phase 15 — Real PDF renderer                     COMPLETE (2026-07-08; pdfkit report artifact renderer; HTML/XLSX preserved)
Phase 16 — Real email sending                    COMPLETE (2026-07-08; Resend provider abstraction; executeDispatch with guards; bounded production send verified via Resend)
Phase 17 — Month-by-month accounting reconciliation and administrator reporting COMPLETE (2026-07-09; formula-based monthly chaining model; read-only production audit passed; baseline controls: 2024/2025/2026 confirmed)
Phase 18 — Cent-exact accounting integrity and opening-balance repair COMPLETE (one-time production repair completed 2026-07-14; never repeat)
Phase 19 — History-based review prefill            DEPLOYED (history-v1; 681-booking evaluation; 663 review-only suggestions persisted; human approval remains mandatory)
```

## Authoritative Progress

```text
Previous roadmap through Phase 17: 100%
Phase 18: complete; one-time production opening-balance repair completed 2026-07-14 and must never be repeated
Phase 19: deployed and complete; history-v1 persistence completed with 663 review-only suggestions; 221 administrator decisions remain
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
Phase 17 — Month-by-month accounting reconciliation and administrator reporting: 100% — formula-based monthly chaining model; read-only production audit passed
Remaining blockers: none for Phase 17; 2026 open year categorization is owner-gated outside Phase 17 scope
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

Historical implementation status (superseded by Phase 11): the local/sanitized
fixtures, owner-approved rehearsal adapter, retained-byte hashing, disposable
database rehearsal, and guarded dry-run command service were complete while
production import was still owner-gated. Phase 11 subsequently completed the
approved production import with 902 transactions.

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
- Generate HTML, XLSX, and PDF artifacts from the same immutable snapshot.
- Require a separate final administrator approval click before sending.
- Store report and dispatch hashes, recipients, sender, time, and metadata-only result; real e-mail sending completed 2026-07-08.

### Exit criteria

- UI, HTML, XLSX, and PDF artifacts include the same snapshot evidence.
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

Alle productiehardeningsstappen zijn afgerond (2026-07-07 t/m 2026-07-08):

- Real PDF renderer: COMPLETE 2026-07-08 (pdfkit).
- Production schema cutover: COMPLETE 2026-07-07.
- Historical production import: COMPLETE 2026-07-07 (902 transactions, 681 bookings).
- Real email sending: COMPLETE 2026-07-08 (Resend; bounded production verification email sent).
- Secret rotation (finance_user): COMPLETE 2026-07-07.
- Runtime credential update: COMPLETE 2026-07-07.
- App/provider secret remediation: COMPLETE 2026-07-08 (Clerk, Resend, New Relic).
- PostgreSQL production version confirmed: COMPLETE 2026-07-07 (15.8).
- Live local backup/restore rehearsal: COMPLETE RC3 (2026-07-05); production backup/restore remains gated.
- Phase 17 accounting reconciliation audit: COMPLETE 2026-07-09.
- Post-push verification confirms owner-decision handoff commit `f2f7cbb` on `origin/main`.
- Push for future local commits remains owner-gated.

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

## Phase 18 — Cent-exact accounting integrity and opening-balance repair

Status: **complete; one-time production opening-balance repair completed 2026-07-14 and must never be repeated**

### Outcomes

- Add a read-only accounting audit endpoint that reports monthly and yearly controls in integer minor units.
- Prove opening balance, income, expense, net movement, closing balance, category totals, continuity, duplicates, running balances, and unresolved counts.
- Add a dry-run-first, administrator-only, idempotent repair for the approved EUR 1,721.86 opening balance effective 2024-01-01.
- Reject locked or conflicting opening balances instead of overwriting them.
- Reuse the existing reconciliation and audit services rather than creating a parallel accounting engine.

### Exit criteria

- Every required difference is represented as an integer minor-unit string and equals `"0"` for approved fixtures.
- 2024, 2025, and supplied 2026 partial baselines match the authoritative controls.
- Historical implementation acceptance: dry-run performs zero writes; execute mode remained owner-gated and was not run in production during implementation. The later approved one-time repair is recorded above.
- Conflict, account-identity, idempotency, authorization, and no-side-effect tests pass.
- Server build, production build, diff review, and documentation alignment pass.

## Phase 19 — History-based review prefill

Status: **deployed and complete; 663 review-only suggestions are persisted and 221 administrator decisions remain**

### Outcomes

- Generate deterministic ranked complete `Klant` / `Type` / `Category` suggestions from approved local history.
- Persist immutable evidence, hashes, matcher, confidence, integer score basis points, rank, and algorithm version using the existing `CategorizationSuggestion` model.
- Guarantee a complete rank-one proposal for each unresolved transaction when compatible historical evidence exists.
- Prefill the review UI while preserving explicit administrator approval or correction.
- Add a dry-run-first backfill endpoint that never creates `TransactionBooking` records.
- Evaluate top-one, top-three, coverage, and confidence calibration using chronological and leave-one-out tests over approved bookings.

### Exit criteria

- All unresolved transactions with compatible history receive a complete rank-one suggestion.
- Suggestions are deterministic for a fixed algorithm version and produce stable evidence hashes.
- Dry-run performs zero writes and reports planned matcher/confidence distributions.
- Execution changes only pending suggestions for unresolved transactions.
- Tests prove no heuristic suggestion creates a booking, closes a period, or mutates bank facts.
- Review prefill shows a visible confidence and reason and remains manually changeable.
- No external AI provider, vector database, or autonomous booking is introduced.

### Exit evidence

- Algorithm version: `history-v1`.
- Chronological evaluation over 681 approved bookings: 679 covered (99.71%), 489 top-one correct (72.02%), and 539 top-three correct (79.38%).
- Safe leave-one-out evaluation over the same 681 bookings: 679 covered (99.71%), 502 top-one correct (73.93%), and 556 top-three correct (81.89%).
- Chronological confidence calibration: `FUZZY` 88.64%, `OVERALL` 100.00%, and `DEFAULT` 31.09%.
- `DEFAULT` remains visibly low-confidence, review-only, and ineligible for autonomous booking.
- The Review page loads `/api/ledger` and `/api/review` for authenticated users, pre-fills project, transaction type, derived main category, and subcategory, and displays evidence plus ranked alternatives.
- Approval requires a complete `projectId` / `transactionTypeId` / `categoryId` triple and delegates to the existing `ReviewDecision` and `TransactionBooking` workflow.
- Dry-run backfill, read-only evaluation, review prefill, direct PATCH routing, no-side-effect controls, accounting regressions, reconciliation regressions, and the production build all passed locally.
- No production suggestion persistence, opening-balance repair, migration, deployment, commit, or push occurred.

### Design reference

- `docs/ACCOUNTING_INTEGRITY_AND_REVIEW_PREFILL.md`

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




---

## Transaction Review and Intelligence Program

Status: **roadmap aligned; Phase 2 and Phase 3 closeout pending; Phase 4 is NEXT**

Approved: 2026-07-16  
Implemented accounting/review architecture: `docs/ACCOUNTING_INTEGRITY_AND_REVIEW_PREFILL.md`  
Approved invariants: `docs/architecture/ARCHITECTURAL_INVARIANTS.md`  
Approved system architecture: `docs/architecture/SYSTEM_ARCHITECTURE.md`  
Approved Merchant Knowledge architecture: `docs/architecture/MERCHANT_KNOWLEDGE_ARCHITECTURE.md`  
Approved Decision Engine architecture: `docs/architecture/DECISION_ENGINE_ARCHITECTURE.md`  
Execution: `docs/IMPLEMENTATION_PLAN.md`  
Handoff: `docs/finance-rebuild-run.md`

This is a named sub-roadmap within the existing global roadmap. Its Phase 1–7 labels must always be qualified as `Transaction Review and Intelligence Program` phases so they cannot be confused with the repository's earlier global phases.

Repository documentation is the authoritative project memory. Chat history is non-durable and must not govern execution. Future work begins only after reading the roadmap, implementation plan, architecture, and persistent handoff.

### Program current position

```text
Program Phase 1 — Baseline and instrumentation                 PARTIAL / BENCHMARK FREEZE PENDING
Program Phase 2 — Review-table redesign and pagination         IMPLEMENTED / PRODUCTION CLOSEOUT PENDING
Program Phase 3 — Merchant Knowledge Layer                     CORE COMPLETE / ACCEPTANCE CLOSEOUT PENDING
Program Phase 4 — Retrieval and Decision Foundation            NEXT
Program Phase 5 — AI Decision Engine                           BLOCKED ON PHASE 4 GATE
Program Phase 6 — Evaluation, Calibration, and Observability   TODO
Program Phase 7 — Controlled Rollout                           TODO
```

Normalized planning estimate — not an official product metric:

| Program phase | Estimated completion | Basis |
|---|---:|---|
| Phase 1 | 40% | Population and historical metrics exist; corrected 221-item benchmark freeze and dimension-level labels remain pending. |
| Phase 2 | 90% | Review workflow, pagination, filtering, accessibility, authorization, and authenticated browser evidence exist; production closeout remains. |
| Phase 3 | 95% | Core Merchant Knowledge, read UI, previews, and alias/merchant/conflict confirmations are complete; Phase 3.8E and consolidated Phase 3 validation remain. |
| Phase 4 | 0% | Not started. |
| Phase 5 | 0% | Not started. |
| Phase 6 | 0% | Not started. |
| Phase 7 | 0% | Not started. |
| **Normalized seven-phase total** | **32%** | Equal-weight estimate: `(40 + 90 + 95) / 7`, rounded. |

Merchant merge, merchant split, and explicit knowledge-reassignment confirmation are deferrable administrator capabilities. The pure planning contracts, previews, audit model, rollback model, and safe-disable boundaries already exist; these three mutation surfaces are not required to produce the deterministic Phase 4 baseline or begin bounded Phase 5 shadow inference. They remain separately approved future Phase 3.8D slices and must not be implemented opportunistically.

### Program Phase 1 — Baseline and instrumentation

**Objective:** establish trustworthy measurements and prevent generated suggestions from contaminating history.

**Scope:** verify the unresolved and suggestion counts; prove that only confirmed bookings are trusted history; preserve original suggestion and final decision; establish benchmark reporting for the 221 transactions.

**Dependencies:** existing suggestion/booking separation and review-decision audit trail.

**Exclusions:** no AI inference, no automatic booking, no merchant-schema change.

**Expected changed areas:** evaluation/reporting services, review-decision instrumentation, documentation, and targeted tests only after an exact-source task is approved.

**Validation:** reproducible benchmark counts; no read-side mutations; tests proving unconfirmed suggestions are excluded from trusted history.

**Completion:** the 221-item benchmark is frozen after human fact-checking and dimension-level correction data is available.

**Rollback/safety:** instrumentation must be removable without changing bank facts or final bookings.

### Program Phase 2 — Review-table redesign and pagination

**Status: IMPLEMENTED — production closeout pending.**

**Objective:** make review of 221 and larger queues fast, clear, auditable, and accessible.

**Scope:** server-side pagination; compact transaction rows; inline project, transaction-type, and category editing; per-row confirmation; reliability visualization; expandable evidence; filters and default risk-first sorting; responsive design; targeted validation.

**Dependencies:** existing `GET /api/review`, review queue service, audited individual decision service, role enforcement, and locked-period controls.

**Exclusions:** Bedrock, AI inference, merchant models, vector search, automatic booking, and bulk confirmation.

**Expected changed areas, subject to exact-source verification:** `src/app/review/page.tsx`, `src/ui/FinanceReviewPage.tsx`, `src/helpers/review-page.ts`, `src/helpers/api-transaction-mapper.ts`, `src/context/ledger-context.tsx`, `src/libs/api.ts`, `server/routes/review.ts`, `server/services/reviewQueueService.ts`, `server/services/reviewDecisionService.ts`, and directly relevant tests. A file changes only when current source proves it is necessary.

**Validation:** targeted queue, route, decision-integrity, UI/helper, API-shape, pagination-boundary, filter/sort, authorization, locked-period, and suggestion-versus-booking tests; affected TypeScript checks; responsive verification where repository tooling supports it.

**Completion:** all 221 transactions are reachable across nine pages at page size 25; every row can be edited and individually confirmed through the existing audited booking path; reliability is understandable without color; mobile use is practical; no integrity guard is weakened.

**Rollback/safety:** retain the prior review behavior until the new response contract and UI pass targeted validation; no data migration is required.

### Program Phase 3 — Merchant Knowledge Layer

**Objective:** introduce workspace-scoped merchant identity, aliases, fingerprints, deterministic matching, conflict handling, merge/split safety, auditability, dry-run backfill, and retrieval anchoring so the 221-transaction categorization benchmark can use stable merchant evidence.

**Dependencies:** Program Phase 2 review workflow complete; `docs/architecture/ARCHITECTURAL_INVARIANTS.md` approved; `docs/architecture/MERCHANT_KNOWLEDGE_ARCHITECTURE.md` approved.

**Scope:** merchant-domain and data-contract design; additive migration planning; deterministic fingerprint extraction from IBAN, creditor identifier, card descriptor, normalized counterparty, payment purpose, and recurring patterns; workspace-scoped alias resolution; explicit conflict states; audited merge/split controls; dry-run backfill; retrieval-anchor integration; separately approved administrator tooling.

**Exclusions:** no Bedrock; no AI inference; no automatic booking; no mutation of raw bank facts; no uncontrolled or destructive backfill.

**Expected changed areas:** domain and schema proposals subject to exact-source approval, additive migrations, merchant/fingerprint/alias services, dry-run/backfill tooling, audit and conflict handling, optional admin UI/API, and directly relevant tests.

**Validation requirements:** workspace-isolation tests; deterministic matching fixtures; alias and fingerprint collision tests; merge/split audit and rollback tests; immutable-source-fact checks; idempotent dry-run/backfill evidence; retrieval-anchor correctness; no booking side effects.

**Completion criteria:** approved merchant variants resolve consistently or abstain with explicit conflicts; reviewer corrections can become audited reusable aliases; the dry-run backfill is reproducible and safe; retrieval can anchor only to workspace-scoped merchant knowledge.

**Rollback/safety:** merchant-assisted resolution and aliases can be disabled independently; knowledge links can be restored from audit history; raw transactions and confirmed bookings remain unchanged.

**Architecture references:** `docs/architecture/ARCHITECTURAL_INVARIANTS.md`, `docs/architecture/SYSTEM_ARCHITECTURE.md`, and `docs/architecture/MERCHANT_KNOWLEDGE_ARCHITECTURE.md`.

### Program Phase 2 and Phase 3 closeout gates

Program Phase 2 exits when the existing review workflow has documented production acceptance for authenticated administrator and viewer behavior, all 221 unresolved transactions remain reachable and individually confirmable, pagination/filtering/risk ordering/mobile/accessibility evidence is current, authorization and locked-period controls remain green, and no suggestion becomes a booking without explicit administrator confirmation.

Program Phase 3 exits when the consolidated Phase 3.9 validation report confirms workspace isolation, deterministic fingerprint/alias/conflict behavior, replay-safe schema and migration state, safe-disable behavior, retrieval-anchor correctness, privacy redaction, no booking or bank-fact mutation, and authenticated production acceptance/rollback evidence for the implemented Merchant Knowledge surfaces. Phase 3.8E is the remaining acceptance slice.

Merchant merge, merchant split, and knowledge-reassignment confirmation are not Phase 3 exit blockers. They are deferrable administrator capabilities because Phase 3 already provides pure plans, versioned previews, evidence/rollback contracts, and safe-disabled mutation boundaries. They must remain unstarted unless separately approved and must not delay the deterministic Phase 4 baseline or bounded Phase 5 shadow inference.

The smallest Phase 4 slice is Phase 4.1 only: define and test the confirmed-history eligibility contract over existing bookings and review decisions. It must produce a reproducible workspace-scoped eligible-history set, exclude all pending/rejected/generated suggestions and superseded or ineligible records, preserve locked-period and provenance rules, and perform no writes. This slice directly improves categorization quality by ensuring retrieval for the 221 transactions is based only on confirmed human outcomes.

Program Phase 5 may begin only after all Phase 4 slices pass, especially a frozen reproducible pre-AI baseline for the corrected 221 transactions; the Decision request/response and candidate contracts are versioned; every candidate is active, workspace-scoped, and valid; deterministic Decisions or explicit abstentions exist for every eligible benchmark item; privacy/security/provider/cost design is approved; and integrity tests prove zero booking, bank-fact, locked-period, or trusted-history contamination.

### Program Phase 4 — Retrieval and Decision Foundation

**Objective:** retrieve only eligible human-confirmed history, generate restricted valid candidates, evaluate deterministic rules and merchant evidence, assemble supporting and conflicting evidence, and introduce the side-effect-free Decision Engine without model inference.

**Dependencies:** Program Phase 3 validated; confirmed-history eligibility rules established; `docs/architecture/ARCHITECTURAL_INVARIANTS.md` and `docs/architecture/DECISION_ENGINE_ARCHITECTURE.md` approved.

**Scope:** confirmed-booking eligibility contract; bounded workspace-scoped retrieval; independent project/type/category statistics; recency and similarity scoring; supporting and conflicting examples; valid-ID candidate generation; deterministic Decision response or persistence contract; benchmark baseline for the corrected 221 transactions.

**Exclusions:** no Bedrock inference; no Sonnet; no automatic booking; no learning from suggestions or generated decisions.

**Expected changed areas:** retrieval and history services, candidate generation, deterministic orchestration, evidence contracts, versioned Decision representation, benchmark reporting, and directly relevant tests, subject to exact-source verification.

**Validation requirements:** pending and rejected suggestions excluded; workspace isolation enforced; deterministic bounded queries; candidate IDs validated; supporting and conflicting evidence preserved; side-effect-free generation proven; benchmark output reproducible; multi-project and multi-category merchants covered.

**Completion criteria:** every eligible unresolved transaction receives a bounded, auditable deterministic Decision with valid candidates or an explicit abstention, and the 221-item benchmark has a reproducible pre-AI baseline.

**Rollback/safety:** the Decision Engine can be disabled while existing deterministic suggestions and manual review remain available; no raw fact or confirmed booking is changed.

**Architecture references:** `docs/architecture/ARCHITECTURAL_INVARIANTS.md`, `docs/architecture/SYSTEM_ARCHITECTURE.md`, `docs/architecture/MERCHANT_KNOWLEDGE_ARCHITECTURE.md`, and `docs/architecture/DECISION_ENGINE_ARCHITECTURE.md`.

### Program Phase 5 — AI Decision Engine

**Objective:** introduce server-side Bedrock Claude Haiku as the constrained default classifier, enforce schema-constrained valid-ID output, permit abstention, version every inference dependency, and operate initially in shadow mode.

**Dependencies:** Program Phase 4 deterministic retrieval and candidates validated; approved privacy, security, provider, and cost design; `docs/architecture/DECISION_ENGINE_ARCHITECTURE.md` approved.

**Scope:** trusted server-side Bedrock boundary; structured request and response contracts; supplied-valid-ID enforcement; Haiku shadow inference; prompt, model, retrieval, candidate-set, Decision Engine, calibration-input, and evidence versioning; bounded timeout, retry, budget, and abstention behavior; provenance, latency, and cost evidence.

**Exclusions:** no direct booking; no learning from unconfirmed suggestions; no client-side credentials; no routine Opus use; no Sonnet fallback until Program Phase 6 policy is approved.

**Expected changed areas:** server-side inference boundary, configuration validation, Decision Engine orchestration, schema validation, provenance and observability records, shadow evaluation, and directly relevant tests, subject to exact-source verification.

**Validation requirements:** out-of-set IDs rejected; malformed output fails closed; provider failures leave transactions reviewable; no duplicate active decisions; no source or booking mutation; workspace context isolated; secrets remain server-side; shadow results cannot influence trusted history.

**Completion criteria:** versioned Haiku shadow decisions can be evaluated against human-corrected outcomes for the 221 transactions without influencing accounting truth or reviewer defaults.

**Rollback/safety:** a server-side disable switch removes AI contribution while deterministic retrieval, manual review, and final booking behavior continue unchanged.

**Architecture references:** `docs/architecture/ARCHITECTURAL_INVARIANTS.md`, `docs/architecture/SYSTEM_ARCHITECTURE.md`, and `docs/architecture/DECISION_ENGINE_ARCHITECTURE.md`.

### Program Phase 6 — Evaluation, Calibration, and Observability

**Objective:** evaluate the corrected 221-transaction benchmark, calibrate project, transaction-type, category, and combined confidence, establish precision by confidence band, track operational quality and cost, and define deterministic Sonnet fallback conditions.

**Dependencies:** Program Phase 5 shadow-inference data; benchmark labels frozen and separated from training or retrieval tuning where required; approved Decision Engine and invariants.

**Scope:** benchmark finalization; per-dimension and complete-classification metrics; top-three accuracy; calibration; false-high-confidence analysis; known/new merchant analysis; correction and review-time measurement; latency, provider failure, token, cost, and escalation metrics; deterministic Sonnet escalation policy for ambiguous, conflicting, novel, or materially significant cases.

**Exclusions:** no automatic booking; no broad reviewer rollout before calibration gates pass; no routine Opus use; no Sonnet invocation outside approved escalation and budget policy.

**Expected changed areas:** evaluation and calibration services, benchmark fixtures, observability and cost reporting, escalation policy, shadow-mode reports, and directly relevant tests, subject to exact-source verification.

**Validation requirements:** reproducible benchmark splits; per-dimension metrics; calibration error and precision by band; false-high-confidence audit; deterministic escalation fixtures; version and budget enforcement; Sonnet fallback remains suggestion-only; privacy-safe observability.

**Completion criteria:** confidence bands have measured precision; green-band complete-classification precision meets the approved gate; false-high-confidence cases are understood; Sonnet escalation shows measurable value and bounded cost or remains disabled.

**Rollback/safety:** calibration profiles, observability exposure, and Sonnet routing can be disabled independently while Haiku shadow output, deterministic retrieval, and manual review remain intact.

**Architecture references:** `docs/architecture/ARCHITECTURAL_INVARIANTS.md`, `docs/architecture/SYSTEM_ARCHITECTURE.md`, and `docs/architecture/DECISION_ENGINE_ARCHITECTURE.md`.

### Program Phase 7 — Controlled Rollout

**Objective:** expose calibrated AI suggestions progressively, retain human confirmation, apply budget and escalation controls, monitor reviewer trust and correction rates, and consider automation only under separately approved safety gates.

**Dependencies:** Program Phase 6 calibration and observability complete; green-band precision gate satisfied; production rollback and disable switches verified; current accounting/review integrity controls unchanged.

**Scope:** controlled reviewer exposure; calibrated confidence-band presentation; safe enable/disable controls where supported; budget and escalation monitoring; production acceptance; correction and review-time monitoring; rollback rehearsal; roadmap and handoff closeout.

**Exclusions:** automatic booking is not included by default; no bypass of accounting integrity, human authorization, workspace isolation, audit, or locked-period protections.

**Expected changed areas:** review suggestion presentation, feature/configuration controls, observability dashboards or reports, production-verification procedures, rollout documentation, and directly relevant tests, subject to exact-source verification.

**Validation requirements:** calibrated precision by band; false-high-confidence audit; administrator and viewer behavior; no-booking integrity; safe disable behavior; budget and escalation enforcement; production acceptance; reviewer correction and trust metrics; rollback rehearsal.

**Completion criteria:** calibrated suggestions are exposed only within approved bands; reviewer correction rates and operational metrics remain within accepted limits; safe disable and rollback are proven; any future automation proposal is separately approved and requires approximately 99% precision plus explicit safety, audit, authorization, monitoring, locked-period, and rollback gates.

**Rollback/safety:** AI presentation, Sonnet routing, and calibrated confidence exposure can be disabled independently without affecting deterministic review or final bookings; sensitive, unusual, locked-period, or materially significant transactions may remain permanently human-reviewed.

**Architecture references:** `docs/architecture/ARCHITECTURAL_INVARIANTS.md`, `docs/architecture/SYSTEM_ARCHITECTURE.md`, and `docs/architecture/DECISION_ENGINE_ARCHITECTURE.md`.
