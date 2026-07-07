# Yeshua Academy Finance — Owner acceptance checklist

Status: eigenaaracceptatie voorbereiding — geen owner-gated actie goedgekeurd  
Taal: Nederlands  
Afhankelijkheden: `docs/OWNER_REVIEW_FINAL_PACKET_NL.md`, `docs/OWNER_APPROVAL_INTAKE_NL.md`, `docs/OWNER_DECISION_MENU_NL.md`

## 1. Huidige release-status

De repository staat klaar voor de volgende expliciete eigenaarsbeslissing. De owner-decision handoff commit `f2f7cbb` is post-push geverifieerd op `origin/main`; de post-push evidence, decision briefs, approval-intake validator en doc guards zijn gepubliceerd. De aanbevolen volgende beslissing is `postgres-version`.

Deze checklist registreert alleen acceptatie van het lokale pakket. Deze checklist keurt geen productieactie, push, PDF-renderer, historische import, echte e-mail, secret rotation of PostgreSQL-productieversieclaim goed.

## 2. Wat lokaal klaar is

- Financiële workflow voor import, review, reconciliatie, close en rapportage is lokaal/app klaar.
- HTML- en XLSX-rapporten komen uit gesloten snapshots; PDF blijft een placeholder.
- Dispatch-metadata bestaat; echte e-mail wordt niet verzonden.
- Backup/restore rehearsal evidence is lokaal vastgelegd; productieback-up/herstel blijft owner-gated.
- Owner review documenten, beslissingsoverzicht, approval intake, action plan, final packet en decision menu zijn aanwezig.
- Post-push evidence, zes decision briefs en approval-intake validation zijn aanwezig.
- Veilige preflight-commando's zijn beschikbaar zonder productie, externe provider, databaseverplichting of `.env`-lezing.

## 3. Wat owner-gated blijft

- Echte PDF-renderer dependency en echte PDF-output.
- Productiecutover of productiemigratie.
- Historische productie-import.
- Echte e-mailverzending.
- Push naar remote voor toekomstige lokale commits.
- Secret rotation.
- Productie PostgreSQL-versie bevestigen.

## 4. Vereiste commando's vóór acceptatie

Voer deze commando's lokaal uit of laat ze lokaal uitvoeren vóór acceptatie:

```bash
npm run validate:release-candidate
npm run preflight:final-owner-review
node scripts/final-owner-review-preflight.mjs --check
node scripts/owner-go-no-go-preflight.mjs --strict
node scripts/push-readiness-preflight.mjs --strict
npm run preflight:approval-intake
npm run preflight:post-push
npm run preflight:decision-briefs
```

Optioneel voor de beslissingskeuze:

```bash
npm run preflight:owner-decision-menu
node scripts/owner-decision-menu.mjs
```

## 5. Acceptatiecheckboxes

- [ ] Lokale workflow geaccepteerd.
- [ ] Documentatiepakket geaccepteerd.
- [ ] Backup rehearsal evidence geaccepteerd.
- [ ] Post-push verification evidence voor `f2f7cbb` geaccepteerd.
- [ ] Decision briefs en approval-intake validation geaccepteerd als pre-approval hulpmiddelen.
- [ ] Resterende blockers begrepen.
- [ ] Bevestigd: productie is niet aangeraakt.
- [ ] Bevestigd: de eerder goedgekeurde owner-decision handoff publish is geverifieerd op `origin/main`.

## 6. Niet goedgekeurd door deze checklist

Deze checklist geeft expliciet geen toestemming voor:

- PDF-renderer installeren of echte PDF-output activeren.
- Productiecutover of productiemigratie uitvoeren.
- Historische productie-import uitvoeren.
- Echte e-mail verzenden of een provider-call doen.
- Push naar remote voor toekomstige lokale commits of tags maken.
- Secret rotation uitvoeren.
- Productie PostgreSQL-versie als bevestigd registreren zonder owner-evidence buiten Git.

## 7. Exacte volgende promptopties na acceptatie

Gebruik één van deze veilige vervolgopties:

```text
Owner acceptance completed. Show the owner decision menu and recommend the next safe decision path. Do not execute any owner-gated action.
```

```text
Owner acceptance completed. Prepare the approval intake for decision <pdf|production-cutover|historical-import|email|push|secret-rotation|postgres-version>. Do not execute the decision yet.
```

```text
Owner acceptance completed and explicit owner approval received for decision <decision>. Use docs/OWNER_APPROVAL_INTAKE_NL.md and docs/POST_APPROVAL_PROMPTS_NL.md. Execute only the approved scope and keep all other owner-gated actions blocked.
```

## 8. Stopregels

Stop direct wanneer:

- `git status --short` andere paden toont dan toegestane Graphify-artifacts of de expliciet bedoelde docs/tests/scripts/package-wijzigingen.
- Een stap productie, verboden productiehost, MCP bridge, externe provider, echte e-mail, PDF dependency, owner-bestanden, secret rotation, historische productie-import, push of tags vereist.
- Een database-URL niet lokaal is voor een local-only rehearsal.
- `.env`, owner source files, raw transaction rows, database dumps, secrets or production configuration would enter Git.
- Een validatie faalt en één bounded repair attempt faalt.

## 9. Geen geheimen, owner-bestanden of productieclaims

- Plaats geen geheimen, hostnamen, wachtwoorden, API-keys, owner-bestandspaden, ruwe transactierijen of databasedumps in dit document.
- Kopieer geen owner Excel/CSV/PDF-bestanden naar Git.
- Claim geen productiecutover, historische productie-import, echte e-mail, echte PDF, push, tags, secret rotation of productie PostgreSQL-versiebevestiging zolang daar geen aparte owner-goedkeuring en evidence buiten Git voor is.
- Claim geen nieuwe remote publish voor toekomstige lokale commits zolang die niet met aparte owner-goedkeuring is uitgevoerd.
