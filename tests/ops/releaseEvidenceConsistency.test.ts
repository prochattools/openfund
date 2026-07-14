/**
 * OPS-009 — Release evidence consistency checks.
 *
 * Prevents RC handoff docs from drifting back to stale phase labels, stale
 * manifest evidence, or missing owner-facing release guard references.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const readDoc = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf-8');

const finalAudit = readDoc('docs/FINAL_READINESS_AUDIT_NL.md');
const ownerHandoff = readDoc('docs/OWNER_HANDOFF_NL.md');
const releaseManifest = readDoc('docs/RELEASE_MANIFEST_NL.md');
const roadmap = readDoc('docs/ROADMAP.md');
const implementationPlan = readDoc('docs/IMPLEMENTATION_PLAN.md');
const rebuildRun = readDoc('docs/finance-rebuild-run.md');
const readme = readDoc('README.md');
const authReadiness = readDoc('docs/yeshua-academy-finance-auth-readiness.md');
const monthlyEvidence = readDoc('docs/MONTHLY_RECONCILIATION_EVIDENCE_NL.md');
const pushChecklist = readDoc('docs/PUSH_READINESS_CHECKLIST_NL.md');
const ownerPreflight = readDoc('docs/OWNER_GO_NO_GO_PREFLIGHT_NL.md');
const pkg = JSON.parse(readDoc('package.json')) as { scripts: Record<string, string> };

function extractManifestCommit(content: string) {
  return content.match(/\| Commit \(volledig\) \| ([0-9a-f]{40}) \|/i)?.[1] ?? null;
}

describe('release evidence consistency — stale RC labels', () => {
  it('separates application, documentation, and runtime release identities', () => {
    const implementationCommit = 'f9e967f54632f86bad2ef3c5774334a48cda85ad';
    const previousDocumentationCommit = 'df1ccb009769a89e33b3393e0e546d3caa90f174';
    expect(readme).toContain(`Current application implementation commit: \`${implementationCommit}\``);
    expect(roadmap).toContain(`Current application implementation commit:\n\`${implementationCommit}\``);
    expect(rebuildRun).toContain(`Current application implementation commit: \`${implementationCommit}\``);
    expect(authReadiness).toContain(`Current application implementation commit: \`${implementationCommit}\``);
    expect(rebuildRun).toContain(`Previous final documentation/release-evidence commit: \`${previousDocumentationCommit}\``);
    for (const content of [readme, roadmap, implementationPlan, rebuildRun, authReadiness]) {
      expect(content).toContain('production build SHA is verified from the no-cache');
      expect(content).not.toMatch(/current (?:verified )?production commit|current deployed production release|current deployed commit/i);
      expect(content).not.toMatch(/production repair remains unexecuted|suggestion persistence remains unexecuted|production import remains pending|production import remains owner-gated/i);
    }
  });

  it('labels superseded implementation gates and keeps Ory historical-only', () => {
    expect(roadmap).toContain('Historical implementation acceptance: dry-run performs zero writes');
    expect(implementationPlan).toContain('The detailed Phase 18 and Phase 19 acceptance criteria below are historical');
    expect(implementationPlan).toContain('Historical implementation acceptance: no production backfill');
    for (const content of [readme, roadmap, implementationPlan, rebuildRun, authReadiness]) {
      for (const line of content.split('\n').filter((line) => /\bOry\b/i.test(line))) {
        expect(line).toMatch(/historical only|do not restore|removed from the production authentication path|no Ory/i);
      }
    }
    expect(roadmap).toContain('Ory is historical only');
    expect(implementationPlan).toContain('Ory is historical only');
    expect(rebuildRun).toContain('Ory is historical only');
    expect(authReadiness).toContain('Ory is historical only');
  });

  it('final readiness audit records Phase 8/9 as locally complete', () => {
    expect(finalAudit).toContain('Phase 8 — Infrastructuur | COMPLETE');
    expect(finalAudit).toContain('Phase 9 — Operationele hardening en overdracht | COMPLETE (local-only RC4)');
    expect(finalAudit).not.toContain('GEDEELTELIJK (INFRA-001, INFRA-002 gedocumenteerd)');
    expect(finalAudit).not.toContain('Phase 9 — Operationele hardening en overdracht | IN PROGRESS');
  });

  it('owner handoff no longer labels the one-step validation as RC2', () => {
    expect(ownerHandoff).toContain('### RC4-validatie in één stap');
    expect(ownerHandoff).not.toContain('### RC3-validatie in één stap');
    expect(ownerHandoff).not.toContain('### RC2-validatie in één stap');
  });

  it('roadmap and implementation plan preserve historical RC7 evidence without stale current status', () => {
    expect(roadmap).toContain('COMPLETE (published RC4 handoff; owner decisions gated)');
    expect(implementationPlan).toContain('Historical RC7 release-evidence gate: Phase 17 complete; superseded');
    expect(implementationPlan).toContain('production audit passed');
    expect(rebuildRun).toContain('Status: Release Candidate 7');
    expect(rebuildRun).toContain('audit passed');
    expect(implementationPlan).not.toContain('Current gate: Release Candidate 3 owner handoff');
    expect(implementationPlan).not.toContain('Current gate: Release Candidate 2 readiness');
  });
});

describe('release evidence consistency — manifest evidence', () => {
  it('release manifest is RC4 and no longer points at the stale RC2 count correction commit', () => {
    expect(releaseManifest).toContain('Release Candidate 4');
    expect(releaseManifest).toContain('Phase 8 — Infrastructuur en deployment | COMPLETE');
    expect(releaseManifest).toContain('Phase 9 — Operationele hardening en overdracht | COMPLETE (lokaal, RC4)');
    expect(releaseManifest).toContain('Release evidence validated through');
    expect(releaseManifest).not.toContain('| Commit (kort) | 4f9cedf |');
    expect(releaseManifest).not.toContain('docs: correct RC2 final test counts');
  });

  it('manifest commit is captured in the release evidence docs without shelling out', () => {
    const manifestCommit = extractManifestCommit(releaseManifest);
    expect(manifestCommit).toMatch(/^[0-9a-f]{40}$/);
    expect(releaseManifest).toContain(manifestCommit);
    expect(finalAudit).toContain('Release Candidate 7');
    expect(roadmap).toContain('Phase 17 — Month-by-month accounting reconciliation and administrator reporting COMPLETE');
    expect(implementationPlan).toContain('Phase 17 — Month-by-month accounting reconciliation and administrator reporting: COMPLETE');
  });

  it('monthly reconciliation evidence records the real production pass', () => {
    expect(monthlyEvidence).toContain('PASSED');
    expect(monthlyEvidence).toContain('read-only production audit passed');
    expect(monthlyEvidence).toContain('1,218,415');
    expect(monthlyEvidence).toContain('COMPLEET');
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
