# PRODUCT.md — Yeshua Academy Finance

Status: design/source-of-truth baseline  
Date: 2026-05-14  
Product name: **Yeshua Academy Finance**  
Internal design concept: **Yeshua Ledger Lite**

## 1. What this product is

Yeshua Academy Finance is a private Dutch-only finance administration app for a `kerkgenootschap` with individual ANBI status.

It is a small, strict, visual ledger for monthly ING bank imports, transaction categorization, monthly insight, yearly reporting, and internal/public ANBI accountability.

The app should feel like a calm financial cockpit, not bookkeeping software.

## 2. What this product is not

Yeshua Academy Finance is not:

- generic accounting software;
- an ERP;
- a SaaS product;
- a public marketing website;
- a donation platform;
- a CRM;
- an invoice system;
- a payroll system;
- a document/evidence archive;
- an AI bookkeeping product;
- a personal finance tracker.

## 3. Core promise

Open the app and immediately understand:

- wat kwam er binnen;
- waar ging het geld naartoe;
- welke transacties nog beoordeling nodig hebben;
- of de maand/het jaar klopt;
- of de administratie klaar is voor intern gebruik en ANBI-publicatie.

## 4. Primary users

### Admin

The admin imports the monthly ING export, reviews transactions that cannot be categorized automatically, manages categories/projects, sends or manages monthly summaries, and checks yearly reports.

Needs:

- speed;
- clear overview;
- safe import;
- no duplicate risk;
- simple review queue;
- hidden-but-available correction tools;
- confidence that totals stay correct.

### Viewer

The viewer can inspect dashboard/reports but cannot mutate administration data.

Needs:

- clear insight;
- no complicated controls;
- trust in the numbers.

## 5. Organization context

- Legal/organizational form: `kerkgenootschap`.
- ANBI status: individual to this kerkgenootschap.
- Current financial accountability is published on `yeshua.academy`.
- Book year: January through December.
- Public ANBI report and internal year report are both required.
- Internal balance sheet and year carry-forward are required.
- Existing monthly summary email functionality through Resend should remain and improve.

## 6. Product workflow

Default workflow:

```text
Login → Dashboard → Importeren → Te beoordelen → Dashboard bijgewerkt → Jaaroverzicht
```

Monthly workflow:

```text
ING maandexport downloaden → importeren → dubbele transacties negeren → bekende transacties automatisch categoriseren → onbekende transacties beoordelen → maandrapport bekijken
```

Yearly workflow:

```text
Alle maanden geïmporteerd → alle transacties gecategoriseerd → totalen controleren → balans/overdracht controleren → jaaroverzicht maken → publieke ANBI-weergave gebruiken
```

## 7. Source of truth

The ING export is the source of truth for transaction data.

Rules:

- imported bank data must not be silently overwritten;
- every transaction must trace back to an import batch;
- duplicate imports must be safe;
- original ING exports must be stored/exportable;
- categorization is editable but separate from source bank data;
- manual transaction edit/delete exists only in hidden admin safe-mode;
- every manual mutation must be audit logged and followed by total checks.

## 8. Language and voice

UI language is Dutch only.

Voice:

- plain;
- calm;
- direct;
- short;
- natural;
- not technical;
- no raw error codes;
- no long explanatory onboarding copy.

Examples:

- `Import voltooid`
- `143 transacties toegevoegd`
- `20 dubbele transacties genegeerd`
- `Dit bestand kan niet worden ingelezen`
- `7 transacties hebben nog een categorie nodig`
- `Alles is bijgewerkt`
- `Suggestie accepteren`

## 9. Core features

### Must have

- Dutch dashboard after login.
- Monthly ING import.
- Automatic duplicate detection and ignore.
- Automatic categorization for 100% historical matches.
- Manual review queue for non-100% matches.
- Main categories and subcategories.
- Project/fund assignment where applicable.
- Admin-created categories/projects.
- Monthly report dashboard.
- Year report dashboard.
- Internal balance/carry-forward behavior.
- Public ANBI-friendly report view.
- Original ING export storage/download.
- Resend monthly summary integration.
- Admin/viewer roles.
- Ory auth direction.
- Audit log for manual changes.

### Should have

- Bulk actions for recurring review items.
- One-transaction-at-a-time review mode.
- Optional review table mode.
- Safe admin correction mode.
- Dutch success/warning/error feedback.
- Responsive desktop/small-screen support.

### Out of scope for now

- PDF export.
- ZIP export.
- Donor/giver summaries.
- Receipt/invoice/contract attachments.
- General evidence archive.
- Stripe/payment checkout.
- Public marketing pages.
- Blog/waiting list/FAQ SaaS pages.
- Multi-tenant SaaS functionality.
- Full payroll feature set.
- Bank API connection.
- Generic manual bookkeeping.

## 10. Design principles

- Cards before tables.
- Big numbers before details.
- Dashboard before ledger table.
- One-click import.
- Hide raw metadata until drilldown.
- Keep normal workflow safe and simple.
- Correction tools exist but are hidden behind admin safe-mode.
- Every critical state has Dutch feedback.
- No generic AI dashboard aesthetic.
- No finance-bro, crypto, or dark neon style.
- No marketing homepage.

## 11. Product anti-references

Avoid anything that feels like:

- SaaS boilerplate;
- generic admin template;
- cluttered bookkeeping software;
- spreadsheet clone as first screen;
- crypto/trading dashboard;
- dark analytics cockpit;
- AI-generated blue/purple gradient interface;
- public landing-page product.

## 12. Success criteria

The product succeeds when an admin can:

1. open the app and immediately understand last month’s income and expenses;
2. import the same ING file twice without corrupting data;
3. upload a wrong file and receive a safe Dutch error;
4. review only the transactions that truly need attention;
5. trust that recurring transactions are categorized correctly;
6. see clear monthly and yearly totals;
7. produce internal and public ANBI-ready reporting;
8. avoid manual transaction editing in normal workflow;
9. still correct mistakes safely when necessary;
10. explain the administration from bank export to report.

## 13. Related docs

- `docs/yeshua-ledger-lite-requirements.md`
- `docs/yeshua-academy-finance-roadmap.md`
- `docs/yeshua-academy-finance-implementation-plan.md`
- `docs/yeshua-academy-finance-ui-design-brief.md`
