import { describe, expect, it } from 'vitest';
import { buildMonthlyBalanceExportArtifacts, buildMonthlyBalanceExportPreview } from '../../server/services/monthlyBalanceExportService';
import type { MonthlyReconciliationResult } from '../../server/services/monthlyReconciliationService';

const balancedReconciliation: MonthlyReconciliationResult = {
  workspaceId: 'workspace-1',
  accountId: 'account-1',
  year: 2026,
  month: 1,
  periodStart: '2026-01-01T00:00:00.000Z',
  periodEnd: '2026-01-31T23:59:59.999Z',
  coverageStatus: 'COMPLETE',
  openingBalanceMinor: '100000',
  incomeMinor: '5000',
  expenseMinor: '2000',
  netMinor: '3000',
  closingBalanceMinor: '103000',
  transactionCount: 2,
  statementTransactionCount: 2,
  transactionCountDifference: 0,
  bookedTransactionCount: 2,
  unresolvedTransactionCount: 0,
  duplicateFingerprintCount: 0,
  runningBalanceErrorCount: 0,
  categoryIncomeDifferenceMinor: '0',
  categoryExpenseDifferenceMinor: '0',
  balanceDifferenceMinor: '0',
  status: 'BALANCED',
  closeEligible: true,
  reasons: [],
  categoryLines: [
    {
      lineKind: 'CATEGORY',
      groupKey: 'cat-1|credit',
      direction: 'credit',
      projectId: 'project-1',
      transactionTypeId: 'type-1',
      categoryId: 'cat-1',
      literalProjectLabel: 'Klant A',
      literalTypeLabel: 'Inkomsten',
      literalCategoryLabel: 'Donaties',
      amountMinor: '5000',
      transactionCount: 1,
      sortOrder: 1,
    },
  ],
  subcategoryLines: [
    {
      lineKind: 'SUBCATEGORY',
      groupKey: 'project-1|type-1|cat-1|credit',
      direction: 'credit',
      projectId: 'project-1',
      transactionTypeId: 'type-1',
      categoryId: 'cat-1',
      literalProjectLabel: 'Klant A',
      literalTypeLabel: 'Inkomsten',
      literalCategoryLabel: 'Donaties',
      amountMinor: '5000',
      transactionCount: 1,
      sortOrder: 1,
    },
  ],
  sourceFileHashes: ['source-hash-1'],
  validatorVersion: 'monthly-reconciliation-v1',
  monthChainErrorCount: 0,
};

describe('monthlyBalanceExportService', () => {
  it('renders a final export for a balanced closed month', async () => {
    const preview = buildMonthlyBalanceExportPreview({
      reconciliation: balancedReconciliation,
      generatedBy: 'admin-1',
      generatedAt: new Date('2026-07-08T10:00:00Z'),
    });

    expect(preview.status).toBe('FINAL');
    expect(preview.statusLabel).toBe('FINAL');
    expect(preview.reason).toBeNull();
    expect(preview.html.toString('utf-8')).toContain('Status:');
    expect(preview.html.toString('utf-8')).toContain('FINAL');
    expect(preview.xlsx.byteLength).toBeGreaterThan(1000);
  });

  it('renders draft exports when the month is not close eligible', async () => {
    const draft = buildMonthlyBalanceExportPreview({
      reconciliation: {
        ...balancedReconciliation,
        closeEligible: false,
        status: 'INCOMPLETE',
        reasons: ['Gedeeltelijke of open afschriften kunnen niet worden gesloten.'],
      },
      generatedBy: 'admin-1',
    });

    expect(draft.status).toBe('DRAFT');
    expect(draft.statusLabel).toBe('DRAFT / NOT CLOSED');
    expect(draft.reason).toContain('Gedeeltelijke of open afschriften kunnen niet worden gesloten.');
  });

  it('produces real pdf bytes for the final monthly export', async () => {
    const result = await buildMonthlyBalanceExportArtifacts({
      reconciliation: balancedReconciliation,
      generatedBy: 'admin-1',
      generatedAt: new Date('2026-07-08T10:00:00Z'),
    });

    expect(result.status).toBe('FINAL');
    expect(result.pdf.subarray(0, 4).toString('utf-8')).toBe('%PDF');
    expect(result.artifacts.htmlSha256).toHaveLength(64);
    expect(result.artifacts.xlsxSha256).toHaveLength(64);
    expect(result.artifacts.pdfSha256).toHaveLength(64);
    expect(result.snapshot.statusLabel).toBe('FINAL');
  });
});
