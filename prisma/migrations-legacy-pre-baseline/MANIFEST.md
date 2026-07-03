# Legacy Prisma migration archive

Status: archived by approved `MIGRATE-001` normalization  
Run: `agent-f961650b-de17-4282-ab18-7a716cc72958`  
Source: `yeshuaacademy-finance`  
Pre-MODEL-002 baseline commit: `8a5ab3f6e45bb3032f00cc3bf56780c355a0859f`  
Provider: PostgreSQL

## Purpose

These 17 migration directories are retained byte-identically for audit. They are no longer the active fresh-database migration path because the historical order cannot replay from an empty database.

The active migration history now contains:

1. `0_finance_baseline`, generated from the pre-MODEL-002 schema represented by commit `8a5ab3f6e45bb3032f00cc3bf56780c355a0859f`;
2. `20260703001200_add_workspace_dimensions`, retained byte-identically after the baseline.

`PRE_MODEL002_SCHEMA.prisma` is the formatted audit snapshot used as the deterministic `prisma migrate diff --from-empty` input. The generated baseline contains schema objects only and no application or financial rows.

The active MODEL-002 migration hash captured before archival work is:

```text
e70917a1c9ce059667f8266860376b5dcf3380974f665d7e11f58bcf5f96e70e  prisma/migrations/20260703001200_add_workspace_dimensions/migration.sql
```

## Original order and classification

| Order | Directory | Classification | Replay note |
| ---: | --- | --- | --- |
| 1 | `20241121_add_categorization_rule_conditions` | early finance rule change | Alters `CategorizationRule` before it exists. |
| 2 | `20241125_add_categorization_rule_conditions` | duplicate early finance rule change | Repeats the same column addition before the table exists. |
| 3 | `20250204091431_init` | obsolete SaaS/template initializer | Creates subscription, automation `Project`, and audience tables only. |
| 4 | `20250204091647_assistant_id` | obsolete SaaS/template change | Alters automation `Project`. |
| 5 | `20250204100937_assistant_id_string` | obsolete SaaS/template change | Alters automation `Project`. |
| 6 | `20250206094716_project_webhooklink` | obsolete SaaS/template change | Adds a required automation field. |
| 7 | `20250210132339_project_strings` | obsolete SaaS/template change | Alters automation identifiers. |
| 8 | `20250226140000_import_fingerprint` | early finance transaction change | Alters `Transaction` before it exists. |
| 9 | `20251003194500_ledger_init` | first finance initializer | Creates `User`, `Category`, `Ledger`, and `Transaction`. |
| 10 | `20251011191500_import_pipeline_v2` | finance import evolution | Adds accounts, import batches, integer amounts, and direction. |
| 11 | `20251011194500_reconciliation_opening_balances` | reconciliation | Adds opening balances and ledger controls. |
| 12 | `20251011200500_ledger_lock_table` | period control | Adds `LedgerLock`. |
| 13 | `20251011204000_rule_engine` | categorization | Creates `CategorizationRule` and classification relations. |
| 14 | `20260514191000_remove_saas_bloat_models` | private-finance cleanup | Removes obsolete SaaS/template models. |
| 15 | `20260514191500_add_audit_log` | auditability | Adds `AuditLog`. |
| 16 | `20260514194000_add_email_recipients` | reporting | Adds `EmailRecipient`. |
| 17 | `20260514204000_store_original_import_file` | source preservation | Adds original-file bytes and hashes to `ImportBatch`. |

## Integrity

`SHA256SUMS` records the pre-move SHA-256 digest for every archived `migration.sql` file. Validation must recompute all hashes after the move and require exact equality.

Do not edit archived migration files. Any future correction belongs in a new active migration or a separately approved normalization revision.
