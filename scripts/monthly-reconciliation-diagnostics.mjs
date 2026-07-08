#!/usr/bin/env node

import { PrismaClient } from '@prisma/client';

const mode = process.argv.includes('--mode')
  ? process.argv[process.argv.indexOf('--mode') + 1]
  : 'dry-run';

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
    // Sample transactions across years
    const samples = await prisma.transaction.findMany({
      where: {
        date: {
          gte: new Date('2024-01-01T00:00:00.000Z'),
          lte: new Date('2026-07-31T23:59:59.999Z'),
        },
      },
      orderBy: [{ date: 'asc' }],
      take: 5,
      select: {
        id: true,
        date: true,
        amountMinor: true,
        direction: true,
        rawRow: true,
      },
    });

    console.log('=== DIAGNOSTIC: Transaction Storage Format ===\n');

    if (samples.length === 0) {
      console.log('No transactions found.');
      return;
    }

    console.log(`Sample of ${samples.length} transaction(s):`);
    for (const tx of samples) {
      console.log(`  ID: ${tx.id}`);
      console.log(`  Date: ${tx.date.toISOString().split('T')[0]}`);
      console.log(`  amountMinor type: ${typeof tx.amountMinor}`);
      console.log(`  amountMinor value: ${tx.amountMinor}`);
      console.log(`  amountMinor BigInt: ${BigInt(tx.amountMinor)}`);
      console.log(`  direction: ${tx.direction}`);

      if (tx.rawRow && typeof tx.rawRow === 'object') {
        console.log(`  rawRow keys: ${Object.keys(tx.rawRow).slice(0, 5).join(', ')}`);
        const resultingBalance = tx.rawRow['Resulting balance'] || tx.rawRow['Resulting Balance'];
        if (resultingBalance) {
          console.log(`  rawRow['Resulting balance']: ${resultingBalance} (type: ${typeof resultingBalance})`);
        }
      }
      console.log('');
    }

    // Check debit/credit mix
    const counts = await prisma.transaction.groupBy({
      by: ['direction'],
      where: {
        date: {
          gte: new Date('2024-01-01T00:00:00.000Z'),
          lte: new Date('2026-07-31T23:59:59.999Z'),
        },
      },
      _count: true,
      _min: { amountMinor: true },
      _max: { amountMinor: true },
    });

    console.log('=== Transaction Amounts by Direction ===\n');
    for (const group of counts) {
      console.log(`${group.direction}: ${group._count} transactions`);
      console.log(`  Min amountMinor: ${group._min.amountMinor}`);
      console.log(`  Max amountMinor: ${group._max.amountMinor}`);
      console.log('');
    }

    // Check for negative amounts
    const negatives = await prisma.transaction.findMany({
      where: {
        date: {
          gte: new Date('2024-01-01T00:00:00.000Z'),
          lte: new Date('2026-07-31T23:59:59.999Z'),
        },
        amountMinor: {
          lt: 0,
        },
      },
      take: 3,
      select: { id: true, amountMinor: true, direction: true },
    });

    console.log('=== Negative Amounts (sample) ===\n');
    if (negatives.length === 0) {
      console.log('No negative amountMinor found.');
    } else {
      for (const tx of negatives) {
        console.log(`  ${tx.id}: ${tx.amountMinor} (${tx.direction})`);
      }
    }
    console.log('');

    // Check booking coverage
    const unresolved = await prisma.transaction.count({
      where: {
        date: {
          gte: new Date('2024-01-01T00:00:00.000Z'),
          lte: new Date('2026-07-31T23:59:59.999Z'),
        },
        transactionBooking: null,
      },
    });

    console.log('=== Booking Coverage ===\n');
    console.log(`Transactions without booking: ${unresolved}`);
    console.log('');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : 'Unknown error';
  console.error(`STOP: ${message}`);
  process.exitCode = 1;
});
