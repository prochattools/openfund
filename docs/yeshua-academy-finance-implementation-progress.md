# Yeshua Academy Finance — Implementation Progress

Status: active implementation progress log  
Date: 2026-05-14

## 1. Completed in this implementation pass

### Private Dutch dashboard shell

Implemented:

- `src/ui/FinanceDashboard.tsx`
- `src/app/page.tsx`
- `src/app/dashboard/page.tsx`
- `src/app/layout.tsx`
- `src/components/providers.tsx`
- `src/assets/styles/globals.css`

Result:

- Root `/` now opens the Dutch finance dashboard instead of the marketing homepage.
- `/dashboard` now uses the same Dutch dashboard.
- Global marketing header was removed from the root layout.
- HTML language is now `nl`.
- Theme defaults to the calm light finance style.
- The dashboard uses live ledger context data when available.
- Empty state guides the admin to import an ING export.

### Review queue safety

Implemented:

- `server/routes/review.ts`
- `server/services/reviewQueueService.ts`
- `server/routes/ledger.ts`
- `src/context/ledger-context.tsx`
- `tests/services/reviewQueueService.test.ts`

Result:

- Review queue no longer only checks `categoryId: null`.
- Review queue now targets rows that are uncategorized or import-suggested.
- History/rule 100% matches are treated as automatic, not review work.
- `clearReviewQueue` no longer deletes imported transactions.
- Clearing the queue now marks categorized suggestions as manually accepted.
- Ledger totals now count all transactions, not only manual transactions.

### Import hardening

Implemented:

- `server/routes/upload.ts`
- `lib/import/csv_ING.ts`
- `src/libs/api.ts`
- `tests/import/parsers.test.ts`
- `docs/yeshua-academy-finance-ing-import-contract.md`

Result:

- Upload route gives Dutch natural-language messages.
- Empty/wrong/unsupported upload cases are handled with Dutch errors.
- Import summaries include a Dutch message with imported/duplicate/error counts.
- ING parser now validates required columns before processing rows.
- Wrong-format CSV parser test was added.
- ING import contract was documented from the sample bank export.

### Reporting foundation

Implemented:

- `server/services/reportingService.ts`
- `server/routes/reports.ts`
- `server/index.ts`
- `src/libs/api.ts`
- `tests/services/reportingService.test.ts`

Result:

- Added reusable monthly/yearly income/expense aggregation service.
- Added `/api/reports/summary` route.
- Added client API helper for report summaries.
- Added unit tests for monthly/yearly report aggregation.

### Monthly summary email refactor

Implemented:

- `src/app/api/ledger/notify/route.ts`

Result:

- Existing Resend notification route now uses Dutch monthly-finance-summary language.
- Attachment is now optional.
- Response messages are Dutch.
- Existing Resend sending capability is preserved.

### Public bloat surfaces disabled non-destructively

Implemented safe in-place disables for:

- `src/app/blog/page.tsx`
- `src/app/blog/[articleId]/page.tsx`
- `src/app/waiting-list/page.tsx`
- `src/app/success/page.tsx`
- `src/app/approval-success/page.tsx`
- `src/app/approval-denied/page.tsx`
- `src/app/chat/[projectID]/page.tsx`
- `src/app/api/waiting-list/route.ts`
- `src/app/api/stripe/create-checkout/route.ts`
- `src/app/api/stripe/create-portal/route.ts`
- `src/app/api/webhook/stripe/route.ts`
- `src/app/api/request-access/route.ts`
- `src/app/api/request-access/[action]/route.ts`
- `src/app/api/(make)/active/route.ts`
- `src/app/api/(make)/link/route.ts`
- `src/app/api/(make)/scenarios/route.ts`
- `src/app/api/(make)/scenarios/openAIAssistant/route.ts`
- `src/app/api/(n8n)/workflows/openAIAssistant/route.ts`

Result:

- Public marketing/blog/waiting-list/Stripe/request-access/scenario surfaces no longer behave like active product features.
- Files were not deleted because destructive cleanup requires explicit confirmation.
- These routes either redirect to `/` or return Dutch `410` responses.

### Private app routing direction

Implemented:

- `src/middleware.ts`

Result:

- Existing Clerk-based middleware, when auth is enabled, now treats the app as private-first.
- Public exceptions are reduced to sign-in and health checks.
- Full Ory migration is still pending and should be done in a later confirmed auth phase.

## 2. Validation performed

Successful:

- Git diff/stat commands ran successfully.
- Secret-material security scan completed with no findings.

Blocked by environment:

- `npm run lint` failed because `next` is not available in the command environment.
- `npm test -- --test-name-pattern "reporting service"` failed because `vitest` is not available in the command environment.
- Earlier `npm run build` failed because local dependencies/types were unavailable in this BuildFlow command environment.

These validation failures indicate missing local dependencies in the execution environment, not necessarily implementation errors.

## 3. Work intentionally not completed yet

The following are still pending because they are destructive, migration-sensitive, auth-sensitive, package-sensitive, or production-data-sensitive:

- deleting old marketing/blog/Stripe/Make/n8n files and directories;
- changing `package.json` and `package-lock.json`;
- removing Stripe/Clerk dependencies;
- Prisma schema cleanup and migrations;
- replacing Clerk with Ory;
- production data migration;
- Docker/deploy changes;
- deleting public/assets/template images;
- removing old SaaS scripts;
- committing or pushing.

## 4. Recommended next confirmed phase

The next phase should be one of these:

### Option A — Confirm destructive bloat deletion

Delete disabled routes/components/assets/scripts and then clean package dependencies. This requires explicit confirmation because recursive deletion and package-lock changes are protected.

### Option B — Continue non-destructive feature implementation

Continue implementing inside existing files without deleting:

- connect dashboard to `/api/reports/summary`;
- redesign `/ledger` and `/review` using the new design system;
- add import preview UI states;
- add Dutch notification/toast handling;
- add report year view UI.

### Option C — Validate locally first

Run in a local environment with dependencies installed:

```bash
npm install
npm run build
npm test
```

Then fix real type/test failures before continuing.


## 5. Completed in the second non-destructive implementation pass

### Simplified Dutch ledger/import/report page

Implemented:

- `src/ui/FinanceLedgerPage.tsx`
- `src/app/ledger/page.tsx`

Result:

- `/ledger` now uses a simple Dutch finance administration surface instead of the old large English dashboard.
- The page is organized around:
  - monthly totals;
  - ING import;
  - transaction drilldown;
  - year overview;
  - settings/safe-mode concepts.
- The transaction table is secondary and uses expandable row details.
- Raw bank metadata is hidden until a row is opened.
- Manual correction remains represented as a settings/safe-mode concept, not normal workflow.

### Simplified Dutch review flow

Implemented:

- `src/ui/FinanceReviewPage.tsx`
- `src/app/review/page.tsx`

Result:

- `/review` now uses a Dutch, focused review workflow.
- The default view shows one transaction at a time.
- Suggested category information is visible but not auto-approved.
- Admin can choose main category, subcategory, or type a new category name.
- Additional queued transactions are visible as lightweight cards.
- A table view exists only as a secondary expandable mode.
- Empty state clearly says everything is up to date.

### Dutch import button and feedback

Implemented:

- `src/components/ledger/UploadCsvButton.tsx`

Result:

- Import button now says `ING-export importeren`.
- Busy state now says `Importeren…`.
- Success messages use Dutch natural language.
- Warning messages use Dutch row labels.
- API-provided Dutch messages are shown directly when available.
- The button styling now matches the warm finance UI instead of the old blue SaaS UI.

## 6. Validation performed in the second pass

Successful:

- Secret-material security scan completed with no findings for the new ledger/review/import UI files.
- Git diff/stat completed successfully.

Still blocked by environment:

- Full lint/build/test validation still requires local dependencies in the execution environment. Earlier attempts showed `next` and `vitest` are not available.

## 7. Current implementation boundary

The remaining major tasks are now mostly protected or require a proper local build/test environment:

- actual deletion of disabled bloat routes/components/assets;
- `package.json` and lockfile dependency cleanup;
- Prisma schema cleanup and migrations;
- Ory auth replacement;
- production data migration;
- Docker/deploy changes;
- full build/test repair after dependency installation.

Continue non-destructively only if the next target is implementation inside existing allowed files. Continue destructively only after explicit confirmation for deletion/package/schema/deploy changes.


## 8. Completed in the destructive bloat cleanup pass

User gave explicit permission to proceed with the cleanup phase.

### Removed public app surfaces

Deleted:

- `src/app/blog/`
- `src/app/waiting-list/`
- `src/app/success/`
- `src/app/approval-success/`
- `src/app/approval-denied/`
- `src/app/chat/`
- `src/app/api/stripe/`
- `src/app/api/webhook/stripe/`
- `src/app/api/waiting-list/route.ts`
- `src/app/api/request-access/`
- `src/app/api/(make)/`
- `src/app/api/(n8n)/`

Result:

- Old blog, waiting-list, Stripe, request-access, Make, n8n, scenario, approval, and checkout surfaces are no longer present in `src/app`.

### Removed marketing/SaaS components

Deleted:

- marketing homepage components;
- blog components;
- pricing/checkout/Stripe components;
- testimonials/marketing proof components;
- waiting-list component;
- scenario component;
- old login-payment component;
- invoice email template.

Result:

- The old public SaaS component layer is much smaller.
- Remaining component work should focus on finance UI, ledger, review, settings, and auth.

### Removed obsolete finance-app libraries/helpers

Deleted:

- `src/libs/stripe.ts`
- `src/helpers/checkout.ts`
- `src/libs/wp.ts`

Result:

- Stripe and WordPress/blog helper code was removed from the finance app.

### Simplified config and environment templates

Updated:

- `src/config.ts`
- `src/types/config.ts`
- `.env.example`
- `scripts/check-env.js`
- `next.config.js`

Result:

- Stripe config was removed.
- DaisyUI theme import was removed.
- WordPress/Make/n8n/Stripe env template entries were removed.
- Env checking no longer requires Stripe.
- Next image domains were reduced.
- `/api/reports/summary` rewrite was added.

### Dependency metadata cleanup

Updated:

- `package.json`

Removed unused dependency metadata for:

- Stripe;
- MDX/blog;
- WordPress;
- PDF/html export libraries not required now;
- marketing/layout helpers;
- DaisyUI;
- form libraries that belonged to template flows.

Deleted:

- `package-lock.json`

Reason:

- After changing `package.json`, the old lockfile was stale and too large to safely patch manually. It must be regenerated locally with `npm install`.

### Documentation cleanup

Deleted:

- `GPT5.1_SaaS_Builder_Reference_Document_v2.md`
- `instructions/stripe.md`

## 9. Cleanup blocked by source write policy

BuildFlow blocked deletion under `public/**` despite user permission because the source write policy does not allow writing/deleting that path.

Still present and should be removed after write policy is adjusted:

- `public/blog/`
- `public/scenarios/`
- likely unused `public/social/`
- likely unused `public/assets/about-me.png`
- old `public/logo/openfund_*` assets if not used

## 10. Validation after destructive cleanup

Successful:

- `package.json` JSON validation passed.
- Search found no remaining references to Stripe, WordPress, Make, n8n, or removed checkout/blog helpers in source queries used during cleanup.
- Secret-material scan passed for changed config/package files, excluding `.env.example` because BuildFlow security scan blocks env-path inputs.

Still required locally:

```bash
npm install
npm run build
npm test
```

`npm install` is required first because `package-lock.json` was intentionally removed and must be regenerated from the simplified `package.json`.


## 11. Build check after cleanup

Attempted:

```bash
npm run build
```

Result:

- Build failed before meaningful app validation because local dependencies are not installed/resolved after dependency cleanup and lockfile removal.
- Missing modules/types include `fast-csv`, `xlsx`, `express`, `cors`, `multer`, `@prisma/client`, `vitest`, and Node typings.
- This is expected until `npm install` regenerates `package-lock.json` and installs the simplified dependency set.

Next local validation command sequence:

```bash
npm install
npm run build
npm test
```

After dependency installation, any remaining real TypeScript errors should be fixed in a follow-up pass.


## 12. Build repair and continued cleanup pass

User ran local install/build/test. Local tests passed, but build initially failed on server route TypeScript errors and stale imports from deleted bloat.

### Server TypeScript build repairs

Implemented:

- `server/routes/routeParams.ts`
- `server/routes/accounts.ts`
- `server/routes/ledgers.ts`
- `server/routes/review.ts`
- `server/routes/rules.ts`

Result:

- Added a route-param helper to safely narrow Express params from `string | string[]` to `string | null` before Prisma queries.
- Fixed account, ledger, review, and rule route param typing errors.
- Kept Dutch validation/error messages for new missing-id cases.
- Fixed review transaction relation typing by using `include` for ledger lock checks.

### Stale import cleanup after bloat deletion

Removed or repaired stale references to deleted features:

- replaced WordPress/blog sitemap with a minimal app sitemap;
- simplified `src/libs/resend.ts` to generic finance email sending only;
- replaced old waiting-list email event with monthly finance summary event;
- removed obsolete Dashboard, Access, Stripe constants, GPT helper, invoice PDF helper, invoice event file;
- removed old `Header`/`Footer` layout exports and made legacy layout passthrough;
- removed public privacy-policy, TOS, prototype, project API, empty waiting-list/webhook API dirs, and public sign-up route;
- changed Clerk sign-up fallback URL to `/sign-in` because public sign-up is removed.

### Additional component/source cleanup

Deleted unused template/bloat areas:

- unused marketing/template components such as AboutMe, BetterIcon, ButtonGradient, ButtonPopover, HowToUse, Review, ThankyouPopUp;
- unused dashboard component directory;
- unused email template directory;
- unused icon set under `src/icons/`;
- unused large template utility `src/utils/data.ts`;
- unused request-access/sign-up/GitHub template utilities;
- old ledger/review component implementations that were replaced by `src/ui/FinanceLedgerPage.tsx` and `src/ui/FinanceReviewPage.tsx`.

Patched:

- `src/components/ui/accordion.tsx` now uses `lucide-react` instead of the deleted template icon set.

### Validation after repair

Successful:

```bash
npm run build
npm test
```

Build result:

- Server TypeScript build passed.
- Next production build passed.
- Generated app routes are reduced to the finance app surfaces plus sign-in and health/ledger APIs.

Test result:

- 7 test files passed.
- 23 tests passed.

Additional validation:

- `package.json` and regenerated `package-lock.json` are valid JSON.
- Secret-material scan passed for changed config/server/email/package files.

Known warning still present:

- Next reports missing SWC lockfile metadata and says to run Next locally to patch. Build still passes. This likely means the regenerated lockfile should be committed after local install/build stabilizes it.

## 13. Remaining boundaries

Still not completed because BuildFlow write policy blocks or because it needs a separate data/auth migration phase:

- `public/**` asset cleanup remains blocked by source write policy.
- Prisma schema cleanup is still pending and should be paired with a migration/data-retention plan.
- Clerk-to-Ory auth migration is still pending.
- Production data migration is still pending.
- Docker/deploy changes are still pending.


## 14. Reports and settings implementation pass

### Local `public/**` cleanup prompt

A Codex prompt was prepared for local cleanup of `public/**` assets because BuildFlow write policy blocks that path. The prompt instructs Codex to inspect references before deletion, remove unused blog/scenario/social/template assets, keep app metadata icons unless safely replaced, and run build/tests afterward.

### Dedicated reports page

Implemented:

- `src/ui/FinanceReportsPage.tsx`
- `src/app/reports/page.tsx`

Result:

- Added `/reports` as a dedicated Dutch report surface.
- Supports whole-year and month-specific views.
- Uses `/api/reports/summary` when available.
- Falls back to locally loaded ledger context if the API cannot be reached.
- Shows income, expenses, result, transaction count, category breakdowns, and a simple ANBI/public-accountability text draft.

### Dedicated settings page

Implemented:

- `src/ui/FinanceSettingsPage.tsx`
- `src/app/settings/page.tsx`

Result:

- Added `/settings` as a simple Dutch admin/settings surface.
- Shows safe admin concepts without adding schema or risky mutation behavior.
- Shows current category tree.
- Documents foolproof guardrails directly in the UI.
- Keeps dangerous manual mutation concepts out of the normal workflow.

### Navigation updates

Updated:

- `src/ui/FinanceDashboard.tsx`
- `src/ui/FinanceLedgerPage.tsx`
- `src/ui/FinanceReviewPage.tsx`

Result:

- Navigation now points to dedicated `Rapporten` and `Instellingen` pages.
- Ledger remains focused on import and transaction drilldown.
- Reports/settings are no longer hidden as anchors inside the ledger page.

### Validation

Successful:

```bash
npm run build
npm test
```

Build result:

- Server TypeScript build passed.
- Next production build passed.
- New routes `/reports` and `/settings` were generated.

Test result:

- 7 test files passed.
- 23 tests passed.

Security:

- Secret-material scan passed for the new reports/settings UI and changed navigation files.

Known warning still present:

- Next still reports missing SWC lockfile metadata. Build passes. This should be resolved by running Next locally and committing the updated lockfile if npm patches it.


## 15. Balance reporting and data-model cleanup pass

### Balance-aware reports

Implemented:

- `server/services/reportingService.ts`
- `server/routes/reports.ts`
- `src/ui/FinanceReportsPage.tsx`
- `tests/services/reportingService.test.ts`

Result:

- Reports now include `openingBalanceMinor` and `closingBalanceMinor`.
- Report opening balance is computed from the latest opening balance per account plus all account movement before the selected period.
- Monthly and yearly reports now show `Beginbalans` and `Eindbalans`.
- ANBI/public draft text now mentions opening balance, income, expenses, result, and closing balance.
- Reporting tests now cover opening/closing balance continuity.

### Client summary correctness

Implemented:

- `src/context/ledger-context.tsx`

Result:

- Client ledger summary now counts all imported transactions, not only manually approved transactions.
- Review count now uses the explicit `needsManualCategory` flag.
- Total amount now reflects all loaded transactions.

### Prisma SaaS bloat model cleanup

Implemented:

- `prisma/schema.prisma`
- `prisma/migrations/20260514191000_remove_saas_bloat_models/migration.sql`

Removed from schema:

- `Subscription`
- `Project`
- `Audiences`
- `SubscriptionStatus`

Result:

- Schema no longer carries Stripe subscription, Make/n8n project, or waiting-list audience models.
- Migration drops the obsolete tables and enum if present.

### Audit log foundation

Implemented:

- `prisma/schema.prisma`
- `prisma/migrations/20260514191500_add_audit_log/migration.sql`
- `server/services/auditLogService.ts`
- `server/routes/review.ts`

Result:

- Added `AuditLog` model and migration.
- Added audit log service.
- Manual transaction category changes now create audit log records with before/after classification/category data.
- Build now runs `prisma generate` before server TypeScript compilation so generated Prisma types stay aligned with schema changes.

### Validation

Successful:

```bash
npm run build
npm test
```

Build result:

- Prisma client generated successfully.
- Server TypeScript build passed.
- Next production build passed.

Test result:

- 7 test files passed.
- 24 tests passed.

Known warning still present:

- Next still warns about missing SWC lockfile metadata. Build passes.


## 16. Audit log API and settings visibility pass

### Read-only audit API

Implemented:

- `server/routes/audit.ts`
- `server/index.ts`
- `next.config.js`
- `src/libs/api.ts`

Result:

- Added `/api/audit-log` as a read-only endpoint for recent admin changes.
- Added Next rewrite for `/api/audit-log`.
- Added `fetchAuditLogs` client helper and `AuditLogEntry` type.

### Settings audit preview

Implemented:

- `src/ui/FinanceSettingsPage.tsx`

Result:

- `/settings` now shows recent audit log entries.
- Category-change audit actions are translated into Dutch UI copy.
- Empty and error states are handled in Dutch.

### Validation

Successful:

```bash
npm run build
npm test
```

Build result:

- Prisma client generation passed.
- Server TypeScript build passed.
- Next production build passed.

Test result:

- 7 test files passed.
- 24 tests passed.

Additional validation:

- Secret-material scan passed for changed audit/report/settings/schema files.
- `package.json` and `package-lock.json` are valid JSON.


## 17. Auth readiness and role guardrail pass

### Provider-neutral auth preparation

Implemented:

- `src/utils/auth.ts`
- `src/middleware.ts`
- `src/utils/clerkClient.tsx`
- `src/components/providers.tsx`
- `.env.example`
- `docs/yeshua-academy-finance-auth-readiness.md`

Result:

- Auth is now provider-neutral with `AUTH_PROVIDER` / `NEXT_PUBLIC_AUTH_PROVIDER`.
- Supported auth modes are `disabled`, `ory`, and `clerk`.
- Ory mode is prepared with session-cookie detection and login redirect using `return_to`.
- Clerk is now only loaded when `AUTH_PROVIDER=clerk` and valid Clerk keys are present.
- `.env.example` now documents Ory placeholders and Clerk fallback placeholders separately.
- Added an auth readiness document with remaining Ory migration tasks.

### Remaining template utility cleanup

Deleted unused Strapi/CMS/template utilities:

- `src/utils/axios-instance.ts`
- `src/utils/fetch.ts`
- `src/utils/get_api.ts`
- `src/utils/functions.ts`
- `src/utils/format-date.tsx`
- `src/utils/scroll-to-section.ts`
- `src/components/nav-links.tsx`

Updated:

- `src/utils/index.ts`

Result:

- Removed leftover CMS/token/template utilities that were unrelated to the private finance ledger.
- Removed stale marketing nav component that referenced deleted scroll utilities.

### Basic server role guardrail foundation

Implemented:

- `server/auth/requestContext.ts`
- `server/routes/upload.ts`
- `server/routes/review.ts`

Result:

- Added provider-neutral request actor parsing.
- Added `admin` / `viewer` role concept using request headers, with default role configurable by `DEFAULT_USER_ROLE`.
- Importing bank exports now requires admin role.
- Updating transaction categories now requires admin role.
- Clearing the review queue now requires admin role.
- Review reads remain available to viewers.
- Audit logs now use the parsed request actor for category changes.

Remaining role work:

- Add admin guards to rule mutation routes.
- Add admin guards to ledger lock/unlock routes.
- Add admin guards to opening balance mutation routes.
- Add admin guards to email-send routes.
- Replace header-based role input with verified Ory identity/session data during full Ory migration.

### Validation

Successful:

```bash
npm run build
npm test
```

Build result:

- Prisma client generated successfully.
- Server TypeScript build passed.
- Next production build passed.

Test result:

- 7 test files passed.
- 24 tests passed.

Additional validation:

- Secret-material scan passed for changed auth/server/doc files. `.env.example` could not be scanned by BuildFlow because env paths are blocked by scan policy.
- `package.json` and `package-lock.json` are valid JSON.


## 18. Mutation guardrail and audit expansion pass

Started from clean committed state:

- `2d67c15 Refactor finance app into Yeshua Academy ledger`

### Admin guards added

Implemented admin role checks for additional mutation surfaces:

- `server/routes/rules.ts`
- `server/routes/ledgers.ts`
- `server/routes/accounts.ts`
- `src/app/api/ledger/notify/route.ts`

Result:

- Creating, updating, applying, and deleting categorization rules now requires admin role.
- Locking and unlocking ledger months now requires admin role.
- Creating/updating and locking opening balances now requires admin role.
- Sending financial summary emails now requires admin role.
- Read-only surfaces remain available to viewers where appropriate.

### Audit logging expanded

Audit log records are now created for:

- categorization rule creation;
- categorization rule updates;
- categorization rule application;
- categorization rule deletion;
- ledger month lock;
- ledger month unlock;
- opening balance creation/update;
- opening balance lock.

### Dutch error cleanup

Several remaining English mutation errors were converted to Dutch natural-language errors.

### Validation

Successful:

```bash
npm run build
npm test
```

Build result:

- Prisma client generation passed.
- Server TypeScript build passed.
- Next production build passed.

Test result:

- 7 test files passed.
- 24 tests passed.

Known warning still present:

- Next reports missing SWC lockfile metadata. Build passes.


## 19. Finance recipient and reconciliation guardrail pass

### Admin guardrails completed for more mutation routes

Implemented:

- `server/routes/rules.ts`
- `server/routes/ledgers.ts`
- `server/routes/accounts.ts`
- `src/app/api/ledger/notify/route.ts`

Result:

- Categorization rule create/update/apply/delete now requires admin role.
- Ledger month lock/unlock now requires admin role.
- Opening balance create/update/lock now requires admin role.
- Financial summary email sending now requires admin role.
- Related actions are audit logged where they mutate server-side finance data.

### Audit logging expanded

New audit actions include:

- `categorizationRule.created`
- `categorizationRule.updated`
- `categorizationRule.applied`
- `categorizationRule.deleted`
- `ledger.locked`
- `ledger.unlocked`
- `openingBalance.created`
- `openingBalance.updated`
- `openingBalance.locked`
- `emailRecipient.created`
- `emailRecipient.updated`
- `emailRecipient.deactivated`

### ING resulting balance extraction

Implemented:

- `server/services/reconciliationService.ts`
- `tests/services/reconciliationService.test.ts`

Result:

- Reconciliation now reads ING `Resulting balance` from both top-level raw row data and normalized `rawRow.columns` data.
- Added tests for Dutch amount formats such as `12.345,67` and `987,65`.
- `Resulting balance` remains optional for compatibility with valid test/custom ING-like exports that do not contain the column.

### Monthly finance summary recipients

Implemented:

- `prisma/schema.prisma`
- `prisma/migrations/20260514194000_add_email_recipients/migration.sql`
- `server/routes/emailRecipients.ts`
- `server/index.ts`
- `next.config.js`
- `src/libs/api.ts`
- `src/ui/FinanceSettingsPage.tsx`
- `src/app/api/ledger/notify/route.ts`

Result:

- Added `EmailRecipient` model for monthly finance summary recipients.
- Added API endpoints:
  - `GET /api/email-recipients`
  - `POST /api/email-recipients`
  - `DELETE /api/email-recipients/:id`
- Added settings UI to add, list, and deactivate recipients.
- Recipient changes are audit logged.
- Financial summary sending now uses explicitly supplied recipients if provided, otherwise it uses active stored recipients for the current user.

### Validation

Successful:

```bash
npm run build
npm test
```

Build result:

- Prisma client generation passed.
- Server TypeScript build passed.
- Next production build passed.

Test result:

- 8 test files passed.
- 26 tests passed.

Additional validation:

- Secret-material scan passed for changed finance/security files.
- `package.json` and `package-lock.json` are valid JSON.

Known warning still present:

- Next reports missing SWC lockfile metadata. Build passes.


## 20. Import feedback and review suggestion accuracy pass

Started from pushed main commit:

- `7947740 Add finance guardrails and summary recipients`

### Import summary accuracy

Implemented:

- `server/services/importService.ts`
- `server/routes/upload.ts`
- `src/context/ledger-context.tsx`
- `src/components/ledger/UploadCsvButton.tsx`

Result:

- Import summaries now track pending-review transactions separately from imported rows.
- Auto-categorized rows are no longer counted as pending review just because they were imported.
- Server import responses now include clearer Dutch natural-language feedback for:
  - newly added transactions;
  - automatically categorized transactions;
  - transactions ready for review;
  - duplicate transactions ignored;
  - skipped/error rows.
- The client now preserves the server-generated import message instead of rebuilding a less complete one.
- After upload, the UI shows a compact Dutch import overview with counts for new, automatic, review, and duplicate rows.

### Review suggestion preselection

Implemented:

- `src/ui/FinanceReviewPage.tsx`

Result:

- The review screen now resolves suggested category names to actual category IDs before preselecting dropdown values.
- Suggestions such as `Inkomsten` or `Tienden` no longer get treated as invalid IDs.
- This makes the one-transaction-at-a-time review flow less manual and more foolproof.

### Validation

Successful:

```bash
npm run build
npm test
```

Build result:

- Prisma client generation passed.
- Server TypeScript build passed.
- Next production build passed.

Test result:

- 8 test files passed.
- 26 tests passed.

Known warning still present:

- Next reports missing SWC lockfile metadata. Build passes.


## 21. Ledger UI simplification pass

Started from pushed main commit:

- `1e549c3 Improve import feedback and review suggestions`

### Ledger page cleanup

Implemented:

- `src/ui/FinanceLedgerPage.tsx`

Result:

- Removed the redundant settings concept block from the ledger page now that `/settings` is the real settings surface.
- Replaced stale year-overview copy that said balance transfer still needed a future datamodel phase.
- The year overview now points users directly to `/reports` for beginbalans, eindbalans, and ANBI/public report text.
- Ledger remains focused on the core workflow: import, month KPIs, transactions, and simple year overview.

### Validation

Successful:

```bash
npm run build
npm test
```

Build result:

- Prisma client generation passed.
- Server TypeScript build passed.
- Next production build passed.

Test result:

- 8 test files passed.
- 26 tests passed.

Known warning still present:

- Next reports missing SWC lockfile metadata. Build passes.


## 22. Pending-review import regression pass

Started from pushed main commit:

- `e741a0f Simplify ledger workflow UI`

### Import summary regression fix

Implemented:

- `server/services/importService.ts`
- `tests/import/integration.test.ts`

Result:

- Newly imported transactions that are not fully auto-categorized now increment `pendingReviewCount` correctly.
- Existing/reprocessed duplicate imports and newly created imports now use the same pending-review counting rule.
- Added regression coverage in the import integration tests so a no-history import asserts:
  - `importedCount = 1`
  - `autoCategorizedCount = 0`
  - `pendingReviewCount = 1`

### Validation

Successful:

```bash
npm run build
npm test
```

Build result:

- Prisma client generation passed.
- Server TypeScript build passed.
- Next production build passed.

Test result:

- 8 test files passed.
- 26 tests passed.

Known warning still present:

- Next reports missing SWC lockfile metadata. Build passes.


## 23. Viewer/admin client-role UX pass

Started from pushed main commit:

- `054d8b8 Fix pending review import counts`

### Client role propagation

Implemented:

- `src/libs/api.ts`

Result:

- Added a simple client role setting via `NEXT_PUBLIC_API_USER_ROLE`.
- Client requests now include `x-user-role` along with `x-user-id`.
- The default remains `admin` for current internal/local behavior.

### Viewer-safe mutation affordances

Implemented:

- `src/components/ledger/UploadCsvButton.tsx`
- `src/ui/FinanceReviewPage.tsx`
- `src/ui/FinanceSettingsPage.tsx`

Result:

- Viewers no longer get active import buttons.
- Viewers no longer get active review-save buttons.
- Viewers no longer get active email-recipient add/deactivate buttons.
- Viewer screens explain in Dutch that only beheerders may perform those actions.
- Server-side admin guards remain the source of truth; this is UI clarity, not a security replacement.

### Validation

Successful:

```bash
npm run build
npm test
```

Build result:

- Prisma client generation passed.
- Server TypeScript build passed.
- Next production build passed.

Test result:

- 8 test files passed.
- 26 tests passed.

Known warning still present:

- Next reports missing SWC lockfile metadata. Build passes.


## 24. Audit log Dutch-label polish pass

Started from pushed main commit:

- `cfe2547 Respect viewer role in client UI`

### Audit log readability

Implemented:

- `src/ui/FinanceSettingsPage.tsx`

Result:

- The settings audit log now translates all current finance audit actions into Dutch labels:
  - transaction category changes;
  - categorization rule changes;
  - ledger locks/unlocks;
  - opening balance changes;
  - email recipient changes.
- This keeps the audit log readable for admins and avoids raw technical action names in normal use.

### Validation

Successful:

```bash
npm run build
npm test
```

Build result:

- Prisma client generation passed.
- Server TypeScript build passed.
- Next production build passed.

Test result:

- 8 test files passed.
- 26 tests passed.
