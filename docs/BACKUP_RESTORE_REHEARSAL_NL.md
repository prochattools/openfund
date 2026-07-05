# Yeshua Academy Finance — Back-up en herstel rehearsal (Beheerdersgids)

Status: RC3 — live lokale rehearsal succesvol uitgevoerd op 2026-07-05; geen productiedatabase gebruikt
Taal: Nederlands  
Doelgroep: systeembeheerder / eigenaar

## Scope

Dit document beschrijft de lokale back-up- en herstelrehearsalprocedure voor Yeshua Academy Finance.

**Uitsluitend lokale databases** worden gebruikt (`localhost`, `127.0.0.1`, `::1`).
Productiedatabases, Dokploy-hosts, `10.0.2.4`, en externe hosts worden **altijd geblokkeerd**.

Zie ook:

- `scripts/backup-restore-rehearsal.mjs` — geautomatiseerde rehearsalhulp met guards.
- `tests/ops/backupRestoreRehearsal.test.ts` — unit-tests voor databaseURL-guards en commandoconstructie.

---

## Vereisten

| Tool | Vereist | Beschrijving |
|------|---------|-------------|
| `pg_dump` | Ja | Onderdeel van PostgreSQL-clientpakket |
| `pg_restore` | Ja | Onderdeel van PostgreSQL-clientpakket |
| `psql` | Ja | Onderdeel van PostgreSQL-clientpakket |
| `docker` | Aanbevolen | Voor lokale PostgreSQL via `docker-compose.local.yml` |
| `npx prisma` | Ja | Migraties toepassen op hersteldatabase |

Controleer beschikbaarheid:

```bash
which pg_dump pg_restore psql && pg_dump --version
```

---

## Lokale rehearsal — stap voor stap

### Stap 1 — Start lokale PostgreSQL

```bash
docker compose -f docker-compose.local.yml up -d
# Wacht tot healthcheck groen is (±10 seconden)
docker compose -f docker-compose.local.yml ps
```

### Stap 2 — Maak wegwerpdatabases aan

```bash
BRON_DB="yaf_rehearsal_bron_$(date +%Y%m%d_%H%M%S)"
DOEL_DB="yaf_rehearsal_doel_$(date +%Y%m%d_%H%M%S)"

psql postgresql://finance_user:local_dev_placeholder@127.0.0.1:5432/finance \
  -c "CREATE DATABASE ${BRON_DB};"

psql postgresql://finance_user:local_dev_placeholder@127.0.0.1:5432/finance \
  -c "CREATE DATABASE ${DOEL_DB};"

echo "Brondatabase: ${BRON_DB}"
echo "Doeldatabase: ${DOEL_DB}"
```

### Stap 3 — Migraties toepassen op brondatabase

```bash
DATABASE_URL="postgresql://finance_user:local_dev_placeholder@127.0.0.1:5432/${BRON_DB}" \
  npx prisma migrate deploy

DATABASE_URL="postgresql://finance_user:local_dev_placeholder@127.0.0.1:5432/${BRON_DB}" \
  npx prisma migrate status
```

Bevestig: alle vier migraties zijn toegepast zonder fouten.

### Stap 4 — Seed minimale gesloten snapshot fixtures (optioneel)

Voor een zinvolle rehearsal kan een minimale snapshot worden ingezeid via de testfixtures.
Zie `tests/fixtures/` voor goedgekeurde gesanitiseerde fixtures.

```bash
# Voorbeeld — pas pad aan op beschikbare fixture
DATABASE_URL="postgresql://finance_user:local_dev_placeholder@127.0.0.1:5432/${BRON_DB}" \
  node scripts/seed-rehearsal-fixture.mjs 2>/dev/null || echo "Geen fixture beschikbaar"
```

### Stap 5 — Dump brondatabase

```bash
DUMP_BESTAND="yaf_rehearsal_dump_$(date +%Y%m%d_%H%M%S).dump"

pg_dump \
  --host=127.0.0.1 \
  --port=5432 \
  --username=finance_user \
  --format=custom \
  --file="${DUMP_BESTAND}" \
  "${BRON_DB}"

echo "Dumpbestand: ${DUMP_BESTAND}"
ls -lh "${DUMP_BESTAND}"
```

Bevestig: dumpbestand aanwezig en niet leeg.

### Stap 6 — Herstel in doeldatabase

```bash
pg_restore \
  --host=127.0.0.1 \
  --port=5432 \
  --username=finance_user \
  --dbname="${DOEL_DB}" \
  --no-owner \
  "${DUMP_BESTAND}"
```

### Stap 7 — Valideer herstelde database

```bash
# Migratiedrift controleren
DATABASE_URL="postgresql://finance_user:local_dev_placeholder@127.0.0.1:5432/${DOEL_DB}" \
  npx prisma migrate status

# Schemavalidatie
DATABASE_URL="postgresql://finance_user:local_dev_placeholder@127.0.0.1:5432/${DOEL_DB}" \
  npx prisma validate
```

Bevestig:

- [ ] `prisma migrate status`: alle migraties toegepast, geen drift.
- [ ] `prisma validate`: geen fouten.
- [ ] Tabellen aanwezig (zie schema).

### Stap 8 — Ruim wegwerpdatabases op

```bash
psql postgresql://finance_user:local_dev_placeholder@127.0.0.1:5432/finance \
  -c "DROP DATABASE IF EXISTS ${BRON_DB};"

psql postgresql://finance_user:local_dev_placeholder@127.0.0.1:5432/finance \
  -c "DROP DATABASE IF EXISTS ${DOEL_DB};"

rm -f "${DUMP_BESTAND}"

echo "Opruiming voltooid."
```

Bevestig:

- [ ] Geen wegwerpdatabases meer aanwezig.
- [ ] Geen dumpbestanden achtergelaten.

---

## Geautomatiseerde rehearsal

Gebruik het hulpscript voor een reproduceerbare geautomatiseerde rehearsal:

```bash
node scripts/backup-restore-rehearsal.mjs
```

Het script:

- Controleert of de database-URL lokaal is (blokkeert bij productiehosts).
- Maakt unieke wegwerpdatabases aan.
- Past migraties toe.
- Voert dump en herstel uit.
- Valideert de herstelde database.
- Ruimt wegwerpdatabases en dumpbestanden op.
- Rapporteert alleen gesanitiseerde hostnaam, poort, resultaten en opruimingsstatus.

---

## Testdekking

De unit-tests in `tests/ops/backupRestoreRehearsal.test.ts` dekken:

- Databaseguard blokkeert `10.0.2.4`.
- Databaseguard blokkeert externe hostnamen.
- Databaseguard blokkeert ontbrekende databasenaam.
- Databaseguard blokkeert productieachtige databasenamen.
- Databaseguard accepteert `localhost`.
- Databaseguard accepteert `127.0.0.1`.
- Databaseguard accepteert `::1`.
- Commandoconstructie voor `pg_dump` is correct.
- Commandoconstructie voor `pg_restore` is correct.
- Geen geheimen in commandoutvoer.

---

## RC3 — Live rehearsal bewijs (2026-07-05)

**Uitvoeringsomgeving:**

| Gegeven | Waarde |
|---------|--------|
| Host | `127.0.0.1:5432` (lokaal-alleen) |
| PostgreSQL versie | 15.17 (Homebrew) |
| pg_dump versie | 15.17 |
| pg_restore versie | 15.17 |
| finance_user aangemaakt | Ja (lokale superuser, CREATEDB) |

**Rehearsal uitkomst:**

| Stap | Status |
|------|--------|
| Guards gecontroleerd: host lokaal | GESLAAGD |
| Brondatabase aangemaakt (`yaf_rehearsal_src_*`) | GESLAAGD |
| Doeldatabase aangemaakt (`yaf_rehearsal_tgt_*`) | GESLAAGD |
| Migraties toegepast op bron (4/4) | GESLAAGD |
| Dump aangemaakt | GESLAAGD (115.045 bytes) |
| Dump hersteld naar doeldatabase | GESLAAGD |
| `prisma validate` op doeldatabase | GESLAAGD |
| `prisma migrate status` op doeldatabase | GESLAAGD — geen drift |
| Brondatabase verwijderd | GESLAAGD |
| Doeldatabase verwijderd | GESLAAGD |
| Dumpbestand verwijderd | GESLAAGD |

**Bevestigingen:**

- Geen `yaf_rehearsal_*` databases resterend na afloop.
- Geen `.dump`, `.sql`, `.backup`, `.tar` of database-exportbestand achtergebleven.
- `git status --short` toont alleen `.graphifyignore` en `graphify-out/` (ongewijzigd).
- Productie niet aangeraakt.
- `.env` niet gelezen of gewijzigd.
- Geen geheimen in scriptuitvoer.
- Alle 4 migraties (`0_finance_baseline`, `20260703001200_add_workspace_dimensions`, `20260703193000_add_classification_records`, `20260704143000_add_statement_close_report_models`) succesvol toegepast en geverifieerd.

---

## Beperkingen

- Geen productiedatabase-back-ups worden gemaakt of hersteld via dit script.
- De rehearsal gebruikt uitsluitend de wegwerpdatabases `yaf_rehearsal_src_*` en `yaf_rehearsal_tgt_*`.
- De historische eigenaardata (2024, 2025, 2026 werkboeken) is **niet** onderdeel van de rehearsal.
- Gesloten snapshotfixtures zijn gesanitiseerd en bevatten geen echte transactiedata.
