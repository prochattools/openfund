import { loadEnvConfig } from '@next/env';
import {
  buildOwnerHistoryProposalPlan,
  executeOwnerHistoryProposalPlan,
} from '../services/ownerHistoryProposalEvidenceService';

const failure = (errorCode: string, detail?: string) => ({ ok: false as const, errorCode, detail });

export const runOwnerHistoryProposalExecuteCli = async (input: {
  args: string[];
  env: NodeJS.ProcessEnv;
  createDb: () => Promise<{ db: Parameters<typeof buildOwnerHistoryProposalPlan>[0]; disconnect: () => Promise<void> }>;
  write: (value: string) => void;
}): Promise<number> => {
  const isDryRun = !input.args.includes('--execute');
  const confirmedHash = (() => {
    const idx = input.args.indexOf('--confirmed-hash');
    return idx >= 0 ? (input.args[idx + 1] ?? null) : null;
  })();

  if (!input.env.DATABASE_URL?.trim() || !input.env.DEFAULT_WORKSPACE_ID?.trim() || !input.env.DEFAULT_USER_ID?.trim()) {
    input.write(JSON.stringify(failure('DATABASE_OR_WORKSPACE_REQUIRED')));
    return 2;
  }
  if (!isDryRun && !confirmedHash) {
    input.write(JSON.stringify(failure('CONFIRMED_HASH_REQUIRED', 'Pass --confirmed-hash <hash> copied from the dry-run output to execute.')));
    return 2;
  }

  let disconnect: (() => Promise<void>) | null = null;
  try {
    const connection = await input.createDb();
    disconnect = connection.disconnect;
    const workspaceId = input.env.DEFAULT_WORKSPACE_ID;
    const userId = input.env.DEFAULT_USER_ID;

    if (isDryRun) {
      const plan = await buildOwnerHistoryProposalPlan(connection.db, { workspaceId, userId });
      const replay = await buildOwnerHistoryProposalPlan(connection.db, { workspaceId, userId });
      if (plan.planHash !== replay.planHash) {
        input.write(JSON.stringify(failure('NONDETERMINISTIC_REPLAY')));
        return 1;
      }
      input.write(JSON.stringify({
        ok: true,
        dryRun: true,
        writesPerformed: false,
        algorithmVersion: plan.algorithmVersion,
        planHash: plan.planHash,
        counts: plan.counts,
        matcherDistribution: plan.matcherDistribution,
        confidenceDistribution: plan.confidenceDistribution,
        persistence: plan.persistence,
        provenanceProof: plan.provenanceProof,
        sideEffects: plan.sideEffects,
        nextStep: `To execute: pass --execute --confirmed-hash ${plan.planHash}`,
      }));
      return 0;
    }

    const result = await executeOwnerHistoryProposalPlan(connection.db, {
      workspaceId,
      userId,
      execute: true,
      executionAllowed: true,
      confirmedPlanHash: confirmedHash,
    });

    const exitCode = result.status === 'CREATED' ? 0
      : result.status === 'HASH_DRIFT' ? 1
      : result.status === 'EXECUTION_NOT_ALLOWED' ? 1
      : result.status === 'CONFIRMATION_REQUIRED' ? 2
      : 0;

    input.write(JSON.stringify({
      ok: result.status === 'CREATED',
      status: result.status,
      dryRun: result.dryRun,
      writesPerformed: result.writesPerformed,
      expiredSuggestionCount: result.expiredSuggestionCount,
      createdSuggestionCount: result.createdSuggestionCount,
      algorithmVersion: result.plan.algorithmVersion,
      planHash: result.plan.planHash,
      counts: result.plan.counts,
      matcherDistribution: result.plan.matcherDistribution,
      confidenceDistribution: result.plan.confidenceDistribution,
      persistence: result.plan.persistence,
      sideEffects: result.sideEffects,
    }));
    return exitCode;
  } catch (err) {
    input.write(JSON.stringify(failure('EXECUTE_FAILED', String(err))));
    return 1;
  } finally {
    if (disconnect) await disconnect();
  }
};

const main = async () => {
  loadEnvConfig(process.cwd());
  const exitCode = await runOwnerHistoryProposalExecuteCli({
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
