/**
 * OPS-020 — Owner approval intake validator guard.
 *
 * Static validator tests. No shell execution, network, database, .env,
 * production, provider, email, import, push, tag, or dependency install.
 */

import { describe, expect, it } from 'vitest';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import {
  buildApprovalIntakeValidation,
  DECISION_GUIDANCE,
  main,
  OUTPUT_PATH,
  renderApprovalIntakeValidation,
  VALID_DECISIONS,
} from '../../scripts/owner-approval-intake-validator.mjs';

const expectedDecisions = [
  'pdf',
  'postgres-version',
  'production-cutover',
  'historical-import',
  'email',
  'secret-rotation',
  'push',
];

describe('owner approval intake validator — model', () => {
  it('supports all owner-gated decisions', () => {
    expect(VALID_DECISIONS).toEqual(expectedDecisions);
    expect(Object.keys(DECISION_GUIDANCE)).toEqual(expectedDecisions);
  });

  it('builds guidance for all decisions by default', () => {
    const result = buildApprovalIntakeValidation();
    expect(result.ok).toBe(true);
    expect(result.decisions.map((decision) => decision.key)).toEqual(expectedDecisions);
  });

  it('builds decision-specific guidance', () => {
    for (const decision of expectedDecisions) {
      const result = buildApprovalIntakeValidation({ decision });
      expect(result.ok).toBe(true);
      expect(result.decisions).toHaveLength(1);
      expect(result.decisions[0].key).toBe(decision);
      expect(result.decisions[0].minimumFields.length).toBeGreaterThan(0);
      expect(result.decisions[0].forbiddenAmbiguousApprovals.length).toBeGreaterThan(0);
      expect(result.decisions[0].preflightCommands.length).toBeGreaterThan(0);
      expect(result.decisions[0].validationCommands.length).toBeGreaterThan(0);
      expect(result.decisions[0].stopRules.length).toBeGreaterThan(0);
      expect(result.decisions[0].evidenceToReport.length).toBeGreaterThan(0);
    }
  });

  it('renders Dutch markdown guidance', () => {
    const output = renderApprovalIntakeValidation(buildApprovalIntakeValidation({ decision: 'pdf' }));
    expect(output).toContain('Owner approval intake validation');
    expect(output).toContain('Minimum required approval fields');
    expect(output).toContain('Forbidden ambiguous approvals');
    expect(output).toContain('Required preflight commands');
    expect(output).toContain('Required validation commands');
    expect(output).toContain('Stop rules');
    expect(output).toContain('Evidence to report back');
    expect(output).toContain('Deze validator voert niets uit');
  });
});

describe('owner approval intake validator — main entrypoint', () => {
  function run(args: string[], repoRoot = process.cwd()) {
    let output = '';
    const exitCode = main(args, {
      repoRoot,
      stdout: { write: (chunk: string) => { output += chunk; } },
    });
    return { exitCode, output };
  }

  it('--help exits 0', () => {
    const { exitCode, output } = run(['--help']);
    expect(exitCode).toBe(0);
    expect(output).toContain('--decision pdf');
    expect(output).toContain('--json');
    expect(output).toContain('--write');
  });

  it('default mode prints guidance', () => {
    const { exitCode, output } = run([]);
    expect(exitCode).toBe(0);
    expect(output).toContain('Owner approval intake validation');
    expect(output).toContain('Remote publish');
  });

  it('each supported decision exits 0 and prints decision guidance', () => {
    for (const decision of expectedDecisions) {
      const { exitCode, output } = run(['--decision', decision]);
      expect(exitCode).toBe(0);
      expect(output).toContain(`Sleutel: \`${decision}\``);
      expect(output).toContain('Stop rules');
    }
  });

  it('--json prints machine-readable guidance', () => {
    const { exitCode, output } = run(['--json']);
    expect(exitCode).toBe(0);
    const parsed = JSON.parse(output) as { status: string; decisions: Array<{ key: string }> };
    expect(parsed.status).toBe('OWNER_APPROVAL_INTAKE_VALIDATION_READY');
    expect(parsed.decisions.map((decision) => decision.key)).toEqual(expectedDecisions);
  });

  it('--write writes only the generated validation document', () => {
    const tempRoot = mkdtempSync(join(tmpdir(), 'yaf-approval-intake-'));
    try {
      const { exitCode, output } = run(['--write'], tempRoot);
      expect(exitCode).toBe(0);
      expect(output).toContain(OUTPUT_PATH);
      const written = readFileSync(resolve(tempRoot, OUTPUT_PATH), 'utf-8');
      expect(written).toContain('Owner approval intake validation');
      expect(written).toContain('Deze validator voert niets uit');
    } finally {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it('unknown decisions fail safely', () => {
    const { exitCode, output } = run(['--decision', 'unknown']);
    expect(exitCode).toBe(1);
    expect(output).toContain('ONBEKENDE BESLISSING');
  });

  it('script and test source avoid shell execution helpers', () => {
    const scriptSource = readFileSync(resolve(process.cwd(), 'scripts/owner-approval-intake-validator.mjs'), 'utf-8');
    const testSource = readFileSync(resolve(process.cwd(), 'tests/ops/ownerApprovalIntakeValidator.test.ts'), 'utf-8');
    for (const source of [scriptSource, testSource]) {
      expect(source).not.toContain(['child', '_', 'process'].join(''));
      expect(source).not.toContain(['exec', 'Sync'].join(''));
    }
    expect(existsSync(resolve(process.cwd(), 'scripts/owner-approval-intake-validator.mjs'))).toBe(true);
  });
});
