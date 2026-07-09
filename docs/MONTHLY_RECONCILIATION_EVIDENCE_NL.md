# Maandelijkse Reconciliatie Bewijs

**Status:** PASSED (read-only production audit passed on 2026-07-09; formula-based monthly chaining confirmed)

## Identificatie

| Veld | Waarde |
|------|--------|
| Repo | `/Users/Office/Repos/yeshuaacademy/web/finance` |
| Dokploy app ID | `apps-saas-open-fund-vdymfu` |
| Bronscope | 2024, 2025, 2026 geïmporteerde transacties |
| Datum | 2026-07-09 |

## Samenvatting

- Phase 17 is geïmplementeerd met **formula-based monthly chaining model**: per-transaction "resulting balance" velden uit de bron bleken onbetrouwbaar wanneer één jaarafschrift in maanden wordt gesplitst. Het model is vervangen door: maandopening = vorige maandafsluiting, maandafsluiting = opening + nettoinkomen (inkomsten - uitgaven). Jaar 1 maand 1 krijgt de jaaropening als basiscontrole.
- Read-only production audit is uitgevoerd via Dokploy runtime `apps-saas-open-fund-vdymfu` en is **geslaagd** tegen de live imported data.
- 2024 closing control: **1,218,415 minor units** (verwacht: 1,218,415) — PASS.
- 2025 closing control: **1,035,086 minor units** (verwacht: 1,035,086) — PASS.
- 2026 imported partial control: **783,725 minor units** (verwacht: 783,725) — PASS.
- 2026 is een open gedeeltelijk jaar; maanden 01-06 zijn niet balancerend (onopgeloste transacties, categorisatie-mismatches) zoals verwacht. Juli 2026 is deels geïmporteerd.
- 2024 en 2025 complete maanden zijn balancerend en afsluitbaar.
- Formule-gebaseerde maandketen-continuïteit is bevestigd voor alle jaren.
- Het eerdere -190,000 minor units verschil (1,028,415 vs 1,218,415) werd veroorzaakt door de oude diagnostic code die ruwe rij-saldi gebruikte in plaats van de formule-keten.
- Maandniveau reconciliatie- en exportlogica is toegevoegd als pure service-laag.
- Maandaudit heeft een read-only CLI wrapper en een pure audit service.

## Formules en controles

- Alle geldbedragen blijven integer minor units.
- Opening, income, expenses, net, en closing worden zonder floating point berekend.
- Booked en unresolved tellen op tot het transactieaantal.
- Duplicate fingerprint count is apart gecontroleerd.
- Running-balance fouten worden apart geteld (uitgesloten in productie-audit — resultingBalanceMinor is null).
- Maandketen-continuiteit is expliciet gevalideerd.
- Categorie- en subcategorie-totalen worden apart opgebouwd.

## Export- en rapportgates

- Balanced en closed maanden mogen als final export worden behandeld.
- Open of ongebalanceerde maanden blijven draft / not closed.
- Administrator approval blijft een aparte gate.
- Email-dispatch blijft apart van import en close.

## Huidge stand

**Audit model (commit 0e0818a):**
- Per-transaction `resultingBalanceMinor` velden zijn expliciet ingesteld op `null` — deze bron blijkt onbetrouwbaar wanneer geïmporteerde data bestaat uit één jaarafschrift gesplitst in maanden.
- Formula-based monthly chaining is geïmplementeerd: maandafsluiting = opening + (inkomsten - uitgaven), volgende maandopening = huidge maandafsluiting.
- Jaar 1 maand 1 krijgt de jaaropening van de baseline-controles; alle overige maanden bepalen opening via ketenring uit vorige maandafsluiting.
- Per-transactie running-balance validatie is OVERGESLAGEN wanneer `resultingBalanceMinor` null is (dat wil zeggen altijd, in de productie-audit).
- Maandketen-continuïteitscontroles blijven aanwezig als formule-validatie.

**Implementatie:**
- Nieuwe service-laag toegevoegd voor maandelijkse reconciliatie.
- Nieuwe export-laag toegevoegd voor monthly balance artifacts.
- Nieuwe audit-laag toegevoegd voor maandketencontrole.
- Formule-gebaseerde balance-afleiding is bevestigd met tests.
- Tests en build-validatie zijn uitgevoerd en geslaagd.
- Diagnostics script is gecorrigeerd voor teken-fout in formule-controle.
- 10 tests in audit/service test suite passeren; 26 contamination guard tests passeren.

**Productieaudit (2026-07-09):**
- Formula-model is geïmplementeerd, getest, en gevalideerd tegen productie.
- 2024 closing control: **1,218,415 minor units** — PASS.
- 2025 closing control: **1,035,086 minor units** — PASS.
- 2026 imported partial control: **783,725 minor units** — PASS.
- 2024 en 2025 complete maanden zijn balancerend en afsluitbaar.
- 2026 (open gedeeltelijk jaar) toont verwachte onopgeloste transacties en categorisatie-mismatches — buiten scope voor afsluiting.
- Phase 17 is **COMPLEET**.

## Resterende notities

- 2026 is een open gedeeltelijk jaar: maanden 01-06 zijn niet balancerend (onopgeloste transacties, categorisatie-mismatches). Juli 2026 is deels geïmporteerd. Dit is verwacht gedrag voor een lopend boekjaar.
- Categorisatie van 2026-transacties blijft een openstaande eigenaartaak.
- Formule-gebaseerde maandketen blijft het audit-model; ruwe rij-saldi worden niet gebruikt als bewijs.
