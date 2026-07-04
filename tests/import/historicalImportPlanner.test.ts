import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseHistoricalWorkbookRows } from '../../lib/import/historicalWorkbookParser';
import { parseHistoricalIngCsvStatement } from '../../lib/import/ingCsvParser';
import {
  buildHistoricalTransactionFingerprint,
  planHistoricalImport,
} from '../../lib/import/historicalImportPlanner';

const workbookFixture = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, '../fixtures/historical-loading/2024-workbook-rows.json'), 'utf-8'),
);
const csvFixture = fs.readFileSync(path.resolve(__dirname, '../fixtures/historical-loading/2026-ing.csv'));
const clarificationFixture = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, '../fixtures/historical-loading/verduidelijking-rows.json'), 'utf-8'),
);

describe('historical import planner', () => {
  it('builds a deterministic plan for concluded and open statements', async () => {
    const workbookRows = parseHistoricalWorkbookRows(workbookFixture);
    const statement = await parseHistoricalIngCsvStatement(csvFixture, {
      periodStart: new Date('2026-01-01T00:00:00.000Z'),
      periodEnd: new Date('2026-07-01T00:00:00.000Z'),
    });

    const first = planHistoricalImport({
      concludedWorkbook: {
        filename: 'YA financieel jaar 2024.xlsx',
        mediaType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        sha256: 'fixture-sha-2024',
        rows: workbookRows,
      },
      openStatement: {
        filename: 'NL89INGB0006369960_2026-01-01_2026-07-01.csv',
        mediaType: 'text/csv',
        sha256: 'fixture-sha-2026-csv',
        pdfFilename: 'NL89INGB0006369960_2026-01-01_2026-07-01.pdf',
        pdfMediaType: 'application/pdf',
        pdfSha256: 'fixture-sha-2026-pdf',
        statement,
      },
      clarificationRows: clarificationFixture,
    });

    const second = planHistoricalImport({
      concludedWorkbook: {
        filename: 'YA financieel jaar 2024.xlsx',
        mediaType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        sha256: 'fixture-sha-2024',
        rows: workbookRows,
      },
      openStatement: {
        filename: 'NL89INGB0006369960_2026-01-01_2026-07-01.csv',
        mediaType: 'text/csv',
        sha256: 'fixture-sha-2026-csv',
        pdfFilename: 'NL89INGB0006369960_2026-01-01_2026-07-01.pdf',
        pdfMediaType: 'application/pdf',
        pdfSha256: 'fixture-sha-2026-pdf',
        statement,
      },
      clarificationRows: clarificationFixture,
    });

    expect(second).toEqual(first);
    expect(first.plan.workbook.period.closePermitted).toBe(true);
    expect(first.plan.openStatement.period.coverageStatus).toBe('PARTIAL');
    expect(first.plan.openStatement.period.closePermitted).toBe(false);
    expect(first.plan.openStatement.period.closeReason).toBe('Partial/open statements cannot be closed.');
    expect(first.plan.workbook.transactions[0]).toMatchObject({
      klant: 'FTK',
      type: 'Algemeen',
      category: 'Fixture Gift',
      rawRow: expect.objectContaining({ Klant: 'FTK' }),
    });
    expect(first.plan.workbook.statement.totals).toMatchObject({
      transactionCount: 2,
      incomeMinor: 10000n,
      expenseMinor: 2550n,
    });
    expect(first.plan.openStatement.statement.rowCount).toBe(2);
    expect(first.plan.openStatement.statement.sourceIsOpenPartial).toBe(true);
    expect(first.plan.openStatement.statement.supportingPdfFile?.kind).toBe('BANK_STATEMENT_PDF');
    expect(first.plan.openStatement.transactions[0]).toMatchObject({
      fingerprint: expect.any(String),
      rawRow: expect.objectContaining({ Date: '2026-01-01' }),
    });
    expect(first.plan.validationFindings).toContain('Open/partial 2026 statement is not eligible for period close planning.');
  });

  it('detects duplicate fingerprints and preserves sanitized evidence only', async () => {
    const workbookRows = parseHistoricalWorkbookRows(workbookFixture);
    const statement = await parseHistoricalIngCsvStatement(csvFixture, {
      periodStart: new Date('2026-01-01T00:00:00.000Z'),
      periodEnd: new Date('2026-07-01T00:00:00.000Z'),
    });
    const plan = planHistoricalImport({
      concludedWorkbook: {
        filename: 'YA financieel jaar 2024.xlsx',
        mediaType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        sha256: 'fixture-sha-2024',
        rows: workbookRows,
      },
      openStatement: {
        filename: 'NL89INGB0006369960_2026-01-01_2026-07-01.csv',
        mediaType: 'text/csv',
        sha256: 'fixture-sha-2026-csv',
        pdfFilename: 'NL89INGB0006369960_2026-01-01_2026-07-01.pdf',
        pdfMediaType: 'application/pdf',
        pdfSha256: 'fixture-sha-2026-pdf',
        statement,
      },
      clarificationRows: clarificationFixture,
    });

    expect(plan.plan.workbook.sourceFile.sha256).toBe('fixture-sha-2024');
    expect(plan.plan.workbook.sourceFile).not.toHaveProperty('content');
    expect(plan.plan.openStatement.sourceFile.sha256).toBe('fixture-sha-2026-csv');
    expect(plan.plan.duplicateFingerprints).toEqual([]);
    expect(plan.plan.workbook.clarificationEvidence).toEqual([
      {
        rowNumber: 1,
        rawRow: clarificationFixture[0],
        label: 'Fixture Project',
        referenceText: 'Reference: FIX-2025-A',
        note: 'Interpretation evidence only',
      },
      {
        rowNumber: 2,
        rawRow: clarificationFixture[1],
        label: 'Fixture Expense',
        referenceText: 'Reference: FIX-2025-B',
        note: 'Do not rewrite the booking history',
      },
    ]);
  });

  it('treats source identity as stable even when preserved labels differ', async () => {
    const duplicatedWorkbookRows = parseHistoricalWorkbookRows([
      workbookFixture[0],
      {
        ...workbookFixture[0],
        Klant: 'FR',
        Type: 'Schenking',
        Category: 'Different Fixture Label',
        Comment: 'Label variation only',
      },
      workbookFixture[1],
    ]);
    const statement = await parseHistoricalIngCsvStatement(csvFixture, {
      periodStart: new Date('2026-01-01T00:00:00.000Z'),
      periodEnd: new Date('2026-07-01T00:00:00.000Z'),
    });

    const plan = planHistoricalImport({
      concludedWorkbook: {
        filename: 'YA financieel jaar 2024.xlsx',
        mediaType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        sha256: 'fixture-sha-2024',
        rows: duplicatedWorkbookRows,
      },
      openStatement: {
        filename: 'NL89INGB0006369960_2026-01-01_2026-07-01.csv',
        mediaType: 'text/csv',
        sha256: 'fixture-sha-2026-csv',
        pdfFilename: 'NL89INGB0006369960_2026-01-01_2026-07-01.pdf',
        pdfMediaType: 'application/pdf',
        pdfSha256: 'fixture-sha-2026-pdf',
        statement,
      },
      clarificationRows: clarificationFixture,
    });

    const firstFingerprint = plan.plan.workbook.transactions[0]?.fingerprint;
    const duplicateFingerprint = plan.plan.workbook.transactions[1]?.fingerprint;

    expect(firstFingerprint).toBe(buildHistoricalTransactionFingerprint(duplicatedWorkbookRows[0]!));
    expect(duplicateFingerprint).toBe(firstFingerprint);
    expect(plan.plan.duplicateFingerprints).toEqual([
      firstFingerprint!,
    ]);
    expect(plan.plan.workbook.transactions[1]).toMatchObject({
      klant: 'FR',
      type: 'Schenking',
      category: 'Different Fixture Label',
      fingerprint: firstFingerprint,
    });
    expect(plan.plan.workbook.transactions[0]?.rawRow).toMatchObject({ Klant: 'FTK' });
  });
});
