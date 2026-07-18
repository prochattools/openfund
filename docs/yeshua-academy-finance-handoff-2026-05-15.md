# Yeshua Academy Finance — Handoff for New Chat

Status: SUPERSEDED  
Canonical replacement: `docs/finance-rebuild-run.md`  
This document must not govern new implementation and is retained for historical context.

Date: 2026-05-15  
Repo/source id: `yeshuaacademy-finance`  
Local repo path seen by BuildFlow: `/Users/Office/Repos/yeshuaacademy/web/finance`  
Target branch: `main`  
Latest verified pushed commit at handoff: `2a60084 Extract review page helpers`

## Current repo state

At handoff time, BuildFlow verified:

```bash
git status --short
# clean

git log -1 --oneline
# 2a60084 Extract review page helpers
```

The worktree was clean and the latest commit was pushed to `origin/main` before this handoff document was written. This handoff document itself should be committed and pushed after creation.

## Project direction

The app is **Yeshua Academy Finance**, a private Dutch nonprofit/church ledger app for a `kerkgenootschap` with ANBI status.

Core product goal:

- Very simple, foolproof Dutch finance administration.
- Import monthly ING bank exports.
- Deduplicate imports safely.
- Auto-categorize only when there is a strong/history/rule match.
- Put uncertain items in a clear review queue.
- Show simple money-flow insight: income, expenses, categories, monthly dashboard, yearly report.
- Keep UI minimal, calm, modern, non-SaaS, and Dutch-only.
- Avoid feature creep: no attachment/evidence system, no public marketing site, no Stripe/subscription SaaS remnants, no complex bookkeeping/ERP behavior.

Important user preferences:

- App name stays **Yeshua Academy Finance**, not Yeshua Ledger Lite.
- UI language must be Dutch.
- Main workflow: import ING export → review uncategorized transactions → view dashboard/reports.
- Manual edit/delete should not be prominent in standard UI.
- Admin and viewer roles only.
- Auth target is Ory/local, not Clerk long-term.
- Production data must be preserved carefully later.

## What has been done in this implementation stretch

Large parts of the original bloated app were already cleaned/redesigned before the later helper-extraction sequence. The latest sequence focused on reducing large context/UI files into testable pure helpers, while keeping behavior unchanged.

Recent pushed commits include, in order near the end:

```text
5398c31 Extract offline categorization helper
e3ac4d5 Extract API transaction mapper
8a672a4 Extract client row transaction helper
066999e Extract ledger summary helper
e0c20e1 Extract ledger response mappers
6c5ca98 Extract client CSV parser
792370b Extract dashboard summary helper
601fb24 Extract report summary helper
2a60084 Extract review page helpers
```

### Current extracted helper modules

Key helper modules now present include:

- `src/helpers/account-metadata.ts`
- `src/helpers/api-transaction-mapper.ts`
- `src/helpers/category-labels.ts`
- `src/helpers/category-tree.ts`
- `src/helpers/client-csv-parser.ts`
- `src/helpers/client-import-normalizers.ts`
- `src/helpers/client-row-transaction.ts`
- `src/helpers/dashboard-summary.ts`
- `src/helpers/ledger-response-mappers.ts`
- `src/helpers/ledger-summary.ts`
- `src/helpers/offline-categorization.ts`
- `src/helpers/report-summary.ts`
- `src/helpers/review-page.ts`
- `src/helpers/rule-summaries.ts`
- `src/helpers/server-category-merge.ts`
- `src/helpers/transaction-category-names.ts`
- `src/helpers/transaction-tooltip.ts`

The intent was to shrink `src/context/ledger-context.tsx` and the major UI pages by extracting pure, testable behavior.

### Tests added/expanded

The test suite has grown to cover import, categorization, route helpers, dashboard/report/review calculations, response mappers, and shared helper behavior.

Latest successful test validation before handoff:

```bash
npm test
# 45 test files passed
# 184 tests passed
```

Latest successful server TypeScript validation before handoff:

```bash
npm run build:server
# passed
```

Latest successful secret scan on changed files before handoff:

```bash
security scan
# passed, no findings
```

## Important validation caveat

During the last implementation pass, `npm run build` could **not** be verified through BuildFlow because the BuildFlow host returned Cloudflare 504 gateway time-out responses three times while starting the full production build command.

This was an infrastructure/tool timeout, not a returned compiler error. Earlier production builds had passed repeatedly. The next chat should start by retrying:

```bash
npm run build
```

If it succeeds, continue normal implementation. If it fails with real compiler output, repair that first before further feature work.

Also, BuildFlow command `type_check_web` is not applicable for this repo layout because the allowlisted command expects `apps/web`, which does not exist in this repo.

## Known recurring warning

Previous successful Next production builds reported this warning:

```text
Next reports missing SWC lockfile metadata. Build still passes.
```

Do not treat this as a blocker unless it becomes an actual build failure.

## BuildFlow/source handling reminders

BuildFlow active source frequently drifts to another repo such as `brain`, `buildflow`, or `stevewesthoek-tradebot`.

At the start of every new chat or implementation step:

1. Check active context.
2. Switch to source id `yeshuaacademy-finance` if needed.
3. Verify:

```bash
git status --short
git log -1 --oneline
```

Never touch files unless active source is confirmed as `yeshuaacademy-finance`.

## Current implementation approach

The user wants agent-mode style work with minimal interruptions:

- Pick the next safe, bounded task.
- Make the change.
- Run validation.
- Document progress.
- Commit and push to `main` with a useful commit message.
- Continue to the next task.

But still obey BuildFlow safety:

- Do not invent state.
- Do not claim full build success unless command output proves it.
- Do not write secrets or `.env` values.
- Use preflight/confirmation for protected or destructive work.
- Protected paths include `package.json`, lockfiles, `.github/**`, Docker files, migrations, `public/**`, scripts/tools, etc.
- `public/**` asset cleanup was previously blocked by write policy and should be handled locally by the user or with explicit confirmation if supported.

## Recommended next steps

### Step 1 — Re-verify after opening new chat

Run:

```bash
git status --short
git log -1 --oneline
npm test
npm run build:server
npm run build
```

Expected before the handoff commit:

```text
latest implementation commit: 2a60084 Extract review page helpers
```

After this handoff document is committed, the latest commit will be the handoff commit instead.

### Step 2 — Continue small safe helper/UI extractions

Good next candidates:

1. `src/ui/FinanceLedgerPage.tsx`
   - Look for inline pure helpers/calculations for filtering, sorting, formatting, table row state, transaction grouping.
   - Extract to `src/helpers/ledger-page.ts` or similar.
   - Add `tests/helpers/ledgerPage.test.ts`.

2. `src/ui/FinanceSettingsPage.tsx` or settings-related UI
   - Extract pure role/status/config display helpers if present.
   - Avoid auth/permission rewrites unless fully understood.

3. `src/ui/FinanceDashboard.tsx`, `FinanceReportsPage.tsx`, `FinanceReviewPage.tsx`
   - They have already had major pure helpers extracted.
   - Only touch again if a clear remaining pure helper is found.

4. `src/context/ledger-context.tsx`
   - It should now be more orchestration-focused.
   - Do not over-extract hooks/stateful behavior unless it improves clarity and can be tested.

### Step 3 — After helper/UI cleanup

When no more safe extractions are obvious, move to higher-value product work:

- Review the actual ING import UX end-to-end.
- Improve Dutch error/success messages.
- Improve dashboard empty/loading/error states.
- Improve review queue one-transaction-at-a-time workflow.
- Verify report totals and balance behavior against sample data.
- Revisit bloat removal only in safe areas, avoiding protected deletions without confirmation.

## Documentation files to read first in the new chat

Read these files before continuing implementation:

- `docs/yeshua-academy-finance-handoff-2026-05-15.md`
- `docs/yeshua-academy-finance-implementation-progress.md`
- `src/context/ledger-context.tsx`
- The UI file selected for the next task, probably `src/ui/FinanceLedgerPage.tsx`
- Nearby tests under `tests/helpers/**`

## Prompt for a new chat

Copy/paste this into the new conversation:

```text
You are BuildFlow. Continue work on the Yeshua Academy Finance repo.

First, use BuildFlow and re-anchor on the correct source:
- Check BuildFlow status.
- Check active context.
- If the active source is not `yeshuaacademy-finance`, switch to `yeshuaacademy-finance` only.
- Verify `git status --short` and `git log -1 --oneline`.

Then read these files:
- `docs/yeshua-academy-finance-handoff-2026-05-15.md`
- `docs/yeshua-academy-finance-implementation-progress.md`
- `src/context/ledger-context.tsx`
- `src/ui/FinanceLedgerPage.tsx`
- relevant nearby helper tests under `tests/helpers/**`

Current known state before the handoff document commit:
- latest implementation commit was `2a60084 Extract review page helpers`
- worktree was clean
- `npm test` passed: 45 test files, 184 tests
- `npm run build:server` passed
- security scan passed
- `npm run build` could not be verified in the last chat because BuildFlow returned Cloudflare 504 gateway time-outs three times while starting the command, not because of a compiler error

Start by retrying validation:
- `npm test`
- `npm run build:server`
- `npm run build`

If `npm run build` fails with real compiler output, fix that first. If it passes, continue the implementation plan.

Continue in agent-mode style with minimal interruptions:
- Pick the next safe, bounded task.
- Prefer pure helper extraction or small tested improvements.
- Make the change.
- Add/update focused tests.
- Run validation.
- Update the progress document.
- Commit and push to `main` with a useful commit message after successful validation.
- Continue to the next task.

Respect the product direction:
- Dutch-only private finance app for Yeshua Academy.
- Simple, foolproof ING monthly import ledger.
- No SaaS/marketing/subscription bloat.
- Keep UI clean, minimal, modern, and church/nonprofit focused.
- App name remains `Yeshua Academy Finance`.
- Do not expose or write secrets.
- Do not claim validation/build success unless BuildFlow command output proves it.

Recommended next task:
Inspect `src/ui/FinanceLedgerPage.tsx` for pure filtering/sorting/formatting/grouping helpers that can be extracted to a focused helper module with tests, then validate, document, commit, and push.
```
