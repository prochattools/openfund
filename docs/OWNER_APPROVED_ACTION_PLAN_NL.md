# Yeshua Academy Finance — Owner-approved action plan

DRY-RUN PLAN ONLY — GEEN UITVOERING
Taal: Nederlands
Beslissing: `pdf`
Titel: Echte PDF-renderer implementeren
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

- Owner kiest PDF-bibliotheek.
- Licentie/runtime-impact is akkoord.
- Dependencywijziging is expliciet toegestaan.

## Vereiste preflights

- node scripts/owner-decision-preflight.mjs --decision pdf
- npm test -- --test-name-pattern "production blocker"

## Exacte toekomstige prompt/uitvoering

- Gebruik de PDF-sectie uit docs/POST_APPROVAL_PROMPTS_NL.md.

## Validatiepoorten

- npm test -- --test-name-pattern "report artifact"
- npm run build:server
- npm run build
- git diff --check

## Rollback

- Revert PDF dependency en renderer commits.
- Herstel PDF_BLOCKER wanneer validatie faalt.

## Stopregels

- Geen bibliotheekkeuze.
- Dependency-audit onduidelijk.
- Build of rapportartifact-tests falen.
