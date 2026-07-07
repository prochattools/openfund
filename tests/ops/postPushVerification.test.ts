/**
 * OPS-018 — Post-push verification document guard.
 *
 * Static documentation guard only. No shell execution, network, database,
 * production host, provider, email, import, push, tag, or dependency install.
 */

import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const repoRoot = process.cwd();
const docPath = resolve(repoRoot, 'docs/POST_PUSH_VERIFICATION_NL.md');
const doc = existsSync(docPath) ? readFileSync(docPath, 'utf-8') : '';

const requiredLinks = [
  'OWNER_ACCEPTANCE_CHECKLIST_NL.md',
  'OWNER_DECISION_MENU_NL.md',
  'OWNER_APPROVAL_INTAKE_NL.md',
  'PUSH_READINESS_CHECKLIST_NL.md',
  'POST_APPROVAL_PROMPTS_NL.md',
];

const remainingBlockers = [
  'Real PDF renderer',
  'Production cutover',
  'Historical production import',
  'Real email sending',
  'Secret rotation',
  'Production PostgreSQL version confirmation',
];

const forbiddenContentPattern = new RegExp(
  [
    ['sk', '_live_'].join(''),
    ['pk', '_live_'].join(''),
    'AKIA[0-9A-Z]{16}',
    ['DATABASE', '_URL=postgresql://'].join(''),
    ['PG', 'PASS', 'WORD='].join(''),
    ['10', '\\.', '0', '\\.', '2', '\\.', '4'].join(''),
    ['dok', 'ploy'].join(''),
    ['M', 'CP bridge'].join(''),
    ['owner', ' source file path'].join(''),
    ['raw', ' row'].join(''),
    ['database', ' dump'].join(''),
  ].join('|'),
  'i',
);

describe('post push verification — static evidence guard', () => {
  it('post-push verification doc exists', () => {
    expect(existsSync(docPath)).toBe(true);
    expect(doc).toContain('Post-push verificatie');
  });

  it('references the pushed commit and branch', () => {
    expect(doc).toContain('f2f7cbb docs: update post push owner decision handoff');
    expect(doc).toContain('f2f7cbb3d4fa6e2c30f099158d97060e7d780dc6');
    expect(doc).toContain('`main`');
    expect(doc).toContain('origin/main');
    expect(doc).toContain('geen commits ahead of `origin/main`');
  });

  it('records that all six post-push owner-decision handoff commits were published', () => {
    for (const commit of ['e07be8f', 'a5ab4a8', '949823a', '84d13d7', '3866a43', 'f2f7cbb']) {
      expect(doc).toContain(commit);
    }
  });

  it('states production was not deployed or touched', () => {
    expect(doc).toContain('geen productieactie uitgevoerd');
    expect(doc).toContain('geen productie-release');
    expect(doc).toContain('Geen productiecutover');
  });

  it('states no tags and no force push', () => {
    expect(doc).toContain('Geen tags');
    expect(doc).toContain('Geen force push');
    expect(doc).toContain('geen force push gebruikt');
  });

  it('lists all remaining owner-gated blockers', () => {
    for (const blocker of remainingBlockers) {
      expect(doc).toContain(blocker);
    }
  });

  it('links to required owner decision documents', () => {
    for (const link of requiredLinks) {
      expect(doc).toContain(link);
    }
  });

  it('contains no secrets, owner source files, raw rows, dumps, or forbidden production targets', () => {
    expect(doc).not.toMatch(forbiddenContentPattern);
  });

  it('this test does not use shell execution or scanner-hostile helpers', () => {
    const testSource = readFileSync(resolve(repoRoot, 'tests/ops/postPushVerification.test.ts'), 'utf-8');
    expect(testSource).not.toContain(['child', '_', 'process'].join(''));
    expect(testSource).not.toContain(['exec', 'Sync'].join(''));
  });
});
