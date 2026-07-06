# Yeshua Academy Finance — Owner review index

Status: Release Candidate 4 — klaar voor eigenaarsbeoordeling; owner-gated acties blijven geblokkeerd  
Taal: Nederlands  
Doel: één startpunt voor de eigenaar om te bepalen wat klaar is, wat geblokkeerd blijft, en welke beslissing als eerste genomen moet worden.

## Start hier

1. Lees eerst `docs/OWNER_HANDOFF_NL.md`.
2. Controleer daarna `docs/RELEASE_MANIFEST_NL.md`.
3. Lees de beslissingen in `docs/OWNER_DECISION_PACK_NL.md`.
4. Gebruik `docs/OWNER_DECISION_READINESS_MATRIX_NL.md` om per beslissing te zien wat klaar is.
5. Gebruik `docs/POST_APPROVAL_PROMPTS_NL.md` pas nadat een beslissing expliciet is goedgekeurd.

## Wat klaar is

- Maandelijkse ING-import workflow.
- Deterministische categorisatie plus evidence-rich review.
- Expliciete admin-beslissingen voor financiële waarheid.
- Periodeafsluiting, reconciliatie, reopen-audit en immutable report snapshots.
- HTML- en XLSX-rapporten uit gesloten snapshots.
- Dispatch-metadata zonder echte e-mail.
- Dutch UX en admin-only mutation guards.
- Local-only release, backup, owner decision, and push preflights.

## Wat geblokkeerd blijft

- Echte PDF-renderer dependency.
- Productiemigratie/cutover.
- Historische productie-import.
- Echte e-mailverzending.
- Push naar remote.
- Secret rotation.
- Productie PostgreSQL-versie bevestiging.

## Required decisions

| Beslissing | Startdocument | Preflight |
|------------|---------------|-----------|
| PDF | `docs/OWNER_DECISION_READINESS_MATRIX_NL.md` | `node scripts/owner-decision-preflight.mjs --decision pdf` |
| Productiecutover | `docs/PRODUCTION_CUTOVER_PLAN_NL.md` | `node scripts/owner-decision-preflight.mjs --decision production-cutover` |
| Historische import | `docs/OWNER_DECISION_READINESS_MATRIX_NL.md` | `node scripts/owner-decision-preflight.mjs --decision historical-import` |
| E-mail | `docs/OWNER_DECISION_READINESS_MATRIX_NL.md` | `node scripts/owner-decision-preflight.mjs --decision email` |
| Push | `docs/PUSH_READINESS_CHECKLIST_NL.md` | `node scripts/push-readiness-preflight.mjs --strict` |
| Geheimen | `docs/OWNER_DECISION_READINESS_MATRIX_NL.md` | `node scripts/owner-decision-preflight.mjs --decision secret-rotation` |
| PostgreSQL-versie | `docs/OWNER_DECISION_READINESS_MATRIX_NL.md` | `node scripts/owner-decision-preflight.mjs --decision postgres-version` |

## Validation commands

```bash
node scripts/owner-go-no-go-preflight.mjs --strict
node scripts/owner-decision-preflight.mjs --decision pdf
node scripts/push-readiness-preflight.mjs --strict
npm run validate:release-candidate
git diff --check
```

## If you want PDF

Lees:
- `docs/OWNER_DECISION_READINESS_MATRIX_NL.md`
- `docs/POST_APPROVAL_PROMPTS_NL.md`

Voer vóór goedkeuring alleen uit:

```bash
node scripts/owner-decision-preflight.mjs --decision pdf
```

## If you want production cutover

Lees:
- `docs/PRODUCTION_CUTOVER_PLAN_NL.md`
- `docs/BACKUP_RESTORE_REHEARSAL_NL.md`
- `docs/POST_APPROVAL_PROMPTS_NL.md`

Voer vóór goedkeuring alleen lokale checks uit:

```bash
node scripts/owner-decision-preflight.mjs --decision production-cutover
npm run validate:release-candidate
```

## If you want historical import

Lees:
- `docs/OWNER_DECISION_READINESS_MATRIX_NL.md`
- `docs/POST_APPROVAL_PROMPTS_NL.md`

Owner-bronbestanden blijven buiten Git. Vóór goedkeuring:

```bash
node scripts/owner-decision-preflight.mjs --decision historical-import
```

## If you want email

Lees:
- `docs/OWNER_DECISION_READINESS_MATRIX_NL.md`
- `docs/POST_APPROVAL_PROMPTS_NL.md`

Vóór goedkeuring:

```bash
node scripts/owner-decision-preflight.mjs --decision email
```

## If you want push

Lees:
- `docs/PUSH_READINESS_CHECKLIST_NL.md`
- `docs/POST_APPROVAL_PROMPTS_NL.md`

Vóór goedkeuring:

```bash
node scripts/push-readiness-preflight.mjs --strict
node scripts/owner-go-no-go-preflight.mjs --strict
```

## If you want secret rotation

Lees:
- `docs/OWNER_DECISION_READINESS_MATRIX_NL.md`
- `docs/POST_APPROVAL_PROMPTS_NL.md`

Vóór goedkeuring:

```bash
node scripts/owner-decision-preflight.mjs --decision secret-rotation
```

## Stop rules

Stop direct wanneer:
- `git status --short` meer toont dan `.graphifyignore` of `graphify-out/`.
- Een opdracht productie, forbidden hosts, MCP bridge, externe provider, echte e-mail, PDF dependency, owner-bestanden, secret rotation, historische productie-import, of push vereist.
- Een DB URL niet lokaal is voor een local-only rehearsal.
- `.env`, owner source files, raw rows, database dumps, or production config would enter Git.
- Een validatie faalt en één bounded repair attempt faalt.

## Contact/notes

Plaats hier geen geheimen, hostnamen, wachtwoorden, API-keys, owner-bestandspaden of ruwe transactiedetails.

## Document map

| Document | Doel |
|----------|------|
| `docs/OWNER_HANDOFF_NL.md` | Eerste eigenaaroverdracht |
| `docs/OWNER_DECISION_PACK_NL.md` | Beslissingspakket |
| `docs/OWNER_DECISION_READINESS_MATRIX_NL.md` | Per-beslissing readiness matrix |
| `docs/OWNER_GO_NO_GO_PREFLIGHT_NL.md` | Repo go/no-go preflight |
| `docs/OWNER_DECISION_PREFLIGHT_NL.md` | Gegenereerde beslissing-preflight |
| `docs/PUSH_READINESS_CHECKLIST_NL.md` | Push checklist |
| `docs/POST_APPROVAL_PROMPTS_NL.md` | Prompts voor goedgekeurde acties |
| `docs/PRODUCTION_CUTOVER_PLAN_NL.md` | Productiecutoverplan |
| `docs/BACKUP_RESTORE_REHEARSAL_NL.md` | Backup/restore rehearsal |
| `docs/FINAL_READINESS_AUDIT_NL.md` | Eindaudit |
| `docs/RELEASE_MANIFEST_NL.md` | Release manifest |
| `docs/ROADMAP.md` | Roadmap |
