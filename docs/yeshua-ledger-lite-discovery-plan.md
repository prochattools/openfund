# Yeshua Ledger Lite — Discovery, Cleanup, and Redesign Plan

Status: discovery plan, not yet an implementation plan  
Repo: `yeshuaacademy-finance`  
Decision: refactor and simplify the existing Finance repo into Yeshua Ledger Lite instead of starting from scratch or adopting a third-party finance app.

## 1. Product direction

Yeshua Ledger Lite is a small internal finance administration tool for a church/nonprofit context.

It should not become:

- generic accounting software;
- an ERP;
- a SaaS product;
- a donation/payment platform;
- an invoice system;
- a personal finance tracker;
- an AI bookkeeping product.

It should become:

- a boring, strict, simple ledger;
- built around monthly bank exports;
- easy enough for non-technical church administration users;
- reliable enough to produce insight, monthly review, and year-end reporting;
- exportable enough to preserve the administration outside the app.

The core data flow should be:

```text
Bank monthly export → immutable import batch → normalized transactions → manual review/classification → monthly insight → year report
```

The app should make the correct workflow obvious and prevent accidental misuse.

## 2. Current repo decision

Use the existing `yeshuaacademy-finance` repo as the base.

Reason: the repo already contains useful ledger infrastructure:

- ING CSV parsing;
- XLSX import support;
- transaction normalization;
- duplicate detection;
- Prisma/Postgres model;
- ledger periods;
- accounts and opening balances;
- reconciliation service;
- categorization rules;
- review flow;
- Docker/deployment setup.

But the repo must be simplified aggressively because it still contains template/SaaS/product bloat:

- Stripe/subscription remnants;
- old project/scenario concepts;
- marketing homepage and assets;
- blog/waiting-list/request-access routes;
- unrelated dependencies;
- overly complex UI pages;
- generic SaaS documentation;
- confusing legacy naming.

Cleanup principle:

> Delete or isolate everything that does not serve monthly bank import, ledger review, categories/funds/projects, evidence, insight, or year reporting.

## 3. Research baseline: Dutch church/nonprofit context

This plan starts from official public guidance and must be refined through the interview. It is not legal advice.

Initial official-source baseline:

- Belastingdienst ANBI conditions: https://www.belastingdienst.nl/wps/wcm/connect/bldcontentnl/belastingdienst/zakelijk/bijzondere_regelingen/goede_doelen/algemeen_nut_beogende_instellingen/aan_welke_voorwaarden_moet_een_anbi_voldoen/aan_welke_voorwaarden_moet_een_anbi_voldoen
- Belastingdienst ANBI obligations: https://www.belastingdienst.nl/wps/wcm/connect/bldcontentnl/belastingdienst/zakelijk/bijzondere_regelingen/goede_doelen/algemeen_nut_beogende_instellingen/welke_verplichtingen_heeft_een_anbi
- Belastingdienst financial accountability publication for ANBI, including church bodies: https://www.belastingdienst.nl/wps/wcm/connect/bldcontentnl/belastingdienst/zakelijk/bijzondere_regelingen/goede_doelen/algemeen_nut_beogende_instellingen/gegevens_van_een_anbi_publiceren_op_een_internetsite/financiele_verantwoording_publiceren
- KVK church organization registration: https://www.kvk.nl/inschrijven/inschrijven-kerkelijke-organisatie-kerkgenootschap/
- KVK UBO obligations for church bodies: https://www.kvk.nl/ubo/moet-je-organisatie-ubo-opgave-doen/

Working assumptions to verify:

- A church/nonprofit may have no active tax filing obligation in normal religious/non-commercial use, but that depends on actual legal form, registration, ANBI/SBBI status, commercial activity, employees/payroll, VAT exposure, gifts/legacies, and other facts.
- If the organization is ANBI, the administration should be able to support financial transparency and publication requirements.
- For church bodies, KVK/UBO obligations depend on whether the body is registered, whether it is the highest Dutch level, whether there is a Dutch umbrella organization above it, and whether it operates commercial activities.
- Even if the application is not built for tax filing, it should still preserve clear records for internal stewardship, board/member trust, and year-end reporting.

Product implication:

The app should not be built around “tax filing,” but it should still make the administration complete, explainable, traceable, and exportable.

## 4. Product principles

### 4.1 One source of truth

The bank export is the source of truth for transactions.

Rules:

- store original uploaded file metadata;
- keep original bank row fields immutable;
- store normalized transaction fields separately;
- store classification/review fields separately from bank fields;
- prevent duplicate imports;
- make every imported transaction traceable to its import batch;
- make exports reproducible.

### 4.2 One import path

There should be one primary import workflow:

```text
Upload monthly bank export → preview → import → review → close month
```

No manual transaction creation unless later explicitly approved as a rare correction workflow.

### 4.3 No accounting monster

Avoid full double-entry bookkeeping unless requirements prove it is necessary.

The first target model is a cash ledger:

- income;
- expenses;
- categories;
- funds/projects;
- review status;
- evidence/notes;
- monthly/year summaries.

### 4.4 Stupid-proof UI

The UI must be designed for the person doing church administration under time pressure.

Principles:

- show the next action, not all features;
- use plain language;
- avoid finance jargon where possible;
- make unsafe actions hard;
- prevent errors before showing error messages;
- use statuses like `Not imported`, `Needs review`, `Ready`, `Closed`, `Exported`;
- use one monthly workflow as the backbone;
- keep detailed tables available but not as the first screen;
- make year-end reporting a guided checklist.

## 5. Target core screens

### 5.1 Home / Monthly Overview

Purpose: answer “What needs attention now?”

Suggested content:

- selected year/month;
- import status;
- number of transactions;
- number needing review;
- total income;
- total expenses;
- net movement;
- funds/projects summary;
- one primary action button.

### 5.2 Import

Purpose: import one monthly bank export safely.

Flow:

1. Upload bank export.
2. Detect account/month/date range.
3. Show preview: rows, duplicates, new transactions, errors.
4. Confirm import.
5. Show result and next action: review transactions.

### 5.3 Review

Purpose: classify only what needs human attention.

Features:

- show suggested category/fund when possible;
- one-click accept suggestion;
- bulk assign recurring items;
- mark uncertain/questionable;
- add note;
- flag missing evidence;
- flag related-person/board payment when needed;
- save and move to next item.

### 5.4 Ledger

Purpose: complete transaction list and search.

This should be powerful but secondary.

Features:

- filter by month/year/category/fund/review status;
- search description/counterparty/reference;
- export visible rows;
- inspect original bank row;
- show classification/audit history.

### 5.5 Funds / Projects

Purpose: understand ministry/project allocation.

Examples to confirm:

- General;
- FTK;
- WLJ;
- Zambia;
- India;
- Nepal;
- Rent;
- Administration;
- Bank costs.

### 5.6 Year Report

Purpose: generate annual administration output.

Outputs to confirm:

- income by category/fund/project;
- expenses by category/fund/project;
- net movement;
- unresolved items list;
- large/exceptional payments;
- related-person/board-payment overview if applicable;
- yearly transaction export;
- optional PDF/HTML summary;
- export ZIP.

## 6. Discovery interview plan

Start with interview before implementation. The app must match actual church administration practice, not generic accounting assumptions.

### Round 1 — Organization and legal context

1. What is the exact legal form: kerkgenootschap, stichting, vereniging, or something else?
2. Is it an independent church body, a self-standing part of a larger church body, or under a Dutch umbrella/koepel?
3. Is the organization registered with KVK? If yes, under what legal form?
4. Does the organization have ANBI status, group ANBI status, SBBI status, or none?
5. Does the organization publish any annual financial accountability today?
6. Does the organization have employees, payroll, volunteer payments, reimbursements, or only normal expenses?
7. Does the organization do commercial activity, paid services, rentals, product sales, events, or only church/nonprofit activity?
8. Has the tax agency explicitly confirmed exemption/status, or is that based on the nature of the organization?
9. Who needs to approve or review the administration internally?
10. What must be shown to members, donors, board/elders, or external parties at year-end?

### Round 2 — Bank and imports

1. Which bank is used?
2. Is there one bank account or multiple accounts?
3. What exact export format is used: CSV, CAMT.053 XML, MT940, XLSX, or another format?
4. Is the export monthly, yearly, or custom date range?
5. Do exported rows include resulting balance/saldo?
6. Do exported rows include counterparty IBAN, name, reference/omschrijving, transaction type, and amount sign?
7. Can the same month be exported twice with identical rows?
8. How should duplicate imports be handled?
9. Are there cash transactions outside the bank account?
10. Are there payment providers, cash collections, or donation platforms outside the main bank export?

### Round 3 — Categories, funds, and projects

1. What categories do you currently use in the spreadsheet?
2. What is the difference between a category, fund, and project in your administration?
3. Can one transaction be split across multiple funds/projects?
4. Are donations sometimes designated for a specific project?
5. Are expenses sometimes paid from a specific project/fund?
6. Which categories are required for the year report?
7. Which categories are only for internal insight?
8. Do you need a fixed chart of categories, or should admins be able to add categories?
9. Should the app learn recurring classifications from previous months?
10. Which items must always be reviewed manually?

### Round 4 — Review and controls

1. Who imports the bank file?
2. Who categorizes transactions?
3. Who reviews or approves the month?
4. Do you need two-person approval for large payments?
5. What payment amount should be considered “large”?
6. What makes an item “questionable” or “unclear” today?
7. Do you need to track receipts/invoices/contracts?
8. Do you need to track reimbursements to leaders/board/elders/staff?
9. Should closed months be locked?
10. Who may unlock a closed month?

### Round 5 — Reporting and year-end

1. What does the current year report look like?
2. Who reads it?
3. What totals must be included?
4. Do you need balance information, or only income/expenses?
5. Do you publish the report publicly?
6. Do donors/members receive a summary?
7. Do project leaders need project-specific reports?
8. Do you need PDF, CSV, Excel, HTML, ZIP, or all of these?
9. What should the year-end export contain?
10. What must be impossible to forget before generating the final year report?

### Round 6 — Users and permissions

1. How many users will use the app?
2. What roles exist: admin, bookkeeper, reviewer, viewer?
3. Does every user need login, or is this a single trusted internal tool?
4. Should users see all funds/projects or only some?
5. Do you need an audit log of who changed classifications?
6. Do you need email notifications?
7. Do you need comments/notes between reviewers?
8. Does the app need mobile support?
9. What devices will be used most?
10. What language should the UI use: English, Dutch, or both?

### Round 7 — UI redesign

1. What is the first thing you want to see after login?
2. What do you currently hate most in the existing UI?
3. Which spreadsheet view is most useful today?
4. What should be one click away?
5. What should be hidden unless needed?
6. Do you prefer month-by-month workflow or full-year overview first?
7. Do you want a guided checklist for each month?
8. Do you want colors/status badges, or a very plain table-first design?
9. What would make the UI feel “stupid-proof” to you?
10. What are the top three mistakes the app must prevent?

## 7. Requirements outputs

After the interview, produce these documents before implementation:

1. `docs/yeshua-ledger-lite-requirements.md`
2. `docs/yeshua-ledger-lite-ui-research.md`
3. `docs/yeshua-ledger-lite-roadmap.md`
4. `docs/yeshua-ledger-lite-implementation-plan.md`

## 8. Proposed phases after requirements

### Phase 0 — Discovery and research

Deliverables:

- interview answers;
- confirmed legal/operational assumptions;
- current spreadsheet model mapped into app concepts;
- current bank export fields documented;
- UI research summary.

No code changes except docs.

### Phase 1 — Repo inventory and bloat map

Deliverables:

- list of keep/remove/replace files;
- dependency cleanup list;
- route cleanup list;
- Prisma model cleanup proposal;
- migration risk analysis.

No destructive cleanup until approved.

### Phase 2 — Core model simplification

Target entities:

- organization;
- user;
- bank account;
- bank import;
- transaction;
- category;
- fund/project;
- review flag;
- note;
- attachment/evidence;
- audit log;
- annual report/export.

Rules:

- never overwrite imported bank data;
- store classifications separately;
- audit all manual changes;
- closed months are locked;
- deletions are soft unless clearly safe.

### Phase 3 — Import workflow hardening

Deliverables:

- one supported bank export path;
- preview before import;
- duplicate detection;
- import summary;
- error list in plain language;
- reconciliation against balance if available;
- monthly import status.

### Phase 4 — Review workflow redesign

Deliverables:

- task-focused review screen;
- one transaction at a time option;
- bulk classification for obvious recurring items;
- uncertain/questionable flags;
- evidence-needed flag;
- suggested categories/funds;
- clear ready/blocked status.

### Phase 5 — UI redesign

Deliverables:

- new simplified navigation;
- monthly dashboard;
- import checklist;
- review queue;
- ledger table;
- funds/projects insight;
- year report flow.

Design style:

- calm;
- plain;
- low visual noise;
- high contrast;
- few choices per screen;
- no marketing layout;
- no SaaS visual clutter.

### Phase 6 — Year report and export package

Deliverables:

- annual income/expense report;
- fund/project summary;
- unresolved-item report;
- export CSV/XLSX/PDF/HTML as required;
- ZIP export package;
- reproducible report generation.

### Phase 7 — Parallel run and validation

Deliverables:

- import real bank exports;
- compare totals to spreadsheet;
- resolve differences;
- run one year in parallel;
- approve app as primary administration only after confidence is proven.

## 9. Explicit non-goals

Unless later approved, do not build:

- invoicing;
- payroll;
- VAT filing;
- bank API connection;
- automatic payment execution;
- donation CRM;
- pledge management;
- full ERP;
- public donor portal;
- Stripe checkout;
- marketing site;
- blog/content platform;
- generic multi-tenant SaaS.

## 10. Immediate next step

Start the interview.

The first interview must confirm the legal/organizational status, the exact bank export, the spreadsheet categories/funds, and the expected year report.

Only after the interview should the repo cleanup roadmap and implementation plan be finalized.
