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


## 25. Dashboard-to-report readiness pass

Started from pushed main commit:

- `7af48cc Translate audit log actions`

### Dashboard next-step clarity

Implemented:

- `src/ui/FinanceDashboard.tsx`

Result:

- The dashboard month status card now shows whether the selected month is ready for reporting.
- The card links directly to Review and Reports so admins can move from insight to action without hunting through menus.
- The dashboard header now includes a direct `Maandrapport` action for the latest loaded month.

### Report deep-link support

Implemented:

- `src/app/reports/page.tsx`
- `src/ui/FinanceReportsPage.tsx`

Result:

- `/reports?year=YYYY&month=M` now opens the reports page with the selected period.
- Query parsing is handled in the route page and passed into the client UI so Next can build without a `useSearchParams` suspense bailout.
- The dashboard can now deep-link to the correct current-month report.

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


## 26. Dutch client API error-copy pass

Started from pushed main commit:

- `fc3b052 Link dashboard to monthly reports`

### Client API error copy

Implemented:

- `src/libs/api.ts`

Result:

- Replaced remaining English client-side finance API error messages with Dutch natural-language messages for:
  - ledger loading;
  - review queue loading/clearing;
  - transaction category updates;
  - accounts and opening balances;
  - reconciliation data;
  - ledger locking/unlocking;
  - categorization rules;
  - rule preview/apply actions.
- Console messages for rule preview/apply failures now also use Dutch labels.

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


## 27. Request guard regression-test pass

Started from pushed main commit:

- `3d975a7 Use Dutch client API errors`

### Admin/viewer guard tests

Implemented:

- `tests/auth/requestContext.test.ts`

Result:

- Added coverage for provider-neutral request actor parsing.
- Verified the internal/local default role remains `admin`.
- Verified viewer role and actor metadata are parsed from headers.
- Verified `requireAdmin` blocks viewers with the Dutch `403` response.
- Verified admins pass through mutation guards without a response side effect.

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

- 9 test files passed.
- 30 tests passed.

Known warning still present:

- Next reports missing SWC lockfile metadata. Build passes.


## 28. Audit log service regression-test pass

Started from pushed main commit:

- `d8845c1 Test admin viewer request guards`

### Audit log service tests

Implemented:

- `tests/services/auditLogService.test.ts`

Result:

- Added coverage for audit-log payload normalization.
- Verified optional actor/entity fields are stored as `null` where appropriate.
- Verified omitted JSON fields stay undefined instead of creating misleading empty values.
- Verified before/after/metadata JSON payloads are preserved for audit entries.

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

- 10 test files passed.
- 32 tests passed.

Known warning still present:

- Next reports missing SWC lockfile metadata. Build passes.


## 29. Dutch import message regression-test pass

Started from pushed main commit:

- `30c176a Test audit log service payloads`

### Import feedback tests

Implemented:

- `server/routes/upload.ts`
- `tests/routes/upload.test.ts`

Result:

- Exported `buildImportMessage` for isolated regression testing.
- Added tests for complete Dutch import summary feedback.
- Added singular/plural Dutch wording coverage.
- Added zero-count coverage so optional sections stay hidden when there is nothing to report.

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

- 11 test files passed.
- 35 tests passed.

Known warning still present:

- Next reports missing SWC lockfile metadata. Build passes.


## 30. Ledger context Dutch-copy cleanup pass

Started from pushed main commit:

- `51738fe Test Dutch import feedback messages`

### Ledger context copy

Implemented:

- `src/context/ledger-context.tsx`

Result:

- Ledger context console messages for rule loading and API refresh failures now use Dutch wording.
- Offline rule-management errors for create/update/delete rule flows now use Dutch wording.
- This keeps fallback/local-mode errors aligned with the Dutch-only product direction.

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

- 11 test files passed.
- 35 tests passed.

Known warning still present:

- Next reports missing SWC lockfile metadata. Build passes.


## 31. Reports result-card clarity pass

Started from pushed main commit:

- `7ff58d2 Use Dutch ledger context errors`

### Report KPI clarity

Implemented:

- `src/ui/FinanceReportsPage.tsx`

Result:

- Added a dedicated `Resultaat` card to the report KPI row.
- The reports page now shows beginbalans, inkomsten, uitgaven, resultaat, and eindbalans together.
- This makes the income-minus-expense view clearer for monthly and yearly reporting without changing the data model.

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

- 11 test files passed.
- 35 tests passed.

Known warning still present:

- Next reports missing SWC lockfile metadata. Build passes.


## 32. Review match-label Dutch polish pass

Started from pushed main commit:

- `596f437 Show report result KPI`

### Review suggestion labels

Implemented:

- `src/ui/FinanceReviewPage.tsx`

Result:

- The review card no longer shows raw match values such as `fuzzy`, `rule`, or `exact`.
- Match confidence is now shown with Dutch labels such as `waarschijnlijke suggestie`, `categorisatieregel`, and `volledige historische match`.
- This makes the review queue more understandable for non-technical admin users.

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

- 11 test files passed.
- 35 tests passed.

Known warning still present:

- Next reports missing SWC lockfile metadata. Build passes.


## 33. Review placeholder category cleanup pass

Started from pushed main commit:

- `9aefaca Translate review match labels`

### Category choice cleanup

Implemented:

- `src/ui/FinanceReviewPage.tsx`
- `src/ui/FinanceSettingsPage.tsx`

Result:

- Internal review placeholder categories such as `Review`, `Needs Review`, and `Needs manual categorization` are hidden from normal category choices.
- The review page no longer offers review placeholders as assignable main/subcategories.
- The settings category overview no longer presents review placeholders as normal administration categories.
- This keeps the app focused on real income/expense categories while still preserving review internals.

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

- 11 test files passed.
- 35 tests passed.

Known warning still present:

- Next reports missing SWC lockfile metadata. Build passes.


## 34. Import history visibility pass

Started from pushed main commit:

- `d5465b3 Hide review placeholder categories`

### Import batch history

Implemented:

- `server/routes/importBatches.ts`
- `server/index.ts`
- `next.config.js`
- `src/libs/api.ts`
- `src/ui/FinanceSettingsPage.tsx`

Result:

- Added read-only `GET /api/import-batches` endpoint for recent import metadata.
- Added Next rewrite for `/api/import-batches`.
- Added client import-history API helper and type.
- `/settings` now shows the latest ING import batches with counts for:
  - new rows;
  - automatically categorized rows;
  - review rows;
  - duplicate rows.
- The UI clearly states that original file download still needs a separate file-storage phase because the current schema stores import metadata, not the original file bytes.

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

- 11 test files passed.
- 35 tests passed.

Known warning still present:

- Next reports missing SWC lockfile metadata. Build passes.


## 35. Original ING file retention pass

Started from pushed main commit:

- `e330a36 Show import history in settings`

### Original import file storage

Implemented:

- `prisma/schema.prisma`
- `prisma/migrations/20260514204000_store_original_import_file/migration.sql`
- `server/services/importService.ts`

Result:

- Import batches now store the original uploaded ING file bytes.
- Import batches now store file size and SHA-256 checksum.
- Newly imported files can be traced from import metadata to original source bytes.

### Original import file download

Implemented:

- `server/routes/importBatches.ts`
- `server/index.ts`
- `next.config.js`
- `src/libs/api.ts`
- `src/ui/FinanceSettingsPage.tsx`

Result:

- Added `GET /api/import-batches/:id/download` for original file downloads.
- Added Next rewrite for original file downloads.
- Import history now shows whether the original file and checksum are stored.
- Import history now offers `Download origineel` when a file is available.
- Older import batches from before this migration may still show `geen bestand`.

### Validation

Successful:

```bash
npm run build
npm test
```

Build result:

- Prisma client generation passed.
- Server TypeScript build passed after route-param and Prisma Bytes typing fixes.
- Next production build passed.

Test result:

- 11 test files passed.
- 35 tests passed.

Known warning still present:

- Next reports missing SWC lockfile metadata. Build passes.


## 36. Import history route regression-test pass

Started from pushed main commit:

- `7db17ad Store original ING import files`

### Import history route tests

Implemented:

- `server/routes/importBatches.ts`
- `tests/routes/importBatches.test.ts`

Result:

- Exported the import-history limit parser for isolated regression testing.
- Added tests for valid limits from 1 through 100.
- Added tests for invalid values such as empty, zero, negative, over-limit, and non-numeric inputs.
- This keeps the read-only import-history endpoint bounded and predictable.

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

- 12 test files passed.
- 37 tests passed.

Known warning still present:

- Next reports missing SWC lockfile metadata. Build passes.


## 37. Auth role environment documentation pass

Started from pushed main commit:

- `a216c1a Test import history route limits`

### Role environment alignment

Implemented:

- `docs/yeshua-academy-finance-auth-readiness.md`

Result:

- Documented `NEXT_PUBLIC_API_USER_ROLE=admin` and `DEFAULT_USER_ROLE=admin` as local/internal role defaults.
- Documented how to use `viewer` role values to test read-only UI/API behavior.
- BuildFlow policy blocks staging env-template paths, so `.env.example` was not changed in the committed repo. Add those env placeholders locally when needed.
- Keeps provider-neutral auth docs aligned with the role guardrails already implemented in the app.

### Validation

Planned validation for this doc/config-only pass:

```bash
npm run build
npm test
```


## 38. Review suggestion accept-action pass

Started from pushed main commit:

- `05ce505 Correct env placeholder progress note`

### Review action clarity

Implemented:

- `src/ui/FinanceReviewPage.tsx`

Result:

- The focused review card now has a direct `Suggestie accepteren` action in the suggestion block.
- Admins can confirm the preselected suggestion without interpreting the dropdown/save controls as the primary workflow.
- Viewer mode still disables the action and shows `Alleen beheerder`.
- The existing `Opslaan` action remains available for manually adjusted categories or new category text.

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

- 12 test files passed.
- 37 tests passed.

Known warning still present:

- Next reports missing SWC lockfile metadata. Build passes.


## 39. Original import retention regression-test pass

Started from pushed main commit:

- `e527edf Add accept suggestion review action`

### Import retention test coverage

Implemented:

- `tests/import/integration.test.ts`

Result:

- The fake Prisma import batch model now captures file-retention fields used by the real import service.
- Added regression coverage that verifies imports store:
  - original filename;
  - file size;
  - SHA-256 checksum;
  - original file bytes.
- This protects the original ING file retention requirement from silent regressions.

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

- 12 test files passed.
- 38 tests passed.

Known warning still present:

- Next reports missing SWC lockfile metadata. Build passes.


## 40. Import file download regression-test pass

Started from pushed main commit:

- `d8d4408 Test original import retention`

### Download helper extraction

Implemented:

- `server/services/importBatchDownload.ts`
- `server/routes/importBatches.ts`
- `tests/services/importBatchDownload.test.ts`

Result:

- Original import file download formatting is now isolated in a testable helper.
- The route still returns stored bytes with filename, content type, and SHA-256 header.
- Added tests for CSV download payloads, XLSX content type, and old import batches without stored files.

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

- 13 test files passed.
- 41 tests passed.

Known warning still present:

- Next reports missing SWC lockfile metadata. Build passes.


## 41. Report route regression-test pass

Started from pushed main commit:

- `0c6da7f Test import file download payloads`

### Report route helper tests

Implemented:

- `server/routes/reports.ts`
- `tests/routes/reports.test.ts`

Result:

- Exported report year/month parsing helpers for isolated testing.
- Exported report period-bound helper for isolated testing.
- Exported report category-label splitter for isolated testing.
- Added regression tests for:
  - valid/invalid report years;
  - valid/invalid months;
  - month and year UTC period bounds;
  - main/subcategory label splitting.

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

- 14 test files passed.
- 45 tests passed.

Known warning still present:

- Next reports missing SWC lockfile metadata. Build passes.


## 42. Import download filename safety pass

Started from pushed main commit:

- `df535e9 Test report route helpers`

### Download header safety

Implemented:

- `server/services/importBatchDownload.ts`
- `server/routes/importBatches.ts`
- `tests/services/importBatchDownload.test.ts`

Result:

- Original ING export downloads now use an ASCII-safe fallback filename plus UTF-8 `filename*` support in the `Content-Disposition` header.
- This makes downloaded filenames more predictable across browsers while still preserving the real filename where supported.
- Added regression coverage for safe filename header generation.

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

- 14 test files passed.
- 46 tests passed.

Known warning still present:

- Next reports missing SWC lockfile metadata. Build passes.


## 43. Reconciliation route alignment pass

Started from pushed main commit:

- `07d80a5 Harden import download filenames`

### Reconciliation route cleanup

Implemented:

- `server/routes/reconciliation.ts`

Result:

- Reconciliation now uses the provider-neutral request actor helper instead of direct header parsing.
- Remaining English reconciliation validation/error messages were replaced with Dutch natural-language responses.
- Reconciliation logging now uses Dutch wording as well.

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

- 14 test files passed.
- 46 tests passed.

Known warning still present:

- Next reports missing SWC lockfile metadata. Build passes.


## 44. Import file audit metadata UI pass

Started from pushed main commit:

- `64dcf1f Align reconciliation route copy`

### Import history audit metadata

Implemented:

- `src/ui/FinanceSettingsPage.tsx`

Result:

- Settings import history now shows retained original-file size when available.
- Settings import history now shows a shortened SHA-256 checksum prefix when available.
- Original ING export download availability remains visible per import batch.
- This improves traceability from an import row back to the retained source file without making the settings page noisy.

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

- 14 test files passed.
- 46 tests passed.

Known warning still present:

- Next reports missing SWC lockfile metadata. Build passes.


## 45. Report readiness warning pass

Started from pushed main commit:

- `dbcd1f2 Document import audit metadata pass`

### Selected-period report readiness

Implemented:

- `src/ui/FinanceReportsPage.tsx`

Result:

- The reports page now reuses a shared selected-period transaction filter.
- For the chosen year/month, the page counts transactions that still need manual review.
- When review items remain, the page shows a visible Dutch warning before the KPI cards.
- The warning links directly to `/review`, so admins can fix the issue before using the report for internal or ANBI publication.
- This prevents reports from looking final while unresolved categorization work remains.

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

- 14 test files passed.
- 46 tests passed.

Known warning still present:

- Next reports missing SWC lockfile metadata. Build passes.


## 46. Dashboard latest import visibility pass

Started from pushed main commit:

- `b24b692 Warn when reports still need review`

### Dashboard import source visibility

Implemented:

- `src/ui/FinanceDashboard.tsx`

Result:

- The dashboard now loads the most recent import batch metadata.
- A new `Laatste ING-import` card shows the source filename and import timestamp.
- The card shows new, duplicate, automatically categorized, and review-row counts.
- When the original ING export is retained, the dashboard includes a `Download origineel` link.
- This makes the dashboard reflect both financial state and the latest source-file state without requiring admins to open settings first.

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

- 14 test files passed.
- 46 tests passed.

Known warning still present:

- Next reports missing SWC lockfile metadata. Build passes.


## 47. Import status Dutch-label polish pass

Started from pushed main commit:

- `ee2bd6f Show latest import on dashboard`

### Import history status labels

Implemented:

- `src/ui/FinanceSettingsPage.tsx`

Result:

- Import history now translates all import batch statuses into Dutch labels.
- `completed` renders as `voltooid`.
- `pending` renders as `bezig`.
- `failed` renders as `mislukt`.
- This avoids raw English status values appearing in the Dutch settings UI.

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

- 14 test files passed.
- 46 tests passed.

Known warning still present:

- Next reports missing SWC lockfile metadata. Build passes.


## 48. Import review-count Dutch-copy polish pass

Started from pushed main commit:

- `55e0655 Translate import history statuses`

### Import count labels

Implemented:

- `src/ui/FinanceDashboard.tsx`
- `src/ui/FinanceSettingsPage.tsx`

Result:

- Remaining import count chips that displayed `review` now use `te beoordelen`.
- The dashboard latest-import card is fully Dutch in its count labels.
- The settings import-history panel is fully Dutch in its count labels.

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

- 14 test files passed.
- 46 tests passed.

Known warning still present:

- Next reports missing SWC lockfile metadata. Build passes.


## 49. Route parameter regression-test pass

Started from pushed main commit:

- `9a56a8d Use Dutch import review labels`

### Shared route-param helper coverage

Implemented:

- `tests/routes/routeParams.test.ts`

Result:

- Added isolated regression tests for the shared Express route parameter helper.
- Covered normal string route parameters.
- Covered Express array-style route parameters by using the first non-empty value.
- Covered missing, blank, whitespace-only, and empty-array route parameters returning `null`.
- This protects account, ledger, review, and rule routes from accidentally passing `string[]` or blank IDs into Prisma filters.

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

- 15 test files passed.
- 49 tests passed.

Known warning still present:

- Next reports missing SWC lockfile metadata. Build passes.


## 50. Audit route alignment and regression-test pass

Started from pushed main commit:

- `68777f5 Test route parameter helper`

### Audit route cleanup

Implemented:

- `server/routes/audit.ts`
- `tests/routes/audit.test.ts`

Result:

- The read-only audit-log route now uses the provider-neutral request actor helper instead of direct header parsing.
- The audit-log limit parser is exported for isolated regression testing.
- Added tests for valid limits from 1 through 100.
- Added tests for invalid, missing, zero, negative, over-limit, and non-numeric values falling back to 25.
- Localized the audit route server log message to Dutch.

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

- 16 test files passed.
- 51 tests passed.

Known warning still present:

- Next reports missing SWC lockfile metadata. Build passes.


## 51. Email recipient route validation-test pass

Started from pushed main commit:

- `66b9105 Align audit route actor handling`

### Email-recipient route polish

Implemented:

- `server/routes/emailRecipients.ts`
- `tests/routes/emailRecipients.test.ts`

Result:

- Exported the email-recipient address validator for isolated regression tests.
- Added tests for normal recipient addresses including `+` aliases and surrounding whitespace.
- Added tests for missing and malformed e-mail addresses.
- Localized the email-recipient route server log messages to Dutch.
- Existing admin guardrails and audit logging remain unchanged.

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

- 17 test files passed.
- 53 tests passed.

Known warning still present:

- Next reports missing SWC lockfile metadata. Build passes.


## 52. Account and ledger route Dutch-log polish pass

Started from pushed main commit:

- `6219a63 Test email recipient validation`

### Server log localization

Implemented:

- `server/routes/accounts.ts`
- `server/routes/ledgers.ts`

Result:

- Localized remaining account-route server error log messages to Dutch.
- Localized opening-balance save and lock server log messages to Dutch.
- Localized ledger lock and unlock server log messages to Dutch.
- No route behavior, response shape, audit behavior, or authorization behavior was changed.

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

- 17 test files passed.
- 53 tests passed.

Known warning still present:

- Next reports missing SWC lockfile metadata. Build passes.


## 53. Transaction fingerprint regression-test pass

Started from pushed main commit:

- `2694037 Localize account ledger server logs`

### Import dedupe fingerprint coverage

Implemented:

- `tests/services/transactionFingerprint.test.ts`

Result:

- Added focused regression tests for the transaction import fingerprint helper.
- Covered normalization of account identifiers, whitespace, and case.
- Covered direct ING notification fields in the fingerprint.
- Covered normalized raw-row `columns.Notifications` handling.
- Covered amount/date changes producing different fingerprints.
- This protects duplicate import detection from silent regressions around ING row normalization.

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

- 18 test files passed.
- 57 tests passed.

Known warning still present:

- Next reports missing SWC lockfile metadata. Build passes.


## 54. Categorization confirmation regression-test pass

Started from pushed main commit:

- `e26fcce Test transaction import fingerprints`

### Confirmation helper coverage

Implemented:

- `tests/services/categorizationService.test.ts`

Result:

- Added focused regression tests for `confirmTransactions`.
- Covered the no-op path when no transaction ids are supplied.
- Covered safe confirmation of selected non-manual transactions.
- Verified the helper scopes updates by user id and transaction ids.
- Verified manually confirmed transactions are excluded from accidental re-confirmation.
- This protects the review queue flow where suggested transactions are accepted into the ledger without deleting or duplicating imported bank transactions.

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

- 19 test files passed.
- 59 tests passed.

Known warning still present:

- Next reports missing SWC lockfile metadata. Build passes.


## 55. History-based categorization regression-test pass

Started from pushed main commit:

- `92c9157 Test transaction confirmation helper`

### Automatic categorization history coverage

Implemented:

- `tests/services/categorizationService.test.ts`

Result:

- Added regression tests for `categorizeTransaction` history matching.
- Covered exact source/amount history matching.
- Covered normalized-description history fallback.
- Covered popular historical category fallback when at least three previous matches exist.
- Covered returning `none` when history is not strong enough.
- This protects the automatic categorization behavior that feeds the manual review queue and keeps recurring transactions fast to approve.

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

- 19 test files passed.
- 63 tests passed.

Known warning still present:

- Next reports missing SWC lockfile metadata. Build passes.


## 56. Active rule-engine regression-test pass

Started from pushed main commit:

- `1160482 Test history based categorization`

### Active rule-engine coverage

Implemented:

- `tests/services/ruleEngine.test.ts`

Result:

- Added active Vitest coverage for the rule engine under the main `tests/` tree.
- Covered description condition matching.
- Covered combined description and amount matching.
- Covered mismatched amount rejection.
- Covered legacy pattern/match-field compatibility.
- Covered safe regex matching and invalid-regex rejection with the expected warning asserted and suppressed.
- Covered inactive-rule skipping in `findMatchingRule`.
- This protects the explicit categorization-rule path that runs before history-based categorization.

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

- 20 test files passed.
- 69 tests passed.

Known warning still present:

- Next reports missing SWC lockfile metadata. Build passes.


## 57. Rule application regression-test pass

Started from pushed main commit:

- `7550e7c Test rule engine matching`

### Rule application coverage

Implemented:

- `tests/services/ruleEngine.test.ts`

Result:

- Added regression tests for `applyRuleToTransactions`.
- Covered the no-op path when no transaction ids are selected.
- Covered applying a rule category to selected transactions.
- Covered confirming selected transactions after rule application.
- Covered updating `lastMatchedAt` after a successful rule application.
- This protects the bulk/selected rule-application flow used to move suggested transactions out of review safely.

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

- 20 test files passed.
- 71 tests passed.

Known warning still present:

- Next reports missing SWC lockfile metadata. Build passes.


## 58. Reconciliation balance extraction regression-test pass

Started from pushed main commit:

- `64861fa Test rule application flow`

### Statement balance extraction coverage

Implemented:

- `tests/services/reconciliationService.test.ts`

Result:

- Added regression tests for Dutch `Saldo` balance extraction.
- Added regression tests for generic `Balance` extraction from normalized raw-row columns.
- Added invalid/missing raw-row coverage returning `null` instead of producing misleading balances.
- This protects monthly reconciliation from ING/export-format variations while keeping malformed files safe and non-crashing.

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

- 20 test files passed.
- 73 tests passed.

Known warning still present:

- Next reports missing SWC lockfile metadata. Build passes.


## 59. Reporting category fallback regression-test pass

Started from pushed main commit:

- `853f8a0 Test reconciliation balance extraction`

### Report breakdown label coverage

Implemented:

- `tests/services/reportingService.test.ts`

Result:

- Added regression tests for category-label fallback order in reports:
  - main category;
  - category;
  - project;
  - `Niet gecategoriseerd`.
- Added deterministic Dutch label sorting coverage when breakdown totals are equal.
- This protects monthly/yearly report readability and prevents unstable category ordering in the UI and exports.

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

- 20 test files passed.
- 75 tests passed.

Known warning still present:

- Next reports missing SWC lockfile metadata. Build passes.


## 60. Notification route Dutch-log polish pass

Started from pushed main commit:

- `845e59c Test report category fallbacks`

### Notification route log localization

Implemented:

- `src/app/api/ledger/notify/route.ts`

Result:

- Replaced the remaining English notification-route server error log with Dutch wording.
- No response shape, recipient logic, authorization logic, or e-mail content was changed.
- This keeps server/admin diagnostics aligned with the Dutch-only product direction.

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

- 20 test files passed.
- 75 tests passed.

Known warning still present:

- Next reports missing SWC lockfile metadata. Build passes.


## 61. Transaction matching normalization edge-test pass

Started from pushed main commit:

- `a778863 Localize notification route log`

### Matching normalization coverage

Implemented:

- `tests/import/transactionMatching.test.ts`

Result:

- Added edge-case regression tests for transaction matching normalization.
- Covered missing/blank descriptions returning `null` instead of creating weak match candidates.
- Covered missing amount returning `null`.
- Covered fallback counterparty extraction from normalized raw-row columns.
- Covered numeric `Notifications` values from raw rows being normalized into comparable text.
- This protects recurring-transaction matching and prevents weak or malformed imported rows from being matched too aggressively.

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

- 20 test files passed.
- 77 tests passed.

Known warning still present:

- Next reports missing SWC lockfile metadata. Build passes.


## 62. Import normalizer row-validation regression-test pass

Started from pushed main commit:

- `f714c21 Test transaction matching normalization`

### Normalized row coverage

Implemented:

- `tests/import/normalizers.test.ts`

Result:

- Added regression coverage for building a full normalized transaction from a valid raw row.
- Verified account identifier normalization, date parsing, whitespace cleanup, amount conversion, reference cleanup, and normalized description output.
- Added row-level validation coverage for missing account identifier, invalid date, missing description, and invalid amount.
- This protects ING import parsing from producing partial or misleading ledger rows when required source fields are absent or malformed.

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

- 20 test files passed.
- 79 tests passed.

Known warning still present:

- Next reports missing SWC lockfile metadata. Build passes.


## 63. Import parser mixed-row regression-test pass

Started from pushed main commit:

- `baa983f Test import row normalization`

### Parser edge coverage

Implemented:

- `tests/import/parsers.test.ts`

Result:

- Added ING CSV parser regression coverage for a mixed file containing both valid and invalid transaction rows.
- Verified the valid row is retained and normalized.
- Verified the invalid row becomes a row-level error instead of crashing the import.
- Verified blank rows are ignored.
- Added XLSX parser coverage for a missing configured sheet returning a structured row-level error.
- This protects the foolproof import requirement: malformed rows should produce clear errors without mangling valid transactions.

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

- 20 test files passed.
- 81 tests passed.

Known warning still present:

- Next reports missing SWC lockfile metadata. Build passes.


## 64. Import dedupe regression-test pass

Started from pushed main commit:

- `449bc3a Test import parser mixed rows`

### Dedupe hash and partition coverage

Implemented:

- `tests/import/dedupe.test.ts`

Result:

- Added transaction hash regression coverage for case-insensitive account identifiers and references.
- Added duplicate partitioning coverage for duplicates inside the same import file, not only duplicates already present in the database.
- Verified the first row stays unique and later identical rows are marked duplicate.
- This protects repeated/monthly ING imports from duplicating data even when the same file or repeated rows are imported again.

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

- 20 test files passed.
- 83 tests passed.

Known warning still present:

- Next reports missing SWC lockfile metadata. Build passes.


## 65. Reporting empty-period regression-test pass

Started from pushed main commit:

- `1cd90c2 Test import dedupe edge cases`

### Empty and malformed report amount coverage

Implemented:

- `tests/services/reportingService.test.ts`

Result:

- Added regression coverage for periods with no matching transactions.
- Verified empty periods preserve opening and closing balance continuity.
- Verified income, expenses, net result, transaction count, and breakdown arrays stay zero/empty.
- Added coverage for non-numeric report amounts being treated as zero instead of crashing report generation.
- This protects monthly/yearly reporting from empty months and malformed historic data.

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

- 20 test files passed.
- 85 tests passed.

Known warning still present:

- Next reports missing SWC lockfile metadata. Build passes.


## 66. Import normalizer helper regression-test pass

Started from pushed main commit:

- `682d9e4 Test empty report periods`

### Import normalizer helper coverage

Implemented:

- `tests/import/normalizers.test.ts`

Result:

- Expanded `parseDate` coverage for Date objects and ISO date strings.
- Added already-signed debit/credit amount behavior coverage.
- Added `extractReference` coverage for ING notification text.
- Added `toISODateString` coverage for date-only metadata output.
- This protects small helper behavior used throughout CSV/XLSX import normalization and source-file metadata handling.

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

- 20 test files passed.
- 86 tests passed.

Known warning still present:

- Next reports missing SWC lockfile metadata. Build passes.


## 67. Review queue empty-result regression-test pass

Started from pushed main commit:

- `290fcef Test import normalizer helpers`

### Review queue clear coverage

Implemented:

- `tests/services/reviewQueueService.test.ts`

Result:

- Added regression coverage for clearing the review queue when no categorized suggestions are available.
- Verified the service returns `0` without deleting or modifying imported bank transactions outside the existing safe update scope.
- Verified the update remains scoped to the requesting user id.
- This protects the admin review workflow from treating an empty queue as an error or unsafe cleanup operation.

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

- 20 test files passed.
- 87 tests passed.

Known warning still present:

- Next reports missing SWC lockfile metadata. Build passes.
