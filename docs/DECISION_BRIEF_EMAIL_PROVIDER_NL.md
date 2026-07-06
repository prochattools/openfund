# Yeshua Academy Finance — Decision brief: e-mailprovider

Status: Geblokkeerd tot expliciete eigenaargoedkeuring
Taal: Nederlands

## 1. Beslissing

Configureer later een e-mailprovider of activeer echte verzending. Deze brief stuurt geen e-mail en doet geen provider call.

## 2. Vereiste owner approval evidence

- Providerkeuze.
- Domein- en afzenderbeleid.
- Secretbeheer buiten Git.
- Testontvangers en send-scope.
- Aparte bevestiging wanneer echte verzending is toegestaan.

## 3. Vereiste inputs buiten Git

- API-key of providersecret in veilige beheeromgeving.
- Goedgekeurde testontvangers.
- Afzenderadres en domeinbevestiging.
- Rollbackcontact.

## 4. Veilige preflight commands

```bash
node scripts/owner-decision-preflight.mjs --decision email
node scripts/owner-approved-action-plan.mjs --decision email
npm test -- --test-name-pattern "report dispatch"
npm test -- --test-name-pattern "production blocker"
```

## 5. Veilige dry-run commands

```bash
npm test -- --test-name-pattern "report approval"
```

Dry-run/no-send configuratie moet metadata-only blijven totdat echte verzending apart is goedgekeurd.

## 6. Verboden acties vóór approval

- Geen echte e-mail.
- Geen provider call.
- Geen secrets in Git of output.
- Geen productiecutover of import combineren.

## 7. Uitvoeringsoutline na approval

1. Bevestig provider en no-send of send-scope.
2. Houd secrets buiten Git.
3. Implementeer eerst metadata-safe of no-send pad.
4. Valideer dispatch tests.
5. Activeer echte verzending alleen met aparte send-goedkeuring.

## 8. Validatiepoorten

- Dispatch service tests.
- Production blocker tests.
- Full suite.
- Server build.
- Production build.
- High-risk scan op gewijzigde docs/tests/scripts/package paths.

## 9. Rollbackplan

- Deactiveer providersecret buiten Git.
- Herstel metadata-only/no-op modus.
- Revert providerconfiguratiecommit.

## 10. Stopregels

- Stop bij geheim in diff of terminaloutput.
- Stop bij provider-call in test of preflight.
- Stop bij ontbrekende send-scope.
- Stop bij echte ontvanger zonder expliciete send-goedkeuring.

## 11. Exacte toekomstige approval prompt

```text
Owner approval received for decision email.
Use docs/DECISION_BRIEF_EMAIL_PROVIDER_NL.md and docs/OWNER_APPROVAL_INTAKE_NL.md.
Configure only the approved no-send or send scope.
Keep secrets outside Git and do not send real email unless the prompt explicitly approves sending.
Do not run production cutover, historical import, PDF dependency installation, secret rotation, tags, or force push.
Validate dispatch tests, full suite, builds, and high-risk scan.
```

## 12. Bevestiging

Deze brief voert niets uit, verzendt niets en gebruikt geen externe provider.
