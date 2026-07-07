# Yeshua Academy Finance — Productieoverstap (Beheerdersgids)

Status: schema cutover afgerond 2026-07-07 (documentatie-alleen plan; uitvoering: zie `docs/PRODUCTION_SCHEMA_CUTOVER_EVIDENCE_NL.md`)  
Taal: Nederlands  
Doelgroep: systeembeheerder / eigenaar  
Afhankelijkheden: `docs/INFRASTRUCTURE_READINESS.md`, `docs/ADMIN_OPERATING_GUIDE_NL.md`

> **Belangrijk:** Dit document is een plan. Er zijn geen productiecommando's uitgevoerd,
> geen productiecredentials opgenomen, en geen productieconfiguratie gewijzigd.
> Elke stap vereist expliciete bevestiging van de eigenaar vóór uitvoering.

---

## 1. Scope en niet-doelen

**Dit plan omvat:**

- Eenmalige productieoverstap van de herbouwde applicatie op een nieuwe of bestaande server.
- PostgreSQL-migratie op de productiedatabase.
- Validatie van de migratie en applicatie na overstap.
- Terugrolprocedure bij problemen.

**Dit plan omvat NIET:**

- Historische productie-import (aparte goedgekeurde taak vereist).
- PDF-rapportgeneratie (PDF_BLOCKER van kracht; goedgekeurde bibliotheek vereist).
- Automatisch versturen van e-mail (Resend-sleutel niet geconfigureerd).
- Wijzigingen aan de Dokploy- of infrastructuurconfiguratie anders dan noodzakelijk voor migratie.
- Enige actie op productieschema zonder expliciete eigenaargoedkeuring.

---

## 2. Vereiste eigenaargoedkeuringen

De volgende goedkeuringen zijn **verplicht** vóór uitvoering:

- [ ] Eigenaar bevestigt dat de herbouwde applicatie klaar is voor productie.
- [ ] Eigenaar bevestigt PostgreSQL-versie op productieserver (zie `docs/INFRASTRUCTURE_READINESS.md`).
- [ ] Eigenaar heeft de volledige testresultaten en de builduitvoer beoordeeld.
- [ ] Eigenaar heeft back-uprehearsalresultaten beoordeeld (zie `docs/BACKUP_RESTORE_REHEARSAL_NL.md`).
- [ ] Eigenaar bevestigt back-upvensterstrategie (wanneer back-up, hoe lang bewaren).
- [ ] Eigenaar bevestigt dat geheimen correct zijn geroteerd vóór overstap.

---

## 3. Geheimen roteren

Vóór de overstap moeten alle productiecredentials worden gecontroleerd en zo nodig geroteerd:

- `DATABASE_URL` — PostgreSQL-verbindingsstring (geen placeholder).
- `POSTGRES_USER`, `POSTGRES_PASSWORD` — databasegebruikerscredentials.
- `RESEND_API_KEY` — e-mailprovider-sleutel (indien e-mail wordt ingeschakeld).
- Clerk- of Ory-authenticatiesleutels (afhankelijk van gekozen authenticatiemethode).
- Interne API-origins en -sleutels.

> Nooit credentials in dit document opnemen. Gebruik een wachtwoordmanager of secret vault.

---

## 4. Back-up vóór overstap

Maak een volledige back-up van de productiedatabase **vóór** elke migratiestap:

```bash
# Conceptueel — pas host, gebruiker, databasenaam aan op de werkelijke productiewaarden
# Voer NOOIT uit zonder eigenaargoedkeuring en bevestigde productiecredentials

pg_dump \
  --host=<PRODUCTIEHOST> \
  --port=5432 \
  --username=<GEBRUIKER> \
  --format=custom \
  --file=yeshua_finance_pre_cutover_$(date +%Y%m%d_%H%M%S).dump \
  <DATABASENAAM>
```

Bewaar de back-up op een veilige locatie buiten de productieserver.

Bevestig na de back-up:

- [ ] Back-upbestand aanwezig en niet leeg.
- [ ] Back-upbestand bereikbaar vanaf herstelpunt.
- [ ] Bestandsgrootte past bij de verwachte databaseomvang.

---

## 5. Migratie dry-run

Voer altijd een dry-run uit vóór de werkelijke migratie:

```bash
# Conceptueel — pas DATABASE_URL aan op de werkelijke productiewaarden
# Voer NOOIT uit zonder eigenaargoedkeuring

DATABASE_URL="<PRODUCTIE_DATABASE_URL>" \
  npx prisma migrate diff \
  --from-schema-datasource prisma/schema.prisma \
  --to-schema-datamodel prisma/schema.prisma \
  --shadow-database-url "postgresql://..." \
  --exit-code
```

Alternatief: valideer de migratiestatus:

```bash
DATABASE_URL="<PRODUCTIE_DATABASE_URL>" npx prisma migrate status
```

Bevestig na dry-run:

- [ ] Geen onverwachte schemaverschillen.
- [ ] Verwachte migraties in de juiste volgorde.
- [ ] Geen destructieve wijzigingen (DROP TABLE, DROP COLUMN op bestaande kolommen met data).

---

## 6. Migratie uitvoeren

Na goedgekeurde dry-run en bevestigd back-up:

```bash
# Conceptueel — past DATABASE_URL aan op de werkelijke productiewaarden
# Voer NOOIT uit zonder eigenaargoedkeuring en voltooide back-up

DATABASE_URL="<PRODUCTIE_DATABASE_URL>" npx prisma migrate deploy
```

Dit commando past uitsluitend migraties toe die nog niet zijn toegepast. Het rolt NIET terug bij fouten.

---

## 7. Validatie na migratie

Na succesvolle migratie:

```bash
# Schema valideren
DATABASE_URL="<PRODUCTIE_DATABASE_URL>" npx prisma validate

# Migratiedrift controleren
DATABASE_URL="<PRODUCTIE_DATABASE_URL>" npx prisma migrate status
```

Bevestig:

- [ ] `prisma migrate status` meldt: alle migraties toegepast, geen drift.
- [ ] `prisma validate` slaagt zonder fouten.
- [ ] Applicatiehealthcheck (`GET /api/health`) retourneert `{ status: "ok" }`.
- [ ] Inloggen lukt met testgebruikersaccount.
- [ ] Geen kritieke fouten in applicatielogs.

---

## 8. Historische productie-import

De historische import van 2024, 2025 en 2026 transacties is **nog niet uitgevoerd** en is
afzonderlijk goedgekeurd vereist. Zie `docs/IMPLEMENTATION_PLAN.md` HIST-001 t/m HIST-004.

Vereisten vóór historische import op productie:

- [ ] Eigenaar bevestigt werkelijke hashwaarden van de bronsource-bestanden.
- [ ] Eigenaar bevestigt importplan inclusief duplicate-detectie en controleafstemming.
- [ ] Droge run op wegwerpdatabase geslaagd met correcte controletotalen.
- [ ] Eigenaar bevestigt uitvoering op productie.

---

## 9. Beperkingen rapporten, PDF en e-mail

Na overstap gelden de volgende beperkingen:

| Functie | Status | Reden |
|---------|--------|-------|
| HTML-rapport | Beschikbaar | Geïmplementeerd |
| XLSX-rapport | Beschikbaar | Geïmplementeerd |
| PDF-rapport | **GEBLOKKEERD** | `PDF_BLOCKER` actief; goedgekeurde PDF-bibliotheek vereist |
| E-mailverzending | **GEBLOKKEERD** | `RESEND_API_KEY` niet geconfigureerd; no-op modus actief |
| Historische import | **GEBLOKKEERD** | Afzonderlijke eigenaargoedkeuring vereist |

---

## 10. Terugrolplan

Als de productieoverstap mislukt:

### Terugrol databasemigratie

Prisma ondersteunt geen automatisch terugdraaien van migraties. Herstel via de pre-overstap back-up:

```bash
# Conceptueel — pas host en credentials aan
# Voer NOOIT uit zonder eigenaargoedkeuring

pg_restore \
  --host=<PRODUCTIEHOST> \
  --port=5432 \
  --username=<GEBRUIKER> \
  --dbname=<DATABASENAAM> \
  --clean \
  yeshua_finance_pre_cutover_<TIJDSTEMPEL>.dump
```

### Terugrol applicatie

- Zet de vorige versie opnieuw in via Dokploy of herstel de vorige Docker-image.
- Hervalideer het healthcheck-eindpunt na terugrol.

### Na terugrol

- [ ] Eigenaar bevestigt dat data consistent is na terugrol.
- [ ] Controleer `prisma migrate status` na terugrol.
- [ ] Leg oorzaak en oplossing vast in `docs/finance-rebuild-run.md`.

---

## 11. Veiligheidsregels

- Geen `git push --force` op `main`.
- Geen migratie op productie zonder expliciete eigenaargoedkeuring.
- Geen back-upbestanden in Git opnemen.
- Geen credentials in Git opnemen.
- Geen productiewijzigingen buiten het uitdrukkelijke productieoverstapvenster.
- Alle stappen uitvoeren in aanwezigheid van of met directe bereikbaarheid van de eigenaar.

---

## 12. Bevestiging

Dit document bevestigt:

- Er zijn **geen productiecommando's uitgevoerd** bij het opstellen van dit plan.
- Er zijn **geen productiecredentials opgenomen** in dit document.
- Dit document is uitsluitend een **plan** en vereist expliciete eigenaargoedkeuring vóór elke stap.
- De eigenaar blijft verantwoordelijk voor elke productiemutatie.
