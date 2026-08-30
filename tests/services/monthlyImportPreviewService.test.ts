import crypto from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  buildImportFingerprint,
  buildLegacyImportFingerprint,
} from '../../server/services/transactionFingerprint';
import {
  buildMonthlyImportPreview,
  MonthlyImportPreviewError,
} from '../../server/services/monthlyImportPreviewService';
import { decideDeterministicCategorization } from '../../server/services/deterministicCategorizationService';

const csv = (rows: string[]) => Buffer.from([
  'Date;Name / Description;Account;Counterparty;Code;Debit/credit;Amount (EUR);Transaction type;Notifications;Resulting balance;Tag',
  ...rows,
].join('\n'));

const validRows = [
  '2026-05-01;Gift Alpha;NL89INGB0006369960;Donor A;GT;Credit;50,00;Online;Reference: MONTH-1;1050,00;',
  '2026-05-02;Rent May;NL89INGB0006369960;Landlord B;BA;Debit;20,00;Transfer;Reference: MONTH-2;1030,00;',
  '2026-05-03;Supplies;NL89INGB0006369960;Shop C;BA;Debit;10,00;Card;Reference: MONTH-3;1020,00;',
];

const baseInput = {
  workspaceId: 'workspace-1',
  accountId: 'account-1',
  actorId: 'admin-1',
  originalFilename: 'mei-2026.csv',
  mediaType: 'text/csv',
  retainedCsvBytes: csv(validRows),
};

const firstRowFingerprint = buildImportFingerprint({
  accountIdentifier: 'NL89INGB0006369960',
  date: new Date('2026-05-01T00:00:00.000Z'),
  amountMinor: 5000n,
  description: 'Gift Alpha',
  counterparty: 'Donor A',
  reference: 'MONTH-1',
  raw: {
    Date: '2026-05-01',
    'Name / Description': 'Gift Alpha',
    Account: 'NL89INGB0006369960',
    Counterparty: 'Donor A',
    Code: 'GT',
    'Debit/credit': 'Credit',
    'Amount (EUR)': '50,00',
    'Transaction type': 'Online',
    Notifications: 'Reference: MONTH-1',
    'Resulting balance': '1050,00',
    Tag: '',
  },
});

const firstRowLegacyFingerprint = buildLegacyImportFingerprint({
  accountIdentifier: 'NL89INGB0006369960',
  date: new Date('2026-05-01T00:00:00.000Z'),
  amountMinor: 5000n,
  description: 'Gift Alpha',
  counterparty: 'Donor A',
  reference: 'MONTH-1',
  raw: {
    Date: '2026-05-01',
    'Name / Description': 'Gift Alpha',
    Account: 'NL89INGB0006369960',
    Counterparty: 'Donor A',
    Code: 'GT',
    'Debit/credit': 'Credit',
    'Amount (EUR)': '50,00',
    'Transaction type': 'Online',
    Notifications: 'Reference: MONTH-1',
    'Resulting balance': '1050,00',
    Tag: '',
  },
});

describe('monthly import preview service', () => {
  it('parses a sanitized monthly ING CSV and computes retained-byte controls', async () => {
    const preview = await buildMonthlyImportPreview(baseInput);

    expect(preview.sourceFile).toMatchObject({
      filename: 'mei-2026.csv',
      mediaType: 'text/csv',
      sizeBytes: baseInput.retainedCsvBytes.byteLength,
      sha256: crypto.createHash('sha256').update(baseInput.retainedCsvBytes).digest('hex'),
      retainedBytesHash: crypto.createHash('sha256').update(baseInput.retainedCsvBytes).digest('hex'),
    });
    expect(preview).toMatchObject({
      rowCount: 3,
      periodStart: '2026-05-01',
      periodEnd: '2026-05-03',
      coverageStatus: 'COMPLETE',
      openingBalanceMinor: '100000',
      incomeMinor: '5000',
      expenseMinor: '3000',
      closingBalanceMinor: '102000',
      duplicateCount: 0,
      newTransactionCount: 3,
    });
    expect(preview.totals.netMinor).toBe('2000');
    expect(preview.runningBalance).toEqual({ valid: true, findings: [] });
    expect(preview.closeEligibility).toEqual({ eligible: true, reasons: [] });
  });

  it('detects running-balance continuity failure without exposing raw rows', async () => {
    const preview = await buildMonthlyImportPreview({
      ...baseInput,
      retainedCsvBytes: csv([
        validRows[0]!,
        '2026-05-02;Rent May;NL89INGB0006369960;Landlord B;BA;Debit;20,00;Transfer;Reference: MONTH-2;1040,00;',
      ]),
    });

    expect(preview.runningBalance.valid).toBe(false);
    expect(preview.runningBalance.findings).toEqual([
      expect.objectContaining({
        rowNumber: 3,
        expectedBalanceMinor: '103000',
        actualBalanceMinor: '104000',
      }),
    ]);
    expect(preview.closeEligibility.eligible).toBe(false);
    const serialized = JSON.stringify(preview);
    expect(serialized).not.toContain('rawRow');
    expect(serialized).not.toContain('Gift Alpha');
    expect(serialized).not.toContain('Reference: MONTH-1');
    expect(serialized).not.toContain('Donor A');
  });

  it('detects duplicate fingerprints against existing transactions and does not book anything', async () => {
    const preview = await buildMonthlyImportPreview(baseInput, {
      findExistingImportFingerprints: async ({ fingerprints }) => {
        expect(fingerprints).toContain(firstRowFingerprint);
        return [firstRowFingerprint];
      },
    });

    expect(preview.duplicateCount).toBe(1);
    expect(preview.newTransactionCount).toBe(2);
    expect(preview.potentialDuplicateTransactionFingerprints).toEqual([firstRowFingerprint]);
    expect(preview.closeEligibility.eligible).toBe(false);
    expect(preview.booking).toEqual({
      createsTransactions: false,
      createsTransactionBookings: false,
      closesPeriod: false,
    });
    expect(preview.categorization).toBeNull();
  });

  it('detects transactions persisted with the legacy fingerprint format', async () => {
    const preview = await buildMonthlyImportPreview(baseInput, {
      findExistingImportFingerprints: async ({ fingerprints }) => {
        expect(fingerprints).toContain(firstRowLegacyFingerprint);
        return [firstRowLegacyFingerprint];
      },
    });

    expect(preview.duplicateCount).toBe(1);
    expect(preview.newTransactionCount).toBe(2);
    expect(preview.potentialDuplicateTransactionFingerprints).toEqual([firstRowFingerprint]);
  });

  it('counts only repeated upload rows as in-file duplicates', async () => {
    const repeatedRows = [
      validRows[0]!,
      validRows[0]!,
    ];

    const preview = await buildMonthlyImportPreview({
      ...baseInput,
      retainedCsvBytes: csv(repeatedRows),
    });

    expect(preview.duplicateCount).toBe(1);
    expect(preview.newTransactionCount).toBe(1);
    expect(preview.potentialDuplicateTransactionFingerprints).toHaveLength(1);
  });

  it('keeps partial/open 2026-style statements not close-eligible', async () => {
    const preview = await buildMonthlyImportPreview({
      ...baseInput,
      expectedPeriodStart: new Date('2026-01-01T00:00:00.000Z'),
      expectedPeriodEnd: new Date('2026-07-01T00:00:00.000Z'),
    });

    expect(preview.coverageStatus).toBe('PARTIAL');
    expect(preview.closeEligibility).toEqual({
      eligible: false,
      reasons: ['Gedeeltelijke of open afschriften kunnen niet worden gesloten.'],
    });
  });

  it('returns categorization counts without creating transactions, bookings, or closes', async () => {
    const preview = await buildMonthlyImportPreview(baseInput, {
      categorizePreviewTransactions: async ({ transactions }) => [
        decideDeterministicCategorization({
          transaction: transactions[0]!,
          ruleCandidates: [{
            ruleId: 'rule-complete',
            active: true,
            approved: true,
            confidence: 'deterministic',
            projectId: 'project-1',
            transactionTypeId: 'type-1',
            categoryId: 'cat-1',
            evidenceHash: 'rule-evidence-1',
          }],
        }),
        decideDeterministicCategorization({
          transaction: transactions[1]!,
          ruleCandidates: [{
            ruleId: 'rule-partial',
            active: true,
            approved: true,
            confidence: 'deterministic',
            projectId: null,
            transactionTypeId: 'type-1',
            categoryId: 'cat-1',
            evidenceHash: 'rule-evidence-2',
          }],
        }),
        decideDeterministicCategorization({
          transaction: transactions[2]!,
        }),
      ],
    });

    expect(preview.categorization).toEqual({
      finalizedCandidateCount: 1,
      reviewSuggestedCount: 1,
      conflictCount: 0,
      unmatchedCount: 1,
      createsTransactionBookings: false,
      closesPeriod: false,
    });
    expect(preview.booking).toEqual({
      createsTransactions: false,
      createsTransactionBookings: false,
      closesPeriod: false,
    });
  });

  it('rejects non-CSV input', async () => {
    await expect(buildMonthlyImportPreview({
      ...baseInput,
      originalFilename: 'mei-2026.xlsx',
      mediaType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })).rejects.toBeInstanceOf(MonthlyImportPreviewError);
  });

  it('rejects malformed ING CSV input', async () => {
    await expect(buildMonthlyImportPreview({
      ...baseInput,
      retainedCsvBytes: Buffer.from('Date;Name / Description\n2026-05-01;Gift Alpha\n'),
    })).rejects.toMatchObject({
      message: expect.stringContaining('Dit ING CSV-bestand kan niet worden ingelezen'),
    });
  });
});
