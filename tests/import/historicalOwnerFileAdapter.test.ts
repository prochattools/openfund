import { describe, expect, it } from 'vitest';
import {
  describeOwnerHistoricalLocalRehearsal,
  isLocalOwnerRehearsalHost,
  type OwnerHistoricalSourceDescriptor,
} from '../../lib/import/historicalOwnerFileAdapter';

const sources: OwnerHistoricalSourceDescriptor[] = [
  {
    role: 'concludedWorkbook2024',
    absolutePath: '/Users/Office/Documents/Church/Yeshua Academy/Administratie/2026/YA financieel jaar 2024.xlsx',
    mediaType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  },
  {
    role: 'concludedWorkbook2025',
    absolutePath: '/Users/Office/Documents/Church/Yeshua Academy/Administratie/2026/YA financieel jaar 2025 v2.xlsx',
    mediaType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  },
  {
    role: 'openStatementCsv2026',
    absolutePath: '/Users/Office/Documents/Church/Yeshua Academy/Administratie/2026/NL89INGB0006369960_2026-01-01_2026-07-01.csv',
    mediaType: 'text/csv',
  },
  {
    role: 'openStatementPdf2026',
    absolutePath: '/Users/Office/Documents/Church/Yeshua Academy/Administratie/2026/NL89INGB0006369960_2026-01-01_2026-07-01.pdf',
    mediaType: 'application/pdf',
  },
];

describe('historical owner file adapter design', () => {
  it('describes a future local-only owner rehearsal without reading files', () => {
    const design = describeOwnerHistoricalLocalRehearsal({
      sources,
      repoRoot: process.cwd(),
      database: {
        host: 'localhost',
        port: 5452,
        maintenanceDatabase: 'postgres',
        disposableDatabasePrefix: 'owner_historical_rehearsal',
      },
    });

    expect(design.safety).toEqual({
      fileContentsAreNotCommitted: true,
      productionIsForbidden: true,
      ownerRowsAreNotLogged: true,
      disposableDatabaseOnly: true,
    });
    expect(design.plannedSteps).toContain('hash-retained-owner-bytes');
    expect(design.plannedSteps).toContain('drop-disposable-database');
  });

  it('rejects non-local database hosts and repo-contained owner paths', () => {
    expect(isLocalOwnerRehearsalHost('localhost')).toBe(true);
    expect(isLocalOwnerRehearsalHost('127.0.0.1')).toBe(true);
    expect(isLocalOwnerRehearsalHost('::1')).toBe(true);
    expect(isLocalOwnerRehearsalHost('10.0.2.4')).toBe(false);
    expect(isLocalOwnerRehearsalHost('example.com')).toBe(false);

    expect(() =>
      describeOwnerHistoricalLocalRehearsal({
        sources,
        repoRoot: process.cwd(),
        database: {
          host: '10.0.2.4' as 'localhost',
          port: 5432,
          maintenanceDatabase: 'postgres',
          disposableDatabasePrefix: 'owner_historical_rehearsal',
        },
      }),
    ).toThrow('Owner historical rehearsal database must be local-only.');

    expect(() =>
      describeOwnerHistoricalLocalRehearsal({
        sources: [
          {
            ...sources[0],
            absolutePath: `${process.cwd()}/owner-file.xlsx`,
          },
          ...sources.slice(1),
        ],
        repoRoot: process.cwd(),
        database: {
          host: 'localhost',
          port: 5452,
          maintenanceDatabase: 'postgres',
          disposableDatabasePrefix: 'owner_historical_rehearsal',
        },
      }),
    ).toThrow('Owner historical source must stay outside the Git repository');
  });
});
