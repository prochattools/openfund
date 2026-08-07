import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import dotenv from 'dotenv';
import pg from 'pg';
import { describe, expect, it } from 'vitest';

const { Client } = pg;

const readRepoFile = (relativePath: string): string =>
  fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');

const schema = readRepoFile('prisma/schema.prisma');
const migrationPath =
  'prisma/migrations/20260703001200_add_workspace_dimensions/migration.sql';
const migration = readRepoFile(migrationPath);
const baselinePath = 'prisma/migrations/0_finance_baseline/migration.sql';
const baseline = readRepoFile(baselinePath);
const archiveRoot = 'prisma/migrations-legacy-pre-baseline';
const model002ExpectedHash =
  'e70917a1c9ce059667f8266860376b5dcf3380974f665d7e11f58bcf5f96e70e';

const sha256File = (relativePath: string): string =>
  crypto
    .createHash('sha256')
    .update(fs.readFileSync(path.join(process.cwd(), relativePath)))
    .digest('hex');

const loadLocalAdminUrl = (): string | null => {
  dotenv.config({ path: path.join(process.cwd(), '.env'), override: false });

  const defaultUser = process.env.USER || process.env.LOGNAME || os.userInfo().username;
  const configuredUrl =
    process.env.MIGRATE001_ADMIN_DATABASE_URL
    ?? process.env.SYSTEM_DATABASE_URL
    ?? process.env.DATABASE_URL;
  const candidate =
    configuredUrl
    ?? (process.env.POSTGRES_USER && process.env.POSTGRES_PASSWORD
      ? `postgresql://${encodeURIComponent(process.env.POSTGRES_USER)}:${encodeURIComponent(
          process.env.POSTGRES_PASSWORD,
        )}@localhost/postgres`
      : defaultUser
        ? `postgresql://${encodeURIComponent(defaultUser)}@localhost/postgres?host=/tmp`
        : null);
  if (!candidate) return null;

  const parsed = new URL(candidate);
  const localHosts = new Set(['localhost', '127.0.0.1', '::1']);
  const allowedSockets = new Set(['/tmp', '/var/run/postgresql']);
  if (parsed.protocol !== 'postgresql:' && parsed.protocol !== 'postgres:') return null;
  if (!localHosts.has(parsed.hostname)) return null;
  if (parsed.pathname !== '/postgres') return null;
  const socket = parsed.searchParams.get('host');
  if (socket && !allowedSockets.has(socket)) return null;

  return candidate;
};

const quoteIdentifier = (value: string): string => `"${value.replaceAll('"', '""')}"`;

const migrationDirectories = (): string[] =>
  fs
    .readdirSync(path.join(process.cwd(), 'prisma/migrations'), { withFileTypes: true })
    .filter((entry) =>
      entry.isDirectory()
      && fs.existsSync(path.join(process.cwd(), 'prisma/migrations', entry.name, 'migration.sql')),
    )
    .map((entry) => entry.name)
    .sort();

const applyMigrationFile = async (client: pg.Client, directory: string): Promise<void> => {
  const sql = readRepoFile(`prisma/migrations/${directory}/migration.sql`);
  if (sql.trim()) {
    await client.query(sql);
  }
};

const runPrisma = (args: string[], databaseUrl: string): string => {
  const result = spawnSync(
    process.execPath,
    [path.join(process.cwd(), 'node_modules/prisma/build/index.js'), ...args],
    {
      cwd: process.cwd(),
      env: { ...process.env, DATABASE_URL: databaseUrl },
      encoding: 'utf8',
    },
  );
  if (result.status !== 0) {
    throw new Error(`Prisma command failed: ${result.stderr || result.stdout}`);
  }
  return `${result.stdout}${result.stderr}`;
};

const createDisposableDatabaseUrl = (adminUrl: string, databaseName: string): string => {
  const disposableUrl = new URL(adminUrl);
  disposableUrl.pathname = `/${databaseName}`;
  return disposableUrl.toString();
};

const createPrismaReplayWorkspace = (): { root: string; schemaPath: string } => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'merchant-knowledge-replay-'));
  const prismaRoot = path.join(root, 'prisma');
  const migrationsRoot = path.join(prismaRoot, 'migrations');
  fs.mkdirSync(migrationsRoot, { recursive: true });
  fs.copyFileSync(path.join(process.cwd(), 'prisma/schema.prisma'), path.join(prismaRoot, 'schema.prisma'));
  fs.copyFileSync(
    path.join(process.cwd(), 'prisma/migrations/migration_lock.toml'),
    path.join(migrationsRoot, 'migration_lock.toml'),
  );
  for (const directory of migrationDirectories()) {
    fs.cpSync(
      path.join(process.cwd(), 'prisma/migrations', directory),
      path.join(migrationsRoot, directory),
      { recursive: true },
    );
  }
  return { root, schemaPath: path.join(prismaRoot, 'schema.prisma') };
};

describe('MODEL-002 additive domain schema', () => {
  it('defines workspace ownership and explicit Klant, Type, and Category dimensions', () => {
    expect(schema).toMatch(/model FinanceWorkspace \{/);
    expect(schema).toMatch(/model WorkspaceMembership \{/);
    expect(schema).toMatch(/model Project \{/);
    expect(schema).toMatch(/model TransactionType \{/);
    expect(schema).toMatch(/model Category \{[\s\S]*workspaceId\s+String/);
    expect(schema).toMatch(/model Transaction \{[\s\S]*projectId\s+String\?/);
    expect(schema).toMatch(/model Transaction \{[\s\S]*transactionTypeId\s+String\?/);
    expect(schema).toMatch(/@@unique\(\[workspaceId, code\]\)/);
    expect(schema).toMatch(/@@unique\(\[workspaceId, literalName\]\)/);
    expect(schema).toMatch(/@@unique\(\[workspaceId, name\]\)/);
  });

  it('preserves existing category labels and backfills workspace scope without merging data', () => {
    expect(migration).toContain('ADD COLUMN "workspaceId" TEXT NOT NULL');
    expect(migration).toContain('CREATE UNIQUE INDEX "Category_workspaceId_name_key"');
    expect(migration).not.toMatch(/DROP\s+(TABLE|COLUMN)/i);
    expect(migration).not.toMatch(/DELETE\s+FROM\s+"Category"/i);
    expect(migration).not.toMatch(/UPDATE\s+"Category"\s+SET\s+"name"/i);
    expect(migration).not.toMatch(/INSERT\s+INTO\s+"Transaction"/i);
  });

  it('creates the default workspace and memberships without treating actors as owners', () => {
    expect(migration).toContain('INSERT INTO "FinanceWorkspace"');
    expect(migration).toContain('INSERT INTO "WorkspaceMembership"');
    expect(migration).toContain('FROM "User"');
    expect(migration).toContain("'ADMIN'::\"WorkspaceRole\"");
  });

  it('keeps the normalized baseline plus approved additive model migrations active', () => {
    expect(migrationDirectories()).toEqual([
      '0_finance_baseline',
      '20260703001200_add_workspace_dimensions',
      '20260703193000_add_classification_records',
      '20260704143000_add_statement_close_report_models',
      '20260719094000_add_merchant_knowledge',
      '20260719095000_add_merchant_knowledge',
      '20260729000000_add_transaction_type_direction',
      '20260731000000_add_suggestion_producer_ownership',
      '20260806180511_add_dispatch_duplicate_protection',
      '20260806202030_add_delivery_key_idempotency',
      '20260807085500_drop_obsolete_dispatch_identity',
    ]);
    expect(sha256File(migrationPath)).toBe(model002ExpectedHash);
  });

  it('preserves every archived legacy migration byte-identically', () => {
    const checksumLines = readRepoFile(`${archiveRoot}/SHA256SUMS`)
      .trim()
      .split(/\r?\n/);

    expect(checksumLines).toHaveLength(17);
    for (const line of checksumLines) {
      const match = line.match(/^([a-f0-9]{64})\s+(.+)$/);
      expect(match).not.toBeNull();
      const [, expectedHash, relativePath] = match!;
      expect(sha256File(`${archiveRoot}/${relativePath}`)).toBe(expectedHash);
    }
  });

  it('generates a data-free pre-MODEL-002 finance baseline', () => {
    for (const table of [
      'User',
      'Category',
      'Ledger',
      'Account',
      'OpeningBalance',
      'LedgerLock',
      'ImportBatch',
      'Transaction',
      'EmailRecipient',
      'AuditLog',
      'CategorizationRule',
    ]) {
      expect(baseline).toContain(`CREATE TABLE "${table}"`);
    }

    expect(baseline).toContain('CREATE TYPE "TransactionDirection"');
    expect(baseline).toContain('CREATE UNIQUE INDEX "Transaction_hash_key"');
    expect(baseline).not.toMatch(/INSERT\s+INTO/i);
    expect(baseline).not.toContain('FinanceWorkspace');
    expect(baseline).not.toContain('WorkspaceMembership');
    expect(baseline).not.toContain('TransactionType');
  });

  const localAdminUrl = loadLocalAdminUrl();
  const databaseValidation = localAdminUrl ? it : it.skip;

  databaseValidation(
    'validates the current migration chain through Prisma deploy status and drift',
    async () => {
      const suffix = `${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
      const databaseName = `merchant_knowledge_validate_${suffix}`;
      const databaseIdentifier = quoteIdentifier(databaseName);
      const admin = new Client({ connectionString: localAdminUrl! });
      const disposableUrl = createDisposableDatabaseUrl(localAdminUrl!, databaseName);
      const replayWorkspace = createPrismaReplayWorkspace();
      let disposable: pg.Client | null = null;

      await admin.connect();
      try {
        await admin.query(`CREATE DATABASE ${databaseIdentifier}`);

        expect(runPrisma(['validate', '--schema', 'prisma/schema.prisma'], disposableUrl))
          .toContain('is valid');
        expect(runPrisma(['generate', '--schema', 'prisma/schema.prisma'], disposableUrl))
          .toContain('Generated Prisma Client');
        expect(runPrisma(['migrate', 'deploy', '--schema', replayWorkspace.schemaPath], disposableUrl))
          .toContain('All migrations have been successfully applied');
        expect(runPrisma(['migrate', 'status', '--schema', replayWorkspace.schemaPath], disposableUrl))
          .toContain('Database schema is up to date');
        const drift = runPrisma([
          'migrate',
          'diff',
          '--from-schema-datasource',
          replayWorkspace.schemaPath,
          '--to-schema-datamodel',
          replayWorkspace.schemaPath,
          '--exit-code',
        ], disposableUrl);
        expect(drift).toContain('No difference detected');

        disposable = new Client({ connectionString: disposableUrl });
        await disposable.connect();

        const merchantTables = [
          'Merchant',
          'MerchantAlias',
          'MerchantFingerprint',
          'MerchantResolution',
          'MerchantConflict',
          'MerchantIdentityDecision',
          'MerchantAuditEvent',
          'MerchantBackfillRun',
          'MerchantBackfillResult',
        ];
        const tables = await disposable.query(
          `SELECT tablename FROM pg_tables
            WHERE schemaname = 'public' AND tablename = ANY($1::text[])
            ORDER BY tablename`,
          [merchantTables],
        );
        expect(tables.rows.map((row) => row.tablename)).toEqual([...merchantTables].sort());

        for (const table of merchantTables) {
          const count = await disposable.query(
            `SELECT COUNT(*)::int AS count FROM ${quoteIdentifier(table)}`,
          );
          expect(count.rows[0].count).toBe(0);
        }

        const partialIndexes = await disposable.query(
          `SELECT indexname FROM pg_indexes
            WHERE indexname = ANY($1::text[])
            ORDER BY indexname`,
          [[
            'MerchantAlias_active_workspace_signal_value_key',
            'MerchantConflict_open_workspace_transaction_key',
            'MerchantFingerprint_active_strong_workspace_signal_value_key',
          ]],
        );
        expect(partialIndexes.rowCount).toBe(3);

        const workspaceForeignKeys = await disposable.query(
          `SELECT conname, pg_get_constraintdef(oid) AS definition
             FROM pg_constraint
            WHERE contype = 'f' AND conname LIKE 'Merchant%_workspaceId_fkey'
            ORDER BY conname`,
        );
        expect(workspaceForeignKeys.rowCount).toBe(9);
        for (const row of workspaceForeignKeys.rows) {
          expect(row.definition).toContain('REFERENCES "FinanceWorkspace"');
          expect(row.definition).toContain('ON DELETE RESTRICT');
        }
      } finally {
        if (disposable) await disposable.end();
        await admin.query(`DROP DATABASE IF EXISTS ${databaseIdentifier} WITH (FORCE)`);
        await admin.end();
        fs.rmSync(replayWorkspace.root, { recursive: true, force: true });
      }
    },
    120_000,
  );

  databaseValidation(
    'applies the full migration history to an isolated local PostgreSQL database',
    async () => {
      const targetMigration = path.basename(path.dirname(migrationPath));
      const directories = migrationDirectories();
      const targetIndex = directories.indexOf(targetMigration);
      expect(targetIndex).toBeGreaterThan(0);

      const suffix = `${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
      const databaseName = `model002_validate_${suffix}`;
      const databaseIdentifier = quoteIdentifier(databaseName);
      const admin = new Client({ connectionString: localAdminUrl! });
      let disposable: pg.Client | null = null;

      await admin.connect();
      try {
        await admin.query(`CREATE DATABASE ${databaseIdentifier}`);
        disposable = new Client({
          connectionString: createDisposableDatabaseUrl(localAdminUrl!, databaseName),
        });
        await disposable.connect();

        for (const directory of directories.slice(0, targetIndex)) {
          await applyMigrationFile(disposable, directory);
        }

        const fixtureUserId = '10000000-0000-4000-8000-000000000001';
        const firstCategoryId = '20000000-0000-4000-8000-000000000001';
        const secondCategoryId = '20000000-0000-4000-8000-000000000002';
        const accountId = '30000000-0000-4000-8000-000000000001';
        const firstTransactionId = '40000000-0000-4000-8000-000000000001';
        const secondTransactionId = '40000000-0000-4000-8000-000000000002';

        await disposable.query(
          `INSERT INTO "User" ("id", "email", "createdAt") VALUES ($1, $2, CURRENT_TIMESTAMP)`,
          [fixtureUserId, 'model002-validation@example.invalid'],
        );
        await disposable.query(
          `INSERT INTO "Category" ("id", "name", "createdAt") VALUES
             ($1, $2, CURRENT_TIMESTAMP),
             ($3, $4, CURRENT_TIMESTAMP)`,
          [firstCategoryId, 'Schenking in', secondCategoryId, 'kruispost uit'],
        );
        await disposable.query(
          `INSERT INTO "Account" (
             "id", "userId", "name", "identifier", "currency", "createdAt", "updatedAt"
           ) VALUES ($1, $2, $3, $4, 'EUR', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
          [accountId, fixtureUserId, 'MODEL-002 validation', 'MODEL002-LOCAL'],
        );
        await disposable.query(
          `INSERT INTO "Transaction" (
             "id", "userId", "date", "description", "normalizedKey", "source",
             "categoryId", "accountId", "amountMinor", "currency", "direction", "hash",
             "updatedAt", "classificationSource"
           ) VALUES
             ($1, $2, CURRENT_TIMESTAMP, 'Inkomende validatie', 'inkomende validatie', 'fixture',
              $3, $4, 12345, 'EUR', 'credit', 'model002-hash-1', CURRENT_TIMESTAMP, 'manual'),
             ($5, $2, CURRENT_TIMESTAMP, 'Uitgaande validatie', 'uitgaande validatie', 'fixture',
              $6, $4, 6789, 'EUR', 'debit', 'model002-hash-2', CURRENT_TIMESTAMP, 'manual')`,
          [
            firstTransactionId,
            fixtureUserId,
            firstCategoryId,
            accountId,
            secondTransactionId,
            secondCategoryId,
          ],
        );

        const categoriesBefore = await disposable.query(
          `SELECT "id", "name" FROM "Category" ORDER BY "id"`,
        );
        const transactionBefore = await disposable.query(
          `SELECT COUNT(*)::int AS count, COALESCE(SUM("amountMinor"), 0)::text AS total FROM "Transaction"`,
        );

        await applyMigrationFile(disposable, targetMigration);

        const workspace = await disposable.query(
          `SELECT "name", "slug", "defaultCurrency" FROM "FinanceWorkspace"`,
        );
        expect(workspace.rows).toEqual([
          {
            name: 'Yeshua Academy',
            slug: 'yeshua-academy',
            defaultCurrency: 'EUR',
          },
        ]);

        const membership = await disposable.query(
          `SELECT "userId", "role", "isActive" FROM "WorkspaceMembership"`,
        );
        expect(membership.rows).toEqual([
          { userId: fixtureUserId, role: 'ADMIN', isActive: true },
        ]);

        const categoriesAfter = await disposable.query(
          `SELECT "id", "name" FROM "Category" ORDER BY "id"`,
        );
        expect(categoriesAfter.rows).toEqual(categoriesBefore.rows);

        const transactionAfter = await disposable.query(
          `SELECT COUNT(*)::int AS count, COALESCE(SUM("amountMinor"), 0)::text AS total,
                  COUNT("projectId")::int AS projects,
                  COUNT("transactionTypeId")::int AS transaction_types
             FROM "Transaction"`,
        );
        expect(transactionAfter.rows[0]).toEqual({
          ...transactionBefore.rows[0],
          projects: 0,
          transaction_types: 0,
        });

        const constraints = await disposable.query(
          `SELECT conname
             FROM pg_constraint
            WHERE conname IN (
              'WorkspaceMembership_workspaceId_fkey',
              'WorkspaceMembership_userId_fkey',
              'Project_workspaceId_fkey',
              'TransactionType_workspaceId_fkey',
              'Category_workspaceId_fkey',
              'Transaction_projectId_fkey',
              'Transaction_transactionTypeId_fkey'
            )
            ORDER BY conname`,
        );
        expect(constraints.rowCount).toBe(7);

        const indexes = await disposable.query(
          `SELECT indexname
             FROM pg_indexes
            WHERE indexname IN (
              'FinanceWorkspace_slug_key',
              'WorkspaceMembership_workspaceId_userId_key',
              'Project_workspaceId_code_key',
              'TransactionType_workspaceId_literalName_key',
              'Category_workspaceId_name_key'
            )`,
        );
        expect(indexes.rowCount).toBe(5);

        for (const directory of directories.slice(targetIndex + 1)) {
          await applyMigrationFile(disposable, directory);
        }

        const merchantTables = [
          'Merchant',
          'MerchantAlias',
          'MerchantFingerprint',
          'MerchantResolution',
          'MerchantConflict',
          'MerchantIdentityDecision',
          'MerchantAuditEvent',
          'MerchantBackfillRun',
          'MerchantBackfillResult',
        ];
        const tableResult = await disposable.query(
          `SELECT tablename
             FROM pg_tables
            WHERE schemaname = 'public'
              AND tablename = ANY($1::text[])
            ORDER BY tablename`,
          [merchantTables],
        );
        expect(tableResult.rows.map((row) => row.tablename)).toEqual([...merchantTables].sort());

        const merchantEnums = [
          'MerchantStatus',
          'MerchantKnowledgeSignalType',
          'MerchantAliasStatus',
          'MerchantFingerprintStatus',
          'MerchantFingerprintStrength',
          'MerchantResolutionStatus',
          'MerchantConflictStatus',
          'MerchantIdentityDecisionAction',
          'MerchantBackfillRunStatus',
        ];
        const enumResult = await disposable.query(
          `SELECT typname
             FROM pg_type
            WHERE typname = ANY($1::text[])
            ORDER BY typname`,
          [merchantEnums],
        );
        expect(enumResult.rows.map((row) => row.typname)).toEqual([...merchantEnums].sort());

        const partialIndexes = await disposable.query(
          `SELECT indexname, indexdef
             FROM pg_indexes
            WHERE indexname = ANY($1::text[])
            ORDER BY indexname`,
          [[
            'MerchantAlias_active_workspace_signal_value_key',
            'MerchantConflict_open_workspace_transaction_key',
            'MerchantFingerprint_active_strong_workspace_signal_value_key',
          ]],
        );
        expect(partialIndexes.rowCount).toBe(3);
        for (const row of partialIndexes.rows) expect(row.indexdef).toContain(' WHERE ');

        const workspaceForeignKeys = await disposable.query(
          `SELECT conname, pg_get_constraintdef(oid) AS definition
             FROM pg_constraint
            WHERE contype = 'f'
              AND conname LIKE 'Merchant%_workspaceId_fkey'
            ORDER BY conname`,
        );
        expect(workspaceForeignKeys.rowCount).toBe(9);
        for (const row of workspaceForeignKeys.rows) {
          expect(row.definition).toContain('REFERENCES "FinanceWorkspace"');
          expect(row.definition).toContain('ON DELETE RESTRICT');
        }

        for (const table of merchantTables) {
          const count = await disposable.query(
            `SELECT COUNT(*)::int AS count FROM ${quoteIdentifier(table)}`,
          );
          expect(count.rows[0].count).toBe(0);
        }

        const accountingTables = await disposable.query(
          `SELECT tablename
             FROM pg_tables
            WHERE schemaname = 'public'
              AND tablename = ANY($1::text[])
            ORDER BY tablename`,
          [['Transaction', 'TransactionBooking', 'ReviewDecision', 'CategorizationSuggestion']],
        );
        expect(accountingTables.rows.map((row) => row.tablename)).toEqual([
          'CategorizationSuggestion',
          'ReviewDecision',
          'Transaction',
          'TransactionBooking',
        ]);
      } finally {
        if (disposable) {
          await disposable.end();
        }
        await admin.query(`DROP DATABASE IF EXISTS ${databaseIdentifier} WITH (FORCE)`);
        await admin.end();
      }
    },
    120_000,
  );
});
