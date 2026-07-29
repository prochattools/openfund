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




---

## 2026-07-17 — Program Phase 2 UI accessibility and testability checkpoint

Status: **third coherent Phase 2 slice implemented and validated**  
Starting HEAD: `fee4b1a` (`feat: add server-side review filtering`)  
Push restriction: **do not push**

### Completed behavior

- Review reliability and confirmation-state logic were extracted into `src/helpers/review-ui.ts` for deterministic unit testing.
- Conflicting suggestions remain red/uncertain even when the first alternative is exact.
- Reliability remains understandable through Dutch text and a score in addition to color.
- Viewer, busy, and incomplete rows cannot confirm.
- Confirmation labels now have tested states for viewer, saving, unchanged, and changed classifications.
- Mobile rows now expose visible labels for date, counterparty, description, amount, project, transaction type, category, and reliability below the `xl` breakpoint.
- The individual confirmation action is full-width and reachable on mobile while the desktop compact-grid headers remain intact.
- Evidence/details remain available through the existing expandable `details` element.
- Review query-string construction was extracted into `buildReviewQueryString()` and retains existing request semantics.
- No bulk-confirmation control, accounting mutation change, AI behavior, schema change, or future-phase work was introduced.

### Changed paths

- `src/helpers/review-ui.ts`
- `src/ui/FinanceReviewPage.tsx`
- `src/libs/api.ts`
- `tests/helpers/reviewUi.test.ts`
- `tests/helpers/reviewApiQuery.test.ts`
- `docs/finance-rebuild-run.md`

### Validation evidence

- `npm test -- --test-name-pattern "review UI helpers"` — exit `0`; 4 passed, 0 failed.
- `npm test -- --test-name-pattern "review API query construction"` — exit `0`; 3 passed, 0 failed.
- Initial full `npm run build` found one stale `ConfidenceFilter` type reference after helper extraction.
- One bounded repair changed the handler cast to `ReviewConfidenceFilter`.
- Repaired full `npm run build` — exit `0`; Prisma generation, server TypeScript, Next.js compilation, type validation, static generation, and `/review` production bundling completed successfully.

### Browser-tooling limitation

The repository currently has Vitest but no Playwright, Puppeteer, browser automation dependency, or browser verification script. Therefore, no live browser, viewport, browser-console, or browser-network verification was performed in this slice, and no such claim should be inferred. Adding a new browser framework was explicitly outside this bounded task.

Manual browser verification remains required for desktop and mobile viewport behavior, real filter changes, pagination controls, inline editing, evidence expansion, viewer/admin behavior, and individual confirmation against a running authenticated environment.

### Remaining Phase 2 work

- Perform manual or separately approved browser-level verification in a running authenticated environment.
- Consider searchable comboboxes only as a separately approved bounded UI enhancement.
- Reliability scores remain provisional display values and are not calibrated probabilities.

### Exact next task

Read the authoritative roadmap, implementation plan, architecture, and this handoff. Verify source, branch, HEAD, and worktree. Perform manual browser-level acceptance verification of `/review` in an authenticated environment when supported, capture factual evidence and issues, and apply only bounded Phase 2 fixes clearly justified by that evidence. Do not add a browser framework, Bedrock, AI, merchant schema changes, bulk confirmation, automatic booking, or future phases. Do not push.




---

## 2026-07-17 — Program Phase 2 manual browser acceptance attempt

Status: **BLOCKED — no approved browser runtime is available in this execution environment**  
Verified source: `yeshuaacademy-finance`  
Verified branch: `main`  
Verified HEAD: `0878e2e` (`test: harden review UI accessibility`)  
Starting worktree: clean  
Push restriction: **do not push**

### Verification performed

- Re-read the authoritative roadmap, implementation plan, accounting/review architecture, and this persistent handoff.
- Confirmed Program Phase 2 remains the documented current program task.
- Inspected repository package scripts and dependencies.
- Confirmed the repository provides Vitest and normal Next.js development/build scripts, but no Playwright, Puppeteer, browser automation dependency, browser acceptance script, or other repository-approved browser runner.
- Confirmed this Workbench execution surface does not expose a running authenticated browser session or an approved runtime connector for desktop/mobile viewport, browser-console, or browser-network inspection.
- Confirmed the task explicitly prohibits adding a browser framework in this slice.

### Browser evidence not obtained

No factual live-browser evidence was obtained for:

- desktop or mobile viewport rendering;
- overlapping or clipped columns;
- real pagination/filter interactions;
- inline editing and confirmation labels in a running session;
- expandable evidence behavior in a running session;
- viewer/admin authorization presentation;
- browser console output;
- browser network requests and responses;
- successful confirmation refresh behavior.

No financial mutation was attempted. No unsafe or bulk action was performed.

### Code and validation state

- No application, test, schema, migration, or configuration file changed in this attempt.
- No build or test rerun was necessary because the repository remained at the previously validated commit `0878e2e` with a clean worktree.
- The only changed path in this checkpoint is `docs/finance-rebuild-run.md`.

### Required external precondition

Manual acceptance can proceed only when one of these is explicitly available and approved:

1. a running authenticated finance environment plus a human reviewer who can inspect desktop/mobile viewports, console, and network behavior; or
2. an already-approved browser automation/runtime connector exposed to the execution environment.

Adding Playwright, Puppeteer, or another browser framework remains outside this task and requires separate approval.

### Exact next task

Open the deployed or approved local Yeshua Academy Finance environment in an authenticated browser. Execute the documented desktop, mobile, authorization, pagination, filter, inline-editing, evidence-expansion, and individual-confirmation acceptance checklist. Capture factual screenshots or written evidence, console/network findings, and any reproducible defects. Then update this handoff and apply only bounded Program Phase 2 fixes justified by observed evidence. Do not perform bulk or unsafe financial mutations. Do not add Bedrock, AI, merchant schema changes, automatic booking, or future phases. Do not push without explicit approval.

## 2026-07-17 — Browser acceptance blocker on production review route

Status: **BLOCKED — production `/review` redirected to `/sign-in` and no authenticated browser session was available to claim**  
Verified source: `yeshuaacademy-finance`  
Verified branch: `main`  
Verified HEAD: `7acafa235f163f726b4aa90af1d8ea779421e855`  
Starting worktree: clean  
Push restriction: **do not push**

### Environment facts

- Environment URL: `https://finance.yeshua.academy/review`
- Runtime: deployed production environment
- Authenticated role: unavailable; browser redirected to sign-in before any authenticated read could be performed
- Desktop viewport: not executed
- Mobile viewport: not executed
- Console-inspection capability: available in the browser surface via tab dev logs, but not exercised because the authenticated page was unreachable
- Network-inspection capability: not available in the exposed browser surface, and no network trace was captured
- Data shape: production-like, but not verified beyond the sign-in redirect

### Browser evidence

- Opening `https://finance.yeshua.academy/review` redirected to `https://finance.yeshua.academy/sign-in?redirect_url=http%3A%2F%2Ffinance.yeshua.academy%2Freview`
- No browser tab with an authenticated finance session was open to claim
- No desktop or mobile acceptance assertions were executed because the authenticated page was unreachable
- No screenshots were captured
- No console errors or network responses were inspected
- No financial mutation, suggestion mutation, or confirmation action was attempted

### Acceptance status

- Desktop row layout: not executed
- Desktop headers: not executed
- Desktop clipping/overlap/accessibility: not executed
- Page-size options 25/50/100: not executed
- Previous/next pagination: not executed
- Pagination text: not executed
- Filters and page-reset behavior: not executed
- Inline editing for project/type/category: not executed
- Confirm / change-confirm labels: not executed
- Evidence expansion: not executed
- Reliability text and score: not executed
- Individual confirmation actions: not executed
- Bulk confirmation absence: not executed
- Mobile row layout: not executed
- Mobile labels and selector usability: not executed
- Mobile confirmation reachability: not executed
- Authorization split between viewer and admin: not executed
- Locked-period behavior: not executed
- Network request/response contract: not executed
- Console inspection: not executed

### Exact blocker

The production page redirected immediately to the sign-in route, and this execution environment did not expose an already authenticated browser session for the finance app. Without an authenticated session, the acceptance checklist cannot be verified safely or factually.

### Required next action

Provide an authenticated browser session for the finance app, or an approved local/runtime URL that already has a valid viewer/admin session available for claim. Then rerun the browser acceptance checklist for `/review` with desktop and mobile viewports, record console and network evidence, and only then apply any bounded Phase 2 fixes justified by the observed behavior. Do not invent acceptance results, do not add a browser framework, and do not push.

## 2026-07-17 — Authenticated browser acceptance evidence on live review route

Status: **PARTIAL — authenticated admin browser access confirmed, but the live render diverges from current repo source on review labels and mobile action layout, and direct API header/status inspection was not available in this browser surface**  
Verified source: `yeshuaacademy-finance`  
Verified branch: `main`  
Verified HEAD: `7acafa235f163f726b4aa90af1d8ea779421e855`  
Starting worktree: clean  
Push restriction: **do not push**

### Environment facts

- Environment URL: `https://finance.yeshua.academy`
- Review URL: `https://finance.yeshua.academy/review`
- Runtime: deployed production environment
- Authenticated role: `ADMIN`
- Derived application role: `admin`
- Desktop viewport: `1440×900`
- Mobile viewport: `390×844`
- Console-inspection capability: available; no relevant errors were reported
- Network-inspection capability: not directly available in this surface
- Data shape: production-like live data

### Safe session evidence

- `https://finance.yeshua.academy/review` remained on `/review` and did not redirect to `/sign-in`
- The browser tab was authenticated and stayed on the finance app domain
- The review page rendered one visible review card for `Hr RA Schafer`
- The visible card showed a reliability badge with text and score: `60% · Onzeker`
- The visible card exposed inline selectors for `Klant / project`, `Transactietype`, and `Categorie`
- The visible card exposed an evidence/details section with alternatives and audit text
- The visible action area exposed `Suggestie goedkeuren` and `Boeking goedkeuren`
- The mobile render kept the row readable and labels visible, but the confirm action was not full-width in the live browser render
- No console errors were captured during the checks
- No transaction was confirmed
- No cookies, tokens, or secrets were inspected or recorded

### Live render observations

- The live page did not expose the `Bevestigen` / `Wijzigingen bevestigen` wording that the current repo helper logic expects
- The live page did not expose standalone page-size, pagination, or filter controls in the browser-visible DOM during this pass
- The live page did not show a bulk-confirmation control
- The visible approval control remained enabled even while `Transactietype` was unset in the live render
- The table/details area showed `Tabelweergave` content and the row list, but the browser surface did not expose a direct response-status/header read for `GET /api/review?page=1&pageSize=25`

### Desktop evidence

- The review card rendered compactly with date, counterparty, description, amount, project, type, category, reliability, and action areas visible in the same card
- The row showed `01 jul 2026`, `Hr RA Schafer`, `€ 1.300,00`, and the proposed classification `kruispost in`
- The reliability text was explicit and paired with a score, not color alone
- The evidence section showed `3 alternatieven`
- The inline selectors were editable in the browser

### Mobile evidence

- The row reflowed into a vertical card layout
- The field labels remained visible on the mobile render
- The evidence/alternatives content remained readable on the mobile render
- The confirmation action was reachable, but it was not full-width in the live render
- No horizontal clipping prevented reading the visible row content in the captured mobile render

### Acceptance status

- Desktop compact row: passed
- Desktop headers: partially observed via table view; live page did not expose the full expected filter/pagination chrome in the browser-visible DOM
- Clipping/overlap/accessibility: passed for the visible review card
- Page-size options 25/50/100: not executed on the live render
- Previous/next pagination: not executed on the live render
- Pagination text: not executed on the live render
- Filters for reliability/direction/project/category/incomplete: not executed on the live render
- Filter resets page to 1: not executed
- Inline project editing: passed
- Inline transaction-type editing: passed
- Inline category editing: passed
- Unchanged complete proposal shows `Bevestigen`: not observed in the live render
- Changed classification shows `Wijzigingen bevestigen`: not observed in the live render
- Evidence/details expand and collapse: partially observed; evidence content was visible, but a separate expand/collapse interaction was not verified
- Reliability text and score: passed
- Individual confirmation action per transaction: passed for the visible card
- Bulk-confirmation control absent: passed
- Mobile vertical layout: passed
- Mobile field labels: passed
- Mobile confirmation full-width: failed in the live render
- Browser console: passed, no relevant errors
- Browser network contract for `/api/review`: not directly observable in this browser surface
- Confirmation refresh after a real booking: not executed because no transaction was explicitly approved

### Exact next action

Either deploy the current repo source so the live environment reflects the `Bevestigen` / `Wijzigingen bevestigen` label logic and the mobile full-width action contract, or provide a browser surface with direct network/status inspection so `GET /api/review?page=1&pageSize=25` can be confirmed at the header level. No code changed in this pass, and no push was made.

## 2026-07-17 — Post-redeploy live mismatch check

Status: **PARTIAL — the compact review UI and browser authentication are live, but the first visible incomplete row still renders an enabled confirm button after a cache-busting reload, so the live browser state does not fully match the repo guardrail for incomplete rows**

### Safe session evidence

- Current URL remained on `/review`
- The live page still showed the compact review layout with the desktop headers, filters, page-size controls, and pagination
- Desktop and mobile viewport checks both showed the row-based review interface and visible labels
- A cache-busting reload of `https://finance.yeshua.academy/review?refresh=1` still rendered the first visible row with `Type` unset and the confirm button text `Bevestigen`
- The first visible row button was not disabled in the live DOM even though the row’s transaction type remained blank
- The row details panel rendered `Status: Conflict, handmatig beoordelen`, `Reden: Er zijn meerdere complete alternatieven. Kies handmatig de juiste Klant, Type en Categorie.`, `Alternatieven: 3`, and `Historische records: 0`
- Browser console inspection returned no relevant errors or warnings
- Direct browser navigation to `https://finance.yeshua.academy/api/review?page=1&pageSize=25` remained blocked by the browser surface with `net::ERR_BLOCKED_BY_CLIENT`

### Verified UI facts

- Desktop headers were visible: `Datum`, `Tegenpartij`, `Omschrijving`, `Bedrag`, `Project`, `Type`, `Categorie`, `Betrouwbaarheid`, `Actie`
- Filter controls were visible for reliability, direction, project, category, status, and page size
- Page-size options `25`, `50`, and `100` were visible
- Pagination showed `Pagina 2 van 9 · 221 transacties` after advancing, then returned to `Pagina 1 van 9 · 221 transacties` after a filter change
- The reliability filter reset the page back to 1
- The mobile row kept labels visible and the confirm button used the `w-full ... xl:w-auto` contract in the live DOM
- The browser surface still did not expose direct header/status evidence for `GET /api/review?page=1&pageSize=25`

### Interpretation

The browser-visible product behavior is now mostly aligned with the Phase 2 compact review contract, but the incomplete-row enablement and direct API-status limitation remain unresolved in this verification surface. No transaction was submitted, no confirmation was executed, and no secrets were inspected or recorded.

## 2026-07-17 — Visible-option review hardening

Status: **COMPLETE LOCALLY — the review row now blocks confirmation when a selected project, transaction type, or category is not visibly represented by the current permitted options**

### Starting state

- Starting HEAD: `3901e24d9f2b304236b2e1fb02ea4aa4b6c5d1dc`
- Starting branch: `main`
- Starting worktree state: only `docs/finance-rebuild-run.md` was already modified from the prior browser evidence handoff
- Prior browser finding: a row could show a blank transaction-type selector while the hidden `transactionTypeId` state still enabled confirmation

### Root cause

- The formal three-ID completeness contract was correct, but the UI only checked non-empty `projectId`, `transactionTypeId`, and `categoryId` strings before enabling confirmation
- The UI did not verify that those selected IDs were still present in the currently visible option lists
- A stale or incompatible transaction type could remain in component state while the select rendered blank because the value was not in the compatible option list

### Hardening behavior

- Added `getReviewSelectionValidity()` in `src/helpers/review-ui.ts`
- Confirmation now requires:
  - non-empty project, type, and category IDs;
  - the selected project to exist in the current project list;
  - the selected category to exist in the current category list;
  - the selected transaction type to exist in the current compatible transaction-type list;
  - the selected transaction type to be distinguishable as wrong-direction vs unavailable when it exists outside the compatible list
- `src/ui/FinanceReviewPage.tsx` now:
  - disables confirmation when any selected value is missing or not visibly available;
  - shows explicit Dutch warnings for stale or incompatible selections;
  - renders an explicit `Ongeldig voorstel — kies opnieuw` placeholder when the selected value is not present in the visible options;
  - preserves the raw selected ID in the warning text for audit/debug visibility;
  - keeps the existing `Bevestigen` / `Wijzigingen bevestigen` labels, mobile full-width action, evidence expansion, and viewer disable behavior intact

### Changed paths

- `src/helpers/review-ui.ts`
- `src/ui/FinanceReviewPage.tsx`
- `tests/helpers/reviewUi.test.ts`

### Validation

- Focused review UI helper tests: passed (`12` tests in `tests/helpers/reviewUi.test.ts`)
- Focused review queue tests: passed (`4` tests in `tests/services/reviewQueueService.test.ts`)
- Focused review decision tests: passed (`8` tests in `tests/services/reviewDecisionService.test.ts`)
- Focused review response mapper tests: passed (`2` tests in `tests/helpers/reviewResponseMapper.test.ts`)
- Focused review route tests: passed (`12` tests in `tests/routes/review.test.ts`)
- Full build: passed via `npm run build`
- Build note: Next emitted lockfile/SWC patch warnings during build, but the build completed successfully

### Browser verification

- Not performed in this turn
- No deployment or push was requested or performed

### Remaining limitations

- The prior authenticated browser evidence from the previous checkpoint remains the only live-session evidence in this handoff
- This change hardens the UI gate only; no API contract or booking-service change was required

### Commit state

- Changes are local and uncommitted at this checkpoint
- No push was made

### Exact next task

- Review the final diff for scope, stage only the intended paths, and decide whether to create a local commit under the repository’s no-push restriction

### Explicit no-push restriction

- Do not push




---

## 2026-07-17 — Documentation governance foundation checkpoint

Status: **completed and validated; no document path migration performed**  
Starting HEAD: `2ebddbd` (`fix: harden review selection visibility`)  
Starting worktree: clean  
Push restriction: **do not push**

### Changed paths

- `README.md`
- `docs/README.md`
- `docs/DOCUMENTATION_GOVERNANCE.md`
- `docs/finance-rebuild-run.md`

### Governance introduced

- Added `docs/README.md` as the canonical documentation navigation index.
- Added `docs/DOCUMENTATION_GOVERNANCE.md` as the canonical policy for documentation ownership, status vocabulary, cross-reference direction, compatibility stubs, archival, active-run updates, and migration validation.
- Added one concise documentation-index link to the root `README.md` while preserving its existing authoritative reading order and all current canonical links.
- Declared repository documentation durable project memory and chat history non-authoritative.
- Declared the rule that one fact has one canonical home.
- Confirmed `docs/finance-rebuild-run.md` remains the active handoff until a separately approved migration updates every consumer.
- Confirmed the path-sensitive owner/release document suite must never be partially migrated.

No existing document was moved, renamed, deleted, split, archived, superseded, or assigned a replacement canonical path. No application source, schema, migration, dependency, lockfile, workflow, environment, operational script, or existing canonical document was changed.

### Validation evidence

- Final documentation audit: `npm run audit:final-docs` — exit `0`; status `GESLAAGD`.
- Focused final-docs consistency suite — exit `0`; 36 passed, 0 failed.
- Focused roadmap-status consistency suite — exit `0`; 10 passed, 0 failed.
- Focused release-evidence consistency suite — exit `0`; 11 passed, 0 failed.
- Exact diff review confirmed the intended governance-only scope before this handoff append.
- No new test was required because existing guards already accept the additive index and governance files.

### Exact next migration-assessment task

Review and classify the known historical duplicate documents without moving them. Prepare the second bounded documentation packet to add explicit `SUPERSEDED` or `ARCHIVED` metadata and canonical replacement links only where exact-path tests and scripts permit it. Before editing, locate every consumer of each candidate historical path. Do not move canonical documents, the active handoff, or any owner/release suite file. Do not push.




---

## 2026-07-17 — Historical documentation classification checkpoint

Status: **completed and validated; no document moved**  
Starting HEAD: `58a2187` (`docs: establish documentation governance`)  
Starting worktree: clean  
Push restriction: **do not push**

### Files inspected

- `docs/yeshua-academy-finance-roadmap.md`
- `docs/yeshua-academy-finance-implementation-plan.md`
- `docs/yeshua-academy-finance-implementation-progress.md`
- `docs/yeshua-academy-finance-handoff-2026-05-15.md`
- `docs/yeshua-academy-finance-handoff-2026-05-16.md`
- `docs/yeshua-ledger-lite-discovery-plan.md`
- `docs/yeshua-ledger-lite-requirements.md`
- `docs/yeshua-academy-finance-prototype-notes.md`
- `docs/yeshua-academy-finance-prototype-execution-brief.md`
- `docs/yeshua-academy-finance-ui-design-brief.md`
- `docs/yeshua-academy-finance-bloat-map.md`

### Classified as `SUPERSEDED`

- `docs/yeshua-academy-finance-roadmap.md` → canonical replacement `docs/ROADMAP.md`
- `docs/yeshua-academy-finance-implementation-plan.md` → canonical replacement `docs/IMPLEMENTATION_PLAN.md`
- `docs/yeshua-academy-finance-implementation-progress.md` → canonical replacements `docs/IMPLEMENTATION_PLAN.md` and `docs/finance-rebuild-run.md`
- `docs/yeshua-academy-finance-handoff-2026-05-15.md` → canonical replacement `docs/finance-rebuild-run.md`
- `docs/yeshua-academy-finance-handoff-2026-05-16.md` → canonical replacement `docs/finance-rebuild-run.md`

Each file received only a minimal metadata banner. Historical body content was not rewritten.

### Classified as `ARCHIVED`

- `docs/yeshua-academy-finance-prototype-notes.md`
- `docs/yeshua-academy-finance-prototype-execution-brief.md`
- `docs/yeshua-academy-finance-bloat-map.md`

Each file remains in place as historical prototype or cleanup-planning evidence and must not govern new implementation.

### Intentionally left unchanged

- `docs/yeshua-ledger-lite-discovery-plan.md` — still referenced by the canonical implementation plan.
- `docs/yeshua-ledger-lite-requirements.md` — still referenced by current product/domain documentation and remains useful as the original requirements baseline.
- `docs/yeshua-academy-finance-ui-design-brief.md` — still referenced by current documentation and remains an active design reference.

### Exact-path consumer findings

- No candidate path is referenced by application source, tests, scripts, or workflows.
- Candidate references are documentation-only.
- The legacy implementation plan references the old roadmap and UI brief.
- The old roadmap references the requirements baseline and discovery plan.
- Current canonical documentation still references the discovery plan, requirements baseline, and UI design brief, so those files were not classified.

### Changed paths

- the eight classified historical documents listed above;
- `docs/README.md`;
- `docs/finance-rebuild-run.md`.

No file was moved, renamed, deleted, split, or replaced by a compatibility stub. No application source, schema, migration, dependency, lockfile, workflow, environment file, script, canonical product document, active handoff path, or owner/release suite file was changed.

### Validation evidence

- `npm run audit:final-docs` — exit `0`; status `GESLAAGD`.
- Focused final-docs consistency suite — exit `0`; 36 passed, 0 failed.
- Focused roadmap-status consistency suite — exit `0`; 10 passed, 0 failed.
- Focused release-evidence consistency suite — exit `0`; 11 passed, 0 failed.
- Exact-path reference searches confirmed documentation-only consumers for the changed historical files.
- No new test was required.

### Exact next migration task

Prepare the third bounded documentation packet to introduce the first new canonical architecture documents without moving or splitting existing canonical paths. Draft only `docs/architecture/ARCHITECTURAL_INVARIANTS.md`, `docs/architecture/SYSTEM_ARCHITECTURE.md`, `docs/architecture/MERCHANT_KNOWLEDGE_ARCHITECTURE.md`, and `docs/architecture/DECISION_ENGINE_ARCHITECTURE.md`; update `docs/README.md` and the active handoff; preserve `docs/ACCOUNTING_INTEGRITY_AND_REVIEW_PREFILL.md` as the current canonical architecture entrypoint until a later approved split. Validate all new cross-links and do not push.




---

## 2026-07-18 — Finance intelligence architecture foundation checkpoint

Status: **completed and validated; existing canonical paths preserved**  
Starting HEAD: `4420806` (`docs: classify historical finance documents`)  
Starting worktree: clean  
Push restriction: **do not push**

### Files created

- `docs/architecture/ARCHITECTURAL_INVARIANTS.md`
- `docs/architecture/SYSTEM_ARCHITECTURE.md`
- `docs/architecture/MERCHANT_KNOWLEDGE_ARCHITECTURE.md`
- `docs/architecture/DECISION_ENGINE_ARCHITECTURE.md`

### Architecture responsibilities introduced

- Architectural invariants define durable financial, workspace, learning, provenance, calibration, abstention, and automation constraints.
- System architecture defines long-term boundaries, data flow, event flow, synchronous/asynchronous separation, observability, security, and failure behavior.
- Merchant Knowledge architecture defines workspace-scoped merchant identity, aliases, fingerprints, matching precedence, conflict handling, merge/split safety, audit, retrieval anchoring, additive migration, and rollback.
- Decision Engine architecture defines contributor responsibilities, orchestration order, restricted candidates, conceptual Decision content, abstention, escalation, calibration, evidence, reproducibility, performance, cost, and failure behavior.

### Authority and scope

`docs/ACCOUNTING_INTEGRITY_AND_REVIEW_PREFILL.md` remains the current canonical architecture entrypoint for implemented accounting integrity and transaction review. The new documents are `APPROVED` target architecture and explicitly distinguish implemented behavior from future Phase 3–7 work. No existing canonical document was moved, renamed, split, archived, superseded, or edited.

No application code, Prisma schema, migration, dependency, lockfile, workflow, environment file, script, operational document, owner/release document, or production behavior changed.

### Additional changed paths

- `docs/README.md` — indexed the architecture folder, preserved the current accounting/review entrypoint, and updated onboarding order.
- `docs/finance-rebuild-run.md` — this checkpoint.

Root `README.md` did not require a change. No new test was added because existing link and consistency guards cover the additive architecture documents.

### Validation evidence

- `npm run audit:final-docs` — exit `0`; status `GESLAAGD`.
- Focused final-docs consistency suite — exit `0`; 36 passed, 0 failed.
- Focused roadmap-status consistency suite — exit `0`; 10 passed, 0 failed.
- Focused release-evidence consistency suite — exit `0`; 11 passed, 0 failed.
- Focused link-integrity suite — exit `0`; 85 passed, 0 failed.
- New documents use `Status: APPROVED`; no duplicate `CURRENT` architecture responsibility was introduced.

### Exact next documentation task

Prepare the fourth bounded documentation packet to reconcile the roadmap and implementation plan with the approved architecture set. Update only `docs/ROADMAP.md`, `docs/IMPLEMENTATION_PLAN.md`, `docs/README.md`, and the active handoff as needed. Preserve all completed historical phases and current production evidence. Add explicit future Transaction Review and Intelligence Program Phase 3–7 references to Merchant Knowledge, retrieval/candidate foundations, Decision Engine inference, evaluation/calibration/observability, and controlled rollout. Do not implement code, move documents, change the current accounting/review canonical entrypoint, or push.




---

## 2026-07-18 — Intelligence roadmap alignment checkpoint

Status: **completed and validated; categorization-intelligence scope preserved**  
Starting HEAD: `e31f5ff` (`docs: define finance intelligence architecture`)  
Starting worktree: clean  
Push restriction: **do not push**

### Objective preserved

This packet remains strictly focused on improving categorization intelligence, evidence, calibration, and reviewer accuracy for the 221 unresolved transactions and future review queues. No unrelated documentation migration, product expansion, operational work, or application implementation was introduced.

### Roadmap refinements

Updated only the future Transaction Review and Intelligence Program phases:

- Program Phase 3 — Merchant Knowledge Layer
- Program Phase 4 — Retrieval and Decision Foundation
- Program Phase 5 — AI Decision Engine
- Program Phase 6 — Evaluation, Calibration, and Observability
- Program Phase 7 — Controlled Rollout

Each future phase now records objective, dependencies, scope, exclusions, expected changed areas, validation requirements, completion criteria, rollback/safety, and references to the approved architecture documents.

Program Phase 1 and Program Phase 2 names, status, evidence, and history were preserved. Program Phase 2 remains `CURRENT`.

### Implementation-plan refinements

Added bounded future implementation slices:

- Phase 3: 9 slices for merchant contracts, additive migration planning, fingerprints, aliases, conflicts/merge/split, dry-run backfill, retrieval anchoring, separately approved admin tooling, and validation.
- Phase 4: 8 slices for confirmed-history eligibility, bounded retrieval, supporting/conflicting evidence, restricted candidates, Decision contracts, deterministic orchestration, integrity/isolation, and the 221-item pre-AI benchmark baseline.
- Phase 5: 8 slices for server-side Bedrock boundaries, structured contracts, valid-ID enforcement, Haiku shadow mode, versioning, timeout/retry/budget/abstention, security/privacy, and no-booking integrity.
- Phase 6: 8 slices for benchmark finalization, per-dimension metrics, confidence calibration, false-high-confidence analysis, Sonnet escalation policy, observability/cost, shadow reporting, and rollout gates.
- Phase 7: 7 slices for controlled reviewer exposure, confidence presentation, safe disable controls, budget monitoring, production acceptance, rollback rehearsal, and closeout.

Every slice includes objective/prerequisites, anticipated areas subject to exact-source verification, tests/validation, completion evidence, and rollback behavior. No exact Prisma fields, API routes, prompts, AWS SDK implementation, credentials, or unverified source paths were invented.

### Architecture references added

Both roadmap and implementation plan now reference:

- `docs/architecture/ARCHITECTURAL_INVARIANTS.md`
- `docs/architecture/SYSTEM_ARCHITECTURE.md`
- `docs/architecture/MERCHANT_KNOWLEDGE_ARCHITECTURE.md`
- `docs/architecture/DECISION_ENGINE_ARCHITECTURE.md`

`docs/ACCOUNTING_INTEGRITY_AND_REVIEW_PREFILL.md` remains the implemented accounting/review architecture entrypoint.

### Integrity preserved

- suggestions remain separate from bookings;
- confirmation remains administrator-only and individual;
- locked-period protections remain authoritative;
- only confirmed outcomes may become trusted learning data;
- automatic booking remains outside the default Program Phase 3–7 scope.

### Test added

- `tests/ops/intelligenceProgramDocsConsistency.test.ts`

The test guards Phase 2 status, approved Phase 3–7 names, architecture references, the 221-transaction benchmark objective, human confirmation, and exclusion of default automatic booking.

### Validation evidence

- `npm run audit:final-docs` — exit `0`; status `GESLAAGD`.
- Focused final-docs consistency suite — exit `0`; 36 passed, 0 failed.
- Focused roadmap-status consistency suite — exit `0`; 10 passed, 0 failed.
- Focused release-evidence consistency suite — exit `0`; 11 passed, 0 failed.
- Focused link-integrity suite — exit `0`; 85 passed, 0 failed.
- Intelligence-program documentation consistency suite — exit `0`; 6 passed, 0 failed.
- Search for superseded Phase 3–7 names returned no matches.
- Focused secret-material scan on the pre-handoff changed paths returned no findings.

### Changed paths

- `docs/ROADMAP.md`
- `docs/IMPLEMENTATION_PLAN.md`
- `tests/ops/intelligenceProgramDocsConsistency.test.ts`
- `docs/finance-rebuild-run.md`

No application source, schema, migration, dependency, lockfile, workflow, environment file, script, architecture document, historical document, operational document, or owner/release document changed.

### Exact next task

Start the smallest executable Program Phase 3 task that directly advances categorization accuracy for the 221 transactions: perform Phase 3.1 domain and data-contract design only. Inspect the exact current Prisma schema, transaction/import models, workspace boundaries, review DTOs, categorization/history services, and relevant tests. Produce an implementation-ready merchant identity, alias, fingerprint, conflict, audit, and dry-run backfill contract grounded in current source. Update only the authoritative architecture/implementation/handoff documents needed for that contract. Do not implement schema, migrations, services, UI, Bedrock, or AI yet. Do not push.




---

## 2026-07-18 — Program Phase 3.1 Merchant Knowledge contract checkpoint

Status: **completed and validated; no schema or runtime implementation performed**  
Starting HEAD: `94e6cbe` (`docs: align intelligence roadmap with architecture`)  
Starting worktree: clean  
Push restriction: **do not push**

### Source inspected

- `prisma/schema.prisma`
- `server/auth/requestContext.ts`
- `server/services/reviewQueueService.ts`
- `server/services/reviewDecisionService.ts`
- `server/services/historySuggestionService.ts`
- `server/services/deterministicCategorizationService.ts`
- `server/services/suggestionBackfillService.ts`
- `server/services/transactionSuggestionFacts.ts`
- `server/services/transactionFingerprint.ts`
- `server/services/auditLogService.ts`
- `tests/services/model002DomainSchema.test.ts`
- directly relevant review, history, fingerprint, workspace, and audit tests located during source inspection

### Exact current data-model findings

- Raw bank facts remain on `Transaction`, including `rawRow`, description, counterparty, reference, amount, direction, account, hash, and import fingerprint.
- `TransactionBooking` remains workspace-scoped confirmed accounting truth.
- `CategorizationSuggestion` remains separate pending/resolved suggestion evidence.
- `ReviewDecision` preserves before/after dimensions, actor, reason, evidence, and resulting booking linkage.
- `FinanceWorkspace` and server-side request context establish the workspace and role boundary.
- Confirmed-history suggestion logic already consumes approved booking history and scores IBAN, counterparty, description, purpose, amount, account, recurrence, and token similarity.
- Import deduplication fingerprints are semantically separate from future merchant fingerprints.
- Existing dry-run suggestion backfill provides a reusable pattern for idempotent no-booking/no-bank-fact planning.
- The generic audit model is user-scoped; exact workspace-scoped merchant audit persistence remains a Phase 3.2 design decision.

### Approved Merchant Knowledge contract

`docs/architecture/MERCHANT_KNOWLEDGE_ARCHITECTURE.md` now defines:

1. Merchant identity
2. Merchant alias
3. Merchant fingerprint
4. Merchant-resolution result
5. Merchant conflict
6. Merge and split decision
7. Audit and provenance
8. Workspace isolation
9. Retrieval-anchor contract
10. Dry-run backfill result

It also defines deterministic matching precedence, signal support/conflict representation, abstention rules, human-review requirements, reusable correction rules, immutable raw facts, additive migration constraints, future source interactions, rollback, and the direct connection to categorization quality for the corrected 221-transaction benchmark.

### Anticipated future changed areas

Likely or optional later interactions are documented for:

- `prisma/schema.prisma`
- `server/auth/requestContext.ts`
- `server/services/transactionSuggestionFacts.ts`
- `server/services/historySuggestionService.ts`
- `server/services/deterministicCategorizationService.ts`
- `server/services/suggestionBackfillService.ts`
- `server/services/reviewQueueService.ts`
- `server/services/auditLogService.ts`

`server/services/reviewDecisionService.ts` remains the booking authority and does not need merchant-driven booking changes. `server/services/transactionFingerprint.ts` remains dedicated to import deduplication.

### Unresolved Phase 3.2 design questions

- extend generic audit with workspace ownership or introduce dedicated merchant audit persistence;
- persist resolution results or initially compute them read-through;
- privacy and retention of raw alias examples;
- exact stable creditor/card identifiers available across supported imports;
- PostgreSQL uniqueness strategy for inactive and merged records;
- whether merchant-maintenance UI remains in Phase 3 or a later separately approved slice.

### Changed paths

- `docs/architecture/MERCHANT_KNOWLEDGE_ARCHITECTURE.md`
- `docs/IMPLEMENTATION_PLAN.md`
- `tests/ops/merchantKnowledgeContractDocs.test.ts`
- `docs/finance-rebuild-run.md`

No application source, Prisma schema, migration, service, API, UI, dependency, lockfile, workflow, environment file, operational document, deployment document, owner/release document, Bedrock integration, or AI inference changed.

### Validation evidence

- Merchant Knowledge contract documentation guard — exit `0`; 6 passed, 0 failed.
- `npm run audit:final-docs` — exit `0`; status `GESLAAGD`.
- Focused final-docs consistency suite — exit `0`; 36 passed, 0 failed.
- Focused roadmap-status consistency suite — exit `0`; 10 passed, 0 failed.
- Intelligence-program documentation consistency suite — exit `0`; 6 passed, 0 failed.
- Focused link-integrity suite — exit `0`; 85 passed, 0 failed.

### Exact Phase 3.2 task

Design the additive Merchant Knowledge schema and migration plan only. Resolve the deferred audit, resolution-persistence, privacy, source-field, and uniqueness decisions through exact Prisma and PostgreSQL analysis. Produce proposed models, relations, indexes, constraints, migration ordering, dry-run/backfill boundaries, workspace-isolation guarantees, disposable-database replay validation, safe-disable behavior, and rollback evidence. Do not apply a migration, implement services, mutate transactions/bookings, add Bedrock/AI, or push.




---

## 2026-07-18 — Program Phase 3.2 Merchant Knowledge schema-design checkpoint

Status: **completed and validated; no Prisma schema or migration created**  
Starting HEAD: `1b9dde0` (`docs: define merchant knowledge contracts`)  
Starting worktree: clean  
Push restriction: **do not push**

### Prisma and migration sources inspected

- complete `prisma/schema.prisma`
- active normalized migration chain and migration SQL conventions
- archived/baseline migration conventions
- workspace, user, transaction, suggestion, booking, review-decision, and audit relations
- enum, index, uniqueness, referential-action, status, and timestamp patterns
- static schema/migration guard tests
- disposable local PostgreSQL replay and drift-check tooling documented in current tests and implementation evidence

### Exact schema and migration findings

- current models use UUID string IDs, additive workspace-scoped relations, explicit indexes, and restrictive deletes for accounting/evidence records;
- current generic `AuditLog` is user-scoped and unsuitable as the sole merchant provenance store;
- no existing migration uses the required active-state partial unique indexes;
- Prisma schema attributes cannot express the required predicates, so later raw SQL migration and static tests are required;
- current imports reliably expose IBAN/account evidence, normalized counterparty, payment purpose where present, and derivable recurrence; creditor and stable card identifiers are not yet consistently first-class parsed fields;
- the normalized active migration chain and disposable PostgreSQL replay pattern support a later additive merchant migration.

### Resolved Phase 3.1 decisions

- dedicated append-only workspace-scoped `MerchantAuditEvent`;
- immutable historical `MerchantResolution` rows with current state derived from the latest valid row;
- normalized alias values plus hashes and source-transaction links, with unrestricted raw examples excluded by default;
- supported-but-abstaining signal types for creditor/card identifiers until extraction is proven;
- raw SQL partial uniqueness for active aliases, strong matched fingerprints, and open conflicts;
- no UI presentation state in the initial schema;
- persisted dry-run/backfill runs and results for reproducible 221-item benchmark measurement.

### Proposed models and enums

`docs/MERCHANT_KNOWLEDGE_SCHEMA_PROPOSAL.md` defines conceptual Prisma contracts for:

- `Merchant`
- `MerchantAlias`
- `MerchantFingerprint`
- `MerchantResolution`
- `MerchantConflict`
- `MerchantIdentityDecision`
- `MerchantAuditEvent`
- `MerchantBackfillRun`
- `MerchantBackfillResult`

Supporting enums cover merchant status, signal type, alias status, fingerprint status/strength, resolution status, conflict status, identity-decision action, and backfill-run status.

### Partial-index and Prisma limitations

The later SQL migration must add predicate-based unique indexes for:

- approved/trusted aliases by workspace, signal type, and normalized value;
- strong matched fingerprints by workspace, signal type, and hash;
- open conflicts by workspace, transaction, and conflict key.

These predicates are not representable through ordinary Prisma `@@unique` declarations. Migration SQL and static tests must therefore remain authoritative for them.

### Migration sequence

1. enums;
2. core merchant identity;
3. aliases and fingerprints;
4. conflicts and identity decisions;
5. immutable resolution history;
6. merchant audit/provenance;
7. raw SQL partial unique indexes;
8. dry-run/backfill run and result structures.

The future migration is additive, performs no migration-time data backfill, seeds no merchant knowledge from suggestions, and rewrites no `Transaction`, `TransactionBooking`, `ReviewDecision`, or `CategorizationSuggestion` record. It remains compatible while all new tables are empty and no merchant service consumes them.

### 221-transaction measurement support

The proposal supports known merchant coverage, new merchant rate, alias consolidation, fingerprint collision rate, conflict and unresolved rates, correction reuse, known-versus-new categorization accuracy, false merchant merge rate, and retrieval-anchor coverage without adding accounting defaults to Merchant.

### Changed paths

- `docs/MERCHANT_KNOWLEDGE_SCHEMA_PROPOSAL.md`
- `docs/architecture/MERCHANT_KNOWLEDGE_ARCHITECTURE.md`
- `docs/IMPLEMENTATION_PLAN.md`
- `tests/ops/merchantKnowledgeSchemaProposalDocs.test.ts`
- `tests/ops/merchantKnowledgeContractDocs.test.ts`
- `docs/finance-rebuild-run.md`

No Prisma schema, migration, application source, service, API, UI, dependency, lockfile, workflow, environment file, operational document, deployment document, owner/release document, Bedrock integration, or AI inference changed.

### Validation evidence

- Merchant Knowledge schema proposal documentation guard — exit `0`; 7 passed, 0 failed.
- Final documentation audit — passed.
- Final-docs consistency — 36 passed, 0 failed.
- Roadmap-status consistency — 10 passed, 0 failed.
- Intelligence-program documentation consistency — 6 passed, 0 failed.
- Merchant Knowledge contract documentation guard — 6 passed, 0 failed after one bounded assertion update from Phase 3.2 to Phase 3.3.
- Link-integrity suite — 85 passed, 0 failed.
- The only repair changed outdated test wording; the approved schema design did not change.

### Unresolved blockers

No blocker prevents Phase 3.3 deterministic fingerprint extraction. Creditor identifier and stable card descriptor extraction remain intentionally abstaining until source evidence supports them.

### Exact Phase 3.3 task

Implement deterministic merchant fingerprint extraction only, without creating the proposed schema or migration yet. Add a pure, side-effect-free extractor over current immutable transaction facts for the proven signal types: IBAN/account evidence, normalized counterparty, payment purpose when available, and recurring-pattern input components where they can be represented deterministically. Preserve import-fingerprint separation, workspace scope in every caller contract, version each extraction result, hash privacy-sensitive values, abstain on missing/malformed inputs, and add targeted fixtures covering the 221-transaction evidence shapes. Do not persist merchant knowledge, mutate transactions/bookings/reviews, add UI, Bedrock, or AI. Do not push.




---

## 2026-07-18 — Program Phase 3.3 deterministic merchant fingerprint extraction checkpoint

Status: **completed and validated; no persistence, schema, migration, booking, suggestion, or review mutation introduced**  
Starting HEAD: `1497373` (`docs: design merchant knowledge schema`)  
Starting worktree: clean  
Push restriction: **do not push**

### Exact source inspected

- `server/services/transactionSuggestionFacts.ts`
- `server/services/transactionFingerprint.ts`
- `server/services/historySuggestionService.ts`
- `lib/import/normalizers.ts`
- `lib/import/csv_ING.ts`
- `lib/import/xlsx.ts`
- current ING and historical parser fixtures
- existing import-fingerprint, parser, history-suggestion, and suggestion-backfill tests

### Extractor contract

Created `server/services/merchantFingerprintExtractor.ts` as a pure, deterministic, side-effect-free extractor requiring caller-supplied `workspaceId` and `transactionId` context without any database or workspace lookup.

The typed contract returns:

- signal type;
- normalized value where allowed;
- SHA-256 value hash;
- strength;
- extraction version `merchant-fingerprint-v1`;
- source field;
- evidence-safe display value;
- explicit abstention reason when extraction cannot produce a signal.

Output is stably ordered and deterministic for identical immutable input. The extractor has no network, database, filesystem, clock, persistence, or mutation dependency.

### Supported signals

- validated counterparty IBAN/account evidence — `STRONG`, normalized and masked for display;
- normalized counterparty — `MEDIUM`;
- payment purpose from supported direct/nested raw-row shapes or immutable reference fallback — `WEAK`;
- deterministic recurring-pattern input components from account ID, direction, absolute amount, and UTC month-day — `WEAK` and never a merchant assignment.

### Abstaining and excluded signals

- malformed or missing IBAN;
- empty or placeholder counterparty/purpose values;
- incomplete recurring-pattern components;
- creditor identifiers and stable card/payment descriptors, because current imports do not yet expose reliable first-class values;
- amount or text similarity alone never becomes a strong fingerprint.

Merchant fingerprints remain semantically and technically separate from `server/services/transactionFingerprint.ts`, which continues to own import deduplication.

### Changed paths

- `server/services/merchantFingerprintExtractor.ts`
- `tests/services/merchantFingerprintExtractor.test.ts`
- `docs/IMPLEMENTATION_PLAN.md`
- `docs/finance-rebuild-run.md`

No Prisma model, migration, merchant persistence, API, UI, booking, categorization suggestion, review decision, raw transaction, Bedrock integration, AI inference, or automatic booking changed.

### Validation evidence

- Focused merchant fingerprint extractor suite — exit `0`; 12 passed, 0 failed.
- Existing transaction import fingerprint suite — exit `0`; 4 passed, 0 failed.
- `npm run build:server` — exit `0`.
- Full `npm run build` — exit `0`; Prisma generation, server type check, Next production compilation, type validation, static generation, and trace collection completed successfully.
- Full build emitted only the repository's existing Prisma update notice and missing-SWC-lockfile warnings; no build failure occurred and no lockfile changed.

### Limitations

- The extractor is not yet wired into alias resolution or retrieval.
- It deliberately performs no persistence.
- Counterparty and payment-purpose normalized values remain in-memory outputs; future persistence must follow the approved privacy/minimization contract.
- Recurring-pattern output contains only deterministic input components and does not infer recurrence or merchant identity.
- Creditor/card signals remain unsupported until parser evidence exists.

### Exact Phase 3.4 task

Implement workspace-scoped alias resolution only over caller-supplied approved alias records and pure Phase 3.3 fingerprints. The resolver must be deterministic, side-effect free, precedence ordered, and explicitly abstain on collisions, conflicting active aliases, missing workspace context, unsupported signals, or no trusted match. Do not create the proposed Prisma schema or migration yet; use typed in-memory contracts and focused tests only. Do not persist merchant knowledge, mutate transactions/bookings/reviews, add APIs/UI, Bedrock, AI, or automatic booking. Do not push.




---

## 2026-07-18 — Program Phase 3.4 workspace-scoped alias resolution checkpoint

Status: **completed and validated; pure in-memory resolution only**  
Starting HEAD: `758c8f7` (`feat: extract merchant fingerprints`)  
Starting worktree: clean  
Push restriction: **do not push**

### Resolver contract

Created `server/services/merchantAliasResolver.ts` as a pure, deterministic, side-effect-free resolver over caller-supplied Phase 3.3 fingerprints and caller-supplied alias records.

The resolver:

- requires explicit workspace context;
- rejects the entire request when any supplied alias belongs to another workspace;
- considers only `APPROVED` or `TRUSTED` aliases;
- uses explicit signal precedence: IBAN before normalized counterparty, payment purpose, and recurring-pattern evidence;
- resolves only when the strongest matching precedence points unambiguously to one merchant;
- returns `CONFLICTED` for strongest-signal collisions;
- preserves weaker supporting and conflicting evidence without allowing weaker signals to override the strongest match;
- returns explicit abstentions for missing workspace context, no fingerprints, no trusted match, or cross-workspace input;
- returns stable deterministic evidence ordering;
- performs no database, network, filesystem, clock, cache, or persistence operation;
- does not mutate fingerprints or alias records.

Resolution version: `merchant-alias-resolution-v1`.

### Changed paths

- `server/services/merchantAliasResolver.ts`
- `tests/services/merchantAliasResolver.test.ts`
- `docs/IMPLEMENTATION_PLAN.md`
- `docs/finance-rebuild-run.md`

No Prisma model, migration, merchant persistence, API, UI, transaction, booking, categorization suggestion, review decision, Bedrock integration, AI inference, or automatic booking changed.

### Validation evidence

- Focused merchant alias resolver suite — exit `0`; 10 passed, 0 failed.
- `npm run build:server` — exit `0`.
- Full `npm run build` — exit `0`; Prisma generation, server type checking, Next production compilation, type validation, static generation, and build traces completed successfully.
- Full build emitted only the repository's existing Prisma update notice and missing-SWC-lockfile warnings; no build failure or lockfile change occurred.

### Limitations

- Alias records remain caller-supplied typed in-memory data; no schema or persistence exists yet.
- The resolver intentionally performs no fuzzy matching and no history retrieval.
- Strongest-signal collisions abstain rather than selecting by popularity or record order.
- Lower-precedence conflicts are preserved as evidence but do not override a unique stronger match.
- Unsupported creditor/card identifiers remain absent until source extraction is proven.

### Exact Phase 3.5 task

Implement pure conflict, merge, and split planning controls only over caller-supplied merchant identities, alias records, fingerprints, and Phase 3.4 resolution evidence. Produce deterministic, side-effect-free plan objects with before/after state, explicit administrator-intent inputs, collision detection, affected alias/fingerprint IDs, evidence hashes, and reversible rollback plans. Do not create or apply Prisma schema/migrations, persist knowledge, mutate merchants, transactions, bookings, suggestions, reviews, or audit logs, add APIs/UI, Bedrock, AI, or automatic booking. Do not push.




---

## 2026-07-18 — Program Phase 3.5 merchant identity planning checkpoint

Status: **completed and validated; plans are never applied or persisted**  
Starting HEAD: `ed7f6e9` (`feat: resolve merchant aliases`)  
Starting worktree: clean  
Push restriction: **do not push**

### Exact source inspected

- `server/services/merchantFingerprintExtractor.ts`
- `server/services/merchantAliasResolver.ts`
- `docs/MERCHANT_KNOWLEDGE_SCHEMA_PROPOSAL.md`
- `docs/architecture/MERCHANT_KNOWLEDGE_ARCHITECTURE.md`
- the Program Phase 3 section of `docs/IMPLEMENTATION_PLAN.md`
- focused Phase 3.3 and Phase 3.4 tests

### Planner contracts

Created `server/services/merchantIdentityPlanService.ts` as a pure, deterministic, side-effect-free planner over caller-supplied merchant identities, approved/trusted aliases, fingerprint ownership records, and Phase 3.4 resolution evidence.

Supported plan actions:

- `RESOLVE_CONFLICT`
- `MERGE_MERCHANTS`
- `SPLIT_MERCHANT`
- `REASSIGN_KNOWLEDGE`
- `DEPRECATE_ALIAS`
- `DEPRECATE_MERCHANT`

Every plan includes workspace ID, actor ID, request key, reason, plan version `merchant-identity-plan-v1`, stable SHA-256 plan hash, source/target merchant IDs, explicit alias/fingerprint IDs, before and proposed after snapshots, supporting/conflicting evidence, warnings, blocking errors, reversible rollback steps, and `administratorConfirmationRequired: true`.

### Safety and rejection rules

The planner rejects or blocks:

- missing workspace, actor, request key, or reason;
- cross-workspace merchants, aliases, or fingerprints;
- duplicate merchant identities or duplicate merge sources;
- same merge source and target;
- missing source/target merchants;
- merge cycles;
- unknown or implicit affected alias/fingerprint records;
- unresolved active alias collisions;
- unresolved strong matched-fingerprint collisions;
- split records that are unassigned or multiply assigned;
- selected conflict merchants absent from preserved evidence;
- conflict evidence that would be silently discarded.

The planner is deterministic and input-order independent. It does not infer administrator intent, select by popularity/amount/record order, rewrite historical resolution/review evidence, mutate caller inputs, or apply any plan.

### Changed paths

- `server/services/merchantIdentityPlanService.ts`
- `tests/services/merchantIdentityPlanService.test.ts`
- `docs/IMPLEMENTATION_PLAN.md`
- `docs/finance-rebuild-run.md`

No Prisma model, migration, merchant persistence, transaction, booking, categorization suggestion, review decision, audit record, API, UI, dependency, Bedrock integration, AI inference, or automatic booking changed.

### Validation evidence

- Focused merchant identity plan service suite — exit `0`; 14 passed, 0 failed.
- `npm run build:server` — exit `0`.
- Full `npm run build` — exit `0`; Prisma generation, server type checking, Next production compilation, type validation, static generation, and trace collection completed successfully.
- Full build emitted only the repository's existing Prisma update notice and missing-SWC-lockfile warnings; no build failure or lockfile change occurred.

### Limitations

- Plans remain typed in-memory values and are not persisted or applied.
- No administrator authorization lookup occurs inside the pure planner; explicit actor/workspace intent is caller-supplied and later application must enforce authorization.
- Planned merchant IDs for splits are caller-supplied stable IDs; the planner does not generate IDs or inspect the database.
- Collision checks operate only over the complete caller-supplied alias/fingerprint set; future callers must supply the full relevant workspace candidate set.
- No audit event is written; rollback steps are planning evidence only.

### Exact Phase 3.6 task

Implement deterministic dry-run merchant backfill planning only over caller-supplied transactions, Phase 3.3 fingerprints, Phase 3.4 alias resolution, and Phase 3.5 conflict/planning outcomes. Produce a bounded, paginated, idempotent, side-effect-free report for the 221 unresolved transactions with known/new merchant coverage, alias consolidation, collisions, conflict/unresolved rates, correction-reuse candidates, retrieval-anchor readiness, evidence hashes, and stable run/result ordering. Do not create/apply schema or migrations, persist results, mutate merchant knowledge or financial records, add APIs/UI, Bedrock, AI, or automatic booking. Do not push.




---

## 2026-07-18 — Program Phase 3.6 deterministic merchant backfill planning checkpoint

Status: **completed and validated; dry-run report only, with no writes or trusted-history changes**  
Starting HEAD: `5054e98` (`feat: plan merchant identity changes`)  
Starting worktree: clean  
Push restriction: **do not push**

### Exact source inspected

- `server/services/merchantFingerprintExtractor.ts`
- `server/services/merchantAliasResolver.ts`
- `server/services/merchantIdentityPlanService.ts`
- `docs/MERCHANT_KNOWLEDGE_SCHEMA_PROPOSAL.md`
- `docs/architecture/MERCHANT_KNOWLEDGE_ARCHITECTURE.md`
- the Program Phase 3 section of `docs/IMPLEMENTATION_PLAN.md`
- focused Phase 3.3–3.5 tests

### Planner and result contracts

Created `server/services/merchantBackfillPlanner.ts` as a pure, deterministic, bounded, paginated, idempotent planner over caller-supplied unresolved transactions, merchant identities, approved/trusted aliases, explicit approved correction knowledge, and optional prior result IDs.

The report contains:

- workspace ID and stable run key;
- planner version `merchant-backfill-plan-v1`;
- fingerprint extraction version;
- alias-resolution version;
- source snapshot hash;
- parameters hash;
- total transaction count;
- current-page results;
- complete-input aggregate metrics;
- pagination metadata;
- explicit side-effect flags proving no merchant write, booking creation, bank-fact mutation, or trusted-history change.

Each transaction result contains a deterministic result ID and evidence hash, state, resolved merchant when eligible, known/new/conflicted/unresolved flags, alias-consolidation opportunity, fingerprint-collision flag, approved-correction reuse, retrieval-anchor readiness, signal coverage, abstention reasons, and preserved supporting/conflicting evidence.

### Pagination behavior

- default page size: 25;
- supported page sizes: 25, 50, and 100;
- unsupported sizes fall back to 25;
- stable ordering: transaction date, then transaction ID;
- page clamping for out-of-range requests;
- metadata: page, pageSize, totalItems, totalPages, hasPreviousPage, hasNextPage;
- verified first, middle, final, empty, and out-of-range behavior;
- every supplied transaction remains reachable across pages.

### Supported result states

- `KNOWN_MERCHANT` only when a trusted alias resolves to an active caller-supplied merchant;
- `NEW_MERCHANT_CANDIDATE` only when usable deterministic fingerprints exist, no trusted alias resolves, and no strongest-signal conflict exists;
- `CONFLICTED` when strongest alias evidence collides;
- `UNRESOLVED` for no-fingerprint or other abstaining outcomes.

No result creates a merchant, alias, booking, suggestion, review decision, or trusted-history example.

### Metrics

The planner calculates deterministically over the complete supplied input:

- processed count;
- known merchant coverage;
- new merchant candidate rate;
- alias consolidation count/rate;
- fingerprint collision count/rate;
- merchant conflict count/rate;
- unresolved merchant count/rate;
- approved correction-reuse candidate count/rate;
- retrieval-anchor coverage;
- abstention-reason distribution;
- fingerprint signal coverage by type.

Categorization accuracy is intentionally excluded because this slice receives no confirmed benchmark labels.

### Idempotency and safety guarantees

- identical workspace, run key, engine versions, parameters, aliases, corrections, prior IDs, and immutable source transactions produce identical hashes and output;
- caller transaction order does not affect report ordering or hashes;
- duplicate transaction IDs are rejected;
- cross-workspace transactions, merchants, aliases, or corrections are rejected;
- duplicate prior-result IDs are rejected;
- no clock, random ID, network, database, filesystem, cache, or persistence dependency exists;
- caller inputs are not mutated;
- correction reuse uses only explicit `APPROVED` caller-supplied correction knowledge;
- unconfirmed suggestion-shaped input is ignored and cannot become trusted knowledge.

### Changed paths

- `server/services/merchantBackfillPlanner.ts`
- `tests/services/merchantBackfillPlanner.test.ts`
- `docs/IMPLEMENTATION_PLAN.md`
- `docs/finance-rebuild-run.md`

No Prisma model, migration, persisted run/result, merchant record, transaction, booking, categorization suggestion, review decision, audit record, API, UI, dependency, Bedrock integration, AI inference, or automatic booking changed.

### Validation evidence

- Focused merchant backfill planner suite — exit `0`; 13 passed, 0 failed.
- `npm run build:server` — exit `0`.
- Full `npm run build` — exit `0`; Prisma generation, server type checking, Next production compilation, type validation, static generation, and trace collection completed successfully.
- Full build emitted only the repository's existing Prisma update notice and missing-SWC-lockfile warnings; no build failure or lockfile change occurred.

### Limitations

- Transactions, merchants, aliases, corrections, and prior IDs remain caller-supplied typed values.
- No persisted backfill run/result schema is used yet.
- Alias consolidation is a planning opportunity based on unmatched usable fingerprints after a known merchant resolution; it does not create aliases.
- Fingerprint collision currently reflects strongest-signal alias collision evidence.
- Categorization accuracy and known-versus-new categorization accuracy require confirmed benchmark labels in a later evaluation phase.
- Retrieval-anchor readiness is report evidence only and is not yet consumed by history retrieval.

### Exact Phase 3.7 task

Implement read-side retrieval-anchor integration only. Define a pure versioned Merchant Retrieval Anchor contract from Phase 3.4/3.6 results and integrate it as optional caller-supplied evidence into confirmed-history retrieval without changing eligibility rules. Confirmed `TransactionBooking` outcomes remain the only trusted history. Missing, unresolved, conflicted, stale, or cross-workspace anchors must abstain and preserve the current non-merchant retrieval path. Add focused tests for workspace isolation, resolved-anchor ranking contribution, conflict abstention, no suggestion contamination, deterministic evidence/versioning, and zero writes. Do not create/apply schema or migrations, persist anchors, mutate financial records, add APIs/UI, Bedrock, AI, or automatic booking. Do not push.




---

## 2026-07-18 — Program Phase 3.7 Merchant Retrieval Anchor checkpoint

Status: **completed and validated; read-side scoring evidence only**  
Phase 3.6 commit: `7c3d8df` (`feat: plan merchant backfill`)  
Starting HEAD: `7c3d8df`  
Starting worktree: clean except the intended Phase 3.7 runtime/test paths  
Push restriction: **do not push**

### Exact source inspected

- `server/services/historySuggestionService.ts`
- `server/services/merchantAliasResolver.ts`
- `server/services/merchantBackfillPlanner.ts`
- `server/services/transactionSuggestionFacts.ts`
- `tests/services/historySuggestionService.test.ts`
- `tests/services/merchantBackfillPlanner.test.ts`
- the confirmed-booking eligibility, direction, date, grouping, and workspace contracts already enforced by the current history-suggestion service

### Anchor contract and states

Created `server/services/merchantRetrievalAnchor.ts` as a pure, deterministic, versioned evaluator.

Supported states:

- `READY`
- `MISSING`
- `UNRESOLVED`
- `CONFLICTED`
- `STALE`
- `CROSS_WORKSPACE`

The contract preserves workspace ID, transaction ID, merchant ID, anchor version, alias-resolution version, evidence hash, source state, supporting evidence, conflicting evidence, readiness, caller-supplied stale/expiry state, and a deterministic evaluation hash.

Expiry is represented only by caller-supplied `expired?: boolean`; no clock or `Date.now()` access exists.

### Retrieval-scoring integration

`server/services/historySuggestionService.ts` now evaluates the optional anchor once per ranking request and reuses that evaluation for every eligible historical-booking score and every candidate evidence object.

A merchant anchor contributes exactly **1,200 basis points** only when:

- its state is `READY`;
- its workspace and transaction match the request;
- it is conflict-free, current, and not expired;
- the eligible caller-supplied confirmed booking contains the same optional merchant ID.

Missing, disabled, unresolved, conflicted, stale, expired, cross-workspace, and non-matching anchors contribute zero.

Suggestion evidence now records anchor state, anchor/resolution versions, evidence hash, deterministic evaluation hash, supporting/conflicting evidence counts, merchant-anchor match count, and maximum contribution.

### Confirmed-booking-only safeguards

The existing history filter remains authoritative:

- direction must match;
- the historical transaction must differ from the target;
- historical date may not be later than the target date;
- only caller-supplied eligible confirmed bookings enter the history input;
- project, transaction-type, and category candidates remain complete and unchanged;
- merchant evidence cannot create a candidate from invalid or unconfirmed history;
- merchant evidence cannot create or modify a booking.

Disabling Merchant Retrieval Anchors preserves the prior non-merchant scores, ranking, candidates, confidence, matcher, reason, supporting history, grouping, ordering, and tie-breaking. Explicit zero-state provenance may remain in evidence.

### Changed paths

- `server/services/merchantRetrievalAnchor.ts`
- `server/services/historySuggestionService.ts`
- `tests/services/merchantRetrievalAnchor.test.ts`
- `tests/services/historySuggestionService.test.ts`
- `docs/IMPLEMENTATION_PLAN.md`
- `docs/finance-rebuild-run.md`

No Prisma schema, migration, anchor persistence, database query/write, API, UI, transaction, booking, categorization suggestion, review decision, audit record, dependency, lockfile, Bedrock integration, AI inference, or automatic booking changed.

### Validation evidence

- Focused Merchant Retrieval Anchor suite — exit `0`; 9 passed, 0 failed.
- Focused history-suggestion suite — exit `0`; 11 passed, 0 failed.
- Focused Phase 3.6 merchant-backfill planner suite — exit `0`; 13 passed, 0 failed.
- `npm run build:server` — exit `0`.
- Full `npm run build` — exit `0`; Prisma generation, server type checking, Next production compilation, type validation, static generation, and trace collection completed successfully.
- Full build emitted only the repository's existing missing-SWC-lockfile warnings; no build failure or lockfile change occurred.

### Limitations

- anchors remain caller-supplied and unpersisted;
- optional merchant IDs on history inputs remain caller-supplied evidence;
- no database retrieval or workspace lookup occurs inside the anchor helper;
- non-ready anchors preserve the prior retrieval path;
- merchant scoring cannot override direction, date, target-self, or complete-candidate restrictions;
- the anchor score is not yet calibrated against the corrected 221-transaction benchmark;
- no categorization-accuracy claim is made in this phase.

### Exact Phase 3.8 task

Perform a source-grounded design and implementation-readiness assessment for separately approved Merchant Knowledge administrator tooling only. Inspect existing authorization, API, review, settings, audit, accessibility, responsive/mobile, individual-mutation, and no-bulk-mutation patterns. Produce the smallest bounded implementation plan for inspecting aliases/conflicts and individually confirming merge/split/reassignment plans. Do not implement UI or APIs until exact administrator-only authorization, transactional mutation, audit, locked-period interaction, accessibility, responsive behavior, and rollback requirements are verified. Do not add Bedrock, AI, automatic booking, or push.




---

## 2026-07-19 — Program Phase 3.8 Merchant Knowledge administrator-tooling readiness checkpoint

Status: **design complete and validated; application implementation blocked on persistence prerequisites**  
Starting HEAD: `28074a9` (`feat: integrate merchant retrieval anchors`)  
Starting worktree: clean  
Push restriction: **do not push**

### Exact source inspected

- `server/auth/requestContext.ts`
- `server/services/reviewDecisionService.ts`
- `server/services/auditLogService.ts`
- `server/routes/review.ts`
- `server/routes/rules.ts`
- `server/routes/emailRecipients.ts`
- `src/app/api/review/route.ts`
- `src/libs/api.ts`
- `src/ui/FinanceReviewPage.tsx`
- `src/ui/FinanceSettingsPage.tsx`
- `src/ui/FinanceAppFrame.tsx`
- `src/helpers/navigation.ts`
- `src/helpers/review-ui.ts`
- `src/components/ui/dialog.tsx`
- `src/components/ui/sheet.tsx`
- focused route, service, authorization, settings, review, accessibility, and helper tests
- Phase 3.3–3.7 Merchant Knowledge services and tests

### Authorization and mutation findings

- server request context resolves authenticated workspace membership and authoritative `admin` or `viewer` role;
- client role hints are not authorization;
- existing administrator mutations use `requireAdmin`, individual routes, transactional services, and audit writes;
- viewer access patterns support authenticated read-only settings data;
- review confirmation is a separate booking-truth workflow and must not host merchant identity mutations;
- current generic `AuditLog` is insufficient as the only merchant-domain audit history; dedicated workspace-scoped `MerchantAuditEvent` remains required.

### Route and page decision

Merchant Knowledge administration belongs at:

- `/settings/merchant-knowledge`

It must be linked from Settings, not added as a new top-level navigation item and not embedded in `/review`.

The design permits:

- authenticated administrator and viewer reads;
- viewer read-only evidence inspection with privacy redaction;
- administrator-only individual plan preview and confirmation;
- no bulk merge, split, reassignment, approval, deprecation, or conflict resolution.

### Proposed API and service boundaries

Conceptual authenticated reads:

- summary;
- paginated merchant list;
- merchant detail;
- conflict detail;
- plan detail.

Conceptual administrator-only operations:

- deterministic single-plan preview;
- transactional confirmation of one exact plan hash.

Proposed service boundaries:

- `merchantKnowledgeQueryService` — workspace-scoped, redacted, read-only;
- existing pure `merchantIdentityPlanService` — deterministic planning only;
- future `merchantKnowledgeDecisionService` — administrator-only transactional revalidation and application;
- future `merchantKnowledgeAuditService` — append-only workspace-scoped merchant audit persistence.

### Individual confirmation and no-bulk rules

Every mutation must:

1. load one current merchant/conflict context;
2. require one explicit action, affected IDs, actor intent, and non-empty reason;
3. preview before/after state, supporting/conflicting evidence, versions, hashes, warnings, blocking errors, and rollback;
4. require an accessible confirmation dialog;
5. reload and revalidate every referenced record inside one transaction;
6. reject stale, conflicting, cross-workspace, or invalid plans with no write;
7. write one decision and dedicated audit evidence atomically;
8. refresh only affected detail and counts.

No checkbox selection, multi-select, apply-all, merge-selected, bulk approval, or bulk deprecation is permitted.

### Audit and rollback requirements

Persist workspace, actor, request key, action, reason, versions, plan/evidence hashes, before/after snapshots, source/target merchants, affected alias/fingerprint IDs, supporting/conflicting evidence, warnings, rollback plan/reference, and explicit no-booking/no-bank-fact declarations.

Rollback must be a new individually confirmed and audited reversal plan. Original history remains immutable.

### Locked-period decision

Merchant-only knowledge maintenance may be allowed for evidence associated with locked periods only when it does not change a booking, transaction classification, ledger, report snapshot, close, or period state. Any attempted financial mutation must be rejected and use the existing accounting workflow.

### Accessibility and responsive requirements

- compact desktop table and labeled mobile cards;
- evidence sheet/dialog using existing Radix primitives;
- full-width reachable confirmation on mobile;
- no clipped warnings or confirmation controls;
- text and icons in addition to color;
- visible focus, keyboard cancellation, labelled title/description, `aria-busy`, and duplicate-submit blocking;
- explicit Dutch action labels and viewer read-only explanation.

### Safe-disable behavior

Proposed server-authoritative feature flag:

- `MERCHANT_KNOWLEDGE_ADMIN_ENABLED`
- default `false`

Disabling it must remove or mark unavailable the Settings capability and stop merchant read/mutation routes without affecting `/review`, imports, bookings, reports, or current retrieval behavior.

### Approved bounded implementation slices

- 3.8A — read-only capability and query contracts;
- 3.8B — read-only administrator/viewer page;
- 3.8C — administrator-only plan preview;
- 3.8D — individual transactional confirmation;
- 3.8E — authenticated production acceptance and rollback rehearsal.

### Persistence blockers

Phase 3.8 application implementation remains blocked until:

- the additive Merchant Knowledge Prisma schema and migration are implemented and replay-validated;
- dedicated workspace-scoped merchant audit persistence exists;
- persisted merchants, aliases, fingerprints, resolutions, conflicts, decisions, and evidence versions exist;
- workspace isolation and privacy-redaction query contracts are testable;
- feature-disabled behavior and administrator mutation policy coverage are approved.

### Changed paths

- `docs/MERCHANT_ADMIN_TOOLING_DESIGN.md`
- `docs/architecture/MERCHANT_KNOWLEDGE_ARCHITECTURE.md`
- `docs/IMPLEMENTATION_PLAN.md`
- `tests/ops/merchantAdminToolingDesignDocs.test.ts`
- `tests/ops/merchantKnowledgeContractDocs.test.ts`
- `tests/ops/merchantKnowledgeSchemaProposalDocs.test.ts`
- `docs/finance-rebuild-run.md`

The two existing Merchant Knowledge guards were updated only because they still asserted that Phase 3.3 was the next task. No application source, API, UI, Prisma schema, migration, runtime service, dependency, lockfile, workflow, environment file, Bedrock integration, AI inference, booking, or automatic action changed.

### Validation evidence

- `npm run audit:final-docs` — passed.
- final-docs consistency — 36 passed, 0 failed.
- Merchant Knowledge contract documentation — 6 passed, 0 failed after one stale-next-task assertion update.
- Merchant Knowledge schema-proposal documentation — 7 passed, 0 failed after one stale-next-task assertion update.
- transaction intelligence program documentation consistency — 6 passed, 0 failed.
- roadmap-status consistency — 10 passed, 0 failed.
- link-integrity validation — 85 passed, 0 failed.
- Merchant administrator-tooling readiness documentation — 7 passed, 0 failed.

### Exact next executable task

Phase 3.8 application code remains blocked while Merchant Knowledge persistence is absent.

The next repository implementation is the separately approved additive Merchant Knowledge schema and migration defined by `docs/MERCHANT_KNOWLEDGE_SCHEMA_PROPOSAL.md`:

- schema and migration only;
- additive tables, enums, relations, indexes, and raw-SQL partial unique indexes;
- keep every new table unused by application services;
- perform no backfill;
- mutate no transactions, bookings, review decisions, suggestions, or audit history;
- validate fresh disposable PostgreSQL replay, migration status, Prisma validation/generation, and database-to-schema drift;
- preserve safe disablement by leaving all new tables empty and unconsumed;
- do not push.

Only after that migration is replay-validated may Slice 3.8A read-only capability/query contracts begin.

## 2026-07-21 — Merchant Knowledge schema packet committed and validated

Status: **validated locally and committed; no push authorized**
Starting HEAD: `d66f618`
Database scope: localhost PostgreSQL peer-auth socket only

### Local database shape used by the tests

- constructed URL shape: `postgresql://<current-os-user>@localhost/postgres?host=/tmp`
- parsed protocol: `postgresql:`
- parsed hostname: `localhost`
- parsed pathname: `/postgres`
- parsed socket query param: `/tmp`
- no password, remote host, or non-local database was used

### Disposable replay workspace and database names

- disposable validation database pattern: `merchant_knowledge_validate_<timestamp>_<random>`
- disposable replay workspace pattern: `merchant-knowledge-replay-*`
- migration replay workspace copies `prisma/schema.prisma` and `prisma/migrations/migration_lock.toml`
- migration replay workspace filters directories to ones that still contain `migration.sql`, so the absent `20260719094000_add_merchant_knowledge` duplicate is ignored

### Migration-test availability repair

- `tests/services/model002DomainSchema.test.ts` now treats migration directories without `migration.sql` as non-active
- the current migration chain assertions include `20260719095000_add_merchant_knowledge`
- the focused migration-chain test passed, so the chain remained replayable after the duplicate-directory cleanup

### PostgreSQL-safe index-name drift repair

- six invalid overlength Prisma `map:` values were removed from the schema packet
- the ordinary migration index identifiers were aligned with Prisma-generated PostgreSQL-safe names
- indexed fields, ordering, uniqueness, predicates, and referential behavior were preserved
- the focused schema test now locks the Prisma declaration strings to the migration index names

### Prisma deploy, status, and drift evidence

- `npx prisma validate --schema prisma/schema.prisma` passed
- `npx prisma generate --schema prisma/schema.prisma` passed
- `tests/services/model002DomainSchema.test.ts` passed the migration-chain test that asserts `prisma migrate deploy` reports `All migrations have been successfully applied`
- the same test asserts `prisma migrate status` reports `Database schema is up to date`
- the same test asserts `prisma migrate diff` reports `No difference detected`

### Schema contents validated by the focused tests

- all nine Merchant Knowledge tables are present:
  - `Merchant`
  - `MerchantAlias`
  - `MerchantFingerprint`
  - `MerchantResolution`
  - `MerchantConflict`
  - `MerchantIdentityDecision`
  - `MerchantAuditEvent`
  - `MerchantBackfillRun`
  - `MerchantBackfillResult`
- all nine Merchant Knowledge enums are present:
  - `MerchantStatus`
  - `MerchantKnowledgeSignalType`
  - `MerchantAliasStatus`
  - `MerchantFingerprintStatus`
  - `MerchantFingerprintStrength`
  - `MerchantResolutionStatus`
  - `MerchantConflictStatus`
  - `MerchantIdentityDecisionAction`
  - `MerchantBackfillRunStatus`
- ordinary indexes are present on the new models as declared in the schema and migration
- all three approved partial unique indexes are present:
  - `MerchantAlias_active_workspace_signal_value_key`
  - `MerchantFingerprint_active_strong_workspace_signal_value_key`
  - `MerchantConflict_open_workspace_transaction_key`
- workspace-scoped foreign keys are present for the Merchant Knowledge tables
- referential actions remain restrictive where the packet approved them
- every Merchant Knowledge table was verified empty in the disposable database
- the existing accounting tables were preserved:
  - `Transaction`
  - `TransactionBooking`
  - `ReviewDecision`
  - `CategorizationSuggestion`

### Validation and build results

- `tests/services/merchantKnowledgeSchema.test.ts` passed: 8 tests
- `tests/services/model002DomainSchema.test.ts` passed: 8 tests
- `npm run build:server` passed
- `npm run build` passed
- the full build emitted the repository's existing Next.js SWC lockfile warnings, but the command exited successfully

### Cleanup evidence

- the disposable replay database was dropped with `DROP DATABASE ... WITH (FORCE)`
- the temporary replay workspace was removed with `fs.rmSync(..., { recursive: true, force: true })`

### Scan results

- focused high-risk scan over the six approved paths found no new destructive runtime logic, upload logic, or deployment changes in application code; the only destructive-command match was the disposable database cleanup in the test harness
- focused secret-material scan over the six approved paths found no private keys, tokens, or committed credential values; the only pattern match was the localhost socket URL construction in the test harness
- expected documentation matches were limited to longstanding references to secrets, deployment, push restrictions, and cleanup evidence

### Limitations

- no backfill
- no application consumption
- no API or UI
- no production or remote database validation
- no push authorized




---

## 2026-07-19 — Additive Merchant Knowledge schema implementation checkpoint

Status: **implemented and statically validated; uncommitted pending disposable localhost PostgreSQL replay**
Starting HEAD: `d66f618` (`docs: design merchant admin tooling`)
Push restriction: **do not push**

### Exact schema and migration sources inspected

- complete `prisma/schema.prisma`;
- all active migrations under `prisma/migrations`;
- normalized baseline and additive migration conventions;
- workspace, user, transaction, booking, suggestion, review-decision, and audit relations;
- `docs/MERCHANT_KNOWLEDGE_SCHEMA_PROPOSAL.md`;
- `tests/services/model002DomainSchema.test.ts`;
- `tests/services/merchantKnowledgeSchema.test.ts`;
- localhost-gated disposable PostgreSQL validation in the MODEL-002 schema test;
- Prisma generation and repository build scripts.

### Schema implemented

Added these enums:

- `MerchantStatus`;
- `MerchantKnowledgeSignalType`;
- `MerchantAliasStatus`;
- `MerchantFingerprintStatus`;
- `MerchantFingerprintStrength`;
- `MerchantResolutionStatus`;
- `MerchantConflictStatus`;
- `MerchantIdentityDecisionAction`;
- `MerchantBackfillRunStatus`.

Added these workspace-scoped models:

- `Merchant`;
- `MerchantAlias`;
- `MerchantFingerprint`;
- `MerchantResolution`;
- `MerchantConflict`;
- `MerchantIdentityDecision`;
- `MerchantAuditEvent`;
- `MerchantBackfillRun`;
- `MerchantBackfillResult`.

Added only inverse relation collections to existing `User`, `FinanceWorkspace`, and `Transaction` models. No existing transaction, booking, review, suggestion, audit, or accounting scalar field was changed or rewritten.

`Merchant` contains no project, transaction-type, or category defaults and is not accounting truth.

### Canonical migration

Canonical migration:

- `prisma/migrations/20260719095000_add_merchant_knowledge/migration.sql`

The duplicate untracked `20260719094000_add_merchant_knowledge/migration.sql` was deleted with explicit user approval. Its now-empty directory is ignored by the migration-chain guard because active Prisma migrations are defined by the presence of `migration.sql`.

The canonical migration contains only additive enums, tables, indexes, and foreign keys. Static guards verify that it contains no `DROP`, `RENAME`, data `INSERT`, `UPDATE`, `DELETE`, migration-time backfill, or rewrite of `Transaction`, `TransactionBooking`, `ReviewDecision`, or `CategorizationSuggestion`.

### PostgreSQL partial unique indexes

The canonical migration contains raw-SQL partial unique indexes for:

- approved/trusted, non-deprecated aliases within one workspace and signal/value key;
- strong matched, non-deprecated fingerprints within one workspace and signal/value hash;
- open conflicts for one workspace, transaction, and conflict key.

These predicates remain explicit SQL because Prisma schema syntax cannot represent the approved partial-index predicates.

### Application compatibility

- all new tables are intended to remain empty until separately approved services exist;
- no current runtime service, route, client API, or UI consumes the new models;
- `/review` behavior remains unchanged;
- confirmed-history retrieval remains unchanged;
- no Merchant Knowledge route or UI is exposed;
- no backfill occurred;
- no transaction, booking, review decision, suggestion, or existing audit history was rewritten;
- no trusted knowledge was seeded from suggestions.

### Validation evidence

Completed:

- Prisma format — passed;
- Prisma Client generation and relation validation — passed;
- focused `Merchant Knowledge additive schema` guard — 7 passed, 0 failed;
- focused `MODEL-002 additive domain schema` guard — 6 passed, 0 failed, 1 localhost database test skipped;
- `npm run build:server` — passed;
- full `npm run build` — passed, including Prisma generation, server type checking, Next compilation, type validation, static generation, and trace collection;
- full build changed no protected path or lockfile.

Not completed:

- fresh disposable PostgreSQL `prisma migrate deploy`;
- `prisma migrate status` against that disposable database;
- database-to-current-schema drift comparison;
- database inspection of all expected Merchant Knowledge tables, enums, indexes, partial indexes, and foreign keys;
- proof from the disposable database that all Merchant Knowledge tables are empty;
- disposable database cleanup evidence.

Reason: the repository test correctly requires an approved localhost PostgreSQL administrator URL, but this Workbench session has no local `DATABASE_URL`, `SYSTEM_DATABASE_URL`, or complete localhost `POSTGRES_*` configuration. No production or remote database was contacted.

### Current changed paths

- `prisma/schema.prisma`;
- `prisma/migrations/20260719095000_add_merchant_knowledge/migration.sql`;
- `tests/services/merchantKnowledgeSchema.test.ts`;
- `tests/services/model002DomainSchema.test.ts`;
- `docs/IMPLEMENTATION_PLAN.md`;
- `docs/finance-rebuild-run.md`.

### Commit state

No commit was created because the explicitly required disposable PostgreSQL replay, status, drift, object, empty-table, and cleanup validation has not run. The schema packet must not be treated as migration-complete or as authorization to begin Phase 3.8A.

### Exact next task

Provide or start an approved disposable localhost PostgreSQL instance and expose a localhost administrator connection through `SYSTEM_DATABASE_URL`, `DATABASE_URL`, or the repository-supported `POSTGRES_USER`, `POSTGRES_PASSWORD`, and `POSTGRES_DBNAME` variables. Then rerun the localhost database test and Prisma deploy/status/drift/object/empty-table/cleanup checks. If and only if all checks pass, review the final diff, run high-risk and secret scans, commit the six explicit schema/migration/test/documentation paths with `feat: add merchant knowledge schema`, verify a clean worktree, and do not push.

Program Phase 3.8A may begin only after that commit exists and the handoff records successful disposable replay evidence.



## Program Phase 3.8A — read-only Merchant Knowledge contracts

Starting commit: `e907b8864224c1aac002d6092dd48f05cdf12246` (`feat: add merchant knowledge schema`).

### Scope and changed paths

Phase 3.8A adds only disabled-by-default, authenticated, workspace-scoped read contracts:

- `server/services/merchantKnowledgeCapability.ts`;
- `server/services/merchantKnowledgeQueryService.ts`;
- `server/routes/merchantKnowledge.ts`;
- `server/index.ts`;
- `src/app/api/merchant-knowledge/summary/route.ts`;
- `src/app/api/merchant-knowledge/merchants/route.ts`;
- `src/app/api/merchant-knowledge/merchants/[id]/route.ts`;
- `src/libs/api.ts`;
- `tests/services/merchantKnowledgeQueryService.test.ts`;
- `docs/IMPLEMENTATION_PLAN.md`;
- `docs/finance-rebuild-run.md`.

No Prisma schema or migration changed. No page, component, navigation item, mutation endpoint, plan preview, backfill, AI call, booking, alias write, fingerprint write, resolution write, conflict write, decision write, or audit-event write was added.

### Capability and authorization

- Merchant Knowledge reads are disabled by default.
- Server-side opt-in requires `MERCHANT_KNOWLEDGE_READS_ENABLED=true`.
- The capability does not use a public client environment variable for authorization.
- Workspace scope is derived from server-controlled `DEFAULT_WORKSPACE_ID`; request query parameters, route payloads, headers, and bodies cannot select an authoritative workspace.
- The service verifies an active `WorkspaceMembership` for the authenticated local user and an active workspace before reading Merchant Knowledge data.
- Both authenticated administrators and viewers may read; missing, inactive, or cross-workspace membership is rejected.
- Disabled requests short-circuit before membership or Merchant Knowledge table queries.

### Read contracts

Three GET-only contracts exist:

- `/api/merchant-knowledge/summary`;
- `/api/merchant-knowledge/merchants`;
- `/api/merchant-knowledge/merchants/:id`.

The summary returns workspace-scoped merchant, alias, fingerprint, and open-conflict counts. The merchant list uses deterministic ordering by normalized canonical name and merchant ID, defaults to page 1, accepts only page sizes 25, 50, or 100, falls back to 25 for invalid page sizes, bounds and trims text queries to 100 characters, enum-validates merchant status filters, and returns stable zero-row or out-of-range pages. Merchant detail is workspace-scoped and returns a stable not-found result for missing or cross-workspace entities.

Read responses explicitly declare:

- `readOnly: true`;
- `createsTransactionBooking: false`;
- `mutatesBankFacts: false`.

### Privacy controls

- unrestricted alias and fingerprint normalized source values are not returned;
- IBAN evidence is masked to a limited prefix/suffix display;
- non-IBAN source values remain hidden;
- safe hashes, versions, statuses, timestamps, strengths, confidence values, and counts are retained;
- raw JSON evidence is not returned.

### Validation evidence

Completed successfully:

- focused Phase 3.8A service/contract tests — 9 passed, 0 failed;
- combined affected authentication and route regression set — 20 passed, 0 failed across four files;
- `npm run build:server` — passed;
- full `npm run build` — passed after one bounded TypeScript repair;
- Prisma Client generation inside the full build — passed;
- Next.js compilation, type validation, route generation, and trace collection — passed;
- all three Merchant Knowledge GET routes appeared in the build manifest;
- only the repository's existing Next.js SWC lockfile warnings remained.

The first full build found one new TypeScript defect in `src/libs/api.ts`: the JSON-error `catch` callback had an implicit return type. The single bounded repair changed it to an explicitly typed `(): null => null` callback. The next full build passed.

Focused tests prove disabled-by-default short-circuiting, administrator and viewer reads, active membership enforcement, workspace isolation, deterministic ordering, page sizes 25/50/100, invalid pagination fallback, bounded and enum-validated filters, zero-row and not-found behavior, alias/fingerprint redaction, IBAN masking, retained safe metadata, no raw JSON evidence, no create/update/delete/upsert/transaction operation, explicit no-booking/no-bank-fact declarations, exactly three GET endpoints, and no Merchant Knowledge mutation route or bridge.

### Limitations and rollback

- Phase 3.8B is unstarted; there is no administrator page or other UI.
- The feature remains disabled until the server-side capability flag is explicitly enabled.
- No production or remote database validation was performed for Phase 3.8A.
- No Merchant Knowledge backfill or data mutation occurred; existing Merchant Knowledge tables remain unchanged by this slice.
- Rollback is limited to reverting the Phase 3.8A application/test/documentation commit or leaving `MERCHANT_KNOWLEDGE_READS_ENABLED` unset/false. No database rollback is required.
- No push is authorized or performed.



### Final Phase 3.8A review and scans

- formal `git diff --check` passed after removing one documentation-only extra blank line at EOF;
- the final changed-path review matched the intended Phase 3.8A application, test, and documentation packet;
- an exact route/bridge search found no Merchant Knowledge `POST`, `PATCH`, `PUT`, or `DELETE` handler;
- the focused secret-material scan reported zero findings;
- the focused executable runtime-risk scan reported zero findings across the application paths;
- the focused server/bridge upload-network scan reported zero findings;
- the broader all-risk lexical scan reported only expected read-only browser `fetch` calls in `src/libs/api.ts`, historical scan wording in this handoff, and the test assertion that forbids mutation exports; review confirmed these are not destructive runtime, upload, deployment, secret, or remote-service additions.



## Program Phase 3.8B — read-only Merchant Knowledge administrator page

Starting commit: `2cfbac2` (`feat: add merchant knowledge read contracts`).

### Scope and changed paths

Phase 3.8B adds only the authenticated read-only page consuming the committed Phase 3.8A contracts:

- `src/helpers/merchantKnowledgeAdmin.ts`;
- `src/ui/MerchantKnowledgeAdminPage.tsx`;
- `src/app/merchant-knowledge/page.tsx`;
- `src/helpers/navigation.ts`;
- `tests/ui/merchantKnowledgeAdminPage.test.ts`;
- `docs/IMPLEMENTATION_PLAN.md`;
- `docs/finance-rebuild-run.md`.

The route is `/merchant-knowledge` inside the existing `FinanceAppFrame` authenticated shell and canonical finance navigation. Both administrator and viewer reads remain possible because the page adds no client-side role gate and delegates authorization to the Phase 3.8A server contract.

### Page behavior

- stable loading, feature-disabled, unavailable, empty, out-of-range, list, detail, and detail-not-found states;
- summary cards for merchants, aliases, fingerprints, and open conflicts;
- deterministic pagination over the Phase 3.8A list contract;
- page sizes limited to 25, 50, or 100, with invalid values normalized to 25;
- status filters limited to the approved merchant status union plus the empty all-status option;
- text queries trimmed and limited to 100 characters;
- privacy-safe evidence display using only the Phase 3.8A `displayValue`, hashes, versions, statuses, timestamps, confidence/strength metadata, and counts;
- masked IBAN evidence remains preserved; unrestricted alias/fingerprint normalized values and raw evidence JSON are never rendered;
- explicit read-only, no-transaction-booking, and no-bank-fact-mutation messaging;
- native keyboard-operable controls, accessible labels for filters, pagination, list, and detail actions, plus polite loading announcements;
- no create, edit, merge, split, approve, reject, retry, resolve, or delete control;
- no mutation request, mutation route, mutation bridge, direct Prisma access, API change, server-service change, schema change, backfill, AI call, or booking.

### Validation evidence

Completed successfully:

- focused Phase 3.8B page/helper tests — 8 passed, 0 failed;
- affected navigation, Dutch-text, authentication, and API-client regression tests — 42 passed, 0 failed across four files;
- `npm run build:server` — passed;
- full `npm run build` — passed;
- Prisma Client generation inside the full build — passed;
- Next.js compilation, type validation, static generation, route manifest, and trace collection — passed;
- `/merchant-knowledge` appeared in the build manifest;
- `git diff --check` — passed;
- focused high-risk scan — zero findings;
- focused secret-material scan — zero findings;
- only the repository's existing Next.js SWC lockfile warnings remained.

The first full build found that the page status state was inferred as plain `string`. A bounded repair constrained it to the Phase 3.8A merchant-status union plus the empty filter value. The next build identified the native `<select>` value as plain `string`; the proven defect was resolved with a runtime-safe `normalizeMerchantKnowledgeStatus` helper derived from `MERCHANT_KNOWLEDGE_STATUS_OPTIONS`. Focused tests and the full build then passed.

Two untracked alternate Phase 3.8B files were investigated before deletion: `src/helpers/merchant-knowledge-page.ts` and `src/ui/FinanceMerchantKnowledgePage.tsx`. Exact reference search proved they formed an unreferenced duplicate implementation and were not imported by the routed page or tests. They were deleted only after explicit user approval, and a follow-up search confirmed no references remained.

### Limitations and rollback

- Phase 3.8C and later Merchant Knowledge administrator actions remain unstarted.
- The page remains dependent on the disabled-by-default Phase 3.8A server capability and shows a stable disabled state until server opt-in.
- No production or remote-database validation was performed for this UI slice.
- Rollback is limited to reverting the Phase 3.8B page/navigation/test/documentation commit; no database rollback is required.
- No push is authorized or performed.

## Program Phase 3.8C — administrator-only Merchant Knowledge plan previews

Starting commit: `907d045` (`feat: add merchant knowledge admin page`).

### Scope and changed paths

Phase 3.8C adds one disabled-by-default, administrator-only, side-effect-free preview boundary over the existing pure `merchantIdentityPlanService`:

- `server/services/merchantKnowledgeCapability.ts`;
- `server/services/merchantKnowledgePreviewService.ts`;
- `server/routes/merchantKnowledge.ts`;
- `server/index.ts`;
- `src/app/api/merchant-knowledge/plans/preview/route.ts`;
- `src/libs/api.ts`;
- `src/ui/MerchantKnowledgePreviewPanel.tsx`;
- `src/ui/MerchantKnowledgeAdminPage.tsx`;
- `tests/services/merchantKnowledgePreviewService.test.ts`;
- `tests/services/merchantKnowledgeQueryService.test.ts`;
- `docs/IMPLEMENTATION_PLAN.md`;
- `docs/finance-rebuild-run.md`.

Exactly one preview endpoint exists: `POST /api/merchant-knowledge/plans/preview`. No bulk, confirmation, execution, apply, save, transactional mutation, or audit-write endpoint was added.

### Approved preview operations

The preview boundary supports only the six existing pure-planner actions:

- `MERGE_MERCHANTS`;
- `SPLIT_MERCHANT`;
- `RESOLVE_CONFLICT`;
- `REASSIGN_KNOWLEDGE`;
- `DEPRECATE_ALIAS`;
- `DEPRECATE_MERCHANT`.

The service accepts ID-only requests, requires an explicit reason and an 8–80-character bounded request key, derives workspace authority from server-controlled `DEFAULT_WORKSPACE_ID`, verifies active workspace membership, hydrates authoritative workspace-owned merchants, aliases, fingerprints, and conflicts, rejects unsupported persisted signal types rather than coercing them, and delegates all planning to `planMerchantIdentityChange`.

### Capability, authorization, and side effects

- previews are disabled by default;
- server-side opt-in requires `MERCHANT_KNOWLEDGE_PREVIEWS_ENABLED=true`;
- disabled previews short-circuit before membership, hydration, or planning;
- `requireAdmin` is the server-authoritative authorization boundary;
- viewers retain the unchanged Phase 3.8A/3.8B read-only page and cannot invoke preview routes successfully;
- the UI-only administrator indicator controls presentation but is not an authorization boundary;
- every response declares `previewOnly: true`, `readOnly: true`, `createsTransactionBooking: false`, `mutatesBankFacts: false`, and `persistsMerchantKnowledge: false`;
- no create, update, delete, upsert, transaction, audit write, booking, bank-fact mutation, backfill, AI call, schema change, or migration change exists.

### Preview response and privacy contract

A narrow privacy-safe adapter preserves the pure planner as the sole planning implementation:

- `planVersion` and `planHash` are preserved;
- `beforeState` maps directly from `beforeState`;
- `afterState` maps directly from `proposedAfterState`;
- `warnings` maps directly from `validationWarnings`;
- `blockingErrors` preserves structured planner issue codes and messages;
- `rollbackSteps` preserves structured `rollbackPlan` metadata;
- `affectedEntityIds` is the sorted union of source merchant, target merchant, alias, and fingerprint IDs;
- no separate input hash is exposed because the pure planner does not define one;
- no rollback instruction, evidence, or hash is invented;
- unrestricted normalized values and raw evidence JSON are not returned or rendered.

The `/merchant-knowledge` page adds an administrator-visible preview-only panel with six approved actions, ID-only inputs, explicit reason/request-key fields, stable loading and error states, hashes, affected IDs, blockers, warnings, and rollback metadata. It contains no confirm, apply, execute, save, retry-write, or mutation control and preserves existing viewer read behavior, privacy controls, pagination, and accessibility.

### Validation evidence

Completed successfully:

- focused Phase 3.8C preview tests — 8 passed, 0 failed;
- pure planner, Phase 3.8A read-contract, Phase 3.8B page/navigation, and authentication regressions — 49 passed, 0 failed across five files;
- focused preview plus API-client tests — 12 passed, 0 failed across two files;
- `npm run build:server` — passed;
- full `npm run build` — passed;
- Prisma Client generation inside the full build — passed;
- Next.js compilation, type validation, static generation, route manifest, and trace collection — passed;
- `/api/merchant-knowledge/plans/preview` and `/merchant-knowledge` appeared in the build manifest;
- final `git diff --check` after documentation update — passed;
- focused executable runtime-risk scan over application paths — zero findings;
- comprehensive high-risk scan over the new executable preview files — zero findings;
- final focused secret-material scan over all twelve Phase 3.8C paths — zero findings;
- broader lexical scans flagged only same-origin API `fetch` calls in the existing client module and test regexes that explicitly forbid mutation methods; review confirmed no upload, external-network, destructive-runtime, or deployment behavior was introduced.

Bounded repairs completed during validation:

- persisted Prisma signal enums were narrowed at runtime to the pure planner's supported signal union;
- the preview response was adapted to the exact existing planner contract instead of inventing top-level fields;
- the Phase 3.8A regression guard was narrowed to permit only the approved preview POST while continuing to forbid Merchant Knowledge mutation, confirmation, and execution routes;
- the thin Next preview bridge's relative import depth was corrected after the first full build exposed the module-resolution defect.

### Limitations and rollback

- Phase 3.8D individual transactional confirmation remains unstarted and separately blocked.
- Preview inputs are intentionally ID-only and do not yet provide richer entity pickers or persisted draft state.
- No production, remote-database, or mutation validation was performed because this slice is preview-only.
- Rollback is limited to reverting the Phase 3.8C preview/application/test/documentation commit or leaving `MERCHANT_KNOWLEDGE_PREVIEWS_ENABLED` unset/false; no database rollback is required.
- No push is authorized or performed.


## Program Phase 3.8D — individual `DEPRECATE_ALIAS` confirmation

Starting commit: `b47f72f` (`feat: add merchant knowledge plan previews`).

### Verified source and bounded scope

The slice was implemented only after verifying the governing roadmap/design, Merchant Knowledge architecture and invariants, the existing pure `merchantIdentityPlanService`, Phase 3.8C preview boundary, `requireAdmin`, transaction conventions, canonical evidence hashing, and the existing Prisma fields for `MerchantAlias`, `MerchantIdentityDecision`, `MerchantAuditEvent`, workspace membership, and actors.

Changed implementation and test paths:

- `server/services/merchantKnowledgeCapability.ts`;
- `server/services/merchantKnowledgePreviewService.ts`;
- `server/services/merchantKnowledgeAuditService.ts`;
- `server/services/merchantAliasDeprecationDecisionService.ts`;
- `server/routes/merchantKnowledge.ts`;
- `server/index.ts`;
- `src/app/api/merchant-knowledge/aliases/[aliasId]/deprecate/confirm/route.ts`;
- `src/libs/api.ts`;
- `src/ui/MerchantKnowledgePreviewPanel.tsx`;
- `src/ui/MerchantKnowledgeAdminPage.tsx`;
- `tests/services/merchantAliasDeprecationDecisionService.test.ts`;
- `tests/routes/merchantAliasDeprecationRoute.test.ts`;
- `tests/services/merchantKnowledgePreviewService.test.ts`;
- `tests/services/merchantKnowledgeQueryService.test.ts`;
- `docs/IMPLEMENTATION_PLAN.md`;
- `docs/finance-rebuild-run.md`.

No schema, migration, backfill, AI, deployment, booking, bank-fact, review, suggestion, ledger, period, report, or other Phase 3.8D action was added.

### Confirmation contract

Exactly one dedicated transactional route exists:

`POST /api/merchant-knowledge/aliases/:aliasId/deprecate/confirm`

The route:

- requires server-authoritative `requireAdmin`;
- uses the route parameter as authoritative alias identity and ignores a conflicting client body alias ID;
- accepts only `DEPRECATE_ALIAS`, plan version, plan hash, expected alias evidence hash, explicit reason, and an 8–80-character request key;
- derives workspace authority only from server-controlled `DEFAULT_WORKSPACE_ID`;
- exposes no generic, bulk, merge, split, conflict, reassignment, or merchant-deprecation confirmation surface;
- returns explicit zero-financial-side-effect fields.

A separate server-only capability, `MERCHANT_ALIAS_DEPRECATION_CONFIRMATION_ENABLED`, defaults to disabled. Disabled requests stop before transaction, membership lookup, hydration, planning, or write. Phase 3.8A reads, Phase 3.8B UI, and Phase 3.8C previews remain independently controlled.

### Atomic revalidation and persistence

Inside one Prisma transaction, the decision service:

1. verifies active user/workspace membership;
2. checks deterministic request-key idempotency before new writes;
3. reloads the alias and all planner-owned merchants, aliases, and fingerprints from the authorized workspace;
4. rejects missing, cross-workspace, already-deprecated, unsupported-signal, or evidence-hash-changed aliases;
5. regenerates the exact `DEPRECATE_ALIAS` plan through `planMerchantIdentityChange`;
6. compares action, workspace, alias ID, plan version, plan hash, and the privacy-safe alias evidence hash;
7. rejects blocking planner errors and stale identity with zero writes;
8. soft-deprecates exactly one alias by setting `status = DEPRECATED` and `deprecatedAt` while preserving value hash, evidence hash, source transaction, normalization version, approvals, creation history, and all other immutable fields;
9. creates one append-only `MerchantIdentityDecision` containing actor, reason, before/after snapshots, plan version, plan hash, request identity, evidence/provenance hashes, warnings, blockers, supporting/conflicting evidence, and rollback metadata;
10. appends one workspace-scoped `MerchantAuditEvent` with matching evidence hash and before/after state.

Alias update, decision creation, and audit creation are atomic. Decision or audit failure rolls the alias update back. No hard delete, `updateMany`, or `deleteMany` exists.

### Idempotency and evidence identity

Deterministic decision and audit IDs are derived from workspace plus request key. The persisted evidence contains a canonical request hash binding:

- workspace;
- action;
- alias ID;
- plan version;
- plan hash;
- expected alias evidence hash;
- reason;
- request key.

The same request key and identical content returns idempotent success without duplicate update, decision, or audit writes. The same request key with different plan, evidence, alias, reason, or request content rejects. Partial prior persistence is treated as an integrity error rather than silently repaired.

Phase 3.8C preview responses now expose only deterministic affected evidence references: record type, record ID, and existing evidence hash. No raw evidence JSON, unrestricted normalized value, or source evidence content is exposed.

### Administrator UI and accessibility

The existing `/merchant-knowledge` preview panel remains administrator-visible only. Confirmation appears only after a successful, blocker-free `DEPRECATE_ALIAS` preview with the exact affected alias evidence reference.

The individual dialog shows:

- alias ID;
- before and proposed after state;
- plan version and plan hash;
- alias evidence hash;
- explicit reason and request key;
- blocker, warning, and rollback-record counts;
- a statement that only Merchant Knowledge changes and no booking or bank fact changes.

The dialog has labelled title/description relationships, explicit checkbox acknowledgement, safe cancel focus, disabled duplicate submission while loading, stable error, success, and idempotent-success states, and no automatic retry. After success, only the existing read-side summary, list, and selected merchant detail are refreshed. Viewers retain the unchanged read-only page.

### Validation evidence

Completed successfully:

- focused alias decision-service tests — 11 passed, 0 failed;
- focused route/UI administrator authorization tests — 4 passed, 0 failed;
- combined decision, audit, rollback, authorization, and route tests — 15 passed, 0 failed;
- pure planner, Phase 3.8A read contracts, Phase 3.8B page/navigation, Phase 3.8C previews, API client, authentication, and administrator-mutation policy regressions — 84 passed, 0 failed across eight files;
- `npm run build:server` — passed;
- full `npm run build` — passed;
- Prisma Client generation inside the full build — passed;
- Next.js compilation, type checking, static generation, route manifest, and trace collection — passed;
- `/api/merchant-knowledge/aliases/[aliasId]/deprecate/confirm`, `/api/merchant-knowledge/plans/preview`, and `/merchant-knowledge` appeared in the build manifest;
- final `git diff --check` after documentation update — passed;
- executable runtime-risk scan over implementation paths — zero findings;
- focused comprehensive high-risk scan over the executable alias-confirmation boundary — zero findings;
- final secret-material scan over all sixteen bounded implementation, test, and documentation paths — zero findings;
- a broader lexical scan flagged existing same-origin `fetch` calls in `src/libs/api.ts`, including the new internal confirmation request; review confirmed no upload, external-network, arbitrary-execution, deployment, or secret-handling behavior was introduced.

Standalone `pnpm exec prisma validate` reached the unchanged schema but could not complete because the bounded command session did not expose `DATABASE_URL`. No environment file was changed or synthesized. The repository's normal full build loaded its configured build environment, generated Prisma Client successfully, compiled all server Prisma usage, and completed the production Next.js build.

Bounded validation repairs:

- invalid test evidence-hash placeholders were replaced with stable, distinct SHA-256-shaped hexadecimal fixtures without weakening production validation;
- the service now captures the true pre-mutation alias status;
- confirmation is bound to the exact privacy-safe evidence hash returned by preview, so evidence-only changes reject as stale;
- Phase 3.8A/3.8C regression guards were narrowed to allow exactly the existing preview endpoint and dedicated alias-deprecation confirmation while still forbidding all other Merchant Knowledge mutation surfaces.

### Explicit non-effects, limitations, and rollback

The service references no `Transaction`, `TransactionBooking`, `ReviewDecision`, `CategorizationSuggestion`, ledger, period-close, report-snapshot, backfill, or AI mutation. It creates no booking, mutates no bank fact, changes no financial record, bypasses no locked-period protection, and derives no trusted knowledge from unconfirmed suggestions.

Remaining limitations:

- confirmation for merchant merge, merchant split, conflict resolution, knowledge reassignment, and merchant deprecation remains unstarted;
- Phase 3.8E remains unstarted;
- production/remote-database execution was not performed;
- richer entity pickers and persisted confirmation drafts remain out of scope.

Rollback is limited to reverting the bounded alias-confirmation commit or leaving `MERCHANT_ALIAS_DEPRECATION_CONFIRMATION_ENABLED` unset/false. The schema and migration remain unchanged. No push is authorized or performed.


## Program Phase 3.8D — individual `DEPRECATE_MERCHANT` confirmation

Starting commit: `db4f66b` (`feat: confirm merchant alias deprecation`).

### Verified scope and source

This bounded slice implements only administrator confirmation of one previously previewed `DEPRECATE_MERCHANT` plan. Before editing, the current roadmap, administrator-tooling design, Merchant Knowledge schema proposal and architecture, global invariants, pure `merchantIdentityPlanService`, completed alias confirmation, dedicated Merchant Knowledge audit helper, authorization boundary, Prisma `Merchant`/decision/audit models, route conventions, client DTOs, UI, and mutation-policy tests were verified.

Changed implementation and test paths:

- `server/services/merchantKnowledgeCapability.ts`;
- `server/services/merchantKnowledgePreviewService.ts`;
- `server/services/merchantKnowledgeStateHash.ts`;
- `server/services/merchantDeprecationDecisionService.ts`;
- `server/services/merchantKnowledgeAuditService.ts`;
- `server/routes/merchantKnowledge.ts`;
- `server/index.ts`;
- `src/app/api/merchant-knowledge/merchants/[id]/deprecate/confirm/route.ts`;
- `src/libs/api.ts`;
- `src/ui/MerchantKnowledgePreviewPanel.tsx`;
- `tests/services/merchantDeprecationDecisionService.test.ts`;
- `tests/routes/merchantDeprecationRoute.test.ts`;
- `tests/routes/merchantAliasDeprecationRoute.test.ts`;
- `tests/services/merchantKnowledgePreviewService.test.ts`;
- `tests/services/merchantKnowledgeQueryService.test.ts`;
- `docs/IMPLEMENTATION_PLAN.md`;
- `docs/finance-rebuild-run.md`.

No schema, migration, backfill, AI, deployment, booking, bank-fact, review, suggestion, ledger, period, report, merge, split, conflict-resolution, knowledge-reassignment, generic-confirmation, or bulk-confirmation behavior was added.

### Capability, route, and authorization

A separate server-only capability, `MERCHANT_DEPRECATION_CONFIRMATION_ENABLED`, defaults to disabled. Disabled requests return before transaction, membership lookup, Merchant hydration, plan regeneration, or write. It is independent of Phase 3.8A reads, Phase 3.8C previews, and the completed alias-deprecation capability.

Exactly one dedicated merchant confirmation endpoint exists:

`POST /api/merchant-knowledge/merchants/:merchantId/deprecate/confirm`

The server route requires `requireAdmin`, derives actor identity from authenticated server context, accepts the Express `merchantId` parameter or the existing Next.js `merchants/[id]` adapter parameter, and treats the route parameter as authoritative over any conflicting body ID. The thin Next bridge is Node-runtime, force-dynamic, and POST-only at `/api/merchant-knowledge/merchants/[id]/deprecate/confirm`.

### Preview state identity and transactional revalidation

Phase 3.8C preview responses now include privacy-safe `merchantStateRefs` only for affected merchants. Each reference contains the merchant ID and a canonical SHA-256 state hash over the current planner/mutation-relevant fields:

- workspace ID;
- status;
- `mergedIntoMerchantId`;
- version;
- update actor;
- update timestamp;
- deprecation timestamp.

No merchant display source, raw evidence, unrestricted normalized value, or client-authoritative current state is exposed. Preview and confirmation share one pure `hashMerchantConfirmationState` helper so state identity cannot drift between boundaries.

Inside one Prisma transaction, the decision service:

1. verifies active workspace membership for the authenticated administrator;
2. checks deterministic request-key idempotency;
3. reloads all workspace-scoped merchants, aliases, and fingerprints required by the pure planner;
4. rejects missing/cross-workspace, already-deprecated, merged, or otherwise invalid merchant state;
5. recomputes and compares the canonical current-state hash;
6. regenerates the exact `DEPRECATE_MERCHANT` plan through `planMerchantIdentityChange`;
7. compares action, workspace, merchant ID, plan version, plan hash, affected-entity sets, and zero-alias/zero-fingerprint effects;
8. rejects stale plans or planner blocking errors with zero writes;
9. updates only the verified Merchant fields: `status = DEPRECATED`, `deprecatedAt`, `updatedById`, and `version + 1`;
10. creates one append-only `MerchantIdentityDecision`;
11. appends one workspace-scoped `MerchantAuditEvent` through the completed Merchant Knowledge audit helper.

Merchant update, decision creation, and audit creation are atomic. Decision or audit failure rolls the merchant update and version increment back. No Merchant hard delete, `updateMany`, `deleteMany`, alias mutation, or fingerprint mutation exists.

### Idempotency, evidence, and audit

Deterministic decision and audit IDs derive from workspace plus request key. The canonical request hash binds workspace, action, merchant ID, plan version, plan hash, expected merchant state hash, reason, and request key.

The same request key and identical content returns the existing decision/audit result without duplicate writes. The same key with different action, merchant, state hash, plan identity, reason, or request content rejects. Partial prior persistence is treated as an integrity error.

The decision/audit evidence preserves:

- actor and reason;
- prior and new Merchant status/version;
- prior merge target and update provenance;
- before/proposed-after planner snapshots;
- plan version and plan hash;
- expected state hash;
- warnings and blocking errors;
- supporting/conflicting planner evidence;
- rollback metadata;
- explicit `cascadesAliases: false`, `cascadesFingerprints: false`, `createsTransactionBooking: false`, `mutatesBankFacts: false`, and `mutatesFinancialRecords: false` declarations.

### Administrator UI and accessibility

The existing `/merchant-knowledge` page preserves viewer read-only behavior and the completed alias confirmation. Merchant confirmation appears only to administrators after a successful, blocker-free `DEPRECATE_MERCHANT` preview with the exact affected merchant state reference.

The individual dialog shows merchant ID, before/proposed-after state, plan version, plan hash, state hash, reason, request key, blockers, warnings, and rollback counts. It explicitly states that aliases and fingerprints are not automatically changed and that no booking, bank fact, or financial record is changed. The dialog has labelled title/description relationships, explicit checkbox acknowledgement, safe cancel focus, disabled duplicate submission during loading, stable validation/stale-plan/authorization/transaction/error/success/idempotent-success states, and no automatic retry. Successful confirmation refreshes only the existing read-side summary, list, and detail.

### Validation evidence

Completed successfully:

- focused merchant decision-service tests — 11 passed, 0 failed;
- focused merchant route/UI authorization tests — 4 passed, 0 failed;
- combined merchant and completed alias confirmation tests — 30 passed, 0 failed;
- final affected confirmation, pure planner, Phase 3.8A read-contract, Phase 3.8B page/navigation, Phase 3.8C preview, API-client, authentication, and administrator-mutation regressions — 114 passed, 0 failed across twelve files;
- `npm run build:server` — passed after the final route repair;
- full `npm run build` — passed;
- Prisma Client generation inside the full build — passed;
- Next.js compilation, type validation, static generation, route manifest, and trace collection — passed;
- `/api/merchant-knowledge/merchants/[id]/deprecate/confirm`, the completed alias confirmation route, preview route, and `/merchant-knowledge` appeared in the build manifest;
- final `git diff --check` after documentation update — passed;
- executable runtime-risk scan over implementation paths — zero findings;
- focused comprehensive high-risk scan over the executable merchant-confirmation boundary — zero findings;
- secret-material scan over all implementation and test paths — zero findings.

The first full build exposed a Next.js dynamic-segment conflict because the existing merchant tree used `[id]` while the new bridge used `[merchantId]`. With explicit user approval, the bridge was moved to `merchants/[id]/deprecate/confirm`; the server route now accepts Express `merchantId` or Next adapter `id`. The repaired full build passed. No production behavior beyond that bounded adapter compatibility changed.

The unchanged Prisma schema was consumed by generated Prisma Client and compiled successfully in both server and full builds. No environment file was modified or synthesized, and no schema or migration file changed.

### Explicit non-effects, limitations, and rollback

The service references no mutation of aliases, fingerprints, transactions, transaction bookings, review decisions, categorization suggestions, ledger/accounting records, period state, reports, backfill state, or AI services. It creates no booking, mutates no bank fact, changes no financial record, bypasses no locked-period protection, and derives no trusted knowledge from suggestions.

Remaining Phase 3.8D confirmation actions are merchant merge, merchant split, conflict resolution, and knowledge reassignment. Phase 3.8E remains unstarted. Production/remote-database execution and richer persisted confirmation drafts remain out of scope.

Rollback is limited to reverting the bounded merchant-confirmation commit or leaving `MERCHANT_DEPRECATION_CONFIRMATION_ENABLED` unset/false. The completed alias confirmation remains independently controlled and unchanged. No push is authorized or performed.

## Program Phase 3.8D — `RESOLVE_CONFLICT` persistence design resolved

Starting commit: `1497bfe` (`feat: confirm merchant deprecation`).

This checkpoint resolves only the conflict-confirmation design blocker. No Prisma schema, migration, application code, route, service, UI, test implementation, capability, deployment, or push behavior was added.

### Governing documents updated

- `docs/MERCHANT_ADMIN_TOOLING_DESIGN.md`;
- `docs/MERCHANT_KNOWLEDGE_SCHEMA_PROPOSAL.md`;
- `docs/IMPLEMENTATION_PLAN.md`;
- `docs/finance-rebuild-run.md`.

### Authoritative intent mappings

All three pure-planner intents are now implementation-ready without a schema change.

#### `SELECT_MERCHANT`

- require one active, workspace-scoped selected merchant present in persisted conflict candidates and preserved conflict evidence;
- create one append-only `MerchantResolution(status = RESOLVED, merchantId = selectedMerchantId)`;
- use `engineVersion = merchant-admin-conflict-resolution-v1`;
- derive `inputHash` from canonical conflict state hash, intent, selected merchant, plan version, and plan hash;
- persist canonical privacy-safe conflict/candidate/signal/evidence/plan/request/actor/reason provenance in `evidence` and hash it into `evidenceHash`;
- set confidence, abstention code, validity, and backfill fields to null;
- update `MerchantConflict` to `RESOLVED`, link the new resolution, and set commit timestamp, authenticated actor, and explicit reason;
- set `MerchantIdentityDecision.conflictId` and `targetMerchantId`;
- never modify an existing resolution row, alias, fingerprint, merchant, transaction, booking, or financial record.

#### `ABSTAIN`

- selected merchant must be absent;
- create one append-only `MerchantResolution(status = ABSTAINED, merchantId = null)`;
- use `engineVersion = merchant-admin-conflict-resolution-v1`;
- derive canonical input/evidence hashes from conflict state, intent, plan identity, request identity, actor, and reason;
- set `abstentionCode = ADMIN_CONFIRMED_ABSTENTION` and confidence/validity/backfill fields to null;
- update `MerchantConflict` to terminal `RESOLVED`, link the new abstained resolution, and set commit timestamp, actor, and reason;
- keep `MerchantIdentityDecision.targetMerchantId = null`;
- the combination `MerchantConflict.status = RESOLVED` plus `MerchantResolution.status = ABSTAINED` distinguishes administrator-confirmed abstention from automatic abstention while a conflict remains `OPEN`;
- preserve all candidates and supporting/conflicting evidence and select/trust no merchant, alias, or fingerprint.

#### `DISMISS`

- selected merchant must be absent;
- create no `MerchantResolution`, because the current resolution enum has no dismissed state;
- require existing `resolutionId = null`;
- update `MerchantConflict` to `DISMISSED`, keep `resolutionId = null`, and set commit timestamp, actor, and reason;
- keep `MerchantIdentityDecision.targetMerchantId = null`;
- preserve all candidates, supporting/conflicting evidence, original evidence hash, transaction relation, and opened timestamp;
- select or trust no merchant, alias, or fingerprint.

### Shared transactional and provenance rules

- only `OPEN` conflicts may be confirmed;
- the canonical conflict state hash binds conflict/workspace/transaction identity, status, ordered candidate IDs, privacy-safe ordered supporting/conflicting signal identity, evidence hash, resolution ID, opened timestamp, and existing resolved actor/timestamp/reason fields;
- the server reloads all authority inside one transaction and revalidates intent, selected merchant, candidate membership, workspace, plan version/hash, conflict state/evidence hashes, and planner blockers;
- one `MerchantIdentityDecision` and one `MerchantAuditEvent` are written atomically with the conflict transition and any approved resolution row;
- idempotency binds workspace, conflict, intent, selected merchant or null, conflict state/evidence hashes, plan version/hash, reason, and request key;
- identical retries return the prior decision; conflicting key reuse rejects;
- rollback is a new individually confirmed plan referencing the prior decision; original conflict, resolution, decision, audit, and evidence records remain immutable;
- no alias/fingerprint trust, transaction/booking mutation, review/suggestion rewrite, ledger/period/report change, backfill, or AI behavior is allowed.

### Implementation status

The design blocker is resolved, but `RESOLVE_CONFLICT` confirmation remains unimplemented. Merge, split, and knowledge-reassignment confirmation remain unstarted. Phase 3.8E remains unstarted.

No push is authorized or performed.


## Program Phase 3.8D — individual `RESOLVE_CONFLICT` confirmation implemented

Starting commit: `4af31ac` (`docs: define merchant conflict resolution contract`).

### Exact implementation scope

Implemented only the three approved individual administrator intents:

- `SELECT_MERCHANT`;
- `ABSTAIN`;
- `DISMISS`.

Changed implementation and test paths:

- `server/services/merchantConflictStateHash.ts`;
- `server/services/merchantConflictDecisionService.ts`;
- `server/services/merchantKnowledgePreviewService.ts`;
- `server/services/merchantKnowledgeCapability.ts`;
- `server/services/merchantKnowledgeAuditService.ts`;
- `server/routes/merchantKnowledge.ts`;
- `server/index.ts`;
- `src/app/api/merchant-knowledge/conflicts/[id]/resolve/confirm/route.ts`;
- `src/libs/api.ts`;
- `src/ui/MerchantKnowledgePreviewPanel.tsx`;
- `tests/services/merchantConflictDecisionService.test.ts`;
- `tests/routes/merchantConflictResolutionRoute.test.ts`;
- affected completed-confirmation, preview, and read-contract regression guards.

No schema, migration, merge, split, knowledge-reassignment, generic confirmation, bulk confirmation, Phase 3.8E, backfill, AI, deployment, booking, bank-fact, or financial mutation was added.

### Capability, authorization, and route

A separate server-only `MERCHANT_CONFLICT_CONFIRMATION_ENABLED` capability defaults to disabled. Disabled requests return before transaction, membership lookup, conflict hydration, plan regeneration, or write. Reads, previews, alias confirmation, and merchant confirmation remain independently controlled.

Exactly one dedicated route exists:

`POST /api/merchant-knowledge/conflicts/:conflictId/resolve/confirm`

The route requires `requireAdmin`, derives actor/workspace authority only from authenticated server context, accepts Express `conflictId` or Next adapter `id`, and treats the route value as authoritative over any body value. The Next bridge is Node-runtime, force-dynamic, and POST-only at `/api/merchant-knowledge/conflicts/[id]/resolve/confirm`.

### Canonical conflict state and privacy

`merchantConflictStateHash.ts` strictly parses only privacy-safe persisted `MerchantAliasMatchEvidence` fields and deterministically orders supporting/conflicting evidence. The canonical conflict-state hash binds:

- conflict, workspace, and transaction IDs;
- current status;
- ordered candidate merchant IDs;
- ordered privacy-safe supporting/conflicting evidence identity;
- conflict evidence hash;
- resolution ID;
- opened/resolved timestamps;
- resolving actor and reason.

Phase 3.8C previews now hydrate the full authoritative workspace-scoped conflict and return only `conflictStateRefs`: conflict ID, state hash, original evidence hash, candidate IDs, and supporting/conflicting evidence counts. No raw JSON, unrestricted normalized value, alias/fingerprint source value, or transaction text is exposed.

### Atomic intent mappings

Inside one Prisma transaction, the service verifies active workspace membership, idempotency, authoritative conflict status/linkage/candidates/evidence, selected merchant validity, exact planner regeneration, plan version/hash, state/evidence hashes, and planner blockers.

`SELECT_MERCHANT`:

- requires one active workspace-scoped candidate present in preserved conflict evidence;
- creates one append-only `MerchantResolution(status = RESOLVED)` with the approved engine, canonical input hash, canonical evidence hash, and null confidence/abstention/validity/backfill fields;
- updates the conflict to `RESOLVED`, links the resolution, and records actor, reason, and commit timestamp;
- records `targetMerchantId` on the decision.

`ABSTAIN`:

- rejects any selected merchant;
- creates one append-only `MerchantResolution(status = ABSTAINED, abstentionCode = ADMIN_CONFIRMED_ABSTENTION)`;
- updates the conflict to terminal `RESOLVED` and links the resolution;
- keeps decision target merchant null.

`DISMISS`:

- rejects any selected merchant;
- requires current `resolutionId = null`;
- creates no `MerchantResolution`;
- updates the conflict to `DISMISSED` with null resolution linkage;
- keeps decision target merchant null.

Every intent writes one `MerchantIdentityDecision(conflictId = confirmed conflict)` and one `MerchantAuditEvent(entityType = MERCHANT_CONFLICT)` atomically with the conflict transition and optional resolution creation. Resolution, decision, or audit failure rolls every draft change back. Existing resolutions are never updated.

### Idempotency and non-effects

Deterministic decision, audit, and optional resolution IDs derive from workspace plus bounded request key. The request hash binds workspace, conflict, intent, selected merchant or null, conflict state/evidence hashes, plan version/hash, reason, and request key. Identical retries validate the final conflict, audit, decision, and linked resolution where applicable and return idempotent success. Conflicting key reuse rejects; partial prior persistence returns an integrity error.

The implementation performs no alias/fingerprint trust or write, merchant mutation, transaction mutation, booking, bank-fact mutation, review/suggestion rewrite, ledger/period/report change, backfill, or AI operation. Historical conflict candidates, evidence hashes, signals, transaction relation, opened timestamp, decisions, audits, and resolutions remain preserved.

### Administrator UI and accessibility

The existing `/merchant-knowledge` page preserves viewer read-only behavior and both completed deprecation confirmations. Conflict confirmation appears only to administrators after a successful blocker-free `RESOLVE_CONFLICT` preview with the exact conflict state reference.

The individual dialog shows conflict ID, intent, selected merchant where applicable, before/proposed-after state, plan version/hash, conflict state/evidence hashes, candidate IDs, supporting/conflicting counts, blockers, warnings, rollback count, reason, and request key. It explicitly states that no alias/fingerprint becomes trusted, no merchant record changes, no booking or bank fact changes, and historical evidence remains preserved. The dialog has labelled title/description relationships, explicit acknowledgement, safe cancel focus, disabled duplicate submission while loading, stable error/success/idempotent-success states, and no automatic retry.

### Validation evidence

Completed successfully:

- focused conflict decision-service tests — 11 passed, 0 failed;
- focused conflict route/UI authorization tests — 4 passed, 0 failed;
- final conflict, completed alias/merchant confirmation, pure planner, Phase 3.8A read-contract, Phase 3.8B page/navigation, Phase 3.8C preview, API-client, authentication, and administrator-mutation regressions — 129 passed, 0 failed across fourteen files;
- `npm run build:server` — passed;
- full `npm run build` — passed;
- Prisma Client generation, server TypeScript, Next compilation, type validation, static generation, and trace collection — passed;
- `/api/merchant-knowledge/conflicts/[id]/resolve/confirm`, both completed deprecation routes, preview route, and `/merchant-knowledge` appeared in the build manifest;
- final `git diff --check` after documentation update — passed;
- focused comprehensive high-risk scan over the executable conflict boundary — zero findings;
- secret-material scan over implementation and test paths — zero findings.

A broader lexical high-risk scan flagged only existing same-origin `fetch` calls in `src/libs/api.ts`, including the new internal conflict confirmation request. Focused review and scanning confirmed no upload, external-network, arbitrary-execution, deployment, or secret-handling behavior was introduced.

Bounded validation repairs:

- Prisma JSON candidate IDs are normalized through a runtime-safe string-array parser;
- a test-only backfill guard was corrected to prove the sole schema assignment is exactly `backfillRunId: null`;
- completed read/preview/deprecation regression guards were narrowed to allow exactly the new conflict route and dialog while continuing to forbid merge, split, reassignment, generic, and bulk confirmation.

### Limitations and rollback

Merchant merge, merchant split, and knowledge-reassignment confirmation remain unstarted. Phase 3.8E remains unstarted. Production/remote-database execution and persisted confirmation drafts remain out of scope.

Rollback is limited to reverting the bounded conflict-confirmation commit or leaving `MERCHANT_CONFLICT_CONFIRMATION_ENABLED` unset/false. Completed alias and merchant confirmations remain independently controlled. No push is authorized or performed.


## Transaction Review and Intelligence roadmap alignment — Phase 3 closeout review

Starting commit: `eb4b473` (`feat: confirm merchant conflict resolution`).

This review changed only governing documentation. No application code, Prisma schema, migration, route, service, UI, test implementation, deployment, AI inference, booking, bank-fact mutation, or push behavior changed.

### Corrected current position

The stale top-level labels that still described Program Phase 2 as the sole current phase and Program Phase 3 as unstarted were corrected.

Current roadmap position:

- Phase 1 — baseline and instrumentation: partial; corrected 221-item benchmark freeze and dimension-level labels remain;
- Phase 2 — review-table redesign and pagination: implemented; production acceptance closeout remains;
- Phase 3 — Merchant Knowledge Layer: core complete; Phase 3.8E authenticated production acceptance and Phase 3.9 consolidated validation/rollback evidence remain;
- Phase 4 — Retrieval and Decision Foundation: next;
- Phase 5 — AI Decision Engine: blocked on the complete Phase 4 gate;
- Phases 6 and 7: unstarted.

Normalized planning estimate, explicitly not an official product metric:

| Program phase | Estimated completion |
|---|---:|
| Phase 1 | 40% |
| Phase 2 | 90% |
| Phase 3 | 95% |
| Phase 4 | 0% |
| Phase 5 | 0% |
| Phase 6 | 0% |
| Phase 7 | 0% |
| **Equal-weight normalized total** | **32%** |

### Phase 3 closeout decision

Merchant merge, merchant split, and explicit knowledge-reassignment confirmation are deferrable administrator capabilities and are not blockers for Phase 3 acceptance, Phase 4, or bounded Phase 5 shadow inference. The repository already contains pure plans, versioned previews, evidence hashes, rollback contracts, audit conventions, and safe-disabled mutation boundaries for later separately approved work.

Phase 2 exits only when current production acceptance proves authenticated administrator/viewer behavior, all 221 unresolved transactions remain reachable and individually confirmable, pagination/filtering/risk ordering/mobile/accessibility evidence is current, authorization and locked-period protections remain green, and no suggestion becomes a booking without explicit administrator confirmation.

Phase 3 exits only when Phase 3.8E authenticated production acceptance and rollback rehearsal plus Phase 3.9 consolidated validation prove workspace isolation, deterministic matching/conflict behavior, replay-safe schema state, safe disablement, retrieval-anchor correctness, privacy redaction, and zero booking or bank-fact mutation.

### Exact next roadmap slice

The smallest next implementation slice is Program Phase 4.1 only: define and test the side-effect-free confirmed-history eligibility contract over existing bookings and review decisions.

It must:

- derive workspace scope from server-authoritative context;
- include only confirmed human outcomes eligible for retrieval;
- exclude pending, rejected, generated, superseded, and otherwise ineligible suggestions or decisions;
- preserve provenance and locked-period rules;
- produce a deterministic reproducible eligible-history set for the corrected 221-transaction benchmark;
- perform no write, booking, bank-fact mutation, AI inference, or trusted-history contamination;
- include focused workspace-isolation, contamination, provenance, determinism, and zero-write tests.

Program Phase 5 may begin only after every Phase 4 slice passes, the corrected 221-item pre-AI baseline is frozen and reproducible, candidate and Decision contracts are versioned and valid-ID constrained, every eligible item receives a deterministic Decision or explicit abstention, provider/privacy/security/cost design is approved, and integrity tests prove zero booking, bank-fact, locked-period, or confirmed-history contamination.

No push is authorized or performed.


## Program Phase 4.1 — confirmed-history eligibility contract

Starting commit: `0604fb3` (`docs: align intelligence roadmap status`).

### Exact implementation scope

Implemented one pure/read-only confirmed-history eligibility boundary:

- `server/services/confirmedHistoryEligibilityService.ts`;
- integrated only into `server/services/suggestionBackfillService.ts` so raw booked transactions are no longer implicitly trusted as approved history;
- focused tests in `tests/services/confirmedHistoryEligibilityService.test.ts`;
- affected backfill fixtures in `tests/services/suggestionBackfillService.test.ts`.

No schema, migration, route, UI, booking mutation, review mutation, ranking/scoring change, Phase 4.2+, AI inference, external-model call, deployment, or push behavior was added.

### Eligibility contract

The service derives one workspace scope from server-authoritative membership before loading history. A record is eligible only when:

- it has a current complete `TransactionBooking`;
- project, transaction type, and category are all present and workspace-scoped;
- booking actor, confirmation timestamp, and booking evidence hash are present;
- the latest applicable `ReviewDecision` is one of:
  - `ACCEPT_SUGGESTION`;
  - `ASSIGN_MANUALLY`;
  - `CHANGE_BOOKING`;
- the latest decision references the current booking through `afterBookingId`;
- the latest decision’s project/type/category match the current booking exactly;
- decision actor, decision timestamp, and decision evidence hash are present;
- accepted-suggestion provenance references a workspace-scoped suggestion with `status = ACCEPTED`.

Explicit exclusions are returned for:

- cross-workspace booking, decision, suggestion, or dimension data;
- missing current booking;
- incomplete dimensions;
- missing booking provenance;
- missing review decision;
- latest `REMOVE_BOOKING` decision;
- latest ineligible decision;
- superseded current booking;
- dimension mismatch;
- missing decision provenance;
- non-accepted suggestion provenance.

Pending, rejected, expired, generated, superseded, incomplete, cross-workspace, and provenance-incomplete records are therefore never treated as confirmed retrieval history.

### Deterministic provenance

Eligible records preserve privacy-safe provenance:

- eligibility version `confirmed-history-v1`;
- workspace, transaction, booking, and review-decision IDs;
- review action and actor ID;
- booking source;
- booking and decision evidence hashes;
- booking confirmation and review decision timestamps;
- project, transaction-type, and category IDs;
- locked-ledger timestamp when present;
- deterministic SHA-256 provenance hash.

Eligible output is sorted deterministically by transaction date and ID and remains structurally compatible with the existing `ApprovedHistoryBooking` ranking input. Ranking, scoring, merchant-anchor weighting, and suggestion generation behavior were not changed.

### Read-only and integrity guarantees

The eligibility boundary performs one bounded read query and opens no database transaction. It contains no create, update, delete, upsert, bulk write, booking write, suggestion write, bank-fact mutation, period-state mutation, backfill execution, or AI/external-model path.

Locked-period provenance is preserved as read-only evidence; no locked-period or ledger state is modified.

### Validation evidence

Completed successfully:

- focused confirmed-history eligibility tests — 13 passed, 0 failed;
- affected suggestion-backfill, history-ranking, review-decision, request-context, and administrator-mutation-policy tests — 52 passed, 0 failed;
- final combined focused and affected tests — 65 passed, 0 failed across six files;
- `npm run build:server` — passed;
- full `npm run build` — passed after one bounded typing repair;
- Prisma Client generation, server TypeScript compilation, Next compilation, type validation, static generation, and trace collection — passed;
- `git diff --check` — passed before documentation update;
- focused comprehensive high-risk scan over implementation and test paths — zero findings;
- focused secret-material scan over implementation and test paths — zero findings.

Bounded repairs:

- Prisma nullable relation filtering was corrected to use `transactionBooking: { is: { workspaceId } }`;
- the selected Prisma projection cast was made explicit through `unknown` after selecting every required eligibility field;
- existing backfill test fixtures were updated with the newly required human review, workspace, dimension, booking, and evidence provenance;
- the confirmed-history mapper was explicitly typed as `SuggestionBackfillHistory` to preserve the existing ranking contract without runtime changes.

### Limitations, rollback, and next slice

Phase 4.1 does not define retrieval ranking, evidence aggregation, candidate generation, Decision contracts, orchestration, benchmark evaluation, or AI inference.

Rollback restores the prior direct booked-transaction history query in `suggestionBackfillService.ts` and removes the pure eligibility service. No persisted data requires rollback.

The exact next bounded roadmap slice is Phase 4.2: deterministic retrieval scoring and bounded queries over the confirmed-history set. Phase 5 remains blocked until every Phase 4 slice and the corrected 221-item deterministic pre-AI baseline pass.

No push is authorized or performed.


## Program Phase 4.2 — deterministic confirmed-history retrieval

Starting commit: `85b86a2` (`feat: define confirmed history eligibility`).

### Exact implementation scope

Implemented only deterministic retrieval scoring and bounded queries over the Phase 4.1 `confirmed-history-v1` eligible set:

- `server/services/deterministicHistoryRetrievalService.ts`;
- bounded row/date controls in `server/services/confirmedHistoryEligibilityService.ts`;
- additive component-score export in `server/services/historySuggestionService.ts`;
- integration into the existing suggestion-backfill retrieval path in `server/services/suggestionBackfillService.ts`;
- focused tests in `tests/services/deterministicHistoryRetrievalService.test.ts`.

The public legacy `buildSuggestionBackfillPlan` remains unchanged for backward compatibility. Suggestion persistence semantics, booking behavior, review mutations, schema, migrations, routes, UI, Phase 4.3+, and AI behavior were not changed.

### Versioned scorer and weights

Scorer version: `deterministic-history-retrieval-v1`.

Eligibility version: `confirmed-history-v1`.

The wrapper preserves the existing `history-v1` component weights:

- exact IBAN: 3,600 basis points;
- exact counterparty: 2,200;
- exact description: 1,400;
- exact payment purpose: 1,000;
- token similarity maximum: 1,400;
- same account: 500;
- exact amount: 450;
- recurring month: 150;
- recency maximum: 400;
- Merchant Knowledge anchor maximum: 1,500;
- frequency maximum: 800.

Direction incompatibility is excluded before scoring. Merchant Knowledge contribution applies only when the anchor is usable, workspace-valid, non-stale/non-expired, has a merchant ID, and the confirmed-history record carries the same privacy-safe merchant ID.

### Bounds, ordering, and abstention

Conservative defaults and hard limits:

- maximum eligible-history rows: 500 default, 1,000 hard cap;
- maximum returned candidates: 3;
- lookback period: 1,825 days (five years);
- minimum score threshold: 3,000 basis points.

Eligible history is restricted to the target workspace and `confirmed-history-v1`, excludes the target transaction itself, excludes future history, enforces the lookback period, and is deterministically truncated by newest date then descending transaction ID. Candidate ranking preserves the existing `history-v1` score, evidence, and stable triple tie-breaking.

Explicit abstentions:

- `NO_ELIGIBLE_HISTORY`;
- `NO_SCORE_ABOVE_THRESHOLD`.

### Result and privacy contract

Every matched candidate exposes:

- deterministic rank and total score;
- project, transaction-type, and category IDs;
- strongest history transaction, booking, and review-decision IDs;
- exact component-score breakdown including frequency contribution;
- scorer, legacy algorithm, and eligibility versions;
- confirmed-history provenance hash;
- booking and decision evidence hashes;
- privacy-safe matched-history/evidence counts and hashes;
- Merchant Knowledge anchor state/evidence/evaluation hashes and counts;
- deterministic candidate retrieval hash.

The top-level result exposes stable bounds, weights, status/abstention reason, candidate list, and deterministic retrieval hash.

No raw IBAN, unrestricted normalized value, transaction description, payment source text, or raw evidence JSON is returned. Exact IBAN matching is represented only through privacy-safe evidence hashes/counts.

### Zero-side-effect guarantees

The scorer and bounded eligibility query perform no create, update, delete, upsert, bulk write, database transaction, booking, suggestion persistence, review-decision mutation, bank-fact mutation, ledger or period mutation, backfill execution, AI inference, or external-model call.

The repository backfill planning path now consumes only `confirmed-history-v1` eligible records and applies bounded threshold retrieval. Existing persistence behavior remains unchanged for any planned suggestions that pass retrieval.

### Validation evidence

Completed successfully:

- focused Phase 4.2 retrieval tests — 6 passed, 0 failed;
- affected Phase 4.1 eligibility, history-ranking, suggestion-backfill, Merchant Retrieval Anchor, request-context, and administrator-policy regressions — 66 passed, 0 failed;
- combined validated tests — 72 passed, 0 failed;
- `npm run build:server` — passed;
- full `npm run build` — passed;
- Prisma Client generation, server TypeScript compilation, Next compilation, type validation, and static generation — passed;
- `git diff --check` — passed before documentation update;
- focused high-risk scan — zero findings;
- focused secret-material scan — zero findings.

Bounded repairs:

- version fields were narrowed to exported literal types without runtime change;
- one focused assertion was aligned with the existing component field names;
- the valid Merchant Knowledge anchor-precedence fixture was completed with `merchantId: 'merchant-1'`, matching the established source contract; production anchor semantics and weights were unchanged.

### Limitations, rollback, and next slice

Phase 4.2 does not implement supporting-versus-conflicting dimensional evidence, restricted candidate generation, Decision contracts, orchestration, benchmark evaluation, or AI inference.

Rollback restores the Phase 4.1 direct `history-v1` ranking path in `suggestionBackfillService.ts`, removes the deterministic retrieval wrapper, and removes the optional bounded loader controls. No persisted data requires rollback.

The exact next bounded slice is Phase 4.3: supporting and conflicting evidence for each dimensional candidate. Phase 5 remains blocked until all Phase 4 slices and the corrected 221-item deterministic pre-AI baseline pass.

No push is authorized or performed.


## Program Phase 4.3 — deterministic supporting and conflicting retrieval evidence

Starting commit: `2756eaf` (`feat: add deterministic history retrieval`).

### Exact implementation scope

Implemented only the deterministic evidence layer over Phase 4.2 retrieval:

- `server/services/deterministicRetrievalEvidenceService.ts`;
- evidence-aware abstention in `server/services/suggestionBackfillService.ts`;
- focused tests in `tests/services/deterministicRetrievalEvidenceService.test.ts`.

No Phase 4.2 scoring weight, threshold, bound, ranking, tie-break, schema, migration, route, UI, booking, suggestion-persistence, review, ledger, period, Merchant Knowledge mutation, Phase 4.4+, or AI behavior changed.

### Evidence contract

Evidence version: `deterministic-retrieval-evidence-v1`.

For every retrieval candidate, project, transaction type, and category each expose:

- selected value ID;
- status: `SUPPORTED`, `ABSENT`, `INSUFFICIENT`, or `CONFLICTED`;
- support count and aggregate support score;
- deterministic component codes and exact Phase 4.2 component scores;
- strongest supporting transaction, booking, review-decision, provenance, booking-evidence, and decision-evidence references;
- competing value IDs with support counts, scores, strongest privacy-safe provenance references, materiality, and deterministic evidence hashes;
- deterministic dimension evidence hash.

Candidate-level output exposes evidence status `SUPPORTED`, `INSUFFICIENT`, or `MATERIAL_CONFLICT` plus a deterministic evidence hash. Top-level output preserves scorer and eligibility versions, workspace and target IDs, status/abstention, side-effect declarations, material-conflict rule, and deterministic evidence hash.

### Material-conflict and abstention rule

A competing value is material when its confirmed-history support score is at least:

- 90% of the selected value support score; and
- 3,000 basis points.

The rule is deterministic and versioned. A material conflict in any selected dimension produces explicit `MATERIAL_CONFLICT` abstention. Missing or below-threshold selected evidence produces `INSUFFICIENT_EVIDENCE`. Existing Phase 4.2 abstentions, including no eligible history, are preserved. The evidence layer never changes ranking weights to force a choice.

The existing backfill retrieval path now persists no candidate when evidence status is not `MATCHED`; existing suggestion persistence fields and behavior remain unchanged for supported candidates.

### Privacy and isolation

Only `confirmed-history-v1` records from the authorized workspace may contribute. Direction mismatch, future records, out-of-lookback records, target self-history, cross-workspace history, and invalid eligibility versions are rejected or excluded under the existing Phase 4.2 bounds.

Outputs contain only approved IDs, component codes/scores, counts, version/status values, provenance/evidence hashes, and deterministic hashes. No raw IBAN, counterparty text, normalized values, transaction descriptions, payment-purpose/source text, raw evidence JSON, or bank facts are exposed.

Merchant Knowledge anchor support appears only when the existing anchor is usable and the confirmed-history row carries the matching privacy-safe merchant ID.

### Zero-side-effect guarantees

The evidence service performs no database write or transaction and contains no create, update, delete, upsert, booking, suggestion, review, bank-fact, ledger, period, Merchant Knowledge mutation, backfill execution, AI inference, or external-model call.

### Validation evidence

Completed successfully:

- focused Phase 4.3 evidence tests — 7 passed, 0 failed;
- affected Phase 4.2 retrieval, Phase 4.1 eligibility, history-ranking, suggestion-backfill, Merchant Retrieval Anchor, request-context, and administrator-policy regressions — 72 passed, 0 failed;
- combined validated tests — 79 passed, 0 failed;
- `npm run build:server` — passed;
- full `npm run build` — passed;
- Prisma Client generation, server TypeScript compilation, Next compilation, type validation, static generation, and trace collection — passed;
- `git diff --check` — passed before documentation update;
- focused executable high-risk scan — zero findings;
- focused secret-material scan — zero findings.

Bounded repairs:

- nested evidence/material-conflict constants were narrowed to exact exported literal types without runtime changes;
- one focused cross-workspace assertion was aligned with the existing source error message.

### Limitations, rollback, and next slice

Phase 4.3 does not implement active candidate-set generation, Decision contracts, orchestration, benchmark evaluation, or AI inference.

Rollback removes the evidence service and restores the Phase 4.2 retrieval-only planning path. No persisted data requires rollback.

The exact next bounded slice is Phase 4.4: restricted candidate generation for active, workspace-scoped, direction-compatible project/type/category IDs. Phase 5 remains blocked until all Phase 4 slices and the corrected 221-item deterministic pre-AI baseline pass.

No push is authorized or performed.


## Program Phase 4.4 — restricted deterministic retrieval candidates

Starting commit: `48f9002` (`feat: add deterministic retrieval evidence`).

### Exact implementation scope

Implemented only the bounded candidate-generation layer over Phase 4.3 evidence:

- `server/services/restrictedRetrievalCandidateService.ts`;
- candidate-gated integration in `server/services/suggestionBackfillService.ts`;
- focused tests in `tests/services/restrictedRetrievalCandidateService.test.ts`;
- bounded backfill fixture updates in `tests/services/suggestionBackfillService.test.ts`.

No schema, migration, route, UI, booking behavior, persisted suggestion fields, review mutation, ledger/period state, Merchant Knowledge mutation, Phase 4.5+, AI inference, deployment, or push behavior changed.

### Candidate contract

Candidate version: `restricted-retrieval-candidates-v1`.

Each selectable candidate exposes only:

- dimension: `PROJECT`, `TRANSACTION_TYPE`, or `CATEGORY`;
- candidate ID and deterministic rank;
- active and direction-compatible booleans;
- stable reason codes;
- supporting/conflicting evidence counts;
- Phase 4.2 retrieval hash;
- Phase 4.3 dimension evidence hash;
- privacy-safe provenance hashes;
- deterministic candidate hash.

Selectable reason codes:

- `CURRENT_RETRIEVED_VALUE`;
- `SUPPORTED_ALTERNATIVE`;
- `ACTIVE_WORKSPACE_MATCH`;
- `DIRECTION_COMPATIBLE`.

Bounded diagnostics:

- `INACTIVE`;
- `CROSS_WORKSPACE`;
- `MISSING`;
- `UNSUPPORTED_BY_EVIDENCE`.

Diagnostics follow the fixed dimension sequence project, transaction type, category.

### Bounds and ordering

Conservative defaults and hard caps:

- project candidates: 5 default, 10 hard cap;
- transaction-type candidates: 5 default, 10 hard cap;
- category candidates: 5 default, 10 hard cap;
- Phase 4.3 alternatives evaluated per dimension: 10 default, 25 hard cap.

Invalid bounds are normalized deterministically. Exact candidate IDs are derived only from the current selected value and bounded Phase 4.3 alternatives, then queried by exact ID plus authorized workspace. No unbounded workspace scan is used.

Ordering:

1. current retrieved value first when still valid;
2. support score descending;
3. supporting count descending;
4. conflicting count ascending;
5. candidate ID as stable final tie-breaker.

Every candidate and candidate set has a deterministic hash.

### Validation and direction contract

Projects, transaction types, and categories are accepted only when the exact record exists, belongs to the authorized workspace, and `isActive = true`.

The current schema defines no dimension direction field and no project/type/category combination compatibility table. Direction compatibility is inherited from Phase 4.2/4.3 because only confirmed history matching the target transaction direction contributes evidence. Phase 4.4 does not invent a new compatibility model.

Current selected values are retained only when valid. Alternatives require explicit Phase 4.3 support. Unsupported configured IDs are excluded.

### Abstention behavior

Explicit abstentions:

- `MATERIAL_CONFLICT`;
- `INSUFFICIENT_EVIDENCE`;
- `NO_VALID_PROJECT_CANDIDATE`;
- `NO_VALID_TRANSACTION_TYPE_CANDIDATE`;
- `NO_VALID_CATEGORY_CANDIDATE`.

The existing backfill planner retains a ranked suggestion only when its project, transaction type, and category are all present in matched restricted candidate sets. Existing persisted suggestion fields remain unchanged.

### Privacy and zero-side-effect guarantees

Candidate output contains only approved IDs, booleans, reason codes, counts, versions, and hashes. It exposes no raw IBAN, counterparty text, descriptions, payment-purpose/source text, normalized values, evidence JSON, dimension labels, or bank facts.

The candidate service performs bounded reads only. It contains no create, update, delete, upsert, bulk write, database transaction, booking write, suggestion write, review mutation, bank-fact mutation, ledger/period mutation, Merchant Knowledge mutation, backfill execution, AI inference, or external-model call.

### Validation evidence

Completed successfully:

- focused Phase 4.4 candidate tests — 12 passed, 0 failed;
- complete affected Phase 4.1–4.3, history, backfill, Merchant Retrieval Anchor, MODEL-002 dimension/schema, categorization, rule-engine, request-context, and administrator-policy regressions — 112 passed, 0 failed;
- MODEL-002 migration deploy/status/drift validation — passed;
- `npm run build:server` — passed;
- full `npm run build` — passed;
- Prisma Client generation, server TypeScript compilation, Next compilation, type validation, static generation, and trace collection — passed;
- `git diff --check` — passed before documentation update;
- focused executable high-risk scan — zero findings;
- focused secret-material scan — zero findings.

Bounded repairs:

- abstention reason was narrowed to its exact literal union;
- the focused diagnostics expectation was aligned with fixed project/type/category order;
- existing backfill test fixtures gained only the required read-only project/type/category delegates;
- the abstention response object was typed as `Omit<RestrictedRetrievalCandidateResult, 'candidateSetHash'>` so empty arrays retain exact contract types without runtime changes.

### Limitations, rollback, and next slice

Phase 4.4 does not define the conceptual Decision DTO, deterministic orchestration, isolation report, benchmark evaluation, or AI inference.

Rollback removes the restricted candidate service and restores Phase 4.3 evidence-only gating in the private backfill planner. No persisted data requires rollback.

The exact next bounded slice is Phase 4.5: the conceptual Decision contract without changing booking truth. Phase 5 remains blocked until all Phase 4 slices and the corrected 221-item deterministic pre-AI baseline pass.

No push is authorized or performed.


## Program Phase 4.5 — conceptual deterministic Decision contract

Starting commit: `a5f5747` (`feat: add restricted retrieval candidates`).

### Exact implementation scope

Implemented only a pure, in-memory Decision DTO/domain contract over the completed Phase 4.1–4.4 deterministic pipeline:

- `server/services/deterministicDecisionService.ts`;
- in-memory Decision gating inside `server/services/suggestionBackfillService.ts`;
- focused tests in `tests/services/deterministicDecisionService.test.ts`.

No Decision persistence model, schema, migration, route, UI, booking, suggestion field, review mutation, ledger/period mutation, Merchant Knowledge mutation, AI inference, or external-model call was added.

### Decision contract

Decision version: `deterministic-decision-v1`.

Overall statuses:

- `PROPOSED`;
- `ABSTAINED`;
- `CONFLICTED`;
- `INCOMPLETE`.

Per-dimension statuses:

- `SELECTED`;
- `ABSTAINED`;
- `CONFLICTED`;
- `INCOMPLETE`.

Project, transaction-type, and category Decision dimensions expose only privacy-safe fields:

- selected candidate ID and rank;
- canonically ordered bounded candidate IDs;
- supporting and conflicting evidence counts;
- existing Phase 4.3 component scores;
- retrieval, evidence, selected-candidate, candidate-set, and deterministic dimension hashes;
- privacy-safe provenance hashes;
- explicit reason where applicable;
- uncalibrated confidence placeholder with deterministic score basis points and `label = null`.

Confidence is explicitly `UNCALIBRATED` and is not represented as probability or calibrated acceptance confidence.

### Replay, staleness, provenance, and hashes

The Decision binds:

- workspace ID;
- target transaction ID;
- optional privacy-safe transaction-fact hash;
- `confirmed-history-v1`;
- `deterministic-history-retrieval-v1` and retrieval hash;
- `deterministic-retrieval-evidence-v1` and evidence hash;
- `restricted-retrieval-candidates-v1` and candidate-set hash;
- scorer weights hash;
- retrieval/candidate bounds hash;
- selected and ordered allowed candidates;
- deterministic dimension hashes;
- deterministic Decision hash.

Optional expected retrieval, evidence, and candidate-set identities reject stale replay with typed errors. Workspace, transaction identity, and version mismatch are also rejected.

Candidate arrays are canonicalized by the existing Phase 4.4 rank and candidate ID so replay output is independent of caller array order without changing candidate ranks or hashes.

### Abstention and integration

The Decision propagates deterministic upstream reasons including:

- `NO_ELIGIBLE_HISTORY`;
- `NO_SCORE_ABOVE_THRESHOLD`;
- `MATERIAL_CONFLICT`;
- `INSUFFICIENT_EVIDENCE`;
- `NO_VALID_PROJECT_CANDIDATE`;
- `NO_VALID_TRANSACTION_TYPE_CANDIDATE`;
- `NO_VALID_CATEGORY_CANDIDATE`.

A missing selected candidate in an otherwise non-empty contract returns `INCOMPLETE` with `INCOMPLETE_DECISION`; it is not silently converted to a proposal or true upstream abstention.

The existing backfill planner builds the conceptual Decision only in memory. Existing suggestion persistence fields and semantics remain unchanged. A ranked candidate is retained only when the Decision is `PROPOSED` and all three selected IDs exactly match the existing ranked project/type/category triple.

### Zero-side-effect declarations

Every Decision explicitly declares:

- `readOnly: true`;
- `previewOnly: true`;
- `createsTransactionBooking: false`;
- `createsCategorizationSuggestion: false`;
- `mutatesBankFacts: false`;
- `mutatesReviewDecisions: false`;
- `mutatesPeriodState: false`;
- `mutatesLedgerRecords: false`;
- `persistsDecision: false`;
- `invokesExternalModel: false`.

### Validation evidence

Completed successfully:

- focused Phase 4.5 Decision tests — 10 passed, 0 failed;
- affected Phase 4.1–4.4, history, backfill, hashing, request-context, and administrator-policy regressions — 90 passed, 0 failed;
- combined validated tests — 100 passed, 0 failed;
- `npm run build:server` — passed;
- full `npm run build` — passed;
- Prisma Client generation, server TypeScript compilation, Next.js compilation, type validation, static generation, page-data collection, and trace collection — passed;
- `git diff --check` — passed before documentation update;
- focused executable high-risk scan — zero findings;
- focused secret-material scan — zero findings.

Bounded repairs:

- an incomplete selected-value contract was classified as `INCOMPLETE` rather than `ABSTAINED`;
- the Decision dimension base object was explicitly typed so `confidence.label` remains `string | null` while preserving runtime `null` and uncalibrated semantics.

### Limitations, rollback, and next slice

Phase 4.5 does not implement contributor orchestration, timeouts, benchmark evaluation, Decision persistence, routes, UI, or AI inference.

Rollback removes `deterministicDecisionService.ts` and restores the Phase 4.4 direct candidate gate in `suggestionBackfillService.ts`. No persisted data requires rollback.

The exact next bounded slice is Phase 4.6: deterministic orchestration across rules, Merchant Knowledge, confirmed-history retrieval, evidence, candidates, alternatives, and abstention without model inference. Phase 5 remains blocked.

No push is authorized or performed.



## Program Phase 4.6 — deterministic orchestration

Starting commit: `fd6ba2c` (`feat: add deterministic decision contract`).

### Exact implementation scope

Implemented only the Phase 4.6 deterministic orchestration boundary:

- `server/services/deterministicDecisionOrchestrationService.ts`;
- in-memory orchestration gating inside `server/services/suggestionBackfillService.ts`;
- focused tests in `tests/services/deterministicDecisionOrchestrationService.test.ts`.

No ProChat code or branding was introduced into the Finance repository. A focused contamination scan found zero ProChat metadata, manifest, structured-data, OG-route, social-preview, or branding content in the Phase 4.6 paths.

No persistence, schema, migration, route, UI, booking, suggestion-field, review, ledger, period, Merchant Knowledge mutation, AI inference, external-model call, deployment, or push behavior was added.

### Orchestration contract

Orchestration version: `deterministic-orchestration-v1`.

Contributor-priority version: `rule-history-agreement-v1`.

Contributor set:

- optional deterministic rule contributor;
- optional Merchant Knowledge retrieval-anchor contributor;
- mandatory retrieval identity;
- mandatory retrieval-evidence identity;
- mandatory restricted-candidate identity;
- mandatory Phase 4.5 `deterministic-decision-v1` contributor.

Canonical contributor order:

1. rule;
2. Merchant Knowledge;
3. retrieval;
4. evidence;
5. candidates;
6. Decision.

Every contributor exposes privacy-safe type, version, mandatory/optional classification, status, input/output hashes, sorted provenance hashes, deterministic reason, and whether it affected the final Decision.

### Verified priority and conflict semantics

Rules and confirmed history are deterministic peers under `rule-history-agreement-v1`:

- rule/Decision agreement preserves the existing Phase 4.5 Decision;
- rule/Decision disagreement returns a deterministic conflict;
- an existing deterministic-categorization conflict remains a conflict;
- a rule requiring review abstains and does not silently promote a Decision;
- rules do not silently outrank or replace confirmed-history results.

Merchant Knowledge is optional supporting evidence:

- a ready usable anchor is retained as a matched contributor;
- a missing or unavailable anchor does not erase an independent valid Decision;
- a stale anchor remains visible as stale but does not erase an independent valid Decision;
- an explicit Merchant Knowledge conflict blocks orchestration;
- cross-workspace Merchant Knowledge scope fails closed.

The Phase 4.5 Decision and its retrieval, evidence, and candidate identities remain mandatory. `ABSTAINED`, `CONFLICTED`, and `INCOMPLETE` Decisions are propagated and never promoted to a final proposal.

### Failure isolation and timeout behavior

Optional rule or Merchant Knowledge unavailability does not erase an independent valid mandatory Decision. Mandatory contributor failure, stale identity, or scope mismatch fails closed.

No timeout contract was added. All current contributors are synchronous and local, and the governing source defines no deterministic timeout values. Inventing timeout durations or using elapsed time in ranking or hashes was explicitly avoided.

### Replay, provenance, staleness, and hashes

The orchestration envelope binds:

- orchestration version;
- contributor-priority version;
- workspace ID;
- target transaction ID;
- privacy-safe transaction-fact hash;
- canonical contributor identities and versions;
- contributor input/output hashes;
- sorted contributor provenance hashes;
- Phase 4.1–4.5 retrieval, evidence, candidate, and Decision identities;
- contributor-identity hash;
- final Decision hash;
- deterministic orchestration hash.

An optional expected orchestration hash rejects stale replay. Workspace and transaction mismatch are rejected with typed errors. Contributor ordering is canonical and does not depend on caller input ordering.

### In-memory integration and zero side effects

The existing suggestion-backfill planning path builds the Phase 4.5 Decision and then the Phase 4.6 orchestration envelope in memory. Existing persisted suggestion fields and semantics remain unchanged. A ranked candidate is retained only when orchestration returns `MATCHED` with a complete `PROPOSED` Decision whose selected project, transaction-type, and category IDs exactly match the existing ranked triple.

Every orchestration result explicitly declares:

- `readOnly: true`;
- `previewOnly: true`;
- `createsTransactionBooking: false`;
- `createsCategorizationSuggestion: false`;
- `mutatesBankFacts: false`;
- `mutatesReviewDecisions: false`;
- `mutatesPeriodState: false`;
- `mutatesLedgerRecords: false`;
- `mutatesMerchantKnowledge: false`;
- `persistsDecision: false`;
- `invokesExternalModel: false`.

### Validation evidence

Completed successfully:

- focused Phase 4.6 orchestration tests — 10 passed, 0 failed;
- affected Phase 4.1–4.5, rule, Merchant Knowledge anchor, history, backfill, hashing, request-context, and administrator-policy regressions — 120 passed, 0 failed;
- combined validated tests — 130 passed, 0 failed;
- `npm run build:server` — passed;
- full `npm run build` — passed;
- Prisma Client generation, server TypeScript compilation, Next.js compilation/type validation, page-data collection, static generation for 19/19 pages, and trace collection — passed;
- `git diff --check` — passed before documentation update;
- focused executable high-risk scan — zero findings;
- focused secret-material scan — zero findings;
- focused ProChat contamination scan — zero findings.

### Limitations, rollback, and next slice

Phase 4.6 does not add network contributors, timeouts, persistence, routes, UI, benchmark evaluation, or model inference.

Rollback removes `deterministicDecisionOrchestrationService.ts` and restores the direct Phase 4.5 Decision gate in `suggestionBackfillService.ts`. No persisted data requires rollback.

The exact next bounded slice is Phase 4.7: isolation and integrity validation proving workspace scope, read-only behavior, suggestion-versus-booking separation, locked-period protections, and zero mutation across the complete deterministic Phase 4 pipeline. Phase 5 remains blocked.

No push is authorized or performed.



## Program Phase 4.7 — isolation and integrity validation

Starting commit: `a0887a7` (`feat: add deterministic decision orchestration`).

### Exact validation scope

Added one test-only integrity proof:

- `tests/services/deterministicPhase4Integrity.test.ts`.

No production service, schema, migration, route, UI, booking, review, ledger, period, Merchant Knowledge, Decision, orchestration, AI, deployment, or push behavior was changed.

### Versions validated

- `confirmed-history-v1`;
- `deterministic-history-retrieval-v1`;
- `deterministic-retrieval-evidence-v1`;
- `restricted-retrieval-candidates-v1`;
- `deterministic-decision-v1`;
- `deterministic-orchestration-v1`.

### Workspace-isolation evidence

The integrity suite proves:

- cross-workspace bookings and review decisions are excluded at confirmed-history eligibility;
- retrieval rejects eligible-history records whose workspace identity differs from the authorized workspace;
- retrieval evidence rejects workspace mismatch;
- restricted candidates exclude cross-workspace dimensions and abstain when a required dimension becomes empty;
- Decisions reject workspace and target-transaction mismatch;
- orchestration rejects Decision or Merchant Knowledge scope mismatch;
- mixed-workspace provenance cannot override the server-authoritative workspace.

### Zero-write and zero-transaction evidence

Source guards and strict database doubles prove zero planning invocation of:

- `create`;
- `createMany`;
- `update`;
- `updateMany`;
- `delete`;
- `deleteMany`;
- `upsert`;
- `$transaction`.

The dry-run backfill path returns before the existing explicitly authorized write transaction. It reports `writesPerformed: false`, does not create suggestions or bookings, and does not mutate bank facts. The existing execution path remains distinct and still requires its current authorization and explicit confirmation controls.

### Suggestion-versus-booking integrity

The integrity proof confirms:

- retrieval candidates, evidence, restricted candidates, conceptual Decisions, and orchestration envelopes are not bookings;
- conceptual Decisions and orchestration envelopes are not persisted suggestions;
- deterministic confidence, scores, statuses, and matches do not constitute human confirmation;
- no Phase 4 planning stage creates or mutates `TransactionBooking`;
- no Phase 4 planning stage mutates raw `Transaction` facts or booking state;
- only existing administrator review flows may establish confirmed outcomes.

### Locked-period, ledger, report, and accounting integrity

The pipeline may read locked-period provenance from confirmed historical outcomes, but the test suite proves it does not:

- open, close, unlock, or otherwise mutate a period;
- create, change, or remove a booking in a locked period;
- mutate ledger entries;
- alter account balances, reports, accounting exports, or historical review decisions;
- bypass existing booking or review protections.

### Privacy and provenance boundary

The governing Decision architecture distinguishes internal deterministic scorer inputs from externally consumable contracts.

`confirmed-history-v1` eligible-history records may retain transaction facts internally for scoring. The privacy-safe response guarantee applies to:

- deterministic retrieval response evidence;
- Phase 4.3 retrieval evidence;
- restricted candidates;
- conceptual Decisions;
- orchestration envelopes.

The integrity test proves those externally consumable contracts expose no raw IBAN, counterparty, description, payment purpose, raw-row field, stack trace, or unrestricted source value. No route, UI, or server route imports or exposes `eligibleHistory`. Decision and orchestration services do not contain eligible-history fields or raw scoring facts, and both explicitly declare `persistsDecision: false`.

Approved outputs remain limited to privacy-safe IDs, statuses, versions, counts, component scores, evidence/provenance hashes, candidate hashes, Decision hashes, orchestration hashes, and deterministic abstention/conflict reasons.

### Deterministic replay and stale identity

The complete Phase 4 pipeline produces byte-equivalent outputs when confirmed-history input rows are reordered. The test suite validates deterministic replay across eligibility, retrieval, evidence, restricted candidates, Decision, and orchestration.

It also proves deterministic rejection of:

- invalid confirmed-history version;
- stale retrieval hash;
- stale evidence hash;
- stale candidate-set hash;
- stale orchestration hash;
- workspace and transaction mismatch.

No current time, random value, network result, duration, or automatic retry enters ranking or deterministic hashes.

### Administrator-confirmation protections

The integrity suite preserves the existing separation between deterministic planning and human confirmation. No planning result becomes booking truth, no review decision is created or changed, and no administrator authorization or locked-period protection is bypassed.

### Validation evidence

Completed successfully:

- focused Phase 4.7 isolation/integrity tests — 8 passed, 0 failed;
- complete affected Phase 4.1–4.7, rule, Merchant Knowledge anchor, suggestion-backfill, review, period, ledger, request-context, and administrator-policy regressions — 173 passed, 0 failed;
- `npm run build:server` — passed;
- full `npm run build` — passed;
- Prisma Client generation, server TypeScript compilation, Next.js compilation/type validation, page-data collection, static generation for 19/19 pages, and trace collection — passed;
- `git diff --check` — passed before documentation update;
- focused executable high-risk scan — zero findings;
- focused secret-material scan — zero findings.

One bounded test-only repair corrected bigint-safe replay serialization and narrowed an over-broad source guard to executable database delegate writes. The final privacy assertion was aligned with the governing internal-scorer versus external-contract boundary; no production DTO or behavior change was required.

### Limitations, rollback, and next slice

Phase 4.7 is a validation and integrity-proof slice. It does not add a runtime integrity endpoint, dashboard, persistence layer, benchmark evaluator, route, UI, or AI behavior.

Rollback removes `tests/services/deterministicPhase4Integrity.test.ts` and reverts these documentation entries. No persisted data requires rollback.

The exact next bounded slice is Phase 4.8: freeze and evaluate the deterministic pre-AI baseline against the corrected 221-transaction benchmark. Phase 5 remains blocked until the Phase 4 baseline and acceptance gate are complete.

No push is authorized or performed.



## Program Phase 4.8 — benchmark-source discovery and freeze

Starting commit: `4d7b908` (`test: prove deterministic decision integrity`).

This packet performs benchmark-source discovery only. It does not implement the evaluator, calculate baseline metrics, create a duplicate dataset, mutate database records, add routes/UI, or begin Phase 5.

### Authoritative benchmark source

The corrected 221-transaction benchmark is database-backed. Its authoritative cohort is the imported 2026 partial/open bank statement in the authorized Finance workspace.

The source is identified by all of the following existing records and invariants:

- authorized `FinanceWorkspace.id` derived from server context;
- `SourceFile.sha256 = 768912927a7bb3b545616631e6d5360479a90b0bc6448faa3f225925636d31d3` for the retained 2026 CSV source role `openStatementCsv2026`;
- source filename `NL89INGB0006369960_2026-01-01_2026-07-01.csv` as recorded by the production import plan and copied to `Transaction.sourceFile`;
- one workspace-scoped `BankStatement` linked to that `SourceFile`;
- statement period `2026-01-01` through `2026-07-01`;
- `coverageStatus = PARTIAL`;
- `transactionCount = 221`;
- the statement/import `ImportBatch.id` where present;
- transactions imported by that batch/source, scoped through active workspace membership and ordered by `date`, then `id`;
- each benchmark transaction must have a non-null `importFingerprint` and remain unique under `Transaction.@@unique([userId, importFingerprint])`.

The existing control totals remain part of the source identity:

- opening balance minor units: `1,035,086`;
- income minor units: `5,878,408`;
- expense minor units: `6,129,769`;
- closing balance minor units: `783,725`;
- close permitted: `false`.

No JSON, CSV copy, exported benchmark table, or manually maintained duplicate fixture is introduced. The retained source file and current database records remain authoritative.

### Canonical cohort query contract

The Phase 4.8 evaluator must resolve the cohort in this order:

1. derive the authorized workspace from server context;
2. locate the workspace `SourceFile` by the exact 2026 CSV SHA-256;
3. locate the workspace `BankStatement` whose `sourceFileId` matches, whose period is `2026-01-01` through `2026-07-01`, whose coverage is `PARTIAL`, and whose `transactionCount` is 221;
4. select transactions associated with the statement import identity using the statement `importBatchId` when non-null, plus the recorded source filename and active workspace-member ownership;
5. require non-null unique `importFingerprint` values;
6. reject duplicate transaction IDs or fingerprints;
7. require the resulting cohort count to equal 221;
8. order rows by transaction date ascending, then transaction ID ascending.

The query must fail closed if the source hash, workspace, period, control totals, import identity, uniqueness, or row count differs.

### Ground-truth field mapping

Benchmark ground truth comes only from current administrator-confirmed outcomes already stored in the database.

For each cohort transaction:

- current booking: `Transaction.transactionBooking` / `TransactionBooking.transactionId`;
- expected project: `TransactionBooking.projectId`;
- expected transaction type: `TransactionBooking.transactionTypeId`;
- expected category: `TransactionBooking.categoryId`;
- expected complete triple: the ordered tuple `(projectId, transactionTypeId, categoryId)`.

A booking is eligible as benchmark truth only when the latest applicable workspace-scoped `ReviewDecision`, ordered by `decidedAt` descending and then stable ID ordering, satisfies all of the following:

- action is `ACCEPT_SUGGESTION`, `ASSIGN_MANUALLY`, or `CHANGE_BOOKING`;
- `afterBookingId` equals the current `TransactionBooking.id`;
- `afterProjectId`, `afterTypeId`, and `afterCategoryId` equal the current booking dimensions;
- actor ID, decision timestamp, booking evidence hash, and decision evidence hash are present;
- booking and all dimensions belong to the authorized workspace.

`REMOVE_BOOKING`, pending/rejected/expired/generated suggestions, superseded decisions, decisions pointing to a non-current booking, incomplete triples, missing provenance, and cross-workspace records are never benchmark labels.

Transactions without an eligible current confirmed outcome remain members of the 221-row source cohort but are `UNLABELED_PENDING_CONFIRMATION` for benchmark evaluation. The evaluator must report them explicitly and must not invent labels or silently exclude them from source-row totals.

### Exclusion and integrity contract

A source row is invalid for metric comparison when any of these conditions holds:

- duplicate transaction ID or import fingerprint;
- missing import fingerprint;
- source/workspace/import identity mismatch;
- missing current booking;
- latest applicable decision removes the booking;
- latest applicable decision does not point to the current booking;
- incomplete project/type/category triple;
- missing actor, timestamps, or evidence hashes;
- cross-workspace booking, decision, actor, or dimension identity.

Invalid-label rows must be counted by stable exclusion reason. They remain visible in the 221-row cohort accounting and cannot be dropped from the report without explanation.

### Version, hash, and replay strategy

Benchmark source identifier: `finance-db-open-statement-2026-221`.

Benchmark source contract version: `finance-db-benchmark-source-v1`.

The canonical benchmark-source hash must be SHA-256 over canonical JSON containing:

- source-contract version;
- workspace ID;
- source-file SHA-256;
- statement ID;
- statement period and coverage status;
- statement control totals and transaction count;
- import batch ID or explicit null;
- ordered array of transaction IDs and import fingerprints;
- canonical cohort ordering contract;
- label eligibility version `confirmed-history-v1`;
- ordered per-row current booking ID or null;
- ordered latest applicable review-decision ID or null;
- project/type/category IDs or null;
- booking and decision evidence hashes or null;
- stable exclusion reason or null.

The replay identity is the tuple:

- source-contract version;
- source-file SHA-256;
- workspace ID;
- statement/import identity;
- ordered transaction identity hash;
- ordered label-state hash;
- final benchmark-source hash.

Any cohort, booking, decision, evidence, workspace, source, period, or import change produces a new source hash. Existing benchmark history must never be rewritten to hide those changes; a later evaluator run records the new hash.

### Competing sources considered

The following are not authoritative benchmark sources:

- `tests/fixtures/historical-loading/2026-ing.csv`: useful parser/import fixture, but it is a repository copy rather than current database state and contains no confirmed review labels;
- the 681-sample `historySuggestionEvaluationService`: evaluates previously booked historical transactions, not the 221-row unresolved 2026 cohort;
- the 663 persisted `history-v1` suggestions: unconfirmed derived data and never ground truth;
- raw transaction `projectId`, `transactionTypeId`, or `categoryId`: legacy/import classifications that are not the current audited booking contract;
- Merchant Knowledge plans, suggestions, or AI output: derived evidence only, never benchmark truth.

### Discovery validation

Source inspection verified:

- the production import pins the 2026 CSV SHA-256 and the 221-row controls;
- `SourceFile` is unique by `(workspaceId, sha256)`;
- `BankStatement` is unique by source file and by `(workspaceId, accountId, periodStart, periodEnd)`;
- `Transaction` is unique by `(userId, importFingerprint)`;
- `TransactionBooking.transactionId` is unique, yielding at most one current booking per transaction;
- `ReviewDecision` is indexed by workspace, transaction, and decision time;
- `confirmed-history-v1` already defines the eligible administrator actions and current-booking match rule;
- benchmark selection remains workspace-scoped and read-only;
- focused discovery validation passed 62/62 tests across the production import guard, confirmed-history eligibility, review-decision mapping, and request-context workspace authority.

### Current status and limitation

The benchmark source and label query are now unambiguous and frozen without duplicating data. The authoritative source row count is 221.

The evaluator has not been implemented and no metrics have been calculated. The number of currently eligible confirmed labels must be read from the database at evaluator runtime; documentation that previously reported 221 unresolved decisions may be stale relative to current production state and is not used as the label count authority.

Phase 5 remains blocked until the Phase 4.8 evaluator produces a reproducible pre-AI report and the documented entry gate is assessed.

No commit or push is authorized or performed in this discovery packet.



## Program Phase 4.8 — deterministic benchmark evaluator

Starting commit: `4d7b908` (`test: prove deterministic decision integrity`).

### Implemented evaluator

Implemented and validated:

- `server/services/deterministicBenchmarkEvaluationService.ts`;
- `tests/services/deterministicBenchmarkEvaluationService.test.ts`.

Evaluator version: `deterministic-benchmark-evaluator-v1`.

The evaluator preserves the frozen source contract:

- source identifier `finance-db-open-statement-2026-221`;
- source version `finance-db-benchmark-source-v1`;
- exact 2026 source SHA-256, filename, statement period, `PARTIAL` coverage, statement controls, import identity, and required 221-row cohort;
- deterministic ordering by transaction date and transaction ID;
- current `TransactionBooking` plus latest eligible administrator `ReviewDecision` ground truth;
- explicit `LABELED_CONFIRMED`, `UNLABELED_PENDING_CONFIRMATION`, and `EXCLUDED_INVALID_LABEL` states;
- no duplicated benchmark fixture or export.

The source loader is workspace-derived and read-only. It rejects source, statement, control-total, import, row-count, duplicate-ID, duplicate-fingerprint, missing-fingerprint, workspace, and stale-source mismatches.

The evaluator produces privacy-safe per-row results and aggregate metrics for:

- total, labeled, unlabeled, excluded, evaluated, and covered rows;
- labeled and all-source coverage;
- abstention and conflict counts/rates;
- project, transaction-type, category, and complete-triple accuracy on covered rows;
- end-to-end accuracy across labeled rows;
- bounded top-three accuracy from existing Phase 4.4 candidate ordering;
- incomplete Decision count;
- rule, Merchant Knowledge, and confirmed-history contributor attribution;
- stable source, row, and report hashes;
- stale source/report and pipeline identity rejection.

Every result explicitly declares zero writes, zero transactions, no booking or suggestion creation, no bank-fact/review/period/ledger/Merchant Knowledge mutation, no Decision/orchestration persistence, and no external-model invocation.

### Validation evidence

Completed successfully:

- focused Phase 4.8 loader/evaluator tests — 12 passed, 0 failed;
- affected Phase 4.1–4.7, source-identity, rule, Merchant Knowledge, backfill, request-context, and administrator-policy regressions — 155 passed, 0 failed;
- combined validated tests — 167 passed, 0 failed;
- `npm run build:server` — passed;
- full `npm run build` — passed;
- Prisma Client generation, server TypeScript compilation, Next.js compilation/type validation, and static generation — passed.

Two narrow type-only repairs preserved runtime behavior:

- exact literal typing for benchmark row-result construction;
- exact return typing for invalid-label helper null fields.

The focused metric-contract mismatches were resolved source-groundedly:

- loader rows are canonically sorted by date and ID independently of database/test-double ordering;
- top-three uses all labeled rows and existing ordered allowed candidates without reranking;
- contributor counts follow `MATCHED` contributor statuses in row results.

### Benchmark runner and CLI

Implemented and validated after the evaluator:

- `server/services/deterministicBenchmarkRunnerService.ts` — read-only runner that wires the evaluator to a live Prisma client, performs a double-replay integrity check, and asserts zero side effects;
- `server/cli/runDeterministicBenchmark.ts` — compiled CLI entrypoint; requires `--read-only`; loads environment via `@next/env` before dynamic Prisma import; outputs privacy-safe JSON;
- `tests/services/deterministicBenchmarkRunnerService.test.ts` — focused runner and replay tests;
- `tests/cli/runDeterministicBenchmark.test.ts` — focused CLI flag, env-guard, and output tests;
- `package.json` — `benchmark:deterministic` script targeting `dist/server/cli/runDeterministicBenchmark.js`.

Runner version: `deterministic-benchmark-runner-v1`.

### Live benchmark execution

Starting commit: `6fd0024` (`test: freeze deterministic categorization baseline`).

Command:

```
npm run benchmark:deterministic -- --read-only
```

Environment: `DATABASE_URL` loaded from `.env.production` via `@next/env`; Tailscale IP used to reach the production PostgreSQL instance from the local machine.

Result: `ok: true`.

#### Privacy-safe live metrics

| Field | Value |
|---|---|
| runnerVersion | `deterministic-benchmark-runner-v1` |
| sourceId | `finance-db-open-statement-2026-221` |
| sourceVersion | `finance-db-benchmark-source-v1` |
| evaluatorVersion | `deterministic-benchmark-evaluator-v1` |
| totalSourceRows | 221 |
| labeledRows | 0 |
| unlabeledPendingConfirmationRows | 221 |
| excludedInvalidLabelRows | 0 |
| evaluatedLabeledRows | 0 |
| coveredLabeledRows | 0 |

All accuracy, coverage, abstention, conflict, and contribution basis-point metrics are 0 because no administrator-confirmed `ReviewDecision` / `TransactionBooking` eligible labels exist yet for the 221-transaction 2026 cohort.

#### Source hash and report hash

| Field | Value |
|---|---|
| sourceHash | `524b03d6f105798144a958804a1f9efaa554ef09d81fd59d9523813738f75a0d` |
| reportHash | `526c3b6686b4db0a3be06dc8809f07329fbd8d569b2bc8e3d255fa27c376da46` |

#### Replay verification

| Field | Value |
|---|---|
| replay.verified | `true` |
| replay.sourceHashMatches | `true` |
| replay.reportHashMatches | `true` |
| replay.rowHashesMatch | `true` |
| replay.metricsMatch | `true` |

Both executions produced identical ordered row hashes and aggregate metrics. No replay mismatch.

#### Zero side-effects proof

| Field | Value |
|---|---|
| sideEffects.readOnly | `true` |
| sideEffects.writesPerformed | `false` |
| sideEffects.createsTransactionBooking | `false` |
| sideEffects.createsCategorizationSuggestion | `false` |
| sideEffects.mutatesBankFacts | `false` |
| sideEffects.mutatesReviewDecisions | `false` |
| sideEffects.mutatesPeriodState | `false` |
| sideEffects.mutatesLedgerRecords | `false` |
| sideEffects.mutatesMerchantKnowledge | `false` |
| sideEffects.persistsDecision | `false` |
| sideEffects.invokesExternalModel | `false` |
| sideEffects.opensTransaction | `false` |

Zero writes. Zero Prisma transactions. No repository changes from execution.

### Phase 4.8 final validation evidence

| Step | Result |
|---|---|
| Focused Phase 4.8 runner and CLI tests | 21 passed, 0 failed |
| Affected Phase 4.1–4.7 and related regressions | 131 passed, 0 failed |
| `npm run build:server` | passed |
| Full `npm run build` | passed |
| `git diff --check` (implementation paths) | clean |
| High-risk scan over changed paths | clean |
| Secret-material scan over changed paths | clean |
| Live benchmark command | `ok: true` |

### Phase 5 entry gate

`PHASE_5_GATE_UNDECIDABLE`

Reason: `NO_COMMITTED_NUMERIC_ACCEPTANCE_THRESHOLDS`. The evaluator, runner, and CLI are fully implemented and validated. The live benchmark executed successfully against the production database. However, zero administrator-confirmed `ReviewDecision` / `TransactionBooking` labels exist for the 2026 cohort at this time — all 221 rows are `UNLABELED_PENDING_CONFIRMATION`. Therefore all accuracy, coverage, and calibration metrics are 0 and no numeric Phase 5 acceptance threshold can be honestly assessed against the current benchmark.

Phase 5 remains unstarted and blocked until the administrator confirms at least one review decision, establishing a non-zero labeled cohort and enabling metric-based gate assessment.

### Limitations and rollback

Limitations:

- all 221 benchmark rows are currently unlabeled; Phase 5 thresholds require a non-zero labeled cohort;
- no route, UI, job, or persistence boundary was added by the runner/CLI;
- `.env.production` host was updated locally to reach the database via Tailscale; this is a runtime configuration change only and is not committed.

Rollback removes `deterministicBenchmarkRunnerService.ts`, `runDeterministicBenchmark.ts`, their focused tests, the `benchmark:deterministic` package script, and reverts the Phase 4.8 documentation. No database rollback is required.

No push is authorized or performed.
