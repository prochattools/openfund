# Yeshua Academy Finance — Owner approval intake validation

Status: gereed voor statische owner-approval beoordeling — geen uitvoering
Taal: Nederlands

## Guards

- Deze validator voert geen owner-gated actie uit.
- Deze validator leest geen .env.
- Deze validator gebruikt geen netwerk, database, productiehost of externe provider.
- Deze validator schrijft alleen het validatiedocument wanneer --write is meegegeven.

## Beslissingen

### PostgreSQL-versiebevestiging

Sleutel: `postgres-version`

Lokale evidence:
- `docs/POSTGRES_VERSION_EVIDENCE_NL.md` registreert lokale PostgreSQL 15.17 rehearsal evidence.
- Productieversie en productiecompatibiliteit blijven afhankelijk van owner/provider evidence buiten Git.

Minimum required approval fields:
- Provider/eigenaar bevestigt major/minor versie buiten Git.
- Bronsoort en datum zijn bekend.
- Prisma-compatibiliteit is beoordeeld.
- Cutover blijft apart geblokkeerd.

Forbidden ambiguous approvals:
- Controleer productie maar gebruik geen details.
- Neem aan dat de versie goed is.
- Ga door met cutover.

Required preflight commands:
- node scripts/owner-decision-preflight.mjs --decision postgres-version
- npx prisma validate

Required validation commands:
- npx prisma validate
- npx prisma generate
- node scripts/final-docs-consistency-audit.mjs

Stop rules:
- Stop bij onbekende versie.
- Stop bij productieconnection string in input.
- Stop bij incompatibiliteit.

Evidence to report back:
- Bevestigde versie, zonder secrets.
- Compatibiliteitsbeoordeling.
- Docs audit resultaat.
- Finale git status.

## Bevestiging

- Deze validator voert niets uit.
- Deze validator registreert geen approval in Git.
- Owner-gated acties blijven geblokkeerd tot een aparte expliciete prompt.
