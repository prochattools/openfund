# Yeshua Academy Finance — Release Candidate Validatiechecklist

Status: Release Candidate 7 — roadmap 100% through Phase 17; Phase 17 complete; formula-based monthly chaining model; read-only production audit passed on 2026-07-09; 2024 closing 1218415 confirmed; real email sending verified 2026-07-08
Datum: 2026-07-08
Taal: Nederlands

---

## Geautomatiseerde RC-validatie

Voer het volgende commando uit om alle veilige lokale validaties in één stap te draaien:

```bash
npm run validate:release-candidate
```

Dit commando voert uit:
1. `npm test` — volledig testsuite (aantallen worden door de actuele run bepaald)
2. `npm run build:server` — TypeScript server-compilatie
3. `npm run build` — Next.js productiebuild (18 pagina's)
4. `DATABASE_URL=... npx prisma validate` — schemavalidatie (lokale placeholder)
5. `npx prisma generate` — Prisma Client genereren
6. `node scripts/backup-restore-rehearsal.mjs --dry-run` — guard-check, geen database vereist
7. `git diff --check` — geen onverwachte wijzigingen

Verwacht resultaat: alle stappen slagen, exit 0.

**Dit commando raakt géén productiedatabase, stuurt geen e-mail, wijzigt geen runtimeconfiguratie en maakt geen push.**

---

## Handmatige aanvullende validaties

Deze stappen vereisen een lokale PostgreSQL-instantie of handmatige bevestiging. Ze zijn niet opgenomen in het geautomatiseerde script.

### Prisma-validatie (vereist DATABASE_URL)

```bash
npx prisma validate
npx prisma generate
```

Stel `DATABASE_URL` in op een lokale disposable database:

```bash
DATABASE_URL=postgresql://finance_user:local_dev_placeholder@127.0.0.1:5432/yaf_validate npx prisma validate
```

### Live backup/restore rehearsal (vereist pg_dump/pg_restore en actieve finance_user)

```bash
docker compose -f docker-compose.local.yml up -d
node scripts/backup-restore-rehearsal.mjs --live-local --confirm-disposable
```

Zie `docs/BACKUP_RESTORE_REHEARSAL_NL.md` voor stapsgewijze instructies.
Zie `docs/OWNER_HANDOFF_NL.md` voor het volledige stappenplan.

---

## Validatiestatus RC-004

| Stap | Commando | Status |
|------|---------|--------|
| Volledig testsuite (847 tests) | `npm test` | GESLAAGD in laatste lokale RC-validatie |
| Server TypeScript-build | `npm run build:server` | GESLAAGD |
| Next.js productiebuild | `npm run build` | GESLAAGD — 18 pagina's |
| Prisma validate | `DATABASE_URL=... npx prisma validate` | GESLAAGD (in validate:release-candidate) |
| Prisma generate | `npx prisma generate` | GESLAAGD (in validate:release-candidate) |
| Backup dry-run | `node scripts/backup-restore-rehearsal.mjs --dry-run` | GESLAAGD — exit 0 |
| Git diff check | `git diff --check` | GESLAAGD — exit 0 |
| Finale docs consistentie-audit | `node scripts/final-docs-consistency-audit.mjs` | GESLAAGD |
| Finale eigenaarsbeoordeling preflight | `node scripts/final-owner-review-preflight.mjs --check` | GESLAAGD |
| Owner acceptance preflight | `npm run preflight:owner-acceptance` | GEREED |
| Owner decision menu | `node scripts/owner-decision-menu.mjs` | GEREED |
| Live rehearsal | `node scripts/backup-restore-rehearsal.mjs --live-local --confirm-disposable` | Handmatig (vereist Docker Compose + pg_dump) |

---

## Openstaande eigenaarsbeslissingen

Zie `docs/OWNER_DECISION_PACK_NL.md` voor de volledige beslissingschecklist.
Zie `docs/OWNER_REVIEW_INDEX_NL.md` voor het owner-review startpunt.
Zie `docs/OWNER_DECISION_READINESS_MATRIX_NL.md` voor per-beslissing readiness.
Zie `docs/OWNER_ACCEPTANCE_CHECKLIST_NL.md` voor lokale acceptatie zonder uitvoering.
Zie `docs/OWNER_DECISION_MENU_NL.md` voor de volgende beslissingskeuze.
Zie `docs/POST_APPROVAL_PROMPTS_NL.md` voor prompts die pas na goedkeuring gebruikt mogen worden.

| # | Beslissing | Status |
|---|-----------|--------|
| 1 | PDF-renderer afhankelijkheid goedkeuren | AFGEROND — `pdfkit` renderer 2026-07-08 |
| 2 | Productiemigratie goedkeuren | AFGEROND — schema finance gedeployed 2026-07-07 |
| 3 | Historische import goedkeuren | AFGEROND — 902 transacties, 681 boekingen 2026-07-07 |
| 4 | E-mailverzending goedkeuren | Code-complete — productie-verzendverificatie pending test-recipient runtime input |
| 5 | PostgreSQL-productieversie bevestigen | AFGEROND — PostgreSQL 15.8 bevestigd 2026-07-07 |
| 6 | Live backup rehearsal uitvoeren | AFGEROND — rehearsal 2026-07-05 |
| 7 | Geheimen rotatie bevestigen | AFGEROND — finance_user geroteerd 2026-07-07 |
| 8 | App/provider geheimremediatie afronden | AFGEROND — alle provider secrets geroteerd en toegepast 2026-07-08 |

---

## Wat NIET te doen vóór eigenaargoedkeuring

- Niet pushen naar remote (`git push`)
- Geen productiedatabase aanraken
- Geen `.env` wijzigen of secrets committen
- Geen nieuwe dependency installeren zonder aparte goedkeuring
- Geen bulk e-mail versturen
- Geen stored-recipient batch verzenden
- Geen historische owner-bestanden in Git kopiëren
- Geen ruwe transactiedumps committen
- Geen databasedumps committen
