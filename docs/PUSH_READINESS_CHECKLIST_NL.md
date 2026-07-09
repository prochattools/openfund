# Yeshua Academy Finance — Push readiness checklist

Status: Release Candidate 7 — alle productiehardeningsstappen afgerond 2026-07-08; geen push zonder eigenaargoedkeuring
Datum: 2026-07-05 (bijgewerkt 2026-07-09)
Taal: Nederlands

## Doel

Deze checklist is de laatste handmatige controle vóór een toekomstige `git push`. Dit document geeft geen toestemming om te pushen. Een push mag alleen na expliciete eigenaargoedkeuring.

## Vereiste lokale controles

- [ ] Branch is `main`.
- [ ] `git status --short` toont alleen toegestane Graphify-artifacts (`.graphifyignore`, `graphify-out/`) of is volledig schoon.
- [ ] `docs/RELEASE_MANIFEST_NL.md` is gelezen en wijst naar de bedoelde lokale release-evidence commit.
- [ ] `docs/OWNER_ACCEPTANCE_CHECKLIST_NL.md` is gelezen en accepteert geen push.
- [ ] `docs/OWNER_DECISION_MENU_NL.md` is gelezen en wijst push aan als aparte owner-gated beslissing.
- [ ] `node scripts/owner-go-no-go-preflight.mjs --strict` slaagt.
- [ ] `node scripts/push-readiness-preflight.mjs --strict` slaagt.
- [ ] `node scripts/final-docs-consistency-audit.mjs` slaagt.
- [ ] `node scripts/final-owner-review-preflight.mjs --check` slaagt.
- [ ] `npm run validate:release-candidate` slaagt.
- [ ] `git diff --check` slaagt.
- [ ] Er zijn geen `.env`-wijzigingen.
- [ ] Er zijn geen owner Excel/CSV/PDF-bronbestanden in Git geplaatst.
- [ ] Er zijn geen ruwe transactiedumps of databasedumps in Git geplaatst.
- [ ] Er zijn geen nieuwe dependencies buiten de goedgekeurde PDF-renderer toegevoegd.
- [ ] Er is geen historische productie-import uitgevoerd (AFGEROND 2026-07-07).
- [ ] Echte e-mailverzending is afgerond (begrensde verificatie 2026-07-08).
- [ ] Er is geen productie, Dokploy, MCP bridge of `10.0.2.4` gebruikt.

## Vereiste eigenaarsbeslissingen

- [ ] Eigenaar heeft de release manifest gelezen.
- [ ] Eigenaar heeft de eigenaaroverdracht gelezen.
- [ ] Eigenaar heeft het beslissingspakket gelezen.
- [ ] Push blijft geblokkeerd tot expliciete eigenaargoedkeuring.
- [ ] Geheimen blijven buiten Git.
- [ ] Eigenaar geeft expliciet toestemming voor de push.
- [ ] Alle productiehardeningsstappen zijn afgerond (zie docs).

## Commando's voor toekomstige operator

```bash
git status --short --branch
node scripts/owner-go-no-go-preflight.mjs --strict
node scripts/push-readiness-preflight.mjs --strict
npm run validate:release-candidate
git diff --check
```

Pas daarna, en alleen met eigenaargoedkeuring:

```bash
git push
```

## Stopcondities

Stop en push niet wanneer één van de volgende zaken waar is:

- `git status --short` toont andere wijzigingen dan toegestane Graphify-artifacts.
- De preflight geeft `NO_GO`.
- Tests, builds, Prisma-validatie, backup dry-run of whitespace-check falen.
- Er is twijfel over productiecredentials, owner-bestanden, dumps, of externe provider-calls.
- De eigenaar heeft push niet expliciet goedgekeurd.

## Bevestiging huidige RC4

Tijdens het opstellen van deze checklist:

- Er is niet gepusht.
- Er is geen tag gemaakt.
- Er is geen productie of externe provider aangeraakt.
- `.env`, `.graphifyignore`, en `graphify-out/` zijn niet gewijzigd door deze checklist.
