# Yeshua Academy Finance — Prototype Execution Brief

Status: ARCHIVED  
This document is retained as historical prototype-planning evidence and must not govern new implementation.

Status: ready for prototype execution  
Date: 2026-05-14  
Purpose: guide the next implementation/prototype agent without starting cleanup or production migration.

## 1. Mission

Create a UI prototype for the redesigned Yeshua Academy Finance app.

This is a prototype/design phase only. Do not remove legacy code, do not change Prisma migrations, do not change production data flows, and do not perform repo bloat cleanup yet.

The prototype should prove the new UX direction:

```text
Dashboard → Importeren → Te beoordelen → Transacties → Jaaroverzicht → Instellingen
```

## 2. Required reading before work

Read these files first:

- `PRODUCT.md`
- `DESIGN.md`
- `docs/yeshua-ledger-lite-requirements.md`
- `docs/yeshua-academy-finance-roadmap.md`
- `docs/yeshua-academy-finance-implementation-plan.md`
- `docs/yeshua-academy-finance-ui-design-brief.md`

Optional reference:

- Brain design orchestrator: `brain/ai/skills/custom/design/SKILL.md`

## 3. Hard boundaries

Do not:

- delete files;
- remove routes;
- remove dependencies;
- modify Prisma migrations;
- modify production data scripts;
- replace auth;
- implement Ory;
- implement Playwright bank downloader;
- change Docker/deploy files;
- change package lock files unless explicitly approved;
- commit or push.

Allowed prototype work:

- create isolated prototype files;
- create design-only components;
- create a prototype route if clearly isolated;
- create mock data for UI demonstration;
- create/update docs;
- create screenshots/notes if tooling supports it.

Recommended prototype location:

- `src/app/prototype/page.tsx`, or
- `src/app/(prototype)/prototype/page.tsx`, or
- `docs/prototype-notes.md` if no code prototype is made.

The prototype route can be removed later after approval.

## 4. Prototype data model

Use mock data only.

Mock at least:

- one month with imported ING transactions;
- income total;
- expense total;
- net movement;
- review queue count;
- duplicates ignored count;
- category breakdown;
- project/fund label examples;
- one failed import state;
- one duplicate-only import state;
- yearly total with balance carry-forward.

Do not connect prototype to production APIs unless explicitly approved later.

## 5. Screens to prototype

### 5.1 Dashboard

Must show:

- Dutch UI;
- selected month;
- primary button: `ING-export importeren`;
- KPI cards:
  - `Inkomsten`;
  - `Uitgaven`;
  - `Saldo verandering`;
  - `Nog te beoordelen`;
- latest import card;
- income vs expenses visual;
- category breakdown visual;
- monthly status;
- switch/link to yearly view.

No transaction table by default.

### 5.2 Importeren

Must show states:

- idle upload/drop zone;
- file selected/preview;
- success;
- duplicates ignored;
- malformed file error;
- partial warning.

Required copy examples:

- `Import voltooid. 143 transacties toegevoegd.`
- `20 dubbele transacties genegeerd.`
- `Dit bestand kan niet worden ingelezen. Upload een ING-exportbestand in het juiste formaat.`

### 5.3 Te beoordelen

Must show:

- one-transaction focus mode;
- suggested category/subcategory/project;
- `Suggestie accepteren`;
- `Categorie kiezen`;
- `Opslaan en volgende`;
- optional compact table/list toggle;
- bulk recurring action concept;
- collapsed note area.

### 5.4 Transacties

Must show:

- drilldown list/table;
- search;
- month/category filters but not too many;
- expandable row with raw ING data hidden by default;
- manual correction controls hidden behind safe-mode notice.

### 5.5 Jaaroverzicht

Must show:

- selected year;
- income total;
- expense total;
- result;
- balance/carry-forward;
- public ANBI view tab/section;
- internal detail view tab/section;
- explanation/notes area.

### 5.6 Instellingen

Must show sections:

- gebruikers en rollen;
- categorieën;
- projecten/fondsen;
- e-mailontvangers;
- ING-importbestanden;
- veilige beheermodus;
- auditlog.

## 6. Design requirements

Use `DESIGN.md` as the source of truth.

Required style:

- light/tinted neutral UI;
- restrained accent color;
- no blue/purple AI gradients;
- no dark neon finance dashboard;
- no marketing hero;
- no glassmorphism;
- no generic card grid cliché;
- big readable numbers;
- generous spacing;
- card-first dashboard;
- tables only for drilldown/review/admin.

## 7. Interaction states

Prototype must include visible states for:

- empty dashboard before import;
- import success;
- duplicate import;
- wrong file error;
- review queue has items;
- review queue empty;
- admin safe-mode disabled;
- yearly report ready.

## 8. Copy rules

All visible UI copy must be Dutch.

No raw technical errors.

No long instruction paragraphs. Use structure and short labels.

## 9. Accessibility/responsive expectations

- desktop-first;
- works at small laptop width;
- clear focus states;
- adequate contrast;
- no color-only meaning;
- reduced-motion friendly if motion is used.

## 10. Prototype acceptance checklist

Before marking prototype complete, confirm:

- dashboard is the first product screen;
- import button is one click away;
- dashboard is not table-first;
- all UI copy is Dutch;
- import error/success/duplicate states are designed;
- review queue is focused and simple;
- transaction raw metadata is hidden until drilldown;
- manual corrections are hidden behind safe-mode;
- year report includes balance/carry-forward;
- design does not resemble generic AI SaaS dashboards;
- no cleanup/destructive changes were made.

## 11. Suggested completion output

When prototype is done, update or create:

- `docs/yeshua-academy-finance-prototype-notes.md`

Include:

- what was prototyped;
- files created/changed;
- design decisions;
- unresolved questions;
- screenshots if available;
- next implementation recommendation.
