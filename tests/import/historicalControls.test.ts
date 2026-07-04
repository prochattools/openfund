import { describe, expect, it } from 'vitest';
import {
  assertHelperDateColumnsRejected,
  checkRunningBalanceContinuity,
  computeHistoricalTotals,
} from '../../lib/import/historicalControls';

describe('historical controls', () => {
  it('computes totals and continuity for valid sequences', () => {
    const rows = [
      { rowNumber: 2, amountMinor: 5000n, resultingBalanceMinor: 105000n },
      { rowNumber: 3, amountMinor: -2000n, resultingBalanceMinor: 103000n },
    ];

    expect(computeHistoricalTotals([
      { amountMinor: 5000n, direction: 'credit', resultingBalanceMinor: 105000n },
      { amountMinor: -2000n, direction: 'debit', resultingBalanceMinor: 103000n },
    ])).toMatchObject({
      openingBalanceMinor: 100000n,
      incomeMinor: 5000n,
      expenseMinor: 2000n,
      closingBalanceMinor: 103000n,
      transactionCount: 2,
      creditCount: 1,
      debitCount: 1,
    });

    expect(checkRunningBalanceContinuity(rows)).toEqual([
      expect.objectContaining({
        valid: true,
        rowNumber: 2,
        expectedBalanceMinor: 105000n,
        actualBalanceMinor: 105000n,
      }),
      expect.objectContaining({
        valid: true,
        rowNumber: 3,
        expectedBalanceMinor: 103000n,
        actualBalanceMinor: 103000n,
      }),
    ]);
  });

  it('detects invalid continuity and helper date columns', () => {
    const checks = checkRunningBalanceContinuity([
      { rowNumber: 2, amountMinor: 5000n, resultingBalanceMinor: 105000n },
      { rowNumber: 3, amountMinor: -2000n, resultingBalanceMinor: 104000n },
    ]);

    expect(checks[1]?.valid).toBe(false);
    expect(assertHelperDateColumnsRejected({ Jaartal: '2024', Maand: 'December', Datum: '45657' })).toEqual([
      'Jaartal',
      'Maand',
      'Datum',
    ]);
  });
});
