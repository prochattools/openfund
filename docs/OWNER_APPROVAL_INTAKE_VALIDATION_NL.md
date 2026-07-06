# Yeshua Academy Finance — Owner approval intake validation

Status: gereed voor statische owner-approval beoordeling — geen uitvoering
Taal: Nederlands

## Guards

- Deze validator voert geen owner-gated actie uit.
- Deze validator leest geen .env.
- Deze validator gebruikt geen netwerk, database, productiehost of externe provider.
- Deze validator schrijft alleen het validatiedocument wanneer --write is meegegeven.

## Beslissingen

### PDF-renderer

Sleutel: `pdf`

Minimum required approval fields:
- Gekozen bibliotheeknaam.
- Licentie- en runtime-impact akkoord.
- Dependencywijziging expliciet toegestaan.
- Rollback-eigenaar bevestigd.

Forbidden ambiguous approvals:
- Maak PDF maar zonder bibliotheekkeuze.
- Installeer wat nodig is.
- Maak het live zonder validatie.

Required preflight commands:
- node scripts/owner-decision-preflight.mjs --decision pdf
- node scripts/owner-approved-action-plan.mjs --decision pdf

Required validation commands:
- npm test -- --test-name-pattern "report artifact"
- npm run build:server
- npm run build
- git diff --check

Stop rules:
- Stop bij ontbrekende bibliotheekkeuze.
- Stop bij dependency-, licentie-, build- of testtwijfel.

Evidence to report back:
- Bibliotheeknaam.
- Commit hash.
- Test/build/high-risk scan resultaten.
- Finale git status.

### PostgreSQL-versiebevestiging

Sleutel: `postgres-version`

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

### Productiecutover

Sleutel: `production-cutover`

Minimum required approval fields:
- Expliciete scope: voorbereiding-only of uitvoering.
- Back-upvenster bevestigd.
- Rollback-eigenaar bevestigd.
- Productiegegevens blijven buiten Git.

Forbidden ambiguous approvals:
- Zet productie maar over.
- Gebruik de bekende gegevens.
- Voer alles uit wat nodig is.

Required preflight commands:
- node scripts/owner-decision-preflight.mjs --decision production-cutover
- node scripts/owner-approved-action-plan.mjs --decision production-cutover
- npm run validate:release-candidate

Required validation commands:
- npm test
- npm run build:server
- npm run build
- npx prisma validate
- git diff --check

Stop rules:
- Stop bij ontbrekende back-up.
- Stop bij ontbrekende rollback-eigenaar.
- Stop bij secret in output.

Evidence to report back:
- Goedgekeurde cutover scope.
- Preflight resultaten.
- Rollback readiness.
- Gesanitiseerde status.

### Historische import

Sleutel: `historical-import`

Minimum required approval fields:
- Periodes/jaren exact in scope.
- Owner-bestanden blijven buiten Git.
- Hashes en control totals zijn bekend.
- Dry-run acceptatie is vereist vóór write.

Forbidden ambiguous approvals:
- Importeer de historische bestanden.
- Gebruik de bestanden die je vindt.
- Schrijf direct naar productie.

Required preflight commands:
- node scripts/owner-decision-preflight.mjs --decision historical-import
- npm test -- --test-name-pattern "historical"

Required validation commands:
- npm test -- --test-name-pattern "production blocker"
- npm test -- --test-name-pattern "historical"
- git diff --check

Stop rules:
- Stop bij owner-bestanden binnen repo.
- Stop bij hash mismatch.
- Stop bij ruwe rijen in output.

Evidence to report back:
- Gesanitiseerde totalen.
- Hash/control-total status.
- Dry-run acceptatie.
- Finale git status.

### E-mailprovider

Sleutel: `email`

Minimum required approval fields:
- Providerkeuze.
- Secretbeheer buiten Git.
- No-send of send-scope exact bevestigd.
- Testontvangers goedgekeurd.

Forbidden ambiguous approvals:
- Zet e-mail aan.
- Gebruik een provider naar keuze.
- Stuur een test zonder ontvangerscope.

Required preflight commands:
- node scripts/owner-decision-preflight.mjs --decision email
- node scripts/owner-approved-action-plan.mjs --decision email

Required validation commands:
- npm test -- --test-name-pattern "report dispatch"
- npm test -- --test-name-pattern "production blocker"
- npm run build:server

Stop rules:
- Stop bij secret in diff of output.
- Stop bij echte verzending zonder send-go.
- Stop bij provider-call in preflight.

Evidence to report back:
- No-send/send scope.
- Dispatch test resultaten.
- Secret redaction confirmation.
- Finale git status.

### Secret rotation

Sleutel: `secret-rotation`

Minimum required approval fields:
- Exacte secretlijst buiten Git.
- Beheerlocatie buiten Git.
- Rollback-eigenaar.
- Validatieplan zonder secret-output.

Forbidden ambiguous approvals:
- Roteer alle secrets.
- Werk .env bij.
- Print de nieuwe waarden ter controle.

Required preflight commands:
- node scripts/owner-decision-preflight.mjs --decision secret-rotation
- git diff --check

Required validation commands:
- npm test -- --test-name-pattern "production blocker"
- git diff --check

Stop rules:
- Stop bij secret in diff of output.
- Stop bij .env wijziging.
- Stop bij onduidelijke secret scope.

Evidence to report back:
- Gesanitiseerde rotatiestatus.
- Validatieresultaten.
- Rollback readiness.
- Finale git status.

### Remote publish

Sleutel: `push`

Minimum required approval fields:
- Exacte push-goedkeuring.
- Doelremote en branch.
- Commit hash.
- Validatie opnieuw gedraaid.

Forbidden ambiguous approvals:
- Publiceer alles.
- Push wanneer klaar.
- Maak ook een tag.

Required preflight commands:
- npm run preflight:push-readiness
- npm run validate:release-candidate

Required validation commands:
- git status --short --branch
- npm run preflight:push-readiness
- npm run validate:release-candidate

Stop rules:
- Stop bij onverwachte dirty files.
- Stop bij falende validatie.
- Stop bij tag- of force-scope.

Evidence to report back:
- Remote en branch.
- Pushed commit hash.
- Validatieresultaten.
- Finale git status.

## Bevestiging

- Deze validator voert niets uit.
- Deze validator registreert geen approval in Git.
- Owner-gated acties blijven geblokkeerd tot een aparte expliciete prompt.
