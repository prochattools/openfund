#!/usr/bin/env node

import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

const mode = process.argv.includes('--mode')
  ? process.argv[process.argv.indexOf('--mode') + 1]
  : 'dry-run';

const getMonthKey = (date) => {
  const value = new Date(date);
  return `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, '0')}`;
};

const parseMinorFromRawRow = (rawRow) => {
  if (!rawRow || typeof rawRow !== 'object') return null;

  const alreadyMinor = [
    rawRow.resultingBalanceMinor,
    rawRow.resulting_balance_minor,
  ].find((v) => v != null && String(v).trim().length > 0);

  if (alreadyMinor != null) {
    const asNum = Number(alreadyMinor);
    return BigInt(Math.round(asNum));
  }

  const euroCandidates = [
    rawRow['Resulting balance'],
    rawRow['Resulting Balance'],
  ].filter((value) => value != null && String(value).trim().length > 0);

  if (!euroCandidates.length) return null;
  let raw = String(euroCandidates[0]).trim();

  const lastDot = raw.lastIndexOf('.');
  const lastComma = raw.lastIndexOf(',');
  if (lastDot > lastComma) {
    raw = raw.replace(/,/g, '');
  } else if (lastComma > lastDot) {
    raw = raw.replace(/\./g, '').replace(',', '.');
  } else if (lastDot >= 0) {
    // no change needed
  } else if (lastComma >= 0) {
    raw = raw.replace(',', '.');
  }

  const parsed = Number(raw);
  if (Number.isNaN(parsed)) return null;
  return BigInt(Math.round(parsed * 100));
};

async function main() {
  if (mode === 'dry-run') {
    console.log('dry-run: no database access');
    return;
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('STOP: DATABASE_URL is missing in the environment.');
    process.exitCode = 1;
    return;
  }

  const prisma = new PrismaClient();
  try {
    const transactions = await prisma.transaction.findMany({
      where: {
        date: {
          gte: new Date('2024-01-01T00:00:00.000Z'),
          lte: new Date('2024-12-31T23:59:59.999Z'),
        },
      },
      orderBy: [
        { date: 'asc' },
        { id: 'asc' },
      ],
      select: {
        id: true,
        date: true,
        amountMinor: true,
        direction: true,
        rawRow: true,
        transactionBooking: {
          select: {
            projectId: true,
            transactionTypeId: true,
            categoryId: true,
          },
        },
      },
    });

    console.log(`\n=== 2024 Reconciliation Diagnostics ===`);
    console.log(`Total 2024 transactions: ${transactions.length}`);

    const byMonth = new Map();
    for (const tx of transactions) {
      const month = getMonthKey(tx.date);
      const existing = byMonth.get(month) ?? [];
      existing.push(tx);
      byMonth.set(month, existing);
    }

    let yearIncomeMinor = 0n;
    let yearExpenseMinor = 0n;
    let yearIncomeAbs = 0n;
    let yearExpenseAbs = 0n;
    let cumulativeBalance = 172186n;
    let rawBalanceFound = false;
    const firstTx = transactions[0];
    if (firstTx) {
      const firstRawBalance = parseMinorFromRawRow(firstTx.rawRow);
      console.log(`\nFirst transaction: ${firstTx.date.toISOString()}`);
      console.log(`  Direction: ${firstTx.direction}`);
      console.log(`  Amount: ${firstTx.amountMinor}`);
      if (firstRawBalance != null) {
        console.log(`  Raw balance parsed: ${firstRawBalance}`);
        cumulativeBalance = firstRawBalance;
        rawBalanceFound = true;
      }
    }

    console.log(`\n--- Monthly Breakdown ---`);
    console.log(`Columns: month, tx count, income(signed), expense(signed), income(abs), expense(abs), booked, unresolved, raw-balance-errors/total`);
    const months = Array.from(byMonth.entries()).sort();
    for (const [monthKey, txs] of months) {
      let monthIncome = 0n;
      let monthExpense = 0n;
      let monthIncomeAbs = 0n;
      let monthExpenseAbs = 0n;
      let bookedCount = 0;
      let unresolvedCount = 0;
      let runningBalanceCount = 0;
      let runningBalanceErrorCount = 0;

      for (const tx of txs) {
        const amount = BigInt(tx.amountMinor);
        const absAmount = amount < 0n ? -amount : amount;
        if (tx.direction === 'credit') {
          monthIncome += amount;
          monthIncomeAbs += absAmount;
        } else {
          monthExpense += amount;
          monthExpenseAbs += absAmount;
        }

        if (tx.transactionBooking?.projectId && tx.transactionBooking?.transactionTypeId && tx.transactionBooking?.categoryId) {
          bookedCount++;
        } else {
          unresolvedCount++;
        }

        const rawBalance = parseMinorFromRawRow(tx.rawRow);
        if (rawBalance != null) {
          rawBalanceFound = true;
          runningBalanceCount++;
          const expectedBalance = cumulativeBalance + (tx.direction === 'credit' ? absAmount : -absAmount);
          if (rawBalance !== expectedBalance) {
            runningBalanceErrorCount++;
          }
          cumulativeBalance = rawBalance;
        }
      }

      yearIncomeMinor += monthIncome;
      yearExpenseMinor += monthExpense;
      yearIncomeAbs += monthIncomeAbs;
      yearExpenseAbs += monthExpenseAbs;

      console.log(`${monthKey}: ${txs.length} tx | income: ${monthIncome} | expense: ${monthExpense} | incomeAbs: ${monthIncomeAbs} | expenseAbs: ${monthExpenseAbs} | booked: ${bookedCount} | unresolved: ${unresolvedCount} | raw-balance-errors: ${runningBalanceErrorCount}/${runningBalanceCount}`);
    }

    const lastTx = transactions[transactions.length - 1];
    let finalRunningBalance = cumulativeBalance;
    if (lastTx) {
      const lastRawBalance = parseMinorFromRawRow(lastTx.rawRow);
      if (lastRawBalance != null) {
        finalRunningBalance = lastRawBalance;
      }
    }

    const formulaClosing = 172186n + yearIncomeAbs - yearExpenseAbs;
    const formulaClosingSigned = 172186n + yearIncomeMinor + yearExpenseMinor;

    console.log(`\n--- Annual Summary ---`);
    console.log(`Opening balance: 172186`);
    console.log(`Total income (signed): ${yearIncomeMinor}`);
    console.log(`Total expense (signed): ${yearExpenseMinor}`);
    console.log(`Total income (abs): ${yearIncomeAbs}`);
    console.log(`Total expense (abs): ${yearExpenseAbs}`);
    console.log(`Expected closing: 1218415`);
    console.log(`Formula closing (abs): ${formulaClosing}`);
    console.log(`Formula closing (signed): ${formulaClosingSigned}`);
    console.log(`Raw balance chain closing: ${finalRunningBalance}`);
    console.log(`Raw balance fields present: ${rawBalanceFound}`);
    console.log(`Formula matches expected: ${formulaClosing === 1218415n}`);
    console.log(`Formula matches expected (signed): ${formulaClosingSigned === 1218415n}`);
    console.log(`Raw balance difference from expected: ${Number(finalRunningBalance - 1218415n)}`);
    console.log(`\nDiagnostic note: Formula-based model is the audit standard.`);
    console.log(`Raw balance fields (resultingBalanceMinor) are excluded from formula audit.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : 'Unknown error';
  console.error(`STOP: ${message}`);
  process.exitCode = 1;
});
