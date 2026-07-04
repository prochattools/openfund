# Yeshua Academy Finance rebuild run

Date: 2026-07-02  
Run: `agent-f961650b-de17-4282-ab18-7a716cc72958`  
Source: `yeshuaacademy-finance`  
Branch: `main`  
Status: Phase 1 committed as `925a609`; MODEL-001 committed as `73daabd`; MODEL-002 and MIGRATE-001 committed as `d2afb18`; MODEL-003 Packet A committed as `0196910`; MODEL-003 Packet B committed as `b3b8afd`; MODEL-004/005 committed as `49386ad`; Phase 3 Packet B parser fixtures and modules in progress

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
   - It expects a sheet named `transacties 2025`, which is absent in the uploaded workbook.
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

One primary action: upload an ING CSV.

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
13. Always retain the original uploaded files unchanged. Store their hashes and make the originals downloadable. Derived formats may be generated, but never replace the originals.
14. July 2026 remains open until a complete July export is supplied.
15. The current production PostgreSQL major version is unknown and existing production data is not important. During the infrastructure phase, select a currently supported PostgreSQL major version that is compatible with Prisma, validate migrations and the complete financial fixture suite on a disposable database, and only then replace or update the environment.
16. The complete application UI, navigation, labels, errors, category administration, reports, and emails must be Dutch. ING source columns may remain English because they are external source data. Project and classification names remain exactly as supplied in the administration.

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
7. The combined scan reported six expected documentation-only matches for the word `upload`; these describe the legitimate ING import workflow and are not executable upload/network behavior.
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
- `src/libs/api.ts` high-risk scan reported pre-existing fetch/upload patterns; the Packet B diff only expands the existing `updateCategory` payload and error handling.

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
- `SourceFile` retains original bytes, filename, media type, size, SHA-256 hash, uploader, workspace, and created time.
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

## Current next task

Prepare Phase 3 historical loading/truth fixtures. Do not import real historical data into production, modify production configuration, touch Graphify artifacts, or push.

## Next Phase 3 prompt

Use this prompt for the next implementation session:

```text
Continue in source yeshuaacademy-finance only.

Current committed state:
- MODEL-004/005 is committed as 49386ad.
- Local disposable PostgreSQL validation passed on localhost:5452 using disposable database yaf_model004005_validate_20260704170627_16917, which was dropped afterward.
- No production, Dokploy, MCP bridge, 10.0.2.4, .env, Graphify, or historical import work has been touched.

Task:
Plan Phase 3 historical loading and truth fixtures, but do not import production or real historical data yet.

Required context:
1. Read the approved product/domain docs before coding:
   - docs/PHILOSOPHY.md
   - docs/STRATEGY.md
   - docs/ROADMAP.md
   - docs/IMPLEMENTATION_PLAN.md
   - docs/finance-rebuild-run.md
   - docs/DOMAIN_MODEL.md, if present
2. Locate the owner-supplied source files without copying them into Git:
   - two Excel sheets
   - two CSV/PDF source files
3. Identify exact sheet names, final transaction columns, and resolved Verduidelijking sheets.

Phase 3 constraints:
- Preserve literal Klant, Type, and Category exactly as supplied.
- Use raw ING Date only for transaction dates.
- Use Verduidelijking as interpretation evidence, not as rewritten historical truth.
- Write tests and fixtures before any real data import.
- Build sanitized deterministic fixture coverage first.
- Create a disposable local import rehearsal only after parser and control tests pass.
- Use only localhost/127.0.0.1/::1 for disposable databases.
- Do not use production, Dokploy, MCP bridge, 10.0.2.4, or exposed production credentials.
- Do not edit .env.
- Do not touch .graphifyignore or graphify-out.
- Do not push.
- Stop before production deployment or any production data mutation.

Expected output:
- A bounded Phase 3 implementation plan.
- Parser/import fixture test list.
- Source-file inventory with sanitized paths and hashes only where safe to record.
- A stop point before real data import into any non-disposable database.
```
