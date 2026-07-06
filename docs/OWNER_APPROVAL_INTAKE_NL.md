# Yeshua Academy Finance — Owner approval intake

Status: template — geen goedkeuring geregistreerd in Git
Taal: Nederlands

## Doel

Deze checklist legt vast welke eigenaarsbeslissing buiten Git moet zijn goedgekeurd voordat een owner-gated actie mag worden uitgevoerd. Dit document bevat geen geheimen, geen productiehostnamen, geen owner-bestanden en geen transactierijen.

## 1. Welke beslissing is goedgekeurd?

Kies exact één beslissing:

- [ ] `pdf` — echte PDF-renderer kiezen en implementeren
- [ ] `production-cutover` — productiecutover voorbereiden of uitvoeren
- [ ] `historical-import` — historische productie-import met owner-bestanden buiten Git
- [ ] `email` — echte e-mailprovider configureren en verzenden toestaan
- [ ] `push` — remote publish toestaan
- [ ] `secret-rotation` — geheimen roteren buiten Git
- [ ] `postgres-version` — PostgreSQL-productieversie bevestigen

## 2. Wie heeft goedgekeurd?

- Naam/rol eigenaar: ______________________________
- Datum/tijd goedkeuring: __________________________
- Communicatiekanaal buiten Git: ____________________

## 3. Scope van goedkeuring

Beschrijf precies wat wel is goedgekeurd:

```text
<scope hier invullen buiten Git vóór uitvoering>
```

## 4. Expliciet niet goedgekeurd

Vink alles aan wat buiten scope blijft:

- [ ] Productiecutover
- [ ] Historische productie-import
- [ ] Echte e-mailverzending
- [ ] PDF-dependency installeren
- [ ] Push naar remote
- [ ] Tags maken
- [ ] Secret-rotatie
- [ ] Owner-bronbestanden in Git plaatsen
- [ ] Databasedumps of ruwe transactiedumps committen

## 5. Vereiste preflight

Voer vóór uitvoering minimaal uit:

```bash
node scripts/owner-go-no-go-preflight.mjs --strict
node scripts/owner-decision-preflight.mjs --decision <decision>
node scripts/owner-approved-action-plan.mjs --decision <decision>
npm run validate:release-candidate
```

Voor push ook:

```bash
node scripts/push-readiness-preflight.mjs --strict
```

## 6. Stopregels

Stop onmiddellijk wanneer één van deze punten geldt:

- De goedkeuring is onduidelijk of te breed.
- De worktree bevat andere wijzigingen dan `.graphifyignore` of `graphify-out/`.
- Een commando vraagt om productie, Dokploy, MCP bridge, `10.0.2.4`, externe provider of geheimen.
- Een owner-bestand, ruwe transactiedump, databasedump of `.env` zou in Git komen.
- Validatie faalt en één bounded repair lost het niet op.
- De actie valt buiten de hierboven gekozen beslissing.

## 7. Rollbackplan

- Revert nieuwe commits wanneer validatie of review faalt.
- Geen force-push.
- Geen gedeelde geschiedenis herschrijven.
- Geen productieherstel zonder apart goedgekeurd rollback-plan.

## 8. Evidence terugrapporteren

Rapporteer na uitvoering:

1. Branch en startcommit.
2. Exacte goedgekeurde beslissing.
3. Uitgevoerde preflights.
4. Gemaakte commits.
5. Validatie-uitkomsten.
6. Wat niet is uitgevoerd.
7. Finale `git status --short`.
8. Bevestiging dat geen geheimen, owner-bestanden, dumps of ongeautoriseerde productieacties zijn gebruikt.

## 9. Geheime gegevens en owner-bestanden

- Plak nooit geheimen in Git, docs, tests, prompts of output.
- Owner Excel/CSV/PDF-bestanden blijven buiten Git.
- Ruwe transactierijen blijven buiten Git.
- Productiehostnamen en credentials blijven buiten Git.
