# Yeshua Academy Finance — Release Manifest

Status: Release Candidate 4 — published post-push owner decision handoff; owner decision selection next
Taal: Nederlands
Gegenereerd op: 2026-07-08 09:33:35 +0100 (RC4)

---

## Versie-informatie

| Veld | Waarde |
|------|--------|
| Applicatieversie | 0.1.0 |
| Branch | main |
| Commit (volledig) | 9cb5bbaed1a0ce44ccb38f38b54362c6b95cd612 |
| Commit (kort) | 9cb5bba |
| Commit bericht | docs: update provider secret rotation evidence |
| Commit datum | 2026-07-08 09:33:35 +0100 |
| Prisma versie (dev) | ^6.15.0 |
| @prisma/client versie | ^6.15.0 |

---

## Release-evidence

| Veld | Waarde |
|------|--------|
| Manifest generated at commit | 9cb5bbaed1a0ce44ccb38f38b54362c6b95cd612 |
| Manifest generated at short commit | 9cb5bba |
| Release evidence validated through | 9cb5bbaed1a0ce44ccb38f38b54362c6b95cd612 |
| Release evidence validated through short | 9cb5bba |
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

## Beslissingsstatus vóór productie

De volgende statusregels tonen wat afgerond is en welke blokkades nog van kracht zijn. Openstaande blokkades mogen **NIET** worden omzeild zonder expliciete eigenaargoedkeuring:

| # | Blocker | Reden |
|---|---------|-------|
| 1 | Productiemigratie en cutover | AFGEROND 2026-07-07 |
| 2 | Historische productie-import (2024/2025/2026) | AFGEROND 2026-07-07 |
| 3 | Echte e-mailverzending | AFGEROND 2026-07-08 — Resend provider, begrensde productie-verificatie geslaagd |
| 4 | PostgreSQL-productieversie bevestigen | AFGEROND 2026-07-07 |
| 5 | Live backup/restore rehearsal | VOLTOOID op 2026-07-05 (RC3); productieback-up/herstel blijft geblokkeerd tot eigenaargoedkeuring |
| 6 | Nieuwe push naar remote | Niet nodig voor de gepubliceerde handoff; vereist opnieuw expliciete eigenaargoedkeuring voor toekomstige lokale commits |
| 7 | Geheimen roteren | AFGEROND 2026-07-07 |
| 8 | Echte PDF-renderer | AFGEROND 2026-07-08 met `pdfkit`; zie `docs/REAL_PDF_RENDERER_EVIDENCE_NL.md` |

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
| Echte e-mailverzending voltooid (begrensde productie-verificatie) | BEVESTIGD — 1 e-mail verzonden via Resend op 2026-07-08 |
| PDF-bibliotheek alleen voor goedgekeurde renderer geïnstalleerd | BEVESTIGD — `pdfkit` |
| Geen Dokploy of 10.0.2.4 gebruikt | BEVESTIGD |

---

## Eigenaarsbeslissingen die nog vereist zijn

Aanbevolen volgende low-risk beslissing: `postgres-version`. Dit is verification-only, vereist eigenaar/providerbewijs buiten Git, en bevestigt nog geen productiecutover.

Zie `docs/OWNER_DECISION_PACK_NL.md` voor de volledige beslissingschecklist.

Zie `docs/OWNER_HANDOFF_NL.md` voor de volledige eigenaaroverdracht.

---

*Gegenereerd door `scripts/generate-release-manifest.mjs`*
