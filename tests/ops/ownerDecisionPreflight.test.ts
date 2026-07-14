/**
 * OPS-013 — Owner decision preflight guards.
 *
 * Pure local tests for owner-gated decision readiness reports. No network,
 * database, provider, production host, dependency install, push, tag, email, or
 * historical import is used.
 */

import { describe, expect, it } from 'vitest';
import { execSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import {
  buildDecisionPreflight,
  OUTPUT_PATH,
  renderDecisionPreflight,
  REQUIRED_DOCS,
  VALID_DECISIONS,
} from '../../scripts/owner-decision-preflight.mjs';

const dangerousCommandPattern = /git\s+push|npm\s+install|npm\s+ci|pnpm\s+install|yarn\s+install|sendMail|resend\.emails\.send|historical.*production.*execute|dokploy|10\.0\.2\.4/i;
const withoutWorktreePaths = (output: string) => output.replace(/^- Dirty paths:.*$/m, '');

describe('owner decision preflight — report model', () => {
  it('supports every owner-gated decision', () => {
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

  it.each(VALID_DECISIONS)('renders blockers for %s', (decision) => {
    const result = buildDecisionPreflight({
      decision,
      gitStatus: '## main...origin/main\n?? .graphifyignore\n?? graphify-out/\n',
      branch: 'main',
      head: 'abcdef0',
    });
    const output = renderDecisionPreflight(result);
    expect(output).toContain('Blijft geblokkeerd zonder owner-goedkeuring: JA');
    expect(output).toContain('Vereiste eigenaarinput');
    expect(output).toContain('Stopregels');
    expect(withoutWorktreePaths(output)).not.toMatch(dangerousCommandPattern);
    expect(output).not.toContain('PGPASSWORD=');
    expect(output).not.toContain('DATABASE_URL=postgresql://');
  });

  it('unknown decision fails safely', () => {
    const result = buildDecisionPreflight({ decision: 'not-real' });
    expect(result.ok).toBe(false);
    expect(renderDecisionPreflight(result)).toContain('Onbekende eigenaarsbeslissing');
  });

  it('reports missing required docs without mutating files', () => {
    const tempRoot = mkdtempSync(join(tmpdir(), 'yaf-owner-decision-'));
    try {
      const result = buildDecisionPreflight({
        repoRoot: tempRoot,
        decision: 'pdf',
        gitStatus: '## main\n',
        branch: 'main',
        head: 'abcdef0',
      });
      expect(result.ok).toBe(false);
      expect(result.missingDocs).toEqual(REQUIRED_DOCS);
      expect(existsSync(join(tempRoot, OUTPUT_PATH))).toBe(false);
    } finally {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });
});

describe('owner decision preflight — CLI', () => {
  it('--help exits 0 and documents guardrails', () => {
    const output = execSync('node scripts/owner-decision-preflight.mjs --help', {
      cwd: process.cwd(),
      encoding: 'utf-8',
    });
    expect(output).toContain('--decision pdf');
    expect(output).toContain('Leest geen .env');
    expect(output).toContain('Voert geen productiecommando');
  });

  it('default mode prints a report and does not write the generated doc', () => {
    const outputPath = resolve(process.cwd(), OUTPUT_PATH);
    const before = existsSync(outputPath) ? readFileSync(outputPath, 'utf-8') : null;
    const output = execSync('node scripts/owner-decision-preflight.mjs', {
      cwd: process.cwd(),
      encoding: 'utf-8',
    });
    expect(output).toContain('Eigenaarsbeslissing preflight');
    expect(output).toContain('Echte PDF-renderer afhankelijkheid');
    const after = existsSync(outputPath) ? readFileSync(outputPath, 'utf-8') : null;
    expect(after).toBe(before);
  });

  it('each valid CLI decision produces a safe Dutch readiness report', () => {
    for (const decision of VALID_DECISIONS) {
      const output = execSync(`node scripts/owner-decision-preflight.mjs --decision ${decision}`, {
        cwd: process.cwd(),
        encoding: 'utf-8',
      });
      expect(output).toContain(`Sleutel: \`${decision}\``);
      expect(output).toContain('GEREED VOOR EIGENAARSREVIEW');
      expect(withoutWorktreePaths(output)).not.toMatch(dangerousCommandPattern);
      expect(output).not.toContain('local_dev_placeholder');
    }
  });

  it('unknown CLI decision exits non-zero with a safe message', () => {
    let stderr = '';
    try {
      execSync('node scripts/owner-decision-preflight.mjs --decision nope', {
        cwd: process.cwd(),
        encoding: 'utf-8',
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      throw new Error('expected command to fail');
    } catch (error) {
      stderr = String((error as { stderr?: string }).stderr ?? '');
    }
    expect(stderr).toContain('Onbekende eigenaarsbeslissing');
    expect(stderr).not.toMatch(dangerousCommandPattern);
  });

  it('--write produces the generated doc without secrets', () => {
    const outputPath = resolve(process.cwd(), OUTPUT_PATH);
    const before = existsSync(outputPath) ? readFileSync(outputPath, 'utf-8') : null;
    try {
      execSync('node scripts/owner-decision-preflight.mjs --decision pdf --write', {
        cwd: process.cwd(),
        encoding: 'utf-8',
      });
      const content = readFileSync(outputPath, 'utf-8');
      expect(content).toContain('Echte PDF-renderer afhankelijkheid');
      expect(withoutWorktreePaths(content)).not.toMatch(dangerousCommandPattern);
      expect(content).not.toContain('PGPASSWORD=');
    } finally {
      if (before == null) {
        if (existsSync(outputPath)) unlinkSync(outputPath);
      } else {
        writeFileSync(outputPath, before, 'utf-8');
      }
    }
  });
});
