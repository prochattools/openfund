# Yeshua Academy Finance — Aanbevolen volgende eigenaarsbeslissing

Status: aanbeveling voor decision selection — geen owner-gated actie uitgevoerd  
Taal: Nederlands

## Huidige staat

- `origin/main` is gepubliceerd door de owner-decision handoff commit `f2f7cbb docs: update post push owner decision handoff`.
- De lokale applicatie, release evidence en owner-decision handoff zijn klaar voor de volgende eigenaarskeuze.
- Deze notitie voert niets uit, bevestigt geen productieversie en wijzigt geen configuratie.

## Aanbevolen volgende beslissing

Aanbevolen sleutel: `postgres-version`

Deze beslissing is de veiligste eerste keuze omdat zij:

- low-risk is;
- verification-only is;
- een voorwaarde is voor productiecutover;
- geen productiemutatie vereist;
- geen databaseverbinding met productie vereist;
- geen secrets in Git of output vereist.

## Evidence die buiten Git van eigenaar/provider moet komen

- PostgreSQL major/minor versie.
- Bron van de bevestiging.
- Datum van de bevestiging.
- Bevestiging dat geen secrets, connection strings of productiecredentials worden gedeeld.

## Veilige preflight

```bash
node scripts/owner-approval-intake-validator.mjs --decision postgres-version
node scripts/owner-decision-preflight.mjs --decision postgres-version
DATABASE_URL=postgresql://finance_user:local_dev_placeholder@127.0.0.1:5432/yaf_validate npx prisma validate
npx prisma generate
```

Deze commando's bevestigen alleen lokale/schema-readiness. Zij bevestigen de productieversie niet.

## Niet goedgekeurd door deze aanbeveling

- Productiecutover.
- Historische productie-import.
- Echte e-mailverzending.
- Echte PDF-renderer.
- Secret rotation.
- Push naar remote.

## Exacte volgende owner approval prompt

```text
Owner approval received for decision postgres-version.

You are working in yeshuaacademy-finance only.
Record only the owner/provider-confirmed PostgreSQL major/minor version evidence without connecting to production.
Use docs/OWNER_APPROVAL_INTAKE_NL.md and docs/POST_APPROVAL_PROMPTS_NL.md.
Do not execute production cutover, historical import, real email, real PDF, secret rotation, push, tag creation, or any other owner-gated action.
Do not edit .env.
Do not print secrets.
Run the safe local preflights and report the confirmed version evidence, Prisma compatibility status, validation results, and final git status.
```

## Stopregels

Stop direct wanneer:

- de productieversie niet expliciet door eigenaar/provider buiten Git is bevestigd;
- bewijs een secret, connection string, credential, owner-bestand, ruwe transactierij of databasedump bevat;
- een stap productie, externe provider, echte e-mail, echte PDF, historische import, secret rotation, push of tags vereist;
- een lokale validatie faalt en één bounded repair attempt faalt;
- de scope wijzigt van verification-only naar cutover of migratie.

