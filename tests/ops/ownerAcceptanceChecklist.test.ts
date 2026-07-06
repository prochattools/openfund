/**
 * OPS-016 — Owner acceptance checklist guard.
 *
 * Static documentation guard only. No shell execution, database, network,
 * provider, production host, email, import, push, tag, or dependency install.
 */

import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const repoRoot = process.cwd();
const checklistPath = resolve(repoRoot, 'docs/OWNER_ACCEPTANCE_CHECKLIST_NL.md');
const checklist = existsSync(checklistPath) ? readFileSync(checklistPath, 'utf-8') : '';

const ownerGatedBlockers = [
  'Echte PDF-renderer',
  'Productiecutover',
  'Historische productie-import',
  'Echte e-mailverzending',
  'Push naar remote',
  'Secret rotation',
  'Productie PostgreSQL-versie',
];

const safeCommands = [
  'npm run validate:release-candidate',
  'npm run preflight:final-owner-review',
  'node scripts/final-owner-review-preflight.mjs --check',
  'node scripts/owner-go-no-go-preflight.mjs --strict',
  'node scripts/push-readiness-preflight.mjs --strict',
];

const forbiddenContentPattern = new RegExp(
  [
    ['DATABASE', '_URL=postgresql://'].join(''),
    ['PG', 'PASS', 'WORD='].join(''),
    ['sk', '_live_'].join(''),
    ['pk', '_live_'].join(''),
    'AKIA[0-9A-Z]{16}',
    ['10', '\\.', '0', '\\.', '2', '\\.', '4'].join(''),
    ['dok', 'ploy'].join(''),
    ['prochattools', '-', 'jpv', '-', 'bootcamp'].join(''),
    ['brain', '-', 'video', '-', 'orchestrator'].join(''),
  ].join('|'),
  'i',
);

describe('owner acceptance checklist — static owner packet guard', () => {
  it('checklist exists', () => {
    expect(existsSync(checklistPath)).toBe(true);
    expect(checklist).toContain('Owner acceptance checklist');
  });

  it('includes all remaining owner-gated blockers', () => {
    for (const blocker of ownerGatedBlockers) {
      expect(checklist).toContain(blocker);
    }
  });

  it('includes all safe validation and preflight commands', () => {
    for (const command of safeCommands) {
      expect(checklist).toContain(command);
    }
  });

  it('says acceptance does not approve gated execution', () => {
    for (const phrase of [
      'geen toestemming',
      'PDF-renderer installeren',
      'Productiecutover',
      'Historische productie-import',
      'Echte e-mail',
      'Push naar remote',
      'Secret rotation',
    ]) {
      expect(checklist).toContain(phrase);
    }
  });

  it('does not contain secrets, production hosts, or unrelated repos', () => {
    expect(checklist).not.toMatch(forbiddenContentPattern);
  });

  it('links to final owner review packet and owner approval intake', () => {
    expect(checklist).toContain('docs/OWNER_REVIEW_FINAL_PACKET_NL.md');
    expect(checklist).toContain('docs/OWNER_APPROVAL_INTAKE_NL.md');
  });

  it('does not use shell execution in this guard test', () => {
    const testContent = readFileSync(resolve(repoRoot, 'tests/ops/ownerAcceptanceChecklist.test.ts'), 'utf-8');
    expect(testContent).not.toContain(['child', '_', 'process'].join(''));
    expect(testContent).not.toContain(['exec', 'Sync'].join(''));
  });
});
