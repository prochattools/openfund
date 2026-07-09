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

- Phase 17 is lokaal geïmplementeerd als transaction-derived maandcontrole.
- Read-only production audit is uitgevoerd via Dokploy runtime `apps-saas-open-fund-vdymfu` en is gefaald tegen de live imported data.
- 2024 closing control faalde: verwacht 1,218,415 minor units, aangetroffen 1,028,415 minor units (verschil -190,000 minor units).
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

## Huidige stand

- Nieuwe service-laag toegevoegd voor maandelijkse reconciliatie.
- Nieuwe export-laag toegevoegd voor monthly balance artifacts.
- Nieuwe audit-laag toegevoegd voor maandketencontrole.
- Transactie-gedreven raw-row balansafleiding is bevestigd met tests.
- Reactieve fout voor de bekende partial juli 2026-maand is nu expliciet toegestaan in de auditlaag.
- Tests en build-validatie zijn uitgevoerd en geslaagd.

## Resterende blockers

- Read-only productieaudit faalde tegen runtime data; remediation en heruitvoering nodig
- Phase 17 blijft open
- Running-balance, maandketen, en 2026-onopgeloste-transactie fouten moeten worden onderzocht
