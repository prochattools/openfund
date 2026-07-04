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
