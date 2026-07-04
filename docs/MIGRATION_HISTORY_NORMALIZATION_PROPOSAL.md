# Migration-history normalization proposal

Status: owner-approved, implemented, and fully validated on isolated local PostgreSQL; current active chain revalidated on disposable OrbStack PostgreSQL
Run: `agent-f961650b-de17-4282-ab18-7a716cc72958`  
Source: `yeshuaacademy-finance`  
Baseline commit: `8a5ab3f6e45bb3032f00cc3bf56780c355a0859f`  
Commit policy: do not commit until the owner explicitly approves

## Purpose

Normalize the Prisma migration history so that:

1. a new PostgreSQL database can be created from an empty state;
2. an existing finance database can adopt the normalized history without replaying table-creation SQL or changing financial data;
3. MODEL-002 remains a separate additive migration after the baseline;
4. the original migration files remain byte-identical and available for audit;
5. no already-applied migration checksum is silently rewritten.

The owner explicitly approved this document as the MIGRATE-001 implementation specification. Repository normalization is implemented. No real or production database connection, `_prisma_migrations` modification, MODEL-002 deployment, or commit is authorized by that approval.

## Inventory

The repository contains 18 migration directories.

| Order | Migration | Classification | Replay finding |
| ---: | --- | --- | --- |
| 1 | `20241121_add_categorization_rule_conditions` | early finance rule change | Invalid on empty database: alters `CategorizationRule` before that table exists. |
| 2 | `20241125_add_categorization_rule_conditions` | duplicate early finance rule change | Repeats the same `ADD COLUMN conditions`; invalid before table creation and duplicate afterward. |
| 3 | `20250204091431_init` | obsolete SaaS/template initializer | Creates `Subscription`, automation `Project`, `Audiences`, and `SubscriptionStatus`; it does not create the finance schema. |
| 4 | `20250204091647_assistant_id` | obsolete SaaS/template change | Alters the automation `Project`. |
| 5 | `20250204100937_assistant_id_string` | obsolete SaaS/template change | Alters the automation `Project`. |
| 6 | `20250206094716_project_webhooklink` | obsolete SaaS/template change | Adds a required automation field and can fail if legacy rows exist. |
| 7 | `20250210132339_project_strings` | obsolete SaaS/template change | Alters automation identifiers. |
| 8 | `20250226140000_import_fingerprint` | early finance transaction change | Invalid on empty database: alters `Transaction` before the finance initializer creates it. |
| 9 | `20251003194500_ledger_init` | first finance-schema initializer | Creates `User`, `Category`, `Ledger`, and `Transaction`; this is the beginning of the actual finance lineage. |
| 10 | `20251011191500_import_pipeline_v2` | finance import evolution | Adds account/import models and converts transactions to integer minor units and explicit direction. |
| 11 | `20251011194500_reconciliation_opening_balances` | finance reconciliation | Adds ledger reconciliation fields and `OpeningBalance`. |
| 12 | `20251011200500_ledger_lock_table` | finance period control | Adds `LedgerLock`. |
| 13 | `20251011204000_rule_engine` | finance categorization | Creates `CategorizationRule` and classification enums/relations. |
| 14 | `20260514191000_remove_saas_bloat_models` | private-finance cleanup | Removes obsolete SaaS/template tables and frees the `Project` name. |
| 15 | `20260514191500_add_audit_log` | finance auditability | Adds `AuditLog`. |
| 16 | `20260514194000_add_email_recipients` | finance reporting | Adds `EmailRecipient`. |
| 17 | `20260514204000_store_original_import_file` | source preservation | Adds retained original-file bytes and hashes to `ImportBatch`. |
| 18 | `20260703001200_add_workspace_dimensions` | MODEL-002, uncommitted | Additive workspace and `Klant`/`Type`/`Category` migration; must remain after the normalized baseline. |

`migration_lock.toml` locks the provider to PostgreSQL.

## Authoritative baseline

The normalized baseline must represent the exact Prisma schema at commit `8a5ab3f6e45bb3032f00cc3bf56780c355a0859f`, immediately before MODEL-002 schema edits.

That state is preferred over choosing one historical migration because:

- no individual legacy migration represents the complete pre-MODEL-002 schema;
- the legacy order contains at least three pre-schema operations;
- the pre-MODEL-002 committed schema already contains the intended final result of the ledger, import, reconciliation, rule-engine, audit, recipient, and source-file changes;
- keeping MODEL-002 outside the baseline preserves an independently testable upgrade boundary.

## Proposed normalized layout

After owner approval, the active migration directory would contain only:

```text
prisma/migrations/
├── migration_lock.toml
├── 0_finance_baseline/
│   └── migration.sql
└── 20260703001200_add_workspace_dimensions/
    └── migration.sql
```

The 17 pre-MODEL-002 migration directories would move byte-identically to:

```text
prisma/migrations-legacy-pre-baseline/
```

The archive would also contain:

```text
prisma/migrations-legacy-pre-baseline/MANIFEST.md
prisma/migrations-legacy-pre-baseline/SHA256SUMS
```

The manifest must record original order, original paths, classification, reason for archival, baseline commit, and the implementation commit that performs normalization. `SHA256SUMS` must be generated before and verified after the move.

The uncommitted MODEL-002 migration must not be archived or rewritten. Its content hash must be captured before normalization and verified afterward.

## Baseline generation

Implementation must use the committed pre-MODEL-002 schema, not the current working schema.

Proposed commands, for review only:

```bash
mkdir -p /tmp/yeshua-model002-baseline

git show 8a5ab3f6e45bb3032f00cc3bf56780c355a0859f:prisma/schema.prisma \
  > /tmp/yeshua-model002-baseline/schema.prisma

mkdir -p prisma/migrations/0_finance_baseline

pnpm exec prisma migrate diff \
  --from-empty \
  --to-schema-datamodel /tmp/yeshua-model002-baseline/schema.prisma \
  --script \
  > prisma/migrations/0_finance_baseline/migration.sql
```

The generated SQL must be reviewed before any database execution. At minimum it must create every pre-MODEL-002 model, enum, index, unique constraint, and foreign key represented in the committed schema. It must not contain application data, financial transactions, users, categories, opening balances, import batches, or environment-specific identifiers.

## Fresh-database validation

Use a uniquely named local or isolated PostgreSQL database. Never use a production database.

Validation sequence:

1. Create the disposable database.
2. Run `prisma migrate deploy` against the normalized active history.
3. Run `prisma migrate status`; expect no pending or failed migrations.
4. Compare the resulting database to the current MODEL-002 Prisma schema with `prisma migrate diff --exit-code`; expect exit code `0`.
5. Run `prisma validate` and `prisma generate` with the disposable URL.
6. Run focused MODEL-002 tests, the full test suite, the server build, and the production build.
7. Drop only the uniquely named disposable database.

This proves that an empty database can reach the current MODEL-002 schema through `0_finance_baseline` followed by the unchanged MODEL-002 migration.

## Existing-database adoption test

Before any real adoption, rehearse the complete sequence against an isolated clone or disposable fixture database that represents the pre-MODEL-002 finance state.

### Pre-change evidence

Capture and retain:

- database identifier and PostgreSQL version;
- full schema-only dump;
- `_prisma_migrations` rows and checksums;
- counts for every application table;
- category `(id, name)` pairs ordered by ID;
- transaction count, total `amountMinor`, credit total, debit total, minimum date, and maximum date;
- user IDs and emails;
- account, ledger, import-batch, opening-balance, categorization-rule, audit-log, and recipient counts;
- foreign-key and unique-index inventory.

### Adoption sequence

After the clone exactly matches the pre-MODEL-002 baseline:

```bash
DATABASE_URL="$ISOLATED_DATABASE_URL" \
  pnpm exec prisma migrate resolve \
  --applied 0_finance_baseline \
  --schema prisma/schema.prisma

DATABASE_URL="$ISOLATED_DATABASE_URL" \
  pnpm exec prisma migrate deploy \
  --schema prisma/schema.prisma

DATABASE_URL="$ISOLATED_DATABASE_URL" \
  pnpm exec prisma migrate status \
  --schema prisma/schema.prisma
```

`migrate resolve --applied` records the baseline as already represented by the existing schema. It must not execute the baseline SQL. `migrate deploy` must then apply only the unchanged MODEL-002 migration.

If Prisma reports divergence because archived legacy migration rows remain in `_prisma_migrations`, stop. Do not delete, rewrite, truncate, or manually edit migration metadata. The proposal must return for owner review with exact evidence.

### Required post-change invariants

The isolated adoption test must prove:

- exactly one `FinanceWorkspace` exists with the approved deterministic ID, name, slug, and `EUR` currency;
- every existing `User` has exactly one active `ADMIN` `WorkspaceMembership`;
- user IDs and emails are unchanged;
- category count is unchanged;
- every category ID and exact literal name is unchanged;
- every category belongs to the default workspace;
- transaction count is unchanged;
- total, credit, and debit `amountMinor` values are unchanged;
- transaction date range is unchanged;
- all existing `projectId` and `transactionTypeId` values are `NULL`;
- account, ledger, import-batch, opening-balance, categorization-rule, audit-log, and recipient counts are unchanged;
- all new foreign keys and unique indexes exist;
- no application table or row is dropped;
- `prisma migrate status` succeeds;
- database-to-schema diff is empty.

## Existing real database adoption

No real database adoption is authorized by this proposal.

A later owner-approved run may use the proven isolated sequence only when:

1. a restorable database backup exists;
2. the exact target database identity is independently verified;
3. application writes are stopped;
4. pre-change evidence is captured;
5. the baseline SQL and MODEL-002 hashes match the reviewed artifacts;
6. the isolated rehearsal has passed without migration-history divergence;
7. a separate explicit confirmation authorizes the database operation.

The real database must first be brought to the exact pre-MODEL-002 baseline. The baseline is then marked applied; MODEL-002 is deployed afterward. No legacy migration SQL is replayed against it.

## Rollback boundaries

### Before `migrate resolve`

No database state has changed. Delete the disposable database or abandon the rehearsal.

### After `migrate resolve`, before MODEL-002

Only `_prisma_migrations` metadata has changed. Stop application work, preserve the database, and compare metadata with the captured pre-change export. Do not attempt an unreviewed metadata edit.

### During a failed MODEL-002 migration

Stop immediately. Preserve Prisma's failure record and database logs. Do not rerun blindly. Use an owner-approved recovery plan based on the exact failed statement and a schema diff.

### After successful MODEL-002 deployment

Do not apply a destructive down migration. If validation fails, keep application writes disabled and restore the complete pre-change database backup. Schema rollback without restoring data is insufficient because migration metadata and database state must remain synchronized.

### Repository rollback

Before any database adoption, repository normalization can be reverted by restoring the active migration directories from the byte-identical archive and removing the generated baseline. The MODEL-002 migration must retain its original hash.

## Implementation evidence

The owner approved this specification and the normalization is implemented:

- the 17 pre-MODEL-002 migration directories are archived byte-identically under `prisma/migrations-legacy-pre-baseline/`;
- `SHA256SUMS` records all 17 original migration digests;
- `MANIFEST.md` records original order, classification, baseline commit, and the unchanged MODEL-002 hash;
- `PRE_MODEL002_SCHEMA.prisma` stores the formatted pre-MODEL-002 audit snapshot;
- `prisma/migrations/0_finance_baseline/migration.sql` was generated with `prisma migrate diff --from-empty` from that snapshot;
- the active migration history contains only `0_finance_baseline` and the unchanged `20260703001200_add_workspace_dimensions` migration;
- `tests/services/model002DomainSchema.test.ts` verifies active order, all 17 archive hashes, the MODEL-002 hash, baseline contents, and the guarded local-only database path;
- `scripts/validate-migrate-001.mjs` provides localhost-only preparation, invariant verification, and cleanup for disposable validation databases.

## Final isolated PostgreSQL validation

Validation ran through peer-authenticated PostgreSQL on the local `/tmp` socket. The runner accepts only localhost or approved local socket directories and the `postgres` maintenance database.

Fresh-database evidence:

- created a uniquely named disposable empty database;
- `prisma migrate deploy` applied `0_finance_baseline` and `20260703001200_add_workspace_dimensions` in order;
- `prisma migrate status` reported the database schema up to date;
- database-to-current-schema `prisma migrate diff --exit-code` reported no difference;
- database-backed `prisma validate` passed;
- Prisma Client 6.19.3 generation passed;
- direct verification confirmed both finished migration rows and the deterministic default workspace.

Existing-database adoption evidence:

- created a separate uniquely named disposable database;
- applied the pre-MODEL-002 baseline schema and seeded one user, two exact historical category labels, one account, and two transactions;
- recorded two categories, two transactions, total minor amount `19134`, credit total `12345`, debit total `6789`, and date range `2026-01-05 10:00:00` through `2026-02-06 11:30:00`;
- `prisma migrate resolve --applied 0_finance_baseline` recorded the baseline without replaying its SQL;
- `prisma migrate deploy` applied only MODEL-002;
- `prisma migrate status` reported the database schema up to date;
- database-to-current-schema diff reported no difference;
- category IDs and literal names, transaction totals and dates, user identity, and table counts remained unchanged;
- the default workspace, ADMIN membership backfill, nullable new transaction dimensions, seven MODEL-002 foreign keys, and five expected unique indexes were verified.

Cleanup and final regression evidence:

- both uniquely named disposable databases were dropped with forced local cleanup;
- the temporary `.migrate001-validation-*` workspace was removed;
- idempotent cleanup was rerun and produced no repository changes;
- focused normalized-history tests: 6 passed, with only the optional environment-driven database test skipped;
- full suite: 52 files, 235 tests passed, 1 optional test skipped;
- server TypeScript build passed;
- Prisma Client generation and Next.js production build passed with 18 routes;
- high-risk scan over schema, migrations, audit snapshot, test, and validation runner: no findings;
- documentation secret-material and runtime-execution scans: no findings.

`MIGRATE-001` is `DONE`. No real or production database was used. `_prisma_migrations` was modified only inside disposable databases through Prisma commands. No Prisma schema beyond MODEL-002, application service, financial source file, Docker file, dependency, environment file, production configuration, `.graphifyignore`, or `graphify-out/` change was made. The owner approved this explicit-path commit; no push is authorized. MODEL-003 remains blocked.

## 2026-07-04 current-chain local PostgreSQL validation

MIGRATE-001 database validation was rerun safely after MODEL-003 Packet A became part of the active migration chain. This was local-only and disposable.

Brain documentation read first:

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

Local database convention applied:

- OrbStack is the local container runtime.
- Plain `postgres:16` is used for local databases.
- Local database ports are reserved in the `5400-5499` range.
- Persistent local database definitions belong under `brain/operations/database/standalone/<app>/docker-compose.yml`.
- No persistent Yeshua Finance local database stack was documented, so validation used a temporary localhost-only disposable container.

Local connection facts:

- `SYSTEM_DATABASE_URL` targeted host `localhost`, port `5458`, admin database `postgres`.
- Username and password were present.
- The localhost guard passed.
- No production, Dokploy, MCP bridge, remote, or `10.0.2.4` database was used.

Active migration chain:

1. `prisma/migrations/0_finance_baseline`
2. `prisma/migrations/20260703001200_add_workspace_dimensions`
3. `prisma/migrations/20260703193000_add_classification_records`

Guarded marker test evidence:

- `tests/services/model002DomainSchema.test.ts`
- Database replay executed.
- Result: `7 passed`, no skip.

Fresh current-chain deployment evidence:

- Database: `yaf_migrate001_fresh_20260704122427_8458`
- `prisma migrate deploy` applied all three active migrations successfully.
- `prisma migrate status` reported the database schema is up to date.
- `prisma validate` passed.
- `prisma generate` passed.
- `prisma migrate diff` reported no difference.

Adoption rehearsal evidence:

- Database: `yaf_migrate001_adopt_20260704122514_32649`
- Applied `0_finance_baseline` manually.
- Seeded a synthetic fixture only: one user, two categories, one account, and two transactions.
- `prisma migrate resolve --applied 0_finance_baseline` passed.
- `prisma migrate deploy` applied MODEL-002 and MODEL-003 Packet A migrations successfully.
- `prisma migrate status` reported the database schema is up to date.
- `prisma validate` passed.
- `prisma migrate diff` reported no difference.
- Original counts, IDs, category labels, transaction amount totals, credit/debit totals, and date range remained stable.
- Transaction total remained `19134`; credit remained `12345`; debit remained `6789`.
- Date range remained `2026-01-05 10:00:00` through `2026-02-06 11:30:00`.
- MODEL-002 workspace and membership structures exist.
- MODEL-003 tables, enums, and foreign-key relations exist.
- No external historical finance data was inserted. Historical import remains a later task.

Cleanup:

- Dropped both disposable databases.
- Stopped and removed container `yeshua-finance-local-postgres-migrate001-20260704122344`.
- No `.env`, production configuration, Prisma schema, migration, test, server, source, `.graphifyignore`, or `graphify-out/` file was changed by validation.
- No commit or push was made.
