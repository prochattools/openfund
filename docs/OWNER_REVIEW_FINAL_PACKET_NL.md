# Yeshua Academy Finance — Final owner review packet

Status: final owner-review packet — schema cutover afgerond 2026-07-07; historische import, echte e-mail, PDF en geheimrotatie geblokkeerd
Taal: Nederlands

## 1. Huidige release-status

De applicatie is release-candidate-ready voor eigenaarsbeoordeling. De eerder goedgekeurde owner-decision handoff publish is lokaal geverifieerd: commit `f2f7cbb` staat op `origin/main`. De post-push evidence, decision briefs, approval-intake validator en bijbehorende guards zijn gepubliceerd; de volgende gate is owner decision selection.

Veilige lokale status:

- Financiële workflow lokaal/app klaar.
- Historische loading lokaal/sanitized klaar; productie-import geblokkeerd.
- Backup/restore live lokaal gerehearsed; productieback-up/herstel blijft geblokkeerd.
- Rapporten HTML/XLSX klaar; echte PDF-renderer geblokkeerd.
- Dispatch-metadata klaar; echte e-mailverzending geblokkeerd.
- Remote handoff commit `f2f7cbb` is post-push geverifieerd; er waren geen commits ahead of `origin/main` bij de publicatiecheck.
- Owner acceptance checklist en decision menu zijn beschikbaar voor de volgende expliciete eigenaarskeuze.
- Decision briefs en approval-intake validation zijn beschikbaar voor elke owner-gated beslissing.

## 2. Veilige commando's voor review

```bash
npm run validate:release-candidate
node scripts/owner-go-no-go-preflight.mjs --strict
node scripts/final-docs-consistency-audit.mjs
node scripts/final-owner-review-preflight.mjs --check
node scripts/owner-decision-preflight.mjs --decision pdf
node scripts/owner-decision-preflight.mjs --decision production-cutover
node scripts/owner-decision-preflight.mjs --decision historical-import
node scripts/owner-decision-preflight.mjs --decision email
node scripts/push-readiness-preflight.mjs --strict
node scripts/owner-approved-action-plan.mjs --decision pdf
node scripts/owner-decision-menu.mjs
node scripts/owner-approval-intake-validator.mjs --decision pdf
npm run preflight:owner-acceptance
npm run preflight:approval-intake
npm run preflight:post-push
npm run preflight:decision-briefs
```

Deze commando's zijn lokaal en voeren geen productieactie uit.

`node scripts/final-owner-review-preflight.mjs --check` is een statische finale preflight: het leest release-manifest evidence, vereiste documenten/scripts en package-script guards. Het voert geen git-commando's uit; live branch/worktree-status blijft onderdeel van `node scripts/push-readiness-preflight.mjs --strict`.

## 3. Resterende eigenaarsbeslissingen

| Beslissing | Status |
|-----------|--------|
| Echte PDF-renderer | Geblokkeerd tot bibliotheekkeuze en dependency-goedkeuring |
| Productiecutover | Geblokkeerd tot expliciete cutover-goedkeuring |
| Historische productie-import | Geblokkeerd tot owner-bestanden buiten Git en dry-run acceptatie |
| Echte e-mailverzending | Geblokkeerd tot provider/secret-goedkeuring |
| Nieuwe push naar remote | Niet nodig voor de gepubliceerde handoff; geblokkeerd voor toekomstige lokale commits |
| Secret-rotatie | Geblokkeerd tot aparte beheeractie buiten Git |
| PostgreSQL-productieversie | Aanbevolen volgende beslissing; te bevestigen bij hostingprovider vóór cutover |

Gebruik `docs/OWNER_ACCEPTANCE_CHECKLIST_NL.md` om het lokale owner-review pakket te accepteren zonder uitvoering. Gebruik `docs/OWNER_DECISION_MENU_NL.md` om daarna exact één volgende owner-gated beslissing te kiezen. Lees vóór goedkeuring ook de bijbehorende beslisbrief:

- `docs/DECISION_BRIEF_PDF_RENDERER_NL.md`
- `docs/DECISION_BRIEF_POSTGRES_VERSION_NL.md`
- `docs/DECISION_BRIEF_PRODUCTION_CUTOVER_NL.md`
- `docs/DECISION_BRIEF_HISTORICAL_IMPORT_NL.md`
- `docs/DECISION_BRIEF_EMAIL_PROVIDER_NL.md`
- `docs/DECISION_BRIEF_SECRET_ROTATION_NL.md`

Aanbevolen eerste keuze: `docs/NEXT_OWNER_DECISION_RECOMMENDATION_NL.md` (`postgres-version`).

## 4. Exacte volgende prompts

Gebruik pas na expliciete eigenaargoedkeuring:

### PDF

```text
Owner approval received for PDF renderer decision. Use docs/OWNER_APPROVAL_INTAKE_NL.md and docs/POST_APPROVAL_PROMPTS_NL.md. Implement only the approved PDF renderer path, keep no-production/no-email/no-push constraints, validate report artifact tests and builds, and report exact commit evidence.
```

### Productiecutover

```text
Owner approval received for production cutover preparation. Use docs/PRODUCTION_CUTOVER_PLAN_NL.md and docs/OWNER_APPROVAL_INTAKE_NL.md. Do documentation-only dry-run planning first unless production execution is explicitly approved in this same prompt. Never use secrets in Git.
```

### Historische import

```text
Owner approval received for historical import dry-run. Use owner source files outside Git only, preserve source hashes, run dry-run/rehearsal first, do not execute production import unless separately approved, and report sanitized totals only.
```

### E-mail

```text
Owner approval received for email provider dry-run. Configure only approved no-send or metadata-safe behavior first, keep secrets outside Git, validate dispatch tests, and do not send real email until explicitly approved.
```

### Push

```text
Owner approval received for remote publish. Run push readiness preflight and release-candidate validation again. Confirm branch, HEAD, and clean worktree scope. Publish current main to the approved remote without tags and without force. Report commit hash and final git status.
```

## 5. Verboden acties zonder goedkeuring

- Geen productie, Dokploy, MCP bridge of `10.0.2.4`.
- Geen `.env` wijzigen of committen.
- Geen owner Excel/CSV/PDF-bestanden in Git.
- Geen ruwe transactiedumps of databasedumps in Git.
- Geen historische productie-import.
- Geen echte e-mailverzending.
- Geen PDF-dependency installeren.
- Geen nieuwe push of tags.
- Geen secret-rotatie via Git.

## 6. Lokale backup/restore evidence

De live lokale backup/restore rehearsal is voltooid in RC3. De rehearsal gebruikte alleen localhost/`127.0.0.1`, wegwerpdatabases met `yaf_rehearsal_*`, toegepaste migraties, dump/restore, validatie en cleanup. Er zijn geen dumpbestanden gecommit en productie is niet aangeraakt.

Zie `docs/BACKUP_RESTORE_REHEARSAL_NL.md` en `docs/FINAL_READINESS_AUDIT_NL.md`.

## 7. Linkmap

- `docs/OWNER_HANDOFF_NL.md`
- `docs/OWNER_REVIEW_INDEX_NL.md`
- `docs/OWNER_DECISION_PACK_NL.md`
- `docs/OWNER_DECISION_READINESS_MATRIX_NL.md`
- `docs/OWNER_DECISION_PREFLIGHT_NL.md`
- `docs/OWNER_APPROVAL_INTAKE_NL.md`
- `docs/OWNER_APPROVAL_INTAKE_VALIDATION_NL.md`
- `docs/OWNER_APPROVED_ACTION_PLAN_NL.md`
- `docs/OWNER_ACCEPTANCE_CHECKLIST_NL.md`
- `docs/OWNER_DECISION_MENU_NL.md`
- `docs/NEXT_OWNER_DECISION_RECOMMENDATION_NL.md`
- `docs/POST_PUSH_VERIFICATION_NL.md`
- `docs/DECISION_BRIEF_PDF_RENDERER_NL.md`
- `docs/DECISION_BRIEF_POSTGRES_VERSION_NL.md`
- `docs/DECISION_BRIEF_PRODUCTION_CUTOVER_NL.md`
- `docs/DECISION_BRIEF_HISTORICAL_IMPORT_NL.md`
- `docs/DECISION_BRIEF_EMAIL_PROVIDER_NL.md`
- `docs/DECISION_BRIEF_SECRET_ROTATION_NL.md`
- `docs/POST_APPROVAL_PROMPTS_NL.md`
- `docs/PUSH_READINESS_CHECKLIST_NL.md`
- `docs/PRODUCTION_CUTOVER_PLAN_NL.md`
- `docs/BACKUP_RESTORE_REHEARSAL_NL.md`
- `docs/FINAL_READINESS_AUDIT_NL.md`
- `docs/RELEASE_MANIFEST_NL.md`
- `docs/ROADMAP.md`
- `docs/IMPLEMENTATION_PLAN.md`

## 8. Ready for owner review

- [ ] Eigenaar leest release manifest.
- [ ] Eigenaar leest post-push verification evidence voor `f2f7cbb`.
- [ ] Eigenaar leest de relevante beslisbrief vóór een gated beslissing.
- [ ] Eigenaar draait of laat draaien: `npm run validate:release-candidate`.
- [ ] Eigenaar draait of laat draaien: `node scripts/owner-go-no-go-preflight.mjs --strict`.
- [ ] Eigenaar accepteert het lokale pakket via `docs/OWNER_ACCEPTANCE_CHECKLIST_NL.md`.
- [ ] Eigenaar kiest de volgende beslissing via `docs/OWNER_DECISION_MENU_NL.md`.
- [ ] Eigenaar kiest exact welke owner-gated beslissing wordt goedgekeurd.
- [ ] Eigenaar vult `docs/OWNER_APPROVAL_INTAKE_NL.md` buiten Git in of bevestigt schriftelijk buiten Git.
- [ ] Eigenaar valideert de approval intake met `node scripts/owner-approval-intake-validator.mjs --decision <decision>`.
- [ ] Geen owner-gated actie wordt uitgevoerd zonder aparte prompt.
