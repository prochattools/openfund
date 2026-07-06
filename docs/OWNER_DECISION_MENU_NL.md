# Yeshua Academy Finance — Owner decision menu

Status: owner decision selection ready — geen owner-gated actie uitgevoerd
Taal: Nederlands

## Guards

- Geen .env lezen.
- Geen netwerk, database, productiehost of externe provider gebruiken.
- Geen push, tags, dependency-installatie, e-mail, import of secret rotation uitvoeren.
- Geen mutatie behalve docs/OWNER_DECISION_MENU_NL.md met --write.

## Beslissingsmenu

| Sleutel | Beslissing | Status | Veilige preflight | Promptdocument |
|---------|------------|--------|-------------------|----------------|
| `pdf` | Echte PDF-renderer | GEBLOKKEERD TOT EXPLICIETE PDF-GOEDKEURING | `node scripts/owner-decision-preflight.mjs --decision pdf` | `docs/POST_APPROVAL_PROMPTS_NL.md` |
| `production-cutover` | Productiecutover | GEBLOKKEERD TOT EXPLICIETE CUTOVER-GOEDKEURING | `node scripts/owner-decision-preflight.mjs --decision production-cutover` | `docs/POST_APPROVAL_PROMPTS_NL.md` |
| `historical-import` | Historische productie-import | GEBLOKKEERD TOT OWNER-FILES EN DRY-RUN ACCEPTATIE ZIJN GOEDGEKEURD | `node scripts/owner-decision-preflight.mjs --decision historical-import` | `docs/POST_APPROVAL_PROMPTS_NL.md` |
| `email` | Echte e-mailverzending | GEBLOKKEERD TOT PROVIDER, SECRET EN SEND-GOEDKEURING ZIJN GOEDGEKEURD | `node scripts/owner-decision-preflight.mjs --decision email` | `docs/POST_APPROVAL_PROMPTS_NL.md` |
| `push` | Push naar remote | GEBLOKKEERD TOT EXPLICIETE PUSH-GOEDKEURING | `node scripts/push-readiness-preflight.mjs --strict` | `docs/PUSH_READINESS_CHECKLIST_NL.md` |
| `secret-rotation` | Secret rotation | GEBLOKKEERD TOT VAULT- EN CUTOVER-SCOPE BUITEN GIT ZIJN GOEDGEKEURD | `node scripts/owner-decision-preflight.mjs --decision secret-rotation` | `docs/POST_APPROVAL_PROMPTS_NL.md` |
| `postgres-version` | Productie PostgreSQL-versie bevestigen | GEBLOKKEERD TOT HOSTINGVERSIE BUITEN GIT IS BEVESTIGD | `node scripts/owner-decision-preflight.mjs --decision postgres-version` | `docs/POST_APPROVAL_PROMPTS_NL.md` |

## Echte PDF-renderer

Sleutel: `pdf`
Status: GEBLOKKEERD TOT EXPLICIETE PDF-GOEDKEURING
Vereiste approval: Owner kiest de PDF-bibliotheek en keurt dependency, licentie en runtime-impact goed.
Veilige preflight: `node scripts/owner-decision-preflight.mjs --decision pdf`
Volgende prompt doc: `docs/POST_APPROVAL_PROMPTS_NL.md`

Stopregels:
- Stop bij ontbrekende bibliotheekkeuze.
- Stop bij dependency- of licentietwijfel.
- Stop als echte PDF-output wordt gevraagd zonder aparte approval.

## Productiecutover

Sleutel: `production-cutover`
Status: GEBLOKKEERD TOT EXPLICIETE CUTOVER-GOEDKEURING
Vereiste approval: Owner keurt cutover-scope, backupvenster, rollback-eigenaar en productiegegevens buiten Git goed.
Veilige preflight: `node scripts/owner-decision-preflight.mjs --decision production-cutover`
Volgende prompt doc: `docs/POST_APPROVAL_PROMPTS_NL.md`

Stopregels:
- Stop bij ontbrekende backup- of rollbackbevestiging.
- Stop bij productiecredentials in Git of output.
- Stop bij non-local DB in een local-only stap.

## Historische productie-import

Sleutel: `historical-import`
Status: GEBLOKKEERD TOT OWNER-FILES EN DRY-RUN ACCEPTATIE ZIJN GOEDGEKEURD
Vereiste approval: Owner levert bronbestanden buiten Git, verwachte hashes en dry-run acceptatie.
Veilige preflight: `node scripts/owner-decision-preflight.mjs --decision historical-import`
Volgende prompt doc: `docs/POST_APPROVAL_PROMPTS_NL.md`

Stopregels:
- Stop bij owner-bestanden binnen de repo.
- Stop bij hash mismatch of onbalans.
- Stop als productie-import wordt gevraagd zonder aparte owner-go.

## Echte e-mailverzending

Sleutel: `email`
Status: GEBLOKKEERD TOT PROVIDER, SECRET EN SEND-GOEDKEURING ZIJN GOEDGEKEURD
Vereiste approval: Owner keurt provider, domein, secretbeheer buiten Git, testontvangers en send-scope goed.
Veilige preflight: `node scripts/owner-decision-preflight.mjs --decision email`
Volgende prompt doc: `docs/POST_APPROVAL_PROMPTS_NL.md`

Stopregels:
- Stop bij ontbrekende provider-goedkeuring.
- Stop bij geheim in diff of output.
- Stop bij echte verzending zonder expliciete send-go.

## Push naar remote

Sleutel: `push`
Status: GEBLOKKEERD TOT EXPLICIETE PUSH-GOEDKEURING
Vereiste approval: Owner bevestigt remote, branch, commit, validaties en publicatie zonder tags of force.
Veilige preflight: `node scripts/push-readiness-preflight.mjs --strict`
Volgende prompt doc: `docs/PUSH_READINESS_CHECKLIST_NL.md`

Stopregels:
- Stop bij onverwachte dirty files.
- Stop bij falende release-candidate validatie.
- Stop bij ontbrekende expliciete push-goedkeuring.

## Secret rotation

Sleutel: `secret-rotation`
Status: GEBLOKKEERD TOT VAULT- EN CUTOVER-SCOPE BUITEN GIT ZIJN GOEDGEKEURD
Vereiste approval: Owner bepaalt welke geheimen buiten Git roteren, waar ze worden beheerd en wat de rollback is.
Veilige preflight: `node scripts/owner-decision-preflight.mjs --decision secret-rotation`
Volgende prompt doc: `docs/POST_APPROVAL_PROMPTS_NL.md`

Stopregels:
- Stop bij geheim in Git, docs of output.
- Stop bij `.env` wijziging.
- Stop bij ontbrekende vault-bestemming.

## Productie PostgreSQL-versie bevestigen

Sleutel: `postgres-version`
Status: GEBLOKKEERD TOT HOSTINGVERSIE BUITEN GIT IS BEVESTIGD
Vereiste approval: Owner bevestigt major/minor versie uit hostingdashboard en Prisma-compatibiliteit buiten Git.
Veilige preflight: `node scripts/owner-decision-preflight.mjs --decision postgres-version`
Volgende prompt doc: `docs/POST_APPROVAL_PROMPTS_NL.md`

Stopregels:
- Stop bij onbekende productieversie.
- Stop bij productie-DB URL in lokale commands.
- Stop bij incompatibiliteit of onzeker providerbewijs.

## Stopregels voor alle keuzes

- Stop bij productie, verboden productiehost, MCP bridge, externe provider, echte e-mail, PDF dependency, owner-bestanden, historische productie-import, push, tags, `.env` wijziging of geheim in output.
- Stop bij falende validatie na één bounded repair attempt.
- Gebruik `docs/OWNER_APPROVAL_INTAKE_NL.md` vóór elke goedgekeurde uitvoering.
