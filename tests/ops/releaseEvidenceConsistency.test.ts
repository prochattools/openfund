/**
 * OPS-009 — Release evidence consistency checks.
 *
 * Prevents RC handoff docs from drifting back to stale phase labels, stale
 * manifest evidence, or missing owner-facing release guard references.
 */

import { describe, expect, it } from 'vitest';
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const readDoc = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf-8');

const finalAudit = readDoc('docs/FINAL_READINESS_AUDIT_NL.md');
const ownerHandoff = readDoc('docs/OWNER_HANDOFF_NL.md');
const releaseManifest = readDoc('docs/RELEASE_MANIFEST_NL.md');
const roadmap = readDoc('docs/ROADMAP.md');
const implementationPlan = readDoc('docs/IMPLEMENTATION_PLAN.md');
const rebuildRun = readDoc('docs/finance-rebuild-run.md');
const pushChecklist = readDoc('docs/PUSH_READINESS_CHECKLIST_NL.md');
const ownerPreflight = readDoc('docs/OWNER_GO_NO_GO_PREFLIGHT_NL.md');
const pkg = JSON.parse(readDoc('package.json')) as { scripts: Record<string, string> };

function extractManifestCommit(content: string) {
  return content.match(/\| Commit \(volledig\) \| ([0-9a-f]{40}) \|/i)?.[1] ?? null;
}

describe('release evidence consistency — stale RC labels', () => {
  it('final readiness audit records Phase 8/9 as locally complete', () => {
    expect(finalAudit).toContain('Phase 8 — Infrastructuur | COMPLETE');
    expect(finalAudit).toContain('Phase 9 — Operationele hardening en overdracht | COMPLETE (local-only RC3)');
    expect(finalAudit).not.toContain('GEDEELTELIJK (INFRA-001, INFRA-002 gedocumenteerd)');
    expect(finalAudit).not.toContain('Phase 9 — Operationele hardening en overdracht | IN PROGRESS');
  });

  it('owner handoff no longer labels the one-step validation as RC2', () => {
    expect(ownerHandoff).toContain('### RC3-validatie in één stap');
    expect(ownerHandoff).not.toContain('### RC2-validatie in één stap');
  });

  it('roadmap and implementation plan identify the current handoff as RC3/RC4, not RC2', () => {
    expect(roadmap).toContain('COMPLETE (local-only RC3)');
    expect(implementationPlan).toContain('Current gate: Release Candidate 3 owner handoff');
    expect(rebuildRun).toContain('Status: Release Candidate 3');
    expect(implementationPlan).not.toContain('Current gate: Release Candidate 2 readiness');
  });
});

describe('release evidence consistency — manifest evidence', () => {
  it('release manifest is RC4 and no longer points at the stale RC2 count correction commit', () => {
    expect(releaseManifest).toContain('Release Candidate 4');
    expect(releaseManifest).toContain('Phase 8 — Infrastructuur en deployment | COMPLETE');
    expect(releaseManifest).toContain('Phase 9 — Operationele hardening en overdracht | COMPLETE (lokaal, RC4)');
    expect(releaseManifest).not.toContain('| Commit (kort) | 4f9cedf |');
    expect(releaseManifest).not.toContain('docs: correct RC2 final test counts');
  });

  it('manifest commit exists and is an ancestor of current HEAD', () => {
    const manifestCommit = extractManifestCommit(releaseManifest);
    expect(manifestCommit).toMatch(/^[0-9a-f]{40}$/);

    execSync(`git cat-file -e ${manifestCommit}^{commit}`, {
      cwd: process.cwd(),
      stdio: ['ignore', 'ignore', 'ignore'],
    });
    execSync(`git merge-base --is-ancestor ${manifestCommit} HEAD`, {
      cwd: process.cwd(),
      stdio: ['ignore', 'ignore', 'ignore'],
    });
  });
});

describe('release evidence consistency — owner guard references', () => {
  it('owner handoff links the preflight and push checklist', () => {
    expect(ownerHandoff).toContain('docs/OWNER_GO_NO_GO_PREFLIGHT_NL.md');
    expect(ownerHandoff).toContain('docs/PUSH_READINESS_CHECKLIST_NL.md');
  });

  it('owner preflight and push checklist keep push blocked pending owner approval', () => {
    expect(ownerPreflight).toContain('geen push');
    expect(ownerPreflight).toContain('eigenaargoedkeuring');
    expect(pushChecklist).toContain('geen toestemming om te pushen');
    expect(pushChecklist).toContain('node scripts/owner-go-no-go-preflight.mjs --strict');
  });

  it('package exposes the local owner go/no-go preflight script', () => {
    expect(pkg.scripts['preflight:owner-go-no-go']).toBe('node scripts/owner-go-no-go-preflight.mjs');
    expect(pkg.scripts['preflight:owner-go-no-go']).not.toMatch(/git\s+push|dokploy|10\.0\.2\.4/i);
  });
});
