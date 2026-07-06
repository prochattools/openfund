/**
 * OPS-015 — Owner-approved action planner guards.
 *
 * Pure local tests for the dry-run action planner. No network, database,
 * production host, dependency installation, push, tag, email, secret rotation,
 * or historical import is executed.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import {
  buildApprovedActionPlan,
  main,
  OUTPUT_PATH,
  renderApprovedActionPlan,
  VALID_DECISIONS,
} from '../../scripts/owner-approved-action-plan.mjs';

const forbiddenRuntimePattern = /git\s+push|git\s+tag|npm\s+install|npm\s+ci|pnpm\s+install|yarn\s+install|resend\.emails\.send|sendMail|10\.0\.2\.4|dokploy/i;

afterEach(() => {
  vi.restoreAllMocks();
});

describe('owner approved action plan — model', () => {
  it('supports all owner-gated decisions', () => {
    expect(VALID_DECISIONS).toEqual([
      'pdf',
      'production-cutover',
      'historical-import',
      'email',
      'push',
      'secret-rotation',
      'postgres-version',
    ]);
  });

  it.each(VALID_DECISIONS)('renders a dry-run-only plan for %s', (decision) => {
    const result = buildApprovedActionPlan({ decision });
    const output = renderApprovedActionPlan(result);
    expect(output).toContain('DRY-RUN PLAN ONLY — GEEN UITVOERING');
    expect(output).toContain('Vereiste approval evidence');
    expect(output).toContain('Vereiste preflights');
    expect(output).toContain('Stopregels');
    expect(output).not.toMatch(forbiddenRuntimePattern);
  });

  it('fails safely for unknown decisions', () => {
    const result = buildApprovedActionPlan({ decision: 'not-real' });
    expect(result.ok).toBe(false);
    expect(renderApprovedActionPlan(result)).toContain('Onbekende beslissing');
  });

  it('reports missing docs without writing files', () => {
    const tempRoot = mkdtempSync(join(tmpdir(), 'yaf-owner-action-plan-'));
    try {
      const result = buildApprovedActionPlan({ repoRoot: tempRoot, decision: 'pdf' });
      expect(result.ok).toBe(false);
      expect(result.missingDocs.length).toBeGreaterThan(0);
      expect(existsSync(join(tempRoot, OUTPUT_PATH))).toBe(false);
    } finally {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });
});

describe('owner approved action plan — main entrypoint', () => {
  it('--help exits 0 and documents guardrails', () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    expect(main(['--help'])).toBe(0);
    const output = String(log.mock.calls[0]?.[0] ?? '');
    expect(output).toContain('--decision pdf');
    expect(output).toContain('DRY-RUN PLAN ONLY');
    expect(output).toContain('Leest geen .env');
  });

  it('default mode prints a PDF plan and does not write the generated doc', () => {
    const outputPath = resolve(process.cwd(), OUTPUT_PATH);
    const before = existsSync(outputPath) ? readFileSync(outputPath, 'utf-8') : null;
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    expect(main([])).toBe(0);
    const output = String(log.mock.calls[0]?.[0] ?? '');
    expect(output).toContain('Echte PDF-renderer implementeren');
    expect(output).toContain('DRY-RUN PLAN ONLY — GEEN UITVOERING');
    const after = existsSync(outputPath) ? readFileSync(outputPath, 'utf-8') : null;
    expect(after).toBe(before);
  });

  it('selected decisions produce safe plans', () => {
    for (const decision of ['pdf', 'push', 'historical-import']) {
      const result = buildApprovedActionPlan({ decision });
      const output = renderApprovedActionPlan(result);
      expect(output).toContain('DRY-RUN PLAN ONLY — GEEN UITVOERING');
      expect(output).not.toMatch(forbiddenRuntimePattern);
    }
  });

  it('--write updates only the generated action plan document and restores test state', () => {
    const outputPath = resolve(process.cwd(), OUTPUT_PATH);
    const before = existsSync(outputPath) ? readFileSync(outputPath, 'utf-8') : null;
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    try {
      expect(main(['--decision', 'pdf', '--write'])).toBe(0);
      const after = readFileSync(outputPath, 'utf-8');
      expect(after).toContain('DRY-RUN PLAN ONLY — GEEN UITVOERING');
      expect(after).toContain('Echte PDF-renderer implementeren');
      expect(String(log.mock.calls[0]?.[0] ?? '')).toContain('PLAN GEREED VOOR REVIEW');
    } finally {
      if (before === null) {
        rmSync(outputPath, { force: true });
      } else {
        writeFileSync(outputPath, before);
      }
    }
  });
});
