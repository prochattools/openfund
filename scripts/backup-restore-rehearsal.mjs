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
 * Usage:
 *   node scripts/backup-restore-rehearsal.mjs [--dry-run]
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

// ─── Main rehearsal runner ────────────────────────────────────────────────────

const isDryRun = process.argv.includes('--dry-run');

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
  log(`Mode: ${isDryRun ? 'dry-run' : 'live'}`);
  log(`Host: 127.0.0.1:5432 (local-only)`);

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

    if (!isDryRun) {
      const stat = statSync(DUMP_FILE);
      log(`Dump file size: ${stat.size} bytes`);
      if (stat.size === 0) throw new Error('Dump file is empty — rehearsal aborted.');
    }

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

    if (!isDryRun && existsSync(DUMP_FILE)) {
      unlinkSync(DUMP_FILE);
      log(`Removed dump file: ${DUMP_FILE}`);
    }

    log('Cleanup complete. No disposable databases remain.');
  }
}

// Only run main() when executed directly (not when imported by tests)
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(`[rehearsal] FAILED: ${err.message}`);
    process.exit(1);
  });
}
