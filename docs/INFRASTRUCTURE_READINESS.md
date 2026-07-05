# Yeshua Academy Finance — Infrastructure Readiness

Status: local-only; production not touched  
Maintained by: `docs/IMPLEMENTATION_PLAN.md` Phase 8 (INFRA-001, INFRA-002, INFRA-003)

## Scope

This document records the local development infrastructure baseline, PostgreSQL compatibility notes,
migration chain status, and local validation conventions.

It does **not** cover production configuration, production host details, or production credentials.
The production cutover plan is a separate document: `docs/PRODUCTION_CUTOVER_PLAN_NL.md`.

## Prisma versie

| Package | Versie (package.json) |
|---------|----------------------|
| `prisma` (dev) | `^6.15.0` |
| `@prisma/client` | `^6.15.0` |

Prisma 6.x ondersteunt PostgreSQL 13 t/m 17 (en nieuwer, tot de leverancier dit bijwerkt).
Zie de officiële Prisma-compatibiliteitsmatrix voor bevestiging vóór een productiemigratie.

## Actieve migratiereeks

De migratiereeks bestaat uit vier actieve migraties:

| Map | Beschrijving |
|-----|-------------|
| `prisma/migrations/0_finance_baseline/` | Gegenereerde baseline van 17 gelegeerde legacy-migraties |
| `prisma/migrations/20260703001200_add_workspace_dimensions/` | MODEL-002: Workspace, Klant, Type, Category |
| `prisma/migrations/20260703193000_add_classification_records/` | MODEL-003: classificatierecords |
| `prisma/migrations/20260704143000_add_statement_close_report_models/` | MODEL-004/005: afschrift, periode, rapportage |

Vergrendeld op: `provider = "postgresql"` (zie `prisma/migrations/migration_lock.toml`).

Alle vier migraties zijn succesvol toegepast op een wegwerpdatabase (`localhost:5452`) tijdens
de MODEL-004/005-validatieronde (zie `docs/finance-rebuild-run.md`). Er zijn geen schemaverschillen
vastgesteld.

## Lokale validatieconventies

- Database-URL voor testen: `localhost` of `127.0.0.1`, poort 5432 (standaard) of 5452 (wegwerp).
- Wegwerpdatabases worden aangemaakt vóór de test en verwijderd na validatie.
- Productielike hostnamen (`10.0.2.4`, Dokploy, externe hosts) worden geblokkeerd door guards in
  `server/services/historicalOwnerImportCommandService.ts` en de rehearsalservices.
- `.env` wordt nooit aangepast tijdens lokale validatierondes.

## Aanbeveling PostgreSQL-versie

Voor lokale ontwikkeling: gebruik de huidige `postgres:16` of `postgres:17` Docker-image.

Criteria voor de definitieve keuze:

1. **Prisma-ondersteuning**: bevestig dat de gekozen major-versie door Prisma 6.x wordt ondersteund
   via de officiële compatibiliteitsmatrix.
2. **Productieprovider**: controleer welke PostgreSQL-versie de hostingprovider (Dokploy/VPS)
   actueel levert; kies dezelfde major-versie voor lokale pariteit.
3. **LTS-status**: geef de voorkeur aan een versie met actieve ondersteuning.

> **Belangrijk**: de definitieve productieversi van PostgreSQL moet worden bevestigd bij de
> hostingprovider *vóór* de productieoverstap. Noteer de bevestigde versie in
> `docs/PRODUCTION_CUTOVER_PLAN_NL.md` zodra deze beschikbaar is.

## Lokale Docker Compose

Het bestaande bestand `docker-compose.yml` bevat een verouderde WordPress/MySQL/PostgreSQL-configuratie
die niet overeenkomt met de huidige applicatie.

Vervangend bestand: `docker-compose.local.yml`

Dit lokale Compose-bestand bevat uitsluitend PostgreSQL, met:

- placeholder-credentials (nooit productiewaarden);
- een named volume (`finance_local_db`);
- een healthcheck;
- een localhost-only port mapping (`127.0.0.1:5432:5432`).

Gebruik:

```bash
# Start lokale database
docker compose -f docker-compose.local.yml up -d

# Controleer status
docker compose -f docker-compose.local.yml ps

# Wacht tot healthcheck groen is, voer dan uit
DATABASE_URL="postgresql://finance_user:local_dev_placeholder@127.0.0.1:5432/finance" \
  npx prisma migrate deploy

# Stop en verwijder lokale data
docker compose -f docker-compose.local.yml down -v
```

## Validatiestatuur

| Controle | Status |
|---------|--------|
| `prisma validate` | Lokaal gevalideerd |
| `prisma generate` | Lokaal gevalideerd |
| `npm test` (volledig) | 83 testbestanden, 535 geslaagd, 3 overgeslagen |
| `npm run build:server` | Schone TypeScript-compilatie |
| `npm run build` | 18 statische pagina's gegenereerd |
| Wegwerpdatabase migratievalidatie | Geslaagd (MODEL-004/005, zie rebuild-run) |
| Productiemigratie | Nog niet uitgevoerd — wacht op bevestiging van eigenaar |
