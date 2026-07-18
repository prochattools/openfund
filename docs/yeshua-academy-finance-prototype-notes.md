# Yeshua Academy Finance — Prototype Notes

Status: ARCHIVED  
This document is retained as historical prototype evidence and must not govern new implementation.

Status: initial isolated prototype created  
Date: 2026-05-14

## 1. What changed

Created an isolated UI prototype route:

- `src/app/prototype/page.tsx`

Created supporting product/design source files earlier in the same phase:

- `PRODUCT.md`
- `DESIGN.md`
- `docs/yeshua-academy-finance-prototype-execution-brief.md`

No production data flows were changed. No cleanup was performed. No migrations, auth, Docker, package, or deployment files were changed.

## 2. Prototype route

Open locally at:

```text
/prototype
```

The prototype is self-contained and uses local mock data only.

## 3. Prototype coverage

The prototype demonstrates the intended future UI direction for:

1. **Dashboard**
   - Dutch-only UI.
   - Last-month style overview.
   - KPI cards for inkomsten, uitgaven, saldo verandering, and nog te beoordelen.
   - One-click ING import button.
   - Latest import summary.
   - Income vs expenses chart concept.
   - Category breakdown cards.

2. **Importeren**
   - Upload-ready state.
   - Success state.
   - Duplicate ignored state.
   - Wrong-file error state.
   - Dutch natural-language feedback.

3. **Te beoordelen**
   - Focused one-transaction review card.
   - Suggested category/subcategory/project.
   - Accept/edit/note actions.
   - Queue preview.
   - Table mode concept.

4. **Transacties**
   - Secondary table-based drilldown.
   - Limited filters.
   - Status labels.
   - Notice that raw ING details, notes, and audit log are hidden until expanded.

5. **Jaaroverzicht**
   - Internal view and ANBI-publication view concept.
   - Income, expense, result, and balance/carry-forward cards.
   - Explanation/notes area.

6. **Instellingen**
   - Users/roles.
   - Categories.
   - Projects/funds.
   - Email recipients.
   - ING import files.
   - Safe admin correction mode.
   - Audit log.

## 4. Design decisions

- Light, warm, tinted neutral interface.
- Restrained green accent.
- Card-first dashboard.
- Tables only for drilldown/review/admin contexts.
- Dutch-only labels and feedback.
- No marketing surface.
- No dark/neon finance aesthetic.
- No blue/purple AI-gradient dashboard aesthetic.
- Manual transaction correction is represented as a hidden safe-mode setting, not a normal workflow control.

## 5. Boundaries respected

The prototype did not:

- delete files;
- modify Prisma migrations;
- modify package files;
- change auth;
- change Docker/deployment config;
- connect to production APIs;
- alter data models;
- implement cleanup;
- commit or push.

## 6. Remaining design questions

1. Should the prototype become the basis for the real dashboard route immediately after approval, or should it first be converted into reusable components?
2. Should the year overview show public ANBI view and internal view as tabs, segmented buttons, or separate routes?
3. Should review default to one-by-one mode, with table mode secondary, as prototyped?
4. Should dashboard charts use simple CSS/SVG first, or Recharts once connected to live data?
5. Should the sidebar remain visible on desktop, or should navigation be top-level and even simpler?

## 7. Recommended next step

Review `/prototype` visually.

If approved, proceed to a bloat map before any destructive cleanup:

- `docs/yeshua-academy-finance-bloat-map.md`

After bloat map approval, begin implementation in this order:

1. extract prototype layout/components;
2. import cleanup and validation;
3. review queue model cleanup;
4. dashboard data aggregation;
5. repo bloat removal;
6. auth/roles and production migration later.
