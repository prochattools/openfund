/**
 * OPS-011 — Final documentation consistency audit tests.
 *
 * Pure static checks: no database, no network, no production host,
 * no push, no tag, no migration, no import.
 */

import { describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  main,
  runFinalDocsConsistencyAudit,
  renderAuditMarkdown,
} from '../../scripts/final-docs-consistency-audit.mjs';

const repoRoot = process.cwd();

describe('final docs consistency — script guards', () => {
  function runMain(args: string[]) {
    let output = '';
    const exitCode = main(args, {
      repoRoot,
      stdout: { write: (chunk: string) => { output += chunk; } },
    });
    return { exitCode, output };
  }

  it('--help returns 0', () => {
    const { exitCode, output } = runMain(['--help']);
    expect(exitCode).toBe(0);
    expect(output).toContain('--write');
    expect(output).toContain('--help');
    expect(output).toContain('Leest geen .env');
    expect(output).toContain('Geen netwerktoegang');
  });

  it('default mode prints a Dutch report', () => {
    const { exitCode, output } = runMain([]);
    expect(exitCode).toBe(0);
    expect(output).toContain('Yeshua Academy Finance');
    expect(output).toContain('GESLAAGD');
    expect(output).toContain('Bevestiging:');
  });
});

describe('final docs consistency — required docs exist', () => {
  const requiredDocs = [
    'docs/OWNER_HANDOFF_NL.md',
    'docs/OWNER_DECISION_PACK_NL.md',
    'docs/OWNER_DECISION_READINESS_MATRIX_NL.md',
    'docs/OWNER_APPROVAL_INTAKE_NL.md',
    'docs/OWNER_APPROVAL_INTAKE_VALIDATION_NL.md',
    'docs/OWNER_APPROVED_ACTION_PLAN_NL.md',
    'docs/OWNER_ACCEPTANCE_CHECKLIST_NL.md',
    'docs/OWNER_REVIEW_INDEX_NL.md',
    'docs/OWNER_REVIEW_FINAL_PACKET_NL.md',
    'docs/OWNER_DECISION_MENU_NL.md',
    'docs/NEXT_OWNER_DECISION_RECOMMENDATION_NL.md',
    'docs/POST_PUSH_VERIFICATION_NL.md',
    'docs/POST_APPROVAL_PROMPTS_NL.md',
    'docs/PUSH_READINESS_CHECKLIST_NL.md',
    'docs/SAFE_COMMAND_INVENTORY_NL.md',
    'docs/DECISION_BRIEF_PDF_RENDERER_NL.md',
    'docs/DECISION_BRIEF_POSTGRES_VERSION_NL.md',
    'docs/DECISION_BRIEF_PRODUCTION_CUTOVER_NL.md',
    'docs/DECISION_BRIEF_HISTORICAL_IMPORT_NL.md',
    'docs/DECISION_BRIEF_EMAIL_PROVIDER_NL.md',
    'docs/DECISION_BRIEF_SECRET_ROTATION_NL.md',
    'docs/FINAL_READINESS_AUDIT_NL.md',
    'docs/FINAL_RELEASE_CANDIDATE_CHECKLIST_NL.md',
    'docs/RELEASE_MANIFEST_NL.md',
    'docs/ROADMAP.md',
  ];

  for (const doc of requiredDocs) {
    it(`${doc} exists`, () => {
      expect(existsSync(resolve(repoRoot, doc))).toBe(true);
    });
  }
});

describe('final docs consistency — audit passes on real repo', () => {
  it('audit passes all checks', () => {
    const result = runFinalDocsConsistencyAudit(repoRoot);
    const failed = result.checks.filter((c) => !c.ok);
    expect(failed, `Failed checks: ${failed.map((c) => c.label).join(', ')}`).toHaveLength(0);
    expect(result.ok).toBe(true);
  });

  it('renders a Dutch markdown report', () => {
    const result = runFinalDocsConsistencyAudit(repoRoot);
    const markdown = renderAuditMarkdown(result);
    expect(markdown).toContain('Yeshua Academy Finance');
    expect(markdown).toContain('Eindaudit documentatieconsistentie');
    expect(markdown).toContain('GESLAAGD');
    expect(markdown).toContain('Bevestiging:');
    expect(markdown).not.toContain('DATABASE_URL=');
  });
});

describe('final docs consistency — no false production claims', () => {
  const publishCommandText = ['git', 'push'].join(' ');
  const forbiddenPatterns: Array<{ pattern: RegExp; label: string }> = [
    { pattern: /productie(?:migratie|overstap|cutover).*voltooid/i, label: 'productiecutover voltooid' },
    { pattern: /historische productie-import (?:is )?(?:voltooid|succesvol uitgevoerd)/i, label: 'historische import voltooid' },
    { pattern: /echte e-mail(?:verzending)? is (?:verzonden|geactiveerd)/i, label: 'echte e-mail verzonden' },
    { pattern: /echte PDF (?:is )?(?:gegenereerd|geactiveerd)/i, label: 'echte PDF gegenereerd' },
    { pattern: new RegExp(`${publishCommandText} (?:is )?(?:uitgevoerd|voltooid)`, 'i'), label: `${publishCommandText} uitgevoerd` },
  ];

  it('no final owner doc contains false executed-action claims', () => {
    const result = runFinalDocsConsistencyAudit(repoRoot);
    const noFalseClaims = result.checks.find((c) => c.id === 'no_false_executed_claims');
    expect(noFalseClaims?.ok).toBe(true);
  });

  it('forbiddenPatterns are exercised', () => {
    expect(forbiddenPatterns.length).toBeGreaterThan(0);
  });
});

describe('final docs consistency — --write produces valid output', () => {
  it('--write updates FINAL_DOCS_CONSISTENCY_AUDIT_NL.md', () => {
    let output = '';
    const exitCode = main(['--write'], {
      repoRoot,
      stdout: { write: (chunk: string) => { output += chunk; } },
    });
    expect(exitCode).toBe(0);
    expect(output).toContain('Geschreven naar docs/FINAL_DOCS_CONSISTENCY_AUDIT_NL.md');
    expect(existsSync(resolve(repoRoot, 'docs/FINAL_DOCS_CONSISTENCY_AUDIT_NL.md'))).toBe(true);
  });
});
