# Yeshua Academy Finance — Strategy

Status: authoritative  
Depends on: `docs/PHILOSOPHY.md`  
Planning horizon: rebuild through stable monthly operation

## Mission

Deliver a trustworthy Dutch financial administration application that converts monthly ING exports into a complete, categorized, reconciled, visual, and distributable record without assumptions or unexplained differences.

## Strategic outcome

At the end of the rebuild, an administrator must be able to:

1. upload the original monthly ING export;
2. verify the statement controls before import;
3. let deterministic rules book proven matches;
4. review every uncertain transaction with visible evidence;
5. close the month only when every euro and category total reconciles;
6. view factual monthly and yearly reports;
7. approve one frozen report snapshot;
8. send the same figures as Dutch HTML email, XLSX, and PDF;
9. download the unchanged original source file later;
10. demonstrate who categorized, approved, reopened, or sent each result.

## High-level goals

### Goal 1 — Establish one reliable financial source of truth

Use immutable ING source files and raw transaction rows as the cash-movement truth. Use the concluded 2024 and 2025 administration as historical classification truth. Retain every original label and every owner-confirmed interpretation.

Success means no source row is lost, altered, duplicated, or silently reinterpreted.

### Goal 2 — Make automatic categorization safe

Replace broad historical guessing with deterministic, administrator-approved rules. Use structured evidence such as direction, counterparty/IBAN, payment purpose, and material amount conditions.

Fuzzy and heuristic methods remain useful only for ranked suggestions.

Success means an ambiguous transaction can never enter a closed report without explicit administrator approval.

### Goal 3 — Make monthly close mathematically strict

Create statement-level controls and period-close gates. Opening balance, income, expenses, net movement, closing balance, category totals, transaction counts, and review counts must all agree.

Success means the application cannot close or send a period with a non-zero difference or unresolved review item.

### Goal 4 — Make financial results understandable at a glance

Build a visual Dutch dashboard around factual, closed periods. Show balances, cash flow, totals by `Klant`, `Type`, and `Category`, monthly trends, and drill-down to source transactions.

Success means an administrator can understand where the money went without interpreting raw spreadsheets.

### Goal 5 — Preserve the administration outside the application

Retain original files, provide downloads, and generate reproducible XLSX and PDF outputs from frozen snapshots.

Success means the administration remains inspectable and portable even if the application changes later.

### Goal 6 — Keep the product lean and maintainable

Remove or avoid features that do not support the confirmed workflow. Prefer explicit domain models, small services, deterministic functions, and targeted validation over generic frameworks or speculative abstractions.

Success means the main workflow is obvious to users and maintainers.

### Goal 7 — Operate safely with simple infrastructure

Use a standalone PostgreSQL database and a local development environment that mirrors the production shape. Replace the obsolete mixed WordPress/MySQL Compose file only after the financial workflow is stable and validated on a disposable database.

Success means development and deployment are reproducible without risking financial data.

## Strategic pillars

### 1. Evidence-preserving ingestion

- Retain the original uploaded file unchanged.
- Store file hash, size, account, period, row count, and statement totals.
- Parse source fields without translating or modifying the original ING evidence.
- Reject malformed, discontinuous, duplicate, or overlapping imports before they affect the ledger.

### 2. Deterministic classification

- Model `Klant`, `Type`, and `Category` explicitly.
- Preserve literal historical labels.
- Use approved rules for final automation.
- Store rule provenance and matching evidence.
- Keep fuzzy results separate from final bookings.

### 3. Deliberate administrator review

- Show the complete transaction context and payment purpose.
- Show why a category was suggested.
- Show alternatives when evidence conflicts.
- Require an explicit approval or categorization decision.
- Let an administrator deliberately turn a confirmed decision into a reusable rule.

### 4. Reconciliation and locked periods

- Use integer euro cents everywhere.
- Validate bank and category totals independently.
- Prevent close while any review item remains.
- Freeze closed-period facts and report outputs.
- Require an audited administrator action to reopen.

### 5. Snapshot-based reporting and distribution

- Generate monthly and yearly reports only from closed snapshots.
- Produce HTML, XLSX, and PDF from the same snapshot.
- Require a separate final approval click before email.
- Record recipients, sender, content hash, send time, and result.

### 6. Dutch-first user experience

- Make every user-facing workflow Dutch.
- Use clear accounting language rather than technical language.
- Keep ING source labels visible when showing original evidence.
- Prefer one obvious primary action per screen.

### 7. Auditable operations

- Keep role enforcement server-side.
- Record manual decisions and administrative actions.
- Avoid destructive automation.
- Validate changes against fixed 2024, 2025, and 2026 financial controls.

## Delivery strategy

Work proceeds in ordered, bounded phases:

1. governance and accounting-safety alignment;
2. source model and historical data foundation;
3. historical loading and exact financial fixtures;
4. monthly import and review workflow;
5. close, reports, email, and file distribution;
6. complete Dutch UI and role enforcement;
7. local infrastructure replacement and deployment preparation;
8. hardening, documentation, and operational handoff.

A later phase may not bypass an unmet accounting invariant from an earlier phase.

## Measures of success

The rebuild is successful when:

- 2024 loads as 268 transactions and closes at EUR 12,184.15;
- 2025 loads as 413 transactions, opens at EUR 12,184.15, and closes at EUR 10,350.86;
- the supplied 2026 partial statement loads as 221 transactions, opens at EUR 10,350.86, and closes at EUR 7,837.25;
- every control difference is EUR 0.00;
- no fuzzy or heuristic suggestion is finalized automatically;
- every closed transaction has `Klant`, `Type`, and `Category`;
- original source files remain downloadable and byte-identical;
- all user-facing text is Dutch;
- non-administrators cannot mutate financial data;
- monthly and yearly outputs agree across UI, HTML, XLSX, and PDF;
- tests, server build, web build, security scan, and financial fixtures pass.

## Constraints

- No production-data import during early implementation phases.
- No production configuration changes without a separate approved cutover plan.
- No historical label normalization.
- No automatic report sending.
- No dependency or database-version update merely for freshness; changes require a specific validated need.
- No feature is added because it is common in accounting software.

## Explicit non-goals

The current strategy excludes:

- invoices and accounts receivable;
- accounts payable;
- payroll;
- VAT or tax filing automation;
- accrual journals;
- budgets and forecasts;
- multi-tenant SaaS behavior;
- subscriptions and billing;
- payment collection;
- autonomous AI categorization;
- generic bookkeeping integrations beyond the confirmed ING workflow.

These may enter a future roadmap only after an explicit owner decision and a philosophy review.

## Current strategic position

- Discovery, financial controls, and governance documents are complete.
- Owner decisions are recorded and reflected in the authoritative document hierarchy.
- Phase 1 accounting-safety code is validated but not committed.
- Payment purpose is structured evidence.
- Unsafe popularity and broad-history automatic fallbacks are removed.
- Only approved rules and complete raw historical replays can auto-book.
- Normalized fallback, fuzzy, and heuristic matches are review-only.
- All 229 tests pass; the server and production builds pass.
- Executable/test paths pass the full high-risk security scan; documentation passes secret and runtime-execution scans.
- No financial data has been imported.
- Infrastructure replacement has not started.
- Owner review is the current gate before any commit or Phase 2 schema planning.
