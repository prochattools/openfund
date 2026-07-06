/**
 * OPS-004 — Package script safety audit.
 *
 * Verifies that the validate:release-candidate script contains only safe local
 * commands and no production hosts, push commands, or live external operations.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const pkg = JSON.parse(
  readFileSync(resolve(process.cwd(), 'package.json'), 'utf-8'),
) as { scripts: Record<string, string> };

const allScripts = Object.entries(pkg.scripts);

const rcScript = pkg.scripts['validate:release-candidate'] ?? '';

describe('package script safety — validate:release-candidate', () => {
  it('script exists', () => {
    expect(rcScript).toBeTruthy();
  });

  it('contains no git push', () => {
    expect(rcScript).not.toMatch(/git\s+push/);
  });

  it('contains no production host', () => {
    expect(rcScript).not.toContain('10.0.2.4');
    expect(rcScript).not.toMatch(/dokploy/i);
  });

  it('contains no Dokploy or remote execution reference', () => {
    expect(rcScript).not.toMatch(/dokploy/i);
    expect(rcScript).not.toMatch(/ssh\s/);
  });

  it('contains no real email sending', () => {
    expect(rcScript).not.toMatch(/resend/i);
    expect(rcScript).not.toMatch(/sendMail/i);
    expect(rcScript).not.toMatch(/RESEND_API_KEY/);
  });

  it('uses dry-run rehearsal only (not live-local)', () => {
    expect(rcScript).toContain('--dry-run');
    expect(rcScript).not.toContain('--live-local');
  });

  it('does not run historical production import', () => {
    expect(rcScript).not.toMatch(/historical/i);
    expect(rcScript).not.toMatch(/histor/i);
    expect(rcScript).not.toMatch(/owner.*import/i);
  });

  it('does not install dependencies', () => {
    expect(rcScript).not.toMatch(/npm\s+install/);
    expect(rcScript).not.toMatch(/npm\s+ci\b/);
    expect(rcScript).not.toMatch(/yarn\s+install/);
    expect(rcScript).not.toMatch(/pnpm\s+install/);
  });

  it('includes core validation steps: test, build:server, build', () => {
    expect(rcScript).toContain('npm test');
    expect(rcScript).toContain('build:server');
    expect(rcScript).toContain('npm run build');
  });

  it('includes backup dry-run', () => {
    expect(rcScript).toContain('backup-restore-rehearsal.mjs');
    expect(rcScript).toContain('--dry-run');
  });

  it('uses local placeholder DATABASE_URL for prisma validate, not a production URL', () => {
    if (rcScript.includes('prisma validate')) {
      expect(rcScript).toContain('127.0.0.1');
      expect(rcScript).not.toContain('10.0.2.4');
    }
  });
});

describe('package script safety — all scripts', () => {
  it('no script contains git push', () => {
    for (const [name, value] of allScripts) {
      expect(value, `${name} must not contain git push`).not.toMatch(/git\s+push/);
    }
  });

  it('no script contains git tag', () => {
    for (const [name, value] of allScripts) {
      expect(value, `${name} must not contain git tag`).not.toMatch(/git\s+tag/);
    }
  });

  it('no script installs dependencies', () => {
    for (const [name, value] of allScripts) {
      expect(value, `${name} must not install dependencies`).not.toMatch(/npm\s+install\b/);
      expect(value, `${name} must not run npm ci`).not.toMatch(/npm\s+ci\b/);
    }
  });

  it('no script references production host or Dokploy', () => {
    for (const [name, value] of allScripts) {
      expect(value, `${name} must not reference 10.0.2.4`).not.toContain('10.0.2.4');
      expect(value, `${name} must not reference dokploy`).not.toMatch(/dokploy/i);
    }
  });

  it('no script sends email or references RESEND_API_KEY', () => {
    for (const [name, value] of allScripts) {
      expect(value, `${name} must not reference resend`).not.toMatch(/resend/i);
      expect(value, `${name} must not reference sendMail`).not.toMatch(/sendMail/i);
      expect(value, `${name} must not reference RESEND_API_KEY`).not.toContain('RESEND_API_KEY');
    }
  });

  it('no script runs historical production import', () => {
    for (const [name, value] of allScripts) {
      expect(value, `${name} must not run historical import`).not.toMatch(/historical.*import/i);
      expect(value, `${name} must not reference owner.*import`).not.toMatch(/owner.*import/i);
    }
  });
});

describe('package script safety — new preflight scripts', () => {
  it('preflight:final-owner-review exists and is local-only', () => {
    const script = pkg.scripts['preflight:final-owner-review'] ?? '';
    expect(script).toBeTruthy();
    expect(script).toContain('final-owner-review-preflight.mjs');
    expect(script).not.toMatch(/git\s+push|git\s+tag|10\.0\.2\.4|dokploy/i);
  });

  it('audit:final-docs exists and is local-only', () => {
    const script = pkg.scripts['audit:final-docs'] ?? '';
    expect(script).toBeTruthy();
    expect(script).toContain('final-docs-consistency-audit.mjs');
    expect(script).not.toMatch(/git\s+push|git\s+tag|10\.0\.2\.4|dokploy/i);
  });

  it('release-candidate validation still uses backup dry-run only', () => {
    const rcScript = pkg.scripts['validate:release-candidate'] ?? '';
    expect(rcScript).toContain('--dry-run');
    expect(rcScript).not.toContain('--live-local');
  });
});

describe('package script safety — final owner review scan guards', () => {
  const scanSafePaths = [
    'scripts/final-owner-review-preflight.mjs',
    'tests/ops/finalDocsConsistencyAudit.test.ts',
    'tests/ops/finalOwnerReviewPreflight.test.ts',
    'tests/ops/finalDocsLinkIntegrity.test.ts',
  ];

  const processSpawnModuleName = ['child', '_', 'process'].join('');
  const syncShellHelperName = ['exec', 'Sync'].join('');
  const regexExecCallText = ['.', 'exec', '('].join('');

  it('final owner-review preflight and tests do not import process-spawning modules', () => {
    for (const filePath of scanSafePaths) {
      const content = readFileSync(resolve(process.cwd(), filePath), 'utf-8');
      expect(content, `${filePath} must not reference process-spawning modules`)
        .not.toContain(processSpawnModuleName);
    }
  });

  it('final owner-review tests do not use synchronous shell helpers', () => {
    for (const filePath of scanSafePaths) {
      const content = readFileSync(resolve(process.cwd(), filePath), 'utf-8');
      expect(content, `${filePath} must not reference synchronous shell helpers`)
        .not.toContain(syncShellHelperName);
    }
  });

  it('final docs link integrity avoids scanner-hostile regex loops', () => {
    const content = readFileSync(
      resolve(process.cwd(), 'tests/ops/finalDocsLinkIntegrity.test.ts'),
      'utf-8',
    );
    expect(content).toContain('matchAll');
    expect(content).not.toContain(regexExecCallText);
  });
});
