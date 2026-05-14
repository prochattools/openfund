# DESIGN.md — Yeshua Academy Finance

Status: initial design system direction for prototype  
Date: 2026-05-14  
Register: Product  
Scenario: Existing app upgrade  
Project type: internal dashboard/tool

## 1. Design intent

Yeshua Academy Finance should feel calm, clear, and trustworthy. The interface exists to help church administrators understand money flow quickly and safely.

The design must reduce cognitive load:

- big numbers first;
- cards before tables;
- one primary action per screen;
- Dutch labels only;
- raw details hidden until needed;
- safe import and review workflows;
- no marketing UI;
- no AI-looking dashboard clichés.

## 2. Physical scene

A church administrator opens the app on a desktop monitor in an office or home-office setting, usually once a month, after downloading an ING export. They want calm, immediate confidence that income, expenses, categories, and balances are correct without being overwhelmed by bookkeeping details.

Design implication: prefer a light, softly tinted neutral UI with generous whitespace, restrained accent color, readable typography, and quiet motion.

## 3. Visual principles

1. **Financial clarity first**: show income, expenses, net movement, review count, and import status before any table.
2. **One obvious next action**: the user should always know whether to import, review, or inspect reports.
3. **Cards are the default**: use cards for overview and status. Tables are drilldown tools.
4. **Details are progressive**: descriptions, counterparty names, account numbers, raw ING data, notes, and audit logs are hidden until expanded.
5. **Dutch and human**: all UI copy is Dutch, short, and natural.
6. **Guardrails over warnings**: prevent duplicate/corrupt imports rather than explaining errors afterward.
7. **Calm confidence**: the UI should not feel flashy, playful, corporate SaaS, or trading/crypto-like.

## 4. Color strategy

Strategy: **Restrained**.

Use tinted neutrals and one calm accent. Color is used for meaning, not decoration.

### Palette direction

Exact final OKLCH/CSS tokens should be finalized during prototype implementation, but the direction is:

- Base surface: warm off-white / very light stone.
- Elevated cards: softly tinted ivory/linen.
- Borders: low-contrast warm gray.
- Primary text: deep ink with slight warmth.
- Secondary text: softened gray-brown.
- Accent/action: calm green or muted teal, not bright blue/purple.
- Income: calm green.
- Expenses: muted terracotta or auburn.
- Review needed: warm amber.
- Error: restrained red, used sparingly.

### Bans

- No pure `#000` or pure `#fff`.
- No blue/purple AI gradients.
- No glassmorphism as default.
- No neon finance dashboard palette.
- No rainbow chart overload.
- No gradient text.

## 5. Typography

Use a clean sans-serif suitable for Dutch product UI and financial numbers.

Preferred candidates:

- Geist;
- Satoshi;
- Outfit.

Avoid if possible:

- Inter;
- Roboto;
- Arial;
- Open Sans;
- Helvetica.

### Type hierarchy

- Page title: compact, clear, not oversized.
- KPI numbers: large and highly readable.
- Card labels: small uppercase or semi-bold Dutch labels.
- Body text: minimal.
- Tables: compact but breathable.
- Numeric columns: align right where useful.

## 6. Layout system

### App shell

Private app shell only. No public marketing navigation.

Primary navigation:

1. Dashboard
2. Importeren
3. Te beoordelen
4. Transacties
5. Jaaroverzicht
6. Instellingen

Navigation should be minimal and persistent. Desktop-first.

### Dashboard layout

Dashboard should feel like a simple cockpit:

- top row: month selector, import button, status;
- main KPI cards: inkomsten, uitgaven, saldo verandering, te beoordelen;
- chart area: income vs expenses, category breakdown;
- secondary cards: latest import, monthly readiness, email summary status;
- no transaction table by default.

### Review layout

Review flow should be focused:

- left/main: current transaction or grouped recurring item;
- right/secondary: remaining queue and progress;
- optional table mode for power review;
- notes collapsed by default.

### Ledger layout

Ledger is a drilldown area:

- filters are available but not overwhelming;
- rows expand for raw ING details;
- manual edit/delete hidden behind admin safe-mode.

## 7. Components

### Core components

- KPI card.
- Month selector.
- Import action card.
- Import result card.
- Review queue card.
- Category breakdown card.
- Simple chart card.
- Transaction detail drawer/expandable row.
- Safe-mode admin panel.
- Dutch toast/alert system.

### Tables

Use tables only for:

- review table mode;
- transaction drilldown;
- audit log;
- settings lists.

Tables must be spacious and readable, not spreadsheet-like as the primary experience.

## 8. Chart style

Charts should be simple and readable.

Use cases:

- monthly income vs expenses;
- expenses by category;
- income by category;
- month-by-month trend in year view.

Rules:

- keep labels clear;
- avoid excessive legends;
- avoid too many colors;
- use chart cards with clear summary numbers;
- charts should support insight, not decoration.

## 9. Interaction and motion

Motion intensity: low to medium-low.

Allowed:

- subtle card entrance;
- import result reveal;
- expand/collapse transaction details;
- review item moves to next;
- chart fade/scale-on-load.

Rules:

- animate only transform and opacity;
- no bouncy/elastic motion;
- support reduced motion;
- no decorative animation;
- interactions should feel fast.

## 10. Dutch copy system

Copy must be short and practical.

### Navigation

- Dashboard
- Importeren
- Te beoordelen
- Transacties
- Jaaroverzicht
- Instellingen

### KPI labels

- Inkomsten
- Uitgaven
- Saldo verandering
- Nog te beoordelen
- Laatste import
- Deze maand
- Dit jaar

### Import feedback

- `Import voltooid.`
- `143 transacties toegevoegd.`
- `20 dubbele transacties genegeerd.`
- `Geen nieuwe transacties gevonden.`
- `Dit bestand kan niet worden ingelezen.`
- `Upload een ING-exportbestand in het juiste formaat.`
- `Import voltooid met waarschuwingen.`

### Review feedback

- `Suggestie accepteren`
- `Categorie kiezen`
- `Subcategorie kiezen`
- `Project kiezen`
- `Opslaan en volgende`
- `Alles is beoordeeld`

### Admin/safe-mode feedback

- `Beheermodus inschakelen`
- `Handmatige correcties zijn verborgen in de normale workflow.`
- `Deze wijziging wordt gelogd.`
- `Totalen opnieuw gecontroleerd.`

## 11. Screen specifications

### 11.1 Dashboard

Default after login.

Content:

- selected month, default latest/previous month;
- primary import button;
- income total;
- expense total;
- net movement;
- review count;
- latest import summary;
- income/expense chart;
- category breakdown cards;
- year switch.

Empty state:

- `Er zijn nog geen transacties geïmporteerd voor deze maand.`
- Primary action: `ING-export importeren`.

### 11.2 Importeren

Content:

- single upload/drop area;
- detected account/month/date range after file selection;
- preview counts;
- confirm import;
- import result.

States:

- idle;
- file selected;
- validating;
- preview ready;
- importing;
- success;
- duplicate-only;
- warning/partial;
- invalid file;
- failed safely.

### 11.3 Te beoordelen

Content:

- remaining count;
- focused transaction card;
- suggested classification;
- category/subcategory/project controls;
- accept suggestion;
- save and next;
- collapsed note field;
- optional table mode;
- bulk recurring actions.

### 11.4 Transacties

Content:

- search;
- month/year/category filters;
- transaction list;
- expandable row details;
- raw ING details hidden until expanded;
- audit history hidden until expanded;
- admin-only correction controls behind safe-mode.

### 11.5 Jaaroverzicht

Content:

- year selector;
- income total;
- expense total;
- net result;
- balance/carry-forward;
- category breakdown;
- public ANBI view;
- internal details view;
- explanation/notes area.

### 11.6 Instellingen

Content:

- users and roles;
- categories/subcategories;
- projects/funds;
- email recipients;
- stored ING exports;
- safe-mode for manual corrections;
- audit log.

## 12. Responsive behavior

Primary target: desktop.

Minimum responsive requirements:

- works on small desktop/laptop widths;
- cards stack cleanly;
- tables can scroll horizontally where necessary;
- navigation remains usable;
- mobile does not need native-app polish but must not break.

## 13. Accessibility

- High contrast enough for financial work.
- Keyboard navigable import/review controls.
- Clear focus states.
- Reduced motion support.
- No information conveyed by color alone.
- Destructive/admin actions have clear labels and confirmations.

## 14. Anti-pattern checklist

Reject designs that include:

- public hero section;
- marketing slogans;
- generic three-card SaaS layout as the whole design;
- dense table-first dashboard;
- too many filters on the dashboard;
- blue/purple gradient SaaS look;
- glassmorphism cards;
- dark neon charts;
- raw bank metadata visible by default;
- edit/delete controls visible in normal transaction views;
- English labels;
- long explanatory text blocks.

## 15. Prototype acceptance checklist

A prototype is acceptable when:

- it opens on a Dutch dashboard;
- the dashboard immediately shows income, expenses, net movement, review count, and import status;
- the import workflow feels safe and simple;
- duplicate and wrong-file states are designed;
- the review queue is clear and focused;
- tables are secondary;
- manual correction is hidden behind settings/safe-mode;
- yearly view includes internal balance/carry-forward and public ANBI view;
- the UI feels calm and non-generic;
- there is enough direction to implement without reinterpreting the product.
