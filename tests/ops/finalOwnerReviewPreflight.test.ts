/**
 * OPS-014 — Final owner review preflight tests.
 *
 * Pure static checks. No database, network, production host, push, tag,
 * migration, or import is used.
 */

import { describe, expect, it } from 'vitest';
import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  buildFinalOwnerReviewPreflight,
  renderFinalOwnerReviewPreflightMarkdown,
} from '../../scripts/final-owner-review-preflight.mjs';

const repoRoot = process.cwd();

describe('final owner review preflight — CLI guards', () => {
  it('--help exits 0 and documents guards', () => {
    const output = execSync('node scripts/final-owner-review-preflight.mjs --help', {
      encoding: 'utf-8',
      cwd: repoRoot,
    });
    expect(output).toContain('--check');
    expect(output).toContain('--strict');
    expect(output).toContain('--help');
    expect(output).toContain('Leest geen .env');
    expect(output).toContain('Geen push');
  });

  it('default mode prints a Dutch report', () => {
    const output = execSync('node scripts/final-owner-review-preflight.mjs', {
      encoding: 'utf-8',
      cwd: repoRoot,
    });
    expect(output).toContain('Yeshua Academy Finance');
    expect(output).toContain('GEREED VOOR EIGENAARSBEOORDELING');
    expect(output).toContain('Bevestiging:');
  });

  it('--check mode exits 0 and prints Dutch report', () => {
    const output = execSync('node scripts/final-owner-review-preflight.mjs --check', {
      encoding: 'utf-8',
      cwd: repoRoot,
    });
    expect(output).toContain('Yeshua Academy Finance');
  });
});

describe('final owner review preflight — required files exist', () => {
  const requiredFiles = [
    'docs/RELEASE_MANIFEST_NL.md',
    'docs/OWNER_REVIEW_FINAL_PACKET_NL.md',
    'docs/OWNER_APPROVAL_INTAKE_NL.md',
    'docs/OWNER_APPROVED_ACTION_PLAN_NL.md',
    'docs/PUSH_READINESS_CHECKLIST_NL.md',
    'docs/SAFE_COMMAND_INVENTORY_NL.md',
    'scripts/final-docs-consistency-audit.mjs',
    'scripts/final-owner-review-preflight.mjs',
  ];

  for (const file of requiredFiles) {
    it(`${file} exists`, () => {
      expect(existsSync(resolve(repoRoot, file))).toBe(true);
    });
  }
});

describe('final owner review preflight — decision on real repo', () => {
  it('returns READY_FOR_OWNER_REVIEW when repo is in expected state', () => {
    const result = buildFinalOwnerReviewPreflight({ repoRoot });
    const failed = result.checks.filter((c) => !c.ok);
    expect(failed, `Failed checks: ${failed.map((c) => c.label).join(', ')}`).toHaveLength(0);
    expect(result.decision).toBe('READY_FOR_OWNER_REVIEW');
    expect(result.readyForOwnerReview).toBe('JA');
  });

  it('HEAD is populated', () => {
    const result = buildFinalOwnerReviewPreflight({ repoRoot });
    expect(result.head).toMatch(/^[0-9a-f]{7,}/);
  });

  it('includes safe next commands', () => {
    const result = buildFinalOwnerReviewPreflight({ repoRoot });
    expect(result.safeNextCommands.length).toBeGreaterThan(0);
    expect(result.safeNextCommands.some((cmd) => cmd.includes('validate:release-candidate'))).toBe(true);
  });
});

describe('final owner review preflight — renders Dutch markdown', () => {
  it('renders a complete Dutch markdown report', () => {
    const result = buildFinalOwnerReviewPreflight({ repoRoot });
    const markdown = renderFinalOwnerReviewPreflightMarkdown(result);
    expect(markdown).toContain('Yeshua Academy Finance');
    expect(markdown).toContain('GEREED VOOR EIGENAARSBEOORDELING');
    expect(markdown).toContain('Veilige volgende commando');
    expect(markdown).toContain('Bevestiging:');
    expect(markdown).not.toContain('git push');
    expect(markdown).not.toContain('DATABASE_URL=postgresql://');
  });
});

describe('final owner review preflight — guards against forbidden state', () => {
  it('returns NOT_READY on wrong branch', () => {
    const result = buildFinalOwnerReviewPreflight({
      repoRoot,
      branch: 'feature/test',
      head: 'abc1234',
      status: '## feature/test...origin/feature/test\n',
      dirtyPaths: [],
    });
    expect(result.decision).toBe('NOT_READY');
    expect(result.checks.find((c) => c.id === 'branch')?.ok).toBe(false);
  });

  it('returns NOT_READY when unexpected dirty files exist', () => {
    const result = buildFinalOwnerReviewPreflight({
      repoRoot,
      branch: 'main',
      head: 'abc1234',
      status: '## main...origin/main\n M docs/OWNER_HANDOFF_NL.md\n',
      dirtyPaths: ['docs/OWNER_HANDOFF_NL.md'],
    });
    expect(result.decision).toBe('NOT_READY');
    expect(result.checks.find((c) => c.id === 'worktree')?.ok).toBe(false);
  });
});
