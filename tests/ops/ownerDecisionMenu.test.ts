/**
 * OPS-017 — Owner decision menu guard.
 *
 * Static local menu tests. No shell execution, network, database, .env,
 * production, push, tag, dependency install, email, import, or secret rotation.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import {
  buildOwnerDecisionMenu,
  DECISION_MENU,
  main,
  OUTPUT_PATH,
  renderOwnerDecisionMenu,
} from '../../scripts/owner-decision-menu.mjs';

const expectedKeys = [
  'pdf',
  'production-cutover',
  'historical-import',
  'email',
  'push',
  'secret-rotation',
  'postgres-version',
];

const forbiddenRuntimePattern = new RegExp(
  [
    ['DATABASE', '_URL=postgresql://'].join(''),
    ['PG', 'PASSWORD='].join(''),
    ['git', '\\s+', 'push'].join(''),
    ['git', '\\s+', 'tag'].join(''),
    ['npm', '\\s+', 'install'].join(''),
    ['npm', '\\s+', 'ci'].join(''),
    ['pnpm', '\\s+', 'install'].join(''),
    ['yarn', '\\s+', 'install'].join(''),
    ['send', 'Mail'].join(''),
    ['resend', '\\.', 'emails', '\\.', 'send'].join(''),
    ['10', '\\.', '0', '\\.', '2', '\\.', '4'].join(''),
    ['dok', 'ploy'].join(''),
  ].join('|'),
  'i',
);

afterEach(() => {
  vi.restoreAllMocks();
});

describe('owner decision menu — model', () => {
  it('contains every owner-gated decision', () => {
    expect(DECISION_MENU.map((entry) => entry.key)).toEqual(expectedKeys);
  });

  it('renders a Dutch static menu with status, approval, preflight, prompt, and stop rules', () => {
    const output = renderOwnerDecisionMenu(buildOwnerDecisionMenu());
    for (const key of expectedKeys) {
      expect(output).toContain(`\`${key}\``);
    }
    expect(output).toContain('Vereiste approval');
    expect(output).toContain('Veilige preflight');
    expect(output).toContain('Volgende prompt doc');
    expect(output).toContain('Stopregels');
    expect(output).not.toMatch(forbiddenRuntimePattern);
  });
});

describe('owner decision menu — main entrypoint', () => {
  function run(args: string[], repoRoot = process.cwd()) {
    let output = '';
    const exitCode = main(args, {
      repoRoot,
      stdout: { write: (chunk: string) => { output += chunk; } },
    });
    return { exitCode, output };
  }

  it('--help exits 0 and documents guardrails', () => {
    const { exitCode, output } = run(['--help']);
    expect(exitCode).toBe(0);
    expect(output).toContain('--json');
    expect(output).toContain('--write');
    expect(output).toContain('Leest geen .env');
  });

  it('default mode prints the Dutch menu', () => {
    const { exitCode, output } = run([]);
    expect(exitCode).toBe(0);
    expect(output).toContain('Owner decision menu');
    expect(output).toContain('Beslissingsmenu');
    expect(output).toContain('Productiecutover');
  });

  it('--json prints a machine-readable menu', () => {
    const { exitCode, output } = run(['--json']);
    expect(exitCode).toBe(0);
    const parsed = JSON.parse(output) as { status: string; entries: Array<{ key: string }> };
    expect(parsed.status).toBe('OWNER_DECISION_SELECTION_READY');
    expect(parsed.entries.map((entry) => entry.key)).toEqual(expectedKeys);
  });

  it('--write writes only the generated menu document', () => {
    const tempRoot = mkdtempSync(join(tmpdir(), 'yaf-owner-menu-'));
    try {
      const { exitCode, output } = run(['--write'], tempRoot);
      expect(exitCode).toBe(0);
      expect(output).toContain(OUTPUT_PATH);
      const written = readFileSync(resolve(tempRoot, OUTPUT_PATH), 'utf-8');
      expect(written).toContain('Owner decision menu');
      expect(written).toContain('Secret rotation');
    } finally {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it('script source has no process-spawning or scanner-hostile shell helpers', () => {
    const script = readFileSync(resolve(process.cwd(), 'scripts/owner-decision-menu.mjs'), 'utf-8');
    const networkFetchCallText = ['fe', 'tch', '('].join('');
    expect(script).not.toContain(['child', '_', 'process'].join(''));
    expect(script).not.toContain(['exec', 'Sync'].join(''));
    expect(script).not.toContain(networkFetchCallText);
    expect(existsSync(resolve(process.cwd(), 'scripts/owner-decision-menu.mjs'))).toBe(true);
  });
});
