# Yeshua Academy Finance — Decision brief: productiecutover

Status: Geblokkeerd voor toekomstige referentie — zie `docs/PRODUCTION_SCHEMA_CUTOVER_EVIDENCE_NL.md` voor bewijs van uitgevoerde cutover (2026-07-07)
Taal: Nederlands

## 1. Beslissing

Schema cutover naar productie is afgerond op 2026-07-07. PostgreSQL 15.8, database finance, schema finance, 4 migraties, 30 tabellen. Zie `docs/PRODUCTION_SCHEMA_CUTOVER_EVIDENCE_NL.md` voor sanitized bewijs. Deze brief voert niets uit, verbindt niet met productie en wijzigt geen productieconfiguratie.

## 2. Vereiste owner approval evidence

- Expliciete cutover-goedkeuring.
- Back-upvenster en rollback-eigenaar.
- Bevestigde productie PostgreSQL-versie buiten Git.
- Duidelijke scope: voorbereiding-only of daadwerkelijke uitvoering.

## 3. Vereiste inputs buiten Git

- Productiecredentials in veilige beheeromgeving.
- Onderhoudsvenster.
- Back-up evidence.
- Rollbackcontact en communicatieplan.

## 4. Veilige preflight commands

```bash
node scripts/owner-decision-preflight.mjs --decision production-cutover
node scripts/owner-approved-action-plan.mjs --decision production-cutover
npm run validate:release-candidate
```

## 5. Veilige dry-run commands

```bash
node scripts/backup-restore-rehearsal.mjs --dry-run
node scripts/final-owner-review-preflight.mjs --check
```

## 6. Verboden acties vóór approval

- Geen productieverbinding.
- Geen migratie tegen productie.
- Geen productieconfiguratie wijzigen.
- Geen secrets in Git of output.
- Geen historische import of real-email activatie.

## 7. Uitvoeringsoutline na approval

1. Herbevestig owner approval intake.
2. Herhaal lokale release-candidate validatie.
3. Controleer back-up en rollbackplan.
4. Voer alleen de expliciet goedgekeurde cutover-stap uit.
5. Rapporteer gesanitiseerde status en stop bij elke afwijking.

## 8. Validatiepoorten

- Full suite.
- Server build.
- Production build.
- Prisma validate/generate.
- Backup dry-run.
- Post-cutover health checks alleen wanneer cutover expliciet is goedgekeurd.

## 9. Rollbackplan

- Gebruik vooraf goedgekeurde back-up.
- Revert applicatiecommit via normale Git-procedure.
- Geen force push.
- Leg oorzaak en herstelpad vast.

## 10. Stopregels

- Stop bij ontbrekende back-up.
- Stop bij ontbrekende PostgreSQL-versiebevestiging.
- Stop bij productiecredential in Git/output.
- Stop bij onduidelijke scope.

## 11. Exacte toekomstige approval prompt

```text
Owner approval received for decision production-cutover.
Use docs/DECISION_BRIEF_PRODUCTION_CUTOVER_NL.md, docs/PRODUCTION_CUTOVER_PLAN_NL.md, and docs/OWNER_APPROVAL_INTAKE_NL.md.
Execute only the explicitly approved cutover scope.
Do not run historical import, real email, PDF dependency installation, secret rotation, tags, or force push.
Report sanitized evidence, validation result, rollback readiness, commit hash, and final git status.
```

## 12. Bevestiging

Deze brief voert niets uit, verbindt niet met productie en wijzigt geen productieconfiguratie.
