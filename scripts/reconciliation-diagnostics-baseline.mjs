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
    let cumulativeBalance = 172186n;
    const firstTx = transactions[0];
    if (firstTx) {
      const firstRawBalance = parseMinorFromRawRow(firstTx.rawRow);
      console.log(`\nFirst transaction: ${firstTx.date.toISOString()}`);
      console.log(`  Direction: ${firstTx.direction}`);
      console.log(`  Amount: ${firstTx.amountMinor}`);
      if (firstRawBalance != null) {
        console.log(`  Raw balance parsed: ${firstRawBalance}`);
        cumulativeBalance = firstRawBalance;
      }
    }

    console.log(`\n--- Monthly Breakdown ---`);
    const months = Array.from(byMonth.entries()).sort();
    for (const [monthKey, txs] of months) {
      let monthIncome = 0n;
      let monthExpense = 0n;
      let bookedCount = 0;
      let unresolvedCount = 0;
      let runningBalanceCount = 0;
      let runningBalanceErrorCount = 0;

      for (const tx of txs) {
        const amount = BigInt(tx.amountMinor);
        if (tx.direction === 'credit') {
          monthIncome += amount;
        } else {
          monthExpense += amount;
        }

        if (tx.transactionBooking?.projectId && tx.transactionBooking?.transactionTypeId && tx.transactionBooking?.categoryId) {
          bookedCount++;
        } else {
          unresolvedCount++;
        }

        const rawBalance = parseMinorFromRawRow(tx.rawRow);
        if (rawBalance != null) {
          runningBalanceCount++;
          const expectedBalance = cumulativeBalance + (tx.direction === 'credit' ? amount : -amount);
          if (rawBalance !== expectedBalance) {
            runningBalanceErrorCount++;
          }
          cumulativeBalance = rawBalance;
        }
      }

      yearIncomeMinor += monthIncome;
      yearExpenseMinor += monthExpense;

      console.log(`${monthKey}: ${txs.length} tx | income: ${monthIncome} | expense: ${monthExpense} | booked: ${bookedCount} | unresolved: ${unresolvedCount} | running-balance-errors: ${runningBalanceErrorCount}/${runningBalanceCount}`);
    }

    const lastTx = transactions[transactions.length - 1];
    let finalBalance = cumulativeBalance;
    if (lastTx) {
      const lastRawBalance = parseMinorFromRawRow(lastTx.rawRow);
      if (lastRawBalance != null) {
        finalBalance = lastRawBalance;
      }
    }

    console.log(`\n--- Annual Summary ---`);
    console.log(`Opening balance: 172186`);
    console.log(`Total income: ${yearIncomeMinor}`);
    console.log(`Total expense: ${yearExpenseMinor}`);
    console.log(`Final running balance: ${finalBalance}`);
    console.log(`Expected closing: 1218415`);
    console.log(`Formula check: 172186 + ${yearIncomeMinor} - ${yearExpenseMinor} = ${172186n + yearIncomeMinor - yearExpenseMinor}`);
    console.log(`Difference from expected: ${Number(finalBalance - 1218415n)}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : 'Unknown error';
  console.error(`STOP: ${message}`);
  process.exitCode = 1;
});
