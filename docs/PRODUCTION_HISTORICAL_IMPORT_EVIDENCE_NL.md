# Productie Historische Import — Bewijs

**Status:** Productie historische import voltooid op 2026-07-07.

## Identificatie

| Veld | Waarde |
|------|--------|
| Branch | main |
| Startcommit | de37a66 |
| Productie database | finance |
| Productie schema | finance |
| PostgreSQL server versie | 15.8 |
| Datum | 2026-07-07 |

## Geïmporteerde scope

- 2024 afgesloten werkboek
- 2025 afgesloten werkboek
- 2026 gedeeltelijk open afschrift (t/m 2026-07-01)

## Bronbestand-hashes (SHA-256)

| Rol | Hash |
|-----|------|
| Afgesloten werkboek 2024 | `844699610889c6986fec305cdbb7b760da3dfc1d556ab9d0e160c854e1bc7f9f` |
| Afgesloten werkboek 2025 | `d3913b876f3a6b8ddc3d19c49ef9778125e5e109a7d3ac330afbb3d6d8d7b2ff` |
| Open afschrift CSV 2026 | `768912927a7bb3b545616631e6d5360479a90b0bc6448faa3f225925636d31d3` |
| Open afschrift PDF 2026 | `5e830a365fe0d87f67e883f24239f60674ed85a174e65db6520136511a6d58d2` |

## Controle-totalen (exact geverifieerd)

| Periode | Transacties | Openingssaldo | Inkomsten | Uitgaven | Sluitingssaldo |
|---------|-------------|--------------|-----------|---------|---------------|
| 2024 (afgesloten) | 268 | EUR 1.721,86 | EUR 32.267,19 | EUR 21.804,90 | EUR 12.184,15 |
| 2025 (afgesloten) | 413 | EUR 12.184,15 | EUR 91.642,44 | EUR 93.475,73 | EUR 10.350,86 |
| 2026 (gedeeltelijk open) | 221 | EUR 10.350,86 | EUR 58.784,08 | EUR 61.297,69 | EUR 7.837,25 |

## Productiedatabaseverificatie na import

| Metriek | Resultaat |
|---------|-----------|
| Workspace-telling | 1 |
| Bronbestand-telling | 4 |
| Bankafschrift-telling | 3 |
| Afschriftperiode-telling | 3 |
| Transactie-telling (totaal) | 902 |
| Boeking-telling | 681 |
| Open/gedeeltelijke perioden | 1 (2026, correct) |
| Dubbele vingerafdrukken | 0 |

## 2026 afschrift status

- Dekkingsstatus: `PARTIAL`
- Afsluiting toegestaan: `false`
- 2026 blijft gedeeltelijk/open en is **niet** afgesloten.

## Bevestigingen

- Geen ruwe transactierijen afgedrukt of vastgelegd.
- Geen eigenaarbestanden gekopieerd naar de repo.
- Geen database-dumps aangemaakt.
- Geen backup-bestanden vastgelegd.
- Geen echte e-mail verstuurd.
- Geen PDF-afhankelijkheid toegevoegd.
- Geen geheimrotatie uitgevoerd.
- Geen tags aangemaakt.
- Geen force push gebruikt.
- Verbindingsstring, wachtwoord, host en credentials zijn niet vastgelegd in docs, tests, scripts, commits of logs.
- 2026 afschrift blijft gedeeltelijk/open en is niet afgesloten.

## Resterende blockers

De volgende acties zijn **nog niet uitgevoerd**:

1. **Geheimrotatie** — `finance_user` wachtwoord is verschenen in chatsessie; rotatie vereist vóór langdurig productiegebruik
2. **Echte e-mail** — RESEND_API_KEY aanwezig maar flow niet geactiveerd
3. **Echte PDF-generatie** — geen PDF-afhankelijkheid geïnstalleerd
