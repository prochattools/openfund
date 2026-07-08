# Yeshua Academy Finance — Decision brief: secret rotation

Status: Geblokkeerd (was vóór 2026-07-07) — GEDEELTELIJK VOLTOOID 2026-07-07; databasecredential en Request Access Secret afgerond; Clerk/Resend/New Relic providerrotaties handmatig openstaand; bewijs in `docs/PRODUCTION_SECRET_ROTATION_EVIDENCE_NL.md` en `docs/PRODUCTION_APP_PROVIDER_SECRET_ROTATION_EVIDENCE_NL.md`
Taal: Nederlands

## 1. Beslissing

Roteer later geheimen buiten Git. Deze brief wijzigt geen `.env`, secrets of productieconfiguratie.

## 2. Vereiste owner approval evidence

- Exacte lijst van geheimen die roteren.
- Beheerlocatie buiten Git.
- Cutovervolgorde.
- Rollback- en verificatie-eigenaar.

## 3. Vereiste inputs buiten Git

- Nieuwe en oude secretstatus in veilige beheeromgeving.
- Rollbackvenster.
- Applicatieherstartplan, indien nodig.
- Communicatiekanaal buiten Git.

## 4. Veilige preflight commands

```bash
node scripts/owner-decision-preflight.mjs --decision secret-rotation
git diff --check
npm run validate:release-candidate
```

## 5. Veilige dry-run commands

```bash
npm test -- --test-name-pattern "production blocker"
```

## 6. Verboden acties vóór approval

- Geen `.env` edit.
- Geen secret in Git, docs, tests of terminaloutput.
- Geen productieconfiguratie wijzigen.
- Geen provider call.

## 7. Uitvoeringsoutline na approval

1. Bevestig exacte secret scope buiten Git.
2. Roteer in de goedgekeurde beheeromgeving.
3. Valideer applicatie zonder secrets te printen.
4. Rapporteer alleen gesanitiseerde status.

## 8. Validatiepoorten

- Secret-material scan.
- Production blocker tests.
- Full suite waar relevant.
- Build waar relevant.
- Git diff check.

## 9. Rollbackplan

- Herstel vorige werkende secretset buiten Git.
- Revoke mislukte nieuwe secrets.
- Revert alleen documentatie/codewijzigingen in Git.

## 10. Stopregels

- Stop bij secret in diff of output.
- Stop bij `.env` wijziging.
- Stop bij onduidelijke secretlijst.
- Stop bij ontbrekende rollback-eigenaar.

## 11. Exacte toekomstige approval prompt

```text
Owner approval received for decision secret-rotation.
Use docs/DECISION_BRIEF_SECRET_ROTATION_NL.md and docs/OWNER_APPROVAL_INTAKE_NL.md.
Rotate only the explicitly approved secrets outside Git.
Do not edit .env, print secrets, run production cutover, historical import, real email, PDF dependency installation, tags, or force push.
Run relevant validation and report sanitized status only.
```

## 12. Bevestiging

Deze brief voert niets uit, wijzigt geen `.env` en roteert geen secrets.

## 13. Status na app/provider remediatie

- Databasecredential finalisatie is afgerond.
- Request Access Secret is gegenereerd en toegepast in de runtime-omgeving.
- App redeploy en health-check zijn geslaagd.
- Productie-readiness totalen zijn onveranderd geverifieerd.
- Clerk Secret Key, Resend API Key en New Relic License Key blijven handmatig openstaand tot finale vervangingssleutels buiten Git zijn aangeleverd.
