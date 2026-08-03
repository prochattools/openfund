import { describe, expect, it } from 'vitest';
import { runBestPrefillComparisonCli } from '../../server/cli/runBestPrefillComparison';

// ---------------------------------------------------------------------------
// Mock database factory
// ---------------------------------------------------------------------------

const makeMockDb = (overrides: Record<string, unknown> = {}): any =>
  ({
    financeWorkspace: {
      findUnique: async ({ where }: any): Promise<any> => ({ id: where.id, isActive: true }),
    },
    user: {
      findUnique: async ({ where }: any): Promise<any> => ({ id: where.id, isActive: true }),
    },
    workspaceMembership: {
      findUnique: async ({ where }: any): Promise<any> => ({
        id: 'mem-1',
        isActive: true,
        workspaceId: where.workspaceId_userId.workspaceId,
        userId: where.workspaceId_userId.userId,
        workspace: { isActive: true },
        user: { isActive: true },
      }),
    },
    transaction: {
      findMany: async (): Promise<any[]> => [],
    },
    transactionBooking: {
      findMany: async (): Promise<any[]> => [],
    },
    project: {
      findMany: async (): Promise<any[]> => [],
    },
    transactionType: {
      findMany: async (): Promise<any[]> => [],
    },
    category: {
      findMany: async (): Promise<any[]> => [],
    },
    categorizationSuggestion: {
      findMany: async (): Promise<any[]> => [],
    },
    ...overrides,
  }) as any;

const makeInput = (overrides: Partial<Parameters<typeof runBestPrefillComparisonCli>[0]> = {}): Parameters<typeof runBestPrefillComparisonCli>[0] => ({
  args: [],
  env: {
    DATABASE_URL: 'postgresql://finance_user:x@localhost:5433/finance?schema=finance',
    DEFAULT_WORKSPACE_ID: 'ws-1',
    DEFAULT_USER_ID: 'user-1',
  } as unknown as NodeJS.ProcessEnv,
  createDb: async (): Promise<{ db: any; disconnect: () => Promise<void> }> => ({ db: makeMockDb(), disconnect: async (): Promise<void> => {} }),
  write: (_: string): void => {},
  ...overrides,
});

// Wrap a mock DB in a createDb factory with correct types
const wrapDb = (db: any): Parameters<typeof runBestPrefillComparisonCli>[0]['createDb'] =>
  async (): Promise<{ db: any; disconnect: () => Promise<void> }> => ({
    db,
    disconnect: async (): Promise<void> => {},
  });

// Capture all write calls and return them
const captureOutput = () => {
  const lines: string[] = [];
  return {
    write: (line: string) => lines.push(line),
    get lines() {
      return lines;
    },
    get json() {
      return lines.map((l) => {
        try {
          return JSON.parse(l);
        } catch {
          return l;
        }
      });
    },
  };
};

// ---------------------------------------------------------------------------
// Scope validation tests
// ---------------------------------------------------------------------------

describe('runBestPrefillComparisonCli — scope validation', () => {
  it('returns WORKSPACE_OR_USER_REQUIRED when DATABASE_URL is present but workspace ID is missing', async () => {
    const out = captureOutput();
    const code = await runBestPrefillComparisonCli(
      makeInput({
        env: {
          DATABASE_URL: 'postgresql://finance_user:x@localhost:5433/finance?schema=finance',
          DEFAULT_USER_ID: 'user-1',
        } as unknown as NodeJS.ProcessEnv,
        write: out.write,
      }),
    );
    expect(code).toBe(2);
    expect(out.json[0]).toMatchObject({ ok: false, errorCode: 'WORKSPACE_OR_USER_REQUIRED' });
  });

  it('returns WORKSPACE_OR_USER_REQUIRED when user ID is missing', async () => {
    const out = captureOutput();
    const code = await runBestPrefillComparisonCli(
      makeInput({
        env: {
          DATABASE_URL: 'postgresql://finance_user:x@localhost:5433/finance?schema=finance',
          DEFAULT_WORKSPACE_ID: 'ws-1',
        } as unknown as NodeJS.ProcessEnv,
        write: out.write,
      }),
    );
    expect(code).toBe(2);
    expect(out.json[0]).toMatchObject({ ok: false, errorCode: 'WORKSPACE_OR_USER_REQUIRED' });
  });

  it('returns DATABASE_URL_REQUIRED when DATABASE_URL is missing', async () => {
    const out = captureOutput();
    const code = await runBestPrefillComparisonCli(
      makeInput({
        env: {
          DEFAULT_WORKSPACE_ID: 'ws-1',
          DEFAULT_USER_ID: 'user-1',
        } as unknown as NodeJS.ProcessEnv,
        write: out.write,
      }),
    );
    expect(code).toBe(2);
    expect(out.json[0]).toMatchObject({ ok: false, errorCode: 'DATABASE_URL_REQUIRED' });
  });

  it('returns WORKSPACE_NOT_FOUND when workspace does not exist', async () => {
    const out = captureOutput();
    const code = await runBestPrefillComparisonCli(
      makeInput({
        createDb: wrapDb(makeMockDb({
          financeWorkspace: {
            findUnique: async (): Promise<null> => null,
          },
        })),
        write: out.write,
      }),
    );
    expect(code).toBe(1);
    expect(out.json[0]).toMatchObject({ ok: false, errorCode: 'WORKSPACE_NOT_FOUND' });
  });

  it('returns WORKSPACE_INACTIVE when workspace is inactive', async () => {
    const out = captureOutput();
    const code = await runBestPrefillComparisonCli(
      makeInput({
        createDb: wrapDb(makeMockDb({
          financeWorkspace: {
            findUnique: async (): Promise<{ id: string; isActive: boolean }> => ({ id: 'ws-1', isActive: false }),
          },
        })),
        write: out.write,
      }),
    );
    expect(code).toBe(1);
    expect(out.json[0]).toMatchObject({ ok: false, errorCode: 'WORKSPACE_INACTIVE' });
  });

  it('returns USER_NOT_FOUND when user does not exist', async () => {
    const out = captureOutput();
    const code = await runBestPrefillComparisonCli(
      makeInput({
        createDb: wrapDb(makeMockDb({
          user: {
            findUnique: async (): Promise<null> => null,
          },
        })),
        write: out.write,
      }),
    );
    expect(code).toBe(1);
    expect(out.json[0]).toMatchObject({ ok: false, errorCode: 'USER_NOT_FOUND' });
  });

  it('returns USER_INACTIVE when user is inactive', async () => {
    const out = captureOutput();
    const code = await runBestPrefillComparisonCli(
      makeInput({
        createDb: wrapDb(makeMockDb({
          user: {
            findUnique: async (): Promise<{ id: string; isActive: boolean }> => ({ id: 'user-1', isActive: false }),
          },
        })),
        write: out.write,
      }),
    );
    expect(code).toBe(1);
    expect(out.json[0]).toMatchObject({ ok: false, errorCode: 'USER_INACTIVE' });
  });

  it('returns USER_NOT_MEMBER_OF_WORKSPACE when membership does not exist', async () => {
    const out = captureOutput();
    const code = await runBestPrefillComparisonCli(
      makeInput({
        createDb: wrapDb(makeMockDb({
          workspaceMembership: {
            findUnique: async (): Promise<null> => null,
          },
        })),
        write: out.write,
      }),
    );
    expect(code).toBe(1);
    expect(out.json[0]).toMatchObject({ ok: false, errorCode: 'USER_NOT_MEMBER_OF_WORKSPACE' });
  });

  it('returns MEMBERSHIP_INACTIVE when membership is inactive', async () => {
    const out = captureOutput();
    const code = await runBestPrefillComparisonCli(
      makeInput({
        createDb: wrapDb(makeMockDb({
          workspaceMembership: {
            findUnique: async ({ where }: any): Promise<any> => ({
              id: 'mem-1',
              isActive: false,
              workspaceId: where.workspaceId_userId.workspaceId,
              userId: where.workspaceId_userId.userId,
              workspace: { isActive: true },
              user: { isActive: true },
            }),
          },
        })),
        write: out.write,
      }),
    );
    expect(code).toBe(1);
    expect(out.json[0]).toMatchObject({ ok: false, errorCode: 'MEMBERSHIP_INACTIVE' });
  });

  it('does not include IDs, emails, or URLs in scope-failure output', async () => {
    const out = captureOutput();
    await runBestPrefillComparisonCli(
      makeInput({
        createDb: wrapDb(makeMockDb({
          financeWorkspace: { findUnique: async (): Promise<null> => null },
        })),
        write: out.write,
      }),
    );
    const serialized = out.lines.join('\n');
    expect(serialized).not.toContain('ws-1');
    expect(serialized).not.toContain('user-1');
    expect(serialized).not.toContain('@');
    expect(serialized).not.toContain('localhost');
  });
});

// ---------------------------------------------------------------------------
// Helper: build a mock DB that returns a list of transactions
// ---------------------------------------------------------------------------

const makeTxDb = (transactions: any[]): any =>
  makeMockDb({
    transaction: {
      findMany: async (_args: any): Promise<any[]> => {
        // The first call is from buildOwnerHistoryProposalPlan (open transactions),
        // the second is from the main CLI loop (unresolved transactions).
        // Both should return the same list in test context.
        return transactions;
      },
    },
    transactionBooking: { findMany: async (): Promise<any[]> => [] },
    project: { findMany: async (): Promise<any[]> => [] },
    transactionType: { findMany: async (): Promise<any[]> => [] },
    category: { findMany: async (): Promise<any[]> => [] },
  });

const makeBaseTx = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  id: 'tx-1',
  direction: 'credit' as string,
  projectId: null as string | null,
  transactionTypeId: null as string | null,
  categoryId: null as string | null,
  project: null as object | null,
  transactionType: null as object | null,
  category: null as object | null,
  transactionBooking: null as object | null,
  categorizationSuggestions: [] as unknown[],
  ...overrides,
});

const makeProject = (id = 'p-1', workspaceId = 'ws-1') => ({
  id,
  code: 'YA',
  name: 'Yeshua Academy',
  isActive: true,
  workspaceId,
});

const makeTransactionType = (id = 'tt-1', workspaceId = 'ws-1'): Record<string, unknown> => ({
  id,
  literalName: 'Schenking in',
  isActive: true,
  direction: null as string | null,
  workspaceId,
});

const makeCategory = (id = 'cat-1', workspaceId = 'ws-1') => ({
  id,
  name: 'Giften',
  isActive: true,
  workspaceId,
});

const makeSuggestion = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  id: 'sg-1',
  workspaceId: 'ws-1',
  transactionId: 'tx-1',
  projectId: 'p-1',
  transactionTypeId: 'tt-1',
  categoryId: 'cat-1',
  producerKey: null as string | null,
  producerVersion: null as string | null,
  rank: 1,
  confidence: 'EXACT_FALLBACK',
  matcher: 'NORMALIZED_HISTORY',
  scoreBasisPoints: 10000,
  evidenceHash: 'h',
  status: 'PENDING',
  project: makeProject(),
  transactionType: makeTransactionType(),
  category: makeCategory(),
  ...overrides,
});

// ---------------------------------------------------------------------------
// Production parity tests
// ---------------------------------------------------------------------------

describe('runBestPrefillComparisonCli — production parity (selectReviewPrefill)', () => {
  it('authoritative transaction wins: counts as AUTHORITATIVE_TRANSACTION', async () => {
    const out = captureOutput();
    const tx = makeBaseTx({
      projectId: 'p-1',
      transactionTypeId: 'tt-1',
      categoryId: 'cat-1',
      project: makeProject(),
      transactionType: makeTransactionType(),
      category: makeCategory(),
    });
    const code = await runBestPrefillComparisonCli(
      makeInput({
        args: ['--json'],
        createDb: wrapDb(makeTxDb([tx])),
        write: out.write,
      }),
    );
    expect(code).toBe(0);
    const report = out.json[0];
    expect(report.policySelectionCounts.selectedAuthoritativeTransaction).toBe(1);
    expect(report.policySelectionCounts.selectedNone).toBe(0);
    expect(report.policySelectionCounts.total).toBe(1);
  });

  it('existing booking wins over suggestions', async () => {
    const out = captureOutput();
    const tx = makeBaseTx({
      transactionBooking: {
        id: 'bk-1',
        projectId: 'p-1',
        transactionTypeId: 'tt-1',
        categoryId: 'cat-1',
        literalProjectLabel: 'Yeshua Academy',
        literalTypeLabel: 'Schenking in',
        literalCategoryLabel: 'Giften',
        project: { code: 'YA' },
        transactionType: { literalName: 'Schenking in' },
        category: { name: 'Giften' },
      },
      categorizationSuggestions: [makeSuggestion()],
    });
    const code = await runBestPrefillComparisonCli(
      makeInput({
        args: ['--json'],
        createDb: wrapDb(makeTxDb([tx])),
        write: out.write,
      }),
    );
    expect(code).toBe(0);
    const report = out.json[0];
    expect(report.policySelectionCounts.selectedExistingBooking).toBe(1);
    expect(report.policySelectionCounts.selectedLegacyFallback).toBe(0);
  });

  it('valid legacy suggestion → LEGACY_HISTORY_FALLBACK', async () => {
    const out = captureOutput();
    const tx = makeBaseTx({
      categorizationSuggestions: [makeSuggestion()],
    });
    const code = await runBestPrefillComparisonCli(
      makeInput({
        args: ['--json'],
        createDb: wrapDb(makeTxDb([tx])),
        write: out.write,
      }),
    );
    expect(code).toBe(0);
    const report = out.json[0];
    expect(report.policySelectionCounts.selectedLegacyFallback).toBe(1);
    expect(report.policySelectionCounts.selectedNone).toBe(0);
  });

  it('no valid source → NONE', async () => {
    const out = captureOutput();
    // Suggestion with wrong workspace → ineligible
    const tx = makeBaseTx({
      categorizationSuggestions: [
        makeSuggestion({
          workspaceId: 'ws-OTHER',
          project: makeProject('p-1', 'ws-OTHER'),
        }),
      ],
    });
    const code = await runBestPrefillComparisonCli(
      makeInput({
        args: ['--json'],
        createDb: wrapDb(makeTxDb([tx])),
        write: out.write,
      }),
    );
    expect(code).toBe(0);
    const report = out.json[0];
    expect(report.policySelectionCounts.selectedNone).toBe(1);
  });

  it('non-PENDING suggestions are already excluded by the DB query filter', async () => {
    // The query uses where: { status: 'PENDING' }, so non-pending never arrive.
    // Verify that a tx with no suggestions (simulating filtered-out non-pending) → NONE.
    const out = captureOutput();
    const tx = makeBaseTx({ categorizationSuggestions: [] });
    const code = await runBestPrefillComparisonCli(
      makeInput({
        args: ['--json'],
        createDb: wrapDb(makeTxDb([tx])),
        write: out.write,
      }),
    );
    expect(code).toBe(0);
    const report = out.json[0];
    expect(report.policySelectionCounts.selectedNone).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Projection / assertion tests
// ---------------------------------------------------------------------------

describe('runBestPrefillComparisonCli — assertion flags', () => {
  it('dry run reports writesPerformed: false in output', async () => {
    const out = captureOutput();
    const code = await runBestPrefillComparisonCli(makeInput({ args: ['--json'], write: out.write }));
    expect(code).toBe(0);
    expect(out.json[0].safetyGuards.writesPerformed).toBe(false);
  });

  it('--expected-total assertion passes when count matches', async () => {
    const out = captureOutput();
    const code = await runBestPrefillComparisonCli(
      makeInput({
        args: ['--expected-total', '0', '--json'],
        write: out.write,
      }),
    );
    expect(code).toBe(0);
    expect(out.json[0].assertionsPassed).toBe(true);
  });

  it('--expected-total assertion fails when count mismatches', async () => {
    const out = captureOutput();
    const tx = makeBaseTx();
    const code = await runBestPrefillComparisonCli(
      makeInput({
        args: ['--expected-total', '999'],
        createDb: wrapDb(makeTxDb([tx])),
        write: out.write,
      }),
    );
    expect(code).toBe(1);
    expect(out.json[0]).toMatchObject({ ok: false, errorCode: 'ASSERTION_FAILED' });
    expect(out.json[0].assertionFailures[0]).toContain('--expected-total');
  });

  it('--expected-complete-prefills assertion fails when mismatched', async () => {
    const out = captureOutput();
    const tx = makeBaseTx({
      projectId: 'p-1',
      transactionTypeId: 'tt-1',
      categoryId: 'cat-1',
      project: makeProject(),
      transactionType: makeTransactionType(),
      category: makeCategory(),
    });
    const code = await runBestPrefillComparisonCli(
      makeInput({
        args: ['--expected-complete-prefills', '0'],
        createDb: wrapDb(makeTxDb([tx])),
        write: out.write,
      }),
    );
    expect(code).toBe(1);
    expect(out.json[0]).toMatchObject({ ok: false, errorCode: 'ASSERTION_FAILED' });
    expect(out.json[0].assertionFailures[0]).toContain('--expected-complete-prefills');
  });

  it('--expected-none assertion fails when mismatched', async () => {
    const out = captureOutput();
    // Transaction with no suggestions → NONE count = 1
    const tx = makeBaseTx();
    const code = await runBestPrefillComparisonCli(
      makeInput({
        args: ['--expected-none', '99'],
        createDb: wrapDb(makeTxDb([tx])),
        write: out.write,
      }),
    );
    expect(code).toBe(1);
    expect(out.json[0]).toMatchObject({ ok: false, errorCode: 'ASSERTION_FAILED' });
    expect(out.json[0].assertionFailures[0]).toContain('--expected-none');
  });

  it('all assertions pass when counts match → return code 0', async () => {
    const out = captureOutput();
    const tx = makeBaseTx();
    const code = await runBestPrefillComparisonCli(
      makeInput({
        args: ['--expected-total', '1', '--expected-none', '1', '--expected-complete-prefills', '0', '--json'],
        createDb: wrapDb(makeTxDb([tx])),
        write: out.write,
      }),
    );
    expect(code).toBe(0);
    expect(out.json[0].assertionsPassed).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Reporting tests
// ---------------------------------------------------------------------------

describe('runBestPrefillComparisonCli — reporting', () => {
  it('policySelectionCounts.total equals totalUnresolvedTransactions', async () => {
    const out = captureOutput();
    const txs = [makeBaseTx({ id: 'tx-a' }), makeBaseTx({ id: 'tx-b' }), makeBaseTx({ id: 'tx-c' })];
    const code = await runBestPrefillComparisonCli(
      makeInput({
        args: ['--json'],
        createDb: wrapDb(makeTxDb(txs)),
        write: out.write,
      }),
    );
    expect(code).toBe(0);
    const report = out.json[0];
    expect(report.policySelectionCounts.total).toBe(report.aggregateCounts.totalUnresolvedTransactions);
    expect(report.policySelectionCounts.total).toBe(3);
  });

  it('JSON output contains schemaVersion', async () => {
    const out = captureOutput();
    const code = await runBestPrefillComparisonCli(makeInput({ args: ['--json'], write: out.write }));
    expect(code).toBe(0);
    expect(out.json[0]).toHaveProperty('schemaVersion');
    expect(typeof out.json[0].schemaVersion).toBe('string');
  });

  it('output contains no PII: no @ signs, no raw workspace IDs in top-level fields', async () => {
    const out = captureOutput();
    const code = await runBestPrefillComparisonCli(makeInput({ args: ['--json'], write: out.write }));
    expect(code).toBe(0);
    const serialized = out.lines.join('\n');
    expect(serialized).not.toContain('@');
    // Workspace/user IDs should not appear outside aggregate count structures
    expect(serialized).not.toContain('"ws-1"');
    expect(serialized).not.toContain('"user-1"');
  });

  it('unexpected exception returns errorCode UNEXPECTED_ERROR with no message field', async () => {
    const out = captureOutput();
    const code = await runBestPrefillComparisonCli(
      makeInput({
        createDb: async () => {
          throw new Error('database connection refused: host=finance-db diagnostic=secret123');
        },
        write: out.write,
      }),
    );
    expect(code).toBe(1);
    expect(out.json[0]).toMatchObject({ ok: false, errorCode: 'UNEXPECTED_ERROR' });
    // Must not leak the error message containing potential PII or credentials
    expect(out.json[0]).not.toHaveProperty('message');
  });

  it('non-text mode (no --json) writes human-readable lines, not JSON', async () => {
    const out = captureOutput();
    const code = await runBestPrefillComparisonCli(makeInput({ args: [], write: out.write }));
    expect(code).toBe(0);
    // At least one line should be non-JSON human-readable text
    const hasHumanReadable = out.lines.some((line) => line.includes('===') || line.includes('---') || line.includes('Safety'));
    expect(hasHumanReadable).toBe(true);
  });
});
