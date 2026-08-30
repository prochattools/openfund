import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../server/services/monthlyStatementPackageService', () => ({
  finalizeStagedMonthlyStatement: vi.fn(),
  importMonthlyStatementEvidence: vi.fn(),
}));

import {
  finalizeStagedMonthlyStatement,
  importMonthlyStatementEvidence,
} from '../../server/services/monthlyStatementPackageService';
import { runStatementImportTransaction } from '../../server/services/statementImportTransactionService';

type FinancialState = {
  sourceFiles: number;
  accounts: number;
  ledgers: number;
  importBatches: number;
  transactions: number;
  bankStatements: number;
  statementPeriods: number;
};

const emptyState = (): FinancialState => ({
  sourceFiles: 0,
  accounts: 0,
  ledgers: 0,
  importBatches: 0,
  transactions: 0,
  bankStatements: 0,
  statementPeriods: 0,
});

const increase = (state: FinancialState, fields: Array<keyof FinancialState>) => {
  for (const field of fields) state[field] += 1;
};

const makeClient = () => {
  const committed = emptyState();
  const transactionClients: unknown[] = [];
  const client = {
    $transaction: vi.fn(async (callback: (tx: { state: FinancialState }) => Promise<unknown>) => {
      const pending = { ...committed };
      const tx = { state: pending };
      transactionClients.push(tx);
      const result = await callback(tx);
      Object.assign(committed, pending);
      return result;
    }),
  };
  return { client, committed, transactionClients };
};

const input = {
  userId: 'user-1',
  workspaceId: 'workspace-1',
  expectedMonthKey: '2026-08',
  csv: { buffer: Buffer.from('csv'), filename: 'august.csv', mediaType: 'text/csv' },
  pdf: { buffer: Buffer.from('pdf'), filename: 'august.pdf', mediaType: 'application/pdf' },
};

const stagedResult = { status: 'CSV_IMPORTED' as const };
const completedResult = { status: 'IMPORTED' as const };

describe('statement import transaction boundary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each([
    ['parse validation before insertion', async () => {
      throw new Error('parse failure');
    }],
    ['conflicting prior data before insertion', async () => {
      throw new Error('conflict');
    }],
    ['transaction insertion after earlier writes', async ({ db }: { db: { state: FinancialState } }) => {
      increase(db.state, ['sourceFiles', 'accounts', 'ledgers', 'importBatches', 'transactions']);
      throw new Error('insert failure');
    }],
    ['post-import convergence validation', async ({ db }: { db: { state: FinancialState } }) => {
      increase(db.state, ['sourceFiles', 'accounts', 'ledgers', 'importBatches', 'transactions']);
      throw new Error('convergence failure');
    }],
    ['statement transaction-count validation', async ({ db }: { db: { state: FinancialState } }) => {
      increase(db.state, ['sourceFiles', 'accounts', 'ledgers', 'importBatches', 'transactions']);
      throw new Error('count failure');
    }],
  ])('rolls back %s', async (_name, importer) => {
    const { client, committed } = makeClient();
    (importMonthlyStatementEvidence as ReturnType<typeof vi.fn>).mockImplementation(importer);

    await expect(runStatementImportTransaction(client as any, input)).rejects.toThrow();
    expect(committed).toEqual(emptyState());
  });

  it('rolls back staged source and inserted facts when statement-period creation fails', async () => {
    const { client, committed } = makeClient();
    (importMonthlyStatementEvidence as ReturnType<typeof vi.fn>).mockImplementation(async ({ db }) => {
      increase(db.state, ['sourceFiles', 'accounts', 'ledgers', 'importBatches', 'transactions']);
      return stagedResult;
    });
    (finalizeStagedMonthlyStatement as ReturnType<typeof vi.fn>).mockImplementation(async ({ db }) => {
      increase(db.state, ['bankStatements', 'statementPeriods']);
      throw new Error('statement-period failure');
    });

    await expect(runStatementImportTransaction(client as any, input)).rejects.toThrow('statement-period failure');
    expect(committed).toEqual(emptyState());
  });

  it('propagates the same transaction client through import and finalization and commits only on success', async () => {
    const { client, committed, transactionClients } = makeClient();
    (importMonthlyStatementEvidence as ReturnType<typeof vi.fn>).mockImplementation(async ({ db }) => {
      increase(db.state, ['sourceFiles', 'accounts', 'ledgers', 'importBatches', 'transactions']);
      return stagedResult;
    });
    (finalizeStagedMonthlyStatement as ReturnType<typeof vi.fn>).mockImplementation(async ({ db }) => {
      increase(db.state, ['bankStatements', 'statementPeriods']);
      return completedResult;
    });

    const result = await runStatementImportTransaction(client as any, input);

    expect(result).toEqual(completedResult);
    expect(committed).toEqual({
      sourceFiles: 1,
      accounts: 1,
      ledgers: 1,
      importBatches: 1,
      transactions: 1,
      bankStatements: 1,
      statementPeriods: 1,
    });
    expect((importMonthlyStatementEvidence as ReturnType<typeof vi.fn>).mock.calls[0][0].db)
      .toBe((finalizeStagedMonthlyStatement as ReturnType<typeof vi.fn>).mock.calls[0][0].db);
    expect(transactionClients).toHaveLength(1);
  });
});
