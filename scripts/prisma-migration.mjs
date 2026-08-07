#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const migrationNamePattern = /^\d{14}_[A-Za-z0-9_]+$/;

export const runPrismaMigrationCommand = ({
  env = process.env,
  args = process.argv.slice(2),
  spawnSyncImpl = spawnSync,
  root = projectRoot,
  log = console.log,
  errorLog = console.error,
} = {}) => {
  const filteredArgs = args.filter((arg) => !arg.startsWith('dotenv_config_'));
  const requirePrivileged = filteredArgs.includes('--require-privileged');
  const commandArgs = filteredArgs.filter((arg) => arg !== '--require-privileged');
  const operation = commandArgs[0];
  const migrationName = commandArgs[1];

  const runtimeUrl = env.DATABASE_URL?.trim();
  const privilegedUrl = env.MIGRATION_DATABASE_URL?.trim();
  const migrationUrl = privilegedUrl || runtimeUrl;
  if (!migrationUrl) {
    errorLog('DATABASE_URL is required for Prisma migration commands.');
    return 2;
  }
  if (requirePrivileged && !privilegedUrl) {
    errorLog('MIGRATION_DATABASE_URL is required for this production migration operation.');
    return 3;
  }

  let prismaArgs;
  if (operation === 'status' && commandArgs.length === 1) {
    prismaArgs = ['migrate', 'status'];
  } else if (operation === 'deploy' && commandArgs.length === 1) {
    prismaArgs = ['migrate', 'deploy'];
  } else if (
    operation === 'resolve-rolled-back'
    && commandArgs.length === 2
    && migrationNamePattern.test(migrationName ?? '')
  ) {
    prismaArgs = ['migrate', 'resolve', '--rolled-back', migrationName];
  } else {
    errorLog('Unsupported migration operation.');
    return 2;
  }

  const childEnv = { ...env, DATABASE_URL: migrationUrl };
  delete childEnv.MIGRATION_DATABASE_URL;
  const result = spawnSyncImpl(
    process.execPath,
    [path.join(root, 'node_modules', 'prisma', 'build', 'index.js'), ...prismaArgs],
    {
      cwd: root,
      env: childEnv,
      stdio: 'inherit',
      shell: false,
    },
  );

  if (result.error) {
    errorLog('Prisma migration command failed to start.');
    return 1;
  }
  if (result.status !== 0) {
    return result.status ?? 1;
  }
  log(privilegedUrl ? 'Prisma migration command completed with privileged migration credentials.' : 'Prisma migration command completed with runtime database credentials.');
  return 0;
};

if (process.argv[1] === __filename) {
  process.exitCode = runPrismaMigrationCommand();
}
