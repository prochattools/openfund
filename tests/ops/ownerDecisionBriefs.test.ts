/**
 * OPS-019 — Owner decision execution brief guards.
 *
 * Static documentation guard only. No shell execution, network, database,
 * production host, provider, email, import, push, tag, or dependency install.
 */

import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const repoRoot = process.cwd();

const decisionBriefs = [
  {
    key: 'pdf',
    path: 'docs/DECISION_BRIEF_PDF_RENDERER_NL.md',
    title: 'PDF-renderer',
    notOccurredClaim: 'installeert niets',
    completed: true,
  },
  {
    key: 'postgres-version',
    path: 'docs/DECISION_BRIEF_POSTGRES_VERSION_NL.md',
    title: 'PostgreSQL-versie',
    notOccurredClaim: 'maakt geen productieverbinding',
  },
  {
    key: 'production-cutover',
    path: 'docs/DECISION_BRIEF_PRODUCTION_CUTOVER_NL.md',
    title: 'productiecutover',
    notOccurredClaim: 'verbindt niet met productie',
  },
  {
    key: 'historical-import',
    path: 'docs/DECISION_BRIEF_HISTORICAL_IMPORT_NL.md',
    title: 'historische import',
    notOccurredClaim: 'kopieert geen owner-bestanden',
  },
  {
    key: 'email',
    path: 'docs/DECISION_BRIEF_EMAIL_PROVIDER_NL.md',
    title: 'e-mailprovider',
    notOccurredClaim: 'verzendt niets',
  },
  {
    key: 'secret-rotation',
    path: 'docs/DECISION_BRIEF_SECRET_ROTATION_NL.md',
    title: 'secret rotation',
    notOccurredClaim: 'roteert geen secrets',
  },
];

function readBrief(path: string) {
  return readFileSync(resolve(repoRoot, path), 'utf-8');
}

const forbiddenContentPattern = new RegExp(
  [
    ['sk', '_live_'].join(''),
    ['pk', '_live_'].join(''),
    'AKIA[0-9A-Z]{16}',
    ['DATABASE', '_URL=postgresql://[^\\s`]*:[^\\s`@]+@'].join(''),
    ['PG', 'PASS', 'WORD='].join(''),
    ['10', '\\.', '0', '\\.', '2', '\\.', '4'].join(''),
    ['dok', 'ploy'].join(''),
    ['M', 'CP bridge'].join(''),
    ['owner', ' source file path'].join(''),
    ['raw', ' row'].join(''),
    ['database', ' dump'].join(''),
    ['git', '\\s+', 'push'].join(''),
    ['git', '\\s+', 'tag'].join(''),
    ['npm', '\\s+', 'install'].join(''),
    ['send', 'Mail'].join(''),
    ['resend', '\\.', 'emails', '\\.', 'send'].join(''),
  ].join('|'),
  'i',
);

const falseExecutedClaimPattern = new RegExp(
  [
    ['productie', '(cutover|migratie).*', '(voltooid|uitgevoerd)'].join(''),
    ['historische productie-import.*', '(voltooid|uitgevoerd)'].join(''),
    ['echte e-mail.*', '(verzonden|geactiveerd)'].join(''),
    ['echte PDF.*', '(gegenereerd|geactiveerd)'].join(''),
    ['secret rotation.*', '(voltooid|uitgevoerd)'].join(''),
    ['PostgreSQL.*', '(bevestigd|confirmed)'].join(''),
  ].join('|'),
  'i',
);

describe('owner decision briefs — static documentation guard', () => {
  it('all six decision brief docs exist', () => {
    for (const brief of decisionBriefs) {
      expect(existsSync(resolve(repoRoot, brief.path)), brief.path).toBe(true);
    }
  });

  it('each brief says the correct owner-decision status', () => {
    for (const brief of decisionBriefs) {
      const content = readBrief(brief.path);
      if (brief.completed) {
        expect(content).toContain('Status: Goedgekeurd en geïmplementeerd');
      } else {
        expect(content).toContain('Status: Geblokkeerd');
      }
      expect(content).toContain(brief.title);
    }
  });

  it('each brief includes approval evidence, preflight, validation, rollback, stop rules, and the relevant prompt or evidence section', () => {
    for (const brief of decisionBriefs) {
      const content = readBrief(brief.path);
      expect(content).toContain('Vereiste owner approval evidence');
      expect(content).toContain('Veilige preflight commands');
      expect(content).toContain('Validatiepoorten');
      expect(content).toContain('Rollbackplan');
      expect(content).toContain('Stopregels');
      expect(content).toContain(brief.completed ? 'Afgerond bewijs' : 'Exacte toekomstige approval prompt');
    }
  });

  it('each pending brief confirms it does not execute anything and the completed PDF brief stays sanitized', () => {
    for (const brief of decisionBriefs) {
      const content = readBrief(brief.path);
      if (brief.completed) {
        expect(content).toContain('Deze brief bevat geen secrets');
      } else {
        expect(content).toContain('Deze brief voert niets uit');
        expect(content).toContain(brief.notOccurredClaim);
      }
    }
  });

  it('briefs contain no secrets, production targets, owner sources, raw rows, dumps, or scanner-hostile literals', () => {
    for (const brief of decisionBriefs) {
      const content = readBrief(brief.path);
      expect(content, brief.path).not.toMatch(forbiddenContentPattern);
    }
  });

  it('briefs do not claim gated actions have already occurred', () => {
    for (const brief of decisionBriefs) {
      if (brief.completed) {
        continue;
      }
      const content = readBrief(brief.path);
      expect(content, brief.path).not.toMatch(falseExecutedClaimPattern);
    }
  });

  it('this test does not use shell execution', () => {
    const testSource = readBrief('tests/ops/ownerDecisionBriefs.test.ts');
    expect(testSource).not.toContain(['child', '_', 'process'].join(''));
    expect(testSource).not.toContain(['exec', 'Sync'].join(''));
  });
});
