import { describe, expect, it } from 'vitest';
import {
  buildMonthlyImportPreviewUploadResponse,
  isAllowedMonthlyImportPreviewUpload,
} from '../../server/routes/upload';
import type { MonthlyImportPreview } from '../../server/services/monthlyImportPreviewService';

describe('monthly import preview route', () => {
  it('accepts only CSV uploads for the preview route', () => {
    expect(isAllowedMonthlyImportPreviewUpload({ originalname: 'mei.csv', mimetype: 'text/csv' })).toBe(true);
    expect(isAllowedMonthlyImportPreviewUpload({ originalname: 'mei.csv', mimetype: 'application/vnd.ms-excel' })).toBe(true);
    expect(isAllowedMonthlyImportPreviewUpload({ originalname: 'mei.xlsx', mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })).toBe(false);
    expect(isAllowedMonthlyImportPreviewUpload({ originalname: 'notities.txt', mimetype: 'text/plain' })).toBe(false);
  });

  it('returns a Dutch preview response without booking claims', () => {
    const preview: MonthlyImportPreview = {
      sourceFile: {
        filename: 'mei.csv',
        mediaType: 'text/csv',
        sizeBytes: 123,
        sha256: 'a'.repeat(64),
        retainedBytesHash: 'a'.repeat(64),
      },
      workspaceId: 'workspace-1',
      accountId: 'account-1',
      accountIdentifier: 'NL89INGB0006369960',
      uploadedBy: 'admin-1',
      rowCount: 1,
      periodStart: '2026-05-01',
      periodEnd: '2026-05-31',
      coverageStatus: 'COMPLETE',
      openingBalanceMinor: '1000',
      incomeMinor: '250',
      expenseMinor: '0',
      closingBalanceMinor: '1250',
      totals: {
        openingBalanceMinor: '1000',
        incomeMinor: '250',
        expenseMinor: '0',
        netMinor: '250',
        closingBalanceMinor: '1250',
      },
      duplicateCount: 0,
      newTransactionCount: 1,
      potentialDuplicateTransactionFingerprints: [],
      runningBalance: {
        valid: true,
        findings: [],
      },
      closeEligibility: {
        eligible: true,
        reasons: [],
      },
      booking: {
        createsTransactions: false,
        createsTransactionBookings: false,
        closesPeriod: false,
      },
      categorization: null,
    };

    expect(buildMonthlyImportPreviewUploadResponse(preview)).toEqual({
      preview,
      message: 'Importvoorbeeld gemaakt. Er zijn nog geen transacties geboekt.',
    });
  });
});
