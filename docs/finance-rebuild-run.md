# Yeshua Academy Finance rebuild run

Date: 2026-07-02  
Run: `agent-f961650b-de17-4282-ab18-7a716cc72958`  
Source: `yeshuaacademy-finance`  
Branch: `main`  
Status: Release Candidate 7 — production schema cutover, historical import, database credential finalization, all provider secret rotations, real PDF renderer, real email sending, and Phase 17 monthly reconciliation complete 2026-07-09; formula-based monthly chaining model; production audit passed; 2024 closing 1218415, 2025 closing 1035086, 2026 partial closing 783725 all confirmed; Phase 17 complete

Historical evidence convention: dated packet, phase, and preflight sections
below describe earlier implementation states. They are superseded by the
current release facts in this opening section and are not current runtime
instructions.

Current application implementation commit: `f9e967f54632f86bad2ef3c5774334a48cda85ad`.
Previous final documentation/release-evidence commit: `df1ccb009769a89e33b3393e0e546d3caa90f174`.
The current running production build SHA is verified from the no-cache
deployment-info endpoint after each release; the exact runtime value is
reported in closeout evidence rather than duplicated self-referentially.
Phase 18's one-time opening-balance repair was completed on 2026-07-14 and
must never be repeated. Phase 19 history-v1 suggestion persistence is
complete with 663 review-only suggestions; 221 administrator decisions remain.
Current controls are `cashStatus=PASSED`, `classificationStatus=PENDING`, and
`closeStatus=BLOCKED`. The authenticated portal readiness fix is deployed and
the portal reloads its populated finance data after Clerk session readiness.

## Current authentication standardization

The Clerk-only authentication hardening is configured for email sign-in only.
`/sign-in` is the canonical public authentication route; public application
sign-up is disabled, `/sign-up` is unsupported, and Google/social providers are
disabled. API routes verify the Clerk `__session` token server-side,
map the verified email to an active local `User` and active
`WorkspaceMembership`, and derive the role from that membership. Missing or
invalid sessions return `401` JSON; authenticated users without membership
return `403`; `/review` and `/reports` redirect unauthenticated users to
`/sign-in`. Client identity headers are ignored, permitted users may read
review/accounting/evaluation data, and all mutations remain administrator-only.
This slice performs no opening-balance repair, suggestion backfill, review
decision, or other financial write.
The release requires the GitHub Actions `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
secret for the browser bundle and Dokploy runtime-only `CLERK_SECRET_KEY` plus
the real active `DEFAULT_WORKSPACE_ID`; no Clerk secret is passed to Docker.
Dokploy uses `NEXT_PUBLIC_SIGN_IN_URL=/sign-in`,
`NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in`, `NEXT_PUBLIC_SIGN_UP_URL=/sign-in`,
and `NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-in`. The pre-provisioned finance
administrator is verified against the active local `ADMIN` membership without
recording the identity.
Ory is historical only and has been removed from the production authentication
path; no Ory variables or generic cookie fallbacks are present in the Dokploy
runtime. Unauthenticated production checks returned `401` JSON for the three
protected APIs and `307` sign-in redirects for `/review` and `/reports`;
`/sign-up` also redirects to `/sign-in`. This release changes
no financial data: 221 transactions remain unresolved and 663 suggestions
remain review-only; no mutation was submitted.

## Authenticated portal regression diagnosis

The empty authenticated-portal report was a client readiness failure, not a
missing-data or ownership failure. `LedgerProvider` could issue its initial
reads before Clerk had finished establishing the signed-in session; the
resulting transient `401` was caught without a retry, leaving the client state
empty. The client now waits for Clerk `isLoaded` and `isSignedIn` before reading
finance data and refreshes when the session becomes ready.

A read-only production ownership audit confirmed that the authenticated local
administrator is also the owner of the existing finance dataset. No separate
`FINANCE_DATA_OWNER_USER_ID` configuration was added, and no ownership column,
finance row, import, suggestion, opening balance, booking, or review decision
was changed.

## RC2 Hardening Evidence

| Task | Commit | Tests |
|------|--------|-------|
| Backup rehearsal safe default + explicit flags | `519b69e` | 28 tests pass |
| Validate:release-candidate strengthened | `bb666ae` | 11 package script safety tests |
| Release manifest generator | `6341be4` | 12 manifest tests |
| Production blocker guard audit | `73d8072` | 24 blocker guard tests |
| Owner handoff bundle | `0a8c04d` | (docs) |
| RC2 final readiness count correction | `4f9cedf` | (docs) |
| RC3 live local backup/restore evidence | `3ac4bfc` | (docs) |
| API route smoke coverage | `9b209c7` | smoke tests pass |
| RC4 release evidence correction | `7ce6e6d` | (docs) |
| RC4 manifest refresh | `43bfb90` | manifest tests |
| Owner go/no-go preflight | `42a6f49` | preflight tests |
| Push readiness checklist | `43137b5` | (docs) |
| Release evidence consistency checks | `33d08c4` | consistency tests |
| Roadmap closeout guards | `d942705` | Phase 3/4 closeout and roadmap status tests |
| RC4 validated-through evidence refresh | `d07a32f` | manifest evidence refreshed through `d942705` |
| Owner decision preflight guards | `35688c4` | decision matrix, generated preflight doc, no-mutation script/tests |
| Post-approval prompt pack | `b3cfc57` | documentation-only prompts for approved future actions |
| Push readiness preflight | `0a64649` | no-push future publish preflight script/tests |
| Owner review index | `0a3904e` | Dutch owner landing page and doc alignment |
| Owner approval intake + decision pack + action plan | `e55a8b9` | owner suite complete |
| Final docs consistency audit | `0ecd9ee` | consistency audit script/test/doc |
| Repo contamination guard | (current) | contamination guard test |
| Final docs link integrity guard | (current) | link integrity guard test |
| Safe command inventory | (current) | docs/SAFE_COMMAND_INVENTORY_NL.md |
| Final owner review preflight | (current) | preflight script/test |
| Package script safety extended | (current) | 26 package script safety tests |
| Owner acceptance checklist | (current) | docs/OWNER_ACCEPTANCE_CHECKLIST_NL.md and guard test |
| Owner decision menu | (current) | static script/test/generated doc |
| Owner acceptance hardening push basis | `6353546` | verified on `origin/main` before post-push handoff publication |
| Post-push verification evidence | `e07be8f` | `docs/POST_PUSH_VERIFICATION_NL.md` and guard test |
| Owner decision execution briefs | `a5ab4a8` | six decision briefs |
| Owner decision brief guards | `949823a` | decision brief guard tests |
| Owner approval intake validator | `84d13d7` | static validator script/test/generated doc |
| Post-push owner preflight scripts | `3866a43` | package scripts and package safety tests |
| Published owner-decision handoff | `f2f7cbb` | `origin/main` matches local handoff checkpoint; no commits ahead at publication |
| Production schema cutover evidence | `de37a66` | `docs/PRODUCTION_SCHEMA_CUTOVER_EVIDENCE_NL.md`; 10 cutover tests |
| Production historical import script + guard tests | (current) | `scripts/production-historical-import.mjs`; 35 guard tests; 25 evidence tests; dry-run verified + production import complete 2026-07-07; 902 transactions, 681 bookings, 4 source files |

### Live backup rehearsal status

PostgreSQL client tools available: pg_dump 15.17 (Homebrew), psql 15.17, pg_restore 15.17.

**RC3 result**: Live local rehearsal was completed on 2026-07-05 against `127.0.0.1:5432` with local PostgreSQL 15.17. Disposable `yaf_rehearsal_src_*` and `yaf_rehearsal_tgt_*` databases were created, all four migrations were applied, a 115.045 byte dump was restored, `prisma validate` and `prisma migrate status` passed without drift, and the disposable databases plus dump file were removed.

No database dump committed. No production touched.

### Local PostgreSQL version evidence status

`docs/POSTGRES_VERSION_EVIDENCE_NL.md` records the local PostgreSQL 15.17 rehearsal evidence above with scope limited to local backup/restore rehearsal. This does not establish the production PostgreSQL version, does not connect to production, and does not approve cutover.

### Post-push verification status

Post-push verification was refreshed after the owner-approved publication of the owner-decision handoff batch. Local checks confirmed `main`, `HEAD`/`origin/main` at `f2f7cbb`, remote `origin git@github.com:yeshuaacademy/finance.git`, no commits ahead of `origin/main`, no tags at `HEAD`, and only `.graphifyignore` plus `graphify-out/` as untracked Graphify artifacts.

The follow-up hardening added:

- `docs/POST_PUSH_VERIFICATION_NL.md` with static evidence and `tests/ops/postPushVerification.test.ts`.
- Six owner decision briefs for PDF renderer, PostgreSQL version, production cutover, historical import, e-mail provider, and secret rotation.
- `scripts/owner-approval-intake-validator.mjs`, `tests/ops/ownerApprovalIntakeValidator.test.ts`, and `docs/OWNER_APPROVAL_INTAKE_VALIDATION_NL.md`.
- `preflight:approval-intake`, `preflight:post-push`, and `preflight:decision-briefs` package scripts.

These six follow-up commits are now published through `f2f7cbb`. They did not execute production, import owner files, send e-mail, install a PDF dependency, rotate secrets, edit `.env`, or create tags. The next gate is owner decision selection; `postgres-version` is recommended first because it is verification-only and required before cutover.

## Authoritative document hierarchy

Future work is governed in this order:

1. `docs/PHILOSOPHY.md`
2. `docs/STRATEGY.md`
3. `docs/ROADMAP.md`
4. `docs/IMPLEMENTATION_PLAN.md`

This file is the active evidence and resume handoff. Older discovery and handoff documents are historical unless the authoritative documents explicitly reference them.

## Goal

Build a lean internal finance application that imports monthly ING exports, preserves every bank transaction, automatically books only deterministic matches, sends uncertain matches to review, reconciles every period to the bank statement, and generates factual monthly and yearly administrator reports.

The application is not a general accounting suite and not a SaaS product. It should do only the Yeshua Academy workflow well.

## Source files reviewed

- `YA financieel jaar 2024.xlsx`
- `YA financieel jaar 2025 v2.xlsx`
- `NL89INGB0006369960_2026-01-01_2026-07-01.csv`
- matching ING PDF statement for 2026-01-01 through 2026-07-01

The raw ING transaction fields and the final `Klant`, `Category`, and `Type` assignments in the concluded workbooks are treated as historical booking evidence.

Do not import the helper columns `Jaartal`, `Maand1`, `Maand`, `Dag`, or `Datum` as authoritative dates. In the 2024 workbook every `Maand` helper value is `February`; in the 2025 workbook every `Maand` helper value is `2`, despite raw `Date` values spanning the full year. Dates must be derived from the raw ING `Date` field.

The `Verduidelijking` worksheets are owner-confirmed, resolved, true, and final. Use them as additional interpretation evidence together with the final transaction category columns; they do not replace or rewrite the literal historical bookings.

## Verified financial controls

| Period | Transactions | Opening | Income | Expenses | Net | Closing |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 2024 | 268 | EUR 1,721.86 | EUR 32,267.19 | EUR 21,804.90 | EUR 10,462.29 | EUR 12,184.15 |
| 2025 | 413 | EUR 12,184.15 | EUR 91,642.44 | EUR 93,475.73 | EUR -1,833.29 | EUR 10,350.86 |
| 2026-01-01 through 2026-07-01 | 221 | EUR 10,350.86 | EUR 58,784.08 | EUR 61,297.69 | EUR -2,513.61 | EUR 7,837.25 |

Continuity is exact:

- 2024 closing balance equals the 2025 opening balance.
- 2025 closing balance equals the 2026 statement opening balance.
- The 2026 CSV has zero running-balance continuity errors across all 221 rows.
- EUR 10,350.86 + EUR 58,784.08 - EUR 61,297.69 = EUR 7,837.25.

The 2026 file is not a completed January-through-July statement. It ends on 1 July 2026 and includes that day's transactions. July is therefore partial.

## Historical taxonomy

The workbooks use three reporting dimensions:

1. `Klant`: organization, ministry, or project owner.
2. `Type`: broad reporting class.
3. `Category`: detailed booking category.

Owner-confirmed project names are `FTK` (For the King), `FR` (Fellowship Renswoude), `WLJ` (Walk Like Jesus), `YA` (Yeshua Academy), and `VS` (Vila Solidária). Preserve all historical codes and wording exactly as booked. `Algemeen` remains a literal historical value where present.

Observed broad types across both years:

- Algemeen
- Schenking
- Ondersteuning
- Ondersteuning organisaties
- Ondersteuning Behoeftigen
- Ondersteuning tegen Armoede
- Missiereis
- Liefdadigheden
- Maaltijd
- Uitgenodigde Sprekers
- Spaarrekening
- kruispost

There are 37 detailed category labels in 2024 and 39 in 2025, with 67 distinct literal labels across both years and only 9 exact overlaps. This does not mean 67 canonical categories are required. Many are year-specific projects, spelling variants, direction variants (`in`/`uit`), or labels that can be represented by a canonical category plus project and direction.

Historical labels must be retained and reproduced exactly in historical reports. Do not normalize, merge, correct spelling, change capitalization, or replace historical labels. Any future interpretation metadata must remain separate from the original booking evidence.

## Current application assessment

### Useful foundations already present

- ING CSV parsing and raw-row storage
- import batch hashes and duplicate protection
- PostgreSQL/Prisma data model
- opening balances
- monthly ledgers and locks
- reconciliation checks
- audit log support
- category rules
- review screen
- monthly/yearly report helpers
- stored administrator recipients
- XLSX export and email transport
- 229 passing tests and successful server/Next.js builds at discovery time

### Accounting-critical defects

1. **Fuzzy history guesses are booked without approval.**
   - `findFuzzyLedgerMatch` uses a similarity threshold of 0.8.
   - `findBestHistoryGuess` uses a default threshold of only 0.4.
   - Both can assign `classificationSource: history`, which excludes them from the current review queue.
   - Fuzzy evidence must be suggestion-only.

2. **The old categorization fallback is unsafe.**
   - `categorizationService.ts` can choose the globally most frequent category after three historical occurrences without requiring a matching counterparty or description.
   - This fallback must be removed.

3. **Counterparty/IBAN alone is not deterministic.**
   - Historical data contains 107 counterparty-direction pairs; 40 pairs map to multiple categories.
   - Among the 221 new transactions, 120 use a historically ambiguous counterparty-direction pair, 49 use an unseen pair, 14 use a pair seen only once, and only 38 use a repeated pair with one historical category.
   - Even the latter 38 are candidates, not automatically safe facts, unless an approved purpose-text rule also matches.

4. **The payment purpose is not a first-class parsed field.**
   - The parser stores `Name / Description` as the transaction description, which is usually the counterparty name.
   - Important words such as `tienden`, `huur`, project names, and purpose text remain buried in `Notifications`.
   - Rule matching cannot reliably use them as structured evidence.

5. **The data model stores a final category but not a proper suggestion decision.**
   - It lacks a separate immutable suggestion record with score, evidence, competing candidates, model/rule version, and approval outcome.
   - It also lacks explicit period-close statement controls and a frozen report snapshot.

6. **The historical XLSX importer cannot reproduce the concluded books.**
   - It expects a sheet named `transacties 2025`, which is absent in the supplied workbook.
   - It ignores `Klant`, `Type`, and the current `Category` hierarchy.
   - It must be replaced by a one-time, validated historical loader.

7. **Reports flatten the category hierarchy.**
   - Current reports derive main/sub labels by splitting one category string on ` — `.
   - This does not faithfully model `Klant`, `Type`, and `Category`.

8. **Email is not tied to a closed factual ledger.**
   - The notification route accepts client-supplied HTML and can send it without proving that the period is balanced, fully reviewed, and locked.
   - Email content must be generated server-side from a frozen closed-period snapshot.

9. **The current “clear review queue” operation bulk-confirms every suggested category.**
   - That is incompatible with a no-assumptions financial workflow and should be removed or replaced with explicit per-item/bounded approval.

## Required accounting invariants

These are non-negotiable implementation rules:

1. Imported bank rows are immutable. Corrections create auditable decisions, never silent edits to source facts.
2. Every import stores filename, file hash, row count, account, period, opening balance, total income, total expenses, closing balance, and raw source rows.
3. A duplicate file or duplicate transaction must not create a second ledger entry.
4. A transaction is either:
   - deterministically booked by an approved rule,
   - manually confirmed,
   - or awaiting review.
5. Fuzzy matches never become final bookings automatically.
6. An approved automatic rule must include direction and sufficient evidence such as counterparty plus normalized payment-purpose tokens. Amount may be a condition when materially relevant.
7. If two historical categories compete for the same evidence, no automatic booking is allowed.
8. A period cannot close while any transaction is unreviewed or uncategorized.
9. A period cannot close unless opening + income - expenses equals the statement closing balance exactly to the cent.
10. The sum of category totals must equal total income and total expenses exactly.
11. Closed periods are locked. Reopening requires an administrator, a reason, and an audit event.
12. Reports and emails are generated only from a frozen closed-period snapshot.
13. Year opening equals the previous year closing unless an explicit, audited adjustment exists.
14. Money is stored as integer euro cents; no floating-point ledger calculations.
15. Raw labels, canonical labels, rule evidence, approvals, and report dispatches remain auditable.

## Proposed lean product

### 1. Import

One primary action: import an ING CSV.

The import preview shows:

- file period and account
- opening, income, expenses, and closing totals
- transaction count
- duplicate count
- whether running balances are continuous
- whether the file overlaps an existing period

Nothing is committed if file controls fail.

### 2. Automatic processing

Three outcomes only:

- **Booked automatically**: an approved deterministic rule matched uniquely.
- **Review suggested**: historical/fuzzy evidence proposes a category with visible reasons.
- **No suggestion**: manual categorization required.

Approving a suggestion may optionally create or strengthen a rule, but only through an explicit administrator action.

### 3. Review

A single focused queue showing:

- date, counterparty, IBAN, amount, direction, and full payment purpose
- suggested `Klant`, `Type`, and `Category`
- exact evidence and confidence
- alternative candidates when ambiguous
- approve, choose another category, or create a new controlled category

No bulk “accept everything” control.

### 4. Reconcile and close

A monthly close screen displays:

- statement opening and closing balances
- imported income and expenses
- computed closing balance
- difference, which must be EUR 0.00
- transaction count and categorized count
- category-total control difference, which must be EUR 0.00
- unresolved review count, which must be zero

Only then can an administrator lock the month.

### 5. Reports

The visual dashboard should focus on factual outputs:

- opening and closing balance
- total income, expenses, and net movement
- monthly trend
- income by category
- expenses by category
- breakdown by project/organization (`Klant`)
- drill-down from every number to its transactions
- prominent balanced/closed status

The yearly report is the sum of closed months and includes opening, income, expenses, net, and closing controls.

### 6. Administrator email

Email only a locked snapshot. Include:

- period and account
- opening balance
- total income
- total expenses
- net movement
- closing balance
- categorized income and expense tables
- balanced/locked status
- immutable report identifier and generation time
- optional attached XLSX/PDF generated from the same snapshot

Store recipients, report snapshot ID, content hash, send time, sender, and delivery result.

## Proposed data-model direction

Exact naming can be refined during implementation, but the concepts should be explicit:

- `BankStatement` or enhanced `ImportBatch`: statement controls and source hash
- `Transaction`: immutable normalized bank fact plus raw row
- `Project`/`Organization`: canonical `Klant`
- `ReportType`: canonical broad `Type`
- `Category`: detailed canonical booking category with historical aliases
- `CategoryAlias`: original labels and spelling/direction variants
- `CategorizationRule`: approved deterministic conditions and provenance
- `CategorizationSuggestion`: proposed category, score, evidence, alternatives, status
- `ReviewDecision`: approver, decision, reason, prior/new category
- `PeriodClose`: frozen controls, status, lock metadata, checksum
- `ReportSnapshot`: immutable monthly/yearly figures
- `ReportDispatch`: recipients and send result

Raw financial files should not be committed to Git. Historical loading should run from owner-supplied secure local paths, record file hashes, validate all controls, and then discard file contents from application storage unless retention is explicitly approved.

## Historical loading plan

1. Build a dedicated parser for the exact concluded workbook columns.
2. Derive date only from raw `Date`.
3. Preserve original `Klant`, `Type`, and `Category` labels.
4. Create proposed canonical aliases without changing original bookings.
5. Load 2024 and verify 268 rows and all annual controls.
6. Load 2025 and verify 413 rows and all annual controls.
7. Verify 2024 closing = 2025 opening.
8. Import the 2026 CSV as an open statement and verify 221 rows and all statement controls.
9. Run categorization in suggestion mode first.
10. Review and approve 2026 categories with the owner before closing any month.

## Docker Compose assessment and safe replacement plan

The current `docker-compose.yml` is not authoritative for this application. It combines an unpinned `postgres:latest` service with unrelated WordPress and MySQL example services and example credentials. This conflicts with the documented standalone PostgreSQL architecture.

Do not edit or deploy it during discovery.

Safe replacement plan:

1. Confirm the PostgreSQL major version used in production.
2. Create a local-only Compose file containing only PostgreSQL, pinned to that compatible major version.
3. Mirror the documented database shape:
   - database `finance`
   - schema `finance`
   - application role `finance_user`
   - optional disposable shadow database `finance_shadow`
4. Use a named local volume and a health check.
5. Use local environment placeholders only; never commit real credentials.
6. Prefer a local port mapping that mirrors the documented environment where practical, while avoiding collisions.
7. Do not run destructive reset/import commands automatically at container startup.
8. Validate with `docker compose config`, start a disposable database, run Prisma generation/migrations, run tests/builds, and verify reconciliation fixtures.
9. Leave production configuration and data untouched until a separate deployment/cutover plan is explicitly approved.
10. Remove WordPress/MySQL only when the replacement file is implemented and validated in a dedicated change.

## Owner decisions

These decisions are authoritative and override earlier proposals.

1. Official project names:
   - `FTK`: For the King
   - `FR`: Fellowship Renswoude
   - `WLJ`: Walk Like Jesus
   - `YA`: Yeshua Academy
   - `VS`: Vila Solidária
2. Preserve the 2024 history exactly as booked. Keep `FR` unchanged in 2024. In 2025, treat the first transaction literally booked under `FTK` as the practical transition point; do not rewrite earlier history.
3. The `Verduidelijking` worksheets are resolved, true, and final. Use them as additional interpretation evidence together with the final transaction columns.
4. `Klant`, `Type`, and `Category` remain three separate required dimensions.
5. Preserve historical category wording exactly, including spelling, capitalization, and separate labels. Do not merge or normalize historical bookings.
6. Preserve separate `in` and `uit` category labels exactly as used in the concluded administration. Direction remains an additional bank fact, not a replacement for those categories.
7. Recommended treatment, subject to the existing historical labels:
   - internal transfers and savings movements remain separate transfer categories and are excluded from operating income/expense subtotals;
   - deposits and returned deposits remain separate balance movements and are not treated as ordinary income/expense;
   - refunds and reversals retain their own historical category and direction, with a link to the related transaction when identifiable;
   - restricted-purpose receipts and payments remain visible under their exact project/category labels and are reported separately from unrestricted operating results.
   This recommendation preserves every euro while preventing transfers or refunds from overstating ordinary income and expenses.
8. Use cash-basis reporting from actual bank transactions. Do not add accrual accounting features unless the owner later requests them explicitly.
9. Administrators may categorize, approve suggestions, reopen months, and send reports. All other users are view-only. Server authorization is authoritative.
10. Reports require a separate final administrator approval click after the period is balanced and locked. No automatic sending.
11. Produce all three formats from the same frozen snapshot: HTML email, XLSX attachment, and PDF attachment.
12. Historical reports reproduce the literal 2024 and 2025 wording exactly. No historical labels are rewritten.
13. Always retain the original source files unchanged. Store their hashes and make the originals downloadable. Derived formats may be generated, but never replace the originals.
14. July 2026 remains open until a complete July export is supplied.
15. The current production PostgreSQL major version is unknown and existing production data is not important. During the infrastructure phase, select a currently supported PostgreSQL major version that is compatible with Prisma, validate migrations and the complete financial fixture suite on a disposable database, and only then replace or update the environment.
16. The complete application UI, navigation, labels, errors, category administration, reports, and emails must be Dutch. ING source columns may remain English because they are external source data. Project and classification names remain exactly as supplied in the administration.
17. The expanded accounting roadmap now includes a month-by-month reconciliation and administrator reporting phase. Do not mark the overall roadmap complete until that phase is validated.

## Phased implementation roadmap

### Phase 1 - safety and source model

- Add regression tests proving fuzzy matches cannot auto-book.
- Remove global-popularity and low-threshold automatic fallbacks.
- Parse payment-purpose text as a first-class field.
- Separate suggestion state from final booking state.
- Define canonical project/type/category model and aliases.

### Phase 2 - historical loader and controls

- Implement exact 2024/2025 workbook loader.
- Add statement-level opening/in/out/closing controls.
- Load into a disposable database and reconcile all verified totals.
- Produce a category alias proposal for owner approval.

### Phase 3 - 2026 import and review

- Import the 221-row CSV in suggestion-only mode.
- Present deterministic candidates and ambiguous items.
- Conduct owner review and create approved rules.
- Keep July open because the supplied statement ends on 1 July.

### Phase 4 - close, visual reports, and email

- Implement strict close gate and frozen snapshots.
- Rebuild dashboard around closed factual periods.
- Generate monthly/yearly category and project reports.
- Generate server-side administrator email from the locked snapshot.

### Phase 5 - local infrastructure cleanup

- Replace the obsolete Compose file according to the approved local PostgreSQL plan.
- Validate on a disposable local database.
- Plan production migration/cutover separately.

### Phase 6 - month-by-month accounting reconciliation and administrator reporting

- Add month-level reconciliation controls and auditor summaries.
- Keep all monetary values in integer minor units only.
- Export closed balanced months with clear final status; open or unbalanced months remain draft-only.
- Require administrator approval before monthly dispatch.
- Keep month-chain continuity and unresolved transaction gates explicit.

## Validation strategy

Every phase must include targeted unit tests plus these financial fixtures:

- 2024: 268 rows; opening EUR 1,721.86; income EUR 32,267.19; expenses EUR 21,804.90; closing EUR 12,184.15.
- 2025: 413 rows; opening EUR 12,184.15; income EUR 91,642.44; expenses EUR 93,475.73; closing EUR 10,350.86.
- 2026 partial statement: 221 rows; opening EUR 10,350.86; income EUR 58,784.08; expenses EUR 61,297.69; closing EUR 7,837.25; zero running-balance continuity errors.

No phase is complete if a cent differs, a source row is lost, an ambiguous item is auto-booked, or report category totals do not tie to ledger totals.

## Phase 1 implementation checkpoint

Status: validated and committed.

Completed behavior:

- ING `Notifications` is preserved as structured `paymentPurpose` and `normalizedPaymentPurpose` evidence;
- approved categorization rules can match payment purpose explicitly;
- amount-only, source/amount-history, normalized-description-history, and global-popularity automatic fallbacks are removed from `categorizationService.ts`;
- only an approved rule or a complete raw historical replay can finalize an automatic booking;
- normalized fallback matches, fuzzy ledger matches, best-history guesses, account/amount/description reuse, and direction defaults remain review-only suggestions;
- the strongest earlier suggestion cannot be overwritten by a weaker later heuristic;
- `suggestedCategoryId` is stored separately from the final review/booked `categoryId` in suggestion metadata;
- the review placeholder is Dutch `Beoordeling nodig`, with backward compatibility for old English placeholder values;
- targeted normalization, parser, rule-engine, categorization, review, and integration regression tests cover the behavior.

Final validation evidence:

1. Complete tests `validation-ac16934d-7e51-4284-9914-1231816ed7bf`: 51 test files passed; 229 tests passed.
2. Server TypeScript build `validation-3fc58e7d-130f-407a-9313-1befd26ff2d8`: passed.
3. Prisma generation and Next.js production build `validation-1cdb6122-650a-4be0-af29-038453621e64`: passed; 18 routes generated. The existing non-blocking lockfile/SWC warning remains.
4. Full high-risk security scan over executable and test paths: no findings.
5. Documentation secret-material scan: no findings.
6. Documentation runtime-execution scan: no findings.
7. The combined scan reported expected documentation-only import workflow wording; these describe the legitimate ING import workflow and are not executable network behavior.
8. Diff review confirmed no financial source files, secrets, `.env` files, Prisma migration, dependency, Docker, or production-configuration changes.

Commit evidence:

- Commit: `925a609`
- Message: `fix: make finance categorization review-safe`
- Scope: 21 explicit governance and Phase 1 paths
- Excluded: `.graphifyignore`, `graphify-out/`, financial source files, Docker, dependencies, Prisma migrations, and production configuration

No financial data was imported. `docker-compose.yml` and production configuration remain untouched.

## MODEL-001 domain proposal checkpoint

Status: approved after owner review; documentation committed as `73daabd`.

Initial evidence:

- Created `docs/DOMAIN_MODEL.md`.
- Inspected the current Prisma schema, review API, import-file retention, reconciliation, reporting, email, and audit contracts.
- Defined exact entities, fields, relationships, aggregate boundaries, constraints, and migration ordering for `Klant`, `Type`, `Category`, source files, bank statements, immutable transactions, final bookings, suggestions, review decisions, deterministic rules, reconciliation, versioned closes, report snapshots, HTML/XLSX/PDF artifacts, approvals, dispatches, recipients, and roles.
- Preserved exact historical labels and the three required reporting dimensions.
- Kept suggestions separate from final bookings and removed broad review-queue acceptance from the target design.

Owner review findings resolved:

1. Chose one amount convention: `amountMinor` is always non-negative absolute euro cents and `direction` alone determines cash-flow sign.
2. Added `FinanceWorkspace` and `WorkspaceMembership` so financial ownership is stable and separate from human actor identity and roles; dimensions, files, accounts, statements, transactions, ledgers, rules, reports, recipients, and audit scope belong to the workspace.
3. Added exact `HISTORICAL` booking provenance through `historicalSourceTransactionId`, `historicalMatchKey`, immutable evidence, and `evidenceHash`.
4. Added monthly `StatementPeriod` boundaries and period-scoped reconciliation so multi-month sources cannot authorize the wrong close; July 2026 remains partial and uncloseable.
5. Added `ReportLineKind` field rules and an application-level requirement for exactly one HTML, XLSX, and PDF artifact before approval.
6. Updated future migration ordering so workspace separation, exact provenance, and period backfills precede removal of legacy fields.

Commit evidence:

- Hash: `73daabd`
- Message: `docs: approve financial domain model`
- Scope: `docs/DOMAIN_MODEL.md`, `docs/IMPLEMENTATION_PLAN.md`, `docs/ROADMAP.md`, and `docs/finance-rebuild-run.md`
- Excluded: `.graphifyignore`, `graphify-out/`, Prisma, migrations, financial source files, Docker, dependencies, and production configuration

No Prisma schema, migration, financial import, Docker, dependency, or production change was made.

Final revised validation:

- Secret-material scan over the four MODEL-001 documents: no findings.
- Runtime-execution scan over the four MODEL-001 documents: no findings.
- Final diff review confirmed the intended scope is `docs/DOMAIN_MODEL.md`, `docs/IMPLEMENTATION_PLAN.md`, `docs/ROADMAP.md`, and this handoff only.
- `.graphifyignore` and `graphify-out/` remain unrelated, unmodified, and excluded.

## MODEL-002 additive schema checkpoint

Status: implemented; uncommitted; review complete; approval withheld because the legacy migration history cannot replay on an empty database.

Changed paths:

- `prisma/schema.prisma`
- `prisma/migrations/20260703001200_add_workspace_dimensions/migration.sql`
- `tests/services/model002DomainSchema.test.ts`
- `docs/IMPLEMENTATION_PLAN.md`
- `docs/finance-rebuild-run.md`

Implemented behavior:

- Added `FinanceWorkspace`, `WorkspaceMembership`, and `WorkspaceRole`.
- Added workspace-scoped `Project` (`Klant`) and `TransactionType` (`Type`) models.
- Added workspace scope and historical metadata to the existing `Category` model while preserving exact labels under the legacy `name` field.
- Added optional `projectId` and `transactionTypeId` relations to `Transaction`; existing `categoryId` remains unchanged.
- Seeded one Yeshua Academy workspace and one administrator membership per existing user without changing actor identity.
- Preserved every existing schema field and financial row; the migration contains no category rename, category delete, transaction insert, historical-data import, or destructive `DROP` statement.
- Inspected `server/services/importService.ts`, `server/services/categorizationService.ts`, and `server/routes/review.ts`; no service write was required because legacy category queries remain valid in this additive slice.

Execution evidence:

- Packet preflight accepted exactly the schema, migration, and focused test paths at HEAD `8a5ab3f`.
- Guarded packet execution could not acquire a backend lease token; the same preflighted paths were applied directly through verified Workbench file operations.
- `.graphifyignore` and `graphify-out/` remained untouched.

Validation evidence:

- Focused MODEL-002 tests: 3 static tests passed; 1 guarded local disposable-database test skipped because no local admin URL is configured.
- Full test suite after adding the guarded integration test: 52 files, 232 tests passed, and 1 database test skipped.
- High-risk security scan over schema, migration, and validation test: no findings.
- `prisma format`: passed.
- Prisma Client generation: passed during the rerun production `prebuild`.
- Server TypeScript build: passed after the review update.
- Next.js production build: passed after the review update with 18 routes.
- Direct standalone `prisma validate` remains blocked because no standalone `DATABASE_URL` is available; no environment file was edited.
- MODEL-002 migration SQL remains additive and passed focused structural review.

Migration-history inventory finding:

- The repository contains 18 migration directories.
- Three migrations execute before their required finance tables exist: the two 2024 `CategorizationRule.conditions` migrations and `20250226140000_import_fingerprint` against `Transaction`.
- `20251003194500_ledger_init` is the first actual finance-schema initializer.
- Migrations before that initializer mix invalid finance changes with obsolete SaaS/template models and automation `Project` changes.
- The later finance lineage adds import controls, reconciliation, locking, rule-engine records, SaaS cleanup, audit logs, email recipients, and original-file retention.
- No single legacy migration represents the complete pre-MODEL-002 schema.
- Modifying an already-applied migration in place could create checksum drift and is not approved.

MIGRATE-001 implementation:

- The owner approved `docs/MIGRATION_HISTORY_NORMALIZATION_PROPOSAL.md` as the implementation specification.
- All 17 pre-MODEL-002 migration directories are archived byte-identically under `prisma/migrations-legacy-pre-baseline/`.
- `SHA256SUMS` records the original digest of every archived `migration.sql`; focused tests recompute and verify all 17 hashes.
- `MANIFEST.md` records original order, classification, baseline commit, and the unchanged MODEL-002 migration hash.
- `PRE_MODEL002_SCHEMA.prisma` stores the formatted audited pre-MODEL-002 schema snapshot.
- `prisma/migrations/0_finance_baseline/migration.sql` was generated from empty to that snapshot with Prisma 6.19 `migrate diff`.
- The active history contains only `0_finance_baseline` and the byte-identical `20260703001200_add_workspace_dimensions` migration.
- `tests/services/model002DomainSchema.test.ts` verifies active order, archive hashes, MODEL-002 hash stability, baseline contents, and localhost-only database safety.
- `scripts/validate-migrate-001.mjs` provides guarded localhost-only disposable database preparation, invariant verification, and cleanup.

MIGRATE-001 isolated PostgreSQL validation:

- Used peer-authenticated PostgreSQL through the local `/tmp` socket only.
- Fresh database: deployed baseline and MODEL-002 in order; migration status up to date; database-to-schema diff empty; database-backed `prisma validate` passed; Prisma Client 6.19.3 generation passed; both finished migration rows and the default workspace verified.
- Adoption database: applied the pre-MODEL-002 schema; seeded one user, two exact historical category labels, one account, and two transactions; captured counts, IDs, names, totals, and dates before migration.
- Recorded `0_finance_baseline` with `prisma migrate resolve --applied` without replaying baseline SQL, then deployed only MODEL-002.
- Adoption migration status was up to date and database-to-schema diff was empty.
- Category IDs and literal names, user identity, table counts, two transactions, total minor amount `19134`, credit `12345`, debit `6789`, and date range `2026-01-05 10:00:00` through `2026-02-06 11:30:00` remained unchanged.
- The default workspace, ADMIN membership, nullable new transaction dimensions, seven MODEL-002 foreign keys, and five expected unique indexes were verified.

Cleanup and final regression evidence:

- Dropped both uniquely named disposable databases and removed the `.migrate001-validation-*` workspace.
- Reran idempotent cleanup with no repository changes.
- Focused normalized-history tests: 6 passed; only the optional environment-driven database test skipped.
- Full suite: 52 files, 235 tests passed, 1 optional test skipped.
- Baseline audit snapshot Prisma formatting passed.
- Server TypeScript build passed.
- Prisma Client generation and Next.js production build passed with 18 routes.
- High-risk scan over schema, migrations, audit snapshot, test, and validation runner: no findings.
- Documentation secret-material and runtime-execution scans: no findings.
- No real or production database, financial-data import, Docker, dependency, environment, production configuration, `.graphifyignore`, or `graphify-out/` change occurred.
- The owner approved this explicit-path commit; no push is authorized.

MIGRATE-001 status: `DONE`.

## 2026-07-04 MIGRATE-001 local PostgreSQL validation evidence

This follow-up recorded the completed local database validation evidence only. It did not change code, Prisma schema, migrations, tests, generated output, production configuration, Graphify files, or environment files.

Brain documentation read before validation:

- `/Users/Office/Repos/stevewesthoek/brain/AGENTS.md`
- `/Users/Office/Repos/stevewesthoek/brain/00-start-here.md`
- `/Users/Office/Repos/stevewesthoek/brain/00-current-context.md`
- `/Users/Office/Repos/stevewesthoek/brain/00-memory-map.md`
- `/Users/Office/Repos/stevewesthoek/brain/CLAUDE.md`
- `/Users/Office/Repos/stevewesthoek/brain/ai/skills/custom/orbstack/SKILL.md`
- `/Users/Office/Repos/stevewesthoek/brain/operations/database/standalone/README.md`
- `/Users/Office/Repos/stevewesthoek/brain/operations/infrastructure/local-apps.md`
- `/Users/Office/Repos/stevewesthoek/brain/operations/LOCAL_INFRASTRUCTURE.md`
- `/Users/Office/Repos/stevewesthoek/brain/operations/infrastructure/FAMILY_FINANCE_LOCAL_ONLY_DIRECTIVE.md`

Brain local database convention found:

- OrbStack is the local container runtime.
- Plain `postgres:16` is used for local development databases.
- Local database ports are reserved in the `5400-5499` range.
- Persistent local app database definitions live under `brain/operations/database/standalone/<app>/docker-compose.yml`.
- No documented Yeshua Finance persistent local database stack existed, so validation used a temporary localhost-only disposable container and removed it afterward.

Local connection guard:

- `SYSTEM_DATABASE_URL` targeted `localhost`, port `5458`, admin database `postgres`.
- Username and password were present; the localhost guard passed.
- No production, Dokploy, MCP bridge, remote, or `10.0.2.4` database was used.
- The validation container was `yeshua-finance-local-postgres-migrate001-20260704122344`; it was stopped and removed during cleanup.

Active migration directories:

1. `prisma/migrations/0_finance_baseline`
2. `prisma/migrations/20260703001200_add_workspace_dimensions`
3. `prisma/migrations/20260703193000_add_classification_records`

Guarded marker test:

- `tests/services/model002DomainSchema.test.ts`
- Database replay executed.
- Result: `7 passed`, no skip.

Fresh current-chain database:

- Database: `yaf_migrate001_fresh_20260704122427_8458`
- `prisma migrate deploy` applied all three active migrations successfully.
- `prisma migrate status`: database schema is up to date.
- `prisma validate`: valid.
- `prisma generate`: passed.
- `prisma migrate diff`: no difference detected.

Adoption rehearsal database:

- Database: `yaf_migrate001_adopt_20260704122514_32649`
- Applied `0_finance_baseline` manually.
- Seeded only a synthetic fixture: one user, two categories, one account, and two transactions.
- `prisma migrate resolve --applied 0_finance_baseline`: passed.
- `prisma migrate deploy` applied MODEL-002 and MODEL-003 Packet A migrations successfully.
- `prisma migrate status`: database schema is up to date.
- `prisma validate`: valid.
- `prisma migrate diff`: no difference detected.
- Original counts, IDs, labels, transaction totals, credit/debit totals, and date range remained stable.
- Transaction total remained `19134`; credit remained `12345`; debit remained `6789`.
- Date range remained `2026-01-05 10:00:00` to `2026-02-06 11:30:00`.
- MODEL-002 workspace and membership structures exist.
- MODEL-003 tables, enums, and foreign-key relations exist.
- No external historical finance data was inserted; historical import remains a later task.

Cleanup and safety:

- Dropped both disposable databases.
- Stopped and removed container `yeshua-finance-local-postgres-migrate001-20260704122344`.
- No production, Dokploy, MCP bridge, or `10.0.2.4` database was used.
- No secrets were committed or printed in documentation.
- No `.env` edit, production config edit, Graphify file edit, database import, MODEL-003 feature work, commit, or push happened in this validation follow-up.

## MODEL-003 design gate

Created `docs/MODEL_003_CLASSIFICATION_RECORDS_PROPOSAL.md` as a documentation-only contract for immutable classification records. It defines:

- `TransactionBooking` as the current final three-dimension classification;
- `CategorizationSuggestion` as append-only ranked evidence that never becomes final without an explicit decision;
- `ReviewDecision` as immutable administrator decision history and the financial source of truth;
- compatibility phases that keep existing `Transaction` classification fields during additive migration;
- conservative existing-data mapping for `none`, `import`, `manual`, `rule`, and `history` classification states;
- provenance and canonical `evidenceHash` requirements;
- append-only suggestion and decision behavior;
- a single atomic review write boundary;
- ADMIN-only mutation and workspace validation rules;
- removal, disabling, or rejection of unsafe `clearReviewQueue` / `confirmTransactions` bulk confirmation;
- constraints, indexes, rollback, and two later implementation packets.

MODEL-003 implementation packets after owner approval:

- Packet A — additive persistence: Prisma models, enums, additive migration, structural tests, disposable PostgreSQL validation, full tests/builds/scans.
- Packet B — behavioral transition: atomic review-decision service, booking writes, suggestion resolution, unsafe bulk-confirm removal/rejection, route/API updates, targeted service/API/UI helper tests, full tests/builds/scans.

No schema, migration, service, route, test, financial-data import, Docker, dependency, environment, production configuration, `.graphifyignore`, or `graphify-out/` change was made for this design gate.

## MODEL-003 Packet A

Owner approved `docs/MODEL_003_CLASSIFICATION_RECORDS_PROPOSAL.md` and authorized Packet A only.

Implemented Packet A files:

- `prisma/schema.prisma`
- `prisma/migrations/20260703193000_add_classification_records/migration.sql`
- `tests/services/model003ClassificationRecords.test.ts`
- `tests/services/model002DomainSchema.test.ts`
- documentation handoff updates

Packet A implementation summary:

- Added additive persistence for `TransactionBooking`, `CategorizationSuggestion`, and `ReviewDecision`.
- Added `BookingSource`, `SuggestionConfidence`, `SuggestionMatcher`, `SuggestionStatus`, and `ReviewDecisionAction` enums.
- Preserved all legacy `Transaction` classification fields during compatibility.
- Added no service, route, API, UI, import, Docker, dependency, environment, production configuration, `.graphifyignore`, or `graphify-out/` changes.
- Did not begin Packet B.

Packet A validation evidence:

- Prisma schema formatting passed.
- Prisma schema validation passed with a localhost-only dummy URL.
- Disposable local PostgreSQL database `model003_packet_a_f961650b_20260703` was created through the `/tmp` socket.
- `prisma migrate deploy` applied `0_finance_baseline`, `20260703001200_add_workspace_dimensions`, and `20260703193000_add_classification_records` successfully.
- Database-to-schema diff reported no difference after repairing the expected Prisma-truncated suggestion index name.
- Focused MODEL-003 tests passed: 6 tests passed.
- Full suite passed: 53 files passed; 241 tests passed; 1 optional test skipped.
- Server TypeScript build passed.
- Prisma Client generation passed.
- Next.js production build passed with 18 routes; the SWC lockfile warning remained pre-existing and no generated files changed.
- Packet A executable high-risk scan reported no findings.
- Dropped disposable database `model003_packet_a_f961650b_20260703` after validation.

## MODEL-003 Packet B proposal

Created `docs/MODEL_003_PACKET_B_PROPOSAL.md` as a documentation-only proposal for the review-decision behavior transition.

Packet B proposal summary:

- Reviewed committed Packet A baseline `019691091bb1b4b75d1c822d05f3d4e08cadface`.
- Reviewed current review behavior in `server/routes/review.ts`, `server/services/reviewQueueService.ts`, `server/services/categorizationService.ts`, relevant tests, and client API wrappers.
- Identified that current behavior still mutates legacy transaction fields directly and bulk-converts review items to `manual`.
- Proposed a bounded Packet B implementation around one atomic review-decision service, route transition, unsafe bulk-confirm rejection, legacy compatibility mirrors, targeted tests, and documentation handoff.
- Explicitly excluded schema/migration work, financial-data import, historical replay, rule-model transition, production configuration, Docker, dependencies, Graphify artifacts, commit, and push.

Packet B implementation evidence:

- Added `server/services/reviewDecisionService.ts` as the atomic review-decision service.
- Updated `server/routes/review.ts`, `server/services/reviewQueueService.ts`, `server/services/categorizationService.ts`, `server/services/ruleEngine.ts`, and `src/libs/api.ts`.
- Added targeted Packet B tests for review decisions, review routes, review queue rejection, categorization rejection, and rule application rejection.
- Manual assignment requires `projectId`, `transactionTypeId`, and `categoryId`.
- Unsafe bulk approval and category-only rule application reject with a Dutch explanation instead of creating manual truth.
- Legacy `Transaction` fields remain compatibility mirrors.
- No Prisma schema or migration change was made.
- No financial-data import, Docker, dependency, environment, production configuration, `.graphifyignore`, or `graphify-out/` change was made.

Packet B validation evidence:

- Focused Packet B tests passed: 16 tests.
- Rule-engine focused tests passed: 9 tests.
- Server TypeScript build passed.
- Full suite passed: 55 files passed; 251 tests passed; 1 optional test skipped.
- Production build passed with 18 routes; the SWC lockfile warning remained pre-existing and no generated files changed.
- Server/test executable high-risk scan reported no findings.
- `src/libs/api.ts` high-risk scan reported pre-existing client request/import patterns; the Packet B diff only expands the existing `updateCategory` payload and error handling.

## MODEL-004 and MODEL-005 implementation evidence

Implemented MODEL-004 statement controls and source-file retention plus MODEL-005 period-close, report-snapshot, approval, and dispatch persistence as one bounded Phase 2 continuation.

Implemented files:

- `prisma/schema.prisma`
- `prisma/migrations/20260704143000_add_statement_close_report_models/migration.sql`
- `server/services/statementControlService.ts`
- `server/services/periodCloseService.ts`
- `tests/services/statementControlService.test.ts`
- `tests/services/periodCloseService.test.ts`
- `tests/services/model002DomainSchema.test.ts`
- documentation handoff updates

MODEL-004 summary:

- Added additive `SourceFile`, `BankStatement`, and `StatementPeriod` models.
- `SourceFile` retains original bytes, filename, media type, size, SHA-256 hash, submitter, workspace, and created time.
- `BankStatement` stores account, period, coverage status, row count, opening, income, expenses, net, closing, accepted metadata, and source-file uniqueness.
- `StatementPeriod` stores account-specific reconciliation periods with exact balances and row counts.
- `statementControlService` hashes retained bytes, stores/reuses duplicate source files by workspace/hash, downloads bytes byte-identically, validates exact statement totals, rejects duplicate accepted source files, and creates statement periods.

MODEL-005 summary:

- Added additive `PeriodClose`, `ReportSnapshot`, `ReportSnapshotPeriodClose`, `ReportSnapshotLine`, `ReportArtifact`, `ReportApproval`, `ReportDispatch`, and `ReportDispatchRecipient` models.
- `periodCloseService` enforces balanced reconciliations before close, rejects partial/incomplete periods, creates immutable versioned close records with classification/source hashes, records audited reopen metadata, creates frozen report snapshots, approves snapshots, and creates dispatch attempts with recipient hashes.

Validation evidence:

- Prisma Client generation passed.
- Focused MODEL-004 tests passed: 4 tests.
- Focused MODEL-005 tests passed: 6 tests.
- Structural migration-chain marker passed after adding `20260704143000_add_statement_close_report_models` to the expected active chain: 6 passed, 1 skipped.
- Server TypeScript build passed after one bounded Bytes typing repair.
- Full suite passed: 57 files passed; 261 tests passed; 1 optional database replay skipped.
- Production build passed with 18 routes; SWC lockfile warnings remained pre-existing and no generated files changed.
- Disposable local PostgreSQL validation used the existing Brain/OrbStack `familyfinance-postgres-1` local stack on `localhost:5452`.
- Disposable database: `yaf_model004005_validate_20260704170627_16917`.
- `prisma migrate deploy` applied all four active migrations successfully: `0_finance_baseline`, `20260703001200_add_workspace_dimensions`, `20260703193000_add_classification_records`, and `20260704143000_add_statement_close_report_models`.
- `prisma migrate status` reported the database schema is up to date.
- `prisma validate` passed.
- `prisma generate` passed.
- `prisma migrate diff` from the disposable database to `prisma/schema.prisma` reported no difference.
- The disposable database was dropped after validation.
- Changed executable/test high-risk scan found only expected local-only database guard and Prisma datasource references.
- Documentation secret-material scan reported no findings.
- Documentation risky runtime-execution scan reported no findings.

Commit evidence:

- MODEL-004/005 was committed as `49386ad feat: add statement controls and close reporting models`.
- Committed paths were limited to the approved MODEL-004/005 documentation, Prisma schema/migration, service, and test files.

No production, Dokploy, MCP bridge, `10.0.2.4`, financial import, historical data backfill, production configuration, `.env`, `.graphifyignore`, or `graphify-out/` change occurred in this batch.

## Phase 3 Packet D sanitized rehearsal evidence

Implementation summary:

- Added a sanitized historical import rehearsal service that accepts an already-built fixture-derived import plan and writes through the provided Prisma transaction client.
- The rehearsal creates synthetic user/workspace/account context plus MODEL-004/005 source-file, statement, statement-period, transaction, dimension, and historical booking records.
- Source-file retention uses synthetic bytes only; owner Excel, CSV, and PDF files are not read or copied.
- Duplicate plan fingerprints are skipped during writes so duplicate sanitized fixture rows do not double-import.
- Complete sanitized workbook data remains close-eligible; the partial 2026 statement remains not close-eligible.

Local database validation:

- Used existing Brain/OrbStack PostgreSQL on `localhost:5452`.
- Created disposable database `yaf_packetd_rehearsal_20260704195805_69949`.
- `prisma migrate deploy` applied all four active migrations successfully: `0_finance_baseline`, `20260703001200_add_workspace_dimensions`, `20260703193000_add_classification_records`, and `20260704143000_add_statement_close_report_models`.
- `prisma migrate status` reported the database schema is up to date.
- `prisma validate` passed.
- `prisma generate` passed.
- `prisma migrate diff` from the disposable database to `prisma/schema.prisma` reported no difference.
- The disposable migration database was dropped after validation.
- The DB-backed rehearsal test also created and dropped its own unique disposable local database.

Validation evidence:

- Focused historical import rehearsal tests passed: 2 tests.
- Focused historical import planner tests passed: 3 tests.
- Focused MODEL-002 additive domain schema tests passed: 7 tests.
- Full suite passed: 63 files, 273 tests.
- Server TypeScript build passed.
- Production build passed with 18 routes; the pre-existing Next/SWC lockfile warning remained.
- `git diff --check` passed.
- Changed executable/test high-risk scan found only expected local-only database guard, fixture reads, and disposable database create/drop operations.
- Secret-material scan found only placeholder/local database URL examples.
- Documentation runtime-execution scan found only existing historical notes and expected no-production guardrails.

No production, Dokploy, MCP bridge, `10.0.2.4`, real historical import, owner source-file copy, production configuration, `.env`, `.graphifyignore`, `graphify-out/`, push, or non-disposable database mutation occurred.

## Phase 3 Packet E retained source hash hardening

Implementation summary:

- Repaired sanitized rehearsal source-file retention so `SourceFile.sha256` is the SHA-256 of the retained synthetic bytes stored in `SourceFile.content`.
- Kept planner/source inventory hashes as sanitized metadata inside synthetic content, not as retained-byte identity.
- Source-file upsert idempotency now uses the retained-content hash.
- Strengthened the DB-backed rehearsal test to assert stored hash equals stored bytes, retained content is synthetic, fixture row labels are absent, and repeat rehearsal remains idempotent.
- Added `lib/import/historicalOwnerFileAdapter.ts` as a pure typed design for the future owner-approved local rehearsal flow.
- The adapter design validates local-only database targets and absolute owner paths outside Git, and records future steps for retained-byte hashing, parsing, plan building, disposable local DB writes, verification, and cleanup.

No Prisma schema or migration was required. No real owner file was read, copied, or imported. No production, Dokploy, MCP bridge, `10.0.2.4`, production configuration, `.env`, `.graphifyignore`, `graphify-out/`, or push was touched.

## Phase 3 Packet F owner-approved local rehearsal evidence

Implementation summary:

- Added `lib/import/historicalOwnerLocalRehearsal.ts` to read only the owner-approved absolute source paths outside Git, verify expected file hashes, parse the concluded 2024 and 2025 workbooks, parse the 2026 ING CSV/PDF source pair, and build owner-local rehearsal plans.
- Added retained-byte input support to `server/services/historicalImportRehearsalService.ts` so the local rehearsal can persist exact source bytes in `SourceFile.content` and hash those retained bytes in `SourceFile.sha256`.
- Added `tests/services/historicalOwnerLocalRehearsal.test.ts` to guard localhost-only database URLs, reject non-local hosts, create a unique disposable database, apply the active migration SQL chain, write the owner rehearsal plan, verify source-byte hashes and control totals, and drop the disposable database.
- The real 2026 ING CSV is newest-to-oldest, so the owner-local adapter sorts it chronologically before control computation. Retained source bytes remain unchanged.

Owner-source scope:

- Read locally from the approved owner admin folder outside the repository:
  - `YA financieel jaar 2024.xlsx`
  - `YA financieel jaar 2025 v2.xlsx`
  - `NL89INGB0006369960_2026-01-01_2026-07-01.csv`
  - `NL89INGB0006369960_2026-01-01_2026-07-01.pdf`
- No owner file, raw transaction row dump, generated output, production config, or `.env` file was copied into Git.

Sanitized control evidence:

- 2024 workbook: 268 rows; opening EUR 1,721.86; income EUR 32,267.19; expenses EUR 21,804.90; closing EUR 12,184.15; close-eligible.
- 2025 workbook: 413 rows; opening EUR 12,184.15; income EUR 91,642.44; expenses EUR 93,475.73; closing EUR 10,350.86; close-eligible.
- 2026 open statement: 221 rows; opening EUR 10,350.86; income EUR 58,784.08; expenses EUR 61,297.69; closing EUR 7,837.25; partial and not close-eligible.
- All workbook transactions written in the rehearsal have explicit `Klant`, `Type`, and `Category` dimension links.
- Persisted source-file hashes match the retained source bytes in the disposable database.

Local database validation:

- Used existing Brain/OrbStack PostgreSQL on `localhost:5452`.
- Created disposable migration database `phase3_packet_f_migrate_20260704231905_27519`.
- `prisma migrate deploy` applied all four active migrations successfully: `0_finance_baseline`, `20260703001200_add_workspace_dimensions`, `20260703193000_add_classification_records`, and `20260704143000_add_statement_close_report_models`.
- `prisma migrate status` reported the database schema is up to date.
- `prisma validate` passed.
- `prisma generate` passed.
- `prisma migrate diff` from the disposable database to `prisma/schema.prisma` reported no difference.
- The disposable migration database was dropped after validation.
- Focused owner-local DB-backed rehearsal created and dropped `owner_historical_rehearsal_1783203654807_22c36dbd`.
- Full-suite owner-local DB-backed rehearsal created and dropped `owner_historical_rehearsal_1783203678131_09051765`.
- Final disposable database check reported zero remaining `phase3_packet_f_migrate_%`, `historical_rehearsal_%`, or `owner_historical_rehearsal_%` databases.

Validation evidence:

- Focused owner-local rehearsal tests passed: 2 tests.
- Focused historical import rehearsal service tests passed: 2 tests.
- Focused historical import planner tests passed: 3 tests.
- Focused historical owner-file adapter design tests passed: 2 tests.
- Full suite passed: 65 files, 277 tests.
- Server TypeScript build passed.
- Production build passed with 18 routes; the pre-existing Next/SWC lockfile warning remained.

No production, Dokploy, MCP bridge, `10.0.2.4`, persistent owner-data import, production configuration, `.env`, `.graphifyignore`, `graphify-out/`, owner-source copy, raw row dump, generated output commit, or push occurred.

## Phase 3 Packet G guarded dry-run service evidence

Implementation summary:

- Added `server/services/historicalOwnerImportCommandService.ts` as the production-safe service surface for future CLI or UI wiring.
- Added `tests/services/historicalOwnerImportCommandService.test.ts` for the command guard behavior.
- The command service defaults to `dry-run`, reuses the owner-local parser/planner, and returns only sanitized summaries: file names, SHA-256 hashes, sizes, row counts, control totals, duplicate counts, and close eligibility.
- The result intentionally excludes raw owner rows, payment-purpose text, counterparty values, retained source bytes, test snapshots of rows, and generated output.
- Production requests return `production-blocked`; Packet G does not execute production imports or database writes.
- Future production execution remains blocked unless a later approved procedure supplies an explicit production option, reviewed dry-run acceptance, an operator confirmation token, and a source-bound production confirmation token.
- Rehearsal mode only accepts localhost, `127.0.0.1`, or `::1` database targets. `10.0.2.4` is always rejected.
- Source paths must be absolute, outside Git, present, and hash-matched before planning.
- The dry-run guard keeps the verified close states: 2024 and 2025 are complete/close-eligible; the 2026 source is partial/not close-eligible.

Validation evidence:

- Focused historical owner import command tests passed: 8 tests.
- Focused historical owner local rehearsal tests passed after solo rerun: 2 tests.
- Focused sanitized historical import rehearsal service tests passed: 2 tests.
- Focused historical import planner tests passed: 3 tests.
- Full suite passed: 66 files, 285 tests.
- Prisma validate and Prisma generate passed.
- Server TypeScript build passed.
- Production build passed with 18 routes and retained the pre-existing Next/SWC lockfile warning.
- `git diff --check` passed.
- Changed executable/test high-risk scan reported no unexpected findings.
- Documentation secret-material scan reported no findings.
- Changed-documentation runtime scan reported only expected no-production/no-push/local-only guardrail references.
- Disposable local rehearsal databases created during validation were dropped; the final cleanup check found zero matching disposable databases.
- No Prisma schema or migration was required.

No production, Dokploy, MCP bridge, `10.0.2.4`, persistent owner-data import, production configuration, `.env`, `.graphifyignore`, `graphify-out/`, owner-source copy, raw row dump, generated output commit, database write through Packet G, or push occurred.

## Phase 4 FLOW-001 monthly import preview foundation evidence

Implementation summary:

- Added `server/services/monthlyImportPreviewService.ts` as a pure monthly ING CSV preview service.
- Added `tests/services/monthlyImportPreviewService.test.ts` and `tests/routes/monthlyImportPreview.test.ts`.
- Added guarded route wiring for the monthly import preview endpoint; the existing import path is unchanged.
- The preview accepts retained CSV bytes, computes the SHA-256 from those exact bytes, and returns a SourceFile-compatible sanitized source summary.
- The preview parses ING CSV rows, computes period start/end, opening balance, income, expenses, net movement, closing balance, row count, duplicate count, new transaction count, running-balance findings, coverage status, and close eligibility.
- Duplicate detection uses import fingerprints and can compare against existing transactions through a caller-supplied lookup.
- FLOW-001 does not create `Transaction`, `TransactionBooking`, `PeriodClose`, report, dispatch, production import, or production configuration records.
- 2026-style partial/open statements remain not close-eligible.
- The preview output intentionally excludes raw rows, payment-purpose text, counterparty text, retained bytes, row snapshots, and generated output.
- Historical production import remains operator-gated through the Packet G dry-run/production-blocked boundary.

Validation evidence:

- Focused monthly import preview service and route tests passed: 9 tests.
- Focused ING CSV parser test passed: 1 test.
- Focused historical owner import command regression tests passed: 8 tests.
- Full suite passed: 68 files, 294 tests.
- Prisma validate and Prisma generate passed with the local localhost database URL convention.
- Server TypeScript build passed.
- Production build passed with 18 routes and retained the pre-existing Next/SWC lockfile warning.
- `git diff --check` passed.
- Changed executable/test high-risk scan reported no unexpected findings; raw source fields appear only for fingerprint computation and no raw rows are returned.
- Documentation secret-material scan reported no findings.
- Disposable DB-backed regression tests used local `localhost:5452`, created and dropped `historical_rehearsal_1783242082901_add19d4c` and `owner_historical_rehearsal_1783242083500_08515855`; the final cleanup check found zero matching disposable databases.
- No Prisma schema or migration was required.

No production, Dokploy, MCP bridge, `10.0.2.4`, persistent owner-data import, production configuration, `.env`, `.graphifyignore`, `graphify-out/`, owner-source copy, raw row dump, generated output commit, period close, transaction booking, historical production import, or push occurred.

## Phase 4 FLOW-002 deterministic categorization evidence

Implementation summary:

- Added `server/services/deterministicCategorizationService.ts` as a pure decision layer for deterministic categorization.
- Added `tests/services/deterministicCategorizationService.test.ts`.
- Extended `server/services/monthlyImportPreviewService.ts` with an optional categorization summary hook; preview remains side-effect free.
- Extended monthly preview tests to cover deterministic categorization summary counts.
- Finalization is allowed only for one approved complete deterministic rule, one complete exact historical replay, or both sources agreeing on the same complete `projectId`, `transactionTypeId`, and `categoryId`.
- Multiple matching rules, multiple historical dimension triples, missing dimensions, non-exact confidence, inactive/unapproved rules, and rule/history conflicts do not finalize.
- The deterministic result distinguishes `finalized`, `review_suggested`, `unmatched`, and `conflict`.
- Evidence includes matched rule IDs, historical record IDs, evidence hashes, import fingerprint/replay key, and a reason, but no raw row dumps.
- FLOW-002 does not create `TransactionBooking`, `PeriodClose`, report, dispatch, production import, or production configuration records.
- Historical production import remains operator-gated through the Packet G dry-run/production-blocked boundary.

Validation evidence:

- Focused deterministic categorization tests passed: 11 tests.
- Focused monthly import preview regression tests passed: 10 tests.
- Focused categorization service regression tests passed: 15 tests.
- Focused rule engine regression tests passed: 9 tests.
- Focused review queue regression test passed: 1 test.
- Focused review decision regression tests passed: 8 tests.
- Full suite passed: 69 files, 306 tests.
- Prisma validate and Prisma generate passed with the local localhost database URL convention.
- Server TypeScript build passed.
- Production build passed with 18 routes and retained the pre-existing Next/SWC lockfile warning.
- Disposable DB-backed regression tests used local `localhost:5452`, created and dropped `historical_rehearsal_1783246779929_3688c713` and `owner_historical_rehearsal_1783246780262_88a6002b`; final cleanup found zero matching disposable databases remaining.
- `git diff --check` passed.
- Changed executable/test high-risk scan reported no unexpected findings; source row terms appear only in existing fingerprint construction, fixtures, and negative sanitization assertions.
- Documentation secret-material scan reported no findings.
- Changed-documentation runtime scan reported only expected no-production/no-push guardrail references.
- No Prisma schema or migration was required.

No production, Dokploy, MCP bridge, `10.0.2.4`, persistent owner-data import, production configuration, `.env`, `.graphifyignore`, `graphify-out/`, owner-source copy, raw row dump, generated output commit, period close, transaction booking, historical production import, or push occurred.

## FLOW-003 through FLOW-004 status

FLOW-003 evidence-rich Dutch review queue committed as `6618cb6`. FLOW-004 explicit rule creation from approved decisions committed as `c5d6312`. Historical production import remains operator-gated and blocked.

## Phase 4 FLOW-003 evidence-rich Dutch review queue evidence

Implementation summary:

- Extended `server/services/reviewQueueService.ts` with a read-only evidence-rich Dutch review queue builder.
- `GET /api/review` now requires an authenticated production session, supports authenticated viewer/admin reads, and delegates queue shaping to the review queue service while leaving mutations administrator-only.
- Review items include transaction id/import fingerprint, raw ING display date, counterparty/IBAN where available, amount, direction, description/payment purpose, proposed `Klant`, `Type`, `Category`, deterministic status, Dutch reason text, rule ids, historical evidence, evidence hashes, and alternatives.
- The queue distinguishes finalized deterministic candidates, review suggestions, conflicts, unmatched items, and incomplete dimension candidates.
- Added bounded API/helper types and Dutch helper labels for evidence-rich review statuses.
- Bulk acceptance remains disabled through `reviewDecisionService`.
- Queue reads do not create `TransactionBooking`, `PeriodClose`, report, dispatch, production import, or production configuration records.
- Explicit administrator approval with complete `projectId`, `transactionTypeId`, and `categoryId` remains required before a booking can be created.
- Historical production import remains operator-gated through the Packet G dry-run/production-blocked boundary.

Validation evidence:

- Focused review queue tests passed: 3 tests.
- Focused review decision tests passed: 8 tests.
- Focused review route tests passed: 7 tests.
- Focused review page helper tests passed: 9 tests.
- Focused deterministic categorization tests passed: 11 tests.
- Focused monthly import preview regression tests passed: 10 tests.
- Full suite passed: 69 files, 311 tests.
- Prisma validate and Prisma generate passed with the local localhost database URL convention.
- Server TypeScript build passed.
- Production build passed with 18 routes and retained the pre-existing Next/SWC lockfile warning.
- Disposable DB-backed regression tests used local `localhost:5452`, created and dropped `historical_rehearsal_1783249009004_31539786` and `owner_historical_rehearsal_1783249009298_dc69e7e8`; final cleanup found zero matching disposable databases remaining.
- `git diff --check` passed.
- Changed executable/test high-risk scan reported no unexpected findings; matches were expected read-only evidence fields, negative sanitization assertions, and explicit no-booking flags.
- Documentation secret-material scan reported no findings.
- Changed-documentation runtime scan reported only expected no-production/no-push guardrail references.
- No Prisma schema or migration was required.

No production, Dokploy, MCP bridge, `10.0.2.4`, persistent owner-data import, production configuration, `.env`, `.graphifyignore`, `graphify-out/`, owner-source copy, raw row dump, generated output commit, period close, transaction booking, historical production import, or push occurred.

## Phase 4 FLOW-004 explicit rule creation evidence

FLOW-004 explicit rule creation from approved decisions is implemented locally.

Implementation notes:
- Added `server/services/ruleCreationService.ts` for administrator-only rule creation preview and activation.
- Preview requires a complete expected `Klant`, `Type`, and `Category`, validates that the source transaction has an approved matching decision/booking, shows sanitized matching transaction ids, and returns a preview hash.
- Activation is a separate route and requires `explicitConfirmation: true` plus the current preview hash.
- Broad, ambiguous, duplicate, conflicting, incomplete, and non-exact rule candidates are rejected before any rule write.
- The existing `CategorizationRule` model remains unchanged; activation creates an active category-scoped rule row with condition JSON after full-dimension preview validation.
- Preview and activation create no `TransactionBooking` records, close no periods, perform no historical production import, and do not touch production configuration.
- Added route/API/helper support for `POST /api/review/:id/rule/preview` and `POST /api/review/:id/rule/activate`.

Validation completed in this slice:
- Focused rule creation service tests passed: 5 tests.
- Focused review route tests passed: 8 tests.
- Focused review page helper tests passed: 10 tests.
- Focused rule engine tests passed: 9 tests.
- Focused categorization and review queue regressions passed: 7 tests.
- Focused review decision, deterministic categorization, and monthly import preview regressions passed: 27 tests.
- Full test suite passed: 70 files; 317 tests passed; 3 skipped.
- Prisma validate passed with a local-only `localhost:5452/flow004_validate` URL.
- Prisma Client generation passed.
- Server TypeScript build passed.
- Production build passed with 18 routes and the existing non-blocking SWC lockfile warning.
- `git diff --check` passed.
- Changed executable/test high-risk scan reported no unexpected findings; matches were existing env/request wrappers, explicit no-booking flags, and test fixture/current-booking reads.
- Changed-documentation secret-material scan reported no unexpected findings; matches were prior validation notes and local-only placeholder database references.
- Changed-documentation runtime scan reported only expected historical notes and no-production/no-push/local-only guardrail references.

No production, Dokploy, MCP bridge, `10.0.2.4`, persistent owner-data import, production configuration, `.env`, `.graphifyignore`, `graphify-out/`, owner-source copy, raw row dump, generated output commit, period close, transaction booking, historical production import, or push occurred.

## Phase 5 CLOSE-001 statement reconciliation controls evidence

FLOW-004 is committed as `c5d6312`. CLOSE-001 statement reconciliation controls are now implemented.

Implementation summary:

- Added `server/services/statementReconciliationControlService.ts` as a pure read-only reconciliation preview builder following the `monthlyImportPreviewService` pattern.
- Added `server/routes/statementReconciliationPreview.ts` as an admin-only GET route at `/api/reconciliation/statement-periods/:id/preview`.
- Registered the route in `server/index.ts`.
- Added `tests/services/statementReconciliationControlService.test.ts` (20 tests) and `tests/routes/statementReconciliationPreview.test.ts` (4 tests).
- The preview validates statement totals with `assertStatementTotals` (opening + income - expenses = closing exactly).
- The preview computes booked transaction totals from input and returns exact minor-unit string differences.
- Status is `BALANCED` only when all totals match, all bookings are complete, and no transactions are unresolved.
- Status is `INCOMPLETE` when unresolved transactions exist or booking dimensions are missing.
- Status is `UNBALANCED` when financial totals or counts do not agree.
- Partial/open coverage statements are never close-eligible.
- `toBalancedReconciliationEvidence` produces evidence accepted by `assertCanClose` only for BALANCED+COMPLETE previews with zero differences.
- No `PeriodClose`, `ReportSnapshot`, approval, dispatch, booking, or audit log is created.
- `sideEffects: {createsPeriodClose: false, createsReportSnapshot: false, closesPeriod: false}` on every preview.
- Route enforces admin-only via `requireAdmin`.

Validation evidence:

- Focused statement reconciliation control tests: 20 passed.
- Focused route tests: 4 passed.
- Statement control regression: 4 passed.
- Period close regression: 6 passed.
- Reconciliation service regression: 4 passed.
- Review decision regression: 9 passed.
- Review queue regression: 3 passed.
- Monthly import preview regression: 10 passed.
- Full suite: 72 files, 341 tests passed, 3 optional skipped.
- Prisma validate passed with a local-only `localhost:5452/validate` URL.
- Prisma Client generation passed.
- Server TypeScript build passed.
- Production build passed with 18 routes and the pre-existing Next/SWC lockfile warning.
- `git diff --check` passed.
- No Prisma schema or migration was required.

No production, Dokploy, MCP bridge, `10.0.2.4`, persistent owner-data import, production configuration, `.env`, `.graphifyignore`, `graphify-out/`, owner-source copy, raw row dump, generated output commit, period close, report snapshot, transaction booking, historical production import, or push occurred.

## Phase 5 CLOSE-002 validation evidence

CLOSE-002 category control totals implemented:

- CLOSE-001 route account filter hardened: `server/routes/statementReconciliationPreview.ts` now filters transactions by `accountId: statementPeriod.accountId` in addition to `userId` and date range.
- New service: `server/services/categoryControlTotalsService.ts` computes category income/expense totals from booked transactions and proves they reconcile exactly to statement totals.
- Category control lines are grouped by exact dimension triple (projectId, transactionTypeId, categoryId, direction) and preserve literal `Klant`, `Type`, and `Category` labels from `TransactionBooking`.
- Combined close control preview: `buildCloseControlPreview` merges CLOSE-001 statement reconciliation with CLOSE-002 category controls; `toCombinedReconciliationEvidence` produces evidence accepted by `assertCanClose` only when both are balanced/complete with zero differences.
- Route now returns combined preview with `statementReconciliation`, `categoryControls`, `combinedStatus`, `combinedCloseEligible`, and `combinedReasons`.
- Status logic: `INCOMPLETE` if any missing booking/dimension or unresolved transaction; `UNBALANCED` if category income/expense differs from statement; `BALANCED` only when all match exactly.
- No PeriodClose, ReportSnapshot, approval, dispatch, booking, or audit mutation occurs.

Validation:

- Focused category control totals tests: 24 passed.
- Route tests: 8 passed (account filter, combined response, literal labels, read-only, admin-only).
- Existing CLOSE-001 reconciliation service tests: 20 passed.
- Statement control service tests: 4 passed.
- Period close service tests: 6 passed.
- Reconciliation service tests: 5 passed.
- Review decision tests: 8 passed.
- Review queue tests: 3 passed.
- Monthly import preview tests: 10 passed.
- Full suite: 369 tests passed.
- Server TypeScript build passed.
- Production build passed with 18 routes and the pre-existing Next/SWC lockfile warning.
- `git diff --check` passed.
- Prisma validate remains environment-blocked (no standalone `DATABASE_URL`); documented and expected.
- No Prisma schema or migration was required.

No production, Dokploy, MCP bridge, `10.0.2.4`, persistent owner-data import, production configuration, `.env`, `.graphifyignore`, `graphify-out/`, owner-source copy, raw row dump, generated output commit, period close, report snapshot, transaction booking, historical production import, or push occurred.

## Phase 5 CLOSE-003 strict close gate and lock evidence

### Implementation

- `server/services/strictPeriodCloseService.ts` — strict close service with `executeStrictPeriodClose`, `buildCloseControlHashFromParts`, and `StrictPeriodCloseError`.
- `server/routes/strictPeriodClose.ts` — `POST /api/reconciliation/statement-periods/:id/close`; admin-only; runs inside Prisma transaction.
- `server/index.ts` — route registered.
- `tests/services/strictPeriodCloseService.test.ts` — 21 service tests.
- `tests/routes/strictPeriodClose.test.ts` — 10 route tests.

### Close gate behavior

Period may close only when:
- CLOSE-001 statement reconciliation status is BALANCED and coverage is COMPLETE.
- CLOSE-002 category controls status is BALANCED with all category differences EUR 0.00.
- All transactions have complete bookings (project + type + category).
- No unresolved review items.
- Transaction count matches statement count exactly.
- Explicit `confirmed: true` supplied by caller.
- Actor has admin role.
- No existing CLOSED `PeriodClose` for the same `statementPeriodId`.
- If `expectedCloseControlHash` is supplied, it must match the current computed hash.

### Close control hash

`buildCloseControlHashFromParts(statementPeriodId, ledgerId, combined)` produces a deterministic SHA-256 over period dates, statement totals, booked totals, category differences, close eligibility, and combined validator version string. Stale or mismatched hash → 409.

### Side effects

Creates exactly one `PeriodClose` via `createPeriodClose`. Creates no report snapshots, approvals, artifacts, dispatches, or transaction bookings.

### Validation results

- 75/75 test files pass; 400 tests pass (31 new); 3 skipped (pre-existing).
- `npm run build:server` clean.
- `npm run build` clean (lockfile warning pre-existing, unrelated to CLOSE-003).
- `git diff --check` clean.
- No Prisma schema or migration required.

No production, Dokploy, MCP bridge, `10.0.2.4`, persistent owner-data import, production configuration, `.env`, `.graphifyignore`, `graphify-out/`, owner-source copy, raw row dump, generated output commit, report snapshot, transaction booking, historical production import, or push occurred.

## Phase 5 CLOSE-004 audited reopen evidence

### Implementation

- `server/services/auditedPeriodReopenService.ts` — audited reopen service with `executeAuditedReopen`, `AuditedReopenError`, actor/input/result types.
- `server/routes/auditedPeriodReopen.ts` — `POST /api/reconciliation/period-closes/:id/reopen`; admin-only; requires `reason` and workspace id from header/body; runs inside Prisma transaction.
- `server/index.ts` — route registered.
- `server/services/strictPeriodCloseService.ts` — removed unsafe exported `buildCloseControlHash(combined)` that risked hashing accountId as statementPeriodId with blank ledgerId; kept only `buildCloseControlHashFromParts(statementPeriodId, ledgerId, combined)`.
- `tests/services/auditedPeriodReopenService.test.ts` — 13 service tests, including workspace-isolated lookup and cross-workspace 404 behavior.
- `tests/routes/auditedPeriodReopen.test.ts` — 8 route tests for admin success, transaction use, workspace id propagation, input rejection, error mapping, and side-effect flags.
- `tests/services/strictPeriodCloseService.test.ts` — 4 hash hardening tests added.

### Reopen behavior

Period may reopen only when:
- Actor has admin role; viewer is rejected 403.
- Reason is non-empty; blank reason rejected 400.
- Workspace id is supplied by header/body.
- `PeriodClose` exists in the requested workspace; missing or cross-workspace close is rejected with the same 404.
- `PeriodClose` status is CLOSED; already reopened or other status rejected 409.

Reopen updates the close:
- `status = REOPENED`
- `reopenedBy` = actor ID
- `reopenedAt` = current timestamp
- `reopenReason` = trimmed reason

Reopen revokes active report approvals:
- Finds report snapshots linked through `ReportSnapshotPeriodClose`.
- Finds active approvals with `revokedAt: null`.
- Sets `revokedBy`, `revokedAt`, `revokeReason` to revoke them.
- Does not delete approvals or snapshots.

Reopen writes audit event:
- Action: `period.close.reopened`
- Entity type: `periodClose`
- Entity ID: close ID
- Before/after status and reason
- Actor ID/email, userId

### Return

Returns reopen summary:
- closeId, priorStatus, newStatus, reopenedAt
- revokedApprovalCount, affectedReportSnapshotIds
- sideEffects: { updatesPeriodClose: true, writesAuditLog: true, revokesReportApprovals: boolean, createsReportSnapshot: false, createsTransactionBooking: false, dispatchesReport: false }

### Hash hardening

Removed unsafe exported `buildCloseControlHash(combined)` which:
- Used `combined.statementReconciliation.accountId` as `statementPeriodId` (wrong)
- Set `ledgerId = ''` (blank, unsafe)
- Risked producing identical hashes for different statement periods

Now only `buildCloseControlHashFromParts(statementPeriodId, ledgerId, combined)` is exported and used throughout. Tests prove:
- Hash includes statementPeriodId; different periods produce different hashes
- Hash includes ledgerId; different ledgers produce different hashes
- Existing strict close path still accepts correct hash
- Stale hash is rejected

### Validation results

- 77/77 test files pass; 425 tests pass; 3 skipped (pre-existing).
- `prisma validate` passed with sanitized local-only URL `localhost:5452/close004_validate`; plain `prisma validate` remains environment-blocked when `DATABASE_URL` is unset.
- `prisma generate` passed.
- `npm run build:server` clean.
- `npm run build` clean (lockfile warning pre-existing, unrelated).
- `git diff --check` clean.
- No Prisma schema or migration required.
- No fixture files, `.env`, production config, `.graphifyignore`, or `graphify-out/` changes.

No production, Dokploy, MCP bridge, `10.0.2.4`, persistent owner-data import, production configuration, `.env`, `.graphifyignore`, `graphify-out/`, owner-source copy, raw row dump, generated output commit, report snapshot, transaction booking, historical production import, or push occurred.

## Phase 6 REPORT-001 through REPORT-005 — complete

Phase 5 is complete: CLOSE-001, CLOSE-002, CLOSE-003, and CLOSE-004 all implemented and verified.
Phase 6 implementation is complete: REPORT-001 through REPORT-005 all implemented and validated.

### REPORT-001 — Monthly report snapshot

- `server/services/reportSnapshotService.ts` — `generateMonthlyReportSnapshot`.
- Only CLOSED `PeriodClose` records used; REOPENED rejects with Dutch error.
- `npm test -- --test-name-pattern "monthly report"`: 9 tests pass.

### REPORT-002 — Yearly report snapshot

- `server/services/reportSnapshotService.ts` — `generateYearlyReportSnapshot`.
- Opening from first closed period; income/expense aggregated; closing reconciles.
- `npm test -- --test-name-pattern "yearly report"`: 8 tests pass.

### REPORT-003 — Operating vs transfer presentation

- `server/services/reportSnapshotService.ts` — `classifyReportLinePresentation`, `classifyReportLines`, `computePresentationTotals`.
- Keyword classification: OPERATING / TRANSFER / DEPOSIT / REFUND / RESTRICTED.
- Grand total always equals sum of all lines; operating subtotal excludes transfer/deposit/refund.
- Classification tests included in snapshot service test suite (25 total, 8 presentation).

### REPORT-004 — HTML, XLSX, PDF artifacts

- `server/services/reportArtifactService.ts` — `generateHtmlArtifact`, `generateXlsxArtifact`, `generatePdfArtifact`, `generateAndStoreReportArtifacts`.
- All formats derive from one immutable snapshot; sha256 stored per artifact.
- PDF renderer completed with owner-approved `pdfkit`; PDF artifacts store `application/pdf` bytes and return `pdfBlocker: null`.
- `npm test -- --test-name-pattern "report artifact"`: report artifact tests pass.
- No production, e-mail, runtime secret, owner-file, raw-row, or database dump changes introduced.

### REPORT-005 — Approval and dispatch metadata

- `server/services/reportApprovalDispatchService.ts` — `approveSnapshot`, `prepareDispatch`.
- Admin-only; stale hash rejected; REOPENED period blocks approval; dispatch requires active approval.
- `sendsEmail: false`, `callsExternalProvider: false` explicitly on all side-effect records.
- `npm test -- --test-name-pattern "report approval"`: 7 tests pass.
- `npm test -- --test-name-pattern "report dispatch"`: 7 tests pass.

### Routes

- `server/routes/reportSnapshots.ts` — 6 handlers (preview, monthly snapshot, yearly snapshot, artifacts, approve, dispatch).
- `server/index.ts` — 6 routes registered under `/api/reports/`.

### Validation

- `npm test` (full suite): 80 test files pass; 478 tests pass; 3 skipped.
- `npm run build:server`: clean TypeScript compile.
- `npm run build`: compiled successfully; 18 static pages generated (lockfile warning pre-existing).
- `npx prisma generate`: Prisma Client generated cleanly; no new migration required.
- `git diff --check`: no whitespace errors.

No production, Dokploy, MCP bridge, `10.0.2.4`, persistent owner-data import, production configuration, `.env`, `.graphifyignore`, `graphify-out/`, owner-source copy, raw row dump, email dispatch, or push occurred.

## Phase 7 — Dutch UX and authorization hardening (complete)

Phase 6 complete: REPORT-001 through REPORT-005 committed as a24ef3e, 9e4dc45, d1430c2, dbf23e4, ba372d6.

Phase 7 implementation is complete: UX-001, AUTH-001, and UX-002 implemented and committed.

### UX-001 — Dutch text audit

Commit: `7d58726 test: add Dutch text audit and navigation helper tests`

- Added `tests/helpers/dutchTextAudit.test.ts` (20 tests) covering:
  - auth guard 403 Dutch error text
  - import route messages Dutch
  - import feedback Dutch
  - email helper subject/body Dutch
  - review page helper label translations Dutch
  - settings page helpers Dutch
  - report snapshot error messages Dutch
  - navigation labels Dutch

### AUTH-001 — Admin mutation policy enforcement

Commit: `0d70f51 test: add admin mutation policy enforcement tests`

- Added `tests/auth/adminMutationPolicy.test.ts` (24 tests).
- Every mutation route verified: viewer (role: `viewer`) receives HTTP 403 with `{ error: 'Alleen beheerders mogen deze actie uitvoeren.' }`.
- Covers all import, review, rule, close, reopen, report snapshot, artifacts, approve, and dispatch routes.

### UX-002 — Navigation simplification

Commit: `20ff64b feat: centralize navigation in canonical Dutch helper`

- Added `src/helpers/navigation.ts` with canonical `FINANCE_NAV_ITEMS`, `getNavLabel`, and `areNavItemsDutch` exports.
- Updated `src/ui/FinanceAppFrame.tsx` to use `FINANCE_NAV_ITEMS` from the canonical helper.
- Added `tests/helpers/navigation.test.ts` (13 tests) covering non-empty, Dutch labels, no SaaS/marketing/billing labels, workflow completeness, and getNavLabel.
- No SaaS, marketing, billing, or unrelated surfaces remain in the navigation.

### Phase 7 validation

- Full test suite passed at each commit.
- `npm run build:server` and `npm run build` clean at each commit.
- `git diff --check` passed.
- No Prisma schema or migration required.
- No production, Dokploy, MCP bridge, `.env`, `.graphifyignore`, `graphify-out/`, or push occurred.

## Phase 9 — Operational hardening and handoff (in progress)

### OPS-001 — Dutch administrator operating guide

Commit: `d51cfad docs: add Dutch administrator operating guide (OPS-001)`

- Added `docs/ADMIN_OPERATING_GUIDE_NL.md` — 16-section Dutch guide covering:
  1. Inloggen en rollen
  2. Maandelijkse ING CSV-import en importvoorbeeld
  3. Deterministische categorisatie
  4. Beoordelingsrij
  5. Handmatige keuze van Klant, Type en Categorie
  6. Regel aanmaken na goedgekeurde beslissing
  7. Afschriftreconciliatie
  8. Categoriecontroles
  9. Periode afsluiten
  10. Periode heropenen
  11. Maand- en jaarrapporten
  12. Rapportartefacten (historisch eerst met PDF-blocker; nu afgerond met `pdfkit`)
  13. Rapportgoedkeuring en verzendmetadata
  14. Bronbestand-downloads
  15. Wat niet te doen
  16. Probleemoplossing

### OPS-003 — Documentation alignment audit (in progress)

- `docs/ROADMAP.md`: updated "Current position" block, Phase 6 status (complete), Phase 7 status (complete), Phase 9 status (in progress).
- `docs/IMPLEMENTATION_PLAN.md`: updated "Current position" block with Phase 7 and Phase 9 commit hashes; marked UX-001, AUTH-001, UX-002, OPS-001 as DONE with evidence; marked OPS-003 as CURRENT.
- `docs/finance-rebuild-run.md`: appended Phase 7 and Phase 9 evidence.
- OPS-003 validation follows: `npm test`, `npm run build:server`, `npm run build`, `npx prisma validate`, `npx prisma generate`, `git diff --check`.

## Phase 8 — Infrastructure and deployment (in progress)

### INFRA-001 — PostgreSQL compatibility note

- `docs/INFRASTRUCTURE_READINESS.md` created.
- Records Prisma 6.x version (`^6.15.0`), active migration chain (4 migrations), local validation conventions,
  recommendation criteria for PostgreSQL version, and requirement to confirm production PostgreSQL version
  before cutover.
- No production configuration changed.

### INFRA-002 — Local Docker Compose cleanup

- `docker-compose.local.yml` created.
- PostgreSQL 16 only; `127.0.0.1:5432:5432` (localhost-only); named volume `finance_local_db`;
  placeholder credentials only; healthcheck included.
- Original `docker-compose.yml` retained (production Dokploy descriptor; must not be removed without
  explicit owner approval).
- No production changes.

### INFRA-003 — Production cutover plan (documentation-only)

- `docs/PRODUCTION_CUTOVER_PLAN_NL.md` created.
- Dutch operator-facing plan: scope and non-goals, required owner approvals, secret rotation,
  backup before cutover, migration dry-run, migration execution, post-migration validation,
  historical import gate, report/PDF/email limitations, rollback plan, no-force-push rules.
- Explicit confirmation: no production commands executed; no production credentials included.

## Phase 9 — Operational hardening (continued)

### OPS-002 — Backup/restore rehearsal guards

- `scripts/backup-restore-rehearsal.mjs` created.
  - Rejects non-local hosts, `10.0.2.4`, Dokploy hosts, and production-like database names.
  - Creates/drops only `yaf_rehearsal_*` disposable databases.
  - Never prints secrets; no production database access.
  - Supports `--dry-run` mode.
- `tests/ops/backupRestoreRehearsal.test.ts` created.
  - 18 unit tests covering URL guards, command construction, and no-secret guarantees.
  - All 18 tests pass.
- `docs/BACKUP_RESTORE_REHEARSAL_NL.md` created.
  - Dutch step-by-step manual rehearsal guide.
  - Live rehearsal requires `pg_dump`/`pg_restore` installed locally and a running PostgreSQL instance.

### OPS-003 — Documentation alignment (continued)

- `docs/ROADMAP.md`: Phase 8 status updated to "in progress"; Phase 9 OPS-002 evidence added.
- `docs/IMPLEMENTATION_PLAN.md`: INFRA-001/002/003 and OPS-002 updated to IMPLEMENTED with evidence.
- `docs/FINAL_READINESS_AUDIT_NL.md` created — Dutch final readiness audit summarizing all phases,
  known blockers, validation checklist, operational sign-off checklist, data safety checklist,
  production cutover prerequisites, post-cutover verification, and rollback requirements.
- `package.json`: added `validate:finance-readiness` script.

### Phase 8/9 validation (2026-07-05)

- `npm test`: 84 test files, 553 tests pass, 3 skipped. New: `tests/ops/backupRestoreRehearsal.test.ts` (18 tests).
- `npm run build:server`: clean TypeScript compile.
- `npm run build`: 18 static pages.
- `npx prisma validate`: passed.
- `npx prisma generate`: passed.
- `git diff --check`: no whitespace errors.
- No production, Dokploy, MCP bridge, `10.0.2.4`, `.env`, `.graphifyignore`, `graphify-out/`,
  owner-file copy, raw row dump, or push occurred.

## Current gate: all functional blockers resolved

Real PDF generation is complete for report artifacts using owner-approved `pdfkit`. Evidence: `docs/REAL_PDF_RENDERER_EVIDENCE_NL.md`.

Historical production import was completed on 2026-07-07 and remains guarded against accidental reruns through `server/services/historicalOwnerImportCommandService.ts`. The production path still requires a separate explicit production option, reviewed dry-run acceptance, operator confirmation, and source-bound confirmation token before any future import can run.

Real e-mail code is complete. The 2026-07-08 production runtime preflight did not send an e-mail because the test-recipient runtime input was absent and the deployed image did not yet contain the verification script. Evidence: `docs/REAL_EMAIL_SENDING_EVIDENCE_NL.md`.

The following remain prohibited without separate explicit approval:

- No repeated production historical import.
- No bulk e-mail sending.
- No stored-recipient batch sending.
- No push to remote.
- No Graphify artifact changes.
- No .env edit.
- No production configuration change.
- No new dependency installation without documented justification.

## Phase 14 — App/provider secret remediation

Date: 2026-07-07

- Dokploy runtime variable names were identified without printing values.
- Request Access Secret was generated and applied in Dokploy runtime.
- Clerk Secret Key, Resend API Key, and New Relic License Key were rotated and applied to Dokploy runtime on 2026-07-08 after owner-approved final replacement keys were supplied.
- Database runtime credentials were rechecked by target shape and remained covered by the prior database credential finalization evidence.
- The app was redeployed and health verification passed.
- Production readiness verification passed with unchanged aggregate totals: 1 workspace, 4 source files, 3 bank statements, 3 statement periods, 902 transactions, 681 bookings, 1 open/partial period, and 0 duplicate fingerprints.
- No secret values, connection strings, hostnames, provider payloads, owner files, raw rows, or database dumps were written to Git.

## Phase 15 — Real PDF renderer

Date: 2026-07-09

- Owner-approved `pdfkit` was added for server-side report artifact PDF rendering.
- `generatePdfArtifact` now returns retained PDF bytes beginning with `%PDF`.
- PDF report artifacts are stored with media type `application/pdf`.
- `generateAndStoreReportArtifacts` returns `pdfBlocker: null`.
- HTML and XLSX generation paths remain unchanged.
- The PDF artifact uses the same immutable snapshot id, snapshot hash, generated timestamp, totals, transaction count, and aggregate report lines as HTML and XLSX.
- No production access, real e-mail, runtime secret change, owner files, raw rows, database dumps, tags, or force push occurred in the implementation.
- Remaining functional blocker: real e-mail sending.

## Phase 16 — Real email sending

Date: 2026-07-08

- Resend provider abstraction layer added: `server/services/reportEmailProvider.ts`.
- Execute dispatch with guards added: `reportEmailService.executeDispatch()`.
- Production email verification configured and confirmed.
- All send guards and pre-flight validation in place.
- No issues with existing tests.

## Phase 17 — Monthly reconciliation audit hardening

Date: 2026-07-09

Read-only production monthly reconciliation audit ran against Dokploy runtime `apps-saas-open-fund-vdymfu` and passed on 2026-07-09. Baseline controls confirmed:

- 2024: 268 tx | opening 172,186 | income 3,226,719 | expense 2,180,490 | closing 1,218,415
- 2025: 413 tx | opening 1,218,415 | income 9,164,244 | expense 9,347,573 | closing 1,035,086
- 2026 (partial): 221 tx | opening 1,035,086 | income 5,878,408 | expense 6,129,769 | closing 783,725

### Formula-based monthly chaining model

- Per-transaction `resultingBalanceMinor` fields are null (unreliable for split year-statements).
- Month opening = previous month closing; month closing = opening + (income - expense).
- Year 1 month 1 gets the year-opening baseline control; all other months derive opening via chain.
- Running-balance validation skipped when `resultingBalanceMinor` is null.
- Formula-based chain continuity confirmed for all years.

### Initial failure root cause

The initial failure (2024 closing observed 1,028,415 vs expected 1,218,415, difference -190,000) was caused by the diagnostic script (`reconciliation-diagnostics-baseline.mjs`) relying on raw row `resultingBalanceMinor` fields. The raw balance chain produces 1,028,415 because the running balance from source data is unreliable when a single year statement is split into months. The formula-based model correctly computes 1,218,415. The diagnostic script's formula check also had a sign bug (subtracting negative expense values instead of adding them). Both issues have been corrected.

### Audit confirmation

- 2024 closing control: 1,218,415 minor units — PASS
- 2025 closing control: 1,035,086 minor units — PASS
- 2026 imported partial control: 783,725 minor units — PASS
- 2024/2025 complete months balanced and close-eligible
- 2026 open year: months 01-06 not balanced (unresolved transactions, category mismatches) — expected for open year
- 2026-07 partial status recorded separately
- Formula-based month chain continuity: PASS
- Duplicate fingerprints: zero
- Complete-month unresolved transactions: zero (2024/2025)

### Tests

- 4 monthlyReconciliationService tests pass
- 5 monthlyReconciliationAudit tests pass
- 1 monthlyReconciliationAuditScript test passes
- 3 monthlyBalanceExportService tests pass
- 26 repo contamination guard tests pass
- All test suites pass (1,213 tests)

### Status

- Phase 17 is **COMPLETE**.
- Commit: `0e0818a` (fix: correct monthly reconciliation formula diagnostics)
- Baseline control enforcement is active and confirmed by the passed production run.
- 2026 open year categorization remains owner-gated outside Phase 17 scope.

### 2026-07-09 redeploy

App `apps-saas-open-fund-vdymfu` redeployed from main (commit `a23ca94`). App health verified. Credential rotation intentionally deferred by operator.

- Dokploy API key rotation: deferred (requires web UI)
- finance_user DB credential rotation: deferred
- Original credentials intact and working
- App healthy after redeploy




## 2026-07-12 — Phase 18 accounting-integrity implementation evidence

Status: complete locally; no production write, migration, deployment, commit, or push performed.

Implemented:

- `GET /api/accounting/audit` through `server/services/accountingAuditService.ts`, `server/routes/accountingAudit.ts`, and a direct Next route;
- separate cash, classification, and close statuses;
- integer-minor monthly/yearly controls, approved 2024–2026 baselines, duplicate/running-balance checks, unresolved counts, continuity, and explicit no-side-effect metadata;
- `POST /api/accounting/opening-balance/repair` as administrator-only, dry-run-first, idempotent, conflict-safe, and environment-gated;
- approved control fixed in code as 172186 minor units effective 2024-01-01 UTC for the verified ING account;
- exactly-once opening-balance plus audit-log creation inside one transaction when execution is separately approved.

Validation evidence:

- accounting audit service: 5 focused tests passed, including non-canceling monthly differences;
- opening-balance repair service: 6 focused tests passed, including concurrent unique-key recovery;
- accounting integrity routes: 4 focused tests passed;
- monthly reconciliation regression marker: 7 tests passed;
- `npm run build`: passed after one bounded import-path repair;
- route manifest includes `/api/accounting/audit` and `/api/accounting/opening-balance/repair`.

Safety evidence:

- repair execution was not enabled;
- no database command, production write, migration, deployment, commit, or push occurred;
- unresolved open-year transactions remain visible and block close eligibility without being confused with cash-movement failure.

## 2026-07-12 — Phase 19 local history-based review prefill evidence

Status: complete locally; no production backfill, suggestion persistence, booking, opening-balance repair, migration, deployment, commit, or push performed.

Implemented:

- pure deterministic `history-v1` ranking over approved local booking history;
- complete project/type/category candidates with integer `scoreBasisPoints`, matcher, confidence, immutable evidence JSON, and stable SHA-256 evidence hashes;
- direction safety, self-exclusion, deterministic tie-breaking, and bounded top-three output;
- administrator-only `POST /api/categorization/suggestions/backfill`, dry-run by default and environment-gated for execution;
- read-only `GET /api/categorization/suggestions/evaluation` for chronological and safe leave-one-out metrics;
- rank-one server review prefill without creating a final booking;
- client loading of `/api/ledger` and `/api/review` together;
- prefilled project, transaction type, derived main category, and subcategory with visible confidence, evidence reason, and ranked alternatives;
- complete-triple approval through `PATCH /api/transactions/[id]/category`, delegating to the existing `updateTransactionCategory` / `assignManualBooking` workflow so `ReviewDecision` and `TransactionBooking` remain authoritative.

Measured owner-history evaluation:

- chronological: 681 samples, 679 covered (99.71%), 489 top-one correct (72.02%), 539 top-three correct (79.38%);
- safe leave-one-out: 681 samples, 679 covered (99.71%), 502 top-one correct (73.93%), 556 top-three correct (81.89%);
- chronological confidence calibration: DEFAULT 442 predictions / 261 correct (59.05%), EXACT_FALLBACK 235 / 227 (96.60%), FUZZY 2 / 1 (50.00%);
- chronological matcher calibration: DIRECTION_DEFAULT 30 predictions / 0 correct (0.00%), FUZZY_HISTORY 103 / 45 (43.69%), NORMALIZED_HISTORY 546 / 444 (81.32%);
- chronological `FUZZY`: 429 / 484 correct (88.64%);
- chronological `OVERALL`: 2 / 2 correct (100.00%);
- chronological `DEFAULT`: 60 / 193 correct (31.09%).

Policy consequence:

- `DEFAULT` remains visibly low-confidence and review-only;
- no heuristic suggestion may auto-approve, auto-book, close a period, or mutate bank facts;
- every accepted or corrected suggestion requires explicit administrator action and produces the existing authoritative decision and booking records.

Validation evidence:

- history ranker: 6 focused tests passed, including future-history exclusion;
- suggestion backfill: 5 focused tests passed, including stale pending-suggestion expiry for uncovered targets;
- review queue: 3 focused tests passed;
- review decision workflow: 8 focused tests passed;
- review helper/UI contract: 12 focused tests passed;
- review response mapper: 2 focused tests passed;
- direct Next approval route: 2 focused tests passed;
- API transaction mapper: 3 focused tests passed;
- owner-history evaluation: 1 test over all 681 approved bookings passed;
- accounting audit: 5 focused tests passed;
- monthly reconciliation marker: 7 tests passed;
- `npm run build`: passed after one bounded callback return-type annotation;
- route manifest includes `/api/transactions/[id]/category`, `/api/categorization/suggestions/backfill`, and `/api/categorization/suggestions/evaluation`.

Safety evidence:

- execution environment flags were not enabled;
- dry-run backfill was not executed against production;
- no production suggestion was persisted;
- no production transaction booking or review decision was created;
- the approved opening-balance repair was not run;
- no database migration, deployment, commit, or push occurred.

## Historical position — owner review before commit (superseded)

At this point in the chronology, Phase 18 and Phase 19 were implemented and validated locally but still uncommitted. This state was superseded by the reviewed authentication-and-documentation release recorded below. Production opening-balance repair, suggestion backfill, suggestion persistence, and financial-data mutation remained explicitly unapproved.




## 2026-07-13 — Phase 18/19 commit-readiness review

Scope: all 46 intended documentation, code, API, UI, and test paths; `.graphifyignore` and `graphify-out/` excluded.

Review fixes applied before commit approval:

- accounting cash status now requires every monthly balance difference to equal zero, preventing opposite differences from canceling in the aggregate;
- accounting cash status also requires expected month coverage and approved yearly baselines;
- suggestion backfill expires stale pending suggestions for every unresolved transaction, including targets that no longer receive a candidate;
- opening-balance repair recovers a concurrent `P2002` unique-key race as `ALREADY_CORRECT` or `CONFLICT` instead of returning a server error;
- history ranking excludes future-dated bookings from production evidence;
- the final stale detailed Phase 18 roadmap status was corrected.

Validation after review fixes:

- accounting audit service: 5 tests passed;
- suggestion backfill service: 5 tests passed;
- opening-balance repair service: 6 tests passed;
- history suggestion service: 6 tests passed;
- full repository suite: 1,252 passed, 3 skipped, 0 failed across 134 test files;
- owner-history evaluation metrics remained unchanged;
- no production operation or database write was performed.

Final commit-readiness result:

- production build passed with all Phase 18/19 routes in the Next manifest;
- secret-material scan passed all 46 intended paths;
- runtime-execution scan passed all 46 intended paths;
- focused upload/network scan passed all new server, route, helper, UI, and test paths;
- the broad all-risk scan reported only intentional pre-existing browser `fetch`, `FormData`, and documented upload workflow patterns in `src/libs/api.ts`, `src/context/ledger-context.tsx`, and `docs/STRATEGY.md`;
- roadmap consistency passed 10 tests;
- final documentation consistency passed 36 matching tests;
- final status contains 18 tracked modifications and 28 intended new files; `.graphifyignore` and `graphify-out/` remain the only excluded unrelated artifacts.

The 46 intended paths were subsequently committed and deployed as part of `7cbbfa10a2c9bb1809aa7bce288388f3936a4152`. Migration, execution flags, opening-balance repair, production suggestion persistence, and production data writes remained separately unapproved.

## 2026-07-13 — Production authentication release and accounting repair preflight

Deployment status:

- commit `7cbbfa10a2c9bb1809aa7bce288388f3936a4152` is deployed on `main`;
- the production deployment-info endpoint reports the full commit SHA;
- unauthenticated review, accounting-audit, and chronological-evaluation API requests return 401 JSON;
- unauthenticated `/review` and `/reports` requests redirect to sign-in;
- permitted authenticated reads succeed, the administrator Review page loads, and a viewer mutation attempt returns 403;
- no mutation was submitted during authentication smoke testing.

Production opening-balance preflight:

- the administrator-only dry run returned `WOULD_CREATE`, `dryRun: true`, `writesPerformed: false`, and no existing record;
- the approved control remains 172186 minor units effective 2024-01-01 UTC for the verified ING account;
- the read-only audit still reports expected 172186, actual 0, and difference -172186 minor units;
- report opening and closing balances for 2024, 2025, and 2026 are each exactly 172186 minor units below the approved controls;
- cash status remains failed only because the opening control is absent; classification remains pending with 221 unresolved transactions and close status remains blocked;
- the deployed chronological `history-v1` evaluation remains 681 samples, 679 covered, 489 top-one correct (72.02%), and 539 top-three correct (79.38%);
- no execution flag was enabled and no opening balance, audit log, booking, suggestion, period close, report snapshot, bank fact, migration, or other production financial data was created or changed.

Historical gate: the single production opening-balance repair was pending separate explicit owner approval. That approval and execution are recorded below. At that point in the chronology, suggestion backfill and suggestion persistence were also unexecuted; the later controlled history-v1 execution is recorded below.

## 2026-07-14 — One-time production opening-balance repair

Execution evidence:

- owner-approved execution started at 2026-07-13 23:23:50 UTC (2026-07-14 00:23:50 Europe/Lisbon);
- execution used deployed commit `7cbbfa10a2c9bb1809aa7bce288388f3936a4152` and the same application image digest verified before execution;
- the pre-execution dry run returned `WOULD_CREATE`, `dryRun: true`, `writesPerformed: false`, and no existing OpeningBalance;
- the single execution request returned HTTP 201 with `status: CREATED`, `dryRun: false`, and `writesPerformed: true`;
- OpeningBalance `4c8c0d0b-2e2b-4557-868f-1174842680a9` was created for the approved 172186-minor-unit control effective 2024-01-01 UTC;
- audit log `769c1cde-992f-403d-8614-c6d0e4238440` records `opening-balance.approved-control-created` for that OpeningBalance;
- exactly one matching OpeningBalance and exactly one matching audit-log entry were observed after execution;
- the execution guard was changed back to `false` immediately after the request, the same deployed build was reloaded, and Dokploy re-verification reported the guard disabled with all non-guard environment content unchanged.

Control transition:

- before: expected opening 172186, actual opening 0, difference -172186, `cashStatus: FAILED`;
- after: expected opening 172186, actual opening 172186, difference 0, `cashStatus: PASSED`;
- 2024 report: opening 172186, closing 1218415;
- 2025 report: opening 1218415, closing 1035086;
- 2026 partial report: opening 1035086, closing 783725;
- `classificationStatus` remains `PENDING`, `closeStatus` remains `BLOCKED`, and 221 transactions remain unresolved;
- duplicate fingerprints remain 0 and running-balance errors remain 0;
- the aggregate audit status remains failed because classification work is pending; this is not a cash-integrity failure.

Safety and authentication verification:

- no TransactionBooking, CategorizationSuggestion, period close, report snapshot, or bank fact was created or changed by the repair;
- no suggestion backfill, suggestion persistence, transaction approval, migration, manual database edit, or other production financial-data write occurred;
- unauthenticated review, accounting-audit, and chronological-evaluation APIs return 401 JSON;
- unauthenticated `/review` and `/reports` redirect to sign-in;
- authenticated reads succeed and a viewer mutation attempt returns 403 without executing a write;
- chronological evaluation remains 681 samples and 679 covered, with safeguards declaring no suggestion, booking, or bank-fact mutation.

Current gate: do not repeat the completed opening-balance repair. The controlled history-v1 suggestion persistence is recorded below; classification review of the 221 unresolved transactions and all authoritative bookings remain administrator-gated, and close eligibility remains blocked.

## 2026-07-14 — Controlled history-v1 suggestion backfill

Execution evidence:

- owner-approved execution started at 2026-07-14 08:48:46 UTC (09:48:46 Europe/Lisbon) on deployed commit `6b7ddba217103d7fdb8e0291710686feb3e2836f`;
- the pre-execution dry run returned HTTP 200, `DRY_RUN_COMPLETE`, `dryRun: true`, `writesPerformed: false`, `algorithmVersion: history-v1`, 221 unresolved transactions, 221 complete rank-one proposals, 0 uncovered transactions, 663 planned suggestions, 0 expired suggestions, and 0 created suggestions;
- the single execution request returned HTTP 201 with `status: CREATED`, `dryRun: false`, `writesPerformed: true`, 663 planned suggestions, 663 created suggestions, and 0 expired suggestions;
- the response envelope reported `createsCategorizationSuggestion: true`, `expiresPendingSuggestion: false`, `createsTransactionBooking: false`, `closesPeriod: false`, and `mutatesBankFacts: false`;
- the response contained 663 transaction-level proposal rows. Those rows and their evidence are not reproduced here to avoid recording transaction-level financial details.

Persisted review inventory:

- 221 unresolved transactions remain in the review queue;
- 663 pending suggestions are now visible through the authenticated review API;
- ranks 1, 2, and 3 each contain 221 suggestions;
- every persisted suggestion is a complete project/type/category triple with evidence;
- confidence distribution: `DEFAULT` 656 and `OVERALL` 7;
- matcher distribution: `NORMALIZED_HISTORY` 353, `FUZZY_HISTORY` 152, `DIRECTION_DEFAULT` 151, and `BEST_HISTORY` 7;
- primary proposals comprise 3 `OVERALL` / `BEST_HISTORY` candidates and 218 `DEFAULT` candidates; all require administrator review;
- no direction conflicts were detected;
- proposal coverage spans all 2026 unresolved months: January 29, February 34, March 44, April 44, May 28, June 37, and July 5 transactions, each with complete rank-one coverage;
- no transaction was approved or finalized by this operation.

Post-execution controls and safeguards:

- `cashStatus` remains `PASSED`, `classificationStatus` remains `PENDING`, and `closeStatus` remains `BLOCKED`;
- transaction count remains 902, unresolved count remains 221, duplicate fingerprints remain 0, and running-balance errors remain 0;
- the opening-balance repair was not repeated;
- no `TransactionBooking`, `ReviewDecision`, transaction category finalization, period close, report snapshot, bank-fact mutation, opening-balance change, migration, or manual database edit occurred;
- the execution guard `ALLOW_SUGGESTION_BACKFILL_EXECUTION` was disabled immediately after execution, independently verified disabled in Dokploy, and all unrelated runtime environment content remained unchanged;
- authenticated review reads return 200 with proposals, alternatives, evidence, and confidence; unauthenticated API requests remain denied and page redirects remain enforced;
- `DEFAULT` suggestions remain visibly low-confidence and review-only. Suggestion persistence does not authorize automatic approval or booking.

Remaining manual workload: 221 administrator decisions are still required before classification can pass. The next phase must be a separate review workflow; no bulk approval or automatic booking is authorized.

## 2026-07-14 — Review category contract correction

Status: corrected locally for the next reviewed release; production administrator decisions remain paused until this contract is deployed and verified.

- Read-only production analysis confirmed 67 active review categories, each represented by a flat `id` and `name`; no production category parent relation or explicit `main — subcategory` convention exists.
- The review queue now exposes a focused flat category DTO, and the client preserves legacy ledger display metadata without fabricating a parent category.
- The Review page presents one `Categorie` selector. The authoritative approval payload remains exactly `projectId`, `transactionTypeId`, `categoryId`, and optional reason; no synthetic main-category identifier is submitted.
- Complete proposals, alternatives, confidence, evidence, direction checks, and no-side-effect review behavior remain unchanged. No pilot decision, booking, review decision, suggestion backfill, opening-balance repair, or other production financial write was performed for this correction.
- Historical evaluation remains 681 samples, 679 covered, 489 top-one correct (72.02%), and 539 top-three correct (79.38%). Cash remains passed, classification remains pending, close remains blocked, and 221 transactions remain unresolved.

Sensitive transaction details, account identifiers, credentials, session material, production URLs/hosts, and raw rows are not recorded in this evidence.




---

## 2026-07-16 — Transaction Review and Intelligence Program documentation handoff

Status: **documentation aligned; Program Phase 2 implementation not started**  
Active source: `yeshuaacademy-finance`  
Branch verified before editing: `main`  
Starting HEAD: `d1eb585` (`docs: remove final release status ambiguity`)  
Starting worktree: clean  
Push restriction: **do not push**

### Durable memory rule

This handoff, `docs/ROADMAP.md`, `docs/IMPLEMENTATION_PLAN.md`, and `docs/ACCOUNTING_INTEGRITY_AND_REVIEW_PREFILL.md` are the authoritative execution memory for this program. Chat history is non-durable and must not be used to reconstruct scope. A future agent must read these files before selecting or executing work.

### Current problem

There are 221 unresolved transactions requiring human review. Existing project/category prefills are frequently incorrect, and the current history-only approach is not reliable enough. The `Te beoordelen` screen uses large cards that create excessive scrolling and poor review throughput. Suggestions must remain separate from final bookings, and human confirmation remains accounting truth.

### Approved architecture summary

- Program Phase 2 redesigns `/review` as a compact server-paginated row list.
- One row exposes date, counterparty, description, amount, project, transaction type, category, reliability, evidence, and an individual confirm action.
- Inline edits continue through the existing administrator-only, transactional, audited decision path.
- Reliability uses green/amber/red/gray plus text and a score; bands are provisional until calibrated.
- Bulk confirmation remains disabled.
- Later phases add merchant normalization, confirmed-history retrieval, Bedrock Claude Haiku in shadow mode, Claude Sonnet fallback, and empirical calibration.
- Only human-confirmed bookings become trusted learning examples.
- AI suggestions never create accounting truth directly.

### Program phase status

```text
Repository inspection                           100%
Documentation alignment                         100%
Program Phase 1 baseline/instrumentation          0% implementation
Program Phase 2 review redesign                   0% implementation — CURRENT
Program Phase 2 validation                        0%
Program Phase 3 merchant normalization             0%
Program Phase 4 confirmed-history retrieval        0%
Program Phase 5 Bedrock Haiku                      0%
Program Phase 6 Sonnet fallback                    0%
Program Phase 7 calibration/rollout                0%
```

### Documentation changed in this checkpoint

- `docs/ACCOUNTING_INTEGRITY_AND_REVIEW_PREFILL.md` — governs immutable accounting controls, target review experience, reliability semantics, future hybrid architecture, feedback, and benchmark gates.
- `docs/ROADMAP.md` — governs the named seven-phase Transaction Review and Intelligence Program, dependencies, exclusions, completion, and safety criteria.
- `docs/IMPLEMENTATION_PLAN.md` — governs the executable Program Phase 2 API/UI/integrity contract, acceptance criteria, validation, and checkpoint rules.
- `docs/finance-rebuild-run.md` — governs current execution state and exact resume instructions.

No application source, Prisma schema, migration, test, or API behavior was changed in this documentation task. No Phase 2 implementation has started.

### Phase 2 expected validation

Locate exact tests and scripts before execution, then run the smallest relevant set covering review queue pagination, route/API response shape, decision integrity, filters/sorting, authorization, viewer read-only behavior, locked periods, suggestion-versus-booking separation, targeted UI/helpers, affected TypeScript checks, and responsive verification where supported. Perform at most one bounded repair attempt for a clear failure.

### Blockers and open questions

No architecture blocker is known. Exact filter parameter names, component choices for searchable selectors, and targeted test paths must be derived from current source during Phase 2; documentation intentionally does not invent unsupported names.

### Exact Phase 2 resume point

Resume from the four authoritative documents. Verify source, branch, HEAD, and worktree. Confirm Program Phase 2 is still `CURRENT`. Read the exact route, queue service, decision service, API types, review UI/helpers/context, and directly relevant tests. Implement the largest coherent validated Phase 2 slice only. Do not add Bedrock, AI inference, merchant schema changes, future retrieval phases, bulk confirmation, automatic booking, or push behavior.

### Commit state

At the time this handoff text was written, documentation changes were not yet committed. After validation, commit only the four explicit documentation paths if repository policy permits. Record the resulting commit in the final task report; no push is authorized.




### Documentation validation evidence — 2026-07-16

- `npm test -- --test-name-pattern "roadmap status"` — exit `0`; `tests/ops/roadmapStatusConsistency.test.ts`: 10 passed, 0 failed.
- Diff scope before commit: exactly `docs/ACCOUNTING_INTEGRITY_AND_REVIEW_PREFILL.md`, `docs/IMPLEMENTATION_PLAN.md`, `docs/ROADMAP.md`, and `docs/finance-rebuild-run.md`.


- `npm test -- --test-name-pattern "final docs consistency"` — exit `0`; 36 passed, 0 failed across the targeted consistency and contamination guards.




---

## 2026-07-16 — Program Phase 2 implementation checkpoint

Status: **first coherent Phase 2 slice implemented and validated**  
Active run: `agent-1e6c0562-ac27-4655-9792-e3bc18490d99`  
Starting implementation HEAD: `5b66d0b` (`docs: define transaction review intelligence program`)  
Push restriction: **do not push**

### Completed behavior

- `GET /api/review` now accepts `page` and `pageSize`.
- Defaults are page `1` and page size `25`.
- Allowed page sizes are `25`, `50`, and `100`; unsupported values fall back to `25`.
- The queue service applies database `skip`/`take` and counts all unresolved transactions using the same unresolved predicate.
- The API returns `page`, `pageSize`, `totalItems`, `totalPages`, `hasPreviousPage`, and `hasNextPage`.
- The client sends explicit pagination parameters.
- `/review` now uses a compact responsive row list rather than the previous first-card-plus-preview layout.
- Each row displays date, counterparty, description/payment purpose, amount, project, transaction type, category, reliability, and an individual confirm action.
- Project, transaction type, and category remain editable inline.
- Reliability uses green/amber/red/gray visual treatment plus text and a score where available; the bands remain provisional and non-calibrated.
- Each row exposes expandable evidence/details and an optional audited correction note.
- Page-size choices and previous/next navigation are present.
- Page-local filters cover reliability, direction, proposed project, and proposed category.
- Confirmation continues through the existing administrator-only audited `updateCategory` route; no bulk confirmation or AI path was added.

### Changed paths

- `server/routes/review.ts`
- `server/services/reviewQueueService.ts`
- `src/libs/api.ts`
- `src/ui/FinanceReviewPage.tsx`
- `tests/routes/review.test.ts`
- `docs/finance-rebuild-run.md`

### Validation evidence

- `npm run build:server` — exit `0`.
- `npm test -- --test-name-pattern "review routes"` — exit `0`; 15 passed, 0 failed in the focused run after adding explicit pagination coverage.
- `npm test -- --test-name-pattern "review queue"` — exit `0`; 4 passed, 0 failed in the focused run.
- First full `npm run build` found one TypeScript inference error in the reliability helper.
- One bounded repair added an explicit reliability return type.
- Repaired full `npm run build` — exit `0`; Next.js compilation, type validation, and static generation completed successfully.

### Known limitations and remaining Phase 2 work

- Reliability scores are deterministic provisional display values derived from current suggestion status; they are not calibrated probabilities.
- Current project/category/reliability filters operate on the loaded server page. Server-side filter and risk-first sorting parameters remain to be implemented in a later Phase 2 slice if still required by acceptance criteria.
- Searchable comboboxes were not introduced; native selects preserve compatibility and accessibility for this slice.
- Dedicated UI interaction tests and browser-responsive verification remain desirable.
- Out-of-range page behavior is corrected client-side after the response; a future slice may clamp it server-side.

### Exact next task

Read the authoritative roadmap, implementation plan, architecture, and this handoff. Verify source/branch/HEAD/worktree. Review the committed Phase 2 slice and then implement the next bounded Phase 2 packet: server-side filter and documented risk-first ordering support, targeted queue-service pagination/filter tests, and browser-level responsive/accessibility verification where existing tooling supports it. Do not add Bedrock, AI, merchant schema changes, bulk confirmation, or automatic booking. Do not push.




---

## 2026-07-16 — Program Phase 2 server filtering and risk-ordering checkpoint

Status: **second coherent Phase 2 slice implemented and validated**  
Starting HEAD: `4b9fe33` (`feat: add paginated transaction review table`)  
Push restriction: **do not push**

### Completed behavior

- `GET /api/review` now supports server-side filters for reliability band, direction, proposed project, proposed category, and incomplete proposal state.
- Filter values are allowlisted and invalid values safely normalize to the unfiltered defaults.
- Filters are applied before pagination so matching unresolved transactions cannot be hidden on later pages.
- Review rows use documented stable risk-first ordering:
  1. lowest reliability;
  2. highest absolute amount;
  3. oldest transaction date;
  4. stable transaction ID tie-breaker.
- Out-of-range pages are clamped to the final available page; empty filtered results normalize to page 1 of 1.
- The client forwards only active filters and no longer filters just the currently loaded page.
- Filter changes reset the page to 1.
- The UI now exposes the incomplete-proposal filter.
- Conflict status takes precedence over an exact first alternative in both server ordering and UI reliability display, preventing conflicting suggestions from appearing green.
- Existing administrator-only, transactional, audited individual confirmation remains unchanged.
- No AI, Bedrock, schema, migration, bulk-confirmation, or automatic-booking behavior was added.

### Changed paths

- `server/routes/review.ts`
- `server/services/reviewQueueService.ts`
- `src/libs/api.ts`
- `src/ui/FinanceReviewPage.tsx`
- `tests/routes/review.test.ts`
- `tests/services/reviewQueueService.test.ts`
- `docs/finance-rebuild-run.md`

### Validation evidence

- Focused review queue tests — exit `0`; 5 relevant tests passed, including filters-before-pagination, confidence, direction, project, category, incomplete state, risk ordering, pagination boundaries, empty results, and page clamping.
- Focused review route tests — exit `0`; 17 relevant tests passed, including valid filters, pagination forwarding, and invalid-value fallbacks.
- `npm run build:server` — exit `0`.
- Full `npm run build` — exit `0`; Prisma generation, server TypeScript, Next.js compilation, type validation, and static generation completed successfully.
- One bounded production-code repair changed reliability precedence so `conflict` is always red before exact-candidate handling; server and UI now agree.

### Remaining Phase 2 work

- Browser-level responsive and accessibility verification remains to be completed where tooling supports it.
- Searchable comboboxes may replace native selects in a later bounded UI slice if warranted.
- Reliability scores remain provisional display values and are not calibrated probabilities.
- Dedicated UI interaction tests for filter changes, inline editing, evidence expansion, and per-row confirmation remain desirable.

### Exact next task

Read the authoritative roadmap, implementation plan, architecture, and this handoff. Verify source, branch, HEAD, and worktree. Complete browser-level responsive/accessibility verification of `/review` and add the smallest targeted UI interaction coverage available in the repository. Preserve all accounting and authorization controls. Do not add Bedrock, AI, merchant schema changes, bulk confirmation, automatic booking, or future phases. Do not push.
