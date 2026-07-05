# Yeshua Academy Finance — Eindaudit gereedheid

Status: Release Candidate 2 — lokaal gevalideerd; productie niet aangeraakt
Datum: 2026-07-05
Taal: Nederlands
Afhankelijkheden: `docs/ROADMAP.md`, `docs/IMPLEMENTATION_PLAN.md`, `docs/ADMIN_OPERATING_GUIDE_NL.md`

---

## 1. Geïmplementeerde fasen en commits

| Fase | Status | Commits |
|------|--------|---------|
| Phase 0 — Governance | COMPLETE | `73daabd` |
| Phase 1 — Veilige categorisatiebasis | COMPLETE | `925a609` |
| Phase 2 — Financieel domein | COMPLETE | `d2afb18` |
| Phase 3 — Historisch laden (guarded dry-run) | IN PROGRESS | `0196910`, `b3b8afd`, `49386ad` |
| Phase 4 — Maandelijkse import en review | GEÏMPLEMENTEERD | `c5d6312` |
| Phase 5 — Reconciliatie en sluiting | COMPLETE | `ba372d6` |
| Phase 6 — Rapporten en distributie | COMPLETE | `a24ef3e`, `9e4dc45`, `d1430c2`, `dbf23e4`, `ba372d6` |
| Phase 7 — Dutch UX en autorisatiehardening | COMPLETE | `7d58726`, `0d70f51`, `20ff64b` |
| Phase 8 — Infrastructuur | GEDEELTELIJK (INFRA-001, INFRA-002 gedocumenteerd) | — |
| Phase 9 — Operationele hardening en overdracht | IN PROGRESS | `d51cfad` |

### Meest recente commit bij aanvang van deze auditrondes

```
f344198 docs: align finance rebuild documentation
```

---

## 2. Bekende blockers

| Blocker | Reden | Status |
|---------|-------|--------|
| Echte PDF-generatie | `PDF_BLOCKER` actief; geen goedgekeurde PDF-bibliotheek | Geblokkeerd |
| Productiemigratie en overstap | Vereist expliciete eigenaargoedkeuring | Geblokkeerd |
| Historische productie-import (2024/2025/2026) | Operator-gated; vereist eigenaargoedkeuring en dry-run-resultaten | Geblokkeerd |
| Echte e-mailverzending | `RESEND_API_KEY` niet geconfigureerd; no-op modus actief | Geblokkeerd |
| PostgreSQL-versie productie bevestigen | Vereist verificatie bij hostingprovider vóór overstap | Geblokkeerd |

---

## 3. Validatiechecklist

### Testsuite

```bash
npm test
# Verwacht: alle tests slagen; geen productie-DB; geen externe calls
```

| Controle | Status |
|---------|--------|
| Volledig testsuite (89 bestanden, 643 tests) | GESLAAGD |
| `tests/auth/adminMutationPolicy.test.ts` (24 tests) | GESLAAGD |
| `tests/helpers/dutchTextAudit.test.ts` (20 tests) | GESLAAGD |
| `tests/helpers/navigation.test.ts` (13 tests) | GESLAAGD |
| `tests/ops/backupRestoreRehearsal.test.ts` (28 tests, incl. safe default + explicit flags) | GESLAAGD |
| `tests/ops/packageScriptSafety.test.ts` (11 tests) | GESLAAGD |
| `tests/ops/releaseManifest.test.ts` (12 tests) | GESLAAGD |
| `tests/ops/productionBlockerGuards.test.ts` (24 tests) | GESLAAGD |
| Servicesentest-sets (report, close, review, import) | GESLAAGD |

### Builds

```bash
npm run build:server   # TypeScript server-build
npm run build          # Next.js productiebuild
```

| Controle | Status |
|---------|--------|
| `npm run build:server` | GESLAAGD — schone TypeScript-compilatie |
| `npm run build` | GESLAAGD — 18 statische pagina's |

### Prisma

```bash
npx prisma validate
npx prisma generate
```

| Controle | Status |
|---------|--------|
| `prisma validate` | GESLAAGD |
| `prisma generate` | GESLAAGD — Prisma Client gegenereerd |
| Migraties toegepast op wegwerpdatabase | GESLAAGD (MODEL-004/005 validatieronde) |

### Lokale database-URL-guards

| Controle | Status |
|---------|--------|
| `10.0.2.4` geblokkeerd | GESLAAGD (unit tests) |
| Externe hostnamen geblokkeerd | GESLAAGD (unit tests) |
| Ontbrekende databasenaam geblokkeerd | GESLAAGD (unit tests) |
| Productieachtige namen geblokkeerd | GESLAAGD (unit tests) |
| `localhost`/`127.0.0.1`/`[::1]` geaccepteerd | GESLAAGD (unit tests) |

### Back-up/herstel rehearsal

```bash
node scripts/backup-restore-rehearsal.mjs --dry-run
node scripts/backup-restore-rehearsal.mjs --help
```

| Controle | Status |
|---------|--------|
| Guards unit tests (28, incl. safe default + explicit flags) | GESLAAGD |
| Dry-run script beschikbaar | GEREED |
| Standaard aanroep vereist geen argumenten → exit 1 (veilig) | GEÏMPLEMENTEERD |
| Live mode vereist `--live-local --confirm-disposable` | GEÏMPLEMENTEERD |
| Live rehearsal (vereist pg_dump + actieve finance_user) | Handmatig uitvoeren vóór productie |

#### Live rehearsal status RC2

PostgreSQL-client tools aanwezig: pg_dump 15.17, psql 15.17, pg_restore 15.17.

Blocker: lokale PostgreSQL draait op 127.0.0.1:5432 maar `finance_user`-rol bestaat nog niet.
Start Docker Compose eerst om de rol aan te maken:

```bash
docker compose -f docker-compose.local.yml up -d
node scripts/backup-restore-rehearsal.mjs --live-local --confirm-disposable
```

---

## 4. Operationele aftekenchecklist

Vóór productiemigratie:

- [ ] Eigenaar heeft alle geïmplementeerde fasen beoordeeld.
- [ ] Eigenaar heeft `docs/ADMIN_OPERATING_GUIDE_NL.md` gelezen en akkoord gegeven.
- [ ] Eigenaar heeft `docs/PRODUCTION_CUTOVER_PLAN_NL.md` gelezen en goedgekeurd.
- [ ] Eigenaar heeft `docs/BACKUP_RESTORE_REHEARSAL_NL.md` gelezen.
- [ ] Back-up/herstel rehearsal lokaal succesvol uitgevoerd.
- [ ] Alle bekende blockers zijn beoordeeld en bewust geaccepteerd of gepland.

---

## 5. Dataveiligheidscontrolelijst

| Controle | Status |
|---------|--------|
| Geen eigenaar-Excel/CSV/PDF-bestanden in Git | BEVESTIGD |
| Geen ruwe transactiedumps in Git | BEVESTIGD |
| Geen productieconfiguratie of -credentials in Git | BEVESTIGD |
| Geen `.env`-wijzigingen | BEVESTIGD |
| Geen database-dumpbestanden in Git | BEVESTIGD |
| Originele bronbestanden retainbaar en downloadbaar | GEÏMPLEMENTEERD |
| SHA-256-hashes voor retainede bronbestanden | GEÏMPLEMENTEERD |
| Revisie-audit voor alle beheerderacties | GEÏMPLEMENTEERD |

---

## 6. Vereisten vóór productiemigratie

- [ ] PostgreSQL-versie op productieserver bevestigd (zie `docs/INFRASTRUCTURE_READINESS.md`).
- [ ] Prisma-compatibiliteit met productie-PostgreSQL-versie geverifieerd.
- [ ] Geheimen geroteerd (zie `docs/PRODUCTION_CUTOVER_PLAN_NL.md` §3).
- [ ] Back-up gemaakt van productiedatabase.
- [ ] Migration dry-run geslaagd op productiedatabase.
- [ ] Eigenaargoedkeuring ontvangen voor migratie.

---

## 7. Validatie na productiemigratie

- [ ] `GET /api/health` retourneert `{ status: "ok" }`.
- [ ] Inloggen lukt met testaccount.
- [ ] `prisma migrate status` meldt alle migraties toegepast.
- [ ] Geen kritieke fouten in applicatielogs.
- [ ] Maandelijkse importworkflow werkt einde-tot-einde (met testbestand).

---

## 8. Terugrol en eigenaargoedkeuring

- Terugrolplan staat in `docs/PRODUCTION_CUTOVER_PLAN_NL.md` §10.
- Geen productiemutatie zonder expliciete eigenaargoedkeuring.
- Geen `git push --force` op `main`.
- Bij terugrol: bevestig dataintegriteit en leg reden vast in `docs/finance-rebuild-run.md`.

---

## 9. Niet-geïmplementeerde functies (bewuste besluiten)

| Functie | Besluit |
|---------|---------|
| Meerdere banken/formaten | Vereist nieuw eigenaarsbesluit |
| Budgetten en voorspellingen | Vereist nieuw eigenaarsbesluit |
| Factuuradministratie | Vereist nieuw eigenaarsbesluit |
| Automatische e-maalverzending | Vereist nieuw eigenaarsbesluit |
| Autonoom AI-boekhouden | Bewust uitgesloten (zie `docs/PHILOSOPHY.md`) |
