# Yeshua Academy Finance — Eigenaarsbeslissing readiness matrix

Status: Release Candidate 5 — schema cutover, historische import, database credential finalisatie, en Request Access Secret-remediatie afgerond 2026-07-07; Clerk/Resend/New Relic rotaties handmatig openstaand; app health geverifieerd; echte e-mail en PDF geblokkeerd
Taal: Nederlands  
Doel: per owner-gated beslissing tonen wat klaar is, wat geblokkeerd blijft, welke input nodig is, en welk prompt-pad pas na goedkeuring gebruikt mag worden. De huidige gate is owner decision selection. Aanbevolen eerste keuze: `postgres-version`.

Beveiligingsregel: zet geen geheimen, hostnamen, wachtwoorden, owner-bestandspaden, ruwe transactierijen, database-dumps of productieconfiguratie in dit document of in Git.

Gebruik vóór een beslissing ook `docs/OWNER_ACCEPTANCE_CHECKLIST_NL.md`, `docs/OWNER_DECISION_MENU_NL.md`, `docs/OWNER_APPROVAL_INTAKE_VALIDATION_NL.md` en de relevante beslisbrief.

## Matrix

| Beslissing | Status | Klaar nu | Blijft geblokkeerd | Vereiste eigenaarinput | Preflight | Safe dry-run | Uitvoering pas na goedkeuring |
|------------|--------|----------|--------------------|------------------------|-----------|--------------|-------------------------------|
| Echte PDF-renderer | Geblokkeerd | HTML/XLSX, PDF-placeholder en `docs/DECISION_BRIEF_PDF_RENDERER_NL.md` bestaan | Dependency-installatie en echte PDF-rendering | Bibliotheeknaam, licentie/runtime akkoord | `node scripts/owner-decision-preflight.mjs --decision pdf` en `node scripts/owner-approval-intake-validator.mjs --decision pdf` | `npm test -- --test-name-pattern "production blocker"` | Gebruik PDF-prompt in `docs/POST_APPROVAL_PROMPTS_NL.md` |
| Productiemigratie/cutover | Schema afgerond 2026-07-07 | Schema finance gedeployed op PostgreSQL 15.8; 4 migraties; 30 tabellen geverifieerd; zie `docs/PRODUCTION_SCHEMA_CUTOVER_EVIDENCE_NL.md` | Historische import, echte e-mail, PDF en geheimrotatie blijven geblokkeerd | — | — | — | — |
| Historische productie-import | Voltooid 2026-07-07 | 902 transacties (268 2024 + 413 2025 + 221 2026), 681 boekingen, 4 bronbestanden, 2026 gedeeltelijk/open en niet afgesloten; zie `docs/PRODUCTION_HISTORICAL_IMPORT_EVIDENCE_NL.md` | Geheimrotatie, echte e-mail, echte PDF blijven geblokkeerd | — | — | `npm test -- --test-name-pattern "historical"` | — (voltooid) |
| Echte e-mailverzending | Geblokkeerd | Dispatch-metadata zonder provider-call en `docs/DECISION_BRIEF_EMAIL_PROVIDER_NL.md` | Provider-call, echte ontvangers, API-key | Providerkeuze, domein, testontvangers, secret buiten Git | `node scripts/owner-decision-preflight.mjs --decision email` en `node scripts/owner-approval-intake-validator.mjs --decision email` | `npm test -- --test-name-pattern "production blocker"` | Gebruik e-mailprompt in `docs/POST_APPROVAL_PROMPTS_NL.md` |
| Nieuwe push naar remote | Niet nodig voor gepubliceerde handoff; geblokkeerd voor toekomstige lokale commits | Handoff commit `f2f7cbb` is op `origin/main` geverifieerd; push checklist en post-push evidence bestaan | Nieuwe publicatie naar remote en tags | Expliciete push-go, doelremote/branch buiten dit document | `node scripts/owner-decision-preflight.mjs --decision push` en `node scripts/owner-approval-intake-validator.mjs --decision push` | `node scripts/owner-go-no-go-preflight.mjs --strict` | Gebruik push-prompt in `docs/POST_APPROVAL_PROMPTS_NL.md` alleen bij nieuwe lokale commits |
| Geheimen roteren | Voltooid 2026-07-07 | finance_user-credential geroteerd; oud credential afgewezen; nieuw credential geverifieerd; historische totalen herbevestigd; zie `docs/PRODUCTION_SECRET_ROTATION_EVIDENCE_NL.md` | Echte e-mail en PDF blijven geblokkeerd | — | — | — | — (voltooid) |
| App/provider geheimremediatie | Gedeeltelijk voltooid 2026-07-07 | Request Access Secret gegenereerd/toegepast; app redeployed; health en readiness geverifieerd; zie `docs/PRODUCTION_APP_PROVIDER_SECRET_ROTATION_EVIDENCE_NL.md` | Clerk Secret Key, Resend API Key en New Relic License Key blijven handmatig openstaand; echte e-mail en PDF blijven geblokkeerd | Finale providervervangingssleutels buiten Git | `node scripts/owner-decision-preflight.mjs --decision secret-rotation` | `npm test -- --test-name-pattern "productionAppProviderSecretRotationEvidence"` | Nieuwe providerrotatieprompt pas na aangeleverde finale sleutels |
| PostgreSQL-productieversie | Geblokkeerd | Lokale Prisma-validatie, migratiebewijs, lokale 15.17 rehearsal evidence in `docs/POSTGRES_VERSION_EVIDENCE_NL.md` en `docs/DECISION_BRIEF_POSTGRES_VERSION_NL.md` | Hostingprovider-query vanuit deze repo en productieversieclaim | Versienummer en Prisma-compatibiliteitsbevestiging uit owner/provider evidence buiten Git | `node scripts/owner-decision-preflight.mjs --decision postgres-version` en `node scripts/owner-approval-intake-validator.mjs --decision postgres-version` | `npx prisma validate` met uitsluitend lokale placeholderconfig buiten dit rapport | Gebruik PostgreSQL-versie prompt in `docs/POST_APPROVAL_PROMPTS_NL.md` |

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
- Post-push evidence bevestigt dat handoff commit `f2f7cbb` op `origin/main` staat.
- Push checklist, approval-intake validator en owner go/no-go preflight bestaan.
- Alleen `.graphifyignore` en `graphify-out/` zijn verwachte untracked paden wanneer er geen lokale hardening-diff openstaat.

Wat blijft geblokkeerd:
- Geen nieuwe remote publicatie zonder nieuwe expliciete owner-go.
- Geen tags.

Rollback:
- Gebruik normale revert/PR-procedure; geen force-push op `main`.

Stopregels:
- Stop bij onverwachte dirty files, ontbrekende owner-go, of falende release-validatie.

Exacte volgende prompt:
- Gebruik de push-sectie in `docs/POST_APPROVAL_PROMPTS_NL.md`.

### Geheimen roteren

**Status: VOLTOOID 2026-07-07**

Wat is gedaan:
- finance_user-wachtwoord geroteerd via supabase_admin-verbinding.
- Nieuw wachtwoord gegenereerd in geheugen (crypto.randomBytes), nooit naar schijf of log geschreven.
- Oud credential afgewezen na rotatie.
- Nieuw credential connectiviteit geverifieerd (database finance, schema finance, PostgreSQL 15.8).
- Historische totalen herbevestigd na rotatie (902 transacties, 681 boekingen).
- Bewijsdocument: `docs/PRODUCTION_SECRET_ROTATION_EVIDENCE_NL.md`.

Resterende blockers:
- Echte e-mail (Resend API) — geblokkeerd.
- Echte PDF-renderer — geblokkeerd.

Stopregels (achteraf):
- Stop bij geheim in diff, `.env` wijziging of credential in commits.

### PostgreSQL-productieversie

Wat klaar is:
- Prisma validate/generate slagen lokaal.
- Migratieketen is lokaal/disposable gevalideerd.
- Lokale PostgreSQL 15.17 rehearsal evidence is vastgelegd in `docs/POSTGRES_VERSION_EVIDENCE_NL.md`.

Wat blijft geblokkeerd:
- Geen hostingprovider-query vanuit deze repo.
- Geen productie-DB URL invoeren.
- Productie PostgreSQL-versie blijft niet vastgesteld.

Rollback:
- Als versie incompatibel is: stop cutover en plan provider-upgrade of alternatieve database.

Stopregels:
- Stop bij onbekende productieversie, incompatibiliteit of productie-URL in lokale commandoregel.

Exacte volgende prompt:
- Gebruik de PostgreSQL-versie sectie in `docs/POST_APPROVAL_PROMPTS_NL.md`.
