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

Status: **approved; documentation complete; Phase 2 is CURRENT**  
Approved: 2026-07-16  
Architecture: `docs/ACCOUNTING_INTEGRITY_AND_REVIEW_PREFILL.md`  
Execution: `docs/IMPLEMENTATION_PLAN.md`  
Handoff: `docs/finance-rebuild-run.md`

This is a named sub-roadmap within the existing global roadmap. Its Phase 1–7 labels must always be qualified as `Transaction Review and Intelligence Program` phases so they cannot be confused with the repository's earlier global phases.

Repository documentation is the authoritative project memory. Chat history is non-durable and must not govern execution. Future work begins only after reading the roadmap, implementation plan, architecture, and persistent handoff.

### Program current position

```text
Program Phase 1 — Baseline and instrumentation       DOCUMENTED / NEXT SUPPORTING WORK
Program Phase 2 — Review-table redesign/pagination   CURRENT
Program Phase 3 — Merchant normalization             TODO
Program Phase 4 — Confirmed-history retrieval        TODO
Program Phase 5 — Bedrock Haiku classifier           TODO
Program Phase 6 — Sonnet fallback                    TODO
Program Phase 7 — Calibration and rollout            TODO
```

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

**Status: CURRENT — next implementation phase.**

**Objective:** make review of 221 and larger queues fast, clear, auditable, and accessible.

**Scope:** server-side pagination; compact transaction rows; inline project, transaction-type, and category editing; per-row confirmation; reliability visualization; expandable evidence; filters and default risk-first sorting; responsive design; targeted validation.

**Dependencies:** existing `GET /api/review`, review queue service, audited individual decision service, role enforcement, and locked-period controls.

**Exclusions:** Bedrock, AI inference, merchant models, vector search, automatic booking, and bulk confirmation.

**Expected changed areas, subject to exact-source verification:** `src/app/review/page.tsx`, `src/ui/FinanceReviewPage.tsx`, `src/helpers/review-page.ts`, `src/helpers/api-transaction-mapper.ts`, `src/context/ledger-context.tsx`, `src/libs/api.ts`, `server/routes/review.ts`, `server/services/reviewQueueService.ts`, `server/services/reviewDecisionService.ts`, and directly relevant tests. A file changes only when current source proves it is necessary.

**Validation:** targeted queue, route, decision-integrity, UI/helper, API-shape, pagination-boundary, filter/sort, authorization, locked-period, and suggestion-versus-booking tests; affected TypeScript checks; responsive verification where repository tooling supports it.

**Completion:** all 221 transactions are reachable across nine pages at page size 25; every row can be edited and individually confirmed through the existing audited booking path; reliability is understandable without color; mobile use is practical; no integrity guard is weakened.

**Rollback/safety:** retain the prior review behavior until the new response contract and UI pass targeted validation; no data migration is required.

### Program Phase 3 — Merchant normalization

**Objective:** map variable bank descriptors to stable workspace-scoped merchant identities.

**Scope:** merchant identities and aliases; deterministic normalization; dry-run backfill; auditable manual correction; matching from counterparty, IBAN, creditor ID, card descriptor, payment purpose, and recurring patterns.

**Dependencies:** Phase 1 trusted-history rules and Phase 2 review feedback capture.

**Exclusions:** no model classification and no mutation of raw bank facts.

**Expected changed areas:** schema and migration only after explicit approval, normalization services, admin correction UI/API, and tests.

**Validation:** workspace isolation, deterministic fixtures, immutable source facts, dry-run evidence, and auditability.

**Completion:** recurring merchant variants resolve consistently and reviewer corrections become reusable aliases.

**Rollback/safety:** alias disablement restores raw-descriptor behavior without deleting bank facts.

### Program Phase 4 — Confirmed-history retrieval

**Objective:** retrieve the strongest supporting and conflicting confirmed examples and score dimensions independently.

**Scope:** confirmed bookings only; project/type/category distributions; recency and similarity scoring; restricted candidates; supporting and conflicting evidence.

**Dependencies:** Phases 1 and 3.

**Exclusions:** no Bedrock calls and no auto-booking.

**Expected changed areas:** history/retrieval services, candidate generation, evidence contract, evaluation, and tests.

**Validation:** deterministic retrieval; pending suggestions excluded; multi-project and multi-category merchants covered; workspace boundaries enforced.

**Completion:** every eligible unresolved transaction receives a bounded candidate set with auditable evidence or an explicit abstention.

**Rollback/safety:** existing deterministic suggestions remain available as fallback.

### Program Phase 5 — Bedrock Haiku classifier

**Objective:** add a constrained, server-side high-volume classifier in shadow mode.

**Scope:** Amazon Bedrock client; Claude Haiku; schema-constrained output; valid-ID-only choices; abstention; prompt/model/retrieval/engine versioning; provenance, latency, and cost evidence.

**Dependencies:** Phase 4 candidate and evidence contract.

**Exclusions:** no direct booking, no client-side credentials, no Sonnet routing yet.

**Expected changed areas:** server-side AI client and orchestration, configuration contract, inference provenance, evaluation, and tests.

**Validation:** invalid IDs rejected; failures leave transactions reviewable; duplicate active suggestions prevented; no source mutation; secrets remain server-side.

**Completion:** shadow predictions can be compared against human outcomes without influencing accounting truth.

**Rollback/safety:** a feature switch disables AI while preserving manual and deterministic review.

### Program Phase 6 — Sonnet fallback

**Objective:** escalate only ambiguous, conflicting, novel, or materially important cases.

**Scope:** deterministic fallback conditions, Claude Sonnet invocation, budget limits, provenance, and escalation metrics.

**Dependencies:** Phase 5 operational evidence.

**Exclusions:** Claude Opus for routine categorization and any bypass of human confirmation.

**Expected changed areas:** routing policy, fallback client path, observability, evaluation, and tests.

**Validation:** reproducible escalation rules; model versions recorded; budget enforced; fallback cannot book.

**Completion:** measured fallback improves difficult-case precision enough to justify cost.

**Rollback/safety:** disable Sonnet independently and retain Haiku/manual handling.

### Program Phase 7 — Calibration and rollout

**Objective:** turn model and rule signals into empirically calibrated reliability bands and introduce suggestions safely.

**Scope:** benchmark scoring, calibration, shadow production comparison, green/amber/red/gray thresholds, gradual AI-prefill exposure, drift and cost monitoring.

**Dependencies:** corrected 221-item benchmark and Phases 5–6 evidence.

**Exclusions:** automatic booking before approximately 99% precision and an explicit owner-approved phase.

**Expected changed areas:** calibration/evaluation services, review presentation, monitoring, documentation, and tests.

**Validation:** precision by band, false-high-confidence audit, correction rate, review time, known/new merchant performance, escalation rate, and cost per transaction.

**Completion:** green-band complete-classification accuracy is at least 95% before being presented as highly reliable; any later auto-booking proposal requires approximately 99% precision and separate approval.

**Rollback/safety:** confidence thresholds and AI prefill can be disabled without affecting deterministic review or final bookings; sensitive, unusual, locked-period, or materially significant transactions may remain permanently human-reviewed.
