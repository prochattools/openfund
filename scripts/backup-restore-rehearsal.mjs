/**
 * Local-only backup/restore rehearsal for Yeshua Academy Finance.
 *
 * Guards:
 * - Rejects any non-local database host.
 * - Rejects 10.0.2.4, Dokploy hosts, and production-like database names.
 * - Never prints secrets.
 * - Never connects to a production database.
 * - Creates and drops only disposable databases named yaf_rehearsal_*.
 *
 * SAFE DEFAULT: No arguments → prints help and exits 1. No DB commands run.
 *
 * Usage:
 *   node scripts/backup-restore-rehearsal.mjs --help
 *   node scripts/backup-restore-rehearsal.mjs --dry-run
 *   node scripts/backup-restore-rehearsal.mjs --live-local --confirm-disposable
 */

import { execSync } from 'child_process';
import { existsSync, unlinkSync } from 'fs';
import { statSync } from 'fs';

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

const BLOCKED_HOSTS = [
  '10.0.2.4',
  'dokploy',
  '.internal',
  '.prod',
  '.production',
];

const BLOCKED_DB_PATTERNS = [
  /^finance$/i,
  /prod/i,
  /production/i,
  /live/i,
];

const REHEARSAL_DB_PREFIX = 'yaf_rehearsal_';

const HELP_TEXT = `
Yeshua Academy Finance — Backup/Restore Rehearsal Script
=========================================================

VEILIG GEBRUIK / SAFE USAGE:

  --help                          Toon dit helpscherm en sluit af (exit 0)
  --dry-run                       Guard-check zonder databaseverbinding (exit 0)
  --live-local --confirm-disposable  Live rehearsal op lokale wegwerpdatabases

STANDAARD GEDRAG / DEFAULT BEHAVIOR:
  Geen argumenten → dit helpscherm + exit 1 (VEILIG, geen DB-commando's uitgevoerd)

VEREISTEN VOOR --live-local:
  - Beide vlaggen --live-local EN --confirm-disposable zijn verplicht
  - Host moet localhost, 127.0.0.1, of ::1 zijn
  - Databases worden aangemaakt als yaf_rehearsal_* (wegwerp)
  - Productiehosts (10.0.2.4, Dokploy, externe hosts) worden geblokkeerd
  - Productieachtige databasenamen worden geblokkeerd

VERBODEN / FORBIDDEN:
  - 10.0.2.4, Dokploy, externe hosts
  - Databases: finance, *prod*, *production*, *live* (zonder rehearsal-prefix)
  - Productieconfiguratie aanraken
  - .env lezen of wijzigen

SAFE STARTING POINT:
  node scripts/backup-restore-rehearsal.mjs --dry-run
`.trim();

/**
 * Parse a PostgreSQL connection URL and extract host and database name.
 * Never logs the password.
 */
export function parseDbUrl(url) {
  try {
    const u = new URL(url);
    return { host: u.hostname, port: u.port || '5432', database: u.pathname.slice(1) };
  } catch {
    return null;
  }
}

/**
 * Assert that the database URL is local-only and safe to use.
 * Throws a descriptive error if any guard fails.
 */
export function assertLocalDbUrl(url) {
  const parsed = parseDbUrl(url);

  if (!parsed) {
    throw new Error('GUARD: Invalid or missing database URL.');
  }

  const { host, database } = parsed;

  if (!LOCAL_HOSTS.has(host)) {
    throw new Error(`GUARD: Non-local host "${host}" rejected. Only localhost/127.0.0.1/::1 are permitted.`);
  }

  for (const blocked of BLOCKED_HOSTS) {
    if (host.includes(blocked)) {
      throw new Error(`GUARD: Host "${host}" matches blocked pattern "${blocked}". Rehearsal aborted.`);
    }
  }

  if (!database) {
    throw new Error('GUARD: Missing database name in URL.');
  }

  for (const pattern of BLOCKED_DB_PATTERNS) {
    if (pattern.test(database) && !database.startsWith(REHEARSAL_DB_PREFIX)) {
      throw new Error(`GUARD: Database name "${database}" matches a production-like pattern. Use a rehearsal database (${REHEARSAL_DB_PREFIX}*).`);
    }
  }
}

/**
 * Build a pg_dump command string without embedding secrets in output.
 */
export function buildDumpCommand({ host, port, username, database, outputFile }) {
  return [
    'pg_dump',
    `--host=${host}`,
    `--port=${port}`,
    `--username=${username}`,
    '--format=custom',
    `--file=${outputFile}`,
    database,
  ].join(' ');
}

/**
 * Build a pg_restore command string without embedding secrets in output.
 */
export function buildRestoreCommand({ host, port, username, targetDatabase, inputFile }) {
  return [
    'pg_restore',
    `--host=${host}`,
    `--port=${port}`,
    `--username=${username}`,
    `--dbname=${targetDatabase}`,
    '--no-owner',
    inputFile,
  ].join(' ');
}

// ─── Mode detection ───────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const isHelp = args.includes('--help');
const isDryRun = args.includes('--dry-run');
const isLiveLocal = args.includes('--live-local');
const isConfirmDisposable = args.includes('--confirm-disposable');

// ─── Main rehearsal runner ────────────────────────────────────────────────────

const BASE_URL = 'postgresql://finance_user:local_dev_placeholder@127.0.0.1:5432/postgres';
const timestamp = Date.now().toString().slice(-10);
const SOURCE_DB = `${REHEARSAL_DB_PREFIX}src_${timestamp}`;
const TARGET_DB = `${REHEARSAL_DB_PREFIX}tgt_${timestamp}`;
const DUMP_FILE = `yaf_rehearsal_dump_${timestamp}.dump`;

const SOURCE_URL = `postgresql://finance_user:local_dev_placeholder@127.0.0.1:5432/${SOURCE_DB}`;
const TARGET_URL = `postgresql://finance_user:local_dev_placeholder@127.0.0.1:5432/${TARGET_DB}`;

function log(msg) {
  // Never log passwords or full connection strings
  console.log(`[rehearsal] ${msg}`);
}

function run(cmd, env = {}) {
  if (isDryRun) {
    const redacted = cmd
      .replace(/:[^@]*@/g, ':***@')
      .replace(/PGPASSWORD=[^\s]*/g, 'PGPASSWORD=***');
    log(`DRY-RUN: ${redacted}`);
    return;
  }
  execSync(cmd, {
    env: { ...process.env, ...env },
    stdio: 'inherit',
  });
}

function psql(sql) {
  const cmd = `psql ${BASE_URL} -c "${sql}"`;
  run(cmd);
}

async function main() {
  if (isHelp) {
    console.log(HELP_TEXT);
    process.exit(0);
  }

  if (isDryRun) {
    log('Mode: dry-run');
    log('Host: 127.0.0.1:5432 (local-only)');

    // Guard: confirm base URL is local
    assertLocalDbUrl(BASE_URL);
    assertLocalDbUrl(SOURCE_URL);
    assertLocalDbUrl(TARGET_URL);

    log('Guards passed: local-only host confirmed.');

    // Simulate dry-run steps without executing any DB commands
    log(`Creating source database: ${SOURCE_DB}`);
    psql(`CREATE DATABASE ${SOURCE_DB};`);

    log(`Creating target database: ${TARGET_DB}`);
    psql(`CREATE DATABASE ${TARGET_DB};`);

    log('Applying migrations to source database...');
    run('npx prisma migrate deploy', { DATABASE_URL: SOURCE_URL });

    log(`Dumping source database to ${DUMP_FILE}...`);
    const parsedDry = parseDbUrl(SOURCE_URL);
    const dumpCmd = buildDumpCommand({
      host: parsedDry.host,
      port: parsedDry.port,
      username: 'finance_user',
      database: SOURCE_DB,
      outputFile: DUMP_FILE,
    });
    run(`PGPASSWORD=local_dev_placeholder ${dumpCmd}`);

    log(`Restoring dump into target database: ${TARGET_DB}...`);
    const restoreCmd = buildRestoreCommand({
      host: parsedDry.host,
      port: parsedDry.port,
      username: 'finance_user',
      targetDatabase: TARGET_DB,
      inputFile: DUMP_FILE,
    });
    run(`PGPASSWORD=local_dev_placeholder ${restoreCmd}`);

    log('Validating restored database schema...');
    run('npx prisma validate', { DATABASE_URL: TARGET_URL });
    run('npx prisma migrate status', { DATABASE_URL: TARGET_URL });

    log('Dropping source database: ' + SOURCE_DB);
    psql(`DROP DATABASE IF EXISTS ${SOURCE_DB};`);
    log('Dropping target database: ' + TARGET_DB);
    psql(`DROP DATABASE IF EXISTS ${TARGET_DB};`);

    log('Cleanup complete. No disposable databases remain.');
    log('Dry-run complete. No database was connected or modified.');
    return;
  }

  if (isLiveLocal && isConfirmDisposable) {
    log('Mode: live-local (--live-local --confirm-disposable)');
    log('Host: 127.0.0.1:5432 (local-only)');

    // Guard: confirm base URL is local
    assertLocalDbUrl(BASE_URL);
    assertLocalDbUrl(SOURCE_URL);
    assertLocalDbUrl(TARGET_URL);

    log('Guards passed: local-only host confirmed.');

    try {
      // Step 1: Create disposable databases
      log(`Creating source database: ${SOURCE_DB}`);
      psql(`CREATE DATABASE ${SOURCE_DB};`);

      log(`Creating target database: ${TARGET_DB}`);
      psql(`CREATE DATABASE ${TARGET_DB};`);

      // Step 2: Apply migrations to source
      log('Applying migrations to source database...');
      run('npx prisma migrate deploy', { DATABASE_URL: SOURCE_URL });

      // Step 3: Dump source
      log(`Dumping source database to ${DUMP_FILE}...`);
      const parsed = parseDbUrl(SOURCE_URL);
      const dumpCmd = buildDumpCommand({
        host: parsed.host,
        port: parsed.port,
        username: 'finance_user',
        database: SOURCE_DB,
        outputFile: DUMP_FILE,
      });
      run(`PGPASSWORD=local_dev_placeholder ${dumpCmd}`);

      const stat = statSync(DUMP_FILE);
      log(`Dump file size: ${stat.size} bytes`);
      if (stat.size === 0) throw new Error('Dump file is empty — rehearsal aborted.');

      // Step 4: Restore into target
      log(`Restoring dump into target database: ${TARGET_DB}...`);
      const restoreCmd = buildRestoreCommand({
        host: parsed.host,
        port: parsed.port,
        username: 'finance_user',
        targetDatabase: TARGET_DB,
        inputFile: DUMP_FILE,
      });
      run(`PGPASSWORD=local_dev_placeholder ${restoreCmd}`);

      // Step 5: Validate restored database
      log('Validating restored database schema...');
      run('npx prisma validate', { DATABASE_URL: TARGET_URL });
      run('npx prisma migrate status', { DATABASE_URL: TARGET_URL });

      log('Rehearsal validation passed.');
    } finally {
      // Step 6: Cleanup — always runs, even on error
      log(`Dropping source database: ${SOURCE_DB}`);
      try { psql(`DROP DATABASE IF EXISTS ${SOURCE_DB};`); } catch { /* ignore */ }

      log(`Dropping target database: ${TARGET_DB}`);
      try { psql(`DROP DATABASE IF EXISTS ${TARGET_DB};`); } catch { /* ignore */ }

      if (existsSync(DUMP_FILE)) {
        unlinkSync(DUMP_FILE);
        log(`Removed dump file: ${DUMP_FILE}`);
      }

      log('Cleanup complete. No disposable databases remain.');
    }
    return;
  }

  // No valid mode — print help and exit 1 (safe default)
  if (isLiveLocal && !isConfirmDisposable) {
    console.error('[rehearsal] FOUT: --live-local vereist ook --confirm-disposable');
    console.error('[rehearsal] ERROR: --live-local requires --confirm-disposable');
    console.error('[rehearsal] Gebruik: node scripts/backup-restore-rehearsal.mjs --live-local --confirm-disposable');
    console.error('');
    console.error(HELP_TEXT);
    process.exit(1);
  }

  // Default: no arguments or unrecognized arguments
  console.error('[rehearsal] Geen geldig uitvoermodus opgegeven.');
  console.error('[rehearsal] No valid execution mode specified.');
  console.error('[rehearsal] Gebruik --dry-run voor een veilige guard-check zonder database.');
  console.error('[rehearsal] Use --dry-run for a safe guard-check without a database.');
  console.error('');
  console.error(HELP_TEXT);
  process.exit(1);
}

// Only run main() when executed directly (not when imported by tests)
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(`[rehearsal] FAILED: ${err.message}`);
    process.exit(1);
  });
}
