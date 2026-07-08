# Yeshua Academy Finance — Owner-approved action plan

DRY-RUN PLAN ONLY — GEEN UITVOERING
Taal: Nederlands
Beslissing: `pdf`
Titel: Echte PDF-renderer afgerond
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

- Owner koos pdfkit.
- Dependencywijziging is uitgevoerd binnen goedgekeurde scope.
- Evidence is vastgelegd.

## Vereiste preflights

- node scripts/owner-decision-preflight.mjs --decision pdf
- npm test -- --test-name-pattern "production blocker"

## Exacte toekomstige prompt/uitvoering

- Geen PDF-prompt meer nodig; zie docs/REAL_PDF_RENDERER_EVIDENCE_NL.md.

## Validatiepoorten

- npm test -- --test-name-pattern "report artifact"
- npm run build:server
- npm run build
- git diff --check

## Rollback

- Revert PDF dependency en renderer commits.
- Laat report snapshots ongemoeid.

## Stopregels

- Build of rapportartifact-tests falen.
- Scope raakt echte e-mail of productie.
