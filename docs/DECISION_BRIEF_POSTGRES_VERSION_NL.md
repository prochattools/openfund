# Yeshua Academy Finance — Decision brief: PostgreSQL-versie

Status: Geblokkeerd tot expliciete eigenaargoedkeuring
Taal: Nederlands

## 1. Beslissing

Bevestig later de productie PostgreSQL-versie op basis van eigenaar/providerbewijs buiten Git. Deze brief maakt geen productieverbinding.

## 1a. Lokale evidence die al beschikbaar is

- `docs/POSTGRES_VERSION_EVIDENCE_NL.md` legt lokale rehearsal evidence vast voor versie 15.17.
- Die evidence komt uit `docs/finance-rebuild-run.md` en heeft scope: local rehearsal only.
- Dit is geen productieversieclaim en geen cutover-goedkeuring.

## 2. Vereiste owner approval evidence

- Eigenaar bevestigt de bron van de versie-informatie.
- Major/minor versie is buiten Git vastgelegd.
- Prisma-compatibiliteit is beoordeeld.
- Cutover blijft apart geblokkeerd.

## 3. Vereiste inputs buiten Git

- Versie uit hostingdashboard of providercommunicatie.
- Datum/tijd van bevestiging.
- Naam/rol van de eigenaar die bevestigt.
- Eventuele upgradebeslissing buiten Git.

## 4. Veilige preflight commands

```bash
node scripts/owner-decision-preflight.mjs --decision postgres-version
npx prisma validate
npx prisma generate
```

## 5. Veilige dry-run commands

```bash
npx prisma validate
```

Gebruik hierbij alleen een lokale placeholder databaseconfiguratie wanneer de omgeving daarom vraagt; plaats geen connection string in Git of output.

## 6. Verboden acties vóór approval

- Geen productie-DB verbinding.
- Geen provider call vanuit deze repo.
- Geen productiecredential in output of Git.
- Geen cutover uitvoeren.

## 7. Uitvoeringsoutline na approval

1. Registreer alleen de bevestigde versie en bronsoort.
2. Controleer Prisma-compatibiliteit lokaal.
3. Werk owner docs bij zonder secrets of providerpayloads.
4. Laat cutover expliciet geblokkeerd.

## 8. Validatiepoorten

- Prisma validate/generate.
- Owner decision preflight.
- Docs consistency audit.
- Link integrity guard.
- High-risk scan op gewijzigde docs/tests/scripts/package paths.

## 9. Rollbackplan

- Revert documentatiecommit als de versiebron onjuist was.
- Geen databasewijziging terug te draaien, want deze brief maakt geen verbinding.

## 10. Stopregels

- Stop bij onbekende of tegenstrijdige versie.
- Stop bij productie-URL of secret in input.
- Stop bij incompatibiliteit zonder expliciet vervolgplan.

## 11. Exacte toekomstige approval prompt

```text
Owner approval received for decision postgres-version.
Use docs/DECISION_BRIEF_POSTGRES_VERSION_NL.md and docs/OWNER_APPROVAL_INTAKE_NL.md.
Record only the owner/provider-confirmed PostgreSQL version evidence without connecting to production.
Keep production cutover, historical import, real email, PDF renderer, and secret rotation blocked.
Run Prisma validate/generate and docs audits.
Report commit hash and final git status.
```

## 12. Bevestiging

Deze brief voert niets uit en maakt geen productieverbinding.
