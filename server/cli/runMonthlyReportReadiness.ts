import { loadEnvConfig } from '@next/env';
import { PrismaClient, PeriodCloseStatus } from '@prisma/client';
import { getAccountingAudit } from '../services/accountingAuditService';

const fail = (errorCode: string) => ({ ok: false as const, errorCode });

type MonthDiagnostic = {
  yearMonth: string;
  periodStart: string | null;
  periodEnd: string | null;
  coverageStatus: string | null;
  closeEligible: boolean | null;
  unresolvedCount: number;
  balanceDifferenceMinor: string;
  categoryIncomeDifferenceMinor: string;
  categoryExpenseDifferenceMinor: string;
  periodCloseStatus: string | null;
  periodCloseVersion: number | null;
  issueCodes: string[];
};

export const runMonthlyReportReadiness = async (input: {
  env: NodeJS.ProcessEnv;
  args: string[];
  db: PrismaClient;
  write: (value: string) => void;
}): Promise<number> => {
  const workspaceId = input.env.DEFAULT_WORKSPACE_ID?.trim();
  const userId = input.env.DEFAULT_USER_ID?.trim();
  if (!workspaceId) {
    input.write(JSON.stringify(fail('CONFIGURED_WORKSPACE_REQUIRED')));
    return 2;
  }

  const membership = userId ? await input.db.workspaceMembership.findFirst({
    where: {
      workspaceId,
      userId,
      role: 'ADMIN',
      isActive: true,
      workspace: { isActive: true },
      user: { isActive: true },
    },
    select: { userId: true },
  }) : null;

  let resolvedUserId = membership?.userId ?? null;
  let actorResolution: 'CONFIGURED' | 'UNIQUE_ADMIN_DIAGNOSTIC' = 'CONFIGURED';
  if (!resolvedUserId && input.args.includes('--discover-unique-admin')) {
    const memberships = await input.db.workspaceMembership.findMany({
      where: {
        workspaceId,
        role: 'ADMIN',
        isActive: true,
        workspace: { isActive: true },
        user: { isActive: true },
      },
      select: { userId: true },
      take: 2,
    });
    if (memberships.length === 1) {
      resolvedUserId = memberships[0]!.userId;
      actorResolution = 'UNIQUE_ADMIN_DIAGNOSTIC';
    }
  }
  if (!resolvedUserId) {
    input.write(JSON.stringify(fail('CONFIGURED_ADMIN_NOT_FOUND')));
    return 2;
  }

  const [audit, transactionCount, confirmedBookings, reviewDecisionCount, activeRecipients, closedPeriods, snapshotCount, sentDispatchCount, allPeriodCloses] = await Promise.all([
    getAccountingAudit(input.db, { userId: resolvedUserId }),
    input.db.transaction.count({ where: { userId: resolvedUserId } }),
    input.db.transactionBooking.count({ where: { transaction: { userId: resolvedUserId } } }),
    input.db.reviewDecision.count({ where: { workspaceId } }),
    input.db.emailRecipient.count({ where: { userId: resolvedUserId, isActive: true } }),
    input.db.periodClose.findMany({
      where: { workspaceId, status: 'CLOSED' },
      select: { periodStart: true, periodEnd: true, version: true },
      orderBy: [{ periodStart: 'asc' }, { version: 'desc' }],
    }),
    input.db.reportSnapshot.count({ where: { workspaceId } }),
    input.db.reportDispatch.count({
      where: { status: 'SENT', reportSnapshot: { workspaceId } },
    }),
    input.db.periodClose.findMany({
      where: { workspaceId },
      select: { periodStart: true, status: true, version: true },
      orderBy: [{ periodStart: 'asc' }, { version: 'desc' }],
    }),
  ]);

  if (!audit) {
    input.write(JSON.stringify(fail('ACCOUNTING_AUDIT_UNAVAILABLE')));
    return 2;
  }

  const unresolvedTransactions = transactionCount - confirmedBookings;
  const closedMonths = [...new Set(closedPeriods.map((period) => period.periodStart.toISOString().slice(0, 7)))];

  const monthDiagnostics: MonthDiagnostic[] = audit.months.map((month) => {
    const yearMonth = `${month.year}-${String(month.month).padStart(2, '0')}`;
    const periodClose = allPeriodCloses.find(
      (pc) => pc.periodStart.toISOString().slice(0, 7) === yearMonth,
    );
    const issueCodes: string[] = [];
    if (month.unresolvedTransactionCount > 0) issueCodes.push('UNRESOLVED');
    if (month.balanceDifferenceMinor !== '0') issueCodes.push('BALANCE_DIFF');
    if (month.categoryIncomeDifferenceMinor !== '0') issueCodes.push('INCOME_DIFF');
    if (month.categoryExpenseDifferenceMinor !== '0') issueCodes.push('EXPENSE_DIFF');
    if (month.runningBalanceErrorCount > 0) issueCodes.push('RUNNING_ERROR');
    if (!month.closeEligible && month.reasons.length > 0) issueCodes.push('NOT_ELIGIBLE');

    return {
      yearMonth,
      periodStart: month.periodStart,
      periodEnd: month.periodEnd,
      coverageStatus: month.coverageStatus,
      closeEligible: month.closeEligible,
      unresolvedCount: month.unresolvedTransactionCount,
      balanceDifferenceMinor: month.balanceDifferenceMinor,
      categoryIncomeDifferenceMinor: month.categoryIncomeDifferenceMinor,
      categoryExpenseDifferenceMinor: month.categoryExpenseDifferenceMinor,
      periodCloseStatus: periodClose?.status ?? null,
      periodCloseVersion: periodClose?.version ?? null,
      issueCodes,
    };
  });

  const complete =
    audit.status === 'PASSED'
    && audit.cashStatus === 'PASSED'
    && audit.classificationStatus === 'PASSED'
    && audit.closeStatus === 'ELIGIBLE'
    && audit.totals.unresolvedTransactionCount === 0
    && audit.totals.duplicateFingerprintCount === 0
    && audit.totals.runningBalanceErrorCount === 0
    && transactionCount === confirmedBookings;

  input.write(JSON.stringify({
    ok: true,
    status: complete ? 'READY' : 'NOT_READY',
    readOnly: true,
    actorResolution,
    counts: {
      transactionCount,
      confirmedBookings,
      unresolvedTransactions,
      reviewDecisionCount,
      activeRecipients,
      closedMonthCount: closedMonths.length,
      snapshotCount,
      sentDispatchCount,
    },
    accounting: {
      status: audit.status,
      cashStatus: audit.cashStatus,
      classificationStatus: audit.classificationStatus,
      closeStatus: audit.closeStatus,
      duplicateFingerprintCount: audit.totals.duplicateFingerprintCount,
      runningBalanceErrorCount: audit.totals.runningBalanceErrorCount,
      cashDifferenceMinor: audit.totals.cashDifferenceMinor,
    },
    closedMonths,
    monthDiagnostics,
    emailRuntime: {
      resendConfigured: Boolean(input.env.RESEND_API_KEY?.trim()),
      fromAddressConfigured: Boolean(input.env.REPORT_EMAIL_FROM?.trim()),
      defaultFromAddressAvailable: true,
    },
    sideEffects: {
      writesPerformed: false,
      createsReportSnapshot: false,
      sendsEmail: false,
    },
  }));

  if (input.args.includes('--require-complete') && !complete) return 3;
  return 0;
};

if (require.main === module) {
  loadEnvConfig(process.cwd());
  const db = new PrismaClient();
  runMonthlyReportReadiness({ env: process.env, args: process.argv.slice(2), db, write: console.log })
    .then((code) => {
      process.exitCode = code;
    })
    .catch(() => {
      console.log(JSON.stringify(fail('READINESS_CHECK_FAILED')));
      process.exitCode = 1;
    })
    .finally(async () => {
      await db.$disconnect();
    });
}
