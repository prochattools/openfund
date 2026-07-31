import { loadEnvConfig } from '@next/env';
import { auditHistoricalTransactionTypeDirections } from '../services/transactionTypeDirectionUsageAuditService';
import { buildOwnerHistoryProposalPlan } from '../services/ownerHistoryProposalEvidenceService';

const failure = (errorCode: string) => ({ ok: false as const, errorCode });

export const runDirectionNeutralHistoryDryRunCli = async (input: {
  args: string[];
  env: NodeJS.ProcessEnv;
  createDb: () => Promise<{ db: Parameters<typeof buildOwnerHistoryProposalPlan>[0]; disconnect: () => Promise<void> }>;
  write: (value: string) => void;
}): Promise<number> => {
  if (!input.args.includes('--read-only')) {
    input.write(JSON.stringify(failure('READ_ONLY_ACKNOWLEDGEMENT_REQUIRED')));
    return 2;
  }
  if (!input.env.DATABASE_URL?.trim() || !input.env.DEFAULT_WORKSPACE_ID?.trim()) {
    input.write(JSON.stringify(failure('DATABASE_OR_WORKSPACE_REQUIRED')));
    return 2;
  }

  let disconnect: (() => Promise<void>) | null = null;
  try {
    const connection = await input.createDb();
    disconnect = connection.disconnect;
    const workspaceId = input.env.DEFAULT_WORKSPACE_ID;
    const [auditFirst, planFirst] = await Promise.all([
      auditHistoricalTransactionTypeDirections(connection.db as never, { workspaceId }),
      buildOwnerHistoryProposalPlan(connection.db, { workspaceId }),
    ]);
    const [auditReplay, planReplay] = await Promise.all([
      auditHistoricalTransactionTypeDirections(connection.db as never, { workspaceId }),
      buildOwnerHistoryProposalPlan(connection.db, { workspaceId }),
    ]);
    if (auditFirst.reportHash !== auditReplay.reportHash || planFirst.planHash !== planReplay.planHash) {
      input.write(JSON.stringify(failure('NONDETERMINISTIC_REPLAY')));
      return 1;
    }
    input.write(JSON.stringify({
      ok: true,
      dryRun: true,
      writesPerformed: false,
      audit: {
        algorithmVersion: auditFirst.algorithmVersion,
        reportHash: auditFirst.reportHash,
        totals: auditFirst.totals,
        buckets: auditFirst.buckets,
      },
      proposals: {
        algorithmVersion: planFirst.algorithmVersion,
        planHash: planFirst.planHash,
        counts: planFirst.counts,
        matcherDistribution: planFirst.matcherDistribution,
        confidenceDistribution: planFirst.confidenceDistribution,
        persistence: planFirst.persistence,
      },
      replay: { auditReportHashMatches: true, planHashMatches: true },
      sideEffects: {
        createsTransactionBooking: false,
        createsReviewDecision: false,
        mutatesBankFacts: false,
        mutatesConfirmedHistory: false,
        mutatesSuggestions: false,
      },
    }));
    return 0;
  } catch {
    input.write(JSON.stringify(failure('DIRECTION_NEUTRAL_DRY_RUN_FAILED')));
    return 1;
  } finally {
    if (disconnect) await disconnect();
  }
};

const main = async () => {
  loadEnvConfig(process.cwd());
  const exitCode = await runDirectionNeutralHistoryDryRunCli({
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

if (require.main === module) void main();
