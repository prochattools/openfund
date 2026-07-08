# Yeshua Academy Finance — Decision brief: PDF-renderer

Status: Goedgekeurd en geïmplementeerd op 2026-07-08
Taal: Nederlands

## 1. Beslissing

De eigenaar heeft `pdfkit` goedgekeurd als server-side PDF-renderer voor report artifact PDF output. De implementatie is afgerond en vastgelegd in `docs/REAL_PDF_RENDERER_EVIDENCE_NL.md`.

## 2. Vereiste owner approval evidence

- Gekozen bibliotheek: `pdfkit`.
- Dependencywijziging expliciet toegestaan.
- Scope bevestigd: alleen report artifact PDF output.
- Real email sending blijft buiten scope.

## 3. Vereiste inputs buiten Git

- Geen inputs meer nodig voor PDF-rendererimplementatie.
- Real email sending vereist nog aparte goedkeuring.

## 4. Veilige preflight commands

```bash
node scripts/owner-decision-preflight.mjs --decision pdf
node scripts/owner-approved-action-plan.mjs --decision pdf
npm test -- --test-name-pattern "production blocker"
```

## 5. Veilige dry-run commands

```bash
npm test -- --test-name-pattern "report artifact"
npm run build:server
```

## 6. Veiligheidsgrenzen

- Geen productie of externe provider gebruiken.
- Geen geheimen of owner-bestanden toevoegen.
- Geen echte e-mail verzenden.

## 7. Uitgevoerde outline na approval

1. Preflight en gerichte report artifact tests uitgevoerd.
2. Alleen `pdfkit` toegevoegd.
3. Renderer achter bestaande report artifact-grens geïmplementeerd.
4. HTML/XLSX snapshotconsistentie behouden.
5. Gerichte tests en sanitized evidence toegevoegd.

## 8. Validatiepoorten

- Real PDF renderer evidence tests.
- Report artifact tests.
- Production blocker tests.
- Full test suite.
- Server build.
- Production build.
- Prisma validate/generate wanneer schema-onafhankelijkheid bevestigd moet worden.
- High-risk scan op gewijzigde docs/tests/scripts/package paths.

## 9. Rollbackplan

- Revert dependency- en renderercommits.
- Laat rapport snapshots ongemoeid.

## 10. Stopregels

- Stop bij build/test/audit failure na bounded repair.
- Stop wanneer de scope productie, e-mail, import of secret rotation raakt.

## 11. Afgerond bewijs

- Evidence: `docs/REAL_PDF_RENDERER_EVIDENCE_NL.md`.
- Test: `tests/ops/realPdfRendererEvidence.test.ts`.
- Remaining blocker: real email sending.

## 12. Bevestiging

Deze brief bevat geen secrets, hostnamen, runtimeconfiguratie, owner-bestanden, transactie-detailregels of DB-exportbestanden.
