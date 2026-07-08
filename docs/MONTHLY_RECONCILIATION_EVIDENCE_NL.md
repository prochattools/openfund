# Maandelijkse Reconciliatie Bewijs

**Status:** IMPLEMENTED (local code and tests complete; read-only production verification pending)

## Identificatie

| Veld | Waarde |
|------|--------|
| Repo | `/Users/Office/Repos/yeshuaacademy/web/finance` |
| Dokploy app ID | `apps-saas-open-fund-vdymfu` |
| Bronscope | 2024, 2025, 2026 geïmporteerde transacties |
| Datum | 2026-07-08 |

## Samenvatting

- Phase 17 is lokaal geïmplementeerd als transaction-derived maandcontrole.
- Maandniveau reconciliatie- en exportlogica is toegevoegd als pure service-laag.
- Maandaudit gebruikt transactie-evidence per maand en behandelt de bekende open juli 2026-maand als partial/incomplete zonder full-month failure.
- Maandaudit heeft een read-only CLI wrapper en een pure audit service.
- Tests en build-validatie zijn uitgevoerd; geen productie-mutatie is uitgevoerd in deze stap.

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

- Read-only productie-verificatie met expliciet veilige runtime `DATABASE_URL`
- Eventuele vervolgafstemming over live productie-audituitvoering
