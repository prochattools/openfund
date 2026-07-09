# Maandelijkse Reconciliatie Bewijs

**Status:** FAILED (local code and tests complete; read-only production audit failed on 2026-07-09)

## Identificatie

| Veld | Waarde |
|------|--------|
| Repo | `/Users/Office/Repos/yeshuaacademy/web/finance` |
| Dokploy app ID | `apps-saas-open-fund-vdymfu` |
| Bronscope | 2024, 2025, 2026 geïmporteerde transacties |
| Datum | 2026-07-09 |

## Samenvatting

- Phase 17 is lokaal geïmplementeerd met **formula-based monthly chaining model** (commit 9ccec95): per-transaction "resulting balance" velden uit de bron bleken onbetrouwbaar wanneer één jaarafschrift in maanden wordt gesplitst. Het model is vervangen door: maandopening = vorige maandafsluiting, maandafsluiting = opening + nettoinkomen (inkomsten - uitgaven). Jaar 1 maand 1 krijgt de jaaropening als basiscontrole.
- Read-only production audit is uitgevoerd via Dokploy runtime `apps-saas-open-fund-vdymfu` en is gefaald tegen de live imported data.
- 2024 closing control faalde: verwacht 1,218,415 minor units, aangetroffen 1,028,415 minor units (verschil -190,000 minor units). Dit verschil bleef bestaan na commit 9ccec95, wat duidt op een ander onderliggend probleem dan de balance-parsing.
- 2025 en 2026 imported partial year controls kwamen overeen met de baseline, maar running-balance fouten, maandketenbreuken, onopgeloste 2026-transacties en category/subcategory-mismatches blijven aanwezig.
- Maandniveau reconciliatie- en exportlogica is toegevoegd als pure service-laag.
- Maandaudit heeft een read-only CLI wrapper en een pure audit service.
- Tests en build-validatie zijn uitgevoerd; de productie-verificatie zelf is gefaald.

## Formules en controles

- Alle geldbedragen blijven integer minor units.
- Opening, income, expenses, net, en closing worden zonder floating point berekend.
- Booked en unresolved tellen op tot het transactieaantal.
- Duplicate fingerprint count is apart gecontroleerd.
- Running-balance fouten worden apart geteld.
- Maandketen-continuiteit is expliciet gevalideerd.
- Categorie- en subcategorie-totalen worden apart opgebouwd.

## Export- en rapportgates

- Balanced en closed maanden mogen als final export worden behandeld.
- Open of ongebalanceerde maanden blijven draft / not closed.
- Administrator approval blijft een aparte gate.
- Email-dispatch blijft apart van import en close.

## Huidge stand

**Audit model (commit 9ccec95):**
- Per-transaction `resultingBalanceMinor` velden zijn expliciet ingesteld op `null` — deze bron blijkt onbetrouwbaar wanneer geïmporteerde data bestaat uit één jaarafschrift gesplitst in maanden.
- Formula-based monthly chaining is geïmplementeerd: maandafsluiting = opening + (inkomsten - uitgaven), volgende maandopening = huidge maandafsluiting.
- Jaar 1 maand 1 krijgt de jaaropening van de baseline-controles; alle overige maanden bepalen opening via ketenring uit vorige maandafsluiting.
- Per-transactie running-balance validatie is OVERGESLAGEN wanneer `resultingBalanceMinor` null is (dat wil zeggen altijd, in de productie-audit).
- Maandketen-continuïteitscontroles blijven aanwezig als formule-validatie.

**Implementatie:**
- Nieuwe service-laag toegevoegd voor maandelijkse reconciliatie.
- Nieuwe export-laag toegevoegd voor monthly balance artifacts.
- Nieuwe audit-laag toegevoegd voor maandketencontrole.
- Formule-gebaseerde balance-afleiding is bevestigd met tests (test fixed in commit 9ccec95, latere test suite).
- Reactieve fout voor de bekende partial juli 2026-maand is nu expliciet toegestaan in de auditlaag.
- Tests en build-validatie zijn uitgevoerd en geslaagd.

**Productieaudit (2026-07-09):**
- Formula-model werd geïmplementeerd en getest lokaal.
- Maar productieaudit faalde met dezelfde 190K-error in 2024 closing balance, wat duidt op een ander onderliggend probleem dan balance-parsing.
- Phase 17 blijft open totdat de onderliggende oorzaak wordt gevonden en opgelost.

## Resterende blockers

- Read-only productieaudit faalde tegen runtime data; remediation en heruitvoering nodig
- Phase 17 blijft open
- Running-balance, maandketen, en 2026-onopgeloste-transactie fouten moeten worden onderzocht
