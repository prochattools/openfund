/**
 * Bank-statement-reconciled monthly report data.
 *
 * Selects the authoritative BankStatement for a workspace/account/month,
 * reconciles ledger totals against imported bank controls, and returns
 * a typed result that downstream report generation can consume safely.
 *
 * All monetary values are positive absolute integers in minor units (cents).
 * The bank statement controls are treated as authoritative external evidence.
 */

import type { Prisma } from '@prisma/client';

type TxClient = Prisma.TransactionClient;

export class ReportReconciliationError extends Error {
  statusCode: number;
  invariant: string;
  expected: string;
  actual: string;

  constructor(message: string, invariant: string, expected: string, actual: string, statusCode = 422) {
    super(message);
    this.name = 'ReportReconciliationError';
    this.statusCode = statusCode;
    this.invariant = invariant;
    this.expected = expected;
    this.actual = actual;
  }
}

export type ClassificationReadiness = {
  transactionCount: number;
  bookedTransactionCount: number;
  unbookedTransactionCount: number;
  complete: boolean;
};

export type ReconciliationResult = {
  bankStatementId: string;
  accountId: string;
  sourceFileId: string;
  supportingPdfFileId: string | null;
  periodStart: Date;
  periodEnd: Date;
  openingBalanceMinor: bigint;
  incomeMinor: bigint;
  expenseMinor: bigint;
  netMinor: bigint;
  closingBalanceMinor: bigint;
  transactionCount: number;
  ledgerIncomeMinor: bigint;
  ledgerExpenseMinor: bigint;
  ledgerNetMinor: bigint;
  ledgerTransactionCount: number;
  classificationReadiness: ClassificationReadiness;
  passed: true;
};

export type CustomerSummary = {
  customer: string;
  incomeMinor: bigint;
  expenseMinor: bigint;
  differenceMinor: bigint;
  transactionCount: number;
};

export type ReconciliationWithCustomers = ReconciliationResult & {
  customers: CustomerSummary[];
};

const toBigInt = (v: bigint | number): bigint => BigInt(v);

const abs = (v: bigint): bigint => (v < 0n ? -v : v);

export const reconcileMonthlyReport = async (
  db: TxClient,
  input: {
    workspaceId: string;
    userId: string;
    year: number;
    month: number;
  },
): Promise<ReconciliationWithCustomers> => {
  const periodStart = new Date(Date.UTC(input.year, input.month - 1, 1));
  const periodEnd = new Date(Date.UTC(input.year, input.month, 0, 23, 59, 59, 999));

  // Step 1: Find the authoritative BankStatement for this month
  const statement = await db.bankStatement.findFirst({
    where: {
      workspaceId: input.workspaceId,
      periodStart: { gte: periodStart },
      periodEnd: { lte: periodEnd },
    },
    orderBy: { createdAt: 'desc' },
  });

  if (!statement) {
    throw new ReportReconciliationError(
      `Geen bankafschrift gevonden voor ${input.year}-${String(input.month).padStart(2, '0')}. ` +
      `Importeer eerst het bankafschrift (CSV + PDF) voor deze maand.`,
      'STATEMENT_MISSING',
      'BankStatement voor de gevraagde maand',
      'geen',
    );
  }
  if (statement.coverageStatus !== 'COMPLETE') {
    throw new ReportReconciliationError(
      'Een rapport kan niet worden gemaakt voor een onvolledig bankafschrift.',
      'STATEMENT_INCOMPLETE',
      'COMPLETE',
      statement.coverageStatus,
    );
  }

  // Step 2: Load only the statement account's transactions for the month.
  // A workspace may contain multiple bank accounts; mixing them would allow
  // unrelated ledger facts to affect an otherwise valid statement report.
  const transactions = await db.transaction.findMany({
    where: {
      userId: input.userId,
      accountId: statement.accountId,
      date: { gte: periodStart, lte: periodEnd },
    },
    select: {
      id: true,
      amountMinor: true,
      direction: true,
      counterparty: true,
      description: true,
      importFingerprint: true,
    },
    orderBy: { date: 'asc' },
  });

  // Step 3: Load bookings for those transactions
  const transactionIds = transactions.map((t) => t.id);
  const bookings = await db.transactionBooking.findMany({
    where: {
      workspaceId: input.workspaceId,
      transactionId: { in: transactionIds },
    },
    select: { transactionId: true, literalProjectLabel: true },
  });
  const bookedIds = new Set(bookings.map((b) => b.transactionId));
  const customerByTransactionId = new Map(
    bookings.map((b) => [b.transactionId, b.literalProjectLabel?.trim() || 'Ongecategoriseerd']),
  );

  // Classification readiness is intentionally separate from bank reconciliation.
  // A bank statement may reconcile perfectly even while one or more transactions still
  // need project/type/category metadata. Reporting can enforce that separately.
  const unbookedCount = transactions.length - bookedIds.size;

  // Step 4: Compute ledger totals using absolute amounts
  let ledgerIncome = 0n;
  let ledgerExpense = 0n;
  for (const t of transactions) {
    const amount = abs(toBigInt(t.amountMinor));
    if (t.direction === 'credit') {
      ledgerIncome += amount;
    } else {
      ledgerExpense += amount;
    }
  }
  const ledgerNet = ledgerIncome - ledgerExpense;

  // Bank statement controls (stored as positive absolute values)
  const bankIncome = toBigInt(statement.incomeMinor);
  const bankExpense = toBigInt(statement.expenseMinor);
  const bankNet = toBigInt(statement.netMinor);
  const bankOpening = toBigInt(statement.openingBalanceMinor);
  const bankClosing = toBigInt(statement.closingBalanceMinor);
  const bankTxCount = statement.transactionCount;

  // Invariant A: ledger credits == bank total in
  if (ledgerIncome !== bankIncome) {
    throw new ReportReconciliationError(
      `Inkomsten komen niet overeen: grootboek ${ledgerIncome.toString()} cent vs bankafschrift ${bankIncome.toString()} cent.`,
      'INCOME_MISMATCH',
      bankIncome.toString(),
      ledgerIncome.toString(),
    );
  }

  // Invariant B: ledger debits == bank total out
  if (ledgerExpense !== bankExpense) {
    throw new ReportReconciliationError(
      `Uitgaven komen niet overeen: grootboek ${ledgerExpense.toString()} cent vs bankafschrift ${bankExpense.toString()} cent.`,
      'EXPENSE_MISMATCH',
      bankExpense.toString(),
      ledgerExpense.toString(),
    );
  }

  // Invariant C: bank net == total in - total out
  const expectedBankNet = bankIncome - bankExpense;
  if (bankNet !== expectedBankNet) {
    throw new ReportReconciliationError(
      `Banknetto klopt niet: verwacht ${expectedBankNet.toString()} cent, afschrift meldt ${bankNet.toString()} cent.`,
      'BANK_NET_INTEGRITY',
      expectedBankNet.toString(),
      bankNet.toString(),
    );
  }

  // Invariant D: ledger net == total in - total out
  if (ledgerNet !== expectedBankNet) {
    throw new ReportReconciliationError(
      `Grootboeknetto komt niet overeen met bankcontrole: grootboek ${ledgerNet.toString()} cent vs verwacht ${expectedBankNet.toString()} cent.`,
      'LEDGER_NET_MISMATCH',
      expectedBankNet.toString(),
      ledgerNet.toString(),
    );
  }

  // Invariant E: opening + net == closing
  const expectedClosing = bankOpening + bankNet;
  if (expectedClosing !== bankClosing) {
    throw new ReportReconciliationError(
      `Opening + netto != eindsaldo: ${bankOpening.toString()} + ${bankNet.toString()} = ${expectedClosing.toString()}, verwacht ${bankClosing.toString()}.`,
      'CLOSING_BALANCE_INTEGRITY',
      bankClosing.toString(),
      expectedClosing.toString(),
    );
  }

  // Invariant F: calculated closing == bank closing (redundant with E but explicit)
  const calculatedClosing = bankOpening + ledgerNet;
  if (calculatedClosing !== bankClosing) {
    throw new ReportReconciliationError(
      `Berekend eindsaldo ${calculatedClosing.toString()} cent komt niet overeen met bankafschrift ${bankClosing.toString()} cent.`,
      'CALCULATED_CLOSING_MISMATCH',
      bankClosing.toString(),
      calculatedClosing.toString(),
    );
  }

  // Invariant G: monthly transaction count == statement transaction count
  if (transactions.length !== bankTxCount) {
    throw new ReportReconciliationError(
      `Transactieaantal komt niet overeen: grootboek ${transactions.length} vs bankafschrift ${bankTxCount}.`,
      'TRANSACTION_COUNT_MISMATCH',
      String(bankTxCount),
      String(transactions.length),
    );
  }

  // Invariant I: no duplicate fingerprints
  const fingerprints = transactions
    .map((t) => t.importFingerprint)
    .filter((f): f is string => f != null);
  const fpSet = new Set(fingerprints);
  if (fpSet.size !== fingerprints.length) {
    const dupeCount = fingerprints.length - fpSet.size;
    throw new ReportReconciliationError(
      `Er zijn ${dupeCount} duplicaat-transacties gedetecteerd in deze maand.`,
      'DUPLICATE_FINGERPRINTS',
      '0',
      String(dupeCount),
    );
  }

  // Step 5: Build Klant summary from confirmed project/customer classification.
  // Bank counterparties remain immutable bank evidence and are not the product's Klant dimension.
  const customerMap = new Map<string, { income: bigint; expense: bigint; count: number }>();
  for (const t of transactions) {
    const key = customerByTransactionId.get(t.id) ?? 'Ongecategoriseerd';
    const amount = abs(toBigInt(t.amountMinor));
    const existing = customerMap.get(key);
    if (existing) {
      if (t.direction === 'credit') existing.income += amount;
      else existing.expense += amount;
      existing.count += 1;
    } else {
      customerMap.set(key, {
        income: t.direction === 'credit' ? amount : 0n,
        expense: t.direction === 'debit' ? amount : 0n,
        count: 1,
      });
    }
  }

  const customers: CustomerSummary[] = Array.from(customerMap.entries())
    .map(([name, data]) => ({
      customer: name,
      incomeMinor: data.income,
      expenseMinor: data.expense,
      differenceMinor: data.income - data.expense,
      transactionCount: data.count,
    }))
    .sort((a, b) => a.customer.localeCompare(b.customer, 'nl'));

  // Verify Klant totals reconcile exactly to the bank-authoritative headline totals.
  let customerIncome = 0n;
  let customerExpense = 0n;
  for (const customer of customers) {
    customerIncome += customer.incomeMinor;
    customerExpense += customer.expenseMinor;
  }
  if (customerIncome !== ledgerIncome || customerExpense !== ledgerExpense) {
    throw new ReportReconciliationError(
      `Klanttotalen komen niet overeen met rapporttotalen.`,
      'CUSTOMER_RECONCILIATION',
      `income=${ledgerIncome.toString()}, expense=${ledgerExpense.toString()}`,
      `income=${customerIncome.toString()}, expense=${customerExpense.toString()}`,
    );
  }

  return {
    bankStatementId: statement.id,
    accountId: statement.accountId,
    sourceFileId: statement.sourceFileId,
    supportingPdfFileId: statement.supportingPdfFileId,
    periodStart: statement.periodStart,
    periodEnd: statement.periodEnd,
    openingBalanceMinor: bankOpening,
    incomeMinor: bankIncome,
    expenseMinor: bankExpense,
    netMinor: bankNet,
    closingBalanceMinor: bankClosing,
    transactionCount: bankTxCount,
    ledgerIncomeMinor: ledgerIncome,
    ledgerExpenseMinor: ledgerExpense,
    ledgerNetMinor: ledgerNet,
    ledgerTransactionCount: transactions.length,
    classificationReadiness: {
      transactionCount: transactions.length,
      bookedTransactionCount: bookedIds.size,
      unbookedTransactionCount: unbookedCount,
      complete: unbookedCount === 0,
    },
    passed: true,
    customers,
  };
};
