# Yeshua Academy Finance — Decision brief: PDF-renderer

Status: Geblokkeerd tot expliciete eigenaargoedkeuring
Taal: Nederlands

## 1. Beslissing

Kies of en welke echte PDF-renderer later wordt geïmplementeerd. Deze brief vergelijkt keuzecriteria; er wordt geen dependency geïnstalleerd.

## 2. Vereiste owner approval evidence

- Naam van de gekozen PDF-bibliotheek.
- Licentie en runtime-impact zijn beoordeeld.
- Eigenaar keurt dependencywijziging expliciet goed.
- Scope bevestigt dat alleen PDF-rendering wordt aangepakt.

## 3. Vereiste inputs buiten Git

- Bibliotheekkeuze en rationale.
- Licentiebeoordeling.
- Performance- en hostingimpact.
- Rollback-eigenaar.

## 4. Veilige preflight commands

```bash
node scripts/owner-decision-preflight.mjs --decision pdf
node scripts/owner-approved-action-plan.mjs --decision pdf
npm test -- --test-name-pattern "production blocker"
```

## 5. Veilige dry-run commands

```bash
npm test -- --test-name-pattern "report artifact"
npm run build:server
```

## 6. Verboden acties vóór approval

- Geen PDF dependency installeren.
- Geen echte PDF-output claimen.
- Geen productie of externe provider gebruiken.
- Geen geheimen of owner-bestanden toevoegen.

## 7. Uitvoeringsoutline na approval

1. Herhaal preflight en release-candidate validatie.
2. Installeer alleen de goedgekeurde bibliotheek.
3. Implementeer renderer achter bestaande rapportartifact-grens.
4. Behoud HTML/XLSX snapshotconsistentie.
5. Voeg gerichte tests toe en commit alleen de goedgekeurde scope.

## 8. Validatiepoorten

- Report artifact tests.
- Production blocker tests.
- Full test suite.
- Server build.
- Production build.
- Prisma validate/generate wanneer schema-onafhankelijkheid bevestigd moet worden.
- High-risk scan op gewijzigde docs/tests/scripts/package paths.

## 9. Rollbackplan

- Revert dependency- en renderercommits.
- Herstel PDF placeholder en blocker.
- Laat rapport snapshots ongemoeid.

## 10. Stopregels

- Stop bij ontbrekende bibliotheekkeuze.
- Stop bij licentie- of runtime-onzekerheid.
- Stop bij build/test/audit failure na bounded repair.
- Stop wanneer de scope productie, e-mail, import of secret rotation raakt.

## 11. Exacte toekomstige approval prompt

```text
Owner approval received for decision pdf.
Use docs/DECISION_BRIEF_PDF_RENDERER_NL.md and docs/OWNER_APPROVAL_INTAKE_NL.md.
Implement only the approved PDF renderer scope.
Do not execute production cutover, historical import, real email, secret rotation, tags, or force push.
Validate report artifact tests, full suite, builds, and high-risk scan.
Report commit hash and final git status.
```

## 12. Bevestiging

Deze brief voert niets uit, installeert niets en wijzigt geen runtimeconfiguratie.
