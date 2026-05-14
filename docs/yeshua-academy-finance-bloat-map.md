# Yeshua Academy Finance — Bloat Map

Status: inventory and cleanup planning, no deletion performed  
Date: 2026-05-14  
Depends on: `PRODUCT.md`, `DESIGN.md`, `docs/yeshua-ledger-lite-requirements.md`, `docs/yeshua-academy-finance-roadmap.md`

## 1. Purpose

This document maps the current repo into:

- **keep**: belongs to the ledger product;
- **refactor**: useful but must be simplified, localized, or redesigned;
- **remove**: approved bloat or unrelated template/SaaS code;
- **replace**: useful concept, wrong implementation;
- **defer/inspect**: unclear or risky until production data/migration is known.

No files were deleted while creating this map.

## 2. Cleanup principle

Keep only what serves:

```text
ING import → dedupe → categorisatie → review → dashboard → maandrapport → jaarrapport → ANBI/interne verantwoording
```

Remove or replace anything whose main purpose is:

- SaaS billing;
- public marketing;
- waiting list;
- blog/content marketing;
- Make/n8n/scenario automation;
- Stripe/Clerk boilerplate;
- generic MicroSaaS builder documentation;
- unused template assets;
- invoice/checkout flows;
- generic product landing-page UI.

## 3. High-level findings

### Ledger core exists and should be preserved

The `server/` folder is mostly relevant ledger infrastructure:

- import upload;
- ledger API;
- accounts/opening balances;
- reconciliation;
- review routes;
- categorization rules;
- transaction fingerprinting/matching.

This should be **kept/refactored**, not deleted.

### UI and app shell are bloated

`src/app` still contains:

- marketing homepage;
- blog;
- waiting list;
- Stripe API routes;
- request-access flow;
- Make/n8n routes;
- Clerk sign-in/sign-up routes;
- success/approval pages;
- privacy/TOS pages from SaaS template;
- a very large ledger page.

This is where most user-visible simplification should happen.

### Prisma schema mixes ledger and SaaS template models

Ledger models exist and are valuable. Legacy models are also present:

- `Subscription`;
- `Project` for scenario/automation;
- `Audiences` for Resend waiting-list audience.

These should not be removed until a migration strategy exists, but they are cleanup targets.

### Email exists but needs product refactor

Resend is useful and should be retained, but the current implementation is partly waiting-list/invoice/export-email oriented and English. It should become a Dutch monthly finance-summary service.

### Auth exists but is the wrong future direction

Clerk is present as dependency/routes/instructions/stubs. Future direction is Ory. Clerk removal should be delayed until Ory is implemented and audit-user identity is solved.

## 4. Routes and pages map

### 4.1 Keep/refactor product routes

| Path | Status | Notes |
|---|---|---|
| `src/app/dashboard/page.tsx` | replace/refactor | Current dashboard is English, dark, and sparse. Replace with prototype-derived Dutch dashboard. |
| `src/app/ledger/page.tsx` | refactor heavily | Large file (~108 KB). Contains useful ledger functionality but must be decomposed and made secondary/drilldown. |
| `src/app/review/page.tsx` | refactor | Relevant workflow, but UI/model must match 100% auto-match vs manual review queue. |
| `src/app/prototype/page.tsx` | temporary keep | Isolated prototype route. Use as design reference, later remove after real UI is implemented. |
| `src/app/api/ledger/export-xlsx/route.ts` | replace/refactor | Currently creates XLSX backup. Requirement now says only original ING export download is required, but this may help migration/checking. |
| `src/app/api/ledger/notify/route.ts` | refactor | Useful Resend surface, but English/export-attachment oriented. Convert to Dutch monthly financial summary later. |
| `src/app/api/health/route.ts` | keep | Health check is useful. |
| `src/app/layout.tsx` | refactor | Currently global Header, English html lang, marketing shell. Must become private app shell. |
| `src/app/error.tsx` | refactor | Likely template-heavy. Dutch product error page needed. |
| `src/app/not-found.tsx` | refactor/remove | Large template page. Replace with simple Dutch private-app 404. |

### 4.2 Approved removal candidates, route level

| Path | Status | Reason |
|---|---|---|
| `src/app/page.tsx` | replace | Current public marketing homepage imports Header/Hero/Comparison/Features/FAQ/Footer. Root should go to dashboard/private app. |
| `src/app/blog/**` | remove | Blog/content marketing is out of scope. |
| `src/app/waiting-list/**` | remove | Waiting list is out of scope. |
| `src/app/api/waiting-list/route.ts` | remove/replace | Waiting-list audience is bloat. Email recipients should be finance summary recipients instead. |
| `src/app/api/stripe/**` | remove | Stripe/payment SaaS code is approved for removal. |
| `src/app/api/webhook/stripe/**` | remove | Stripe webhooks are out of scope. |
| `src/app/api/request-access/**` | remove/replace | Request-access flow is template/SaaS. Future users handled through Ory/admin flow. |
| `src/app/approval-success/**` | remove | Supports request-access flow. |
| `src/app/approval-denied/**` | remove | Supports request-access flow. |
| `src/app/success/**` | remove | Stripe/checkout success style route. |
| `src/app/api/(make)/**` | remove | Make/scenario automation is out of scope. |
| `src/app/api/(n8n)/**` | remove | n8n workflow surface is out of scope. |
| `src/app/chat/[projectID]/page.tsx` | remove | Scenario/project chat unrelated to finance ledger. |
| `src/app/privacy-policy/**` | remove or replace with minimal internal notice | Public SaaS legal page is out of scope. Keep only if required for private internal app. |
| `src/app/tos/**` | remove or replace with minimal internal notice | Public SaaS legal page is out of scope. |
| `src/app/sitemap.ts` | remove/refactor | Public marketing SEO artifact; private app likely does not need sitemap. |

### 4.3 Auth routes

| Path | Status | Notes |
|---|---|---|
| `src/app/sign-in/**` | replace later | Currently Clerk-shaped. Keep until Ory replacement is designed. |
| `src/app/sign-up/**` | remove/replace later | Public sign-up likely not needed. Ory/admin user provisioning should define future behavior. |

## 5. Components map

### 5.1 Keep/refactor finance components

| Path | Status | Notes |
|---|---|---|
| `src/components/ledger/AccountBadge.tsx` | keep/refactor | Finance-specific. |
| `src/components/ledger/ExportActions.tsx` | refactor | Current export scope likely too broad. Preserve useful pieces for original ING export/download/report actions. |
| `src/components/ledger/LedgerTable.tsx` | refactor | Useful but should become drilldown, not dashboard. |
| `src/components/ledger/ReconciliationCard.tsx` | refactor | Useful for balance checks/year carry-forward, but UI likely too complex. |
| `src/components/ledger/UploadCsvButton.tsx` | refactor/replace | Useful import concept, should become Dutch import flow. |
| `src/components/review/ReviewTable.tsx` | refactor | Useful but review should not be table-first by default. |
| `src/components/review/RuleManager.tsx` | refactor | Useful for admin/category matching rules, but should be simplified. |
| `src/components/ui/**` | keep | Reusable primitives. |
| `src/ui/**` | keep/refactor | Small reusable product UI primitives. |
| `src/components/providers.tsx` | keep/refactor | Needs auth/app-shell cleanup later. |

### 5.2 Remove candidates, marketing/SaaS components

| Path | Status | Reason |
|---|---|---|
| `src/components/Hero.tsx` | remove | Marketing homepage. |
| `src/components/Comparison.tsx` | remove | Marketing homepage. |
| `src/components/Features.tsx` | remove | Marketing homepage. |
| `src/components/FAQ.tsx` | remove | Marketing homepage. |
| `src/components/Footer.tsx` | remove/replace | Public marketing footer not needed. |
| `src/components/Header.tsx` | replace | Marketing/public header; app needs private finance shell. |
| `src/components/Pricing.tsx` | remove | Stripe/SaaS billing. |
| `src/components/PricingSection.tsx` | remove | Stripe/SaaS billing. |
| `src/components/PriceItem.tsx` | remove | Stripe/SaaS billing. |
| `src/components/CheckoutButton.tsx` | remove | Stripe/SaaS billing. |
| `src/components/StripePortalButton.tsx` | remove | Stripe/SaaS billing. |
| `src/components/WaitingListHero.tsx` | remove | Waiting list out of scope. |
| `src/components/BlogCard.tsx` | remove | Blog out of scope. |
| `src/components/BlogDetails.tsx` | remove | Blog out of scope. |
| `src/components/BlogMoreArticles.tsx` | remove | Blog out of scope. |
| `src/components/BlogSpotlight.tsx` | remove | Blog out of scope. |
| `src/components/BlogsListing.tsx` | remove | Blog out of scope. |
| `src/components/Testimonials*.tsx/jsx` | remove | Marketing/testimonial bloat. |
| `src/components/TestimonialRating.tsx` | remove | Marketing/testimonial bloat. |
| `src/components/SaveMoney.tsx` | remove | Marketing/SaaS. |
| `src/components/ZeroRisk.tsx` | remove | Marketing/SaaS. |
| `src/components/Marketing.tsx` | remove | Marketing/SaaS. |
| `src/components/AboutMe.tsx` | remove/inspect | Likely not finance administration. |
| `src/components/Scenarios.tsx` | remove | Automation/scenario feature out of scope. |
| `src/components/login-payment.tsx` | remove | Payment/auth SaaS flow. |
| `src/components/ButtonSignin.tsx` | replace later | Clerk auth component. Keep only until Ory flow exists. |
| `src/components/email-templates/Invoice.tsx` | remove | Invoice feature out of scope. |
| `src/components/email-templates/ThanksYouTemplate.tsx` | replace/refactor | Waiting list/thank-you style email; monthly finance summary needs new template. |

## 6. Server/backend map

### 6.1 Keep/refactor

| Path | Status | Notes |
|---|---|---|
| `server/index.ts` | keep/refactor | Core Express API wiring for ledger. |
| `server/routes/upload.ts` | keep/refactor | Core import endpoint. Needs Dutch error model and safer preview/import flow. |
| `server/routes/ledger.ts` | keep/refactor | Core ledger listing/summary. |
| `server/routes/review.ts` | refactor | Current review logic likely too tied to `categoryId: null`. Needs explicit review status/source. |
| `server/routes/rules.ts` | keep/refactor | Categorization rules are important. Simplify UX/API later. |
| `server/routes/accounts.ts` | keep/refactor | Multiple ING accounts and savings account require this. |
| `server/routes/reconciliation.ts` | keep/refactor | Needed for total/balance checks. |
| `server/routes/ledgers.ts` | keep/refactor | Month/year lock may be config/optional but useful. |
| `server/services/importService.ts` | keep/refactor | Core import logic. Must be hardened. |
| `server/services/ruleEngine.ts` | keep/refactor | Core auto-categorization. |
| `server/services/transactionMatching.ts` | keep/refactor | Core matching/dedupe review candidate. |
| `server/services/transactionFingerprint.ts` | keep/refactor | Core dedupe/fingerprint. |
| `server/services/reconciliationService.ts` | keep/refactor | Core balance validation. |
| `server/services/categorizationService.ts` | keep/refactor | Core category/history logic. |
| `server/services/reviewQueueService.ts` | refactor | Currently tiny; likely should become explicit review model/service. |
| `server/db/ensureCategorizationRuleConditions.ts` | keep short-term | Runtime schema patch helper. Later migrate properly. |

### 6.2 Caution areas

| Path | Status | Notes |
|---|---|---|
| `server/scripts/add-categorization-rule-conditions.ts` | defer | Utility script; keep until schema cleanup. |
| `scripts/patch-prod-conditions.mjs` | defer | Production patch script; do not remove until migration plan. |
| `scripts/reset-and-import.mjs` | inspect/defer | Could be useful for controlled reimport but risky. |
| `scripts/reimport-ledger.ts` | inspect/defer | Could be useful for data migration/import testing. |
| `scripts/sync-tenant-data.mjs` | likely remove later | Tenant/SaaS concept likely obsolete, but inspect before deletion. |
| `scripts/provision-tenant.mjs` | likely remove later | SaaS tenant provisioning. |
| `scripts/provision-saas.sh` | remove | SaaS provisioning bloat. |
| `scripts/check-env.js` | replace | Currently requires Clerk/Stripe. Replace with Ory/Resend/DATABASE/API env checks later. |

## 7. Prisma/data model map

### 7.1 Keep/refactor models

| Model | Status | Notes |
|---|---|---|
| `User` | refactor | Keep user concept; future identity should map to Ory, with admin/viewer roles. |
| `Account` | keep/refactor | Needed for multiple ING accounts and savings. |
| `OpeningBalance` | keep/refactor | Needed for balance sheet/carry-forward. |
| `Ledger` | keep/refactor | Month/year concept useful. Monthly lock optional/configurable. |
| `LedgerLock` | keep/refactor | Optional/configurable; not top priority. |
| `ImportBatch` | keep/refactor | Core source-of-truth import record. May need original export storage metadata. |
| `Transaction` | keep/refactor | Core. Needs classification fields, review status, notes, audit, maybe manual correction handling. |
| `Category` | refactor | Current unique flat name may not express main/subcategory/project cleanly. Preserve existing taxonomy first. |
| `CategorizationRule` | keep/refactor | Core 100% match and suggestions. |

### 7.2 Remove/replace models after migration plan

| Model | Status | Reason |
|---|---|---|
| `Subscription` | remove later | Stripe/SaaS billing is out of scope. Requires migration confirmation. |
| `Project` | remove/replace later | Current model is automation/scenario-oriented, not finance project/fund. Replace with finance `Fund`/`Project` if needed. |
| `Audiences` | replace later | Current model supports Resend waiting-list audience. Finance summary recipients need a dedicated model. |
| `SubscriptionStatus` enum | remove later | Only used by `Subscription`. |

### 7.3 New/changed model candidates

Do not implement until requirements are frozen and migration strategy exists.

Candidate additions/refactors:

- `Role` or `UserRole` enum: admin/viewer.
- `Fund` or `ProjectFund`: one per transaction, no splits.
- `TransactionNote`: optional notes hidden from main UI.
- `AuditLog`: who changed what.
- `MonthlyReport` or report snapshot metadata, if reproducibility requires it.
- `YearReport` or annual report notes/explanations.
- `ImportFile` or stored original ING export metadata.
- `EmailRecipient` for monthly financial summary recipients.
- explicit review status on `Transaction` or separate review table.

## 8. Dependency map

### 8.1 Keep likely

| Dependency | Status | Reason |
|---|---|---|
| `next`, `react`, `react-dom` | keep | Core app. |
| `@prisma/client`, `prisma`, `pg` | keep | Core database. |
| `express`, `cors`, `multer` | keep/refactor | Current API server and file upload. |
| `fast-csv`, `papaparse`, `xlsx` | keep short-term | CSV/XLSX import/export. Later reduce if format scope narrows. |
| `resend`, `react-email`, `@react-email/components` | keep/refactor | Monthly summary emails. |
| `zod` | keep | Validation useful. |
| `recharts` | keep | Dashboard charts. |
| Radix UI primitives | keep | Product UI primitives. |
| `lucide-react` | keep | Icons. |
| `tailwindcss`, `tailwind-merge`, `class-variance-authority` | keep | UI styling. |
| `vitest` | keep | Tests. |

### 8.2 Remove candidates after code cleanup

These require code removal first and protected `package.json`/lockfile confirmation later.

| Dependency | Status | Reason |
|---|---|---|
| `stripe`, `@stripe/stripe-js` | remove | Billing out of scope. |
| `@clerk/nextjs` | replace later | Future auth is Ory. Remove only after Ory implementation. |
| `@mdx-js/loader`, `@mdx-js/react`, `@next/mdx` | remove | Blog/MDX out of scope. |
| `@strapi/blocks-react-renderer` | remove | Content/blog bloat. |
| `wpapi`, `@types/wpapi` | remove | WordPress/blog bloat. |
| `html2canvas`, `html2pdf.js`, `jspdf` | likely remove | PDF export not required now. Verify no report feature needs them. |
| `formik`, `yup` | likely remove | Template forms. Prefer simpler form/state or zod. |
| `react-responsive-masonry` | remove | Marketing/gallery bloat unless used in product UI. |
| `react-syntax-highlighter` | remove | Blog/code display bloat. |
| `react-to-print` | likely remove | Printing/PDF not required now. |
| `next-plausible` | likely remove | Public marketing analytics not needed for private app. |
| `@next/third-parties` | likely remove | Marketing analytics/script bloat. |
| `prop-types` | likely remove | Legacy React component bloat. |
| `daisyui` | likely remove later | New design system should not depend on DaisyUI template unless retained intentionally. |
| `sass` | inspect/remove | Keep only if styles require it after UI rebuild. |
| `newrelic` | inspect | Could be deployment monitoring. Do not remove without ops decision. |
| `axios`, `form-data` | inspect | May be used by Make/n8n/GPT utilities. Remove if unused after cleanup. |

## 9. Config and environment map

| Path | Status | Notes |
|---|---|---|
| `src/config.ts` | refactor | Remove Stripe product config. Keep appName/domain/resend. Convert copy to finance/product config. |
| `.env.example` | refactor | Must remove Clerk/Stripe requirements and add Ory/import/API variables later. |
| `scripts/check-env.js` | replace | Currently requires `CLERK_SECRET_KEY`, `STRIPE_SECRET_KEY`. Wrong future direction. |
| `src/middleware.ts` | refactor/replace | Current public route/auth shape likely Clerk/template. Future private-only Ory route protection. |
| `next.config.js` | inspect | Might include MDX/WordPress/standalone/deploy settings. |
| `Dockerfile`, `docker-compose.yml`, `nginx.conf` | keep/defer | Deployment files are protected. Do not modify until app architecture is stable. |

## 10. Libraries/helpers map

| Path | Status | Notes |
|---|---|---|
| `src/libs/api.ts` | keep/refactor | Client API wrapper for ledger routes. |
| `src/libs/prisma.ts` | keep | Prisma client. |
| `src/libs/resend.ts` | refactor | Keep Resend client, remove waiting-list/invoice concepts, add finance summary recipients. |
| `src/libs/stripe.ts` | remove | Stripe out of scope. |
| `src/libs/wp.ts` | remove | WordPress/blog out of scope. |
| `src/libs/gpt.ts` | inspect/remove | Likely generic/AI feature, not core ledger. |
| `src/helpers/export-utils.ts` | refactor | Useful export/report helper candidate, but current export scope may not match requirements. |
| `src/helpers/transaction-tooltip.ts` | keep/refactor | Transaction details hidden/tooltip concept useful. |
| `src/helpers/checkout.ts` | remove | Stripe checkout. |
| `src/utils/request-access.ts` | remove/replace | Request access flow out of scope. |
| `src/utils/clerkClient.tsx` | replace later | Clerk compatibility layer. Keep until Ory replacement. |
| `src/utils/auth.ts` | refactor | Auth enable/disable likely useful but future Ory model needed. |
| `src/utils/data.ts` | remove/inspect | Large likely template/mock content. |
| `src/data/initial-ledger.json` | keep/defer | Generated from provided spreadsheet; useful for taxonomy/reference until migration complete. |

## 11. Assets and public files map

| Path | Status | Notes |
|---|---|---|
| `public/blog/**` | remove | Blog out of scope. |
| `public/scenarios/**` | remove | Scenario/automation out of scope. |
| `public/social/**` | inspect/remove | Likely marketing/share assets. |
| `public/assets/**` | inspect/remove | Template assets likely unused. |
| `src/assets/images/**` | inspect/remove | Many likely marketing images. Keep only app logo/favicon if desired. |
| `src/app/opengraph-image.png`, `src/app/twitter-image.png` | remove/replace | Public marketing SEO not needed for private app. |
| `src/app/favicon.ico`, `src/app/icon.png`, `src/app/apple-icon.png` | keep/replace | Keep if branded correctly, otherwise replace later. |

## 12. Documentation map

### 12.1 Keep

| Path | Status | Notes |
|---|---|---|
| `PRODUCT.md` | keep | New product source of truth. |
| `DESIGN.md` | keep | New design system direction. |
| `README.md` | refactor | Keep but update after cleanup. |
| `STATUS.md` | refactor | Keep but align with new roadmap. |
| `docs/**` new planning docs | keep | Current roadmap/requirements/prototype docs. |
| `docs/git-workflow.md` | keep | Workflow reference. |

### 12.2 Remove/replace later

| Path | Status | Reason |
|---|---|---|
| `instructions/stripe.md` | remove | Stripe out of scope. |
| `instructions/clerk.md` | replace | Clerk no longer future auth direction. |
| `instructions/scaling.md` | inspect/remove | Generic SaaS boilerplate likely not useful. |
| `instructions/structure.md` | refactor/replace | May mention old structure; align after cleanup. |
| `instructions/troubleshooting.md` | inspect/refactor | Keep only deployment/finance-relevant parts. |
| `GPT5.1_SaaS_Builder_Reference_Document_v2.md` | remove | SaaS builder boilerplate. |
| `codex-db-automation.md` | inspect/refactor | May contain useful DB notes. |
| `codex-tenant-cleanup.md` | inspect/remove | Tenant/SaaS cleanup likely obsolete after product direction. |

## 13. Tests map

| Path | Status | Notes |
|---|---|---|
| `tests/import/**` | keep/refactor | Important for ING import/dedupe hardening. |
| `tests/services/**` | keep/refactor | Important for services. |
| `server/services/__tests__/ruleEngine.test.ts` | keep/refactor | Categorization rule testing. |
| `vitest.config.ts` | keep | Testing. |

Needed new tests later:

- wrong file import;
- same file duplicate import;
- duplicate row import;
- 100% match auto-categorization;
- non-100% suggestion requires review;
- balance validation after manual correction;
- Dutch error message checks;
- monthly/year report aggregation;
- carried balance check;
- admin/viewer permission checks;
- audit log checks.

## 14. Suggested cleanup order

### Step 1 — Safe non-destructive preparation

- Keep current planning docs.
- Review prototype visually.
- Decide whether prototype layout becomes real app shell.
- Run dependency install/build in a proper local environment to establish baseline.

### Step 2 — Replace root/app shell first

Goal: private app opens to dashboard.

Likely changes:

- replace `src/app/page.tsx` with dashboard redirect or dashboard shell;
- refactor `src/app/layout.tsx` to Dutch/private shell;
- remove global marketing Header usage;
- keep `/prototype` temporarily for comparison.

### Step 3 — Remove public marketing/blog/waiting-list UI

Delete only after Step 2 works.

Targets:

- blog routes/components/assets;
- waiting-list route/components/API;
- marketing homepage components;
- testimonials/pricing/FAQ/hero/etc.

### Step 4 — Remove Stripe billing code

Requires confirmation because package and possibly Prisma cleanup are protected/risky.

Targets:

- Stripe API routes;
- webhook route;
- Stripe libs/helpers/components/icons/types;
- Stripe config products;
- `Subscription` model later through migration;
- package dependencies after code references are gone.

### Step 5 — Refactor Resend to monthly finance summaries

Do not delete Resend.

Targets:

- replace waiting-list/audience model with finance summary recipients;
- Dutch monthly summary copy;
- align email content with dashboard numbers.

### Step 6 — Auth transition

Do not remove Clerk until Ory is implemented.

Targets:

- design Ory session mapping;
- admin/viewer roles;
- audit user identity;
- remove Clerk routes/dependency after verified replacement.

### Step 7 — Prisma/model cleanup

Requires migration plan, data snapshot, and explicit confirmation.

Targets:

- remove `Subscription`;
- remove/replace automation `Project`;
- replace `Audiences`;
- add/refactor finance project/fund, email recipients, audit log, review status, transaction notes, import file metadata.

### Step 8 — Dependency cleanup

Only after code references are removed.

Targets:

- package.json;
- package-lock.json.

Protected/confirmation-required.

## 15. High-risk changes requiring explicit confirmation

Do not do these casually:

- deleting directories recursively;
- changing `package.json` / `package-lock.json`;
- editing Prisma migrations;
- altering `prisma/schema.prisma` in a way that affects production data;
- changing Dockerfile/docker-compose/deployment files;
- changing auth provider behavior;
- changing production import scripts;
- removing data files in `sheets/` or `src/data/initial-ledger.json` before migration is complete.

## 16. Immediate next implementation recommendation

Before deletion, do one of these two safe implementation paths:

### Option A, UI-first safe path

1. Convert prototype into real reusable components.
2. Replace dashboard with Dutch prototype-based dashboard.
3. Replace root route to private dashboard.
4. Keep old ledger/review routes available temporarily.
5. Then remove marketing bloat.

Best if visual direction is approved.

### Option B, import-first safe path

1. Inspect uploaded ING export and parser tests.
2. Harden import validation and duplicate messages.
3. Add Dutch import error/success model.
4. Add tests.
5. Then return to UI cleanup.

Best if correctness should lead before UI.

Recommended: **Option A after prototype approval**, because the UI direction is now clear and the current app shell is one of the largest sources of confusion.

## 17. Validation state from current session

Validation attempted earlier:

- `type_check_web` failed because BuildFlow's command expects an `apps/web` monorepo layout that this repo does not use.
- `npm run build` failed because the local command environment is missing dependency/type availability such as `@prisma/client`, `express`, `@types/node`, `vitest`, etc. This appears environmental/baseline, not specific to the bloat map.

Before cleanup begins, run validation in a proper local environment with dependencies installed/generated:

```bash
npm install
npm run build
npm test
```

Do not install dependencies through BuildFlow unless explicitly approved.
