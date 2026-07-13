import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';
import pg from 'pg';
import { PrismaClient } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import {
  buildOwnerHistoricalLocalRehearsal,
} from '../../lib/import/historicalOwnerLocalRehearsal';
import { rehearseHistoricalImportPlan } from '../../server/services/historicalImportRehearsalService';
import {
  OWNER_HISTORICAL_SOURCES,
  OWNER_HISTORICAL_SOURCE_PATHS,
  ownerHistoricalFilesAvailable,
} from '../fixtures/ownerHistoricalSources';

const { Client } = pg;

const OWNER_SOURCE_PATHS = OWNER_HISTORICAL_SOURCE_PATHS;
const ownerSources = OWNER_HISTORICAL_SOURCES;

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
  const sql = fs.readFileSync(path.join(process.cwd(), `prisma/migrations/${directory}/migration.sql`), 'utf8');
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

const assertOwnerFilesOutsideGit = () => {
  const repoRoot = process.cwd();
  for (const source of ownerSources) {
    const absolutePath = path.resolve(source.absolutePath);
    expect(absolutePath.startsWith(`${repoRoot}${path.sep}`)).toBe(false);
    expect(fs.existsSync(path.join(repoRoot, path.basename(source.absolutePath)))).toBe(false);
  }
};

describe('historical owner local rehearsal', () => {
  it('refuses non-local database URLs in the owner rehearsal guard', () => {
    expect(isLocalDatabaseUrl('postgresql://user:pass@localhost:5432/db')).toBe(true);
    expect(isLocalDatabaseUrl('postgresql://user:pass@127.0.0.1:5432/db')).toBe(true);
    expect(isLocalDatabaseUrl('postgresql://user:pass@10.0.2.4:5432/db')).toBe(false);
    expect(isLocalDatabaseUrl('postgresql://user:pass@example.com:5432/db')).toBe(false);
  });

  const localAdminUrl = loadLocalAdminUrl();
  const databaseValidation = localAdminUrl && ownerHistoricalFilesAvailable() ? it : it.skip;

  databaseValidation(
    'rehearses approved owner historical files in a disposable local database',
    async () => {
      assertOwnerFilesOutsideGit();
      const adminUrl = new URL(localAdminUrl!);
      expect(localHosts.has(adminUrl.hostname)).toBe(true);

      const bundle = await buildOwnerHistoricalLocalRehearsal({
        repoRoot: process.cwd(),
        sources: ownerSources,
      });

      expect(bundle.summary.concluded.concluded2024.rowCount).toBe(268);
      expect(bundle.summary.concluded.concluded2025.rowCount).toBe(413);
      expect(bundle.summary.openStatement.rowCount).toBe(221);
      expect(bundle.summary.concluded.concluded2024.statementPeriod.coverageStatus).toBe('COMPLETE');
      expect(bundle.summary.concluded.concluded2025.statementPeriod.coverageStatus).toBe('COMPLETE');
      expect(bundle.summary.openStatement.statementPeriod.coverageStatus).toBe('PARTIAL');
      expect(bundle.summary.openStatement.statementPeriod.closePermitted).toBe(false);
      expect(bundle.summary.concluded.concluded2024.controlTotals.closingBalanceMinor).toBe(1218415n);
      expect(bundle.summary.concluded.concluded2025.controlTotals.closingBalanceMinor).toBe(1035086n);
      expect(bundle.summary.openStatement.controlTotals.closingBalanceMinor).toBe(783725n);
      expect(bundle.summary.duplicateFingerprintCount).toBeGreaterThanOrEqual(0);

      const suffix = `${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
      const databaseName = `owner_historical_rehearsal_${suffix}`;
      const databaseIdentifier = quoteIdentifier(databaseName);
      const admin = new Client({ connectionString: localAdminUrl! });
      let disposable: pg.Client | null = null;
      let prisma: PrismaClient | null = null;

      await admin.connect();
      try {
        await admin.query(`CREATE DATABASE ${databaseIdentifier}`);
        const disposableUrl = createDisposableDatabaseUrl(localAdminUrl!, databaseName);
        console.info(
          `owner historical rehearsal disposable database host=${adminUrl.hostname} port=${adminUrl.port || '5432'} database=${databaseName} migrations=sql-chain`,
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

        const summary2024 = await prisma.$transaction((tx) =>
          rehearseHistoricalImportPlan(tx, {
            plan: bundle.plans.concluded2024,
            retainedSourceContentBySha256: bundle.retainedSourceContentBySha256,
            actorEmail: 'owner-historical-rehearsal@example.invalid',
          }),
        );
        const summary2025 = await prisma.$transaction((tx) =>
          rehearseHistoricalImportPlan(tx, {
            plan: bundle.plans.concluded2025,
            retainedSourceContentBySha256: bundle.retainedSourceContentBySha256,
            actorEmail: 'owner-historical-rehearsal@example.invalid',
          }),
        );

        expect(summary2024.closeEligibility.workbook.closePermitted).toBe(true);
        expect(summary2025.closeEligibility.workbook.closePermitted).toBe(true);
        expect(summary2024.closeEligibility.openStatement.closePermitted).toBe(false);
        expect(summary2025.closeEligibility.openStatement.closePermitted).toBe(false);

        const [sourceFiles, statements, periods, workbookTransactions, bookings] = await Promise.all([
          prisma.sourceFile.findMany({ orderBy: { filename: 'asc' } }),
          prisma.bankStatement.findMany({ orderBy: { periodStart: 'asc' } }),
          prisma.statementPeriod.findMany({ orderBy: { periodStart: 'asc' } }),
          prisma.transaction.findMany({
            where: {
              sourceFile: {
                in: [
                  bundle.summary.concluded.concluded2024.filename,
                  bundle.summary.concluded.concluded2025.filename,
                ],
              },
            },
            include: { project: true, transactionType: true, category: true },
          }),
          prisma.transactionBooking.findMany(),
        ]);

        expect(sourceFiles).toHaveLength(4);
        expect(sourceFiles.every((sourceFile) => sourceFile.sha256 === hashPersistedContent(sourceFile.content))).toBe(true);
        expect(sourceFiles.map((sourceFile) => sourceFile.sha256).sort()).toEqual(
          Object.values(bundle.summary.files).map((file) => file.sha256).sort(),
        );
        expect(statements.map((statement) => statement.transactionCount).sort((a, b) => a - b)).toEqual([221, 268, 413]);
        expect(periods.map((period) => period.coverageStatus).sort()).toEqual(['COMPLETE', 'COMPLETE', 'PARTIAL']);
        expect(workbookTransactions).toHaveLength(681);
        expect(workbookTransactions.every((tx) => tx.project && tx.transactionType && tx.category)).toBe(true);
        expect(bookings.length).toBe(681);
      } finally {
        if (prisma) {
          await prisma.$disconnect();
        }
        if (disposable) {
          await disposable.end();
        }
        await admin.query(`DROP DATABASE IF EXISTS ${databaseIdentifier} WITH (FORCE)`);
        console.info(
          `owner historical rehearsal disposable database cleanup=drop-database host=${adminUrl.hostname} port=${adminUrl.port || '5432'} database=${databaseName}`,
        );
        await admin.end();
      }
    },
    180_000,
  );
});
