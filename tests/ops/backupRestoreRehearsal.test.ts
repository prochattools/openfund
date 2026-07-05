/**
 * OPS-002 — Backup/restore rehearsal guards and command construction tests.
 *
 * All tests are pure unit tests — no database connections, no production access.
 * Guards ensure that no non-local host can be used in rehearsal operations.
 */

import { describe, expect, it } from 'vitest';

// Import the guard functions from the rehearsal script.
// Using a dynamic import with the file:// protocol to load the ESM module.
import { execSync } from 'child_process';
import {
  parseDbUrl,
  assertLocalDbUrl,
  buildDumpCommand,
  buildRestoreCommand,
} from '../../scripts/backup-restore-rehearsal.mjs';

// ─── parseDbUrl ───────────────────────────────────────────────────────────────

describe('backup restore rehearsal — parseDbUrl', () => {
  it('parses a valid localhost URL', () => {
    const result = parseDbUrl('postgresql://finance_user:secret@localhost:5432/finance_test');
    expect(result).toMatchObject({ host: 'localhost', port: '5432', database: 'finance_test' });
  });

  it('parses a 127.0.0.1 URL', () => {
    const result = parseDbUrl('postgresql://finance_user:secret@127.0.0.1:5452/rehearsal_db');
    expect(result).toMatchObject({ host: '127.0.0.1', port: '5452', database: 'rehearsal_db' });
  });

  it('parses a ::1 IPv6 URL', () => {
    const result = parseDbUrl('postgresql://finance_user:secret@[::1]:5432/rehearsal_db');
    // The URL API returns '[::1]' (with brackets) for IPv6 addresses
    expect(result).toMatchObject({ host: '[::1]', port: '5432', database: 'rehearsal_db' });
  });

  it('returns null for an invalid URL', () => {
    const result = parseDbUrl('not-a-url');
    expect(result).toBeNull();
  });
});

// ─── assertLocalDbUrl guards ──────────────────────────────────────────────────

describe('backup restore rehearsal — assertLocalDbUrl', () => {
  it('accepts localhost', () => {
    expect(() =>
      assertLocalDbUrl('postgresql://u:p@localhost:5432/yaf_rehearsal_bron_123')
    ).not.toThrow();
  });

  it('accepts 127.0.0.1', () => {
    expect(() =>
      assertLocalDbUrl('postgresql://u:p@127.0.0.1:5432/yaf_rehearsal_bron_123')
    ).not.toThrow();
  });

  it('accepts ::1', () => {
    expect(() =>
      assertLocalDbUrl('postgresql://u:p@[::1]:5432/yaf_rehearsal_bron_123')
    ).not.toThrow();
  });

  it('blocks 10.0.2.4', () => {
    expect(() =>
      assertLocalDbUrl('postgresql://u:p@10.0.2.4:5432/finance')
    ).toThrow('GUARD');
  });

  it('blocks a non-local hostname', () => {
    expect(() =>
      assertLocalDbUrl('postgresql://u:p@db.example.com:5432/finance')
    ).toThrow('GUARD');
  });

  it('blocks an invalid/missing URL', () => {
    expect(() =>
      assertLocalDbUrl('')
    ).toThrow('GUARD');
  });

  it('blocks a URL with no database name', () => {
    expect(() =>
      assertLocalDbUrl('postgresql://u:p@localhost:5432/')
    ).toThrow('GUARD');
  });

  it('blocks a production-like database name "finance" on localhost', () => {
    expect(() =>
      assertLocalDbUrl('postgresql://u:p@localhost:5432/finance')
    ).toThrow('GUARD');
  });

  it('blocks a database name containing "prod"', () => {
    expect(() =>
      assertLocalDbUrl('postgresql://u:p@localhost:5432/finance_prod')
    ).toThrow('GUARD');
  });

  it('allows a rehearsal-prefixed database on localhost', () => {
    expect(() =>
      assertLocalDbUrl('postgresql://u:p@localhost:5432/yaf_rehearsal_bron_1234567890')
    ).not.toThrow();
  });
});

// ─── Command construction ─────────────────────────────────────────────────────

describe('backup restore rehearsal — buildDumpCommand', () => {
  it('builds a pg_dump command with all required flags', () => {
    const cmd = buildDumpCommand({
      host: '127.0.0.1',
      port: '5432',
      username: 'finance_user',
      database: 'yaf_rehearsal_bron_123',
      outputFile: 'dump.dump',
    });

    expect(cmd).toContain('pg_dump');
    expect(cmd).toContain('--host=127.0.0.1');
    expect(cmd).toContain('--port=5432');
    expect(cmd).toContain('--username=finance_user');
    expect(cmd).toContain('--format=custom');
    expect(cmd).toContain('--file=dump.dump');
    expect(cmd).toContain('yaf_rehearsal_bron_123');
  });

  it('does not embed a password in the dump command', () => {
    const cmd = buildDumpCommand({
      host: '127.0.0.1',
      port: '5432',
      username: 'finance_user',
      database: 'yaf_rehearsal_bron_123',
      outputFile: 'dump.dump',
    });

    expect(cmd).not.toContain('local_dev_placeholder');
    expect(cmd).not.toContain('password');
  });
});

describe('backup restore rehearsal — buildRestoreCommand', () => {
  it('builds a pg_restore command with all required flags', () => {
    const cmd = buildRestoreCommand({
      host: '127.0.0.1',
      port: '5432',
      username: 'finance_user',
      targetDatabase: 'yaf_rehearsal_tgt_123',
      inputFile: 'dump.dump',
    });

    expect(cmd).toContain('pg_restore');
    expect(cmd).toContain('--host=127.0.0.1');
    expect(cmd).toContain('--port=5432');
    expect(cmd).toContain('--username=finance_user');
    expect(cmd).toContain('--dbname=yaf_rehearsal_tgt_123');
    expect(cmd).toContain('--no-owner');
    expect(cmd).toContain('dump.dump');
  });

  it('does not embed a password in the restore command', () => {
    const cmd = buildRestoreCommand({
      host: '127.0.0.1',
      port: '5432',
      username: 'finance_user',
      targetDatabase: 'yaf_rehearsal_tgt_123',
      inputFile: 'dump.dump',
    });

    expect(cmd).not.toContain('local_dev_placeholder');
    expect(cmd).not.toContain('password');
  });
});

// ─── Dry-run mode ─────────────────────────────────────────────────────────────

describe('backup restore rehearsal — dry-run mode', () => {
  it('dry-run command exits 0 without a running PostgreSQL server', () => {
    const result = execSync(
      'node scripts/backup-restore-rehearsal.mjs --dry-run',
      { encoding: 'utf-8', cwd: process.cwd() },
    );
    expect(result).toContain('[rehearsal]');
    expect(result).toContain('dry-run');
  });

  it('dry-run output redacts PGPASSWORD secrets', () => {
    const result = execSync(
      'node scripts/backup-restore-rehearsal.mjs --dry-run',
      { encoding: 'utf-8', cwd: process.cwd() },
    );
    expect(result).not.toContain('local_dev_placeholder');
    expect(result).not.toMatch(/PGPASSWORD=[^*]/);
  });

  it('dry-run uses yaf_rehearsal_* database names for source and target', () => {
    const result = execSync(
      'node scripts/backup-restore-rehearsal.mjs --dry-run',
      { encoding: 'utf-8', cwd: process.cwd() },
    );
    expect(result).toMatch(/yaf_rehearsal_src_\d+/);
    expect(result).toMatch(/yaf_rehearsal_tgt_\d+/);
  });

  it('dry-run uses postgres maintenance database for psql admin commands', () => {
    const result = execSync(
      'node scripts/backup-restore-rehearsal.mjs --dry-run',
      { encoding: 'utf-8', cwd: process.cwd() },
    );
    expect(result).toContain('/postgres');
    expect(result).not.toContain('/finance -c');
  });

  it('production-like database names remain rejected by the guard', () => {
    expect(() =>
      assertLocalDbUrl('postgresql://u:p@localhost:5432/finance')
    ).toThrow('GUARD');

    expect(() =>
      assertLocalDbUrl('postgresql://u:p@localhost:5432/finance_production')
    ).toThrow('GUARD');
  });

  it('non-local hosts remain rejected', () => {
    expect(() =>
      assertLocalDbUrl('postgresql://u:p@10.0.2.4:5432/yaf_rehearsal_test')
    ).toThrow('GUARD');

    expect(() =>
      assertLocalDbUrl('postgresql://u:p@db.dokploy.internal:5432/yaf_rehearsal_test')
    ).toThrow('GUARD');
  });

  it('dump and restore command construction is deterministic', () => {
    const dumpA = buildDumpCommand({
      host: '127.0.0.1', port: '5432', username: 'finance_user',
      database: 'yaf_rehearsal_src_0000000000',
      outputFile: 'yaf_rehearsal_dump_0000000000.dump',
    });
    const dumpB = buildDumpCommand({
      host: '127.0.0.1', port: '5432', username: 'finance_user',
      database: 'yaf_rehearsal_src_0000000000',
      outputFile: 'yaf_rehearsal_dump_0000000000.dump',
    });
    expect(dumpA).toBe(dumpB);

    const restoreA = buildRestoreCommand({
      host: '127.0.0.1', port: '5432', username: 'finance_user',
      targetDatabase: 'yaf_rehearsal_tgt_0000000000',
      inputFile: 'yaf_rehearsal_dump_0000000000.dump',
    });
    const restoreB = buildRestoreCommand({
      host: '127.0.0.1', port: '5432', username: 'finance_user',
      targetDatabase: 'yaf_rehearsal_tgt_0000000000',
      inputFile: 'yaf_rehearsal_dump_0000000000.dump',
    });
    expect(restoreA).toBe(restoreB);
  });
});
