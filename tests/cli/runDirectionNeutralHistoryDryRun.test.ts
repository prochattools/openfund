import { describe, expect, it } from 'vitest';
import { runDirectionNeutralHistoryDryRunCli } from '../../server/cli/runDirectionNeutralHistoryDryRun';

describe('runDirectionNeutralHistoryDryRunCli', () => {
  it('requires explicit read-only acknowledgement before connecting', async () => {
    const output: string[] = [];
    const code = await runDirectionNeutralHistoryDryRunCli({
      args: [], env: { DATABASE_URL: 'hidden', DEFAULT_WORKSPACE_ID: 'hidden' },
      createDb: async () => { throw new Error('must not connect'); }, write: (value) => output.push(value),
    });
    expect(code).toBe(2);
    expect(output).toEqual([JSON.stringify({ ok: false, errorCode: 'READ_ONLY_ACKNOWLEDGEMENT_REQUIRED' })]);
  });

  it('requires database and workspace configuration', async () => {
    const output: string[] = [];
    const code = await runDirectionNeutralHistoryDryRunCli({
      args: ['--read-only'], env: {},
      createDb: async () => { throw new Error('must not connect'); }, write: (value) => output.push(value),
    });
    expect(code).toBe(2);
    expect(output).toEqual([JSON.stringify({ ok: false, errorCode: 'DATABASE_OR_WORKSPACE_REQUIRED' })]);
  });
});
