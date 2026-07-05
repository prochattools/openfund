import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import type { OwnerHistoricalSourceDescriptor } from '../../lib/import/historicalOwnerFileAdapter';
import {
  buildHistoricalOwnerImportCommand,
  classifyHistoricalOwnerImportDatabase,
  DEFAULT_OWNER_HISTORICAL_SOURCES,
} from '../../server/services/historicalOwnerImportCommandService';

const repoRoot = process.cwd();
const tempDirs: string[] = [];

const hashBuffer = (content: Buffer): string =>
  crypto.createHash('sha256').update(content).digest('hex');

const ownerFilesAvailable = () =>
  DEFAULT_OWNER_HISTORICAL_SOURCES.every((source) => fs.existsSync(source.absolutePath));

const makeTempSources = (overrides: Partial<OwnerHistoricalSourceDescriptor> = {}) => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'owner-import-command-'));
  tempDirs.push(tempDir);
  const files: Record<OwnerHistoricalSourceDescriptor['role'], Buffer> = {
    concludedWorkbook2024: Buffer.from('not a real workbook 2024'),
    concludedWorkbook2025: Buffer.from('not a real workbook 2025'),
    openStatementCsv2026: Buffer.from('not a real csv'),
    openStatementPdf2026: Buffer.from('not a real pdf'),
  };

  return DEFAULT_OWNER_HISTORICAL_SOURCES.map((source) => {
    const filename = `${source.role}.${source.mediaType === 'application/pdf' ? 'pdf' : 'dat'}`;
    const content = files[source.role];
    const absolutePath = path.join(tempDir, filename);
    fs.writeFileSync(absolutePath, content);
    return {
      ...source,
      ...overrides,
      absolutePath,
      expectedSha256: hashBuffer(content),
    };
  });
};

afterEach(() => {
  while (tempDirs.length) {
    const tempDir = tempDirs.pop()!;
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

describe('historical owner import command', () => {
  it('defaults to dry-run and never performs database writes', async () => {
    const result = await buildHistoricalOwnerImportCommand({ repoRoot });

    expect(result.mode).toBe('dry-run');
    expect(result.requestedMode).toBe('dry-run');
    expect(result.defaultedToDryRun).toBe(true);
    expect(result.writesDatabase).toBe(false);
    expect(result.productionExecutionPerformed).toBe(false);
  });

  it('returns a sanitized dry-run summary when approved owner files are available, or skips safely when unavailable', async () => {
    const result = await buildHistoricalOwnerImportCommand({ repoRoot });

    if (!ownerFilesAvailable()) {
      expect(result.sourceAvailability).toBe('missing');
      expect(result.importPlanSummary).toBeNull();
      expect(result.executionBlockedReasons.some((reason) => reason.includes('file is missing'))).toBe(true);
      return;
    }

    expect(result.sourceAvailability).toBe('available');
    expect(result.importPlanSummary?.concluded2024.rowCount).toBe(268);
    expect(result.importPlanSummary?.concluded2025.rowCount).toBe(413);
    expect(result.importPlanSummary?.openStatement.rowCount).toBe(221);
    expect(result.importPlanSummary?.concluded2024.controlTotals.closingBalanceMinor).toBe('1218415');
    expect(result.importPlanSummary?.concluded2025.controlTotals.closingBalanceMinor).toBe('1035086');
    expect(result.importPlanSummary?.openStatement.controlTotals.closingBalanceMinor).toBe('783725');
  });

  it('does not include raw owner rows in the command result', async () => {
    const result = await buildHistoricalOwnerImportCommand({ repoRoot });
    const serialized = JSON.stringify(result);

    expect(serialized).not.toContain('rawRow');
    expect(serialized).not.toContain('paymentPurpose');
    expect(serialized).not.toContain('counterparty');
    expect(serialized).not.toContain('Notifications');
  });

  it('blocks production execution without explicit confirmations', async () => {
    const result = await buildHistoricalOwnerImportCommand({
      repoRoot,
      requestedMode: 'production',
    });

    expect(result.mode).toBe('production-blocked');
    expect(result.productionExecutionPerformed).toBe(false);
    expect(result.executionBlockedReasons).toContain('Production mode requires an explicit production command option.');
    expect(result.executionBlockedReasons).toContain('Production mode requires a reviewed dry-run summary.');
    expect(result.executionBlockedReasons).toContain('Production mode requires the operator confirmation token.');
    expect(result.executionBlockedReasons).toContain('Production execution is intentionally blocked in Packet G.');
  });

  it('blocks production execution when a source hash does not match, even with confirmations', async () => {
    const sources = makeTempSources();
    sources[0] = {
      ...sources[0],
      expectedSha256: '0'.repeat(64),
    };

    const result = await buildHistoricalOwnerImportCommand({
      repoRoot,
      sources,
      requestedMode: 'production',
      productionOptionConfirmed: true,
      dryRunSummaryAccepted: true,
      operatorConfirmationToken: 'I_UNDERSTAND_THIS_WOULD_IMPORT_OWNER_HISTORY',
      productionConfirmationToken: 'CONFIRM_OWNER_HISTORY_FAKE',
    });

    expect(result.mode).toBe('production-blocked');
    expect(result.sourceAvailability).toBe('invalid');
    expect(result.executionBlockedReasons).toContain('Owner historical source hash mismatch: concludedWorkbook2024.');
    expect(result.productionExecutionPerformed).toBe(false);
  });

  it('only allows local database targets for rehearsal mode and always rejects 10.0.2.4', async () => {
    expect(classifyHistoricalOwnerImportDatabase('postgresql://user:pass@localhost:5452/db').classification).toBe('local');
    expect(classifyHistoricalOwnerImportDatabase('postgresql://user:pass@127.0.0.1:5452/db').classification).toBe('local');
    expect(classifyHistoricalOwnerImportDatabase('postgresql://user:pass@[::1]:5452/db').classification).toBe('local');
    expect(classifyHistoricalOwnerImportDatabase('postgresql://user:pass@example.com:5432/db').classification).toBe('non-local');
    expect(classifyHistoricalOwnerImportDatabase('postgresql://user:pass@10.0.2.4:5432/db').classification).toBe('forbidden');

    const nonLocal = await buildHistoricalOwnerImportCommand({
      repoRoot,
      requestedMode: 'rehearsal',
      databaseUrl: 'postgresql://user:pass@example.com:5432/db',
    });
    expect(nonLocal.executionBlockedReasons).toContain(
      'Rehearsal mode only allows localhost, 127.0.0.1, or ::1 database targets.',
    );

    const forbidden = await buildHistoricalOwnerImportCommand({
      repoRoot,
      requestedMode: 'rehearsal',
      databaseUrl: 'postgresql://user:pass@10.0.2.4:5432/db',
    });
    expect(forbidden.databaseTarget.classification).toBe('forbidden');
    expect(forbidden.executionBlockedReasons).toContain(
      'The database host is explicitly forbidden for historical owner import commands.',
    );
  });

  it('rejects owner files inside the Git repository before reading contents', async () => {
    const result = await buildHistoricalOwnerImportCommand({
      repoRoot,
      sources: [
        {
          ...DEFAULT_OWNER_HISTORICAL_SOURCES[0],
          absolutePath: path.join(repoRoot, 'owner-source.xlsx'),
        },
        ...DEFAULT_OWNER_HISTORICAL_SOURCES.slice(1),
      ],
    });

    expect(result.sourceAvailability).toBe('invalid');
    expect(result.executionBlockedReasons).toContain(
      'Owner historical source must stay outside the Git repository: concludedWorkbook2024.',
    );
  });

  it('keeps 2026 partial and 2024/2025 close-eligible in the dry-run summary', async () => {
    if (!ownerFilesAvailable()) {
      return;
    }

    const result = await buildHistoricalOwnerImportCommand({ repoRoot });

    expect(result.importPlanSummary?.concluded2024.coverageStatus).toBe('COMPLETE');
    expect(result.importPlanSummary?.concluded2024.closePermitted).toBe(true);
    expect(result.importPlanSummary?.concluded2025.coverageStatus).toBe('COMPLETE');
    expect(result.importPlanSummary?.concluded2025.closePermitted).toBe(true);
    expect(result.importPlanSummary?.openStatement.coverageStatus).toBe('PARTIAL');
    expect(result.importPlanSummary?.openStatement.closePermitted).toBe(false);
  });
});
