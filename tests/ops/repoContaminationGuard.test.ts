/**
 * OPS-012 — Repo contamination guard.
 *
 * Prevents accidental cross-repo prompt/code contamination in new
 * owner/release docs and scripts. Does not use shell execution.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const repoRoot = process.cwd();

const FORBIDDEN_NAMES = [
  'brain-video-orchestrator',
  'stevewesthoek-brain-video-orchestrator',
  'prochattools-jpv-bootcamp',
  'prochattools-prochat-memory',
  'prochattools-prochat-workbench',
];

const FINAL_OWNER_DOCS = [
  'docs/OWNER_HANDOFF_NL.md',
  'docs/OWNER_DECISION_PACK_NL.md',
  'docs/OWNER_DECISION_READINESS_MATRIX_NL.md',
  'docs/OWNER_APPROVAL_INTAKE_NL.md',
  'docs/OWNER_APPROVED_ACTION_PLAN_NL.md',
  'docs/OWNER_REVIEW_INDEX_NL.md',
  'docs/OWNER_REVIEW_FINAL_PACKET_NL.md',
  'docs/POST_APPROVAL_PROMPTS_NL.md',
  'docs/PUSH_READINESS_CHECKLIST_NL.md',
  'docs/FINAL_READINESS_AUDIT_NL.md',
  'docs/FINAL_RELEASE_CANDIDATE_CHECKLIST_NL.md',
  'docs/RELEASE_MANIFEST_NL.md',
  'docs/FINAL_DOCS_CONSISTENCY_AUDIT_NL.md',
];

const FINAL_OWNER_SCRIPTS = [
  // final-docs-consistency-audit.mjs lists forbidden names as data — intentionally excluded
  'scripts/owner-go-no-go-preflight.mjs',
  'scripts/owner-decision-preflight.mjs',
  'scripts/owner-approved-action-plan.mjs',
  'scripts/push-readiness-preflight.mjs',
  'scripts/backup-restore-rehearsal.mjs',
  'scripts/generate-release-manifest.mjs',
  'scripts/final-owner-review-preflight.mjs',
];

function readIfExists(path: string): string | null {
  const full = resolve(repoRoot, path);
  if (!existsSync(full)) return null;
  return readFileSync(full, 'utf-8');
}

describe('repo contamination guard — final owner docs', () => {
  for (const doc of FINAL_OWNER_DOCS) {
    it(`${doc} references only Yeshua Academy Finance, not unrelated repos`, () => {
      const content = readIfExists(doc);
      if (!content) return; // skip if not yet created; existence is checked elsewhere
      for (const name of FORBIDDEN_NAMES) {
        expect(content, `${doc} must not reference "${name}"`).not.toContain(name);
      }
    });
  }
});

describe('repo contamination guard — final owner scripts', () => {
  for (const script of FINAL_OWNER_SCRIPTS) {
    it(`${script} references only Yeshua Academy Finance, not unrelated repos`, () => {
      const content = readIfExists(script);
      if (!content) return;
      for (const name of FORBIDDEN_NAMES) {
        expect(content, `${script} must not reference "${name}"`).not.toContain(name);
      }
    });
  }
});

describe('repo contamination guard — no unrelated buildflow tasks', () => {
  const unrelatedPhrases = [
    'BuildFlow implementation task',
    'Workbench implementation task',
    'brain-video-orchestrator',
  ];

  it('final owner docs do not contain unrelated project implementation tasks', () => {
    const failures: string[] = [];
    for (const doc of FINAL_OWNER_DOCS) {
      const content = readIfExists(doc);
      if (!content) continue;
      for (const phrase of unrelatedPhrases) {
        if (content.includes(phrase)) {
          failures.push(`${doc}: contains "${phrase}"`);
        }
      }
    }
    expect(failures, failures.join('\n')).toHaveLength(0);
  });

  it('final owner scripts do not contain unrelated project implementation tasks', () => {
    const failures: string[] = [];
    for (const script of FINAL_OWNER_SCRIPTS) {
      const content = readIfExists(script);
      if (!content) continue;
      for (const phrase of unrelatedPhrases) {
        if (content.includes(phrase)) {
          failures.push(`${script}: contains "${phrase}"`);
        }
      }
    }
    expect(failures, failures.join('\n')).toHaveLength(0);
  });
});

describe('repo contamination guard — identity verification', () => {
  it('release manifest identifies the project as Yeshua Academy Finance', () => {
    const content = readIfExists('docs/RELEASE_MANIFEST_NL.md');
    expect(content).toBeTruthy();
    expect(content).toContain('Yeshua Academy Finance');
  });

  it('owner handoff identifies the project as Yeshua Academy Finance', () => {
    const content = readIfExists('docs/OWNER_HANDOFF_NL.md');
    expect(content).toBeTruthy();
    expect(content).toContain('Yeshua Academy Finance');
  });

  it('final docs consistency audit identifies the project as Yeshua Academy Finance', () => {
    const content = readIfExists('docs/FINAL_DOCS_CONSISTENCY_AUDIT_NL.md');
    expect(content).toBeTruthy();
    expect(content).toContain('Yeshua Academy Finance');
  });
});
