import fs from 'node:fs';
import type { OwnerHistoricalSourceDescriptor } from '../../lib/import/historicalOwnerFileAdapter';

export const OWNER_HISTORICAL_SOURCE_PATHS = {
  concludedWorkbook2024: '/Users/Office/Documents/Church/Yeshua Academy/Administratie/2026/YA financieel jaar 2024.xlsx',
  concludedWorkbook2025: '/Users/Office/Documents/Church/Yeshua Academy/Administratie/2026/YA financieel jaar 2025 v2.xlsx',
  openStatementCsv2026: '/Users/Office/Documents/Church/Yeshua Academy/Administratie/2026/NL89INGB0006369960_2026-01-01_2026-07-01.csv',
  openStatementPdf2026: '/Users/Office/Documents/Church/Yeshua Academy/Administratie/2026/NL89INGB0006369960_2026-01-01_2026-07-01.pdf',
} as const;

export const OWNER_HISTORICAL_SOURCES: OwnerHistoricalSourceDescriptor[] = [
  {
    role: 'concludedWorkbook2024',
    absolutePath: OWNER_HISTORICAL_SOURCE_PATHS.concludedWorkbook2024,
    expectedSha256: '844699610889c6986fec305cdbb7b760da3dfc1d556ab9d0e160c854e1bc7f9f',
    mediaType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  },
  {
    role: 'concludedWorkbook2025',
    absolutePath: OWNER_HISTORICAL_SOURCE_PATHS.concludedWorkbook2025,
    expectedSha256: 'd3913b876f3a6b8ddc3d19c49ef9778125e5e109a7d3ac330afbb3d6d8d7b2ff',
    mediaType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  },
  {
    role: 'openStatementCsv2026',
    absolutePath: OWNER_HISTORICAL_SOURCE_PATHS.openStatementCsv2026,
    expectedSha256: '768912927a7bb3b545616631e6d5360479a90b0bc6448faa3f225925636d31d3',
    mediaType: 'text/csv',
  },
  {
    role: 'openStatementPdf2026',
    absolutePath: OWNER_HISTORICAL_SOURCE_PATHS.openStatementPdf2026,
    expectedSha256: '5e830a365fe0d87f67e883f24239f60674ed85a174e65db6520136511a6d58d2',
    mediaType: 'application/pdf',
  },
];

export const ownerHistoricalFilesAvailable = (): boolean =>
  OWNER_HISTORICAL_SOURCES.every((source) => fs.existsSync(source.absolutePath));
