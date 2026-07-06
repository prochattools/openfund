# Yeshua Academy Finance — Eigenaarsbeslissing readiness matrix

Status: Release Candidate 4 — owner-review voorbereiding; geen productieactie uitgevoerd  
Taal: Nederlands  
Doel: per owner-gated beslissing tonen wat klaar is, wat geblokkeerd blijft, welke input nodig is, en welk prompt-pad pas na goedkeuring gebruikt mag worden. De huidige gate is owner acceptance / owner decision selection.

Beveiligingsregel: zet geen geheimen, hostnamen, wachtwoorden, owner-bestandspaden, ruwe transactierijen, database-dumps of productieconfiguratie in dit document of in Git.

Gebruik vóór een beslissing ook `docs/OWNER_ACCEPTANCE_CHECKLIST_NL.md` en `docs/OWNER_DECISION_MENU_NL.md`.

## Matrix

| Beslissing | Status | Klaar nu | Blijft geblokkeerd | Vereiste eigenaarinput | Preflight | Safe dry-run | Uitvoering pas na goedkeuring |
|------------|--------|----------|--------------------|------------------------|-----------|--------------|-------------------------------|
| Echte PDF-renderer | Geblokkeerd | HTML/XLSX en PDF-placeholder bestaan | Dependency-installatie en echte PDF-rendering | Bibliotheeknaam, licentie/runtime akkoord | `node scripts/owner-decision-preflight.mjs --decision pdf` | `npm test -- --test-name-pattern "production blocker"` | Gebruik PDF-prompt in `docs/POST_APPROVAL_PROMPTS_NL.md` |
| Productiemigratie/cutover | Geblokkeerd | Documentatie-only cutoverplan en lokale validaties | Productiehost, productie-DB, productieconfig | Expliciete cutover-go, back-upvenster, rollback-eigenaar | `node scripts/owner-decision-preflight.mjs --decision production-cutover` | `npm run validate:release-candidate` | Gebruik cutover-prompt in `docs/POST_APPROVAL_PROMPTS_NL.md` |
| Historische productie-import | Geblokkeerd | Local/sanitized loader en owner-local rehearsal adapter | Productie-import en owner-bestanden in Git | Owner-bestanden buiten Git, hashes, dry-run acceptatie | `node scripts/owner-decision-preflight.mjs --decision historical-import` | `npm test -- --test-name-pattern "Phase 3 historical loading closeout"` | Gebruik historische-import prompt in `docs/POST_APPROVAL_PROMPTS_NL.md` |
| Echte e-mailverzending | Geblokkeerd | Dispatch-metadata zonder provider-call | Provider-call, echte ontvangers, API-key | Providerkeuze, domein, testontvangers, secret buiten Git | `node scripts/owner-decision-preflight.mjs --decision email` | `npm test -- --test-name-pattern "production blocker"` | Gebruik e-mailprompt in `docs/POST_APPROVAL_PROMPTS_NL.md` |
| Push naar remote | Geblokkeerd | Push checklist en owner go/no-go preflight | Publicatie naar remote en tags | Expliciete push-go, doelremote/branch buiten dit document | `node scripts/owner-decision-preflight.mjs --decision push` | `node scripts/owner-go-no-go-preflight.mjs --strict` | Gebruik push-prompt in `docs/POST_APPROVAL_PROMPTS_NL.md` |
| Geheimen roteren | Geblokkeerd | Secret blockers en negatieve secret-output tests | Secret-wijziging, `.env`, providersecret | Secretlijst buiten Git, vault-bestemming, cutovervolgorde | `node scripts/owner-decision-preflight.mjs --decision secret-rotation` | `git diff --check` | Gebruik secret-rotation prompt in `docs/POST_APPROVAL_PROMPTS_NL.md` |
| PostgreSQL-productieversie | Geblokkeerd | Lokale Prisma-validatie en migratiebewijs | Hostingprovider-query vanuit deze repo | Versienummer en Prisma-compatibiliteitsbevestiging | `node scripts/owner-decision-preflight.mjs --decision postgres-version` | `npx prisma validate` met uitsluitend een lokale placeholder `DATABASE_URL` buiten dit rapport | Gebruik PostgreSQL-versie prompt in `docs/POST_APPROVAL_PROMPTS_NL.md` |

## Per-beslissing details

### Echte PDF-renderer

Wat klaar is:
- HTML- en XLSX-rapporten worden uit dezelfde gesloten snapshot gemaakt.
- PDF-placeholder en `PDF_BLOCKER` maken de ontbrekende renderer expliciet.
- Tests bewaken dat geen echte PDF-afhankelijkheid ongemerkt wordt toegevoegd.

Wat blijft geblokkeerd:
- Geen PDF-library installeren.
- Geen echte PDF-rendering claimen.

Rollback:
- Revert dependency- en rendererwijzigingen als build, tests of audit falen.

Stopregels:
- Stop bij ontbrekende bibliotheekkeuze, onbekende licentie, zware runtime-impact of test/build-falen.

Exacte volgende prompt:
- Gebruik de PDF-sectie in `docs/POST_APPROVAL_PROMPTS_NL.md`.

### Productiemigratie/cutover

Wat klaar is:
- `docs/PRODUCTION_CUTOVER_PLAN_NL.md` beschrijft de documentatie-only aanpak.
- Release-candidate validatie is lokaal beschikbaar.
- Backup/restore rehearsal is local-only bewaakt.

Wat blijft geblokkeerd:
- Geen productiehost, productie-DB, productiesecret of productieconfiguratie aanraken.

Rollback:
- Herstel productiedatabase uit vooraf gemaakte back-up en documenteer de reden in `docs/finance-rebuild-run.md`.

Stopregels:
- Stop bij ontbrekende back-up, ontbrekende owner-go, ontbrekende PostgreSQL-versiebevestiging of non-local DB in een lokale rehearsal.

Exacte volgende prompt:
- Gebruik de cutover-sectie in `docs/POST_APPROVAL_PROMPTS_NL.md`.

### Historische productie-import

Wat klaar is:
- Phase 3 local/sanitized en owner-local rehearsal paden zijn compleet.
- Productie-uitvoering blijft hard geblokkeerd.

Wat blijft geblokkeerd:
- Geen owner Excel/CSV/PDF in Git.
- Geen historische productie-import.
- Geen ruwe transactiedumps.

Rollback:
- Herstel database uit back-up als een later goedgekeurde productie-import fout loopt.

Stopregels:
- Stop bij owner-bestanden binnen repo, hash mismatch, ontbrekende dry-run acceptatie of non-local rehearsal DB.

Exacte volgende prompt:
- Gebruik de historische-import sectie in `docs/POST_APPROVAL_PROMPTS_NL.md`.

### Echte e-mailverzending

Wat klaar is:
- Dispatch-metadata en recipient-hashing bestaan.
- Huidige workflow verzendt geen echte e-mail.

Wat blijft geblokkeerd:
- Geen provider-call.
- Geen echte ontvangers.
- Geen API-key in Git of output.

Rollback:
- Deactiveer provider-key buiten Git en herstel metadata-only modus.

Stopregels:
- Stop bij ontbrekende provider-goedkeuring, geheim in diff, of echte ontvanger zonder goedgekeurde dry-run.

Exacte volgende prompt:
- Gebruik de e-mailsectie in `docs/POST_APPROVAL_PROMPTS_NL.md`.

### Push naar remote

Wat klaar is:
- Push checklist en owner go/no-go preflight bestaan.
- Alleen `.graphifyignore` en `graphify-out/` zijn verwachte untracked paden.

Wat blijft geblokkeerd:
- Geen remote publicatie.
- Geen tags.

Rollback:
- Gebruik normale revert/PR-procedure; geen force-push op `main`.

Stopregels:
- Stop bij onverwachte dirty files, ontbrekende owner-go, of falende release-validatie.

Exacte volgende prompt:
- Gebruik de push-sectie in `docs/POST_APPROVAL_PROMPTS_NL.md`.

### Geheimen roteren

Wat klaar is:
- Release docs benoemen secret rotation als blocker.
- Tests en scans bewaken dat geheimen niet in output verschijnen.

Wat blijft geblokkeerd:
- Geen `.env` wijzigen.
- Geen geheim in Git of docs.

Rollback:
- Herroep nieuwe secrets buiten Git en herstel de vorige werkende secretset volgens eigenaarproces.

Stopregels:
- Stop bij geheim in diff, `.env` wijziging, ontbrekende vault-bestemming of onduidelijke cutovervolgorde.

Exacte volgende prompt:
- Gebruik de secret-rotation sectie in `docs/POST_APPROVAL_PROMPTS_NL.md`.

### PostgreSQL-productieversie

Wat klaar is:
- Prisma validate/generate slagen lokaal.
- Migratieketen is lokaal/disposable gevalideerd.

Wat blijft geblokkeerd:
- Geen hostingprovider-query vanuit deze repo.
- Geen productie-DB URL invoeren.

Rollback:
- Als versie incompatibel is: stop cutover en plan provider-upgrade of alternatieve database.

Stopregels:
- Stop bij onbekende productieversie, incompatibiliteit of productie-URL in lokale commandoregel.

Exacte volgende prompt:
- Gebruik de PostgreSQL-versie sectie in `docs/POST_APPROVAL_PROMPTS_NL.md`.
