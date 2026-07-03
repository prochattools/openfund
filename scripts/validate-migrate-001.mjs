#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import os from "node:os";
import pgPkg from "pg";

const { Client } = pgPkg;
const rootDir = process.cwd();
const runKey = "f961650b_20260703";
const freshDatabase = `migrate001_fresh_${runKey}`;
const adoptionDatabase = `migrate001_adopt_${runKey}`;
const tempRoot = path.join(rootDir, `.migrate001-validation-${runKey}`);
const freshSchemaPath = path.join(tempRoot, "fresh", "schema.prisma");
const adoptionSchemaPath = path.join(tempRoot, "adoption", "schema.prisma");
const localHosts = new Set(["localhost", "127.0.0.1", "::1"]);
const allowedSockets = new Set(["/tmp", "/var/run/postgresql"]);
const defaultUser = process.env.USER || process.env.LOGNAME || os.userInfo().username;

if (!defaultUser) {
  throw new Error("Cannot determine the local operating-system user for PostgreSQL peer authentication.");
}

const adminUrl =
  process.env.MIGRATE001_ADMIN_DATABASE_URL ||
  `postgresql://${encodeURIComponent(defaultUser)}@localhost/postgres?host=/tmp`;

assertIsolatedLocalAdminUrl(adminUrl);

const baselineSql = fs.readFileSync(
  path.join(rootDir, "prisma/migrations/0_finance_baseline/migration.sql"),
  "utf8",
);

if (/^\s*(?:INSERT\s+INTO|UPDATE\s+|DELETE\s+FROM)\b/im.test(baselineSql)) {
  throw new Error("The finance baseline must contain schema changes only.");
}

const quoteIdentifier = (value) => `"${value.replaceAll('"', '""')}"`;

const databaseUrl = (databaseName) => {
  const url = new URL(adminUrl);
  url.pathname = `/${databaseName}`;
  return url.toString();
};

const schemaWithUrl = (databaseName) => {
  const schema = fs.readFileSync(path.join(rootDir, "prisma/schema.prisma"), "utf8");
  const url = databaseUrl(databaseName);
  const replaced = schema.replace(
    'url      = env("DATABASE_URL")',
    `url      = "${url}"`,
  );
  if (replaced === schema) {
    throw new Error("Could not replace the Prisma datasource URL for isolated validation.");
  }
  return replaced;
};

const copyActiveMigrations = (targetDirectory) => {
  const migrationsTarget = path.join(targetDirectory, "migrations");
  fs.mkdirSync(migrationsTarget, { recursive: true });
  fs.copyFileSync(
    path.join(rootDir, "prisma/migrations/migration_lock.toml"),
    path.join(migrationsTarget, "migration_lock.toml"),
  );
  for (const directory of [
    "0_finance_baseline",
    "20260703001200_add_workspace_dimensions",
  ]) {
    fs.cpSync(
      path.join(rootDir, "prisma/migrations", directory),
      path.join(migrationsTarget, directory),
      { recursive: true, errorOnExist: true },
    );
  }
};

const preparePrismaWorkspace = (name, databaseName) => {
  const directory = path.join(tempRoot, name);
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(path.join(directory, "schema.prisma"), schemaWithUrl(databaseName));
  copyActiveMigrations(directory);
};

const applySql = async (client, sql) => {
  if (sql.trim()) await client.query(sql);
};

const tableCount = async (client, table) => {
  const result = await client.query(`SELECT COUNT(*)::int AS count FROM ${quoteIdentifier(table)}`);
  return result.rows[0].count;
};

const captureFinancialInvariants = async (client) => {
  const categories = await client.query(
    `SELECT "id", "name" FROM "Category" ORDER BY "id"`,
  );
  const transactions = await client.query(`
    SELECT
      COUNT(*)::int AS count,
      COALESCE(SUM("amountMinor"), 0)::text AS total,
      COALESCE(SUM("amountMinor") FILTER (WHERE "direction" = 'credit'), 0)::text AS credit_total,
      COALESCE(SUM("amountMinor") FILTER (WHERE "direction" = 'debit'), 0)::text AS debit_total,
      MIN("date")::text AS minimum_date,
      MAX("date")::text AS maximum_date
    FROM "Transaction"
  `);
  const users = await client.query(
    `SELECT "id", "email" FROM "User" ORDER BY "id"`,
  );
  const counts = {};
  for (const table of [
    "Account",
    "Ledger",
    "ImportBatch",
    "OpeningBalance",
    "CategorizationRule",
    "AuditLog",
    "EmailRecipient",
  ]) {
    counts[table] = await tableCount(client, table);
  }
  return {
    categories: categories.rows,
    transactions: transactions.rows[0],
    users: users.rows,
    counts,
  };
};

const expectedPreModel002 = {
  categories: [
    { id: "20000000-0000-4000-8000-000000000001", name: "Schenking in" },
    { id: "20000000-0000-4000-8000-000000000002", name: "kruispost uit" },
  ],
  transactions: {
    count: 2,
    total: "19134",
    credit_total: "12345",
    debit_total: "6789",
    minimum_date: "2026-01-05 10:00:00",
    maximum_date: "2026-02-06 11:30:00",
  },
  users: [
    {
      id: "10000000-0000-4000-8000-000000000001",
      email: "migrate001-validation@example.invalid",
    },
  ],
  counts: {
    Account: 1,
    Ledger: 0,
    ImportBatch: 0,
    OpeningBalance: 0,
    CategorizationRule: 0,
    AuditLog: 0,
    EmailRecipient: 0,
  },
};

const assertDeepEqual = (actual, expected, label) => {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      `${label} mismatch. Expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}.`,
    );
  }
};

const seedPreModel002Fixtures = async (client) => {
  const userId = "10000000-0000-4000-8000-000000000001";
  const categoryInId = "20000000-0000-4000-8000-000000000001";
  const categoryOutId = "20000000-0000-4000-8000-000000000002";
  const accountId = "30000000-0000-4000-8000-000000000001";

  await client.query(
    `INSERT INTO "User" ("id", "email", "createdAt") VALUES ($1, $2, CURRENT_TIMESTAMP)`,
    [userId, "migrate001-validation@example.invalid"],
  );
  await client.query(
    `INSERT INTO "Category" ("id", "name", "createdAt") VALUES
       ($1, $2, CURRENT_TIMESTAMP),
       ($3, $4, CURRENT_TIMESTAMP)`,
    [categoryInId, "Schenking in", categoryOutId, "kruispost uit"],
  );
  await client.query(
    `INSERT INTO "Account" (
       "id", "userId", "name", "identifier", "currency", "createdAt", "updatedAt"
     ) VALUES ($1, $2, $3, $4, 'EUR', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
    [accountId, userId, "MIGRATE-001 validation", "MIGRATE001-LOCAL"],
  );
  await client.query(
    `INSERT INTO "Transaction" (
       "id", "userId", "date", "description", "normalizedKey", "source",
       "categoryId", "accountId", "amountMinor", "currency", "direction", "hash",
       "updatedAt", "classificationSource"
     ) VALUES
       ('40000000-0000-4000-8000-000000000001', $1, '2026-01-05T10:00:00Z',
        'Inkomende validatie', 'inkomende validatie', 'fixture', $2, $3, 12345,
        'EUR', 'credit', 'migrate001-hash-1', CURRENT_TIMESTAMP, 'manual'),
       ('40000000-0000-4000-8000-000000000002', $1, '2026-02-06T11:30:00Z',
        'Uitgaande validatie', 'uitgaande validatie', 'fixture', $4, $3, 6789,
        'EUR', 'debit', 'migrate001-hash-2', CURRENT_TIMESTAMP, 'manual')`,
    [userId, categoryInId, accountId, categoryOutId],
  );
};

const verifyMigrationRows = async (client) => {
  const result = await client.query(`
    SELECT migration_name, finished_at IS NOT NULL AS finished
    FROM "_prisma_migrations"
    ORDER BY migration_name
  `);
  assertDeepEqual(
    result.rows,
    [
      { migration_name: "0_finance_baseline", finished: true },
      {
        migration_name: "20260703001200_add_workspace_dimensions",
        finished: true,
      },
    ],
    "Prisma migration history",
  );
};

const verifyModel002Invariants = async (client) => {
  assertDeepEqual(
    await captureFinancialInvariants(client),
    expectedPreModel002,
    "Financial invariants",
  );

  const workspace = await client.query(
    `SELECT "id", "name", "slug", "defaultCurrency" FROM "FinanceWorkspace"`,
  );
  assertDeepEqual(
    workspace.rows,
    [
      {
        id: "00000000-0000-4000-8000-000000000001",
        name: "Yeshua Academy",
        slug: "yeshua-academy",
        defaultCurrency: "EUR",
      },
    ],
    "FinanceWorkspace seed",
  );

  const memberships = await client.query(
    `SELECT "userId", "role", "isActive" FROM "WorkspaceMembership" ORDER BY "userId"`,
  );
  assertDeepEqual(
    memberships.rows,
    [
      {
        userId: "10000000-0000-4000-8000-000000000001",
        role: "ADMIN",
        isActive: true,
      },
    ],
    "WorkspaceMembership backfill",
  );

  const nullDimensions = await client.query(`
    SELECT
      COUNT("projectId")::int AS projects,
      COUNT("transactionTypeId")::int AS transaction_types
    FROM "Transaction"
  `);
  assertDeepEqual(
    nullDimensions.rows[0],
    { projects: 0, transaction_types: 0 },
    "Existing transaction dimensions",
  );

  const constraints = await client.query(`
    SELECT conname
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
  `);
  if (constraints.rowCount !== 7) {
    throw new Error(`Expected 7 MODEL-002 foreign keys, found ${constraints.rowCount}.`);
  }

  const indexes = await client.query(`
    SELECT indexname
    FROM pg_indexes
    WHERE indexname IN (
      'FinanceWorkspace_slug_key',
      'WorkspaceMembership_workspaceId_userId_key',
      'Project_workspaceId_code_key',
      'TransactionType_workspaceId_literalName_key',
      'Category_workspaceId_name_key'
    )
  `);
  if (indexes.rowCount !== 5) {
    throw new Error(`Expected 5 MODEL-002 unique indexes, found ${indexes.rowCount}.`);
  }
};

const prepare = async () => {
  if (fs.existsSync(tempRoot)) {
    throw new Error(`Validation workspace already exists: ${tempRoot}`);
  }

  const admin = new Client({ connectionString: adminUrl });
  await admin.connect();
  try {
    const existing = await admin.query(
      `SELECT datname FROM pg_database WHERE datname = ANY($1::text[])`,
      [[freshDatabase, adoptionDatabase]],
    );
    if (existing.rowCount > 0) {
      throw new Error(
        `Refusing to reuse existing databases: ${existing.rows.map((row) => row.datname).join(", ")}`,
      );
    }
    await admin.query(`CREATE DATABASE ${quoteIdentifier(freshDatabase)}`);
    await admin.query(`CREATE DATABASE ${quoteIdentifier(adoptionDatabase)}`);
  } finally {
    await admin.end();
  }

  preparePrismaWorkspace("fresh", freshDatabase);
  preparePrismaWorkspace("adoption", adoptionDatabase);

  const adoption = new Client({ connectionString: databaseUrl(adoptionDatabase) });
  await adoption.connect();
  try {
    await applySql(adoption, baselineSql);
    await seedPreModel002Fixtures(adoption);
    const before = await captureFinancialInvariants(adoption);
    assertDeepEqual(before, expectedPreModel002, "Pre-MODEL-002 fixture invariants");
    console.log(JSON.stringify({
      freshDatabase,
      adoptionDatabase,
      freshSchemaPath,
      adoptionSchemaPath,
      preModel002: before,
    }, null, 2));
  } finally {
    await adoption.end();
  }
};

const materialize = async () => {
  if (fs.existsSync(tempRoot)) {
    throw new Error(`Validation workspace already exists: ${tempRoot}`);
  }

  const admin = new Client({ connectionString: adminUrl });
  await admin.connect();
  try {
    const existing = await admin.query(
      `SELECT datname FROM pg_database WHERE datname = ANY($1::text[]) ORDER BY datname`,
      [[freshDatabase, adoptionDatabase]],
    );
    assertDeepEqual(
      existing.rows.map((row) => row.datname),
      [adoptionDatabase, freshDatabase],
      "Disposable database set",
    );
  } finally {
    await admin.end();
  }

  preparePrismaWorkspace("fresh", freshDatabase);
  preparePrismaWorkspace("adoption", adoptionDatabase);
  console.log(JSON.stringify({ freshSchemaPath, adoptionSchemaPath }, null, 2));
};

const verifyFresh = async () => {
  const client = new Client({ connectionString: databaseUrl(freshDatabase) });
  await client.connect();
  try {
    await verifyMigrationRows(client);
    const workspaceCount = await tableCount(client, "FinanceWorkspace");
    if (workspaceCount !== 1) {
      throw new Error(`Expected one FinanceWorkspace in fresh deployment, found ${workspaceCount}.`);
    }
    console.log("Fresh deployment invariants passed.");
  } finally {
    await client.end();
  }
};

const verifyAdoption = async () => {
  const client = new Client({ connectionString: databaseUrl(adoptionDatabase) });
  await client.connect();
  try {
    await verifyMigrationRows(client);
    await verifyModel002Invariants(client);
    console.log("Adoption rehearsal financial and relational invariants passed.");
  } finally {
    await client.end();
  }
};

const cleanup = async () => {
  const admin = new Client({ connectionString: adminUrl });
  await admin.connect();
  try {
    for (const databaseName of [adoptionDatabase, freshDatabase]) {
      await admin.query(
        `DROP DATABASE IF EXISTS ${quoteIdentifier(databaseName)} WITH (FORCE)`,
      );
      console.log(`Dropped disposable database ${databaseName}.`);
    }
  } finally {
    await admin.end();
  }

  if (fs.existsSync(tempRoot)) {
    if (!tempRoot.startsWith(path.join(rootDir, ".migrate001-validation-"))) {
      throw new Error(`Refusing to remove unexpected validation path: ${tempRoot}`);
    }
    fs.rmSync(tempRoot, { recursive: true, force: false });
    console.log(`Removed validation workspace ${tempRoot}.`);
  }
};

function assertIsolatedLocalAdminUrl(value) {
  const url = new URL(value);
  if (url.protocol !== "postgresql:" && url.protocol !== "postgres:") {
    throw new Error("MIGRATE001_ADMIN_DATABASE_URL must use PostgreSQL.");
  }
  if (!localHosts.has(url.hostname)) {
    throw new Error("MIGRATE001_ADMIN_DATABASE_URL must target localhost only.");
  }
  const socket = url.searchParams.get("host");
  if (socket && !allowedSockets.has(socket)) {
    throw new Error("Only approved local PostgreSQL socket directories are allowed.");
  }
  if (url.pathname !== "/postgres") {
    throw new Error("The admin URL must target the local postgres maintenance database.");
  }
}

const mode = process.argv[2];
const operations = {
  prepare,
  materialize,
  "verify-fresh": verifyFresh,
  "verify-adoption": verifyAdoption,
  cleanup,
};

if (!operations[mode]) {
  throw new Error(
    "Usage: node scripts/validate-migrate-001.mjs <prepare|materialize|verify-fresh|verify-adoption|cleanup>",
  );
}

operations[mode]().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exitCode = 1;
});
