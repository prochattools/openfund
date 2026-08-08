#!/usr/bin/env node
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

export const buildProductionCommands = ({ root = projectRoot, port = process.env.PORT ?? '3000' } = {}) => ({
  migration: {
    name: 'migration',
    command: process.execPath,
    args: [path.join(root, 'node_modules', 'prisma', 'build', 'index.js'), 'migrate', 'deploy'],
  },
  api: {
    name: 'api',
    command: process.execPath,
    args: [path.join(root, 'dist', 'server', 'index.js')],
  },
  web: {
    name: 'web',
    command: process.execPath,
    args: [path.join(root, 'node_modules', 'next', 'dist', 'bin', 'next'), 'start', '-p', port],
  },
});

export const runProductionStartup = async ({
  env = process.env,
  spawnImpl = spawn,
  root = projectRoot,
  exitImpl = (code) => process.exit(code),
  log = console.log,
  errorLog = console.error,
  setTimeoutImpl = setTimeout,
  registerSignalHandlers = true,
} = {}) => {
  const databaseUrl = env.DATABASE_URL?.trim();
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required before production startup.');
  }
  const migrationDatabaseUrl = env.MIGRATION_DATABASE_URL?.trim() || databaseUrl;

  const runtimeEnv = { ...env, DATABASE_URL: databaseUrl };
  delete runtimeEnv.MIGRATION_DATABASE_URL;
  if (!runtimeEnv.NEW_RELIC_LICENSE_KEY?.trim()) {
    delete runtimeEnv.NODE_OPTIONS;
  }
  const migrationEnv = { ...runtimeEnv, DATABASE_URL: migrationDatabaseUrl };

  const commands = buildProductionCommands({ root, port: env.PORT ?? '3000' });
  const processes = [];
  let shuttingDown = false;

  const shutdown = (code = 0) => {
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;
    processes.forEach((child) => {
      if (!child.killed) {
        child.kill('SIGTERM');
      }
    });
    setTimeoutImpl(() => exitImpl(code), 500);
  };

  if (registerSignalHandlers) {
    process.on('SIGTERM', () => shutdown(0));
    process.on('SIGINT', () => shutdown(0));
  }

  const spawnProcess = ({ name, command, args }, { track = true, childEnv = runtimeEnv } = {}) => {
    const child = spawnImpl(command, args, {
      cwd: root,
      env: childEnv,
      stdio: 'inherit',
      shell: false,
    });
    if (track) {
      processes.push(child);
    }
    return child;
  };

  const migration = spawnProcess(commands.migration, { childEnv: migrationEnv });
  await new Promise((resolve, reject) => {
    migration.once('error', () => reject(new Error('Prisma migration failed to start.')));
    migration.once('exit', (code, signal) => {
      if (code === 0 && !signal) {
        resolve();
        return;
      }
      reject(new Error(`Prisma migration failed with code ${code ?? 'null'}${signal ? ` after ${signal}` : ''}.`));
    });
  });

  try {
    const { PrismaClient } = await import('@prisma/client');
    const db = new PrismaClient();
    const users = await db.user.findMany({ select: { id: true, email: true, isActive: true } });
    log(`[startup-diag] users=${JSON.stringify(users)}`);
    await db.$disconnect();
  } catch (e) {
    log(`[startup-diag] error=${e.message}`);
  }

  const startLongRunningProcess = (definition) => {
    const child = spawnProcess(definition);
    child.on('exit', (code, signal) => {
      const reason = signal
        ? `${definition.name} exited after receiving ${signal}`
        : `${definition.name} exited with code ${code ?? 0}`;
      log(reason);
      shutdown(code ?? (signal ? 1 : 0));
    });
    child.on('error', () => {
      errorLog(`${definition.name} failed to start`);
      shutdown(1);
    });
  };

  startLongRunningProcess(commands.api);
  startLongRunningProcess(commands.web);

  return { shutdown };
};

const isMain = process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;
if (isMain) {
  runProductionStartup().catch((error) => {
    console.error(error instanceof Error ? error.message : 'Production startup failed.');
    process.exit(1);
  });
}
