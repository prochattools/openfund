#!/usr/bin/env node
/**
 * Production historical import script.
 *
 * Default mode: --mode dry-run (no DB writes, no owner file access required for flags)
 *
 * Production write mode requires ALL of the following:
 *   --mode production
 *   --accept-dry-run
 *   --confirm-production-import YESHUA_FINANCE_IMPORT_2024_2025_2026
 *
 * Hard constraints enforced:
 *   - DATABASE_URL must target finance_user / database=finance / schema=finance / port=5433
 *   - Owner file hashes must match expected values exactly
 *   - Control totals must match exactly
 *   - 2026 partial statement cannot be closed
 *   - No raw rows, descriptions, counterparties, credentials printed
 *   - No owner files copied into repo
 *   - No DB dumps created
 *   - No email sent
 *   - No real PDF generated
 *   - No secret rotation
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

// ─── Load DATABASE_URL ────────────────────────────────────────────────────────

const loadDatabaseUrl = () => process.env.DATABASE_URL ?? null;

// ─── Assert production target (no credentials printed) ───────────────────────

const assertProductionTarget = (databaseUrl) => {
  if (!databaseUrl) {
    console.error('STOP: DATABASE_URL is missing. Set it in the environment only.');
    process.exit(1);
  }
  let parsed;
  try {
    parsed = new URL(databaseUrl);
  } catch {
    console.error('STOP: DATABASE_URL could not be parsed.');
    process.exit(1);
  }
  const failures = [];
  const protocol = parsed.protocol;
  const username = parsed.username;
  const database = parsed.pathname.replace(/^\//, '');
  const schema = parsed.searchParams.get('schema');
  const port = parsed.port;
  const passwordPresent = parsed.password && parsed.password.length > 0;
  if (protocol !== 'postgresql:' && protocol !== 'postgres:') failures.push('protocol must be postgresql');
  if (username !== 'finance_user') failures.push('username must be finance_user');
  if (database !== 'finance') failures.push('database path must be /finance');
  if (schema !== 'finance') failures.push('schema query param must be finance');
  if (port !== '5433') failures.push('port must be 5433');
  if (!passwordPresent) failures.push('password must be present');
  if (failures.length > 0) {
    console.error('STOP: DATABASE_URL target assertions failed:');
    for (const f of failures) console.error(' -', f);
    console.error('Credential not printed.');
    process.exit(1);
  }
  console.log('target assertions passed, credential not printed');
};

// ─── Parse CLI args ───────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const mode = args.includes('--mode') ? args[args.indexOf('--mode') + 1] : 'dry-run';
const acceptDryRun = args.includes('--accept-dry-run');
const confirmToken = args.includes('--confirm-production-import')
  ? args[args.indexOf('--confirm-production-import') + 1]
  : null;
const REQUIRED_CONFIRM_TOKEN = 'YESHUA_FINANCE_IMPORT_2024_2025_2026';

if (!['dry-run', 'production'].includes(mode)) {
  console.error(`STOP: Unknown --mode "${mode}". Use "dry-run" or "production".`);
  process.exit(1);
}

const isDryRun = mode !== 'production';
console.log(`mode: ${isDryRun ? 'dry-run' : 'production'}`);

// ─── Expected source hashes and control totals ───────────────────────────────

const EXPECTED_HASHES = {
  concludedWorkbook2024: '844699610889c6986fec305cdbb7b760da3dfc1d556ab9d0e160c854e1bc7f9f',
  concludedWorkbook2025: 'd3913b876f3a6b8ddc3d19c49ef9778125e5e109a7d3ac330afbb3d6d8d7b2ff',
  openStatementCsv2026: '768912927a7bb3b545616631e6d5360479a90b0bc6448faa3f225925636d31d3',
  openStatementPdf2026: '5e830a365fe0d87f67e883f24239f60674ed85a174e65db6520136511a6d58d2',
};

const EXPECTED_CONTROLS = {
  concluded2024: {
    transactionCount: 268,
    openingBalanceMinor: 172186n,
    incomeMinor: 3226719n,
    expenseMinor: 2180490n,
    closingBalanceMinor: 1218415n,
  },
  concluded2025: {
    transactionCount: 413,
    openingBalanceMinor: 1218415n,
    incomeMinor: 9164244n,
    expenseMinor: 9347573n,
    closingBalanceMinor: 1035086n,
  },
  openStatement2026: {
    transactionCount: 221,
    openingBalanceMinor: 1035086n,
    incomeMinor: 5878408n,
    expenseMinor: 6129769n,
    closingBalanceMinor: 783725n,
    coverageStatus: 'PARTIAL',
    closePermitted: false,
  },
};

// ─── Load compiled modules ────────────────────────────────────────────────────

const distDir = path.join(repoRoot, 'dist');
if (!fs.existsSync(distDir)) {
  console.error('STOP: dist/ not found. Run npm run build:server first.');
  process.exit(1);
}

const buildHistoricalOwnerImportCommand = require(
  path.join(distDir, 'server/services/historicalOwnerImportCommandService.js'),
).buildHistoricalOwnerImportCommand;

const rehearseHistoricalImportPlan = require(
  path.join(distDir, 'server/services/historicalImportRehearsalService.js'),
).rehearseHistoricalImportPlan;

const buildOwnerHistoricalLocalRehearsal = require(
  path.join(distDir, 'lib/import/historicalOwnerLocalRehearsal.js'),
).buildOwnerHistoricalLocalRehearsal;

// ─── Format minor amounts as EUR ─────────────────────────────────────────────

const formatEur = (minor) => {
  const n = typeof minor === 'bigint' ? minor : BigInt(minor);
  const abs = n < 0n ? -n : n;
  const euros = abs / 100n;
  const cents = abs % 100n;
  const sign = n < 0n ? '-' : '';
  return `${sign}EUR ${euros}.${String(cents).padStart(2, '0')}`;
};

// ─── Verify control totals match ─────────────────────────────────────────────

const verifyControls = (label, actual, expected) => {
  const failures = [];
  if (actual.transactionCount !== expected.transactionCount) {
    failures.push(`transactionCount: got ${actual.transactionCount}, expected ${expected.transactionCount}`);
  }
  const fields = ['openingBalanceMinor', 'incomeMinor', 'expenseMinor', 'closingBalanceMinor'];
  for (const field of fields) {
    const a = BigInt(actual[field]);
    const e = expected[field];
    if (a !== e) {
      failures.push(`${field}: got ${formatEur(a)}, expected ${formatEur(e)}`);
    }
  }
  if (expected.coverageStatus !== undefined && actual.coverageStatus !== expected.coverageStatus) {
    failures.push(`coverageStatus: got ${actual.coverageStatus}, expected ${expected.coverageStatus}`);
  }
  if (expected.closePermitted !== undefined && actual.closePermitted !== expected.closePermitted) {
    failures.push(`closePermitted: got ${actual.closePermitted}, expected ${expected.closePermitted}`);
  }
  if (failures.length > 0) {
    console.error(`STOP: Control total mismatch for ${label}:`);
    for (const f of failures) console.error(' -', f);
    return false;
  }
  console.log(`✓ ${label} controls match`);
  return true;
};

// ─── Main ─────────────────────────────────────────────────────────────────────

const databaseUrl = loadDatabaseUrl();

// Validate production target for all modes (dry-run too) so we fail fast if misconfigured.
// But for dry-run, DATABASE_URL is required only if we intend to write later.
// Step 2 from spec: assert target.
assertProductionTarget(databaseUrl);

// ─── Step 7: Run dry-run ──────────────────────────────────────────────────────

console.log('\n--- dry-run: verifying owner files and control totals ---');

const commandResult = await buildHistoricalOwnerImportCommand({
  repoRoot,
  requestedMode: 'dry-run',
  databaseUrl: null, // classification is irrelevant for dry-run parse
});

if (commandResult.sourceAvailability !== 'available') {
  console.error('STOP: Owner source files are not available or have hash mismatches:');
  for (const reason of commandResult.executionBlockedReasons) {
    console.error(' -', reason);
  }
  process.exit(1);
}

const summary = commandResult.importPlanSummary;
if (!summary) {
  console.error('STOP: Dry-run did not produce an import plan summary.');
  process.exit(1);
}

// Verify file hashes
console.log('\n--- source file hashes ---');
for (const [role, expected] of Object.entries(EXPECTED_HASHES)) {
  const actual = summary.files[role]?.sha256;
  if (actual !== expected) {
    console.error(`STOP: Hash mismatch for ${role}: got ${actual}, expected ${expected}`);
    process.exit(1);
  }
  console.log(`✓ ${role} hash verified`);
}

// Verify control totals
console.log('\n--- control total verification ---');
const c24 = summary.concluded2024.controlTotals;
const ok2024 = verifyControls('2024', {
  transactionCount: summary.concluded2024.rowCount,
  openingBalanceMinor: BigInt(c24.openingBalanceMinor),
  incomeMinor: BigInt(c24.incomeMinor),
  expenseMinor: BigInt(c24.expenseMinor),
  closingBalanceMinor: BigInt(c24.closingBalanceMinor),
}, EXPECTED_CONTROLS.concluded2024);

const c25 = summary.concluded2025.controlTotals;
const ok2025 = verifyControls('2025', {
  transactionCount: summary.concluded2025.rowCount,
  openingBalanceMinor: BigInt(c25.openingBalanceMinor),
  incomeMinor: BigInt(c25.incomeMinor),
  expenseMinor: BigInt(c25.expenseMinor),
  closingBalanceMinor: BigInt(c25.closingBalanceMinor),
}, EXPECTED_CONTROLS.concluded2025);

const c26 = summary.openStatement.controlTotals;
const ok2026 = verifyControls('2026 (partial)', {
  transactionCount: summary.openStatement.rowCount,
  openingBalanceMinor: BigInt(c26.openingBalanceMinor),
  incomeMinor: BigInt(c26.incomeMinor),
  expenseMinor: BigInt(c26.expenseMinor),
  closingBalanceMinor: BigInt(c26.closingBalanceMinor),
  coverageStatus: summary.openStatement.coverageStatus,
  closePermitted: summary.openStatement.closePermitted,
}, EXPECTED_CONTROLS.openStatement2026);

if (!ok2024 || !ok2025 || !ok2026) {
  console.error('\nSTOP: Control total verification failed. Import blocked.');
  process.exit(1);
}

if (!summary.openStatement.closePermitted) {
  console.log('✓ 2026 partial statement: closePermitted=false (correct, must not be closed)');
}

console.log(`\nduplicate fingerprint count: ${summary.duplicateFingerprintCount}`);
if (summary.duplicateFingerprintCount > 0) {
  console.log('  (duplicates are expected: 2026 open statement rows may overlap with workbook rows)');
}

console.log('\n--- dry-run summary ---');
console.log(`2024: ${summary.concluded2024.rowCount} transactions, opening ${formatEur(BigInt(c24.openingBalanceMinor))}, closing ${formatEur(BigInt(c24.closingBalanceMinor))}`);
console.log(`2025: ${summary.concluded2025.rowCount} transactions, opening ${formatEur(BigInt(c25.openingBalanceMinor))}, closing ${formatEur(BigInt(c25.closingBalanceMinor))}`);
console.log(`2026: ${summary.openStatement.rowCount} transactions, opening ${formatEur(BigInt(c26.openingBalanceMinor))}, closing ${formatEur(BigInt(c26.closingBalanceMinor))}, coverage=PARTIAL, closePermitted=false`);
console.log('no raw rows printed, no DB writes made, no owner files copied');

if (isDryRun) {
  console.log('\n✓ dry-run complete. All hashes and control totals verified.');
  console.log('  To execute production import, run with:');
  console.log('  --mode production --accept-dry-run --confirm-production-import YESHUA_FINANCE_IMPORT_2024_2025_2026');
  process.exit(0);
}

// ─── Production mode: validate all required flags ────────────────────────────

console.log('\n--- production mode pre-flight ---');

if (!acceptDryRun) {
  console.error('STOP: --accept-dry-run is required for production mode.');
  process.exit(1);
}
if (confirmToken !== REQUIRED_CONFIRM_TOKEN) {
  console.error('STOP: --confirm-production-import token is missing or incorrect.');
  process.exit(1);
}

console.log('✓ all required production flags present');

// ─── Step 9: Execute production historical import ─────────────────────────────

console.log('\n--- executing production historical import ---');

// Build full plans (with retained source bytes) from owner files
const bundle = await buildOwnerHistoricalLocalRehearsal({
  repoRoot,
  sources: require(
    path.join(distDir, 'server/services/historicalOwnerImportCommandService.js'),
  ).DEFAULT_OWNER_HISTORICAL_SOURCES,
});

// Initialize Prisma client against production
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: databaseUrl,
    },
  },
});

let importResult2024;
let importResult2025;
let importResultOpen;

try {
  // Check idempotency: stop if historical data already present in production workspace
  const PRODUCTION_WORKSPACE_ID = '00000000-0000-4000-8000-000000000001';
  const existingSourceFiles = await prisma.sourceFile.count({
    where: { workspaceId: PRODUCTION_WORKSPACE_ID },
  });
  if (existingSourceFiles > 0) {
    console.error(`STOP: Production workspace already has ${existingSourceFiles} source file(s). Historical import appears already present.`);
    console.error('  If you need to re-import, investigate the existing records first.');
    await prisma.$disconnect();
    process.exit(1);
  }

  // Find or create production user and account.
  // If no workspace member exists yet (fresh production), create the admin actor.
  const PRODUCTION_ADMIN_EMAIL = 'steve@yeshua.academy';
  let adminMember = await prisma.workspaceMembership.findFirst({
    where: { workspaceId: PRODUCTION_WORKSPACE_ID, role: 'ADMIN', isActive: true },
    include: { user: true },
  });

  if (!adminMember) {
    console.log('no existing admin member found; creating production admin actor...');
    const actor = await prisma.user.upsert({
      where: { email: PRODUCTION_ADMIN_EMAIL },
      update: {},
      create: { email: PRODUCTION_ADMIN_EMAIL },
    });
    const membership = await prisma.workspaceMembership.create({
      data: {
        workspaceId: PRODUCTION_WORKSPACE_ID,
        userId: actor.id,
        role: 'ADMIN',
        isActive: true,
      },
    });
    adminMember = { userId: actor.id, user: actor };
    console.log('created production admin actor (email masked)');
  }

  const actorId = adminMember.userId;
  const actorEmail = adminMember.user.email;
  console.log(`using production workspace: ${PRODUCTION_WORKSPACE_ID}`);
  console.log(`actor email (masked): ${actorEmail.replace(/^(.{2}).*(@.*)$/, '$1***$2')}`);

  // Ensure the production account exists (NL89INGB0006369960)
  const accountIdentifier = 'NL89INGB0006369960';
  const account = await prisma.account.upsert({
    where: { userId_identifier: { userId: actorId, identifier: accountIdentifier } },
    update: {},
    create: {
      userId: actorId,
      identifier: accountIdentifier,
      name: 'ING Betaalrekening Yeshua Academy',
      currency: 'EUR',
    },
  });
  console.log(`production account ready: ${accountIdentifier}`);

  // Write 2024 plan to production.
  // Each record is individually guarded by findUnique before create, so no wrapping transaction needed.
  importResult2024 = await writeProductionImportPlan(prisma, {
    plan: bundle.plans.concluded2024,
    retainedSourceContentBySha256: bundle.retainedSourceContentBySha256,
    workspaceId: PRODUCTION_WORKSPACE_ID,
    actorId,
    actorEmail,
    accountId: account.id,
    accountIdentifier,
  });

  console.log(`2024 import: ${importResult2024.transactionsWritten} transactions, ${importResult2024.bookingsWritten} bookings, ${importResult2024.sourceFilesWritten} source files`);

  // Write 2025 plan to production
  importResult2025 = await writeProductionImportPlan(prisma, {
    plan: bundle.plans.concluded2025,
    retainedSourceContentBySha256: bundle.retainedSourceContentBySha256,
    workspaceId: PRODUCTION_WORKSPACE_ID,
    actorId,
    actorEmail,
    accountId: account.id,
    accountIdentifier,
  });

  console.log(`2025 import: ${importResult2025.transactionsWritten} transactions, ${importResult2025.bookingsWritten} bookings, ${importResult2025.sourceFilesWritten} source files`);

  // Write 2026 open statement
  importResultOpen = await writeProductionOpenStatement(prisma, {
    plan: bundle.plans.concluded2025,
    retainedSourceContentBySha256: bundle.retainedSourceContentBySha256,
    workspaceId: PRODUCTION_WORKSPACE_ID,
    actorId,
    actorEmail,
    accountId: account.id,
    accountIdentifier,
  });

  console.log(`2026 open statement import: ${importResultOpen.transactionsWritten} transactions, ${importResultOpen.bookingsWritten} bookings, ${importResultOpen.sourceFilesWritten} source files`);

} finally {
  await prisma.$disconnect();
}

// ─── Step 10: Verify production data ─────────────────────────────────────────

console.log('\n--- production verification ---');
const verifyPrisma = new PrismaClient({
  datasources: { db: { url: databaseUrl } },
});

try {
  const PRODUCTION_WORKSPACE_ID = '00000000-0000-4000-8000-000000000001';
  const [workspaceCount, sourceFileCount, bankStatementCount, statementPeriodCount, transactionCount, bookingCount] = await Promise.all([
    verifyPrisma.financeWorkspace.count({ where: { id: PRODUCTION_WORKSPACE_ID } }),
    verifyPrisma.sourceFile.count({ where: { workspaceId: PRODUCTION_WORKSPACE_ID } }),
    verifyPrisma.bankStatement.count({ where: { workspaceId: PRODUCTION_WORKSPACE_ID } }),
    verifyPrisma.statementPeriod.count({ where: { workspaceId: PRODUCTION_WORKSPACE_ID } }),
    verifyPrisma.transaction.count(),
    verifyPrisma.transactionBooking.count({ where: { workspaceId: PRODUCTION_WORKSPACE_ID } }),
  ]);

  console.log(`workspace count: ${workspaceCount}`);
  console.log(`source file count: ${sourceFileCount}`);
  console.log(`bank statement count: ${bankStatementCount}`);
  console.log(`statement period count: ${statementPeriodCount}`);
  console.log(`transaction count (all): ${transactionCount}`);
  console.log(`booking count: ${bookingCount}`);

  // Verify 2026 is partial/open
  const openPeriods = await verifyPrisma.statementPeriod.findMany({
    where: { workspaceId: PRODUCTION_WORKSPACE_ID, coverageStatus: 'PARTIAL' },
    select: { periodStart: true, periodEnd: true, coverageStatus: true, transactionCount: true },
  });
  console.log(`open/partial statement periods: ${openPeriods.length}`);
  if (openPeriods.length > 0) {
    console.log('✓ 2026 partial period found (not closed)');
  }

  // Check for duplicate transactions
  const dupCheck = await verifyPrisma.$queryRaw`
    SELECT COUNT(*) as total FROM (
      SELECT "importFingerprint" FROM "Transaction" WHERE "importFingerprint" IS NOT NULL
      GROUP BY "importFingerprint" HAVING COUNT(*) > 1
    ) dups
  `;
  const dupCount = Number(dupCheck[0]?.total ?? 0);
  if (dupCount > 0) {
    console.warn(`WARNING: ${dupCount} duplicate import fingerprints found.`);
  } else {
    console.log('✓ zero duplicate import fingerprints');
  }

  console.log('\nno credentials printed, no raw rows printed');
} finally {
  await verifyPrisma.$disconnect();
}

console.log('\n✓ production historical import complete');
console.log('remaining blockers: real email, real PDF, secret rotation');

// ─── Production write helper (workspace-scoped) ───────────────────────────────

const { BookingSource, StatementCoverageStatus, TransactionClassificationSource, WorkspaceRole } = require('@prisma/client');

async function hashSourceContent(content) {
  return crypto.createHash('sha256').update(content).digest('hex');
}

function stableStringify(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(',')}}`;
}

function hashEvidence(value) {
  return crypto.createHash('sha256').update(stableStringify(value)).digest('hex');
}

function toDate(value) {
  if (!value) throw new Error('Historical import: missing period boundary.');
  return new Date(value);
}

function coverageStatusEnum(value) {
  return value === 'COMPLETE' ? 'COMPLETE' : 'PARTIAL';
}

async function upsertSourceFile(tx, workspaceId, sourceFile, actorId, retainedSourceContentBySha256) {
  const raw = retainedSourceContentBySha256?.[sourceFile.sha256];
  if (!raw) throw new Error(`Missing retained source content for ${sourceFile.sha256}`);
  const content = Buffer.isBuffer(raw) ? raw : Buffer.from(raw);
  const retainedSha256 = await hashSourceContent(content);
  const existing = await tx.sourceFile.findUnique({
    where: { workspaceId_sha256: { workspaceId, sha256: retainedSha256 } },
  });
  if (existing) return { record: existing, created: false };
  const record = await tx.sourceFile.create({
    data: {
      workspaceId,
      filename: sourceFile.originalFilename,
      mediaType: sourceFile.mediaType,
      sizeBytes: content.byteLength,
      sha256: retainedSha256,
      content,
      uploadedBy: actorId,
    },
  });
  return { record, created: true };
}

async function ensureStatement(tx, params) {
  const existing = await tx.bankStatement.findUnique({ where: { sourceFileId: params.sourceFileId } });
  if (existing) return { record: existing, created: false };
  const record = await tx.bankStatement.create({
    data: {
      workspaceId: params.workspaceId,
      accountId: params.accountId,
      sourceFileId: params.sourceFileId,
      supportingPdfFileId: params.supportingPdfFileId,
      periodStart: toDate(params.statement.periodStart),
      periodEnd: toDate(params.statement.periodEnd),
      coverageStatus: coverageStatusEnum(params.statement.coverageStatus),
      openingBalanceMinor: params.statement.totals.openingBalanceMinor,
      incomeMinor: params.statement.totals.incomeMinor,
      expenseMinor: params.statement.totals.expenseMinor,
      netMinor: params.statement.totals.incomeMinor - params.statement.totals.expenseMinor,
      closingBalanceMinor: params.statement.totals.closingBalanceMinor,
      transactionCount: params.statement.rowCount,
      bankAccountIdentifier: params.bankAccountIdentifier,
      acceptedBy: params.acceptedBy,
      acceptedAt: new Date(),
    },
  });
  return { record, created: true };
}

async function ensureStatementPeriod(tx, params) {
  const periodStart = toDate(params.period.periodStart);
  const periodEnd = toDate(params.period.periodEnd);
  const existing = await tx.statementPeriod.findUnique({
    where: {
      statementId_accountId_periodStart_periodEnd: {
        statementId: params.statementId,
        accountId: params.accountId,
        periodStart,
        periodEnd,
      },
    },
  });
  if (existing) return { record: existing, created: false };
  const record = await tx.statementPeriod.create({
    data: {
      workspaceId: params.workspaceId,
      statementId: params.statementId,
      accountId: params.accountId,
      periodStart,
      periodEnd,
      coverageStatus: coverageStatusEnum(params.period.coverageStatus),
      openingBalanceMinor: params.period.openingBalanceMinor,
      incomeMinor: params.period.incomeMinor,
      expenseMinor: params.period.expenseMinor,
      netMinor: params.period.netMinor,
      closingBalanceMinor: params.period.closingBalanceMinor,
      transactionCount: params.period.transactionCount,
    },
  });
  return { record, created: true };
}

async function ensureDimensions(tx, workspaceId, txPlan) {
  if (!txPlan.klant || !txPlan.type || !txPlan.category) return null;
  const [project, transactionType, category] = await Promise.all([
    tx.project.upsert({
      where: { workspaceId_code: { workspaceId, code: txPlan.klant } },
      update: {},
      create: { workspaceId, code: txPlan.klant, name: txPlan.klant, isHistorical: true },
    }),
    tx.transactionType.upsert({
      where: { workspaceId_literalName: { workspaceId, literalName: txPlan.type } },
      update: {},
      create: { workspaceId, literalName: txPlan.type, isHistorical: true },
    }),
    tx.category.upsert({
      where: { workspaceId_name: { workspaceId, name: txPlan.category } },
      update: {},
      create: { workspaceId, name: txPlan.category, isHistorical: true },
    }),
  ]);
  return { project, transactionType, category };
}

async function ensureTransaction(tx, params) {
  const existing = await tx.transaction.findUnique({
    where: { userId_importFingerprint: { userId: params.userId, importFingerprint: params.txPlan.fingerprint } },
  });
  if (existing) return { record: existing, created: false };
  const record = await tx.transaction.create({
    data: {
      userId: params.userId,
      accountId: params.accountId,
      date: new Date(params.txPlan.date),
      description: String(params.txPlan.rawRow?.['Name / Description'] ?? 'Historical transaction'),
      normalizedKey: params.txPlan.fingerprint,
      source: 'historical_production_import',
      sourceFile: params.sourceFilename,
      rawRow: JSON.parse(stableStringify(params.txPlan.rawRow)),
      amountMinor: params.txPlan.amountMinor,
      currency: 'EUR',
      direction: params.txPlan.direction,
      counterparty: params.txPlan.counterparty,
      reference: params.txPlan.reference,
      hash: params.txPlan.fingerprint,
      importFingerprint: params.txPlan.fingerprint,
      projectId: params.dimensionIds?.projectId ?? null,
      transactionTypeId: params.dimensionIds?.transactionTypeId ?? null,
      categoryId: params.dimensionIds?.categoryId ?? null,
      classificationSource: params.dimensionIds ? 'history' : 'import',
    },
  });
  return { record, created: true };
}

async function ensureBooking(tx, params) {
  const existing = await tx.transactionBooking.findUnique({ where: { transactionId: params.transactionId } });
  if (existing) return { record: existing, created: false };
  const evidence = {
    source: 'historical-production-import',
    rowNumber: params.txPlan.rowNumber,
    fingerprint: params.txPlan.fingerprint,
    literalProjectLabel: params.txPlan.klant,
    literalTypeLabel: params.txPlan.type,
    literalCategoryLabel: params.txPlan.category,
  };
  const record = await tx.transactionBooking.create({
    data: {
      workspaceId: params.workspaceId,
      transactionId: params.transactionId,
      projectId: params.dimensionIds.projectId,
      transactionTypeId: params.dimensionIds.transactionTypeId,
      categoryId: params.dimensionIds.categoryId,
      source: 'HISTORICAL',
      evidence: JSON.parse(stableStringify(evidence)),
      evidenceHash: hashEvidence(evidence),
      confirmedBy: params.actorId,
      literalProjectLabel: params.txPlan.klant,
      literalTypeLabel: params.txPlan.type,
      literalCategoryLabel: params.txPlan.category,
    },
  });
  return { record, created: true };
}

async function writeProductionImportPlan(tx, { plan, retainedSourceContentBySha256, workspaceId, actorId, accountId, accountIdentifier }) {
  let sourceFilesWritten = 0, bankStatementsWritten = 0, statementPeriodsWritten = 0, transactionsWritten = 0, bookingsWritten = 0;

  // Write workbook statement
  const wbSourceFile = await upsertSourceFile(tx, workspaceId, plan.workbook.sourceFile, actorId, retainedSourceContentBySha256);
  if (wbSourceFile.created) sourceFilesWritten++;
  const wbStatement = await ensureStatement(tx, {
    workspaceId, accountId, sourceFileId: wbSourceFile.record.id,
    supportingPdfFileId: null,
    statement: plan.workbook.statement, bankAccountIdentifier: accountIdentifier, acceptedBy: actorId,
  });
  if (wbStatement.created) bankStatementsWritten++;
  const wbPeriod = await ensureStatementPeriod(tx, {
    workspaceId, statementId: wbStatement.record.id, accountId, period: plan.workbook.period,
  });
  if (wbPeriod.created) statementPeriodsWritten++;

  // Write transactions
  const seenFingerprints = new Set();
  for (const txPlan of plan.workbook.transactions) {
    if (seenFingerprints.has(txPlan.fingerprint)) continue;
    seenFingerprints.add(txPlan.fingerprint);
    const dimensions = await ensureDimensions(tx, workspaceId, txPlan);
    const dimensionIds = dimensions ? { projectId: dimensions.project.id, transactionTypeId: dimensions.transactionType.id, categoryId: dimensions.category.id } : null;
    const transaction = await ensureTransaction(tx, {
      userId: actorId, accountId, sourceFilename: plan.workbook.sourceFile.originalFilename, txPlan, dimensionIds,
    });
    if (transaction.created) transactionsWritten++;
    if (dimensionIds) {
      const booking = await ensureBooking(tx, { workspaceId, transactionId: transaction.record.id, txPlan, dimensionIds, actorId });
      if (booking.created) bookingsWritten++;
    }
  }

  return { sourceFilesWritten, bankStatementsWritten, statementPeriodsWritten, transactionsWritten, bookingsWritten };
}

async function writeProductionOpenStatement(tx, { plan, retainedSourceContentBySha256, workspaceId, actorId, accountId, accountIdentifier }) {
  let sourceFilesWritten = 0, bankStatementsWritten = 0, statementPeriodsWritten = 0, transactionsWritten = 0, bookingsWritten = 0;

  // Write open statement source file (CSV + supporting PDF)
  const csvSourceFile = await upsertSourceFile(tx, workspaceId, plan.openStatement.sourceFile, actorId, retainedSourceContentBySha256);
  if (csvSourceFile.created) sourceFilesWritten++;

  let pdfFileId = null;
  if (plan.openStatement.supportingPdfFile) {
    const pdfSourceFile = await upsertSourceFile(tx, workspaceId, plan.openStatement.supportingPdfFile, actorId, retainedSourceContentBySha256);
    if (pdfSourceFile.created) sourceFilesWritten++;
    pdfFileId = pdfSourceFile.record.id;
  }

  const openStatement = await ensureStatement(tx, {
    workspaceId, accountId, sourceFileId: csvSourceFile.record.id,
    supportingPdfFileId: pdfFileId,
    statement: plan.openStatement.statement, bankAccountIdentifier: accountIdentifier, acceptedBy: actorId,
  });
  if (openStatement.created) bankStatementsWritten++;

  const openPeriod = await ensureStatementPeriod(tx, {
    workspaceId, statementId: openStatement.record.id, accountId, period: plan.openStatement.period,
  });
  if (openPeriod.created) statementPeriodsWritten++;

  // Write open statement transactions
  const seenFingerprints = new Set();
  for (const txPlan of plan.openStatement.transactions) {
    if (seenFingerprints.has(txPlan.fingerprint)) continue;
    seenFingerprints.add(txPlan.fingerprint);
    // Skip if already imported by workbook (cross-statement duplicate)
    const alreadyImported = await tx.transaction.findUnique({
      where: { userId_importFingerprint: { userId: actorId, importFingerprint: txPlan.fingerprint } },
    });
    if (alreadyImported) continue;
    const dimensions = await ensureDimensions(tx, workspaceId, txPlan);
    const dimensionIds = dimensions ? { projectId: dimensions.project.id, transactionTypeId: dimensions.transactionType.id, categoryId: dimensions.category.id } : null;
    const transaction = await ensureTransaction(tx, {
      userId: actorId, accountId, sourceFilename: plan.openStatement.sourceFile.originalFilename, txPlan, dimensionIds,
    });
    if (transaction.created) transactionsWritten++;
    if (dimensionIds && transaction.created) {
      const booking = await ensureBooking(tx, { workspaceId, transactionId: transaction.record.id, txPlan, dimensionIds, actorId });
      if (booking.created) bookingsWritten++;
    }
  }

  return { sourceFilesWritten, bankStatementsWritten, statementPeriodsWritten, transactionsWritten, bookingsWritten };
}
