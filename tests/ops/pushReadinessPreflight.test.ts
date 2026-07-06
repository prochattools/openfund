/**
 * OPS-014 — Future push readiness preflight.
 *
 * Pure local tests for checking whether a future owner-approved remote publish
 * would be ready. The script never pushes, tags, reads .env, or mutates files.
 */

import { describe, expect, it } from 'vitest';
import { execSync } from 'node:child_process';

import {
  buildPushReadinessPreflight,
  renderPushReadinessPreflight,
} from '../../scripts/push-readiness-preflight.mjs';

describe('push readiness preflight — checks', () => {
  it('allows only Graphify artifacts as dirty paths', () => {
    const result = buildPushReadinessPreflight({
      branch: 'main',
      head: 'abcdef0',
      status: '## main\n?? .graphifyignore\n?? graphify-out/\n',
      trackedFiles: ['package.json', 'docs/OWNER_HANDOFF_NL.md', 'docs/RELEASE_MANIFEST_NL.md', 'docs/PUSH_READINESS_CHECKLIST_NL.md'],
    });
    expect(result.decision).toBe('READY_FOR_OWNER_APPROVED_PUSH');
  });

  it('rejects unexpected dirty files', () => {
    const result = buildPushReadinessPreflight({
      branch: 'main',
      head: 'abcdef0',
      status: '## main\n M docs/OWNER_HANDOFF_NL.md\n?? graphify-out/\n',
      trackedFiles: ['package.json', 'docs/OWNER_HANDOFF_NL.md', 'docs/RELEASE_MANIFEST_NL.md', 'docs/PUSH_READINESS_CHECKLIST_NL.md'],
    });
    expect(result.decision).toBe('NO_GO');
    expect(result.checks.some((check) => check.id === 'worktree' && !check.ok)).toBe(true);
  });

  it('rejects non-main branches', () => {
    const result = buildPushReadinessPreflight({
      branch: 'feature/test',
      head: 'abcdef0',
      status: '## feature/test\n',
      trackedFiles: ['package.json', 'docs/OWNER_HANDOFF_NL.md', 'docs/RELEASE_MANIFEST_NL.md', 'docs/PUSH_READINESS_CHECKLIST_NL.md'],
    });
    expect(result.checks.some((check) => check.id === 'branch' && !check.ok)).toBe(true);
  });

  it('rejects tracked .env, dumps, and owner production sources', () => {
    const result = buildPushReadinessPreflight({
      branch: 'main',
      head: 'abcdef0',
      status: '## main\n M .env\n',
      trackedFiles: [
        'package.json',
        'docs/OWNER_HANDOFF_NL.md',
        'docs/RELEASE_MANIFEST_NL.md',
        'docs/PUSH_READINESS_CHECKLIST_NL.md',
        '.env',
        'backups/finance.dump',
        'private/owner-source-2025.xlsx',
      ],
    });
    expect(result.decision).toBe('NO_GO');
    expect(result.checks.some((check) => check.id === 'env' && !check.ok)).toBe(true);
    expect(result.checks.some((check) => check.id === 'dumps' && !check.ok)).toBe(true);
    expect(result.checks.some((check) => check.id === 'owner_sources' && !check.ok)).toBe(true);
  });
});

describe('push readiness preflight — CLI', () => {
  it('--help exits 0 and documents guardrails', () => {
    const output = execSync('node scripts/push-readiness-preflight.mjs --help', {
      cwd: process.cwd(),
      encoding: 'utf-8',
    });
    expect(output).toContain('--strict');
    expect(output).toContain('Leest geen .env');
    expect(output).toContain('Publiceert niets');
  });

  it('default mode prints the future prompt without publishing commands', () => {
    const output = execSync('node scripts/push-readiness-preflight.mjs', {
      cwd: process.cwd(),
      encoding: 'utf-8',
    });
    expect(output).toContain('Toekomstige push-prompt');
    expect(output).toContain('Publish the current main commit');
    expect(output).not.toMatch(/git\s+push|git\s+tag|force-push/i);
    expect(output).not.toContain('PGPASSWORD=');
  });

  it('clean allowed state renders strict-ready decision', () => {
    const report = renderPushReadinessPreflight(buildPushReadinessPreflight({
      branch: 'main',
      head: 'abcdef0',
      status: '## main\n?? .graphifyignore\n?? graphify-out/\n',
      trackedFiles: ['package.json', 'docs/OWNER_HANDOFF_NL.md', 'docs/RELEASE_MANIFEST_NL.md', 'docs/PUSH_READINESS_CHECKLIST_NL.md'],
    }));
    expect(report).toContain('GEREED VOOR OWNER-APPROVED PUSH');
  });

  it('rendered report confirms no mutation occurred', () => {
    const report = renderPushReadinessPreflight(buildPushReadinessPreflight({
      branch: 'main',
      head: 'abcdef0',
      status: '## main\n',
      trackedFiles: ['package.json', 'docs/OWNER_HANDOFF_NL.md', 'docs/RELEASE_MANIFEST_NL.md', 'docs/PUSH_READINESS_CHECKLIST_NL.md'],
    }));
    expect(report).toContain('niets gepubliceerd');
    expect(report).toContain('geen bestanden gewijzigd');
  });
});
