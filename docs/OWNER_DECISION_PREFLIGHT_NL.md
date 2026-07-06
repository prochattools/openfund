# Yeshua Academy Finance — Eigenaarsbeslissing preflight

Branch: main
HEAD: 9dae30c
Besluitstatus: GEREED VOOR EIGENAARSREVIEW
Goedkeuring buiten Git geregistreerd: NEE

## Guards

- Deze preflight leest geen `.env`.
- Deze preflight gebruikt geen productie, verboden productiehosts, MCP bridge, database, netwerk of externe provider.
- Deze preflight voert geen push, tag, dependency-installatie, e-mailverzending, historische import of secret-rotatie uit.
- Deze preflight schrijft alleen `docs/OWNER_DECISION_PREFLIGHT_NL.md` wanneer `--write` is meegegeven.

## Documentstatus

- Alle 8 vereiste owner-review documenten zijn aanwezig.

## Worktree

- Dirty paths: docs/RELEASE_MANIFEST_NL.md, .graphifyignore, graphify-out/

## Echte PDF-renderer afhankelijkheid

Sleutel: `pdf`
Status: GEBLOKKEERD TOT EIGENAAR PDF-KEUZE GOEDKEURT
Blijft geblokkeerd zonder owner-goedkeuring: JA

### Wat is nu klaar
- HTML- en XLSX-rapporten gebruiken dezelfde gesloten snapshot.
- PDF-placeholder blijft zichtbaar als expliciete blocker.
- Package-safety tests bewaken dat er geen PDF-afhankelijkheid stil wordt toegevoegd.

### Wat blijft geblokkeerd
- Geen echte PDF-renderer is geselecteerd of geïnstalleerd.
- Geen dependencywijziging is toegestaan in deze preflight.

### Vereiste eigenaarinput
- Naam van de gekozen PDF-bibliotheek.
- Bevestiging van licentie, runtimegrootte en serverbelasting.
- Akkoord dat dependency-installatie pas in een apart goedgekeurd packet gebeurt.

### Geheimen of externe details
- Geen geheim vereist.

### Veilige commando's
- Preflight: `node scripts/owner-decision-preflight.mjs --decision pdf`
- Safe dry-run: `npm test -- --test-name-pattern "production blocker"`
- Uitvoering na goedkeuring: Gebruik de PDF-sectie in docs/POST_APPROVAL_PROMPTS_NL.md; deze preflight voert niets uit.

### Terugrolplan
- Revert de dependency- en rendererwijziging als build, tests of audit falen.

### Stopregels
- Stop bij ontbrekende bibliotheekkeuze.
- Stop bij dependency-, audit-, build- of testtwijfel.

### Exacte volgende prompt na goedkeuring
- Gebruik de prompt "Approve and implement real PDF renderer" uit docs/POST_APPROVAL_PROMPTS_NL.md.
