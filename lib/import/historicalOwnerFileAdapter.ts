import path from 'node:path';
import type { HistoricalImportPlan } from './historicalImportPlanner';

export type OwnerHistoricalSourceRole =
  | 'concludedWorkbook2024'
  | 'concludedWorkbook2025'
  | 'openStatementCsv2026'
  | 'openStatementPdf2026';

export type OwnerHistoricalSourceDescriptor = {
  role: OwnerHistoricalSourceRole;
  absolutePath: string;
  expectedSha256?: string;
  mediaType: string;
};

export type OwnerLocalDatabaseTarget = {
  host: 'localhost' | '127.0.0.1' | '::1';
  port: number;
  maintenanceDatabase: string;
  disposableDatabasePrefix: string;
};

export type OwnerHistoricalLocalRehearsalStep =
  | 'verify-local-database-target'
  | 'create-unique-disposable-database'
  | 'read-owner-files-from-approved-absolute-paths'
  | 'hash-retained-owner-bytes'
  | 'parse-workbooks-and-open-statement'
  | 'build-historical-import-plan'
  | 'write-plan-to-disposable-database'
  | 'verify-controls-and-retained-byte-hashes'
  | 'drop-disposable-database';

export type OwnerHistoricalLocalRehearsalDesign = {
  sources: OwnerHistoricalSourceDescriptor[];
  database: OwnerLocalDatabaseTarget;
  safety: {
    fileContentsAreNotCommitted: true;
    productionIsForbidden: true;
    ownerRowsAreNotLogged: true;
    disposableDatabaseOnly: true;
  };
  plannedSteps: OwnerHistoricalLocalRehearsalStep[];
};

export type OwnerHistoricalLocalRehearsalResult = {
  plan: HistoricalImportPlan;
  retainedSourceHashes: Record<OwnerHistoricalSourceRole, string>;
  disposableDatabaseName: string;
};

export const REQUIRED_OWNER_SOURCE_ROLES: OwnerHistoricalSourceRole[] = [
  'concludedWorkbook2024',
  'concludedWorkbook2025',
  'openStatementCsv2026',
  'openStatementPdf2026',
];

export const isLocalOwnerRehearsalHost = (host: string): host is OwnerLocalDatabaseTarget['host'] =>
  host === 'localhost' || host === '127.0.0.1' || host === '::1';

export const describeOwnerHistoricalLocalRehearsal = (input: {
  sources: OwnerHistoricalSourceDescriptor[];
  database: OwnerLocalDatabaseTarget;
  repoRoot: string;
}): OwnerHistoricalLocalRehearsalDesign => {
  const repoRoot = path.resolve(input.repoRoot);

  if (!isLocalOwnerRehearsalHost(input.database.host)) {
    throw new Error('Owner historical rehearsal database must be local-only.');
  }

  for (const role of REQUIRED_OWNER_SOURCE_ROLES) {
    if (!input.sources.some((source) => source.role === role)) {
      throw new Error(`Missing owner historical source descriptor: ${role}.`);
    }
  }

  for (const source of input.sources) {
    const absolutePath = path.resolve(source.absolutePath);
    if (!path.isAbsolute(source.absolutePath)) {
      throw new Error(`Owner historical source path must be absolute: ${source.role}.`);
    }
    if (absolutePath === repoRoot || absolutePath.startsWith(`${repoRoot}${path.sep}`)) {
      throw new Error(`Owner historical source must stay outside the Git repository: ${source.role}.`);
    }
  }

  return {
    sources: input.sources,
    database: input.database,
    safety: {
      fileContentsAreNotCommitted: true,
      productionIsForbidden: true,
      ownerRowsAreNotLogged: true,
      disposableDatabaseOnly: true,
    },
    plannedSteps: [
      'verify-local-database-target',
      'create-unique-disposable-database',
      'read-owner-files-from-approved-absolute-paths',
      'hash-retained-owner-bytes',
      'parse-workbooks-and-open-statement',
      'build-historical-import-plan',
      'write-plan-to-disposable-database',
      'verify-controls-and-retained-byte-hashes',
      'drop-disposable-database',
    ],
  };
};
