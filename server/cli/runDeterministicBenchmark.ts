import { loadEnvConfig } from '@next/env';
import {
  DeterministicBenchmarkRunnerError,
  runDeterministicBenchmark,
  type DeterministicBenchmarkRunnerOutput,
} from '../services/deterministicBenchmarkRunnerService';

export type BenchmarkCliDependencies = {
  createDb: () => Promise<{ db: Parameters<typeof runDeterministicBenchmark>[0]['db']; disconnect: () => Promise<void> }>;
  execute: typeof runDeterministicBenchmark;
  write: (value: string) => void;
};

const failure = (errorCode: string) => ({ ok: false as const, errorCode });

export const runDeterministicBenchmarkCli = async (input: {
  args: string[];
  env: NodeJS.ProcessEnv;
  dependencies: BenchmarkCliDependencies;
}): Promise<number> => {
  if (!input.args.includes('--read-only')) {
    input.dependencies.write(JSON.stringify(failure('READ_ONLY_ACKNOWLEDGEMENT_REQUIRED')));
    return 2;
  }
  if (!input.env.DATABASE_URL?.trim()) {
    input.dependencies.write(JSON.stringify(failure('DATABASE_URL_REQUIRED')));
    return 2;
  }
  let disconnect: (() => Promise<void>) | null = null;
  try {
    const connection = await input.dependencies.createDb();
    disconnect = connection.disconnect;
    const result: DeterministicBenchmarkRunnerOutput = await input.dependencies.execute({
      db: connection.db,
    });
    input.dependencies.write(JSON.stringify({ ok: true, ...result }));
    return 0;
  } catch (error) {
    const errorCode = error instanceof DeterministicBenchmarkRunnerError
      ? error.code
      : 'BENCHMARK_EXECUTION_FAILED';
    input.dependencies.write(JSON.stringify(failure(errorCode)));
    return 1;
  } finally {
    if (disconnect) await disconnect();
  }
};

const main = async () => {
  loadEnvConfig(process.cwd());
  const exitCode = await runDeterministicBenchmarkCli({
    args: process.argv.slice(2),
    env: process.env,
    dependencies: {
      createDb: async () => {
        const { prisma } = await import('../prismaClient');
        return { db: prisma, disconnect: () => prisma.$disconnect() };
      },
      execute: runDeterministicBenchmark,
      write: (value) => process.stdout.write(`${value}\n`),
    },
  });
  process.exitCode = exitCode;
};

if (require.main === module) {
  void main();
}
