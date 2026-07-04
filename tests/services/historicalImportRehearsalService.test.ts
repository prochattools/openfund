import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';
import pg from 'pg';
import { PrismaClient } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { parseHistoricalWorkbookRows } from '../../lib/import/historicalWorkbookParser';
import { parseHistoricalIngCsvStatement } from '../../lib/import/ingCsvParser';
import { planHistoricalImport } from '../../lib/import/historicalImportPlanner';
import { rehearseHistoricalImportPlan } from '../../server/services/historicalImportRehearsalService';

const { Client } = pg;

const readRepoFile = (relativePath: string): string =>
  fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');

const quoteIdentifier = (value: string): string => `"${value.replaceAll('"', '""')}"`;

const localHosts = new Set(['localhost', '127.0.0.1', '::1']);

const isLocalDatabaseUrl = (value: string): boolean => {
  try {
    return localHosts.has(new URL(value).hostname);
  } catch {
    return false;
  }
};

const loadLocalAdminUrl = (): string | null => {
  dotenv.config({ path: path.join(process.cwd(), '.env'), override: false });

  const configuredUrl = process.env.SYSTEM_DATABASE_URL ?? process.env.DATABASE_URL;
  const candidate =
    configuredUrl ??
    (process.env.POSTGRES_USER &&
    process.env.POSTGRES_PASSWORD &&
    process.env.POSTGRES_DBNAME
      ? `postgresql://${encodeURIComponent(process.env.POSTGRES_USER)}:${encodeURIComponent(
          process.env.POSTGRES_PASSWORD,
        )}@localhost:5432/${encodeURIComponent(process.env.POSTGRES_DBNAME)}`
      : null);
  if (!candidate || !isLocalDatabaseUrl(candidate)) return null;
  return candidate;
};

const migrationDirectories = (): string[] =>
  fs
    .readdirSync(path.join(process.cwd(), 'prisma/migrations'), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

const applyMigrationFile = async (client: pg.Client, directory: string): Promise<void> => {
  const sql = readRepoFile(`prisma/migrations/${directory}/migration.sql`);
  if (sql.trim()) {
    await client.query(sql);
  }
};

const createDisposableDatabaseUrl = (adminUrl: string, databaseName: string): string => {
  const disposableUrl = new URL(adminUrl);
  disposableUrl.pathname = `/${databaseName}`;
  disposableUrl.search = '';
  return disposableUrl.toString();
};

const hashPersistedContent = (content: Uint8Array): string =>
  crypto.createHash('sha256').update(Buffer.from(content)).digest('hex');

const workbookFixture = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, '../fixtures/historical-loading/2024-workbook-rows.json'), 'utf-8'),
);
const csvFixture = fs.readFileSync(path.resolve(__dirname, '../fixtures/historical-loading/2026-ing.csv'));
const clarificationFixture = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, '../fixtures/historical-loading/verduidelijking-rows.json'), 'utf-8'),
);

const buildFixturePlan = async () => {
  const workbookRows = parseHistoricalWorkbookRows([
    workbookFixture[0],
    {
      ...workbookFixture[0],
      Klant: 'FR',
      Type: 'Schenking',
      Category: 'Different Fixture Label',
      Comment: 'Duplicate identity with different labels',
    },
    workbookFixture[1],
  ]);
  const statement = await parseHistoricalIngCsvStatement(csvFixture, {
    periodStart: new Date('2026-01-01T00:00:00.000Z'),
    periodEnd: new Date('2026-07-01T00:00:00.000Z'),
  });

  return planHistoricalImport({
    concludedWorkbook: {
      filename: 'YA financieel jaar 2024.xlsx',
      mediaType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      sha256: 'fixture-sha-2024',
      rows: workbookRows,
    },
    openStatement: {
      filename: 'NL89INGB0006369960_2026-01-01_2026-07-01.csv',
      mediaType: 'text/csv',
      sha256: 'fixture-sha-2026-csv',
      pdfFilename: 'NL89INGB0006369960_2026-01-01_2026-07-01.pdf',
      pdfMediaType: 'application/pdf',
      pdfSha256: 'fixture-sha-2026-pdf',
      statement,
    },
    clarificationRows: clarificationFixture,
  }).plan;
};

describe('historical import rehearsal service', () => {
  it('refuses non-local database URLs in the test guard', () => {
    expect(isLocalDatabaseUrl('postgresql://user:pass@localhost:5432/db')).toBe(true);
    expect(isLocalDatabaseUrl('postgresql://user:pass@127.0.0.1:5432/db')).toBe(true);
    expect(isLocalDatabaseUrl('postgresql://user:pass@10.0.2.4:5432/db')).toBe(false);
    expect(isLocalDatabaseUrl('postgresql://user:pass@example.com:5432/db')).toBe(false);
  });

  const localAdminUrl = loadLocalAdminUrl();
  const databaseValidation = localAdminUrl ? it : it.skip;

  databaseValidation(
    'rehearses sanitized historical import plans in a disposable local database',
    async () => {
      const suffix = `${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
      const databaseName = `historical_rehearsal_${suffix}`;
      const databaseIdentifier = quoteIdentifier(databaseName);
      const admin = new Client({ connectionString: localAdminUrl! });
      let disposable: pg.Client | null = null;
      let prisma: PrismaClient | null = null;

      await admin.connect();
      try {
        await admin.query(`CREATE DATABASE ${databaseIdentifier}`);
        const disposableUrl = createDisposableDatabaseUrl(localAdminUrl!, databaseName);
        const adminUrl = new URL(localAdminUrl!);
        console.info(
          `historical rehearsal disposable database host=${adminUrl.hostname} port=${adminUrl.port || '5432'} database=${databaseName} migrations=sql-chain`,
        );
        disposable = new Client({ connectionString: disposableUrl });
        await disposable.connect();
        for (const directory of migrationDirectories()) {
          await applyMigrationFile(disposable, directory);
        }
        await disposable.end();
        disposable = null;

        prisma = new PrismaClient({
          datasources: {
            db: {
              url: disposableUrl,
            },
          },
        });

        const plan = await buildFixturePlan();
        const summary = await prisma.$transaction((tx) =>
          rehearseHistoricalImportPlan(tx, {
            plan,
            actorEmail: 'historical-rehearsal-test@example.invalid',
          }),
        );

        expect(summary.sourceFilesWritten).toBe(3);
        expect(summary.bankStatementsWritten).toBe(2);
        expect(summary.statementPeriodsWritten).toBe(2);
        expect(summary.transactionsWritten).toBe(4);
        expect(summary.bookingsWritten).toBe(2);
        expect(summary.duplicateFingerprints).toHaveLength(1);
        expect(summary.controlTotals.workbook.transactionCount).toBe(3);
        expect(summary.controlTotals.openStatement.transactionCount).toBe(2);
        expect(summary.closeEligibility.workbook.closePermitted).toBe(true);
        expect(summary.closeEligibility.openStatement).toMatchObject({
          coverageStatus: 'PARTIAL',
          closePermitted: false,
        });

        const [sourceFiles, statements, periods, transactions, bookings] = await Promise.all([
          prisma.sourceFile.findMany({ orderBy: { filename: 'asc' } }),
          prisma.bankStatement.findMany({ orderBy: { createdAt: 'asc' } }),
          prisma.statementPeriod.findMany({ orderBy: { createdAt: 'asc' } }),
          prisma.transaction.findMany({ orderBy: { date: 'asc' }, include: { project: true, transactionType: true, category: true } }),
          prisma.transactionBooking.findMany({ orderBy: { createdAt: 'asc' } }),
        ]);

        expect(sourceFiles).toHaveLength(3);
        expect(sourceFiles.every((sourceFile) => sourceFile.sha256 === hashPersistedContent(sourceFile.content))).toBe(true);
        expect(sourceFiles.map((sourceFile) => sourceFile.sha256)).not.toContain('fixture-sha-2024');
        expect(sourceFiles.map((sourceFile) => sourceFile.sha256)).not.toContain('fixture-sha-2026-csv');
        expect(sourceFiles.map((sourceFile) => sourceFile.sha256)).not.toContain('fixture-sha-2026-pdf');
        const retainedSourceText = sourceFiles.map((sourceFile) => Buffer.from(sourceFile.content).toString('utf8'));
        expect(retainedSourceText.every((content) => content.includes('synthetic historical rehearsal source'))).toBe(true);
        expect(retainedSourceText.every((content) => content.includes('sourceInventorySha256=fixture-sha-'))).toBe(true);
        expect(retainedSourceText.every((content) => !content.includes('Fixture Donor A'))).toBe(true);
        expect(retainedSourceText.every((content) => !content.includes('Fixture Gift'))).toBe(true);
        expect(retainedSourceText.every((content) => !content.includes('Different Fixture Label'))).toBe(true);
        expect(statements.map((statement) => statement.transactionCount).sort()).toEqual([2, 3]);
        expect(periods.map((period) => period.coverageStatus).sort()).toEqual(['COMPLETE', 'PARTIAL']);
        expect(transactions).toHaveLength(4);
        expect(transactions.map((tx) => tx.importFingerprint).sort()).toEqual(
          [...new Set([...plan.workbook.transactions, ...plan.openStatement.transactions].map((tx) => tx.fingerprint))].sort(),
        );
        expect(transactions.some((tx) => tx.project?.code === 'FTK')).toBe(true);
        expect(transactions.some((tx) => tx.transactionType?.literalName === 'Algemeen')).toBe(true);
        expect(transactions.some((tx) => tx.category?.name === 'Fixture Gift')).toBe(true);
        expect(transactions.every((tx) => JSON.stringify(tx.rawRow).includes('Fixture'))).toBe(true);
        expect(bookings).toHaveLength(2);
        expect(bookings.map((booking) => booking.literalProjectLabel).sort()).toEqual(['FTK', 'YA']);

        const secondSummary = await prisma.$transaction((tx) =>
          rehearseHistoricalImportPlan(tx, {
            plan,
            actorEmail: 'historical-rehearsal-test@example.invalid',
          }),
        );
        expect(secondSummary.sourceFilesWritten).toBe(0);
        expect(secondSummary.transactionsWritten).toBe(0);
        expect(secondSummary.bookingsWritten).toBe(0);
        expect(secondSummary.duplicateFingerprints).toEqual(summary.duplicateFingerprints);
      } finally {
        if (prisma) {
          await prisma.$disconnect();
        }
        if (disposable) {
          await disposable.end();
        }
        await admin.query(`DROP DATABASE IF EXISTS ${databaseIdentifier} WITH (FORCE)`);
        const adminUrl = new URL(localAdminUrl!);
        console.info(
          `historical rehearsal disposable database cleanup=drop-database host=${adminUrl.hostname} port=${adminUrl.port || '5432'} database=${databaseName}`,
        );
        await admin.end();
      }
    },
    120_000,
  );
});
