#!/usr/bin/env node
/**
 * Production readiness verification script.
 *
 * Reads DATABASE_URL from environment only.
 * Verifies target database/schema/user/port and aggregate historical counts.
 * Does not print secrets, raw rows, or credentials.
 * Does not mutate production. Does not send email. Does not generate PDF.
 * Does not read owner files.
 */

import pg from 'pg';
const { Client } = pg;

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('STOP: DATABASE_URL must be set in the environment');
  process.exit(1);
}

let parsed;
try { parsed = new URL(DATABASE_URL); } catch {
  console.error('STOP: DATABASE_URL could not be parsed');
  process.exit(1);
}

const failures = [];
if (parsed.protocol !== 'postgresql:' && parsed.protocol !== 'postgres:') failures.push('protocol must be postgresql');
if (parsed.username !== 'finance_user') failures.push('username must be finance_user');
if (parsed.pathname !== '/finance') failures.push('database must be /finance');
if (parsed.port !== '5433') failures.push('port must be 5433');
if (!parsed.password) failures.push('password missing');
if (parsed.searchParams.get('schema') !== 'finance') failures.push('schema must be finance');

if (failures.length > 0) {
  console.error('STOP: DATABASE_URL target assertions failed: ' + failures.join('; '));
  process.exit(1);
}

console.log('database target assertions passed');
console.log('credentials not printed');

const client = new Client({ connectionString: DATABASE_URL });
try {
  await client.connect();

  const r = await client.query(
    "SELECT current_database() AS db, current_schema() AS sch, version() AS pgv"
  );
  const { db, sch, pgv } = r.rows[0];
  if (db !== 'finance') { console.error('STOP: current_database() is not finance: ' + db); process.exit(1); }
  if (sch !== 'finance') { console.error('STOP: current_schema() is not finance: ' + sch); process.exit(1); }
  if (!pgv.includes('15.')) { console.error('STOP: unexpected PostgreSQL version'); process.exit(1); }

  console.log('connectivity verified');
  console.log('  database: ' + db);
  console.log('  schema: ' + sch);
  console.log('  postgres: ' + pgv.split(' ').slice(0, 2).join(' '));

  // Workspace count
  const ws = await client.query('SELECT COUNT(*)::int AS n FROM finance."FinanceWorkspace"');
  console.log('  workspaces: ' + ws.rows[0].n);

  // Source files
  const sf = await client.query('SELECT COUNT(*)::int AS n FROM finance."SourceFile"');
  console.log('  source files: ' + sf.rows[0].n);

  // Bank statements
  const bs = await client.query('SELECT COUNT(*)::int AS n FROM finance."BankStatement"');
  console.log('  bank statements: ' + bs.rows[0].n);

  // Statement periods
  const sp = await client.query('SELECT COUNT(*)::int AS n FROM finance."StatementPeriod"');
  console.log('  statement periods: ' + sp.rows[0].n);

  // Transactions
  const tx = await client.query('SELECT COUNT(*)::int AS n FROM finance."Transaction"');
  console.log('  transactions: ' + tx.rows[0].n);

  // Bookings
  const bk = await client.query('SELECT COUNT(*)::int AS n FROM finance."TransactionBooking"');
  console.log('  bookings: ' + bk.rows[0].n);

  // Duplicate importFingerprint
  const dup = await client.query(`
    SELECT COUNT(*) AS n FROM (
      SELECT "importFingerprint" FROM finance."Transaction"
      WHERE "importFingerprint" IS NOT NULL
      GROUP BY "importFingerprint" HAVING COUNT(*) > 1
    ) dups
  `);
  console.log('  duplicate fingerprints: ' + parseInt(dup.rows[0].n, 10));

  // Open/partial periods
  const open = await client.query(`
    SELECT COUNT(*)::int AS n FROM finance."StatementPeriod" WHERE "coverageStatus" = 'PARTIAL'
  `);
  console.log('  open/partial periods: ' + open.rows[0].n);

  // Per-year summary from pre-aggregated StatementPeriod fields
  const years = await client.query(`
    SELECT
      EXTRACT(YEAR FROM "periodStart")::int AS yr,
      "transactionCount",
      "coverageStatus"
    FROM finance."StatementPeriod"
    ORDER BY "periodStart"
  `);
  for (const row of years.rows) {
    console.log(`  ${row.yr}: ${row.transactionCount} tx | ${row.coverageStatus}`);
  }

  console.log('production readiness verification passed');
} finally {
  await client.end().catch(() => {});
}
