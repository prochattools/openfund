import { describe, expect, it } from 'vitest';
import { StatementCoverageStatus } from '@prisma/client';
import { buildMonthlyReconciliation } from '../../server/services/monthlyReconciliationService';

const balancedTransactions = [
  {
    transactionId: 'tx-1',
    date: '2026-01-01T00:00:00.000Z',
    amountMinor: 5000n,
    direction: 'credit' as const,
    resultingBalanceMinor: 105000n,
    importFingerprint: 'fp-1',
    projectId: 'project-1',
    transactionTypeId: 'type-1',
    categoryId: 'cat-1',
    literalProjectLabel: 'Klant A',
    literalTypeLabel: 'Inkomsten',
    literalCategoryLabel: 'Donaties',
    sourceFileHash: 'source-hash-1',
  },
  {
    transactionId: 'tx-2',
    date: '2026-01-02T00:00:00.000Z',
    amountMinor: 2000n,
    direction: 'debit' as const,
    resultingBalanceMinor: 103000n,
    importFingerprint: 'fp-2',
    projectId: 'project-1',
    transactionTypeId: 'type-2',
    categoryId: 'cat-2',
    literalProjectLabel: 'Klant A',
    literalTypeLabel: 'Uitgaven',
    literalCategoryLabel: 'Huur',
    sourceFileHash: 'source-hash-1',
  },
  {
    transactionId: 'tx-3',
    date: '2026-01-03T00:00:00.000Z',
    amountMinor: 3000n,
    direction: 'debit' as const,
    resultingBalanceMinor: 100000n,
    importFingerprint: 'fp-3',
    projectId: 'project-2',
    transactionTypeId: 'type-3',
    categoryId: 'cat-3',
    literalProjectLabel: 'Klant B',
    literalTypeLabel: 'Uitgaven',
    literalCategoryLabel: 'Materialen',
    sourceFileHash: 'source-hash-2',
  },
];

describe('monthlyReconciliationService', () => {
  it('produces a balanced month summary with exact cent formulas', () => {
    const result = buildMonthlyReconciliation({
      workspaceId: 'workspace-1',
      accountId: 'account-1',
      year: 2026,
      month: 1,
      importedTransactions: balancedTransactions,
      statementEvidence: {
        coverageStatus: StatementCoverageStatus.COMPLETE,
        openingBalanceMinor: 100000n,
        closingBalanceMinor: 100000n,
        sourceFileHashes: ['source-hash-1', 'source-hash-2'],
      },
      previousMonthClosingBalanceMinor: 100000n,
      nextMonthOpeningBalanceMinor: 100000n,
    });

    expect(result).toMatchObject({
      workspaceId: 'workspace-1',
      accountId: 'account-1',
      year: 2026,
      month: 1,
      coverageStatus: StatementCoverageStatus.COMPLETE,
      openingBalanceMinor: '100000',
      incomeMinor: '5000',
      expenseMinor: '5000',
      netMinor: '0',
      closingBalanceMinor: '100000',
      transactionCount: 3,
      bookedTransactionCount: 3,
      unresolvedTransactionCount: 0,
      duplicateFingerprintCount: 0,
      runningBalanceErrorCount: 0,
      categoryIncomeDifferenceMinor: '0',
      categoryExpenseDifferenceMinor: '0',
      balanceDifferenceMinor: '0',
      status: 'BALANCED',
      closeEligible: true,
      reasons: [],
      validatorVersion: 'monthly-reconciliation-v1',
      monthChainErrorCount: 0,
    });
    expect(result.categoryLines).toHaveLength(3);
    expect(result.subcategoryLines).toHaveLength(3);
    expect(result.sourceFileHashes).toEqual(['source-hash-1', 'source-hash-2']);
  });

  it('marks partial months as incomplete and blocks close eligibility', () => {
    const result = buildMonthlyReconciliation({
      workspaceId: 'workspace-1',
      accountId: 'account-1',
      year: 2026,
      month: 2,
      importedTransactions: balancedTransactions,
      statementEvidence: {
        coverageStatus: StatementCoverageStatus.PARTIAL,
        openingBalanceMinor: 100000n,
        closingBalanceMinor: 100000n,
      },
    });

    expect(result.status).toBe('INCOMPLETE');
    expect(result.closeEligible).toBe(false);
    expect(result.reasons).toContain('Gedeeltelijke of open afschriften kunnen niet worden gesloten.');
  });

  it('uses formula-based monthly chaining when explicit balances are absent (resulting per-transaction balances unreliable)', () => {
    const result = buildMonthlyReconciliation({
      workspaceId: 'workspace-1',
      accountId: 'account-1',
      year: 2026,
      month: 4,
      importedTransactions: [
        {
          transactionId: 'tx-raw-1',
          date: '2026-04-01T00:00:00.000Z',
          amountMinor: 5000n,
          direction: 'credit' as const,
          resultingBalanceMinor: null,
          importFingerprint: 'raw-fp-1',
          projectId: 'project-1',
          transactionTypeId: 'type-1',
          categoryId: 'cat-1',
          literalProjectLabel: 'Klant A',
          literalTypeLabel: 'Inkomsten',
          literalCategoryLabel: 'Donaties',
          sourceFileHash: 'source-hash-raw',
        },
        {
          transactionId: 'tx-raw-2',
          date: '2026-04-02T00:00:00.000Z',
          amountMinor: 2000n,
          direction: 'debit' as const,
          resultingBalanceMinor: null,
          importFingerprint: 'raw-fp-2',
          projectId: 'project-1',
          transactionTypeId: 'type-2',
          categoryId: 'cat-2',
          literalProjectLabel: 'Klant A',
          literalTypeLabel: 'Uitgaven',
          literalCategoryLabel: 'Huur',
          sourceFileHash: 'source-hash-raw',
        },
      ],
      statementEvidence: {
        coverageStatus: StatementCoverageStatus.COMPLETE,
        openingBalanceMinor: 100000n,
        sourceFileHashes: ['source-hash-raw'],
      },
    });

    expect(result.openingBalanceMinor).toBe('100000');
    expect(result.incomeMinor).toBe('5000');
    expect(result.expenseMinor).toBe('2000');
    expect(result.closingBalanceMinor).toBe('103000');
    expect(result.runningBalanceErrorCount).toBe(0);
    expect(result.status).toBe('BALANCED');
  });

  it('flags unresolved, duplicate, and chain errors', () => {
    const result = buildMonthlyReconciliation({
      workspaceId: 'workspace-1',
      accountId: 'account-1',
      year: 2026,
      month: 3,
      importedTransactions: [
        {
          ...balancedTransactions[0],
          resultingBalanceMinor: 105000n,
          importFingerprint: 'dup-fp',
          projectId: null,
          transactionTypeId: null,
          categoryId: null,
          unresolved: true,
        },
        {
          ...balancedTransactions[1],
          importFingerprint: 'dup-fp',
          resultingBalanceMinor: 104000n,
        },
      ],
      statementEvidence: {
        coverageStatus: StatementCoverageStatus.COMPLETE,
        openingBalanceMinor: 100000n,
        closingBalanceMinor: 104000n,
      },
      previousMonthClosingBalanceMinor: 99000n,
      nextMonthOpeningBalanceMinor: 105000n,
    });

    expect(result.status).toBe('INCOMPLETE');
    expect(result.closeEligible).toBe(false);
    expect(result.unresolvedTransactionCount).toBe(1);
    expect(result.duplicateFingerprintCount).toBe(1);
    expect(result.monthChainErrorCount).toBe(2);
    expect(result.reasons).toEqual(expect.arrayContaining([
      'Er zijn nog handmatige reviewtransacties open.',
      'Dubbele importvingerafdrukken zijn aanwezig.',
      'Maandketen is niet continu.',
    ]));
  });

  it('flags a first-row running balance that does not start from the statement opening balance', () => {
    const result = buildMonthlyReconciliation({
      workspaceId: 'workspace-1',
      accountId: 'account-1',
      year: 2026,
      month: 5,
      importedTransactions: [{
        ...balancedTransactions[0],
        resultingBalanceMinor: 106000n,
      }],
      statementEvidence: {
        coverageStatus: StatementCoverageStatus.COMPLETE,
        openingBalanceMinor: 100000n,
        closingBalanceMinor: 105000n,
      },
    });

    expect(result.runningBalanceErrorCount).toBe(1);
    expect(result.status).toBe('UNBALANCED');
    expect(result.closeEligible).toBe(false);
  });

  it('reconstructs ING same-day order from resulting balances instead of transaction IDs', () => {
    const result = buildMonthlyReconciliation({
      workspaceId: 'workspace-1',
      accountId: 'account-1',
      year: 2026,
      month: 8,
      importedTransactions: [
        {
          transactionId: 'z-bank-last',
          date: '2026-08-01T00:00:00.000Z',
          amountMinor: 600n,
          direction: 'credit',
          resultingBalanceMinor: 101000n,
          importFingerprint: 'same-day-3',
          projectId: 'project-1',
          transactionTypeId: 'type-1',
          categoryId: 'cat-1',
        },
        {
          transactionId: 'm-bank-middle',
          date: '2026-08-01T00:00:00.000Z',
          amountMinor: -100n,
          direction: 'debit',
          resultingBalanceMinor: 100400n,
          importFingerprint: 'same-day-2',
          projectId: 'project-1',
          transactionTypeId: 'type-1',
          categoryId: 'cat-1',
        },
        {
          transactionId: 'a-bank-first',
          date: '2026-08-01T00:00:00.000Z',
          amountMinor: 500n,
          direction: 'credit',
          resultingBalanceMinor: 100500n,
          importFingerprint: 'same-day-1',
          projectId: 'project-1',
          transactionTypeId: 'type-1',
          categoryId: 'cat-1',
        },
      ],
      statementEvidence: {
        coverageStatus: StatementCoverageStatus.COMPLETE,
        openingBalanceMinor: 100000n,
        closingBalanceMinor: 101000n,
        transactionCount: 3,
      },
    });

    expect(result.runningBalanceErrorCount).toBe(0);
    expect(result.status).toBe('BALANCED');
    expect(result.closeEligible).toBe(true);
  });
});
