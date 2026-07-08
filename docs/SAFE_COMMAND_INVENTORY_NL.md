# Yeshua Academy Finance — Veilige commando-inventaris

Status: Release Candidate 7 — roadmap 100% through Phase 16; Phase 17 open; schema cutover, historische import, database credential finalisatie, provider secret remediation, echte PDF, en echte e-mailverzending zijn volledig afgerond 2026-07-08
Taal: Nederlands
Doel: Overzicht van alle veilige lokale commando's en alle verboden commando-categorieën voor eigenaarsbeoordeling.

---

## 1. Veilige validatiecommando's

Deze commando's zijn volledig lokaal, raken geen productie, lezen geen `.env`, en zijn altijd veilig uit te voeren vóór eigenaargoedkeuring.

### Testsuite

```bash
npm test
```

Verwacht: alle tests slagen (exit 0). Geen database. Geen externe calls.

### Server TypeScript-compilatie

```bash
npm run build:server
```

Verwacht: schone compilatie (exit 0).

### Next.js productiebuild

```bash
npm run build
```

Verwacht: succesvolle build (exit 0), ~18 statische pagina's.

### Release-candidate validatie (alles in één stap)

```bash
npm run validate:release-candidate
```

Voert uit: `npm test`, `npm run build:server`, `npm run build`, Prisma validate (lokale placeholder), Prisma generate, backup dry-run, `git diff --check`.  
Verwacht: exit 0, geen fouten.

### Prisma schemavalidatie

```bash
DATABASE_URL=postgresql://finance_user:local_dev_placeholder@127.0.0.1:5432/yaf_validate npx prisma validate
```

Verwacht: schema geldig (exit 0). Vereist geen draaiende database.

### Prisma Client genereren

```bash
npx prisma generate
```

Verwacht: Prisma Client gegenereerd (exit 0).

### Git whitespace check

```bash
git diff --check
```

Verwacht: geen uitvoer, exit 0.

---

## 2. Veilige preflight-commando's

### Owner go/no-go preflight

```bash
node scripts/owner-go-no-go-preflight.mjs --strict
```

Controleert: branch, release manifest, vereiste documenten, worktree, productieblockers.  
Verwacht: `GO_FOR_OWNER_REVIEW`.

```bash
npm run preflight:owner-go-no-go
```

### Owner decision preflight (voorbeeld: PDF)

```bash
node scripts/owner-decision-preflight.mjs --decision pdf
```

Controleert readiness voor een specifieke eigenaarsbeslissing. Veilig voor alle beslissingen.  
Andere beslissingen: `production-cutover`, `historical-import`, `email`, `secret-rotation`, `postgres-version`.

```bash
npm run preflight:owner-decision
```

### Owner approved action plan (voorbeeld: PDF)

```bash
node scripts/owner-approved-action-plan.mjs --decision pdf
```

Genereert een actieplan voor goedgekeurde beslissingen. Voert geen actie uit.

```bash
npm run preflight:owner-action-plan
```

### Owner decision menu

```bash
node scripts/owner-decision-menu.mjs
```

Toont een static Nederlands menu voor de volgende eigenaarsbeslissing. Voert geen owner-gated actie uit.

```bash
npm run preflight:owner-decision-menu
```

### Owner acceptance preflight

```bash
npm run preflight:owner-acceptance
```

Voert alleen de finale owner-review preflight en het static decision menu uit. Geen build, geen productie, geen push, geen e-mail, geen import.

### Approval intake validator

```bash
node scripts/owner-approval-intake-validator.mjs --decision pdf
npm run preflight:approval-intake
```

Controleert statisch welke owner approval velden, stopregels en evidence per beslissing nodig zijn. Voert geen owner-gated actie uit en schrijft alleen `docs/OWNER_APPROVAL_INTAKE_VALIDATION_NL.md` met `--write`.

### Next owner decision preflight

```bash
npm run preflight:next-owner-decision
```

Voert alleen de aanbevelingsdoc-test en statische PostgreSQL-versie approval/preflight checks uit. Dit bevestigt geen productieversie en voert geen productieactie uit.

### Local PostgreSQL version evidence guard

```bash
npm test -- --test-name-pattern "postgres version evidence"
```

Controleert `docs/POSTGRES_VERSION_EVIDENCE_NL.md`. Dit bewaakt alleen lokale PostgreSQL 15.17 rehearsal evidence en bevestigt geen productieversie.

### Post-push verification guard

```bash
npm run preflight:post-push
```

Voert alleen de post-push verification guard tests uit. Dit bevestigt de gedocumenteerde gepubliceerde handoff: commit `f2f7cbb` is op `origin/main` geverifieerd; het voert geen nieuwe push uit.

### Decision brief guards

```bash
npm run preflight:decision-briefs
```

Voert alleen de owner decision brief guard tests uit en bewaakt dat de zes beslisbrieven geen uitvoering, secrets, productie, externe providers of owner-data bevatten.

### Push readiness preflight

```bash
node scripts/push-readiness-preflight.mjs --strict
```

Controleert: branch, worktree, validatiescript, vereiste bestanden, `.env`, dumps, owner-bronbestanden.  
Verwacht: `READY_FOR_OWNER_APPROVED_PUSH`.

```bash
npm run preflight:push-readiness
```

### Backup dry-run

```bash
node scripts/backup-restore-rehearsal.mjs --dry-run
```

Voert geen databasecommando's uit. Controleert alleen guards. Verwacht: exit 0.

### Finale documentatieconsistentie-audit

```bash
node scripts/final-docs-consistency-audit.mjs
```

Controleert: vereiste documenten aanwezig, blockers consistent, geen valse productie-beweringen, manifest evidence, links.

```bash
npm run audit:final-docs
```

### Finale owner review preflight

```bash
node scripts/final-owner-review-preflight.mjs --check
```

Controleert: release-manifest evidence, alle vereiste bestanden aanwezig, geen verboden commando's in scripts, en dat live branch/worktree-controle expliciet gedelegeerd blijft aan `node scripts/push-readiness-preflight.mjs --strict`. Dit script voert zelf geen git-commando's uit.

```bash
npm run preflight:final-owner-review
```

### Release manifest bekijken

```bash
node scripts/generate-release-manifest.mjs
```

Bekijkt het huidige manifest. Veilig altijd.

---

## 3. Commando's die NOOIT zijn toegestaan vóór eigenaargoedkeuring

De volgende commando's mogen **NOOIT** worden uitgevoerd zonder expliciete eigenaargoedkeuring buiten Git:

| Verboden commando | Reden |
|-------------------|-------|
| Nieuwe `git push` | Publiceert lokale commits naar remote; vereist eigenaargoedkeuring |
| `git tag` | Maakt een tag aan; vereist eigenaargoedkeuring |
| `git push --force` | Destructief; altijd geblokkeerd op main |
| Productiecutover-script | AFGEROND — schema finance gedeployed 2026-07-07 |
| Historische productie-import | AFGEROND — 902 transacties geïmporteerd 2026-07-07 |
| Secret rotation | AFGEROND — finance_user geroteerd 2026-07-07 |
| Echte e-mail sturen (Resend) | AFGEROND 2026-07-08 — begrensde productie-verificatie geslaagd via apps-saas-open-fund-vdymfu |
| Nieuwe dependency installeren | Geblokkeerd — vereist keuze en goedkeuring eigenaar; `pdfkit` was apart goedgekeurd en afgerond |
| Clerk/Resend/New Relic providerrotaties afronden | AFGEROND 2026-07-08 — alle provider secrets geroteerd en toegepast op Dokploy runtime |
| `node scripts/backup-restore-rehearsal.mjs --live-local` | Verbindt met lokale database; vereist `--confirm-disposable` én voorbereiding |
| Productiedatabasecommando's | Altijd geblokkeerd tot na productie-cutovergoedkeuring |
| Wijzigingen in `.env` | Nooit in Git; geheimen horen in de secret vault |

---

## 4. Commando's die expliciete eigenaargoedkeuring en een aparte prompt vereisen

Na eigenaargoedkeuring buiten Git, gebruik de exacte prompts in `docs/POST_APPROVAL_PROMPTS_NL.md`:

| Beslissing | Post-approval prompt |
|------------|---------------------|
| PDF-renderer | `docs/POST_APPROVAL_PROMPTS_NL.md` §PDF |
| Productiecutover | `docs/POST_APPROVAL_PROMPTS_NL.md` §Productiecutover |
| Historische import | `docs/POST_APPROVAL_PROMPTS_NL.md` §Historische import |
| E-mail provider | `docs/POST_APPROVAL_PROMPTS_NL.md` §E-mail |
| Push | `docs/POST_APPROVAL_PROMPTS_NL.md` §Push |

---

## 5. Verwachte uitvoer-samenvatting

| Commando | Verwacht resultaat |
|----------|-------------------|
| `npm run validate:release-candidate` | Exit 0, alle stappen geslaagd |
| `node scripts/owner-go-no-go-preflight.mjs --strict` | `GO_FOR_OWNER_REVIEW`, exit 0 |
| `node scripts/push-readiness-preflight.mjs --strict` | `READY_FOR_OWNER_APPROVED_PUSH`, exit 0 |
| `node scripts/final-docs-consistency-audit.mjs` | `GESLAAGD`, exit 0 |
| `node scripts/final-owner-review-preflight.mjs --check` | `GEREED VOOR EIGENAARSBEOORDELING: JA`, exit 0, zonder git-commando's |
| `node scripts/owner-decision-menu.mjs` | Static owner decision menu, exit 0 |
| `node scripts/owner-approval-intake-validator.mjs --decision pdf` | Static approval-intake advies, exit 0 |
| `npm run preflight:owner-acceptance` | Finale owner-review preflight plus decision menu, exit 0 |
| `npm run preflight:approval-intake` | Static approval-intake overzicht, exit 0 |
| `npm run preflight:post-push` | Post-push verification guard tests, exit 0 |
| `npm run preflight:decision-briefs` | Decision brief guard tests, exit 0 |
| `node scripts/backup-restore-rehearsal.mjs --dry-run` | Guard-check geslaagd, exit 0 |
| `node scripts/generate-release-manifest.mjs` | Release manifest met RC4-status |

---

## 6. Stopregels

Stop direct en meld een blocker als een commando:
- Vereist productie, Dokploy, MCP bridge, of `10.0.2.4`.
- Vereist eigenaargoedkeuring die nog niet ontvangen is.
- Een non-lokale DATABASE_URL detecteert.
- Een PDF-dependency wil installeren.
- Echte e-mail wil verzenden.
- Een historische productie-import wil uitvoeren.
- `git push` of `git tag` zou uitvoeren.
- Een secret zou roteren.
- `.env` zou wijzigen of committen.
- Owner Excel/CSV/PDF-bestanden in Git zou plaatsen.
- Ruwe transactiedumps of databasedumps zou committen.

---

## Verwijzingen

- `docs/OWNER_REVIEW_INDEX_NL.md` — overzicht eigenaarsbeoordeling
- `docs/OWNER_HANDOFF_NL.md` — eigenaaroverdracht
- `docs/OWNER_DECISION_PACK_NL.md` — beslissingspakket
- `docs/POST_PUSH_VERIFICATION_NL.md` — post-push basisverificatie
- `docs/OWNER_APPROVAL_INTAKE_VALIDATION_NL.md` — static approval intake validation
- `docs/POST_APPROVAL_PROMPTS_NL.md` — prompts voor goedgekeurde acties
- `docs/PUSH_READINESS_CHECKLIST_NL.md` — push checklist
- `docs/PRODUCTION_CUTOVER_PLAN_NL.md` — productiecutoverplan
- `docs/BACKUP_RESTORE_REHEARSAL_NL.md` — backup/restore rehearsal
