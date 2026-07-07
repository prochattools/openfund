# Yeshua Academy Finance — Owner-approved action plan

DRY-RUN PLAN ONLY — GEEN UITVOERING
Taal: Nederlands
Beslissing: `postgres-version`
Titel: PostgreSQL-productieversie bevestigen
Status: PLAN GEREED VOOR REVIEW
Release-status: Release-evidence aanwezig

## Guards

- Dit script leest geen `.env`.
- Dit script gebruikt geen netwerk, database, productiehost of externe provider.
- Dit script voert geen publicatie, tag, dependency-installatie, e-mail, import of secret-rotatie uit.
- Dit script schrijft alleen `docs/OWNER_APPROVED_ACTION_PLAN_NL.md` wanneer `--write` is meegegeven.

## Ontbrekende documenten

- Geen

## Vereiste approval evidence

- Hostingprovider bevestigt versie.
- Prisma-compatibiliteit is opnieuw gecontroleerd.
- Cutover blijft apart geblokkeerd.

## Vereiste preflights

- node scripts/owner-decision-preflight.mjs --decision postgres-version
- npx prisma validate

## Exacte toekomstige prompt/uitvoering

- Gebruik de PostgreSQL-versieprompt uit docs/POST_APPROVAL_PROMPTS_NL.md.

## Validatiepoorten

- Prisma validate/generate lokaal.
- Geen productieconnectie.

## Rollback

- Geen schemawijziging zonder aparte migratie.
- Documenteer alleen bevestigde versie.

## Stopregels

- Versie niet bevestigd.
- Providerinformatie onzeker.
- Productieconnectie nodig.
