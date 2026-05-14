# Yeshua Academy Finance — UI Design Brief

Status: ready for design/prototype phase  
Date: 2026-05-14  
Based on: stakeholder interview, repo inspection, and Brain design orchestrator principles

## 1. Design task classification

Using the Brain design orchestrator logic from `brain/ai/skills/custom/design/SKILL.md`:

- Scenario: `UPGRADE`, existing project with code and current UI.
- Project type: `SAAS` / dashboard / internal tool.
- Register: `Product`, design serves the work.
- Primary goal: tool efficiency, clarity, correctness, foolproof finance administration.
- Motion default: restrained and fast.
- Density target: low on dashboard, medium only in review/ledger drilldowns.

## 2. Product summary

Yeshua Academy Finance is a private Dutch-only finance administration app for a `kerkgenootschap` with ANBI status.

The app imports monthly ING bank exports, deduplicates transactions, auto-categorizes known recurring transactions, sends unknown transactions to review, and produces monthly/yearly insight plus ANBI-ready public reporting.

The user should not feel like they are using bookkeeping software. They should feel like they are opening a clear financial cockpit:

- Wat kwam er binnen?
- Waar ging het geld naartoe?
- Wat moet ik nog beoordelen?
- Kloppen de totalen?
- Kan ik de maand/het jaar afronden?

## 3. Physical scene sentence

A church administrator opens the app on a desktop monitor in an office or home-office setting, usually once a month, after downloading an ING export, and wants calm, immediate confidence that income, expenses, categories, and balances are correct without being overwhelmed by bookkeeping details.

This argues for a light or softly tinted neutral product UI, high readability, large numbers, few controls, and no dramatic dark dashboard aesthetic.

## 4. Design vibe

Target vibe:

- modern;
- calm;
- simple;
- trustworthy;
- clear;
- Dutch;
- spacious;
- product-first;
- warm enough for a church/nonprofit, but not decorative.

Anti-vibe:

- generic AI SaaS dashboard;
- finance bro dashboard;
- crypto/trading dashboard;
- dark neon analytics panel;
- cluttered enterprise admin panel;
- marketing landing page;
- glassmorphism;
- gradients everywhere;
- overly animated UI;
- dense spreadsheet clone as the main experience.

## 5. Color strategy

Recommended color strategy: **Restrained**.

Use tinted neutrals and one calm accent color. The UI is about trust and clarity, not excitement.

Rules:

- no pure black or pure white;
- no AI purple/blue gradient aesthetic;
- one primary accent max;
- use color mostly for status and category differentiation;
- charts should be readable, not rainbow-heavy;
- warnings/errors should be calm but clear.

Suggested semantic color roles, exact tokens to be decided in `DESIGN.md`:

- surface base;
- elevated surface;
- border/subtle divider;
- primary text;
- secondary text;
- muted text;
- accent/action;
- success/import complete;
- warning/duplicates ignored;
- error/import failed;
- income;
- expenses;
- review needed.

## 6. Typography

Use a modern sans-serif suitable for Dutch UI labels and numbers.

Design-orchestrator note: avoid default Inter/Roboto/Arial/Open Sans/Helvetica if possible.

Candidate directions:

- Geist;
- Satoshi;
- Outfit;
- Cabinet Grotesk for headings only if not too expressive.

Typography priorities:

- big readable financial numbers;
- clear Dutch labels;
- compact but not cramped tables;
- short text, no long explanatory blocks;
- numbers align cleanly.

## 7. Navigation model

Keep navigation minimal.

Proposed primary navigation:

1. **Dashboard**
2. **Importeren**
3. **Te beoordelen**
4. **Transacties**
5. **Jaaroverzicht**
6. **Instellingen**

Avoid deep nested menus.

Dashboard should be the default route after login.

## 8. Core UX flow

The app should naturally follow this flow without lots of explanatory text:

```text
Dashboard → Importeren → Importresultaat → Te beoordelen → Dashboard bijgewerkt → Jaaroverzicht
```

A month should have a visible status:

- `Nog niet geïmporteerd`
- `Geïmporteerd`
- `Te beoordelen`
- `Compleet`
- `Afgerond` if month close remains enabled

## 9. Screen brief

### 9.1 Dashboard

Purpose: immediate insight.

Default view: previous/latest month.

Must show:

- month selector;
- income total;
- expenses total;
- net result;
- review queue count;
- last import status;
- category/subcategory breakdown;
- chart for income vs expenses;
- simple spending breakdown chart;
- one-click import button.

Design direction:

- card-first;
- large numbers;
- visual hierarchy through size and spacing;
- no detailed transaction table by default;
- click cards to drill down.

Dutch example labels:

- `Inkomsten`
- `Uitgaven`
- `Saldo verandering`
- `Nog te beoordelen`
- `Laatste import`
- `Importeren`
- `Bekijk transacties`

### 9.2 Importeren

Purpose: safe monthly ING import.

Flow:

1. Drag/drop or select file.
2. Detect month/account/row count.
3. Preview summary.
4. Confirm import.
5. Show result.

Result states:

- success: `Import voltooid. 143 transacties toegevoegd.`
- duplicates: `20 dubbele transacties genegeerd.`
- invalid file: `Dit bestand kan niet worden ingelezen. Upload een ING-exportbestand in het juiste formaat.`
- partial issues: `Import voltooid met waarschuwingen. 2 rijen konden niet worden verwerkt.`

Design direction:

- one primary upload area;
- clear result card;
- no raw error codes;
- no technical stack traces;
- easy next action: `Beoordeel transacties` or `Terug naar dashboard`.

### 9.3 Te beoordelen

Purpose: finish categorization.

Default view: one transaction at a time or compact queue with focus.

Must show:

- number remaining;
- transaction amount/date/description;
- suggested main category/subcategory/project if any;
- accept suggestion;
- choose category/subcategory/project;
- optional note hidden in expandable area;
- switch to table view;
- bulk apply for recurring groups.

Avoid:

- showing all raw metadata by default;
- overwhelming filters;
- too many buttons.

### 9.4 Transacties

Purpose: drilldown, search, correction.

Must show:

- full transaction list;
- filters by month/year/category/project/review status;
- search;
- expandable row details;
- raw ING row only on expand;
- audit trail only on expand/details.

Manual edit/delete:

- hidden by default;
- admin-only;
- safe-mode/settings controlled;
- with warnings and total validation.

### 9.5 Jaaroverzicht

Purpose: annual reporting.

Must show:

- selected year;
- total income;
- total expenses;
- balance/carry-forward;
- category breakdown;
- explanatory notes area;
- public ANBI view;
- internal detailed view.

No PDF/ZIP required now.

### 9.6 Instellingen

Purpose: manage what should not clutter daily workflow.

Sections:

- gebruikers/rollen;
- categorieën;
- projecten/fondsen;
- e-mailontvangers;
- ING-importbestanden;
- veilige beheermodus for manual transaction corrections;
- audit log.

## 10. Component principles

Use cards for:

- totals;
- month status;
- import result;
- category breakdown;
- year summary.

Use tables for:

- review list/table mode;
- transaction drilldown;
- audit log;
- settings lists.

Use charts for:

- income vs expenses;
- expense category breakdown;
- income category breakdown;
- month-by-month yearly trend.

Charts should be simple and not over-decorated.

## 11. Motion principles

Motion should serve orientation only.

Allowed:

- subtle card entrance;
- import result transition;
- expand/collapse details;
- chart load transition;
- review item moving to next.

Avoid:

- bouncy motion;
- decorative animation;
- slow page transitions;
- motion that makes finance work feel playful.

Respect reduced motion.

## 12. Copy principles

Dutch only.

Use short, plain labels.

Avoid long onboarding copy. The UI should explain itself through structure.

Examples:

- `Importeren`
- `Te beoordelen`
- `Alles is bijgewerkt`
- `Geen nieuwe transacties gevonden`
- `Dubbele transacties genegeerd`
- `Categorie kiezen`
- `Suggestie accepteren`
- `Maand bekijken`
- `Jaaroverzicht`

## 13. Foolproof behavior design

The UI must prevent or safely handle:

1. importing the same file repeatedly;
2. uploading the wrong file;
3. corrupting totals through manual edits;
4. confusing monthly vs yearly views;
5. miscategorizing transactions without review;
6. accidentally exposing edit/delete in normal workflow;
7. burying important review work under filters/tables.

## 14. Prototype prompt for Codex/Claude/design orchestrator

Use the following prompt if running the Brain design orchestrator directly in Codex or Claude Code:

```text
You are working in the existing `yeshuaacademy-finance` repo. Use the design orchestrator workflow from `brain/ai/skills/custom/design/SKILL.md`.

Design task:
Redesign the existing Yeshua Academy Finance app into a Dutch-only, private, foolproof finance dashboard for a kerkgenootschap with ANBI status. This is an existing project upgrade, not a marketing site. Register: Product. Project type: internal SaaS/dashboard/tool. Primary goal: tool efficiency, financial clarity, safe monthly ING import, transaction review, monthly insight, and yearly ANBI/internal reporting.

Read these repo docs first:
- `docs/yeshua-ledger-lite-requirements.md`
- `docs/yeshua-academy-finance-roadmap.md`
- `docs/yeshua-academy-finance-implementation-plan.md`
- `docs/yeshua-academy-finance-ui-design-brief.md`

Create a design direction and prototype plan before implementation. Do not clean up or delete code yet.

Product facts:
- Product name remains `Yeshua Academy Finance`.
- UI language must be Dutch only.
- Private app, no marketing homepage.
- Dashboard is first screen after login.
- One-click monthly ING import must be prominent.
- The ING bank export is the source of truth.
- Duplicate imports are ignored automatically with clear Dutch feedback.
- Wrong files must fail gracefully with Dutch natural-language errors.
- Main workflow: Dashboard → Importeren → Te beoordelen → Dashboard/Jaaroverzicht.
- Categories, subcategories, and projects/funds already exist and must not be reinvented.
- No attachment/evidence feature except stored ING exports.
- No PDF or ZIP export for now.
- Desktop-first, responsive enough for small screens.
- Admin and viewer roles only.
- Ory is the future auth direction.
- Keep existing Resend monthly financial summary functionality.

UI direction:
- calm, modern, minimal, trustworthy, spacious;
- card-first dashboard;
- tables only for review, transaction drilldown, admin/audit;
- big readable numbers;
- charts for income/expenses/category breakdown;
- low clutter, few menus, few filters;
- no generic AI dashboard look;
- no dark neon finance dashboard;
- no marketing hero/FAQ/waiting list UI;
- notes/raw metadata hidden until drilldown.

Prototype these screens:
1. Dashboard with last month income, expenses, net movement, review count, latest import status, charts, and import button.
2. Importeren screen with file upload, detected month/account, preview summary, duplicate/error/success states.
3. Te beoordelen screen with one-transaction focus mode, suggested category/subcategory/project, accept/edit actions, optional table mode, bulk recurring action.
4. Transacties drilldown with search/filter and expandable raw ING details.
5. Jaaroverzicht with income, expenses, balance/carry-forward, public ANBI view, internal detail view, notes.
6. Instellingen with users/roles, categories, projects/funds, email recipients, ING exports, safe admin correction mode, audit log.

Deliverables:
- `PRODUCT.md` if missing or outdated.
- `DESIGN.md` with color, typography, spacing, layout, motion, component rules.
- A prototype plan or prototype implementation depending on the chosen workflow.
- Do not commit or push unless explicitly asked.
```

## 15. Design acceptance checklist

Before implementation, the design must pass:

- Dutch-only labels and messages.
- Dashboard opens directly after login.
- One-click import is obvious.
- No marketing surface.
- No generic AI dashboard aesthetic.
- Dashboard is not table-first.
- Review work is visible and easy.
- Raw metadata is hidden until drilldown.
- Manual edit/delete is hidden behind admin/safe-mode.
- Design has clear empty, loading, success, warning, and error states.
- Works on desktop and small desktop screens.
