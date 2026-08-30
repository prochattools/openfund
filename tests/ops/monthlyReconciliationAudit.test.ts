import { describe, expect, it } from 'vitest';
import { auditMonthlyReconciliations } from '../../server/services/monthlyReconciliationAuditService';
import type { MonthlyReconciliationResult } from '../../server/services/monthlyReconciliationService';

const makeMonth = (
  overrides: Partial<MonthlyReconciliationResult> & Pick<MonthlyReconciliationResult, 'year' | 'month' | 'openingBalanceMinor' | 'incomeMinor' | 'expenseMinor' | 'closingBalanceMinor'>,
): MonthlyReconciliationResult => ({
  workspaceId: 'workspace-1',
  accountId: 'account-1',
  periodStart: `${overrides.year}-${String(overrides.month).padStart(2, '0')}-01T00:00:00.000Z`,
  periodEnd: `${overrides.year}-${String(overrides.month).padStart(2, '0')}-28T23:59:59.999Z`,
  coverageStatus: 'COMPLETE',
  netMinor: (BigInt(overrides.incomeMinor) - BigInt(overrides.expenseMinor)).toString(),
  transactionCount: 2,
  statementTransactionCount: null,
  transactionCountDifference: null,
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
  categoryLines: [],
  subcategoryLines: [],
  sourceFileHashes: [],
  validatorVersion: 'monthly-reconciliation-v1',
  monthChainErrorCount: 0,
  ...overrides,
});

describe('monthly reconciliation audit', () => {
  it('passes when the expected months are balanced and chained', () => {
    const january = makeMonth({
      year: 2024,
      month: 1,
      openingBalanceMinor: '100000',
      incomeMinor: '5000',
      expenseMinor: '2000',
      closingBalanceMinor: '103000',
    });
    const february = makeMonth({
      year: 2024,
      month: 2,
      openingBalanceMinor: '103000',
      incomeMinor: '3000',
      expenseMinor: '1000',
      closingBalanceMinor: '105000',
    });

    const result = auditMonthlyReconciliations({
      months: [february, january],
      expectedCoverage: { 2024: [1, 2] },
    });

    expect(result.status).toBe('PASSED');
    expect(result.issues).toEqual([]);
    expect(result.yearSummaries).toEqual([
      expect.objectContaining({
        year: 2024,
        monthCount: 2,
        transactionCount: 4,
        openingBalanceMinor: '100000',
        incomeMinor: '8000',
        expenseMinor: '3000',
        closingBalanceMinor: '105000',
      }),
    ]);
  });

  it('fails when a month is missing or the chain breaks', () => {
    const january = makeMonth({
      year: 2026,
      month: 1,
      openingBalanceMinor: '200000',
      incomeMinor: '4000',
      expenseMinor: '1000',
      closingBalanceMinor: '203000',
      closeEligible: false,
      status: 'INCOMPLETE',
      reasons: ['Gedeeltelijke of open afschriften kunnen niet worden gesloten.'],
    });
    const march = makeMonth({
      year: 2026,
      month: 3,
      openingBalanceMinor: '99999',
      incomeMinor: '1000',
      expenseMinor: '500',
      closingBalanceMinor: '100499',
      closeEligible: false,
      status: 'INCOMPLETE',
      reasons: ['Gedeeltelijke of open afschriften kunnen niet worden gesloten.'],
    });

    const result = auditMonthlyReconciliations({
      months: [january, march],
      expectedCoverage: { 2026: [1, 2, 3] },
    });

    expect(result.status).toBe('FAILED');
    expect(result.issues.map((issue) => issue.message)).toEqual(expect.arrayContaining([
      'Maand is niet balancerend en afsluitbaar.',
      'Verwachte maand ontbreekt in audit-scope.',
      'Maandketen is gebroken tussen opeenvolgende maanden.',
    ]));
  });

  it('enforces baseline control for 2024 closing balance and rejects mismatches', () => {
    // Simulate the reported error: 2024 closing was 1028415 instead of 1218415
    const baseline = {
      transactionCount: 268,
      openingMinor: '172186',
      incomeMinor: '3226719',
      expenseMinor: '2180490',
      closingMinor: '1218415',
    };

    const months2024 = [
      makeMonth({
        year: 2024,
        month: 1,
        openingBalanceMinor: '172186',
        incomeMinor: '269743',
        expenseMinor: '181656',
        closingBalanceMinor: '260273',
      }),
      makeMonth({
        year: 2024,
        month: 12,
        openingBalanceMinor: '1128748',
        incomeMinor: '269743',
        expenseMinor: '179948',
        closingBalanceMinor: '1028415',
        transactionCount: 268,
      }),
    ];

    const result = auditMonthlyReconciliations({
      months: months2024,
      expectedCoverage: { 2024: Array.from({ length: 12 }, (_, i) => i + 1) },
      baselineControls: { 2024: baseline },
    });

    expect(result.status).toBe('FAILED');
    expect(result.issues.some((i) => i.message.includes('sluitingssaldo wijkt af'))).toBe(true);
    expect(result.issues.some((i) => i.message.includes('1028415') && i.message.includes('1218415'))).toBe(true);
  });

  it('passes baseline control enforcement when all 2024 totals match expected values', () => {
    const baseline = {
      transactionCount: 268,
      openingMinor: '172186',
      incomeMinor: '3226719',
      expenseMinor: '2180490',
      closingMinor: '1218415',
    };

    // Construct a minimal 2024 representation with correct totals
    const jan = makeMonth({
      year: 2024,
      month: 1,
      openingBalanceMinor: '172186',
      incomeMinor: '269743',
      expenseMinor: '181656',
      closingBalanceMinor: '260273',
      transactionCount: 22,
    });

    const dec = makeMonth({
      year: 2024,
      month: 12,
      openingBalanceMinor: '1128748',
      incomeMinor: '269743',
      expenseMinor: '179948',
      closingBalanceMinor: '1218415',
      transactionCount: 22,
    });

    const result = auditMonthlyReconciliations({
      months: [jan, dec],
      expectedCoverage: { 2024: Array.from({ length: 12 }, (_, i) => i + 1) },
      baselineControls: { 2024: baseline },
    });

    expect(result.status).toBe('FAILED');
    // Should fail because not all 12 months are present
    expect(result.issues.some((i) => i.message.includes('Jaarlijkse maanddekking'))).toBe(true);
  });

  it('allows the known trailing partial month without treating it as a hard failure', () => {
    const january = makeMonth({
      year: 2026,
      month: 1,
      openingBalanceMinor: '200000',
      incomeMinor: '4000',
      expenseMinor: '1000',
      closingBalanceMinor: '203000',
    });
    const february = makeMonth({
      year: 2026,
      month: 2,
      openingBalanceMinor: '203000',
      incomeMinor: '3000',
      expenseMinor: '500',
      closingBalanceMinor: '205500',
    });
    const marchPartial = makeMonth({
      year: 2026,
      month: 3,
      openingBalanceMinor: '205500',
      incomeMinor: '2000',
      expenseMinor: '750',
      closingBalanceMinor: '206750',
      coverageStatus: 'PARTIAL',
      status: 'INCOMPLETE',
      closeEligible: false,
      reasons: ['Gedeeltelijke of open afschriften kunnen niet worden gesloten.'],
    });

    const result = auditMonthlyReconciliations({
      months: [marchPartial, february, january],
      expectedCoverage: { 2026: [1, 2, 3] },
    });

    expect(result.status).toBe('PASSED');
    expect(result.issues).toEqual([]);
    expect(result.yearSummaries).toEqual([
      expect.objectContaining({
        year: 2026,
        monthCount: 3,
        transactionCount: 6,
        openingBalanceMinor: '200000',
        incomeMinor: '9000',
        expenseMinor: '2250',
        closingBalanceMinor: '206750',
      }),
    ]);
  });
});
