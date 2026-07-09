# Yeshua Academy Finance — Productiebewijs geheimrotatie

Status: Productie finance_user credential rotatie voltooid
Branch: main
Startcommit: 4994279
Datum: 2026-07-07
Taal: Nederlands

---

## 1. Beslissing

Eigenaar heeft expliciete goedkeuring verleend voor de rotatie van het blootgestelde finance_user-wachtwoord op 2026-07-07.

## 2. Rotatiestatus

| Controle | Status |
|----------|--------|
| Productie finance_user credential rotatie voltooid | JA |
| Reden rotatie | Vorig finance_user-wachtwoord verscheen in chat/loguitvoer |
| Nieuw wachtwoord gegenereerd in geheugen (crypto.randomBytes) | BEVESTIGD |
| Nieuw wachtwoord nooit naar schijf geschreven | BEVESTIGD |
| Nieuw wachtwoord nooit geprint of gelogd | BEVESTIGD |
| Rotatie uitgevoerd via admin-verbinding (supabase_admin) | BEVESTIGD |
| Oud credential afgewezen na rotatie | BEVESTIGD |
| Nieuw credential connectiviteit geverifieerd | BEVESTIGD |
| Historische totalen geverifieerd na rotatie | BEVESTIGD |

## 3. Productie-identificatie

| Eigenschap | Waarde |
|------------|--------|
| Productie database | finance |
| Productie schema | finance |
| Gebruiker | finance_user |
| Poort | 5433 |
| PostgreSQL-versie | 15.8 |

## 4. Historische totalen geverifieerd na rotatie

| Controle | Verwacht | Geverifieerd |
|----------|----------|--------------|
| Werkruimten | 1 | GESLAAGD |
| Bronbestanden | 4 | GESLAAGD |
| Bankafschriften | 3 | GESLAAGD |
| Afschriftperioden | 3 | GESLAAGD |
| Totaal transacties | 902 | GESLAAGD |
| Boekingen | 681 | GESLAAGD |
| Open/gedeeltelijke perioden | 1 | GESLAAGD |
| Dubbele vingerafdrukken | 0 | GESLAAGD |

### Per periode

| Jaar | Transacties | Opening EUR | Inkomsten EUR | Uitgaven EUR | Sluiting EUR | Status |
|------|-------------|-------------|---------------|--------------|--------------|--------|
| 2024 | 268 | 1.721,86 | 32.267,19 | 21.804,90 | 12.184,15 | COMPLETE |
| 2025 | 413 | 12.184,15 | 91.642,44 | 93.475,73 | 10.350,86 | COMPLETE |
| 2026 | 221 | 10.350,86 | 58.784,08 | 61.297,69 | 7.837,25 | PARTIAL — niet afgesloten |

2026 is een open/gedeeltelijke periode en mag niet worden afgesloten.

## 5. Veiligheidsbevestigingen

| Controle | Status |
|----------|--------|
| Geen database-URL afgedrukt | BEVESTIGD |
| Geen admin-URL afgedrukt | BEVESTIGD |
| Geen wachtwoord afgedrukt | BEVESTIGD |
| Geen hostname afgedrukt | BEVESTIGD |
| Geen credentials vastgelegd in docs, tests, scripts of commits | BEVESTIGD |
| Geen .env gewijzigd | BEVESTIGD |
| Geen productieconfiguratie vastgelegd | BEVESTIGD |
| Geen eigenaar-bronbestanden gekopieerd | BEVESTIGD |
| Geen ruwe transactierijen vastgelegd | BEVESTIGD |
| Geen databasedumps vastgelegd | BEVESTIGD |
| Geen echte e-mail verzonden | BEVESTIGD |
| Geen PDF-afhankelijkheid toegevoegd | BEVESTIGD |
| Geen tags aangemaakt | BEVESTIGD |
| Geen force push | BEVESTIGD |
| Tijdelijk scriptbestand verwijderd na gebruik | BEVESTIGD |

## 6. 2026-07-09 vervolgsessie

| Controle | Status |
|----------|--------|
| Nieuwe Dokploy API key rotatie | NIET UITGEVOERD — operator stelde rotatie uit |
| Nieuwe finance_user wachtwoordrotatie | NIET UITGEVOERD — operator stelde rotatie uit |
| Bestaand credential intact en werkend | BEVESTIGD |
| App redeploy na sessie (commit a23ca94) | BEVESTIGD |
| App health na redeploy | BEVESTIGD — gezond |
| Operator weet dat handmatige API key rotatie via web UI nodig is | BEVESTIGD |

## 7. Functionele status (bijgewerkt 2026-07-09)

| Item | Status |
|------|--------|
| Echte e-mail (e-mailprovider API) | Voltooid 2026-07-08 |
| Echte PDF-renderer | Voltooid 2026-07-08 |

## 8. Vereiste runtime-actie buiten Git

De operator moet de database-verbindings-URL buiten Git bijwerken naar het nieuw gegenereerde finance_user-wachtwoord.
Dit geldt voor alle omgevingen die de productiedatabase gebruiken (applicatieserver, omgevingsvariabelen).

Dit document bevat geen verbindings-URLs, wachtwoorden, hostnamen of providergegevens.
