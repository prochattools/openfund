# Phase 3 Historical Loading Plan

## Goal
Prepare the historical loading packet for the concluded 2024 workbook, the concluded 2025 workbook, and the 2026 ING statement export without importing any owner data into Git or into the application database yet.

This packet is discovery and planning only. It records the local source inventory, the workbook/CSV structure that matters for loader design, and the validation path for the next implementation batch.

## Source inventory

All source files were located in the owner-supplied admin folder outside the repo:

- `/Users/Office/Documents/Church/Yeshua Academy/Administratie/2026/YA financieel jaar 2024.xlsx`
- `/Users/Office/Documents/Church/Yeshua Academy/Administratie/2026/YA financieel jaar 2025 v2.xlsx`
- `/Users/Office/Documents/Church/Yeshua Academy/Administratie/2026/NL89INGB0006369960_2026-01-01_2026-07-01.csv`
- `/Users/Office/Documents/Church/Yeshua Academy/Administratie/2026/NL89INGB0006369960_2026-01-01_2026-07-01.pdf`

Recorded hashes for local traceability:

- `YA financieel jaar 2024.xlsx` -> `844699610889c6986fec305cdbb7b760da3dfc1d556ab9d0e160c854e1bc7f9f`
- `YA financieel jaar 2025 v2.xlsx` -> `d3913b876f3a6b8ddc3d19c49ef9778125e5e109a7d3ac330afbb3d6d8d7b2ff`
- `NL89INGB0006369960_2026-01-01_2026-07-01.csv` -> `768912927a7bb3b545616631e6d5360479a90b0bc6448faa3f225925636d31d3`
- `NL89INGB0006369960_2026-01-01_2026-07-01.pdf` -> `5e830a365fe0d87f67e883f24239f60674ed85a174e65db6520136511a6d58d2`

## Structure notes

### 2024 workbook

- Sheets: `Pivot met Type`, `NL89INGB0006369960_2024-01-01_2`, `Verduidelijking`
- Transaction sheet dimension: `A1:U269`
- Clarification sheet dimension: `A2:C41`
- Header row includes the canonical loader fields plus workbook-only helper columns:
  - `Date`, `Jaartal`, `Maand1`, `Maand`, `Dag`, `Datum`
  - `Name / Description`, `Account`, `Counterparty`, `Code`
  - `Debit/credit`, `Amount (EUR)`, `Bedrag`, `Transaction type`, `Notifications`, `Resulting balance`
  - `Tag`, `Klant`, `Category`, `Comment`, `Type`

### 2025 workbook

- Sheets: `Pivot met type`, `Pivot`, `NL89INGB0006369960_2025-01-01_2`, `Summary`, `Verduidelijking`, `Sheet1`
- Transaction sheet dimension: `A1:T414`
- Clarification sheet dimension: `A1:Q24`
- Header row is the same canonical transaction set, with the same helper/interpretation columns.
- The `Verduidelijking` tab contains human interpretation labels such as `Verschillende klanten`, `Vila Solidaria`, `For the King`, `Walk Like Jesus`, `Algemeen`, and `vraagtekens:`. Treat it as evidence, not rewritten history.

### 2026 statement export

- CSV headers:
  - `Date`
  - `Name / Description`
  - `Account`
  - `Counterparty`
  - `Code`
  - `Debit/credit`
  - `Amount (EUR)`
  - `Transaction type`
  - `Notifications`
  - `Resulting balance`
  - `Tag`
- Row count: 221 data rows
- ING PDF statement metadata:
  - Title: `Statement business account`
  - Pages: `29`

## Loader rules for Phase 3

1. Use the concluded 2024 workbook as a fixed source of truth for the 2024 historical set.
2. Use the concluded 2025 workbook as a fixed source of truth for the 2025 historical set.
3. Use the 2026 ING CSV and the matching PDF statement as the open-period source pair.
4. Preserve the raw ING `Date` field exactly as authoritative.
5. Ignore workbook helper date columns such as `Jaartal`, `Maand1`, `Maand`, `Dag`, and `Datum` as authoritative inputs.
6. Preserve literal labels exactly where they appear in the workbook, especially `Klant`, `Type`, and `Category`.
7. Treat `Verduidelijking` sheets as interpretation evidence, not as a target for rewriting history.
8. Keep all owner source files outside the repo and do not duplicate them into Git.
9. Do not import the historical files into production yet.

## Fixture strategy

The next implementation packet should build fixtures from metadata and representative structure, not from copied owner data.

Planned fixture types:

- workbook sheet-shape fixtures for 2024 and 2025
- header-presence fixtures for the 2026 CSV
- row-count and dimension assertions
- clarification-tab presence assertions
- authoritative-field preservation assertions

Fixture boundaries:

- no raw financial rows committed to the repo
- no source-file copies committed to the repo
- no production database writes
- no inference that converts helper columns into canonical source fields

## Implementation shape for the next batch

The next packet should:

1. Add a dedicated historical loader path for the closed 2024 and 2025 books.
2. Add a statement-import path for the 2026 CSV/PDF pair.
3. Keep the parser narrow and explicit about canonical versus helper fields.
4. Add tests that lock sheet names, headers, and the interpretation boundary.
5. Re-run the normal validation suite after the packet is implemented.

## Stop gates

Stop and re-check before any of the following:

- copying owner data into the repo
- importing historical rows into a persistent database
- changing production configuration
- broadening the parser beyond the observed canonical fields
- interpreting clarification sheets as source-of-truth data

## Next prompt

Use this packet to implement Phase 3 historical loading with no data import from the owner source files until the loader and fixtures are explicitly approved.

## Packet B status

- Sanitized historical parser fixtures are now present under `tests/fixtures/historical-loading/`.
- Parser modules were added under `lib/import/` for workbook rows, ING CSV rows, clarification evidence, and control checks.
- The implementation is synthetic and local only: no owner source rows were copied into Git and no historical import was performed.
- Control semantics are direction-safe: debit and credit totals are derived from row direction, not from any single sign convention.
- 2026 ING partial/open status is statement-level metadata, not a per-row truth.
- The next gate is a disposable local parser/import rehearsal design after parser tests pass.

## Packet C status

- A pure historical import planner now maps parsed rows into deterministic planning records.
- The planner preserves literal `Klant`, `Type`, and `Category` labels and keeps raw row evidence attached.
- Transaction fingerprints are canonical and exclude mutable interpretation labels.
- The planner produces source-file, statement, statement-period, transaction, and clarification-evidence planning records without database writes.
- The planner refuses period-close planning for the partial 2026 statement.
- The next gate remains the disposable local rehearsal design, using sanitized fixtures only.

## Packet D status

- A sanitized local rehearsal writer maps fixture-derived import plans into the existing MODEL-004/005 schema.
- The rehearsal writes only synthetic source bytes and sanitized fixture rows; it does not read owner source files.
- The DB-backed test uses a localhost-only guard, creates a uniquely named disposable database, applies the active migration chain, and drops the database afterward.
- Complete sanitized workbook data is close-eligible; the partial 2026 statement remains not close-eligible.
- Disposable local PostgreSQL validation used the existing Brain/OrbStack stack on `localhost:5452` and disposable database `yaf_packetd_rehearsal_20260704195805_69949`; `prisma migrate deploy`, `prisma migrate status`, `prisma validate`, `prisma generate`, and database-to-schema `prisma migrate diff` all passed with no schema drift.
- Full validation passed: focused rehearsal, planner, and MODEL-002 tests; full suite; server build; production build; diff check; high-risk and secret scans.
- The next gate is owner-approved real local rehearsal design, still not production import.

## Packet E status

- Sanitized rehearsal source-file retention now hashes the exact retained synthetic bytes stored in `SourceFile.content`.
- Planner/source inventory hashes remain metadata only and are not stored as retained-byte hashes for synthetic source files.
- The DB-backed rehearsal test asserts each persisted `SourceFile.sha256` equals the SHA-256 of persisted content, synthetic content contains no fixture row labels, and repeated rehearsal remains idempotent.
- A pure owner-local rehearsal adapter design records the future typed flow for approved absolute owner paths, retained-byte hashing, parsing, plan building, disposable local database writes, control verification, and cleanup.
- The adapter design does not read owner file contents, run a real-owner import, or touch production.
- The next gate remains explicit owner approval before any real local rehearsal using owner files.

## Packet F status

- Owner-approved local rehearsal now reads the four approved owner files from their absolute paths outside Git and validates their expected SHA-256 hashes before parsing.
- No owner workbook, CSV, PDF, raw transaction row dump, generated output, production config, or `.env` file is copied into the repository.
- Retained `SourceFile.content` bytes in the disposable rehearsal database are the exact local source bytes, and each persisted `SourceFile.sha256` is asserted to equal the SHA-256 of those retained bytes.
- The owner-local adapter sorts the 2026 ING CSV into chronological order before computing controls because the real export is newest-to-oldest.
- Sanitized owner rehearsal controls:
  - 2024 workbook: 268 rows; opening EUR 1,721.86; income EUR 32,267.19; expenses EUR 21,804.90; closing EUR 12,184.15; close-eligible.
  - 2025 workbook: 413 rows; opening EUR 12,184.15; income EUR 91,642.44; expenses EUR 93,475.73; closing EUR 10,350.86; close-eligible.
  - 2026 open statement: 221 rows; opening EUR 10,350.86; income EUR 58,784.08; expenses EUR 61,297.69; closing EUR 7,837.25; partial and not close-eligible.
- Disposable local PostgreSQL validation used the existing Brain/OrbStack stack on `localhost:5452` and disposable database `phase3_packet_f_migrate_20260704231905_27519`; `prisma migrate deploy`, `prisma migrate status`, `prisma validate`, `prisma generate`, and database-to-schema `prisma migrate diff` all passed with no schema drift.
- DB-backed owner rehearsal created and dropped disposable database `owner_historical_rehearsal_1783203654807_22c36dbd` during the focused owner-file test; the full suite later created and dropped `owner_historical_rehearsal_1783203678131_09051765`.
- Focused owner-local rehearsal tests passed: 2 tests.
- Focused sanitized rehearsal tests passed: 2 tests.
- Focused historical import planner tests passed: 3 tests.
- Focused owner-file adapter design tests passed: 2 tests.
- Full suite passed: 65 files, 277 tests.
- Server TypeScript build passed.
- Production build passed with 18 routes and retained the pre-existing Next/SWC lockfile warning.
- No disposable rehearsal or migration databases remained after cleanup.
- The next gate is review of the local owner rehearsal evidence and an explicitly approved production-safe import command or UI path; no production import has occurred.

## Packet G status

- Added a guarded owner historical import command service as the production-safe implementation surface; no UI route and no production npm script were added.
- The command service defaults to `dry-run`, reads the approved owner paths only to build a sanitized summary, and reports file names, hashes, row counts, control totals, duplicate counts, and close eligibility.
- The service does not log or return raw owner rows, payment-purpose text, counterparty values, or retained file bytes.
- Production mode returns `production-blocked`; Packet G intentionally implements guard and dry-run behavior only.
- Production remains blocked unless a future task supplies an explicit production option, reviewed dry-run acceptance, the operator confirmation token, and the source-bound production confirmation token.
- Rehearsal mode classifies database targets and allows only `localhost`, `127.0.0.1`, or `::1`; `10.0.2.4` is always forbidden.
- Owner source files must remain outside Git and their expected hashes must match before planning.
- The dry-run summary keeps 2024 and 2025 complete/close-eligible and the 2026 statement partial/not close-eligible.
- Validation passed: focused command-service tests, owner-local rehearsal tests, sanitized rehearsal service tests, historical import planner tests, full suite, Prisma validate/generate, server build, production build, `git diff --check`, changed executable/test high-risk scan, documentation secret-material scan, and changed-documentation runtime scan.
- Disposable local rehearsal databases created during validation were dropped; the final cleanup check found zero matching disposable databases.
- No production import, persistent database write, Prisma migration, `.env`, production config, owner-file copy, raw row dump, generated output commit, `.graphifyignore`, `graphify-out/`, or push occurred.
- The next gate is operator review of the dry-run guard behavior and an explicitly approved production deployment/import procedure design.
