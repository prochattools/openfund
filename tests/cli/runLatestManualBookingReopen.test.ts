import { describe, expect, it } from 'vitest';
import { runLatestManualBookingReopenCli } from '../../server/cli/runLatestManualBookingReopen';

const env = {
  DATABASE_URL: 'postgresql://finance_user:x@localhost:5433/finance?schema=finance',
  DEFAULT_WORKSPACE_ID: 'workspace-1',
};

const exactArgs = [
  '--expected-amount-minor', '8855',
  '--expected-direction', 'credit',
  '--expected-merchant', 'vistaprint',
  '--expected-unresolved-before', '34',
];

const noConnect = async () => {
  throw new Error('must not connect');
};

describe('runLatestManualBookingReopenCli', () => {
  it('requires database and workspace configuration', async () => {
    const output: string[] = [];
    const code = await runLatestManualBookingReopenCli({
      args: exactArgs,
      env: {},
      createDb: noConnect,
      write: (value) => output.push(value),
    });

    expect(code).toBe(2);
    expect(JSON.parse(output[0]!)).toMatchObject({
      ok: false,
      errorCode: 'DATABASE_OR_WORKSPACE_REQUIRED',
    });
  });

  it('requires exact amount, direction, merchant, and unresolved expectations', async () => {
    const output: string[] = [];
    const code = await runLatestManualBookingReopenCli({
      args: [],
      env,
      createDb: noConnect,
      write: (value) => output.push(value),
    });

    expect(code).toBe(2);
    expect(JSON.parse(output[0]!)).toMatchObject({
      ok: false,
      errorCode: 'EXACT_EXPECTATIONS_REQUIRED',
    });
  });

  it('requires both a confirmed hash and explicit single-reopen authorization', async () => {
    const output: string[] = [];
    const code = await runLatestManualBookingReopenCli({
      args: [...exactArgs, '--execute'],
      env,
      createDb: noConnect,
      write: (value) => output.push(value),
    });

    expect(code).toBe(2);
    expect(JSON.parse(output[0]!)).toMatchObject({
      ok: false,
      errorCode: 'EXECUTION_CONFIRMATION_REQUIRED',
    });
  });
});
