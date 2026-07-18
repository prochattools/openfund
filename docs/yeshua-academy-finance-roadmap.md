# Yeshua Academy Finance — Roadmap

Status: SUPERSEDED  
Canonical replacement: `docs/ROADMAP.md`  
This document must not govern new implementation and is retained for historical context.

Status: roadmap baseline after interview  
Date: 2026-05-14  
Product name remains: **Yeshua Academy Finance**  
Design concept: **Yeshua Ledger Lite**

## 1. Roadmap goal

Turn the existing finance repo into a clean, Dutch-only, foolproof church/ANBI ledger application.

The target workflow is:

```text
Login → Dashboard → Import ING maandexport → Automatische categorisatie → Handmatige review waar nodig → Maandrapport → Jaarrapport
```

The app should be simple enough that a user immediately understands income, expenses, and what still needs attention.

## 2. Non-negotiable decisions

- Keep the app/repo product name as **Yeshua Academy Finance**.
- UI is Dutch only.
- App is private-only, no public marketing site.
- Bank import is ING-only for now.
- Monthly import is the primary workflow.
- The ING export is the transaction source of truth.
- Duplicate imports must be safe and automatically ignored.
- No generic evidence/attachment system.
- Store/export original ING exports.
- No PDF export for now.
- No ZIP export for now.
- No donor/giver summaries for now.
- Keep and improve existing Resend monthly summary functionality.
- Use Ory auth, not Clerk as the future direction.
- Admin and viewer roles only.
- Manual transaction edits/deletes are possible only through hidden admin/safe-mode flows.
- Every manual change must trigger audit logging and total checks.
- Current deployed app is not in active use and may go offline during redesign.
- Production data must be retained and migrated carefully later.

## 3. Phase 0 — Documentation and product alignment

Status: in progress.

### Goals

- Freeze interview answers into repo docs.
- Establish legal/product baseline for kerkgenootschap with ANBI status.
- Decide product scope before code changes.
- Avoid premature cleanup before we know what must stay.

### Deliverables

- `docs/yeshua-ledger-lite-discovery-plan.md`
- `docs/yeshua-ledger-lite-requirements.md`
- `docs/yeshua-academy-finance-roadmap.md`
- `docs/yeshua-academy-finance-implementation-plan.md`
- `docs/yeshua-academy-finance-ui-design-brief.md`
- `DESIGN.md` after prototype approval
- Optional `PRODUCT.md` after design-orchestrator output

### Acceptance criteria

- Requirements reflect stakeholder answers.
- No implementation begins before roadmap is reviewed.
- Public ANBI requirements and internal balance-sheet requirement are both acknowledged.

## 4. Phase 1 — UI prototype through design orchestrator

Status: next.

### Goals

Create a clean product UI direction before touching the current UI.

Use the Brain repo design orchestrator principles from:

- `brain/ai/skills/custom/design/SKILL.md`

This is an existing project upgrade, register: Product, project type: SaaS/dashboard/tool.

### Prototype scope

Prototype only the core screens:

1. Login/auth shell assumption.
2. Dashboard after login.
3. Import monthly ING export.
4. Review queue.
5. Ledger drilldown.
6. Year report view.
7. Settings/admin safe-mode entry.

### UI principles

- Dutch-only labels.
- Big numbers first.
- Cards before tables.
- Tables only where necessary.
- One-click import.
- Month-first, year switch available.
- No marketing layout.
- No AI-looking generic dashboard.
- No visual clutter.
- No excessive filters/menus/tabs.
- Hidden raw transaction metadata until drilldown.
- Clear natural-language success/warning/error states.

### Acceptance criteria

- Stakeholder approves visual direction.
- Prototype demonstrates import → review → dashboard/report flow.
- Design avoids current cramped/ugly layout.
- Prototype produces enough guidance to write `DESIGN.md`.

## 5. Phase 2 — Current repo inventory and bloat map

Status: after UI prototype approval.

### Goals

Make a precise keep/remove/replace plan before destructive cleanup.

### Inventory targets

#### Keep or refactor

- ING import parser.
- Import dedupe hashing.
- Ledger transaction model.
- Account model.
- Opening balance / reconciliation concepts.
- Categorization rule engine.
- Review queue logic.
- Resend monthly summary logic.
- Docker/deploy runtime if still valid.

#### Remove or replace

- Stripe/subscription code.
- Clerk-first auth code, replaced by Ory direction.
- Marketing homepage.
- Blog.
- Waiting list.
- FAQ/TOS/privacy public SaaS pages unless legal/internal docs require a minimal private notice.
- Make/n8n/project/scenario code unrelated to ledger.
- Unused image/template assets.
- SaaS template docs.
- Old generic product branding.
- Overcomplicated dashboard/review layout.

### Deliverables

- `docs/yeshua-academy-finance-bloat-map.md`
- exact file list: keep/remove/replace/unknown;
- dependency list: keep/remove/replace;
- route list: keep/remove/replace;
- Prisma model list: keep/remove/replace;
- migration risk list.

### Acceptance criteria

- No broad deletion happens before this map is reviewed.
- Protected/destructive files are handled in separate confirmed steps.

## 6. Phase 3 — Import and data safety hardening

Status: after bloat map.

### Goals

Make import foolproof before UI polish or large feature expansion.

### Tasks

1. Confirm uploaded ING export format and fields.
2. Document import contract: required columns, optional columns, balance/saldo column behavior.
3. Add/keep import preview step.
4. Harden file validation.
5. Ensure wrong-format files fail safely with Dutch message.
6. Ensure duplicate import rows are ignored automatically.
7. Ensure import summary shows:
   - new transactions;
   - duplicates ignored;
   - rows with errors;
   - month/account detected.
8. Store original ING export information.
9. Ensure every transaction links to import batch.
10. Add totals/balance validation after import.

### Acceptance criteria

- Importing same file repeatedly never duplicates transactions.
- Importing wrong file never crashes app.
- Importing malformed file never silently corrupts data.
- User receives Dutch natural-language feedback.
- All imported rows are traceable to a batch.

## 7. Phase 4 — Category, subcategory, and project/fund model

Status: after import hardening.

### Goals

Preserve existing administration taxonomy and make it clean.

### Known repo clue

`scripts/generate-initial-ledger.js` reads:

- workbook: `sheets/Overzicht_Yeshua_Academy_Jun_2025.xlsx`
- sheet: `transacties 2025`
- main category: `Categorie`
- subcategory/destination: `bestemming`

This confirms the current spreadsheet uses at least main category and bestemming/subcategory concepts.

### Tasks

1. Inspect current app categories from production or seed/source data.
2. Inspect uploaded worksheet categories.
3. Preserve current category/subcategory/project/fund taxonomy.
4. Define a clean data model:
   - category group/type: income/expense;
   - main category;
   - subcategory;
   - project/fund where needed.
5. Enforce no multi-project split for one transaction.
6. Allow admins to create new categories and funds/projects.
7. Make category creation simple and safe.

### Acceptance criteria

- No invented taxonomy.
- Existing categories are preserved.
- Every transaction can have income/expense, main category, subcategory, and project/fund where applicable.
- Admins can add new categories/projects without breaking reports.

## 8. Phase 5 — Auto-categorization and review workflow

Status: after model cleanup.

### Goals

Reduce manual work and avoid miscategorization.

### Tasks

1. Define 100% historical match rules.
2. Auto-categorize only full matches.
3. Suggest non-full matches but send them to review.
4. Never auto-approve non-full matches.
5. Add one-at-a-time review mode.
6. Add table/list review mode.
7. Add bulk actions for obvious recurring groups.
8. Add admin correction path.
9. Log all manual category changes.
10. Run total checks after manual changes.

### Acceptance criteria

- Recurring transactions categorize automatically.
- New/uncertain transactions enter review queue.
- Review queue is clear and not table-heavy by default.
- Misclassification risk is reduced.
- Every manual change is audit logged.

## 9. Phase 6 — UI rebuild

Status: after design approval and core workflow decisions.

### Goals

Replace the current UI with a clean, Dutch, card-first product interface.

### Core screens

1. **Dashboard**
   - default after login;
   - last month insight;
   - income, expenses, net flow;
   - charts/cards;
   - review workload;
   - import button.

2. **Importeren**
   - upload monthly ING export;
   - preview;
   - summary;
   - Dutch feedback.

3. **Te beoordelen**
   - transaction queue;
   - one-by-one mode;
   - optional table mode;
   - bulk recurring actions.

4. **Transacties**
   - detailed drilldown;
   - search/filter;
   - hidden raw metadata until expanded.

5. **Jaaroverzicht**
   - yearly income/expense view;
   - balance sheet/carry-forward;
   - public ANBI view;
   - internal detail view.

6. **Instellingen**
   - users/roles;
   - categories/projects;
   - email recipients;
   - admin safe-mode for manual edits/deletes;
   - import/download original ING exports.

### Acceptance criteria

- User sees essential insight immediately after login.
- One-click import is available.
- Notes/descriptions/account numbers are hidden until needed.
- Tables do not dominate the dashboard.
- UI is Dutch-only.
- Design does not look generic or AI-generated.

## 10. Phase 7 — Reports, balance sheet, and year close

Status: after UI/core workflow.

### Goals

Support the January–December year cycle, public ANBI report, and internal year report.

### Tasks

1. Implement monthly report data model/server aggregation.
2. Implement yearly report aggregation.
3. Implement balance sheet / carried balance behavior.
4. Support closing the year and carrying forward starting balance.
5. Add report notes/explanations.
6. Add high-level public ANBI report view.
7. Add internal detailed view.
8. Ensure totals stay in balance.
9. Keep reports reproducible from imported transactions.

### Acceptance criteria

- Monthly report shows money flow by category.
- Year report shows same for full year.
- Balance carries from year to year.
- Public report can be generated from the same source data.
- Admin can understand and verify totals.

## 11. Phase 8 — Email summary integration

Status: after dashboard/report stabilizes.

### Goals

Keep and improve existing Resend monthly summary functionality.

### Tasks

1. Locate existing Resend implementation.
2. Preserve recipient management.
3. Align summary content with new monthly dashboard.
4. Make sending flow simple.
5. Add audit/log status for sent summaries.
6. Dutch-only email content.

### Acceptance criteria

- Existing monthly email function still works.
- Email content matches dashboard/report numbers.
- Recipient management is simple.

## 12. Phase 9 — Ory auth and permissions

Status: after UI scope is clear.

### Goals

Move future auth direction to Ory and roles admin/viewer.

### Tasks

1. Inventory current Clerk usage.
2. Design Ory integration boundary.
3. Implement user session lookup.
4. Implement admin/viewer authorization.
5. Remove or isolate Clerk code after replacement is verified.
6. Ensure each user logs in individually.

### Acceptance criteria

- Admin/viewer roles work.
- Individual users are identifiable for audit logs.
- Clerk is no longer the product direction.

## 13. Phase 10 — Production data assessment and migration

Status: after redesigned app is ready enough.

### Goals

Retain production data and migrate safely.

### Tasks

1. Snapshot current production schema/data.
2. Compare production data against new model.
3. Define migration script.
4. Dry-run migration.
5. Compare totals before/after.
6. Approve cutover.

### Acceptance criteria

- No production data lost.
- Totals match expected source truth.
- Rollback path exists.

## 14. Phase 11 — Go-live

Status: final.

### Goals

Deploy redesigned application safely.

### Tasks

1. Run build/test/type checks.
2. Validate import with known ING export.
3. Validate duplicate import safety.
4. Validate reports.
5. Validate email summary.
6. Validate auth/roles.
7. Deploy.
8. Perform post-deploy smoke test.

### Acceptance criteria

- App opens to dashboard.
- Import works.
- Review works.
- Monthly/year totals are correct.
- No old marketing/SaaS routes remain publicly visible.

## 15. Immediate next action

Create the UI prototype prompt/brief based on the Brain design orchestrator and this requirements document.
