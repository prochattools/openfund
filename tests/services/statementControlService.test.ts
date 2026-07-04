import { describe, expect, it } from 'vitest';
import { StatementCoverageStatus } from '@prisma/client';
import {
  acceptBankStatement,
  assertStatementTotals,
  hashSourceContent,
  readSourceFileBytes,
  StatementControlError,
  storeSourceFile,
} from '../../server/services/statementControlService';

describe('statement control service', () => {
  it('hashes retained source bytes and downloads them byte-identically', async () => {
    const content = Buffer.from('Date,Name,Amount\n2026-01-01,Gift,123.45\n');
    const calls: any[] = [];
    const stored = {
      id: 'source-1',
      workspaceId: 'workspace-1',
      filename: 'ing.csv',
      mediaType: 'text/csv',
      sizeBytes: content.byteLength,
      sha256: hashSourceContent(content),
      content,
      uploadedBy: 'admin-1',
      createdAt: new Date('2026-07-04T00:00:00Z'),
    };
    const db = {
      sourceFile: {
        upsert: async (args: any) => {
          calls.push(['upsert', args]);
          return stored;
        },
        findFirst: async (args: any) => {
          calls.push(['findFirst', args]);
          return stored;
        },
      },
    } as any;

    const result = await storeSourceFile(db, {
      workspaceId: 'workspace-1',
      filename: 'ing.csv',
      mediaType: 'text/csv',
      content,
      uploadedBy: 'admin-1',
    });
    const downloaded = await readSourceFileBytes(db, {
      workspaceId: 'workspace-1',
      sourceFileId: result.id,
    });

    expect(result.sha256).toBe(hashSourceContent(content));
    expect(result.sizeBytes).toBe(content.byteLength);
    expect(downloaded.equals(content)).toBe(true);
    expect(calls[0][1].where).toEqual({
      workspaceId_sha256: {
        workspaceId: 'workspace-1',
        sha256: hashSourceContent(content),
      },
    });
  });

  it('rejects statement totals that do not reconcile exactly', () => {
    expect(() => assertStatementTotals({
      openingBalanceMinor: 1000,
      incomeMinor: 250,
      expenseMinor: 100,
      closingBalanceMinor: 1149,
    })).toThrow(StatementControlError);
  });

  it('accepts a statement and creates exact statement periods', async () => {
    const calls: any[] = [];
    const db = {
      bankStatement: {
        findUnique: async (args: any) => {
          calls.push(['findUnique', args]);
          return null;
        },
        create: async (args: any) => {
          calls.push(['create', args]);
          return { id: 'statement-1', ...args.data };
        },
      },
    } as any;

    const statement = await acceptBankStatement(db, {
      workspaceId: 'workspace-1',
      accountId: 'account-1',
      sourceFileId: 'source-1',
      periodStart: new Date('2026-01-01T00:00:00Z'),
      periodEnd: new Date('2026-01-31T23:59:59Z'),
      coverageStatus: StatementCoverageStatus.COMPLETE,
      openingBalanceMinor: 1000n,
      incomeMinor: 250n,
      expenseMinor: 100n,
      closingBalanceMinor: 1150n,
      transactionCount: 2,
      bankAccountIdentifier: 'NL89INGB0006369960',
      acceptedBy: 'admin-1',
      periods: [{
        accountId: 'account-1',
        periodStart: new Date('2026-01-01T00:00:00Z'),
        periodEnd: new Date('2026-01-31T23:59:59Z'),
        coverageStatus: StatementCoverageStatus.COMPLETE,
        openingBalanceMinor: 1000n,
        incomeMinor: 250n,
        expenseMinor: 100n,
        closingBalanceMinor: 1150n,
        transactionCount: 2,
      }],
    });

    expect(statement.netMinor).toBe(150n);
    expect(calls[0]).toEqual(['findUnique', { where: { sourceFileId: 'source-1' } }]);
    expect(calls[1][1].data.periods.create[0]).toMatchObject({
      workspaceId: 'workspace-1',
      accountId: 'account-1',
      netMinor: 150n,
      transactionCount: 2,
    });
  });

  it('rejects duplicate source files as duplicate accepted statements', async () => {
    const db = {
      bankStatement: {
        findUnique: async () => ({ id: 'statement-existing' }),
      },
    } as any;

    await expect(acceptBankStatement(db, {
      workspaceId: 'workspace-1',
      accountId: 'account-1',
      sourceFileId: 'source-1',
      periodStart: new Date('2026-01-01T00:00:00Z'),
      periodEnd: new Date('2026-01-31T23:59:59Z'),
      coverageStatus: StatementCoverageStatus.COMPLETE,
      openingBalanceMinor: 1000,
      incomeMinor: 250,
      expenseMinor: 100,
      closingBalanceMinor: 1150,
      transactionCount: 2,
      bankAccountIdentifier: 'NL89INGB0006369960',
    })).rejects.toMatchObject({
      message: 'Dit bronbestand is al als bankafschrift geaccepteerd.',
      statusCode: 409,
    });
  });
});
