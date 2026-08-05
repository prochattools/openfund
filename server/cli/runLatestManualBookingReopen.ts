import { loadEnvConfig } from '@next/env';
import type { PrismaClient } from '@prisma/client';
import {
  buildLatestManualBookingReopenPlan,
  executeLatestManualBookingReopen,
  ManualBookingReopenError,
} from '../services/manualBookingReopenService';
import { getAccountingAudit } from '../services/accountingAuditService';
import { getEvidenceRichReviewQueue } from '../services/reviewQueueService';

const failure = (errorCode: string, detail?: string) => ({
  ok: false as const,
  errorCode,
  ...(detail ? { detail } : {}),
});

const argValue = (args: string[], name: string): string | null => {
  const index = args.indexOf(name);
  return index >= 0 ? (args[index + 1] ?? null) : null;
};

type ActorResolution = {
  userId: string;
  email: string | null;
  mode: 'CONFIGURED' | 'UNIQUE_ADMIN_DIAGNOSTIC';
};

const resolveActor = async (
  db: PrismaClient,
  env: NodeJS.ProcessEnv,
  allowDiagnosticDiscovery: boolean,
): Promise<ActorResolution> => {
  const workspaceId = env.DEFAULT_WORKSPACE_ID?.trim();
  if (!workspaceId) {
    throw new ManualBookingReopenError('WORKSPACE_REQUIRED', 'DEFAULT_WORKSPACE_ID is required.');
  }

  const configuredUserId = env.DEFAULT_USER_ID?.trim();
  if (configuredUserId) {
    const membership = await db.workspaceMembership.findFirst({
      where: {
        workspaceId,
        userId: configuredUserId,
        role: 'ADMIN',
        isActive: true,
        workspace: { isActive: true },
        user: { isActive: true },
      },
      select: { user: { select: { id: true, email: true } } },
    });
    if (membership) {
      return {
        userId: membership.user.id,
        email: membership.user.email,
        mode: 'CONFIGURED',
      };
    }
  }

  if (!allowDiagnosticDiscovery) {
    throw new ManualBookingReopenError(
      'CONFIGURED_ADMIN_NOT_FOUND',
      'The configured default user is not the active administrator for the configured workspace.',
    );
  }

  const memberships = await db.workspaceMembership.findMany({
    where: {
      workspaceId,
      role: 'ADMIN',
      isActive: true,
      workspace: { isActive: true },
      user: { isActive: true },
    },
    select: { user: { select: { id: true, email: true } } },
    take: 2,
  });
  if (memberships.length !== 1) {
    throw new ManualBookingReopenError(
      'UNIQUE_ADMIN_NOT_FOUND',
      'Diagnostic discovery requires exactly one active administrator in the configured workspace.',
    );
  }

  return {
    userId: memberships[0]!.user.id,
    email: memberships[0]!.user.email,
    mode: 'UNIQUE_ADMIN_DIAGNOSTIC',
  };
};

export const runLatestManualBookingReopenCli = async (input: {
  args: string[];
  env: NodeJS.ProcessEnv;
  createDb: () => Promise<{ db: PrismaClient; disconnect: () => Promise<void> }>;
  write: (value: string) => void;
}): Promise<number> => {
  const execute = input.args.includes('--execute');
  const discoverCandidates = input.args.includes('--discover-candidates');
  const verifyReopened = input.args.includes('--verify-reopened');
  const authorizeSingleReopen = input.args.includes('--authorize-single-reopen');
  const allowDiagnosticDiscovery = input.args.includes('--discover-unique-admin');
  const confirmedPlanHash = argValue(input.args, '--confirmed-hash');
  const expectedAmountMinorRaw = argValue(input.args, '--expected-amount-minor');
  const expectedDirection = argValue(input.args, '--expected-direction');
  const expectedMerchantNeedle = argValue(input.args, '--expected-merchant');
  const expectedUnresolvedBeforeRaw = argValue(input.args, '--expected-unresolved-before');

  if (!input.env.DATABASE_URL?.trim() || !input.env.DEFAULT_WORKSPACE_ID?.trim()) {
    input.write(JSON.stringify(failure('DATABASE_OR_WORKSPACE_REQUIRED')));
    return 2;
  }

  if (
    !expectedAmountMinorRaw
    || !/^\d+$/.test(expectedAmountMinorRaw)
    || (expectedDirection !== 'credit' && expectedDirection !== 'debit')
    || !expectedMerchantNeedle?.trim()
    || !expectedUnresolvedBeforeRaw
    || !/^\d+$/.test(expectedUnresolvedBeforeRaw)
  ) {
    input.write(JSON.stringify(failure(
      'EXACT_EXPECTATIONS_REQUIRED',
      'Pass exact amount, direction, merchant, and unresolved-before expectations.',
    )));
    return 2;
  }

  if (execute && (!confirmedPlanHash || !authorizeSingleReopen)) {
    input.write(JSON.stringify(failure(
      'EXECUTION_CONFIRMATION_REQUIRED',
      'Execution requires --confirmed-hash and --authorize-single-reopen.',
    )));
    return 2;
  }

  let disconnect: (() => Promise<void>) | null = null;
  try {
    const connection = await input.createDb();
    disconnect = connection.disconnect;
    const actor = await resolveActor(connection.db, input.env, allowDiagnosticDiscovery);

    if (verifyReopened) {
      const expectedAmountMinor = BigInt(expectedAmountMinorRaw);
      const merchantNeedle = expectedMerchantNeedle.trim().normalize('NFKC').toLowerCase();
      const candidates = await connection.db.transaction.findMany({
        where: {
          userId: actor.userId,
          amountMinor: expectedAmountMinor,
          direction: expectedDirection,
        },
        include: {
          transactionBooking: true,
          reviewDecisions: {
            orderBy: [{ decidedAt: 'desc' }, { id: 'desc' }],
            take: 1,
            select: { action: true, decidedAt: true },
          },
        },
      });
      const matches = candidates.filter((candidate) =>
        [candidate.counterparty, candidate.description, candidate.reference]
          .filter(Boolean)
          .join(' ')
          .normalize('NFKC')
          .toLowerCase()
          .includes(merchantNeedle),
      );
      if (matches.length !== 1) {
        throw new ManualBookingReopenError(
          'REOPENED_TRANSACTION_NOT_UNIQUE',
          'Post-reopen verification requires exactly one transaction matching the authorized facts.',
        );
      }
      const candidate = matches[0]!;
      if (candidate.transactionBooking) {
        throw new ManualBookingReopenError(
          'BOOKING_STILL_PRESENT',
          'The reopened transaction still has a current booking.',
        );
      }
      if (candidate.reviewDecisions[0]?.action !== 'REMOVE_BOOKING') {
        throw new ManualBookingReopenError(
          'COMPENSATING_DECISION_MISSING',
          'The reopened transaction does not have the required compensating decision.',
        );
      }

      const [totalTransactions, confirmedBookings, unresolvedTransactions, queue, audit] = await Promise.all([
        connection.db.transaction.count({ where: { userId: actor.userId } }),
        connection.db.transactionBooking.count({ where: { transaction: { userId: actor.userId } } }),
        connection.db.transaction.count({
          where: { userId: actor.userId, transactionBooking: null },
        }),
        getEvidenceRichReviewQueue(connection.db, actor.userId, input.env.DEFAULT_WORKSPACE_ID.trim(), {
          page: 1,
          pageSize: 1000,
        }),
        getAccountingAudit(connection.db, { userId: actor.userId }),
      ]);
      const reviewItem = queue.transactions.find((item) => item.transactionId === candidate.id);
      const completeEditablePrefill = Boolean(
        reviewItem
        && reviewItem.prefill.complete
        && reviewItem.proposed?.complete
        && reviewItem.proposed.projectId
        && reviewItem.proposed.transactionTypeId
        && reviewItem.proposed.categoryId,
      );
      if (!reviewItem || !completeEditablePrefill) {
        throw new ManualBookingReopenError(
          'REVIEW_PREFILL_INCOMPLETE',
          'The reopened transaction is not present with a complete editable review prefill.',
        );
      }
      if (unresolvedTransactions !== Number(expectedUnresolvedBeforeRaw)) {
        throw new ManualBookingReopenError(
          'UNRESOLVED_COUNT_MISMATCH',
          'The current unresolved count differs from the explicitly expected post-reopen count.',
        );
      }
      if (
        !audit
        || audit.cashStatus !== 'PASSED'
        || audit.totals.duplicateFingerprintCount !== 0
        || audit.totals.runningBalanceErrorCount !== 0
      ) {
        throw new ManualBookingReopenError(
          'ACCOUNTING_INTEGRITY_FAILED',
          'Post-reopen accounting integrity did not pass.',
        );
      }

      input.write(JSON.stringify({
        ok: true,
        status: 'POST_REOPEN_VERIFIED',
        dryRun: true,
        writesPerformed: false,
        actorResolution: actor.mode,
        candidate: {
          transactionDate: candidate.date.toISOString(),
          amountMinor: candidate.amountMinor.toString(),
          direction: candidate.direction,
          booked: false,
          latestDecisionAction: candidate.reviewDecisions[0].action,
        },
        counts: {
          totalTransactions,
          confirmedBookings,
          unresolvedTransactions,
          reviewQueueItems: queue.pagination.totalItems,
        },
        review: {
          present: true,
          completeEditablePrefill,
          prefillSource: reviewItem.prefill.source,
        },
        integrity: {
          cashStatus: audit.cashStatus,
          duplicateFingerprintCount: audit.totals.duplicateFingerprintCount,
          runningBalanceErrorCount: audit.totals.runningBalanceErrorCount,
        },
        sideEffects: {
          writesPerformed: false,
          mutatesBookings: false,
          mutatesDecisions: false,
          mutatesTransactions: false,
          mutatesSuggestions: false,
        },
      }));
      return 0;
    }

    if (discoverCandidates) {
      const expectedAmountMinor = BigInt(expectedAmountMinorRaw);
      const candidates = await connection.db.transaction.findMany({
        where: {
          userId: actor.userId,
          OR: [
            { amountMinor: expectedAmountMinor },
            { amountMinor: -expectedAmountMinor },
          ],
        },
        orderBy: [{ date: 'desc' }, { id: 'desc' }],
        select: {
          id: true,
          date: true,
          amountMinor: true,
          direction: true,
          counterparty: true,
          description: true,
          transactionBooking: { select: { id: true } },
          reviewDecisions: {
            orderBy: [{ decidedAt: 'desc' }, { id: 'desc' }],
            take: 1,
            select: { action: true, decidedAt: true },
          },
        },
      });

      input.write(JSON.stringify({
        ok: true,
        status: 'CANDIDATE_DISCOVERY_COMPLETE',
        dryRun: true,
        writesPerformed: false,
        actorResolution: actor.mode,
        candidateCount: candidates.length,
        candidates: candidates.map((candidate) => ({
          transactionId: candidate.id,
          transactionDate: candidate.date.toISOString(),
          amountMinor: candidate.amountMinor.toString(),
          direction: candidate.direction,
          counterparty: candidate.counterparty,
          description: candidate.description.slice(0, 160),
          booked: Boolean(candidate.transactionBooking),
          latestDecisionAction: candidate.reviewDecisions[0]?.action ?? null,
          latestDecisionAt: candidate.reviewDecisions[0]?.decidedAt.toISOString() ?? null,
        })),
        sideEffects: {
          writesPerformed: false,
          mutatesBookings: false,
          mutatesDecisions: false,
          mutatesTransactions: false,
          mutatesSuggestions: false,
        },
      }));
      return 0;
    }

    const criteria = {
      workspaceId: input.env.DEFAULT_WORKSPACE_ID.trim(),
      userId: actor.userId,
      expectedAmountMinor: BigInt(expectedAmountMinorRaw),
      expectedDirection,
      expectedMerchantNeedle: expectedMerchantNeedle.trim(),
      expectedUnresolvedBefore: Number(expectedUnresolvedBeforeRaw),
    } as const;

    if (!execute) {
      const plan = await buildLatestManualBookingReopenPlan(connection.db, criteria);
      input.write(JSON.stringify({
        ok: true,
        status: 'DRY_RUN_COMPLETE',
        dryRun: true,
        writesPerformed: false,
        actorResolution: actor.mode,
        version: plan.version,
        planHash: plan.planHash,
        candidate: {
          transactionDate: plan.transactionDate,
          amountMinor: plan.amountMinor,
          direction: plan.direction,
          merchantMatched: plan.merchantMatched,
          latestDecision: true,
        },
        counts: plan.counts,
        sideEffects: plan.sideEffects,
        nextStep: `Re-run with --execute --authorize-single-reopen --confirmed-hash ${plan.planHash}`,
      }));
      return 0;
    }

    const result = await executeLatestManualBookingReopen(connection.db, {
      ...criteria,
      actorId: actor.userId,
      actorEmail: actor.email,
      confirmedPlanHash: confirmedPlanHash!,
    });

    input.write(JSON.stringify({
      ok: result.status === 'REOPENED',
      status: result.status,
      writesPerformed: result.writesPerformed,
      actorResolution: actor.mode,
      planHash: result.plan.planHash,
      candidate: {
        transactionDate: result.plan.transactionDate,
        amountMinor: result.plan.amountMinor,
        direction: result.plan.direction,
        merchantMatched: result.plan.merchantMatched,
      },
      counts: result.status === 'REOPENED' ? result.counts : result.plan.counts,
      sideEffects: result.status === 'REOPENED' ? result.sideEffects : result.plan.sideEffects,
    }));
    return result.status === 'REOPENED' ? 0 : 1;
  } catch (error) {
    const code = error instanceof ManualBookingReopenError ? error.code : 'REOPEN_FAILED';
    const detail = error instanceof ManualBookingReopenError
      ? error.message
      : 'The guarded reopen operation failed without exposing internal details.';
    input.write(JSON.stringify(failure(code, detail)));
    return 1;
  } finally {
    if (disconnect) await disconnect();
  }
};

const main = async () => {
  loadEnvConfig(process.cwd());
  const exitCode = await runLatestManualBookingReopenCli({
    args: process.argv.slice(2),
    env: process.env,
    createDb: async () => {
      const { prisma } = await import('../prismaClient');
      return { db: prisma, disconnect: () => prisma.$disconnect() };
    },
    write: (value) => process.stdout.write(`${value}\n`),
  });
  process.exitCode = exitCode;
};

if (process.argv[1]?.includes('runLatestManualBookingReopen')) {
  void main();
}
