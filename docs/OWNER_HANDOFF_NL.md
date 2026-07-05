# Yeshua Academy Finance — Eigenaaroverdracht (RC2)

Status: Release Candidate 2 — lokaal gevalideerd; productie niet aangeraakt  
Datum: 2026-07-05  
Taal: Nederlands  
Doelgroep: eigenaar / beheerder

---

## Wat klaar is (lokaal)

De volledige financiële applicatie is gebouwd, getest en lokaal gevalideerd:

| Onderdeel | Status |
|-----------|--------|
| Maandelijkse ING-import workflow | GEREED |
| Categorisatie (deterministisch + review) | GEREED |
| Periode-afsluiting en reconciliatie | GEREED |
| Maandelijkse en jaarlijkse rapporten (HTML + XLSX) | GEREED |
| Rapportgoedkeuring door beheerder | GEREED |
| Dispatch-metadata (e-mail wordt niet verzonden) | GEREED |
| Admin-bevoegdheidsbeheer | GEREED |
| Dutch UX — alle teksten in het Nederlands | GEREED |
| Back-up/herstel guard-scripts | GEREED |
| Release Candidate validatiescript | GEREED |
| Release Manifest generator | GEREED |
| Productiecutover-documentatieplan | GEREED (documentatie-alleen) |
| Lokale Docker Compose (PostgreSQL) | GEREED |

---

## Wat nog NIET goedgekeurd is

De volgende onderdelen zijn bewust geblokkeerd en vereisen expliciete eigenaargoedkeuring vóór uitvoering:

| # | Geblokkeerd onderdeel | Vereiste beslissing |
|---|-----------------------|---------------------|
| 1 | Echte PDF-generatie | Kies en keur een PDF-bibliotheek goed |
| 2 | Productiemigratie en overstap | Goedkeuring van volledige cutover |
| 3 | Historische productie-import (2024/2025/2026) | Afzonderlijke goedkeuring + dry-run acceptatie |
| 4 | Echte e-mailverzending | Resend-API-sleutel configureren + goedkeuring |
| 5 | PostgreSQL-productieversie bevestigen | Verificatie bij hostingprovider |
| 6 | Live backup/restore rehearsal | Uitvoeren op lokale PostgreSQL-tools |
| 7 | Push naar remote | Expliciete eigenaargoedkeuring vereist |
| 8 | Geheimen roteren | Vóór productie uitvoeren |

---

## Eigenaarsbeslissingen die nog vereist zijn

Zie `docs/OWNER_DECISION_PACK_NL.md` voor de volledige beslissingschecklist met:
- Achtergrond per beslissing
- Veiligheidschecks
- Terugrolregels
- Exacte prompt per beslissing

---

## Commando's die u kunt uitvoeren

### RC2-validatie in één stap

```bash
npm run validate:release-candidate
```

Dit commando voert volledig lokale en veilige validaties uit:
1. Volledig testsuite
2. TypeScript server-compilatie
3. Next.js productiebuild
4. Prisma schemavalidatie (lokale placeholder)
5. Prisma Client genereren
6. Backup dry-run (geen database nodig)
7. Git whitespace-check

**Verwacht: exit 0, geen fouten.**

### Release manifest bekijken

```bash
node scripts/generate-release-manifest.mjs
```

Of schrijven naar bestand:

```bash
node scripts/generate-release-manifest.mjs --write
```

Zie `docs/RELEASE_MANIFEST_NL.md` voor het resultaat.

### Backup rehearsal dry-run uitvoeren

```bash
node scripts/backup-restore-rehearsal.mjs --dry-run
```

Dit voert geen databasecommando's uit. Exit 0 bevestigt dat de guards werken.

### Help bekijken

```bash
node scripts/backup-restore-rehearsal.mjs --help
```

---

## Live backup rehearsal (alleen na installatie van lokale tools)

De live backup/restore rehearsal vereist lokale PostgreSQL-tools (`pg_dump`, `pg_restore`, `psql`).

### Stap 1 — Controleer beschikbaarheid

```bash
which pg_dump pg_restore psql && pg_dump --version
```

Als de tools niet beschikbaar zijn: zie `docs/BACKUP_RESTORE_REHEARSAL_NL.md` voor installatiehandleiding.

### Stap 2 — Start lokale PostgreSQL

```bash
docker compose -f docker-compose.local.yml up -d
docker compose -f docker-compose.local.yml ps
```

### Stap 3 — Voer live rehearsal uit

```bash
node scripts/backup-restore-rehearsal.mjs --live-local --confirm-disposable
```

Dit commando:
- Maakt alleen wegwerpdatabases aan (`yaf_rehearsal_*`)
- Voert migraties toe
- Maakt een dump en herstelt die
- Valideert de herstelde database
- Ruimt alle wegwerpdatabases op
- Produceert **geen** databasedumps in Git

### Stap 4 — Documenteer het resultaat

Leg het resultaat vast in `docs/finance-rebuild-run.md` met datum, uitkomst, en bestandsgrootte van de dump.

---

## Wat NOOIT gedaan mag worden zonder expliciete goedkeuring

| Actie | Reden |
|-------|-------|
| `git push` | Commits mogen pas worden gepusht na eigenaargoedkeuring |
| Productiemigratie uitvoeren | Vereist eigenaargoedkeuring en voorbereiding |
| Historische productie-import uitvoeren | Vereist droogloopacceptatie + eigenaargoedkeuring |
| Echte e-mail versturen | Vereist geconfigureerde API-sleutel + goedkeuring |
| PDF-bibliotheek installeren | Vereist keuze en goedkeuring van eigenaar |
| `.env` wijzigen of committen | Nooit in Git; geheimen horen in de secret vault |
| Productiehost (`10.0.2.4`, Dokploy) aanraken | Altijd geblokkeerd door guards |
| Ruwe transactiedumps committen | Nooit in Git |
| Databasedumps committen | Nooit in Git |

---

## Gereed voor eigenaarsbeoordeling — Checklist

- [ ] `npm run validate:release-candidate` succesvol uitgevoerd (exit 0)
- [ ] Release manifest gelezen: `docs/RELEASE_MANIFEST_NL.md`
- [ ] Backup dry-run uitgevoerd: `node scripts/backup-restore-rehearsal.mjs --dry-run`
- [ ] Beslissingspakket gelezen: `docs/OWNER_DECISION_PACK_NL.md`
- [ ] Beheerdershandleiding gelezen: `docs/ADMIN_OPERATING_GUIDE_NL.md`
- [ ] Productiecutoverplan gelezen: `docs/PRODUCTION_CUTOVER_PLAN_NL.md`
- [ ] Backup rehearsal handleiding gelezen: `docs/BACKUP_RESTORE_REHEARSAL_NL.md`
- [ ] Alle openstaande blockers beoordeeld
- [ ] Live backup rehearsal gepland of uitgevoerd
- [ ] PostgreSQL-productieversie bevestigd bij hostingprovider

---

## Verwijzingen naar overige documentatie

| Document | Doel |
|----------|------|
| `docs/ADMIN_OPERATING_GUIDE_NL.md` | Maandelijkse werkstroom voor beheerder |
| `docs/FINAL_RELEASE_CANDIDATE_CHECKLIST_NL.md` | Geautomatiseerde RC-validatiechecklist |
| `docs/OWNER_DECISION_PACK_NL.md` | Eigenaarsbeslissingen met achtergrond en instructies |
| `docs/PRODUCTION_CUTOVER_PLAN_NL.md` | Stapsgewijs productieoverstapplan (documentatie-alleen) |
| `docs/BACKUP_RESTORE_REHEARSAL_NL.md` | Back-up en herstelhandleiding |
| `docs/RELEASE_MANIFEST_NL.md` | Actueel release manifest (versie, commit, blockers) |
| `docs/INFRASTRUCTURE_READINESS.md` | PostgreSQL-versie en infrastructuurgereedheid |

---

## Bevestiging

Dit document bevestigt:

- Er zijn **geen productiecommando's** uitgevoerd.
- Er zijn **geen productiecredentials** opgenomen.
- Er is **niet gepusht** naar de remote.
- Er zijn **geen owner-bronbestanden** in Git geplaatst.
- Er zijn **geen ruwe transactiedumps** of **databasedumps** in Git geplaatst.
- Er is **geen historische productie-import** uitgevoerd.
- Er is **geen echte e-mail** verstuurd.
- Er is **geen PDF-bibliotheek** geïnstalleerd.
- **Graphify** is niet aangeraakt (`.graphifyignore`, `graphify-out/`).
