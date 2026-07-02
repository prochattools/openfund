# Yeshua Academy Finance — Philosophy

Status: authoritative  
Owner context confirmed: 2026-07-02  
Applies to: product decisions, accounting behavior, user experience, data handling, and implementation

## What we are building

Yeshua Academy Finance is a small internal financial administration application for Yeshua Academy and its related projects.

Its purpose is to turn monthly ING bank exports into a complete, factual, reviewable, and visual financial administration. The application must show where every euro came from, where every euro went, which project and category it belongs to, and whether the period reconciles exactly to the bank.

The core workflow is:

```text
Original ING export
→ immutable import
→ deterministic categorization where proven
→ administrator review where uncertain
→ exact reconciliation
→ period close and lock
→ factual monthly/yearly report
→ separate administrator approval
→ Dutch email with HTML, XLSX, and PDF outputs
```

## What this application is about

The application serves one concrete need:

- import the bank account export every month;
- preserve all original bank facts and files;
- reuse the concluded 2024 and 2025 administration as historical categorization truth;
- automatically book only transactions that match an approved deterministic rule or a complete exact historical replay;
- place every uncertain or fuzzy result in an administrator review queue;
- report totals by the existing three dimensions: `Klant`, `Type`, and `Category`;
- reconcile opening balance, income, expenses, net movement, and closing balance exactly;
- provide visual monthly and yearly insight;
- send a frozen, approved report to administrators.

The concluded 2024 and 2025 workbooks are facts. Their transaction assignments, wording, capitalization, spelling, separate `in` and `uit` categories, and project codes must be preserved exactly. The resolved `Verduidelijking` sheets are valid additional interpretation evidence.

Official project names are:

- `FTK`: For the King
- `FR`: Fellowship Renswoude
- `WLJ`: Walk Like Jesus
- `YA`: Yeshua Academy
- `VS`: Vila Solidária

Historical `FR` data remains unchanged. In 2025, the first transaction literally booked under `FTK` is treated as the practical transition point. Earlier history is never rewritten.

## How we work

### 1. Facts before convenience

The bank export is the source of truth for cash movement. Concluded historical workbooks are the source of truth for their categorization. Helper formulas, inferred dates, fuzzy guesses, or UI labels may never override source facts silently.

### 2. Every euro must be accounted for

A period is valid only when all of the following equalities hold to the cent:

```text
opening balance + income - expenses = closing balance
sum of categorized income = total income
sum of categorized expenses = total expenses
unreviewed transactions = 0
reconciliation difference = EUR 0.00
```

No rounding differences, unexplained adjustments, missing transactions, or assumed categories are acceptable.

### 3. Automation must earn trust

Automatic booking is allowed only when evidence is deterministic and approved.

Allowed final automatic sources:

- an active administrator-approved rule with sufficient evidence;
- a complete exact replay of a previously confirmed historical transaction pattern.

Suggestion-only sources:

- fuzzy description similarity;
- best-history guesses;
- account or counterparty familiarity;
- amount similarity;
- dominant or popular categories;
- direction defaults.

Suggestions may prefill the review screen but may never become final bookings without administrator approval.

### 4. Preserve evidence and decisions

Original uploaded files are retained unchanged, hashed, and downloadable. Raw source rows, normalized values, matching evidence, proposed categories, final categories, approvals, reopen reasons, report snapshots, and dispatch results remain auditable.

Corrections create explicit decisions; they do not rewrite source evidence.

### 5. Historical wording stays historical

The application reproduces the literal 2024 and 2025 wording. It does not normalize, merge, correct spelling, change capitalization, or collapse separate historical categories.

Future categorization must continue the existing working method unless the owner explicitly approves a change.

### 6. Review is a controlled accounting action

Only administrators may:

- categorize transactions;
- approve suggestions;
- create or change categorization rules;
- reopen a closed period;
- approve and send reports.

All other users have viewing rights only. Server-side authorization is authoritative.

There is no bulk “accept everything” action for uncertain transactions.

### 7. Close first, report second

A monthly or yearly report is factual only when it is generated from a balanced, fully reviewed, locked snapshot.

Reports are sent only after a separate final administrator approval click. Email content and attachments are generated from the same immutable snapshot.

### 8. Dutch for users

The complete user-facing application is Dutch:

- navigation;
- screens;
- buttons;
- labels;
- errors;
- category administration;
- reports;
- emails;
- file-download descriptions.

External ING source-column names may remain English because they are part of the original bank evidence. Project names and historical classifications remain exactly as supplied.

### 9. Lean and purpose-built

The application must be simple, logical, visual, maintainable, and limited to the confirmed workflow.

It is not:

- a generic accounting package;
- an ERP;
- a SaaS product;
- a subscription product;
- an invoicing system;
- a payroll system;
- a payment processor;
- a budgeting or forecasting suite;
- an autonomous AI bookkeeper.

A feature belongs only when it directly improves import, categorization, review, reconciliation, reporting, auditability, file preservation, or safe administration.

### 10. Safe change over clever change

Financial correctness is more important than automation percentage, visual novelty, or implementation speed.

Changes are delivered in bounded phases with:

- exact source inspection;
- explicit acceptance criteria;
- targeted regression tests;
- full tests and builds;
- financial control fixtures;
- diff review and security scanning;
- no commit without owner approval during the current rebuild.

## Accounting treatment principles

Subject to the literal historical categories:

- internal transfers and savings movements remain separate transfer categories and are excluded from ordinary operating income/expense subtotals;
- deposits and returned deposits remain separate balance movements;
- refunds and reversals remain explicit and should link to the related transaction when identifiable;
- restricted-purpose receipts and payments remain visible under their exact project/category labels and are reported separately from unrestricted operating results;
- reporting is cash-basis from actual bank transactions unless the owner later authorizes accrual features.

## Decision hierarchy

When requirements appear to conflict, use this order:

1. verified bank facts and exact financial controls;
2. the owner’s explicit decisions;
3. concluded 2024/2025 transaction classifications and resolved clarification sheets;
4. this philosophy;
5. the strategy;
6. the roadmap;
7. the implementation plan;
8. existing code behavior.

Existing code is never the authority when it conflicts with financial facts or owner decisions.
