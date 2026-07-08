# Yeshua Academy Finance — Productiebewijs app/provider geheimremediatie

Status: App/provider geheimremediatie voltooid
Branch: main
Startcommit: abd8ddd
Datum: 2026-07-08
Taal: Nederlands

---

## 1. Aanleiding

Niet-database applicatiegeheimen verschenen eerder in Dokploy-omgevingsoutput. De eigenaar heeft goedgekeurd om deze categorieën te roteren en toe te passen op de Dokploy runtime.

## 2. Categoriestatus

| Categorie | Status |
|-----------|--------|
| Clerk Secret Key | Geroteerd en toegepast op Dokploy runtime |
| Resend API Key | Geroteerd en toegepast op Dokploy runtime |
| New Relic License Key | Geroteerd en toegepast op Dokploy runtime |
| Request Access Secret | Gegenereerd en toegepast in commit abd8ddd |
| Shadow database runtime credential | Al afgedekt door database credential finalisatie; aanwezigheid en doelvorm opnieuw gecontroleerd |

## 3. Runtime en verificatie

| Controle | Status |
|----------|--------|
| Dokploy runtime-omgeving bijgewerkt | BEVESTIGD |
| Applicatie redeploy getriggerd | BEVESTIGD |
| App health gecontroleerd | BEVESTIGD — status ok |
| Productie readiness totalen gecontroleerd | BEVESTIGD |
| Productie database | finance |
| Productie schema | finance |
| Databasegebruiker | finance_user |
| Poort | 5433 |

## 4. Productie-readiness totalen

| Controle | Verwacht | Geverifieerd |
|----------|----------|--------------|
| Werkruimten | 1 | GESLAAGD |
| Bronbestanden | 4 | GESLAAGD |
| Bankafschriften | 3 | GESLAAGD |
| Afschriftperioden | 3 | GESLAAGD |
| Transacties | 902 | GESLAAGD |
| Boekingen | 681 | GESLAAGD |
| Open/gedeeltelijke perioden | 1 | GESLAAGD |
| Dubbele vingerafdrukken | 0 | GESLAAGD |

### Per periode

| Jaar | Transacties | Opening EUR | Inkomsten EUR | Uitgaven EUR | Sluiting EUR | Status |
|------|-------------|-------------|---------------|--------------|--------------|--------|
| 2024 | 268 | 1.721,86 | 32.267,19 | 21.804,90 | 12.184,15 | COMPLETE |
| 2025 | 413 | 12.184,15 | 91.642,44 | 93.475,73 | 10.350,86 | COMPLETE |
| 2026 | 221 | 10.350,86 | 58.784,08 | 61.297,69 | 7.837,25 | PARTIAL — niet afgesloten |

## 5. Veiligheidsbevestigingen

| Controle | Status |
|----------|--------|
| Geen geheimwaarden vastgelegd | BEVESTIGD |
| Geen verbindingsstrings vastgelegd | BEVESTIGD |
| Geen hostnamen vastgelegd | BEVESTIGD |
| Geen providerpayloads vastgelegd | BEVESTIGD |
| Geen eigenaar-bestanden gekopieerd | BEVESTIGD |
| Geen ruwe transactierijen vastgelegd | BEVESTIGD |
| Geen databasedumps vastgelegd | BEVESTIGD |
| Geen .env gewijzigd | BEVESTIGD |
| Geen echte e-mail verzonden | BEVESTIGD |
| Geen PDF-afhankelijkheid toegevoegd | BEVESTIGD |
| Geen tags aangemaakt | BEVESTIGD |
| Geen force push | BEVESTIGD |

## 6. Resterende blockers

| Blocker | Status |
|---------|--------|
| Echte PDF-renderer | Geblokkeerd — niet uitgevoerd in deze run |
| Echte e-mailverzending | Geblokkeerd — niet uitgevoerd in deze run |
