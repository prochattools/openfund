# Yeshua Academy Finance — Release Candidate Validatiechecklist

Status: Release Candidate 4
Datum: 2026-07-05
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

**Dit commando raakt géén productiedatabase, stuurt geen e-mail, installeert geen PDF-bibliotheek en maakt geen push.**

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
| Volledig testsuite | `npm test` | GESLAAGD in laatste lokale RC-validatie |
| Server TypeScript-build | `npm run build:server` | GESLAAGD |
| Next.js productiebuild | `npm run build` | GESLAAGD — 18 pagina's |
| Prisma validate | `DATABASE_URL=... npx prisma validate` | GESLAAGD (in validate:release-candidate) |
| Prisma generate | `npx prisma generate` | GESLAAGD (in validate:release-candidate) |
| Backup dry-run | `node scripts/backup-restore-rehearsal.mjs --dry-run` | GESLAAGD — exit 0 |
| Git diff check | `git diff --check` | GESLAAGD — exit 0 |
| Live rehearsal | `node scripts/backup-restore-rehearsal.mjs --live-local --confirm-disposable` | Handmatig (vereist Docker Compose + pg_dump) |

---

## Openstaande eigenaarsbeslissingen

Zie `docs/OWNER_DECISION_PACK_NL.md` voor de volledige beslissingschecklist.
Zie `docs/OWNER_REVIEW_INDEX_NL.md` voor het owner-review startpunt.
Zie `docs/OWNER_DECISION_READINESS_MATRIX_NL.md` voor per-beslissing readiness.
Zie `docs/POST_APPROVAL_PROMPTS_NL.md` voor prompts die pas na goedkeuring gebruikt mogen worden.

| # | Beslissing | Geblokkeerd |
|---|-----------|-------------|
| 1 | PDF-renderer afhankelijkheid goedkeuren | Echte PDF-export |
| 2 | Productiemigratie goedkeuren | Productiegebruik |
| 3 | Historische import goedkeuren | Historische rapporten |
| 4 | E-mailverzending goedkeuren | Rapportverzending |
| 5 | PostgreSQL-productieversie bevestigen | Veilige cutover |
| 6 | Live backup rehearsal uitvoeren | Bewijs van herstelbaarheid |
| 7 | Bevestigen: geen push vóór goedkeuring | — |
| 8 | Geheimen rotatie bevestigen | Productieveiligheid |

---

## Wat NIET te doen vóór eigenaargoedkeuring

- Niet pushen naar remote (`git push`)
- Geen productiedatabase aanraken
- Geen `.env` wijzigen of secrets committen
- Geen PDF-bibliotheek installeren
- Geen echte e-mail versturen
- Geen historische owner-bestanden in Git kopiëren
- Geen ruwe transactiedumps committen
- Geen databasedumps committen
