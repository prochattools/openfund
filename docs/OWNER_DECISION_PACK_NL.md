# Yeshua Academy Finance — Eigenaarsbeslissingsoverzicht

Status: Release Candidate 4 — owner-review beslissingen; uitvoering blijft geblokkeerd tot expliciete goedkeuring
Datum: 2026-07-05  
Taal: Nederlands  
Afhankelijkheden: `docs/OWNER_REVIEW_INDEX_NL.md`, `docs/OWNER_DECISION_READINESS_MATRIX_NL.md`, `docs/POST_APPROVAL_PROMPTS_NL.md`, `docs/PRODUCTION_CUTOVER_PLAN_NL.md`, `docs/BACKUP_RESTORE_REHEARSAL_NL.md`, `docs/ADMIN_OPERATING_GUIDE_NL.md`

---

Dit document bevat de beslissingen die de eigenaar moet nemen voordat de applicatie in productie kan worden gebruikt. Elke beslissing is onafhankelijk — u kunt ze in willekeurige volgorde behandelen.

**Beveiligingsregel:** Voeg geen geheimen, hostnamen, wachtwoorden of productieconfiguratie toe aan dit document of aan Git.

---

## Beslissing 1 — Echte PDF-renderer

### Wat dit mogelijk maakt

Een echte PDF-versie van maandelijkse en jaarlijkse rapporten, naast de al werkende HTML- en XLSX-versies. Dit is afgerond met `pdfkit`; zie `docs/REAL_PDF_RENDERER_EVIDENCE_NL.md`.

### Status

PDF-artefacten worden server-side gegenereerd en opgeslagen als `application/pdf`. Echte e-mailverzending blijft apart geblokkeerd.

### Veiligheidschecks vóór uitvoering

- [x] `pdfkit` gekozen en toegevoegd.
- [x] Report artifact tests bijgewerkt.
- [x] Geen productie, e-mail, secrets, owner-bestanden, raw rows of dumps gebruikt.

### Terugrolregel

Als een latere PDF-regressie optreedt: revert de dependency- en rendererwijziging en laat report snapshots ongemoeid.

### Beslissing

- [x] **Afgerond** — `pdfkit`

### Volgende prompt na goedkeuring

Geen PDF-prompt meer nodig. Remaining functional prompt: e-mailprovider zonder echte verzending totdat apart goedgekeurd.

---

## Beslissing 2 — Productiemigratie en overstap

### Wat dit mogelijk maakt

De applicatie draait op de productieserver met de volledige migratiescyclus toegepast op de productiedatabase. Zie `docs/PRODUCTION_CUTOVER_PLAN_NL.md` voor het volledige stappenplan.

### Wat geblokkeerd blijft zonder goedkeuring

De applicatie blijft lokaal; geen productiegebruikers kunnen inloggen of gegevens invoeren.

### Veiligheidschecks vóór uitvoering

- [ ] Back-up van de productiedatabase gemaakt (zie §2 van het cutoverplan).
- [ ] Geheimen geroteerd (database-URL, Clerk-sleutels, Resend-API-sleutel).
- [ ] PostgreSQL-versie op productieserver bevestigd (zie Beslissing 5).
- [ ] `prisma migrate status` op de productiedatabase toont geen conflicten.
- [ ] Dry-run migratie geslaagd (zie §5 van het cutoverplan).
- [ ] Live backup/restore rehearsal geslaagd (zie Beslissing 6).

### Terugrolregel

Als de migratie mislukt: herstel de productiedatabase vanuit de back-up. Zie §10 van `docs/PRODUCTION_CUTOVER_PLAN_NL.md`. Leg de reden vast in `docs/finance-rebuild-run.md`.

### Beslissing

- [ ] **Goedgekeurd** — ga verder met `docs/PRODUCTION_CUTOVER_PLAN_NL.md`
- [ ] **Uitgesteld** — applicatie blijft lokaal

### Volgende prompt na goedkeuring

```
Voer de productieoverstap uit zoals beschreven in docs/PRODUCTION_CUTOVER_PLAN_NL.md.
Bevestig: geen force-push, geen .env-wijzigingen in Git, geen owner-bestanden in Git.
```

---

## Beslissing 3 — Historische productie-import (2024/2025/2026)

### Wat dit mogelijk maakt

Het laden van de werkelijke historische transacties uit de bestanden `YA financieel jaar 2024.xlsx`, `YA financieel jaar 2025 v2.xlsx`, en de 2026 ING CSV/PDF in de productiedatabase. Dit is de basis voor reconciliatie en rapportage van historische periodes.

### Wat geblokkeerd blijft zonder goedkeuring

De applicatie bevat geen historische boekingen. Maandelijkse import van nieuwe transacties werkt wel, maar zonder historisch saldo-verloop.

### Veiligheidschecks vóór uitvoering

- [ ] Productiemigratie is voltooid (Beslissing 2 goedgekeurd).
- [ ] Dry-run van de historische import geslaagd (verwachte aantallen: 268 rijen 2024, 413 rijen 2025, 221 rijen 2026).
- [ ] Slotcontroles kloppen: 2024 sluit op EUR 12.184,15; 2025 op EUR 10.350,86; 2026-YTD op EUR 7.837,25.
- [ ] Operator bevestigt exact bericht: "Dry-run geslaagd, geen productiewijzigingen."
- [ ] Bevestig dat originele bronbestanden buiten Git blijven.

### Terugrolregel

Als de import onjuiste aantallen of saldobedragen oplevert: herstel de database vanuit back-up. Herhaal dry-run om de oorzaak te analyseren.

### Beslissing

- [ ] **Goedgekeurd** — voer import uit na dry-run-acceptatie
- [ ] **Uitgesteld** — start met nieuwe maandelijkse transacties zonder historisch saldo

### Volgende prompt na goedkeuring

```
Voer de historische import uit voor 2024, 2025, en 2026 YTD via de
owner-approved rehearsal adapter. Bevestig: aantallen en slotcontroles
kloppen, geen ruw-data commit, geen push voor eigenaargoedkeuring.
```

---

## Beslissing 4 — Echte e-mailverzending (Resend-provider)

### Wat dit mogelijk maakt

Het daadwerkelijk verzenden van maandelijkse en jaarlijkse rapporten per e-mail via de Resend API. Momenteel wordt alleen metadata opgeslagen (status PENDING); er wordt geen e-mail verzonden.

### Wat geblokkeerd blijft zonder goedkeuring

Rapporten kunnen worden goedgekeurd en dispatch-metadata kan worden aangemaakt, maar ontvangers ontvangen geen e-mail.

### Veiligheidschecks vóór uitvoering

- [ ] Een Resend-account is aangemaakt en het domein is geverifieerd.
- [ ] `RESEND_API_KEY` is ingesteld in de productie-omgevingsvariabelen (niet in Git).
- [ ] Testmail verzonden naar intern adres en ontvangen.
- [ ] Controleer dat de API-sleutel niet in broncode of logbestanden terechtkomt.

### Terugrolregel

Als e-mailverzending mislukt of ongewenste ontvangers bereikt: deactiveer de API-sleutel onmiddellijk in het Resend-dashboard.

### Beslissing

- [ ] **Goedgekeurd** — configureer `RESEND_API_KEY` en activeer verzending
- [ ] **Uitgesteld** — metadata-opslag is voldoende voor nu

### Volgende prompt na goedkeuring

```
Activeer echte e-mailverzending via Resend. RESEND_API_KEY is geconfigureerd
in productie-omgevingsvariabelen. Update de dispatch-service om de API aan
te roepen. Verifieer: geen sleutel in Git, testmail ontvangen, tests slagen.
```

---

## Beslissing 5 — PostgreSQL-productieversie bevestigen

### Wat dit mogelijk maakt

Zekerheid dat de productiedatabase compatibel is met Prisma 6.x en de actieve migratieketen.

### Wat geblokkeerd blijft zonder bevestiging

Productieoverstap kan niet veilig worden uitgevoerd totdat de versie is geverifieerd.

### Veiligheidschecks vóór uitvoering

- [ ] Log in op de hostingprovider en controleer de PostgreSQL-versie.
- [ ] Verifieer dat `docs/INFRASTRUCTURE_READINESS.md` §PostgreSQL-versie overeenstemt met de productieversie.
- [ ] Controleer de Prisma 6.x compatibiliteitsmatrix voor de gevonden versie.

### Beslissing

- [ ] **Bevestigd** — productieversie is PostgreSQL `_____` (versienummer invullen)
- [ ] **Nog te controleren**

### Volgende prompt na bevestiging

```
Bevestig in docs/INFRASTRUCTURE_READINESS.md dat productie PostgreSQL versie
[versienummer] draait en compatibel is met Prisma 6.x.
```

---

## Beslissing 6 — Live lokale backup/restore rehearsal

### Wat dit mogelijk maakt

Zekerheid dat de backup- en herstelprocedure werkt voordat productiedata afhankelijk worden van de applicatie.

### Wat geblokkeerd blijft zonder bevestiging

Er is geen bewijs dat een productiedatabaseback-up daadwerkelijk herstelbaar is.

### Veiligheidschecks vóór uitvoering

- [ ] Lokale PostgreSQL-tools (`pg_dump`, `pg_restore`, `psql`) zijn geïnstalleerd.
- [ ] Een lokale PostgreSQL-instantie draait op `127.0.0.1` of `localhost`.
- [ ] Controleer dat `DATABASE_URL` in de lokale omgeving naar `localhost` wijst (niet naar productie).
- [ ] Lees `docs/BACKUP_RESTORE_REHEARSAL_NL.md` vóór uitvoering.

### Terugrolregel

Als de rehearsal mislukt: herstel de disposable databases handmatig (`DROP DATABASE yaf_rehearsal_*`) en analyseer de foutmelding. Productie wordt nooit aangeraakt door dit script.

### Beslissing

- [ ] **Geslaagd** — live rehearsal succesvol uitgevoerd op `_______` (datum)
- [ ] **Nog niet uitgevoerd**

### Volgende prompt na bevestiging

```
Voer de live backup/restore rehearsal uit:
node scripts/backup-restore-rehearsal.mjs
Bevestig: dump-bestandsgrootte > 0, herstel geslaagd, prisma validate geslaagd,
disposable databases verwijderd.
```

---

## Beslissing 7 — Geen push vóór finale eigenaargoedkeuring

### Toestand

Alle commits staan lokaal op branch `main`. Er is niets gepusht naar de remote.

### Vereiste bevestiging

- [ ] **Bevestigd** — de eigenaar is op de hoogte dat er niet gepusht wordt totdat alle vereiste beslissingen zijn genomen en de eigenaar expliciet goedkeuring geeft voor de push.

---

## Beslissing 8 — Geheimen geroteerd vóór productie

### Toestand

Lokale placeholder-credentials zijn in gebruik (`local_dev_placeholder`). Productiecredentials mogen nooit dezelfde zijn als de lokale placeholders.

### Uitgevoerde acties (2026-07-07 t/m 2026-07-08)

- [x] Nieuw sterk wachtwoord gegenereerd voor `finance_user` op de productiedatabase (2026-07-07)
- [x] Clerk Secret Key geroteerd en toegepast op Dokploy runtime (2026-07-08)
- [x] Resend API Key geroteerd en toegepast op Dokploy runtime (2026-07-08)
- [x] New Relic License Key geroteerd en toegepast op Dokploy runtime (2026-07-08)
- [x] Request Access Secret gegenereerd (2026-07-08)
- [x] Alle geheimen opgeslagen in Dokploy omgevingsvariabelen — buiten Git

### Status

- [x] **Bevestigd** — alle productiegeheimen zijn geroteerd en opgeslagen buiten Git (2026-07-08)
- [ ] Nog te doen (alleen operator-deferred rotatie voor volgende sessie)

---

## Overzichtstabel (bijgewerkt 2026-07-09)

| # | Beslissing | Status |
|---|-----------|--------|
| 1 | PDF-renderer afhankelijkheid | ✅ AFGEROND 2026-07-08 |
| 2 | Productiemigratie en overstap | ✅ AFGEROND 2026-07-07 |
| 3 | Historische productie-import | ✅ AFGEROND 2026-07-07 |
| 4 | Echte e-mailverzending | ✅ AFGEROND 2026-07-08 |
| 5 | PostgreSQL-productieversie bevestigd | ✅ AFGEROND 2026-07-07 |
| 6 | Live backup/restore rehearsal | ✅ GESLAAGD 2026-07-05 |
| 7 | Geen push vóór goedkeuring | ✅ BEWAKT — commit f2f7cbb gepubliceerd op origin/main |
| 8 | Geheimen geroteerd | ✅ AFGEROND 2026-07-08 (incl. app/provider secrets) |
