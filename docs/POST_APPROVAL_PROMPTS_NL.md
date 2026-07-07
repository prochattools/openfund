# Yeshua Academy Finance — Post-approval prompt pack

Status: Release Candidate 5 — productie schema cutover, historische import en geheimrotatie zijn afgerond; resterende functionele blokkers: echte PDF-renderer en echte e-mailverzending  
Taal: Nederlands  
Doel: klaarstaande prompts voor toekomstige owner-approved acties. Kopieer pas een prompt nadat de eigenaar de bijbehorende beslissing expliciet heeft goedgekeurd.

Algemene regels voor alle prompts:
- Start vanuit commit: `<STARTING_COMMIT_PLACEHOLDER>`.
- Werk uitsluitend in `yeshuaacademy-finance`.
- Gebruik `docs/OWNER_ACCEPTANCE_CHECKLIST_NL.md` en `docs/OWNER_DECISION_MENU_NL.md` als pre-approval context.
- Lees de relevante beslisbrief en valideer de approval intake met `node scripts/owner-approval-intake-validator.mjs --decision <decision>` voordat je iets uitvoert.
- Raak `.graphifyignore` en `graphify-out/` niet aan.
- Wijzig of commit geen `.env`.
- Zet geen geheimen, owner-bestanden, ruwe transactierijen, database-dumps of productieconfiguratie in Git.
- Gebruik geen productie, verboden productiehosts, MCP bridge, externe providers of owner-data tenzij de prompt dat na expliciete goedkeuring bounded toestaat.
- Commit alleen coherente, gevalideerde slices.
- Stop bij onverwachte dirty files, non-local DB in een local-only taak, ontbrekende owner-go, geheim in diff, falende validatie na één bounded repair, of scope buiten de goedgekeurde beslissing.

## Volgende blokkers

| # | Blocker | Beslisbrief | Prompt |
|---|---------|-------------|--------|
| 1 | Echte PDF-renderer | `docs/DECISION_BRIEF_PDF_RENDERER_NL.md` | §1 hieronder |
| 2 | Echte e-mailverzending | `docs/DECISION_BRIEF_EMAIL_PROVIDER_NL.md` | §5 hieronder |

Alle andere production hardening stappen zijn afgerond (2026-07-07).

---

## 1. Approve and implement real PDF renderer

```text
You are working in yeshuaacademy-finance from <STARTING_COMMIT_PLACEHOLDER>.

Owner approval received:
- Real PDF renderer approved: <PDF_LIBRARY_NAME>

Hard constraints:
- Do not touch .graphifyignore or graphify-out/.
- Do not edit .env.
- Do not use production, external providers, email, owner files, or database dumps.
- Do not push or tag.
- Keep HTML/XLSX snapshot totals unchanged.
- Add only the approved PDF dependency.

Task:
0. Lees `docs/DECISION_BRIEF_PDF_RENDERER_NL.md` en valideer de intake met `node scripts/owner-approval-intake-validator.mjs --decision pdf`.
1. Install and wire <PDF_LIBRARY_NAME> as the real report PDF renderer.
2. Replace the placeholder only where PDF_BLOCKER currently blocks real output.
3. Add tests proving PDF output is generated from the same immutable snapshot totals as HTML and XLSX.
4. Keep safe fallback/error behavior explicit.

Validation:
- npm test -- --test-name-pattern "production blocker"
- npm test -- --test-name-pattern "report artifact"
- npm test
- npm run build:server
- npm run build
- git diff --check

Commit policy:
- Commit only PDF dependency, renderer, tests, and docs.

Final report:
- Dependency added
- PDF artifact evidence
- Tests/builds
- Remaining blockers
- Final git status
```

## 2. Confirm production PostgreSQL version

```text
You are working in yeshuaacademy-finance from <STARTING_COMMIT_PLACEHOLDER>.

Owner approval received:
- Production PostgreSQL version has been checked outside Git.
- Version: <POSTGRES_VERSION_PLACEHOLDER>

Hard constraints:
- Do not connect to production.
- Do not edit .env.
- Do not print or commit hostnames, credentials, or DB URLs.
- Do not run migrations.
- Do not push or tag.

Task:
0. Lees `docs/DECISION_BRIEF_POSTGRES_VERSION_NL.md` en valideer de intake met `node scripts/owner-approval-intake-validator.mjs --decision postgres-version`.
1. Update the relevant infrastructure/readiness docs with the confirmed PostgreSQL version and Prisma compatibility statement.
2. Keep production cutover blocked until separate owner approval.
3. Add or update docs/tests so the version-confirmation blocker cannot be marked complete without explicit evidence text.

Validation:
- npm test -- --test-name-pattern "production blocker"
- npm test -- --test-name-pattern "roadmap status"
- npx prisma validate
- git diff --check

Commit policy:
- Documentation/tests only unless an existing guard requires a small script update.

Final report:
- Confirmed version recorded
- Compatibility statement
- Tests
- Remaining blockers
- Final git status
```

## 3. Run production cutover preparation, documentation-only first

```text
You are working in yeshuaacademy-finance from <STARTING_COMMIT_PLACEHOLDER>.

Owner approval received:
- Documentation-only cutover preparation approved.
- Production mutation is still NOT approved in this prompt.

Hard constraints:
- Do not connect to production.
- Do not run production migrations.
- Do not modify production config.
- Do not edit .env.
- Do not push or tag.
- Do not use owner files.

Task:
0. Lees `docs/DECISION_BRIEF_PRODUCTION_CUTOVER_NL.md` en valideer de intake met `node scripts/owner-approval-intake-validator.mjs --decision production-cutover`.
1. Re-read docs/PRODUCTION_CUTOVER_PLAN_NL.md.
2. Convert any ambiguous production step into an explicit checklist item with owner confirmation.
3. Add a dry-run-only operator checklist for the next approved cutover prompt.
4. Keep every production mutation marked blocked.

Validation:
- node scripts/owner-decision-preflight.mjs --decision production-cutover
- node scripts/owner-go-no-go-preflight.mjs --strict
- npm test -- --test-name-pattern "production blocker"
- git diff --check

Commit policy:
- Commit docs/tests only.

Final report:
- Cutover docs updated
- Blockers retained
- Validation results
- Final git status
```

## 4. Run historical production import dry-run with owner files outside Git

```text
You are working in yeshuaacademy-finance from <STARTING_COMMIT_PLACEHOLDER>.

Owner approval received:
- Historical import DRY-RUN approved only.
- Owner source files are available outside Git at operator-provided absolute paths.

Hard constraints:
- Do not copy owner Excel/CSV/PDF files into Git.
- Do not commit raw rows, generated output, or dumps.
- Do not execute production import.
- Use only local/disposable DB targets for rehearsal.
- Stop immediately if any DB URL is non-local.
- Do not push or tag.

Task:
0. Lees `docs/DECISION_BRIEF_HISTORICAL_IMPORT_NL.md` en valideer de intake met `node scripts/owner-approval-intake-validator.mjs --decision historical-import`.
1. Run only the owner-approved dry-run/rehearsal path.
2. Verify source hashes, row counts, opening/closing controls, and July partial status.
3. Record only sanitized summary evidence in docs.
4. Keep production execution blocked.

Validation:
- npm test -- --test-name-pattern "Phase 3 historical loading closeout"
- npm test -- --test-name-pattern "historical owner import command"
- git diff --check

Commit policy:
- Commit only sanitized docs/tests if needed.

Final report:
- Local/disposable DB host and database, sanitized
- Row counts and controls
- Confirmation no owner files or raw rows entered Git
- Final git status
```

## 5. Configure real email provider, no sending until dry-run approved

```text
You are working in yeshuaacademy-finance from <STARTING_COMMIT_PLACEHOLDER>.

Owner approval received:
- Email provider configuration preparation approved.
- Real sending is NOT approved until a later dry-run acceptance.

Hard constraints:
- Do not place API keys in Git.
- Do not edit .env.
- Do not call the email provider.
- Do not send real email.
- Do not push or tag.

Task:
0. Lees `docs/DECISION_BRIEF_EMAIL_PROVIDER_NL.md` en valideer de intake met `node scripts/owner-approval-intake-validator.mjs --decision email`.
1. Add provider integration behind an explicit disabled-by-default guard.
2. Keep current metadata-only dispatch behavior unless a separate approved send flag is present.
3. Add tests proving no provider call happens by default and secrets are never logged.

Validation:
- npm test -- --test-name-pattern "production blocker"
- npm test -- --test-name-pattern "report dispatch"
- npm run build:server
- git diff --check

Commit policy:
- Commit guarded code/tests/docs only.

Final report:
- Guard behavior
- Tests/builds
- Confirmation no email sent and no secrets committed
- Final git status
```

## 6. Push to remote after owner approval

```text
You are working in yeshuaacademy-finance from <STARTING_COMMIT_PLACEHOLDER>.

Owner approval received:
- Push to remote approved.

Hard constraints:
- Do not create tags unless separately approved.
- Do not force-push.
- Do not include .env, owner files, dumps, raw rows, production config, .graphifyignore, or graphify-out/.
- Stop if worktree has unexpected dirty files.

Task:
0. Lees `docs/PUSH_READINESS_CHECKLIST_NL.md`, `docs/POST_PUSH_VERIFICATION_NL.md`, en valideer de intake met `node scripts/owner-approval-intake-validator.mjs --decision push`.
1. Run push readiness preflight.
2. Run release candidate validation.
3. Confirm final git status.
4. Only then perform the owner-approved remote publish.

Validation before publish:
- node scripts/push-readiness-preflight.mjs --strict
- npm run validate:release-candidate
- git status --short --branch

Commit policy:
- Do not create new commits unless validation docs must be refreshed before owner-approved publish.

Final report:
- Branch
- Commit pushed
- Validation results
- Final git status
```

## 7. Secret rotation checklist

```text
You are working in yeshuaacademy-finance from <STARTING_COMMIT_PLACEHOLDER>.

Owner approval received:
- Secret rotation planning approved.

Hard constraints:
- Do not print, write, or commit any secret value.
- Do not edit .env.
- Do not call providers.
- Do not mutate production.
- Do not push or tag.

Task:
0. Lees `docs/DECISION_BRIEF_SECRET_ROTATION_NL.md` en valideer de intake met `node scripts/owner-approval-intake-validator.mjs --decision secret-rotation`.
1. Produce or update a checklist naming secret categories only, not values.
2. Confirm where each secret will be stored outside Git.
3. Define rotation order, rollback owner, and validation steps.
4. Keep actual rotation outside this repo until separately approved.

Validation:
- node scripts/owner-decision-preflight.mjs --decision secret-rotation
- git diff --check
- docs secret-material scan if available

Commit policy:
- Documentation-only.

Final report:
- Secret categories covered
- Storage destination names without values
- Stop rules
- Final git status
```
