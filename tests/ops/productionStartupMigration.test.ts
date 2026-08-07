import { EventEmitter } from 'node:events';
import { describe, expect, it, vi } from 'vitest';
import {
  buildProductionCommands,
  runProductionStartup,
} from '../../scripts/start-prod.mjs';

class MockChild extends EventEmitter {
  killed = false;
  kill = vi.fn((signal?: NodeJS.Signals) => {
    this.killed = true;
    this.emit('killed', signal);
    return true;
  });
}

type SpawnCall = {
  command: string;
  args: string[];
  options: Record<string, unknown>;
  child: MockChild;
};

const createSpawnHarness = () => {
  const calls: SpawnCall[] = [];
  const spawnImpl = vi.fn((command: string, args: string[], options: Record<string, unknown>) => {
    const child = new MockChild();
    calls.push({ command, args, options, child });
    return child as never;
  });
  return { calls, spawnImpl };
};

const validEnv = {
  DATABASE_URL: 'postgresql://finance_user:secret-value@db.internal:5432/finance',
  PORT: '3000',
};

const privilegedEnv = {
  ...validEnv,
  MIGRATION_DATABASE_URL: 'postgresql://migration_owner:owner-secret@db.internal:5432/finance',
};

describe('production startup migration gate', () => {
  it('builds a shell-free Prisma migrate deploy command', () => {
    const commands = buildProductionCommands({ root: '/app', port: '3000' });

    expect(commands.migration.args).toEqual([
      '/app/node_modules/prisma/build/index.js',
      'migrate',
      'deploy',
    ]);
  });

  it('starts neither API nor web while migration is running', async () => {
    const { calls, spawnImpl } = createSpawnHarness();
    const startup = runProductionStartup({
      env: validEnv,
      spawnImpl,
      root: '/app',
      registerSignalHandlers: false,
    });

    await Promise.resolve();
    expect(calls).toHaveLength(1);
    expect(calls[0].args).toContain('migrate');
    expect(calls[0].options.shell).toBe(false);

    calls[0].child.emit('exit', 0, null);
    await startup;

    expect(calls).toHaveLength(3);
    expect(calls[1].args).toEqual(['/app/dist/server/index.js']);
    expect(calls[2].args).toEqual([
      '/app/node_modules/next/dist/bin/next',
      'start',
      '-p',
      '3000',
    ]);
  });

  it('uses MIGRATION_DATABASE_URL only for the migration child', async () => {
    const { calls, spawnImpl } = createSpawnHarness();
    const startup = runProductionStartup({
      env: privilegedEnv,
      spawnImpl,
      root: '/app',
      registerSignalHandlers: false,
    });

    await Promise.resolve();
    const migrationEnv = calls[0].options.env as NodeJS.ProcessEnv;
    expect(migrationEnv.DATABASE_URL).toBe(privilegedEnv.MIGRATION_DATABASE_URL);
    expect(migrationEnv.MIGRATION_DATABASE_URL).toBeUndefined();

    calls[0].child.emit('exit', 0, null);
    await startup;

    const apiEnv = calls[1].options.env as NodeJS.ProcessEnv;
    const webEnv = calls[2].options.env as NodeJS.ProcessEnv;
    expect(apiEnv.DATABASE_URL).toBe(validEnv.DATABASE_URL);
    expect(webEnv.DATABASE_URL).toBe(validEnv.DATABASE_URL);
    expect(apiEnv.MIGRATION_DATABASE_URL).toBeUndefined();
    expect(webEnv.MIGRATION_DATABASE_URL).toBeUndefined();
  });

  it('falls back to DATABASE_URL for migrations when MIGRATION_DATABASE_URL is absent', async () => {
    const { calls, spawnImpl } = createSpawnHarness();
    const startup = runProductionStartup({
      env: validEnv,
      spawnImpl,
      root: '/app',
      registerSignalHandlers: false,
    });

    await Promise.resolve();
    const migrationEnv = calls[0].options.env as NodeJS.ProcessEnv;
    expect(migrationEnv.DATABASE_URL).toBe(validEnv.DATABASE_URL);

    calls[0].child.emit('exit', 0, null);
    await startup;
  });

  it('fails closed when migration exits non-zero', async () => {
    const { calls, spawnImpl } = createSpawnHarness();
    const startup = runProductionStartup({
      env: validEnv,
      spawnImpl,
      root: '/app',
      registerSignalHandlers: false,
    });

    await Promise.resolve();
    calls[0].child.emit('exit', 1, null);

    await expect(startup).rejects.toThrow('Prisma migration failed with code 1');
    expect(calls).toHaveLength(1);
  });

  it('fails closed when migration cannot start', async () => {
    const { calls, spawnImpl } = createSpawnHarness();
    const startup = runProductionStartup({
      env: validEnv,
      spawnImpl,
      root: '/app',
      registerSignalHandlers: false,
    });

    await Promise.resolve();
    calls[0].child.emit('error', new Error('spawn failed'));

    await expect(startup).rejects.toThrow('Prisma migration failed to start');
    expect(calls).toHaveLength(1);
  });

  it('requires DATABASE_URL before spawning any process', async () => {
    const { calls, spawnImpl } = createSpawnHarness();

    await expect(
      runProductionStartup({
        env: { PORT: '3000' },
        spawnImpl,
        root: '/app',
        registerSignalHandlers: false,
      })
    ).rejects.toThrow('DATABASE_URL is required');

    expect(calls).toHaveLength(0);
  });

  it('does not log DATABASE_URL and preserves shutdown behavior', async () => {
    const { calls, spawnImpl } = createSpawnHarness();
    const log = vi.fn();
    const errorLog = vi.fn();
    const exitImpl = vi.fn();
    const setTimeoutImpl = vi.fn((callback: () => void) => {
      callback();
      return 0 as never;
    });

    const startup = runProductionStartup({
      env: privilegedEnv,
      spawnImpl,
      root: '/app',
      registerSignalHandlers: false,
      log,
      errorLog,
      exitImpl,
      setTimeoutImpl,
    });

    await Promise.resolve();
    calls[0].child.emit('exit', 0, null);
    await startup;

    calls[1].child.emit('exit', 1, null);

    expect(exitImpl).toHaveBeenCalledWith(1);
    expect(calls[2].child.kill).toHaveBeenCalledWith('SIGTERM');
    const output = [...log.mock.calls, ...errorLog.mock.calls].flat().join(' ');
    expect(output).not.toContain(validEnv.DATABASE_URL);
    expect(output).not.toContain(privilegedEnv.MIGRATION_DATABASE_URL);
    expect(calls.every((call) => call.options.shell === false)).toBe(true);
  });
});
