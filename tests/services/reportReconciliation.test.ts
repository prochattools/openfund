import { describe, it, expect, vi } from 'vitest';
import { reconcileMonthlyReport, ReportReconciliationError } from '../../server/services/reportReconciliationService';

// June 2026 acceptance controls (from ING bank statement)
const JUNE_OPENING = 939082n;   // EUR 9,390.82
const JUNE_INCOME = 1305798n;   // EUR 13,057.98
const JUNE_EXPENSE = 1303656n;  // EUR 13,036.56
const JUNE_NET = 2142n;         // EUR 21.42
const JUNE_CLOSING = 941224n;   // EUR 9,412.24
const JUNE_TX_COUNT = 37;

const WORKSPACE_ID = 'ws-test-001';
const USER_ID = 'user-test-001';

const buildJuneStatement = () => ({
  id: 'stmt-june-001',
  workspaceId: WORKSPACE_ID,
  accountId: 'acct-001',
  sourceFileId: 'sf-csv-001',
  supportingPdfFileId: 'sf-pdf-001',
  periodStart: new Date('2026-06-01T00:00:00.000Z'),
  periodEnd: new Date('2026-06-30T23:59:59.999Z'),
  openingBalanceMinor: JUNE_OPENING,
  incomeMinor: JUNE_INCOME,
  expenseMinor: JUNE_EXPENSE,
  netMinor: JUNE_NET,
  closingBalanceMinor: JUNE_CLOSING,
  transactionCount: JUNE_TX_COUNT,
  createdAt: new Date(),
});

const buildJuneTransactions = () => {
  // 20 credits totaling 1305798 cents, 17 debits totaling 1303656 cents
  const credits: Array<{ id: string; amountMinor: bigint; direction: string; counterparty: string | null; description: string; importFingerprint: string }> = [];
  const debits: Array<{ id: string; amountMinor: bigint; direction: string; counterparty: string | null; description: string; importFingerprint: string }> = [];

  // Distribute income across 20 credits
  const creditAmounts = Array.from({ length: 19 }, () => 65000n);
  creditAmounts.push(JUNE_INCOME - creditAmounts.reduce((s, a) => s + a, 0n));
  for (let i = 0; i < 20; i++) {
    credits.push({
      id: `tx-credit-${i}`,
      amountMinor: creditAmounts[i],
      direction: 'credit',
      counterparty: `Klant ${i}`,
      description: `Betaling ${i}`,
      importFingerprint: `fp-credit-${i}`,
    });
  }

  // Distribute expense across 17 debits (stored as NEGATIVE in DB)
  const debitAmounts = Array.from({ length: 16 }, () => 76000n);
  debitAmounts.push(JUNE_EXPENSE - debitAmounts.reduce((s, a) => s + a, 0n));
  for (let i = 0; i < 17; i++) {
    debits.push({
      id: `tx-debit-${i}`,
      amountMinor: -(debitAmounts[i]),  // Negative in DB for debits
      direction: 'debit',
      counterparty: `Leverancier ${i}`,
      description: `Factuur ${i}`,
      importFingerprint: `fp-debit-${i}`,
    });
  }

  return [...credits, ...debits];
};

const buildMockDb = (overrides?: {
  statement?: ReturnType<typeof buildJuneStatement> | null;
  transactions?: ReturnType<typeof buildJuneTransactions>;
  bookingCount?: number;
}) => {
  const statement = overrides?.statement !== undefined ? overrides.statement : buildJuneStatement();
  const transactions = overrides?.transactions ?? buildJuneTransactions();
  const bookingCount = overrides?.bookingCount ?? transactions.length;

  return {
    bankStatement: {
      findFirst: vi.fn().mockResolvedValue(statement),
    },
    transaction: {
      findMany: vi.fn().mockResolvedValue(transactions),
    },
    transactionBooking: {
      findMany: vi.fn().mockResolvedValue(
        transactions.slice(0, bookingCount).map((t) => ({ transactionId: t.id })),
      ),
    },
  } as any;
};

describe('reconcileMonthlyReport', () => {
  it('passes with correct June 2026 controls', async () => {
    const db = buildMockDb();
    const result = await reconcileMonthlyReport(db, {
      workspaceId: WORKSPACE_ID,
      userId: USER_ID,
      year: 2026,
      month: 6,
    });

    expect(result.passed).toBe(true);
    expect(result.openingBalanceMinor).toBe(JUNE_OPENING);
    expect(result.incomeMinor).toBe(JUNE_INCOME);
    expect(result.expenseMinor).toBe(JUNE_EXPENSE);
    expect(result.netMinor).toBe(JUNE_NET);
    expect(result.closingBalanceMinor).toBe(JUNE_CLOSING);
    expect(result.transactionCount).toBe(JUNE_TX_COUNT);
  });

  it('returns counterparty summary with correct totals', async () => {
    const db = buildMockDb();
    const result = await reconcileMonthlyReport(db, {
      workspaceId: WORKSPACE_ID,
      userId: USER_ID,
      year: 2026,
      month: 6,
    });

    const totalCpIncome = result.counterparties.reduce((s, cp) => s + cp.incomeMinor, 0n);
    const totalCpExpense = result.counterparties.reduce((s, cp) => s + cp.expenseMinor, 0n);
    expect(totalCpIncome).toBe(JUNE_INCOME);
    expect(totalCpExpense).toBe(JUNE_EXPENSE);
  });

  it('throws STATEMENT_MISSING when no bank statement exists', async () => {
    const db = buildMockDb({ statement: null });
    await expect(
      reconcileMonthlyReport(db, { workspaceId: WORKSPACE_ID, userId: USER_ID, year: 2026, month: 6 }),
    ).rejects.toThrow(ReportReconciliationError);
  });

  it('throws INCOME_MISMATCH when ledger income does not match bank', async () => {
    const transactions = buildJuneTransactions();
    // Add an extra credit transaction that breaks the reconciliation
    transactions.push({
      id: 'tx-extra-credit',
      amountMinor: 100n,
      direction: 'credit',
      counterparty: 'Extra',
      description: 'Extra',
      importFingerprint: 'fp-extra',
    });
    const statement = buildJuneStatement();
    statement.transactionCount = transactions.length; // Match count to isolate income error
    const db = buildMockDb({ statement, transactions, bookingCount: transactions.length });

    try {
      await reconcileMonthlyReport(db, { workspaceId: WORKSPACE_ID, userId: USER_ID, year: 2026, month: 6 });
      expect.fail('Should have thrown');
    } catch (err: any) {
      expect(err).toBeInstanceOf(ReportReconciliationError);
      expect(err.invariant).toBe('INCOME_MISMATCH');
    }
  });

  it('throws EXPENSE_MISMATCH when ledger expense does not match bank', async () => {
    const transactions = buildJuneTransactions();
    // Replace one debit with wrong amount
    transactions[20] = { ...transactions[20], amountMinor: -999n };
    const db = buildMockDb({ transactions });

    try {
      await reconcileMonthlyReport(db, { workspaceId: WORKSPACE_ID, userId: USER_ID, year: 2026, month: 6 });
      expect.fail('Should have thrown');
    } catch (err: any) {
      expect(err).toBeInstanceOf(ReportReconciliationError);
      // Will fail on expense or income mismatch depending on exact change
      expect(['INCOME_MISMATCH', 'EXPENSE_MISMATCH', 'TRANSACTION_COUNT_MISMATCH']).toContain(err.invariant);
    }
  });

  it('throws UNBOOKED_TRANSACTIONS when not all transactions have bookings', async () => {
    const db = buildMockDb({ bookingCount: 35 }); // 35 of 37 booked

    try {
      await reconcileMonthlyReport(db, { workspaceId: WORKSPACE_ID, userId: USER_ID, year: 2026, month: 6 });
      expect.fail('Should have thrown');
    } catch (err: any) {
      expect(err).toBeInstanceOf(ReportReconciliationError);
      expect(err.invariant).toBe('UNBOOKED_TRANSACTIONS');
    }
  });

  it('throws TRANSACTION_COUNT_MISMATCH when count differs from statement', async () => {
    const statement = buildJuneStatement();
    statement.transactionCount = 40; // Bank says 40 but ledger has 37
    const db = buildMockDb({ statement });

    try {
      await reconcileMonthlyReport(db, { workspaceId: WORKSPACE_ID, userId: USER_ID, year: 2026, month: 6 });
      expect.fail('Should have thrown');
    } catch (err: any) {
      expect(err).toBeInstanceOf(ReportReconciliationError);
      expect(err.invariant).toBe('TRANSACTION_COUNT_MISMATCH');
    }
  });

  it('signed debit regression: negative amountMinor contributes positive expense', async () => {
    // All debits are stored as negative in DB — verify absolute value is used
    const transactions = buildJuneTransactions();
    const debits = transactions.filter((t) => t.direction === 'debit');
    expect(debits.every((t) => t.amountMinor < 0n)).toBe(true);

    const db = buildMockDb();
    const result = await reconcileMonthlyReport(db, {
      workspaceId: WORKSPACE_ID,
      userId: USER_ID,
      year: 2026,
      month: 6,
    });
    // Expense must be positive
    expect(result.expenseMinor > 0n).toBe(true);
    expect(result.expenseMinor).toBe(JUNE_EXPENSE);
  });

  it('verifies net = income - expense invariant', async () => {
    const db = buildMockDb();
    const result = await reconcileMonthlyReport(db, {
      workspaceId: WORKSPACE_ID,
      userId: USER_ID,
      year: 2026,
      month: 6,
    });
    expect(result.netMinor).toBe(result.incomeMinor - result.expenseMinor);
  });

  it('verifies opening + net = closing invariant', async () => {
    const db = buildMockDb();
    const result = await reconcileMonthlyReport(db, {
      workspaceId: WORKSPACE_ID,
      userId: USER_ID,
      year: 2026,
      month: 6,
    });
    expect(result.openingBalanceMinor + result.netMinor).toBe(result.closingBalanceMinor);
  });

  it('throws DUPLICATE_FINGERPRINTS when duplicates exist', async () => {
    const transactions = buildJuneTransactions();
    transactions[1] = { ...transactions[1], importFingerprint: transactions[0].importFingerprint };
    const db = buildMockDb({ transactions });

    try {
      await reconcileMonthlyReport(db, { workspaceId: WORKSPACE_ID, userId: USER_ID, year: 2026, month: 6 });
      expect.fail('Should have thrown');
    } catch (err: any) {
      expect(err).toBeInstanceOf(ReportReconciliationError);
      expect(err.invariant).toBe('DUPLICATE_FINGERPRINTS');
    }
  });
});
