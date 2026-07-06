# Yeshua Academy Finance — Decision brief: historische import

Status: Geblokkeerd tot expliciete eigenaargoedkeuring
Taal: Nederlands

## 1. Beslissing

Voer later een dry-run of productie-import van historische owner-data uit. Owner-bestanden blijven altijd buiten Git.

## 2. Vereiste owner approval evidence

- Exacte jaren/periodes in scope.
- Owner-bestanden zijn buiten Git beschikbaar.
- Verwachte hashes en control totals zijn vastgelegd.
- Dry-run acceptatie is expliciet voordat import wordt uitgevoerd.

## 3. Vereiste inputs buiten Git

- Owner Excel/CSV/PDF-bestanden buiten de repo.
- Verwachte bestands-hashes.
- Control totals per periode.
- Operator die dry-run accepteert.

## 4. Veilige preflight commands

```bash
node scripts/owner-decision-preflight.mjs --decision historical-import
npm test -- --test-name-pattern "historical"
npm test -- --test-name-pattern "production blocker"
```

## 5. Veilige dry-run commands

```bash
node scripts/backup-restore-rehearsal.mjs --dry-run
```

Een toekomstige import-dry-run mag alleen owner-bestanden buiten Git lezen en mag geen ruwe rijen rapporteren.

## 6. Verboden acties vóór approval

- Geen owner-bestanden in Git.
- Geen ruwe transactierijen in docs, tests of commits.
- Geen productie-import.
- Geen non-local database in local-only stappen.

## 7. Uitvoeringsoutline na approval

1. Verifieer owner-bestanden buiten Git.
2. Controleer hashes en control totals.
3. Draai dry-run en rapporteer alleen gesanitiseerde totalen.
4. Vraag expliciete acceptatie van dry-run.
5. Voer import alleen uit wanneer die aparte approval aanwezig is.

## 8. Validatiepoorten

- Historical import planner tests.
- Owner-local rehearsal tests.
- Production blocker tests.
- Full suite.
- Diff check.
- High-risk scan op gewijzigde docs/tests/scripts/package paths.

## 9. Rollbackplan

- Stop vóór write bij mismatch.
- Gebruik databaseback-up voor rollback wanneer later een goedgekeurde import is uitgevoerd.
- Revert code/docs commits via normale Git-procedure.

## 10. Stopregels

- Stop bij ontbrekende hash of control total.
- Stop bij owner-bestand binnen repo.
- Stop bij onbalans.
- Stop bij ruwe rijen in output.
- Stop bij productie-uitvoering zonder aparte explicit approval.

## 11. Exacte toekomstige approval prompt

```text
Owner approval received for decision historical-import.
Use docs/DECISION_BRIEF_HISTORICAL_IMPORT_NL.md and docs/OWNER_APPROVAL_INTAKE_NL.md.
Use owner source files outside Git only.
Run dry-run first, verify hashes and control totals, and report sanitized totals only.
Do not execute production import unless separately approved after dry-run acceptance.
Do not run production cutover, real email, PDF dependency installation, secret rotation, tags, or force push.
```

## 12. Bevestiging

Deze brief voert niets uit en kopieert geen owner-bestanden naar Git.
