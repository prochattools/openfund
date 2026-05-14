# Yeshua Academy Finance — Implementation Plan

Status: implementation planning baseline, not yet execution approval  
Date: 2026-05-14  
Depends on: `docs/yeshua-ledger-lite-requirements.md` and `docs/yeshua-academy-finance-roadmap.md`

## 1. Execution rule

Do not start destructive cleanup until the roadmap, bloat map, and prototype direction are approved.

This repo contains production-adjacent finance code and data concepts. Cleanup must be deliberate:

1. document;
2. prototype;
3. inventory;
4. preflight risky changes;
5. implement in small phases;
6. validate totals after every finance-affecting change.

## 2. Confirmed stack direction

Current repo uses:

- Next.js;
- Express server routes;
- Prisma;
- PostgreSQL;
- Docker/Dokploy style deployment;
- Resend;
- existing import/categorization/reconciliation services.

Future direction:

- keep Next.js/Postgres/Prisma unless a later technical review proves otherwise;
- keep Resend summary feature;
- move auth direction toward Ory;
- remove Clerk-first product direction;
- remove Stripe/SaaS/template bloat;
- keep/import/refactor ledger core.

## 3. Phase A — Documentation completion

### Tasks

1. Save requirements baseline.
2. Save roadmap.
3. Save this implementation plan.
4. Save UI design brief/prompt.
5. Record official-source ANBI notes.
6. Record interview answers in distilled form.

### Validation

- Files exist under `docs/`.
- Git status shows expected doc changes only.

## 4. Phase B — UI prototype package

### Goal

Create a prototype direction before code rewrite.

### Input files

- `docs/yeshua-ledger-lite-requirements.md`
- `docs/yeshua-academy-finance-roadmap.md`
- `docs/yeshua-academy-finance-ui-design-brief.md`
- Brain design orchestrator: `brain/ai/skills/custom/design/SKILL.md`

### Deliverables

- `PRODUCT.md` describing the product, users, tone, anti-references.
- `DESIGN.md` describing visual system, typography, colors, spacing, motion, components.
- Optional HTML/React prototype of core screens.
- UI approval notes.

### Prototype must include

1. Dashboard, default after login.
2. Import monthly ING export.
3. Review queue.
4. Ledger drilldown.
5. Year report.
6. Settings/admin safe-mode.

### Prototype must avoid

- current cramped layout;
- marketing homepage;
- generic AI dashboard look;
- excessive filters;
- too many menus;
- English UI labels;
- tables as primary dashboard surface.

## 5. Phase C — Repo bloat map

### Goal

Create exact cleanup inventory before deletion.

### Tasks

1. Inspect `src/app` routes.
2. Inspect `components` and template UI.
3. Inspect `public` and `src/assets` for unused template assets.
4. Inspect Prisma schema for unrelated models.
5. Inspect API routes for Stripe, waiting-list, projects, Make/n8n, blog, request access.
6. Inspect dependencies in `package.json`.
7. Inspect auth usage.
8. Inspect Resend/email usage.
9. Inspect current ledger/import/review/report implementation.
10. Write `docs/yeshua-academy-finance-bloat-map.md`.

### Output categories

Each file/dependency/model/route gets one status:

- keep;
- refactor;
- remove;
- replace;
- unknown, needs inspection.

### Acceptance criteria

- No deletion without bloat map.
- Destructive operations are split into separate confirmed steps.

## 6. Phase D — Import cleanup and hardening

### Goal

Make ING monthly import safe before broad UI/code cleanup.

### Tasks

1. Confirm exact ING export format from uploaded sample.
2. Update parser contract documentation.
3. Ensure parser validates required columns.
4. Add clear Dutch error messages.
5. Ensure duplicate hashing is stable.
6. Add duplicate summary messages.
7. Ensure same file can be imported repeatedly safely.
8. Ensure wrong file does not crash and does not mutate data.
9. Ensure import batch metadata is stored.
10. Ensure original ING exports can be downloaded/exported later.
11. Add/keep automated tests for parser, dedupe, malformed files, duplicate import.

### Likely files to inspect/refactor

- `lib/import/csv_ING.ts`
- `lib/import/normalizers.ts`
- `lib/import/dedupe.ts`
- `lib/import/types.ts`
- `server/services/importService.ts`
- `server/routes/upload.ts`
- tests related to import/dedupe

### Validation

- import sample file succeeds;
- duplicate reimport adds 0 duplicates;
- malformed file returns Dutch error;
- tests pass once local dependencies are installed.

## 7. Phase E — Category/subcategory/project preservation

### Goal

Preserve the current category model instead of inventing a new one.

### Tasks

1. Inspect spreadsheet-derived category script:
   - `scripts/generate-initial-ledger.js`
   - workbook `Overzicht_Yeshua_Academy_Jun_2025.xlsx`
   - sheet `transacties 2025`
   - fields `Categorie` and `bestemming`.
2. Inspect current DB/production categories when data access is available.
3. Inspect category UI/context.
4. Define clean category model.
5. Add project/fund model only if not adequately represented today.
6. Ensure transaction can have only one project/fund.
7. Add admin category/project management UI later.

### Validation

- Existing categories remain available after migration.
- Auto-categorization can assign main/subcategory/project.
- Reports use the same taxonomy.

## 8. Phase F — Review and auto-categorization upgrade

### Goal

Reduce manual work while preventing miscategorization.

### Tasks

1. Define exact 100% historical match criteria.
2. Auto-approve only 100% matches.
3. Suggest lower-confidence matches but require manual approval.
4. Add one-transaction review mode.
5. Add optional table view.
6. Add bulk actions for recurring groups.
7. Add Dutch feedback messages.
8. Fix review queue model so review is not only `categoryId: null`.
9. Ensure review source/status is explicit.
10. Audit log all manual category changes.

### Likely files to inspect/refactor

- `server/services/importService.ts`
- `server/services/categorizationService.ts`
- `server/services/ruleEngine.ts`
- `server/routes/review.ts`
- `server/routes/rules.ts`
- `src/context/ledger-context.tsx`
- `src/app/review/page.tsx`
- `components/review/*`

### Validation

- full matches auto-categorize;
- non-full matches go to review;
- manual approval updates audit log;
- review queue count is accurate.

## 9. Phase G — Core data model cleanup

### Goal

Remove legacy SaaS models and create finance-focused model.

### Important caution

Prisma migrations are protected and confirmation-gated. Do not alter production data casually.

### Candidate model direction

Keep/refactor:

- User;
- Account;
- ImportBatch;
- Transaction;
- Category;
- Ledger;
- OpeningBalance;
- CategorizationRule.

Add/refactor as needed:

- Organization;
- Project/Fund;
- ReviewStatus/ReviewFlag;
- TransactionNote;
- AuditLog;
- YearReport;
- ImportFile or stored export metadata.

Remove/replace if unused:

- Subscription;
- Project legacy SaaS model;
- Audiences if only marketing/list bloat and not used for financial summary recipients.

### Validation

- migration plan reviewed before execution;
- migration has rollback/snapshot strategy;
- existing production data mapping is known.

## 10. Phase H — UI rebuild

### Goal

Replace the UI with the approved design direction.

### Implementation order

1. App shell and Dutch navigation.
2. Dashboard cards/charts.
3. Import screen.
4. Review queue.
5. Ledger drilldown.
6. Year report.
7. Settings/admin safe-mode.
8. Email recipients UI.

### UI rules

- Dashboard is default page after login.
- No public marketing homepage.
- One-click import.
- Cards first, tables secondary.
- Notes/raw transaction metadata hidden until drilldown.
- Dutch-only labels and feedback.
- Big numbers and clear charts.
- Minimal menus.
- No generic SaaS marketing components.

### Likely files to replace/refactor

- `src/app/page.tsx`
- `src/app/dashboard/page.tsx`
- `src/app/ledger/page.tsx`
- `src/app/review/page.tsx`
- dashboard components;
- review components;
- layout/navigation components;
- marketing components, removed.

### Validation

- visual QA against `DESIGN.md`;
- responsive desktop/small-screen check;
- Dutch copy review;
- no old marketing public surface remains.

## 11. Phase I — Reports and balance sheet/year close

### Goal

Implement monthly/year reports and internal balance behavior.

### Tasks

1. Server-side monthly aggregation.
2. Server-side yearly aggregation.
3. Income/expense totals.
4. Category/subcategory/project totals.
5. Balance sheet/carry-forward model.
6. Year close and new-year opening balance.
7. Public ANBI report view.
8. Internal detailed report view.
9. Notes/explanation fields.
10. Total validation.

### Validation

- January–December year works.
- Closing balance equals next year opening balance.
- Income/expense totals match transaction source data.
- Reports reproduce from imported transactions.

## 12. Phase J — Resend monthly summary

### Goal

Keep and improve the existing monthly email summary.

### Tasks

1. Locate current Resend usage.
2. Preserve recipient management.
3. Align email content with new monthly report.
4. Dutch email text.
5. Send status/logging.
6. Admin-only sending/recipient editing.

### Validation

- existing email use case still works;
- numbers match dashboard/report.

## 13. Phase K — Auth and roles

### Goal

Use Ory auth and admin/viewer roles.

### Tasks

1. Inventory Clerk usage.
2. Define Ory session integration.
3. Map logged-in Ory identity to app user.
4. Add admin/viewer role checks.
5. Ensure audit logs use actual user identity.
6. Remove Clerk code after Ory flow is proven.

### Validation

- individual users log in;
- admin can mutate;
- viewer cannot mutate;
- audit log identifies actor.

## 14. Phase L — Production data migration

### Goal

Retain production data safely after new model is ready.

### Tasks

1. Snapshot production data.
2. Inspect current schema/data.
3. Map old to new.
4. Dry-run migration.
5. Compare totals.
6. Document rollback.
7. Perform cutover.

### Validation

- no data loss;
- totals remain correct;
- imported ING transaction count matches expected;
- reports match expected historical data.

## 15. Test strategy

Minimum tests:

- ING parser tests;
- malformed file tests;
- duplicate import tests;
- category matching tests;
- review queue tests;
- report aggregation tests;
- balance carry-forward tests;
- role authorization tests;
- audit log tests.

Manual checks:

- import same ING export twice;
- import wrong file;
- review one transaction;
- bulk approve recurring transactions;
- generate monthly report;
- generate year report;
- send monthly email summary;
- verify viewer cannot edit.

## 16. Known blockers/unknowns

- Exact uploaded ING export format still needs direct inspection.
- Current production categories and data need later assessment.
- Current Resend summary implementation needs inventory.
- Brain repo ING Playwright downloader automation needs search and review before integration.
- Local tests previously failed because `vitest` was not found in the local environment, likely dependencies not installed or unavailable in the command context.

## 17. Next executable step

Create the UI design brief/prompt and run the prototype/design phase before code cleanup.
