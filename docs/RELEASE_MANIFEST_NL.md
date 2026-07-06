# Yeshua Academy Finance — Release Manifest

Status: Release Candidate 4 — post-push verification and owner decision hardening
Taal: Nederlands
Gegenereerd op: 2026-07-06 20:25:20 +0100 (RC4)

---

## Versie-informatie

| Veld | Waarde |
|------|--------|
| Applicatieversie | 0.1.0 |
| Branch | main |
| Commit (volledig) | 3866a43527f619d0d062d40d5bd9214e4060db8c |
| Commit (kort) | 3866a43 |
| Commit bericht | chore: add post push owner preflight scripts |
| Commit datum | 2026-07-06 20:25:20 +0100 |
| Prisma versie (dev) | ^6.15.0 |
| @prisma/client versie | ^6.15.0 |

---

## Release-evidence

| Veld | Waarde |
|------|--------|
| Manifest generated at commit | 3866a43527f619d0d062d40d5bd9214e4060db8c |
| Manifest generated at short commit | 3866a43 |
| Release evidence validated through | 3866a43527f619d0d062d40d5bd9214e4060db8c |
| Release evidence validated through short | 3866a43 |
| RC4 evidence commits | `7ce6e6d`, `43bfb90`, `42a6f49`, `43137b5`, `33d08c4` |
| Post-push basis verified on origin/main | `6353546` |
| Local post-push hardening commits | `e07be8f`, `a5ab4a8`, `949823a`, `84d13d7`, `3866a43` |

---

## Geïmplementeerde fasen (samenvatting)

| Fase | Status |
|------|--------|
| Phase 0 — Governance | COMPLETE |
| Phase 1 — Veilige categorisatiebasis | COMPLETE |
| Phase 2 — Financieel domein en historisch model | COMPLETE |
| Phase 3 — Historisch laden | COMPLETE LOKAAL / PRODUCTIE-IMPORT OWNER-GATED |
| Phase 4 — Maandelijkse import en review | COMPLETE LOKAAL / APP-WORKFLOW |
| Phase 5 — Reconciliatie en afsluiting | COMPLETE |
| Phase 6 — Rapporten en distributie | COMPLETE |
| Phase 7 — Dutch UX en autorisatiehardening | COMPLETE |
| Phase 8 — Infrastructuur en deployment | COMPLETE (lokale gereedheid; productiecutover blijft geblokkeerd) |
| Phase 9 — Operationele hardening en overdracht | COMPLETE (lokaal, RC4) |

---

## Openstaande blockers vóór productie

De volgende blokkades zijn nog van kracht. Ze mogen **NIET** worden omzeild zonder expliciete eigenaargoedkeuring:

| # | Blocker | Reden |
|---|---------|-------|
| 1 | Echte PDF-renderer afhankelijkheid | `PDF_BLOCKER` actief; geen goedgekeurde bibliotheek |
| 2 | Productiemigratie en cutover | Vereist expliciete eigenaargoedkeuring |
| 3 | Historische productie-import (2024/2025/2026) | Operator-gated; vereist eigenaargoedkeuring en dry-run |
| 4 | Echte e-mailverzending | `RESEND_API_KEY` niet geconfigureerd; no-op modus actief |
| 5 | PostgreSQL-productieversie bevestigen | Vereist verificatie bij hostingprovider vóór cutover |
| 6 | Live backup/restore rehearsal | VOLTOOID op 2026-07-05 (RC3); productieback-up/herstel blijft geblokkeerd tot eigenaargoedkeuring |
| 7 | Push naar remote | Vereist expliciete eigenaargoedkeuring |
| 8 | Geheimen roteren | Vereist productievoorbereiding buiten Git vóór cutover |

---

## Validatiecommando's

Voer het volgende commando uit om alle veilige lokale validaties in één stap te draaien:

```bash
npm run validate:release-candidate
```

Dit commando voert uit:
1. `npm test` — volledig testsuite
2. `npm run build:server` — TypeScript server-compilatie
3. `npm run build` — Next.js productiebuild
4. `DATABASE_URL=... npx prisma validate` — schemavalidatie
5. `npx prisma generate` — Prisma Client genereren
6. `node scripts/backup-restore-rehearsal.mjs --dry-run` — guard-check zonder database
7. `git diff --check` — geen onverwachte wijzigingen

Aanvullende veilige validaties:

```bash
node scripts/backup-restore-rehearsal.mjs --help
node scripts/backup-restore-rehearsal.mjs --dry-run
node scripts/generate-release-manifest.mjs
npm run preflight:approval-intake
npm run preflight:post-push
npm run preflight:decision-briefs
```

---

## Veiligheidsstatus

| Controle | Status |
|---------|--------|
| Geen productiedatabase aangeraakt | BEVESTIGD |
| Post-push basiscommit `6353546` staat op origin/main | BEVESTIGD |
| Geen nieuwe push van lokale hardening commits uitgevoerd | BEVESTIGD |
| Geen .env gewijzigd | BEVESTIGD |
| Geen Graphify aangeraakt | BEVESTIGD |
| Geen owner-bronbestanden in Git | BEVESTIGD |
| Geen ruwe transactiedumps in Git | BEVESTIGD |
| Geen databasedumps in Git | BEVESTIGD |
| Geen historische productie-import uitgevoerd | BEVESTIGD |
| Geen echte e-mail verzonden | BEVESTIGD |
| Geen PDF-bibliotheek geïnstalleerd | BEVESTIGD |
| Geen Dokploy of 10.0.2.4 gebruikt | BEVESTIGD |

---

## Eigenaarsbeslissingen die nog vereist zijn

Zie `docs/OWNER_DECISION_PACK_NL.md` voor de volledige beslissingschecklist.

Zie `docs/OWNER_HANDOFF_NL.md` voor de volledige eigenaaroverdracht.

---

*Gegenereerd door `scripts/generate-release-manifest.mjs`*
