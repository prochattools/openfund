# Yeshua Academy Finance — Release Manifest

Status: Release Candidate 2
Taal: Nederlands
Gegenereerd op: 2026-07-05 22:22:24 +0100

---

## Versie-informatie

| Veld | Waarde |
|------|--------|
| Applicatieversie | 0.1.0 |
| Branch | main |
| Commit (volledig) | bb666ae8459b17a7bb2d5eb50c4c7cca2f6cf494 |
| Commit (kort) | bb666ae |
| Commit bericht | chore: harden release candidate validation script |
| Commit datum | 2026-07-05 22:22:24 +0100 |
| Prisma versie (dev) | ^6.15.0 |
| @prisma/client versie | ^6.15.0 |

---

## Geïmplementeerde fasen (samenvatting)

| Fase | Status |
|------|--------|
| Phase 0 — Governance | COMPLETE |
| Phase 1 — Veilige categorisatiebasis | COMPLETE |
| Phase 2 — Financieel domein en historisch model | COMPLETE |
| Phase 3 — Historisch laden (guarded dry-run) | IN PROGRESS |
| Phase 4 — Maandelijkse import en review | COMPLETE |
| Phase 5 — Reconciliatie en afsluiting | COMPLETE |
| Phase 6 — Rapporten en distributie | COMPLETE |
| Phase 7 — Dutch UX en autorisatiehardening | COMPLETE |
| Phase 8 — Infrastructuur en deployment | IN PROGRESS |
| Phase 9 — Operationele hardening en overdracht | COMPLETE (lokaal, RC2) |

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
| 6 | Live backup/restore rehearsal | Vereist lokale PostgreSQL-tools (`pg_dump`, `psql`) |

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
```

---

## Veiligheidsstatus

| Controle | Status |
|---------|--------|
| Geen productiedatabase aangeraakt | BEVESTIGD |
| Geen push uitgevoerd | BEVESTIGD |
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
