import { describe, expect, it, vi } from 'vitest';
import { runPrismaMigrationCommand } from '../../scripts/prisma-migration.mjs';

const runtimeUrl = 'postgresql://runtime:runtime-secret@db.internal:5432/finance';
const migrationUrl = 'postgresql://owner:owner-secret@db.internal:5432/finance';

const successResult = { status: 0, signal: null, error: undefined };

describe('prisma migration runner', () => {
  it('maps MIGRATION_DATABASE_URL to DATABASE_URL without exposing it to Prisma as a second variable', () => {
    const spawnSyncImpl = vi.fn(() => successResult as never);
    const log = vi.fn();
    const code = runPrismaMigrationCommand({
      env: { DATABASE_URL: runtimeUrl, MIGRATION_DATABASE_URL: migrationUrl },
      args: ['status', '--require-privileged'],
      spawnSyncImpl,
      root: '/app',
      log,
    });

    expect(code).toBe(0);
    const options = spawnSyncImpl.mock.calls[0][2] as { env: NodeJS.ProcessEnv; shell: boolean };
    expect(options.env.DATABASE_URL).toBe(migrationUrl);
    expect(options.env.MIGRATION_DATABASE_URL).toBeUndefined();
    expect(options.shell).toBe(false);
    expect(log.mock.calls.flat().join(' ')).not.toContain(migrationUrl);
  });

  it('falls back to DATABASE_URL when privileged credentials are optional', () => {
    const spawnSyncImpl = vi.fn(() => successResult as never);
    const code = runPrismaMigrationCommand({
      env: { DATABASE_URL: runtimeUrl },
      args: ['status'],
      spawnSyncImpl,
      root: '/app',
      log: vi.fn(),
    });

    expect(code).toBe(0);
    const options = spawnSyncImpl.mock.calls[0][2] as { env: NodeJS.ProcessEnv };
    expect(options.env.DATABASE_URL).toBe(runtimeUrl);
  });

  it('refuses privileged production operations when MIGRATION_DATABASE_URL is absent', () => {
    const spawnSyncImpl = vi.fn(() => successResult as never);
    const errorLog = vi.fn();
    const code = runPrismaMigrationCommand({
      env: { DATABASE_URL: runtimeUrl },
      args: ['deploy', '--require-privileged'],
      spawnSyncImpl,
      root: '/app',
      errorLog,
    });

    expect(code).toBe(3);
    expect(spawnSyncImpl).not.toHaveBeenCalled();
    expect(errorLog.mock.calls.flat().join(' ')).not.toContain(runtimeUrl);
  });

  it('supports only fixed status, deploy, and rolled-back resolution commands', () => {
    const spawnSyncImpl = vi.fn(() => successResult as never);
    const code = runPrismaMigrationCommand({
      env: { DATABASE_URL: runtimeUrl, MIGRATION_DATABASE_URL: migrationUrl },
      args: ['resolve-rolled-back', '20260806202030_add_delivery_key_idempotency', '--require-privileged'],
      spawnSyncImpl,
      root: '/app',
      log: vi.fn(),
    });

    expect(code).toBe(0);
    expect(spawnSyncImpl.mock.calls[0][1]).toEqual([
      '/app/node_modules/prisma/build/index.js',
      'migrate',
      'resolve',
      '--rolled-back',
      '20260806202030_add_delivery_key_idempotency',
    ]);
  });
});
