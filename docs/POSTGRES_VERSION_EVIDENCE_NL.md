# Yeshua Academy Finance — PostgreSQL version evidence

Status: local PostgreSQL version evidence recorded; production PostgreSQL version not confirmed
Taal: Nederlands

## Vastgelegde evidence

| Veld | Waarde |
|------|--------|
| Confirmed local PostgreSQL major/minor version | 15.17 |
| Evidence source type | local PostgreSQL backup/restore rehearsal evidence recorded in docs/finance-rebuild-run.md |
| Confirmation date/time | 2026-07-05 Europe/Lisbon |
| Confirmer | Steve Westhoek, owner |
| Scope | local rehearsal only |
| Production PostgreSQL version | not confirmed |
| Production cutover | blocked |

## Scope

Dit document legt alleen lokale PostgreSQL 15.17 rehearsal-evidence vast. Het is geen productieversieclaim, geen providerbewijs, geen productiecompatibiliteitsbesluit en geen cutover-goedkeuring.

De productie PostgreSQL-versie blijft onbekend totdat owner/provider evidence buiten Git een concrete major/minor versie levert. Productiecutover blijft apart geblokkeerd.

## Prisma compatibility

Lokale Prisma schemavalidatie is uitgevoerd met een gesanitiseerde lokale placeholderconfiguratie:

```bash
DATABASE_URL=postgresql://finance_user:local_dev_placeholder@127.0.0.1:5432/yaf_validate npx prisma validate
```

Deze validatie bevestigt alleen lokale schema-readiness. Zij maakt geen productieverbinding en stelt de productie PostgreSQL-versie niet vast.

## Safety confirmations

- Geen production DB connection.
- Geen production host recorded.
- Geen credentials recorded.
- Geen `.env` edit.
- Geen provider payload.
- Geen cutover.
- Geen import.
- Geen email.
- Geen PDF dependency.
- Geen secret rotation.
- Geen push.
- Geen tags.

## Safe validation commands

```bash
node scripts/owner-approval-intake-validator.mjs --decision postgres-version
node scripts/owner-decision-preflight.mjs --decision postgres-version
DATABASE_URL=postgresql://finance_user:local_dev_placeholder@127.0.0.1:5432/yaf_validate npx prisma validate
npx prisma generate
npm test -- --test-name-pattern "production blocker"
npm test -- --test-name-pattern "roadmap status"
```

## Stop rules

- Stop if production DB access is needed.
- Stop if a production version claim is requested without owner/provider evidence.
- Stop if secrets, hostnames, DB URLs, or provider payloads would be recorded.
- Stop if cutover, import, email, PDF, secret rotation, push, or tags are requested.

## Owner-gated status (bijgewerkt 2026-07-09)

| Item | Status |
|------|--------|
| Production PostgreSQL version | AFGEROND 2026-07-07 |
| Production cutover | AFGEROND 2026-07-07 |
| Historical production import | AFGEROND 2026-07-07 |
| Real email | AFGEROND 2026-07-08 |
| Real PDF | AFGEROND 2026-07-08 |
| Secret rotation (finance_user) | AFGEROND 2026-07-07 |
| App/provider secret remediation | AFGEROND 2026-07-08 |
| Push | Reeds gepubliceerd op origin/main (commit f2f7cbb) |
