#!/usr/bin/env node

import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const distRoot = path.join(repoRoot, 'dist');

const mode = process.argv.includes('--mode')
  ? process.argv[process.argv.indexOf('--mode') + 1]
  : 'dry-run';

const loadBuiltModule = async (relativePath) => import(path.join(distRoot, relativePath));

const parseMinorFromRawRow = (rawRow) => {
  if (!rawRow || typeof rawRow !== 'object') return null;

  // Check for already-minor-unit fields first (no scaling needed)
  const alreadyMinor = [
    rawRow.resultingBalanceMinor,
    rawRow.resulting_balance_minor,
  ].find((v) => v != null && String(v).trim().length > 0);

  if (alreadyMinor != null) {
    const parsed = BigInt(alreadyMinor);
    return parsed;
  }

  // Fall back to euro decimal fields (scale by 100)
  const euroCandidates = [
    rawRow['Resulting balance'],
    rawRow['Resulting Balance'],
  ].filter((value) => value != null && String(value).trim().length > 0);

  if (!euroCandidates.length) return null;
  const raw = String(euroCandidates[0]).replace(/\./g, '').replace(',', '.');
  const parsed = Number(raw);
  if (Number.isNaN(parsed)) return null;
  return BigInt(Math.round(parsed * 100));
};

const getMonthKey = (date) => {
  const value = new Date(date);
  return `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, '0')}`;
};

const groupTransactionsByMonth = (transactions) => {
  const grouped = new Map();
  for (const tx of transactions) {
    const key = getMonthKey(tx.date);
    const existing = grouped.get(key) ?? [];
    existing.push(tx);
    grouped.set(key, existing);
  }
  return grouped;
};

const buildCoverageByYear = (statementPeriods) => {
  const coverageByYear = new Map();
  for (const period of statementPeriods) {
    const year = period.periodStart.getUTCFullYear();
    const partialMonth = period.coverageStatus === 'PARTIAL'
      ? period.periodEnd.getUTCMonth() + 1
      : null;
    coverageByYear.set(year, {
      coverageStatus: period.coverageStatus,
      partialMonth,
      periodEnd: period.periodEnd,
    });
  }
  return coverageByYear;
};

const deriveCoverageStatus = (year, month, coverageByYear) => {
  const coverage = coverageByYear.get(year);
  if (!coverage || coverage.coverageStatus === 'COMPLETE') {
    return 'COMPLETE';
  }

  return coverage.partialMonth === month ? 'PARTIAL' : 'COMPLETE';
};

const derivePeriodEnd = (year, month, coverageByYear) => {
  const coverage = coverageByYear.get(year);
  if (coverage?.coverageStatus === 'PARTIAL' && coverage.partialMonth === month) {
    return coverage.periodEnd;
  }
  return new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
};

const buildExpectedCoverage = () => ({
  2024: Array.from({ length: 12 }, (_, index) => index + 1),
  2025: Array.from({ length: 12 }, (_, index) => index + 1),
  2026: Array.from({ length: 7 }, (_, index) => index + 1),
});

const buildMonthlyReconciliationInput = (year, month, txs, coverageByYear) => ({
  workspaceId: 'finance-workspace',
  accountId: 'finance-account',
  year,
  month,
  importedTransactions: txs.map((tx) => ({
    transactionId: tx.id,
    date: tx.date,
    amountMinor: tx.amountMinor,
    direction: tx.direction,
    resultingBalanceMinor: parseMinorFromRawRow(tx.rawRow),
    importFingerprint: tx.importFingerprint ?? null,
    duplicateFingerprint: tx.importFingerprint ?? null,
    projectId: tx.transactionBooking?.projectId ?? null,
    transactionTypeId: tx.transactionBooking?.transactionTypeId ?? null,
    categoryId: tx.transactionBooking?.categoryId ?? null,
    literalProjectLabel: tx.transactionBooking?.literalProjectLabel ?? null,
    literalTypeLabel: tx.transactionBooking?.literalTypeLabel ?? null,
    literalCategoryLabel: tx.transactionBooking?.literalCategoryLabel ?? null,
    unresolved: !(tx.transactionBooking?.projectId && tx.transactionBooking?.transactionTypeId && tx.transactionBooking?.categoryId),
    sourceFileHash: tx.sourceFileHash ?? null,
  })),
  statementEvidence: {
    coverageStatus: deriveCoverageStatus(year, month, coverageByYear),
    openingBalanceMinor: null,
    closingBalanceMinor: null,
    sourceFileHashes: Array.from(new Set(txs.map((tx) => tx.sourceFileHash).filter(Boolean))),
    periodStart: new Date(Date.UTC(year, month - 1, 1)),
    periodEnd: derivePeriodEnd(year, month, coverageByYear),
  },
});

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

  const { buildMonthlyReconciliation } = await loadBuiltModule('server/services/monthlyReconciliationService.js');
  const { auditMonthlyReconciliations } = await loadBuiltModule('server/services/monthlyReconciliationAuditService.js');

  const prisma = new PrismaClient();
  try {
    const transactions = await prisma.transaction.findMany({
      where: {
        date: {
          gte: new Date('2024-01-01T00:00:00.000Z'),
          lte: new Date('2026-07-31T23:59:59.999Z'),
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
        importFingerprint: true,
        rawRow: true,
        transactionBooking: {
          select: {
            projectId: true,
            transactionTypeId: true,
            categoryId: true,
            literalProjectLabel: true,
            literalTypeLabel: true,
            literalCategoryLabel: true,
          },
        },
      },
    });

    const statementPeriods = await prisma.statementPeriod.findMany({
      orderBy: [{ periodStart: 'asc' }],
      select: {
        periodStart: true,
        periodEnd: true,
        coverageStatus: true,
      },
    });

    const groupedTransactions = groupTransactionsByMonth(transactions);
    const coverageByYear = buildCoverageByYear(statementPeriods);

    const monthlyResults = [];
    for (const [monthKey, monthTransactions] of groupedTransactions.entries()) {
      const [yearPart, monthPart] = monthKey.split('-');
      const year = Number(yearPart);
      const month = Number(monthPart);
      monthlyResults.push(
        buildMonthlyReconciliationInput(year, month, monthTransactions, coverageByYear),
      );
    }

    const reconciliations = monthlyResults.map((input) => buildMonthlyReconciliation(input));
    const audit = auditMonthlyReconciliations({
      months: reconciliations,
      expectedCoverage: buildExpectedCoverage(),
      validatorVersion: 'monthly-reconciliation-audit-cli-v1',
    });

    console.log(`months checked: ${audit.monthCount}`);
    for (const summary of audit.yearSummaries) {
      console.log(
        `${summary.year}: ${summary.monthCount} months | ${summary.transactionCount} tx | opening ${summary.openingBalanceMinor} | income ${summary.incomeMinor} | expense ${summary.expenseMinor} | closing ${summary.closingBalanceMinor}`,
      );
    }
    if (audit.status !== 'PASSED') {
      console.error('audit failed');
      for (const issue of audit.issues) {
        console.error(`${issue.year}-${String(issue.month).padStart(2, '0')}: ${issue.message}`);
      }
      process.exitCode = 1;
      return;
    }

    console.log('audit passed');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : 'Unknown error';
  console.error(`STOP: ${message}`);
  process.exitCode = 1;
});
