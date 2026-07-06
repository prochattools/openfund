# Yeshua Academy Finance — Owner go/no-go preflight

Status: Release Candidate 4 — lokale eigenaarsbeoordeling
Datum: 2026-07-05
Taal: Nederlands

## Doel

Dit document beschrijft de laatste lokale preflight vóór eigenaarsbeoordeling. De preflight bevestigt alleen repository- en documentatiestatus. Het voert geen databasecommando's, productieacties, externe provider-calls, historische import, push, tag of dependency-installatie uit.

## Commando

```bash
node scripts/owner-go-no-go-preflight.mjs
```

Optionele machineleesbare uitvoer:

```bash
node scripts/owner-go-no-go-preflight.mjs --json
```

Strikte lokale gate:

```bash
node scripts/owner-go-no-go-preflight.mjs --strict
```

## Wat wordt gecontroleerd

| Controle | Verwacht |
|----------|----------|
| Branch | `main` |
| Release manifest | `Release Candidate 4` |
| Eigenaarsdocumenten | Alle vereiste overdrachtsdocumenten aanwezig |
| Beslissing-preflight | `node scripts/owner-decision-preflight.mjs --decision <keuze>` blijft local-only |
| Push-readiness | `node scripts/push-readiness-preflight.mjs --strict` publiceert niets |
| Worktree scope | Alleen `.graphifyignore` en `graphify-out/` mogen ongetrackt/dirty zijn |
| Productieblockers | Productiemigratie, Historische productie-import, PDF, Echte e-mail, PostgreSQL-versie blijven expliciet |
| Push/productie | Geblokkeerd tot eigenaargoedkeuring; Push en Geheimen blijven expliciete blockers |

## Interpreteer de uitkomst

| Uitkomst | Betekenis |
|----------|-----------|
| `GO_FOR_OWNER_REVIEW` | De lokale overdracht is klaar voor eigenaarsbeoordeling. Dit is geen toestemming om te pushen of productie aan te raken. |
| `NO_GO` | Los de gemelde documentatie- of worktree-afwijking op voordat de eigenaar beoordeelt. |

## Bevestigingen

- Geen productie, Dokploy, MCP bridge of `10.0.2.4` wordt gebruikt.
- `.env` wordt niet gelezen of gewijzigd.
- Er wordt geen databaseverbinding geopend.
- Er wordt geen e-mail of externe provider aangeroepen.
- Er is geen push zonder expliciete eigenaargoedkeuring.
- Er wordt niet gepusht en er wordt geen tag gemaakt.
- Er wordt geen historische productie-import uitgevoerd.
- Er wordt geen PDF-bibliotheek toegevoegd.
- `.graphifyignore` en `graphify-out/` blijven uitgesloten van commits.
