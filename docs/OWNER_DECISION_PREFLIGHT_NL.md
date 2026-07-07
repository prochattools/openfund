# Yeshua Academy Finance — Eigenaarsbeslissing preflight

Branch: main
HEAD: 3ebeccc
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

- Dirty paths: docs/OWNER_APPROVED_ACTION_PLAN_NL.md, scripts/generate-release-manifest.mjs, tests/ops/releaseManifest.test.ts, .graphifyignore, graphify-out/

## PostgreSQL-productieversie bevestigen

Sleutel: `postgres-version`
Status: GEBLOKKEERD TOT HOSTINGVERSIE BUITEN GIT IS BEVESTIGD
Blijft geblokkeerd zonder owner-goedkeuring: JA

### Wat is nu klaar
- Lokale Prisma validate/generate controles slagen.
- Migratieketen is lokaal gevalideerd.
- Cutoverplan noemt versiecontrole als vereiste.

### Wat blijft geblokkeerd
- Geen hostingprovider of productiehost mag worden geraadpleegd vanuit deze preflight.
- Geen productie-DB URL mag worden ingevoerd.

### Vereiste eigenaarinput
- PostgreSQL major/minor versie uit hostingdashboard.
- Bevestiging van Prisma-compatibiliteit.
- Besluit of upgrade nodig is voor cutover.

### Geheimen of externe details
- Geen geheim; alleen versienummer en compatibiliteitsbevestiging.

### Veilige commando's
- Preflight: `node scripts/owner-decision-preflight.mjs --decision postgres-version`
- Safe dry-run: `npx prisma validate met uitsluitend een lokale placeholder DATABASE_URL buiten dit rapport`
- Uitvoering na goedkeuring: Gebruik de PostgreSQL-versie prompt in docs/POST_APPROVAL_PROMPTS_NL.md; deze preflight verbindt niet met productie.

### Terugrolplan
- Als versie incompatibel is: stop cutover en plan provider-upgrade of alternatieve database.

### Stopregels
- Stop bij onbekende productieversie.
- Stop bij incompatibiliteit.
- Stop bij productie-URL in lokale commandoregel.

### Exacte volgende prompt na goedkeuring
- Gebruik de prompt "Confirm production PostgreSQL version" uit docs/POST_APPROVAL_PROMPTS_NL.md.
