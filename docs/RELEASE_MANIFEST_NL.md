# Yeshua Academy Finance — Release Manifest

Status: Release Candidate 4 — published post-push owner decision handoff; owner decision selection next
Taal: Nederlands
Gegenereerd op: 2026-07-07 12:04:12 +0100 (RC4)

---

## Versie-informatie

| Veld | Waarde |
|------|--------|
| Applicatieversie | 0.1.0 |
| Branch | main |
| Commit (volledig) | 3ebeccc48ec33c6430b91c973b0ec9b31a264860 |
| Commit (kort) | 3ebeccc |
| Commit bericht | docs: refresh post push publication evidence |
| Commit datum | 2026-07-07 12:04:12 +0100 |
| Prisma versie (dev) | ^6.15.0 |
| @prisma/client versie | ^6.15.0 |

---

## Release-evidence

| Veld | Waarde |
|------|--------|
| Manifest generated at commit | 3ebeccc48ec33c6430b91c973b0ec9b31a264860 |
| Manifest generated at short commit | 3ebeccc |
| Release evidence validated through | 3ebeccc48ec33c6430b91c973b0ec9b31a264860 |
| Release evidence validated through short | 3ebeccc |
| RC4 evidence commits | `7ce6e6d`, `43bfb90`, `42a6f49`, `43137b5`, `33d08c4` |
| Published owner-decision handoff on origin/main | `f2f7cbb docs: update post push owner decision handoff` |
| Published owner-decision handoff hash | `f2f7cbb3d4fa6e2c30f099158d97060e7d780dc6` |
| Published post-push handoff commits | `e07be8f`, `a5ab4a8`, `949823a`, `84d13d7`, `3866a43`, `f2f7cbb` |
| Commits ahead of origin/main at publication checkpoint | `0` |

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
| 7 | Nieuwe push naar remote | Niet nodig voor de gepubliceerde handoff; vereist opnieuw expliciete eigenaargoedkeuring voor toekomstige lokale commits |
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
npm run preflight:next-owner-decision
```

---

## Veiligheidsstatus

| Controle | Status |
|---------|--------|
| Geen productiedatabase aangeraakt | BEVESTIGD |
| Published owner-decision handoff `f2f7cbb` staat op origin/main | BEVESTIGD |
| Zes post-push owner-decision handoff commits gepubliceerd | BEVESTIGD |
| Geen nieuwe push nodig tenzij een latere lokale commit wordt gemaakt | BEVESTIGD |
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

Aanbevolen volgende low-risk beslissing: `postgres-version`. Dit is verification-only, vereist eigenaar/providerbewijs buiten Git, en bevestigt nog geen productiecutover.

Zie `docs/OWNER_DECISION_PACK_NL.md` voor de volledige beslissingschecklist.

Zie `docs/OWNER_HANDOFF_NL.md` voor de volledige eigenaaroverdracht.

---

*Gegenereerd door `scripts/generate-release-manifest.mjs`*
