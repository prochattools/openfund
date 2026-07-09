# Productie Schema Cutover — Bewijs

**Status:** Productie schema cutover voltooid.

## Identificatie

| Veld | Waarde |
|------|--------|
| Branch | main |
| Startcommit | 8ce2dfb |
| Productie database | finance |
| Productie schema | finance |
| Productie gebruiker | finance_user |
| Productie poort | 5433 |
| PostgreSQL server versie | 15.8 |
| Datum | 2026-07-07 |

## Migratiestatus vóór deploy

Prisma rapporteerde een divergentie: de `_prisma_migrations`-tabel in de production database bevatte 10 oude migraties uit een vorige bouw die niet meer in de lokale migratiehistorie staan. De finance_user had onvoldoende rechten om DDL uit te voeren. Actie genomen (goedgekeurd door eigenaar, geen datapreservatie vereist):

- Finance schema verwijderd (DROP SCHEMA finance CASCADE) via supabase_admin
- Finance schema opnieuw aangemaakt (CREATE SCHEMA finance)
- Rechten verleend aan finance_user op het nieuwe schema
- Migraties gedeployed via supabase_admin

## Migraties gedeployed

```
migrations/
  └─ 0_finance_baseline/migration.sql
  └─ 20260703001200_add_workspace_dimensions/migration.sql
  └─ 20260703193000_add_classification_records/migration.sql
  └─ 20260704143000_add_statement_close_report_models/migration.sql

Resultaat: All migrations have been successfully applied.
```

## Migratiestatus na deploy

```
Migrations: 0 applied, 0 pending
```

## Schema- en tabelverificatie

| Verificatiepunt | Resultaat |
|-----------------|-----------|
| Finance schema aanwezig | Bevestigd |
| Kern tabellen aanwezig | 11 van 11 |
| Totaal tabellen in finance schema | 30 |
| FinanceWorkspace rijen | 1 |

Kern tabellen geverifieerd: Account, BankStatement, Category, FinanceWorkspace, PeriodClose, ReportSnapshot, SourceFile, StatementPeriod, Transaction, TransactionBooking, User.

## Eigenaarsinstructies en beperkingen bevestigd

- Eigenaar heeft bevestigd dat geen productiedata bewaard hoeft te worden.
- Verbindingsstring, wachtwoord, host en credentials zijn niet vastgelegd in docs, tests, scripts, commits of logs.
- Geen tags aangemaakt.
- Geen force push gebruikt.

## Resterende items (alle afgerond in latere sessies)

De onderstaande items waren op het moment van schema cutover (2026-07-07) nog niet uitgevoerd. **Alle zijn inmiddels afgerond in latere sessies:**

1. **Historische productie-import** — AFGEROND 2026-07-07 (902 transacties, 681 boekingen)
2. **Echte e-mail** — AFGEROND 2026-07-08 (Resend provider, begrensde productie-verificatie geslaagd)
3. **Echte PDF-generatie** — AFGEROND 2026-07-08 (`pdfkit` renderer)
4. **Geheimrotatie (finance_user)** — AFGEROND 2026-07-07 (wachtwoord geroteerd via supabase_admin)
5. **App/provider geheimremediatie** — AFGEROND 2026-07-08 (Clerk, Resend, New Relic, Request Access Secret)
6. **Database credential finalisatie** — AFGEROND 2026-07-07 (finaal credential in Dokploy runtime)
