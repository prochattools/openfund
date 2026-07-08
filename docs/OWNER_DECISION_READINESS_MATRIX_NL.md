# Yeshua Academy Finance — Eigenaarsbeslissing readiness matrix

Status: Release Candidate 7 — schema cutover, historische import, database credential finalisatie, alle provider secrets, echte PDF-renderer, en echte e-mailverzending (code-complete) afgerond; productie-verzendverificatie in afwachting
Taal: Nederlands  
Doel: per owner-gated beslissing tonen wat klaar is, wat geblokkeerd blijft, welke input nodig is, en welk prompt-pad pas na goedkeuring gebruikt mag worden. De huidige gate is owner decision selection. Aanbevolen eerste keuze: `postgres-version`.

Beveiligingsregel: zet geen geheimen, hostnamen, wachtwoorden, owner-bestandspaden, ruwe transactierijen, database-dumps of productieconfiguratie in dit document of in Git.

Gebruik vóór een beslissing ook `docs/OWNER_ACCEPTANCE_CHECKLIST_NL.md`, `docs/OWNER_DECISION_MENU_NL.md`, `docs/OWNER_APPROVAL_INTAKE_VALIDATION_NL.md` en de relevante beslisbrief.

## Matrix

| Beslissing | Status | Klaar nu | Blijft geblokkeerd | Vereiste eigenaarinput | Preflight | Safe dry-run | Uitvoering pas na goedkeuring |
|------------|--------|----------|--------------------|------------------------|-----------|--------------|-------------------------------|
| Echte PDF-renderer | Voltooid 2026-07-08 | `pdfkit` renderer toegevoegd; PDF artifact media type `application/pdf`; HTML/XLSX behouden; zie `docs/REAL_PDF_RENDERER_EVIDENCE_NL.md` | Echte e-mail code-complete | — | — | `npm test -- --test-name-pattern "report artifact"` | — (voltooid) |
| Productiemigratie/cutover | Schema afgerond 2026-07-07 | Schema finance gedeployed op PostgreSQL 15.8; 4 migraties; 30 tabellen geverifieerd; zie `docs/PRODUCTION_SCHEMA_CUTOVER_EVIDENCE_NL.md` | Echte e-mail code-complete | — | — | — | — |
| Historische productie-import | Voltooid 2026-07-07 | 902 transacties (268 2024 + 413 2025 + 221 2026), 681 boekingen, 4 bronbestanden, 2026 gedeeltelijk/open en niet afgesloten; zie `docs/PRODUCTION_HISTORICAL_IMPORT_EVIDENCE_NL.md` | Echte e-mail code-complete | — | — | `npm test -- --test-name-pattern "historical"` | — (voltooid) |
| Echte e-mailverzending | Code-complete 2026-07-08 | Resend provider-abstractie; `executeDispatch` met guards; productie-verzendverificatie in afwachting; zie `docs/REAL_EMAIL_SENDING_EVIDENCE_NL.md` | Productie-runtime uitvoering met `RESEND_API_KEY` en `EMAIL_TEST_RECIPIENT` | — | `node scripts/production-email-send-verify.mjs --send-one-test-email --confirm-send YESHUA_FINANCE_SEND_ONE_TEST_EMAIL` | `npm test -- --test-name-pattern "report dispatch"` | Uitvoeren in Dokploy runtime |
| Nieuwe push naar remote | Niet nodig voor gepubliceerde handoff; geblokkeerd voor toekomstige lokale commits | Handoff commit `f2f7cbb` is op `origin/main` geverifieerd; push checklist en post-push evidence bestaan | Nieuwe publicatie naar remote en tags | Expliciete push-go, doelremote/branch buiten dit document | `node scripts/owner-decision-preflight.mjs --decision push` en `node scripts/owner-approval-intake-validator.mjs --decision push` | `node scripts/owner-go-no-go-preflight.mjs --strict` | Gebruik push-prompt in `docs/POST_APPROVAL_PROMPTS_NL.md` alleen bij nieuwe lokale commits |
| Geheimen roteren | Voltooid 2026-07-07 | finance_user-credential geroteerd; oud credential afgewezen; nieuw credential geverifieerd; historische totalen herbevestigd; zie `docs/PRODUCTION_SECRET_ROTATION_EVIDENCE_NL.md` | Echte e-mail code-complete | — | — | — | — (voltooid) |
| App/provider geheimremediatie | Voltooid 2026-07-08 | Alle provider secrets geroteerd en toegepast; app redeployed; health en readiness geverifieerd; zie `docs/PRODUCTION_APP_PROVIDER_SECRET_ROTATION_EVIDENCE_NL.md` | Echte e-mail code-complete | — | — | — | — (voltooid) |
| PostgreSQL-productieversie | Geblokkeerd | Lokale Prisma-validatie, migratiebewijs, lokale 15.17 rehearsal evidence in `docs/POSTGRES_VERSION_EVIDENCE_NL.md` en `docs/DECISION_BRIEF_POSTGRES_VERSION_NL.md` | Hostingprovider-query vanuit deze repo en productieversieclaim | Versienummer en Prisma-compatibiliteitsbevestiging uit owner/provider evidence buiten Git | `node scripts/owner-decision-preflight.mjs --decision postgres-version` en `node scripts/owner-approval-intake-validator.mjs --decision postgres-version` | `npx prisma validate` met uitsluitend lokale placeholderconfig buiten dit rapport | Gebruik PostgreSQL-versie prompt in `docs/POST_APPROVAL_PROMPTS_NL.md` |

## Per-beslissing details

### Echte PDF-renderer

Wat klaar is:
- HTML-, XLSX- en PDF-rapportartefacten worden uit dezelfde gesloten snapshot gemaakt.
- `pdfkit` is toegevoegd als owner-approved server-side renderer.
- PDF-artefacten worden opgeslagen als `application/pdf` en de service retourneert `pdfBlocker: null`.

Wat blijft geblokkeerd:
- Echte e-mailverzending is code-complete; productie-verzendverificatie in afwachting.

Rollback:
- Revert dependency- en rendererwijzigingen als build, tests of audit falen.

Stopregels:
- Stop bij ontbrekende bibliotheekkeuze, onbekende licentie, zware runtime-impact of test/build-falen.

Exacte volgende prompt:
- Geen PDF-prompt meer nodig; zie `docs/REAL_PDF_RENDERER_EVIDENCE_NL.md`.

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
- Resend provider-abstractie geïmplementeerd (`server/services/reportEmailProvider.ts`).
- `executeDispatch` met volledige guard-chain (admin, snapshot, approval, dispatch PENDING, valid recipients).
- Schema ondersteunt SENT/FAILED status, providerMessageId, sentAt, errorMessage — geen migratie nodig.
- Productie-verificatiescript klaar (`scripts/production-email-send-verify.mjs`).

Wat in afwachting is:
- Productie-verzendverificatie: uitvoeren in Dokploy runtime met `RESEND_API_KEY` en `EMAIL_TEST_RECIPIENT`.

Rollback:
- Deactiveer provider-key buiten Git en herstel metadata-only modus.

Stopregels:
- Stop bij geheim in diff, provider-payload in output, of bulk-send.

Verificatiecommando:
- `node scripts/production-email-send-verify.mjs --send-one-test-email --confirm-send YESHUA_FINANCE_SEND_ONE_TEST_EMAIL`

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
- Echte e-mail — code-complete; productie-verzendverificatie in afwachting.

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
