# Yeshua Academy Finance — Requirements Baseline

Status: first requirements baseline after stakeholder interview  
Date: 2026-05-14  
Product name: **Yeshua Academy Finance**  
Internal working concept: **Yeshua Ledger Lite**  
Repo: `yeshuaacademy-finance`

## 1. Executive summary

Yeshua Academy Finance must become a very simple Dutch-only finance administration application for a `kerkgenootschap` with individual ANBI status.

The application is not meant to be generic accounting software. It must primarily answer:

1. What came in?
2. Where did the money go?
3. Is every ING transaction imported exactly once?
4. Is every transaction categorized with the right main category, subcategory, and project/fund where applicable?
5. Are the monthly and yearly totals correct?
6. Can we produce public ANBI accountability and internal year reporting?

The bank export is the source of truth. The UI must be simple, Dutch, visual, and hard to misuse.

## 2. Confirmed organization context

- Legal/organizational form: `kerkgenootschap`.
- ANBI status: individual to this `kerkgenootschap`, not group/umbrella ANBI.
- Current publication: ANBI financial accountability is published on `yeshua.academy`.
- Required outputs: both public ANBI report and internal year report.
- Book year: January through December.
- Year-end: close the year, carry the closing balance into the new year as the opening point.
- Review/approval: administrators review and approve the yearly administration together.
- Members/donors: monthly financial summary by email already exists through Resend and should be kept, improved, and integrated.

## 3. Research baseline to respect

Official public-source baseline:

- Belastingdienst states that an ANBI must publish financial accountability online, including balance sheet, statement of income and expenses, and explanation, generally within 6 months after the book year.
- Belastingdienst has specific publication exceptions for church bodies and vermogen funds. Even where church-specific publication scope is narrower, this app should still support the internal balance sheet because the stakeholder explicitly requires it.
- ANBI policymaker remuneration rules matter at the organization level, but this product will not add a separate dedicated related-person tracking module unless later requested. Payments/reimbursements can be represented through categories.
- KVK/UBO obligations are outside the product scope, but may matter operationally for a `kerkgenootschap` depending on registration/umbrella status.

Reference URLs:

- https://www.belastingdienst.nl/wps/wcm/connect/bldcontentnl/belastingdienst/zakelijk/bijzondere_regelingen/goede_doelen/algemeen_nut_beogende_instellingen/gegevens_van_een_anbi_publiceren_op_een_internetsite/financiele_verantwoording_publiceren
- https://www.belastingdienst.nl/wps/wcm/connect/bldcontentnl/belastingdienst/zakelijk/bijzondere_regelingen/goede_doelen/algemeen_nut_beogende_instellingen/gegevens_van_een_anbi_publiceren_op_een_internetsite/uitzonderingen
- https://www.belastingdienst.nl/wps/wcm/connect/bldcontentnl/belastingdienst/zakelijk/bijzondere_regelingen/goede_doelen/algemeen_nut_beogende_instellingen/aan_welke_voorwaarden_moet_een_anbi_voldoen/beloning_bestuurders
- https://www.kvk.nl/en/ubo/does-your-organisation-have-to-register-ubos/

This is not legal advice. It is a product design baseline.

## 4. Language and tone

- UI language: Dutch only.
- Error messages: Dutch natural language, no raw error codes.
- Success messages: Dutch natural acknowledgement and confirmation.
- Warning messages: Dutch, concise, actionable.
- No English UI labels unless a bank export field is displayed exactly as imported.

Examples:

- Success: `Import voltooid. 143 transacties toegevoegd.`
- Duplicate warning: `20 dubbele transacties genegeerd.`
- Invalid file: `Dit bestand kan niet worden ingelezen. Upload een ING-exportbestand in het juiste formaat.`
- Review needed: `7 transacties hebben nog een categorie nodig.`

## 5. Source of truth and import rules

### 5.1 Source of truth

The ING bank export is the transaction truth.

Rules:

- ING exports must be stored as original import records/files or file metadata.
- Imported bank fields must never be silently overwritten.
- Normalized transaction fields are derived from the bank export.
- Categorization fields are editable and separate from original bank fields.
- Every transaction must trace back to an import batch.
- The app must protect totals from duplicate imports, malformed imports, and accidental manual changes.

### 5.2 Bank setup

- Bank: ING.
- Accounts: one bank, multiple accounts, including a savings account.
- Import cadence: one calendar month at a time.
- Supported import path: ING export only for now.
- The exact export file format must be confirmed from the uploaded sample file and current parser implementation.
- The import parser should detect whether the export includes balance/saldo, counterparty IBAN, counterparty name, description/omschrijving/reference, amount, date, and transaction type.

### 5.3 Duplicate handling

The same month or same file may be imported more than once.

Required behavior:

- duplicates are ignored automatically;
- no manual duplicate confirmation required;
- import summary must show how many transactions were added and how many were ignored as duplicates;
- duplicates must never corrupt totals;
- importing the same file multiple times must be safe.

### 5.4 Malformed files

The app must be foolproof when the wrong or malformed file is uploaded.

Required behavior:

- no crash;
- no partial silent corruption;
- clear Dutch error message;
- show whether zero rows were imported;
- keep the app usable after failed upload.

## 6. Transactions and editing

### 6.1 Default behavior

The normal workflow should be automatic import plus categorization/review. Users should not normally need to add, edit, or delete transactions manually.

### 6.2 Manual edit/delete

Manual transaction edit/delete must exist for exceptional corrections, but it must be hidden from the normal interface.

Requirements:

- not visible in the default dashboard or normal review flow;
- available only to admins;
- enabled through a separate admin/settings/safe-mode area;
- every manual change is audit logged;
- every manual change triggers balance/totals validation;
- users receive a clear Dutch confirmation or warning.

### 6.3 Required transaction classification

Every transaction must have:

- income or expense direction;
- main category;
- subcategory;
- project/fund when applicable;
- description/purpose from bank import and/or category context;
- optional note.

There should be no concept of permanent `unclear`, `questionable`, or ambiguous transactions. There is only:

- categorized;
- needs manual categorization/review;
- approved.

## 7. Categories, subcategories, funds, and projects

### 7.1 Existing taxonomy

The app must use the existing categories/subcategories/projects from the current application and existing spreadsheet. Do not invent a new taxonomy.

Implementation task:

- inspect current app category model and seeded/production categories;
- inspect provided spreadsheet/category data;
- map exactly into the simplified data model;
- allow later fine-tuning after migration.

### 7.2 Main categories and subcategories

Confirmed requirement:

- main categories exist;
- subcategories exist;
- admins can create new categories and subcategories;
- auto-categorization should preserve this hierarchy.

### 7.3 Funds/projects

Confirmed requirement:

- income/expenses may be split by project/fund/category mix;
- one transaction cannot belong to multiple funds/projects;
- one donation cannot be split across General and project;
- one expense cannot be split across multiple projects;
- admins can create new funds/projects.

### 7.4 Public vs internal detail

Internal and external administration use the same underlying data, but the public year report can be higher level.

Required behavior:

- internal data can be detailed;
- public ANBI/year report can show high-level income and expense totals;
- app should leave room to define more detailed reporting later.

## 8. Auto-categorization and review

### 8.1 Matching rules

Required behavior:

- if there is a full historical match, auto-categorize automatically;
- if no 100% match exists, the app should suggest a category/subcategory/project where possible;
- non-100% suggestions must go to manual approval queue;
- never auto-approve non-100% matches;
- recurring transactions should be auto-categorized;
- app should learn from previous manual categorizations;
- bulk actions should exist for obvious recurring items.

### 8.2 Review queue

A transaction needs review when it cannot be auto-categorized from a 100% match.

Review UI should show:

- number of transactions needing review;
- one-at-a-time review mode;
- optional table/list mode;
- suggested category/subcategory/project;
- quick accept/edit actions;
- bulk assignment for recurring groups;
- optional transaction note hidden until needed.

No `questionable` workflow is required.

## 9. Evidence and attachments

No general attachment/evidence system is required.

Confirmed:

- no receipt upload;
- no invoice upload;
- no contract upload;
- no attachment storage;
- no links to Google Drive/Dropbox/email/paper folder;
- only ING exports should be stored/exportable.

Optional transaction notes are required, but hidden from the main UI unless needed.

## 10. Reports and exports

### 10.1 Monthly report

Monthly report must show:

- income total;
- expense total;
- where the money went;
- categories/subcategories;
- totals;
- visual dashboard with charts/stats.

### 10.2 Year report

Year report must show the same kind of information as the monthly report, but for the whole year.

Required:

- income vs expenses;
- balance sheet / carried balance;
- clear category totals;
- notes/explanations area;
- public ANBI-friendly report view;
- internal more detailed view if needed.

Not required for now:

- PDF export;
- ZIP export;
- donor/giver summaries;
- extra fund/project reports beyond dashboard drilldown;
- unresolved/questionable items report.

### 10.3 Export

Required:

- original ING exports can be exported/downloaded from the application.

Not required:

- generic CSV export of every internal table;
- Excel/XLSX report export unless later requested;
- PDF report export unless later requested;
- ZIP package unless later requested.

## 11. Email summaries

Existing Resend-based monthly financial summary functionality should remain.

Requirements:

- keep current ability to add email addresses for people who want the monthly summary;
- improve/fine-tune integration;
- make it easier to use;
- keep it aligned with the simplified monthly dashboard/report.

## 12. Users, auth, and permissions

### 12.1 Users

Expected users: about 3, but no hard limit.

### 12.2 Roles

Required roles:

- admin;
- viewer.

Admin:

- can import;
- can categorize/review;
- can manage categories/subcategories/projects;
- can access hidden manual edit/delete settings;
- can approve/close/reopen periods if that feature is retained;
- can manage email summary recipients.

Viewer:

- can see dashboards/reports/ledger as configured;
- cannot make destructive or classification changes.

### 12.3 Auth

- Use Ory, locally available in the infrastructure.
- Clerk should not remain the primary auth direction.
- Every user should log in individually.

### 12.4 Audit log

Required:

- log who changed what;
- especially category/subcategory/project changes;
- manual transaction edits/deletes;
- import events;
- admin setting toggles;
- report/year close events.

## 13. UI requirements

### 13.1 Primary dashboard

After login, the user should immediately see:

- last month overview;
- income;
- expenses;
- net flow;
- charts/pie charts/statistics;
- big clear numbers;
- simple cards;
- no clutter;
- no metadata-heavy UI;
- one-click import.

The dashboard is month-first, with an option to switch to yearly view.

### 13.2 Visual style

The UI must be:

- modern;
- clean;
- calm;
- simple;
- Dutch;
- fast;
- not AI-generated looking;
- not crammed;
- not overloaded with filters, tabs, menus, buttons, or explanatory copy.

### 13.3 Information hiding

Hide unless needed:

- transaction comments;
- notes;
- long descriptions;
- counterparty names;
- account numbers;
- raw bank metadata.

Show by default:

- income;
- expenses;
- category/subcategory/project totals;
- monthly status;
- review workload.

### 13.4 Tables

Tables should be secondary.

Use tables only for:

- review queue;
- ledger drilldown;
- search/filtering historical transactions;
- admin correction mode.

Cards should be the primary dashboard presentation.

### 13.5 Responsive behavior

- Desktop is primary.
- Small desktop screens must work well.
- Mobile does not need to be primary, but layout should be responsive enough not to break.

## 14. Cleanup boundaries

Approved for removal:

- Stripe/subscription/payment SaaS code;
- marketing homepage;
- blog;
- waiting list;
- FAQ;
- public SaaS pages;
- old project/scenario/Make/n8n-style code unrelated to the ledger;
- unused image assets;
- template branding;
- current UI styling if it blocks redesign.

Approved direction:

- app becomes private-only;
- opening the app goes directly to dashboard after login;
- app name stays **Yeshua Academy Finance**, not globally renamed to Yeshua Ledger Lite.

## 15. Production/data status

- Current deployed app is not used by anyone today.
- It can go offline during major redesign if needed.
- Production data must be retained and migrated carefully later.
- Full production data assessment happens after the redesigned app is ready enough.

## 16. First milestone order

Stakeholder-approved order:

1. Assess interview answers and write requirements/roadmap/implementation plan.
2. Produce UI prototype using the `brain` repo design orchestrator approach.
3. Update documentation, `DESIGN.md`, and AI-readable project docs once prototype direction is approved.
4. Import cleanup.
5. Repo bloat removal.
6. Execute implementation plan step by step.

## 17. Known follow-up research/tasks

- Inspect the uploaded ING export file to confirm exact format and fields.
- Inspect current app categories/subcategories/projects and preserve them.
- Inspect existing Resend monthly summary implementation.
- Inspect Brain repo for ING Playwright downloader automation and decide if/how to incorporate it.
- Create a UI prototype brief using the `brain/ai/skills/custom/design/SKILL.md` workflow.
