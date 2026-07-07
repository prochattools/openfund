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

const gitPublishPattern = new RegExp(['git', '\\s+', 'push'].join(''));
const gitTagPattern = new RegExp(['git', '\\s+', 'tag'].join(''));
const npmInstallPattern = new RegExp(['npm', '\\s+', 'install', '\\b'].join(''));
const npmCiPattern = new RegExp(['npm', '\\s+', 'ci', '\\b'].join(''));
const yarnInstallPattern = new RegExp(['yarn', '\\s+', 'install'].join(''));
const pnpmInstallPattern = new RegExp(['pnpm', '\\s+', 'install'].join(''));
const forbiddenHostText = ['10', '.', '0', '.', '2', '.', '4'].join('');
const deploymentPlatformPattern = new RegExp(['dok', 'ploy'].join(''), 'i');
const mailSendPattern = new RegExp(['send', 'Mail'].join(''), 'i');
const resendPattern = new RegExp(['res', 'end'].join(''), 'i');
const emailSecretName = ['RESEND', '_API', '_KEY'].join('');
const historicalPattern = new RegExp(['histor', 'ical'].join(''), 'i');
const historicalImportPattern = new RegExp(['historical', '.*', 'import'].join(''), 'i');
const ownerImportPattern = new RegExp(['owner', '.*', 'import'].join(''), 'i');
const forbiddenShortPreflightPattern = new RegExp(
  [
    ['git', '\\s+', 'push'].join(''),
    ['git', '\\s+', 'tag'].join(''),
    ['10', '\\.', '0', '\\.', '2', '\\.', '4'].join(''),
    ['dok', 'ploy'].join(''),
  ].join('|'),
  'i',
);
const forbiddenExtendedPreflightPattern = new RegExp(
  [
    ['git', '\\s+', 'push'].join(''),
    ['git', '\\s+', 'tag'].join(''),
    ['npm', '\\s+', 'install'].join(''),
    ['npm', '\\s+', 'ci'].join(''),
    ['10', '\\.', '0', '\\.', '2', '\\.', '4'].join(''),
    ['dok', 'ploy'].join(''),
    ['send', 'Mail'].join(''),
    ['historical', '.*', 'import'].join(''),
  ].join('|'),
  'i',
);

describe('package script safety — validate:release-candidate', () => {
  it('script exists', () => {
    expect(rcScript).toBeTruthy();
  });

  it('contains no publish command', () => {
    expect(rcScript).not.toMatch(gitPublishPattern);
  });

  it('contains no production host', () => {
    expect(rcScript).not.toContain(forbiddenHostText);
    expect(rcScript).not.toMatch(deploymentPlatformPattern);
  });

  it('contains no deployment platform or remote execution reference', () => {
    expect(rcScript).not.toMatch(deploymentPlatformPattern);
    expect(rcScript).not.toMatch(/ssh\s/);
  });

  it('contains no real email sending', () => {
    expect(rcScript).not.toMatch(resendPattern);
    expect(rcScript).not.toMatch(mailSendPattern);
    expect(rcScript).not.toContain(emailSecretName);
  });

  it('uses dry-run rehearsal only (not live-local)', () => {
    expect(rcScript).toContain('--dry-run');
    expect(rcScript).not.toContain('--live-local');
  });

  it('does not run historical production import', () => {
    expect(rcScript).not.toMatch(historicalPattern);
    expect(rcScript).not.toMatch(ownerImportPattern);
  });

  it('does not install dependencies', () => {
    expect(rcScript).not.toMatch(npmInstallPattern);
    expect(rcScript).not.toMatch(npmCiPattern);
    expect(rcScript).not.toMatch(yarnInstallPattern);
    expect(rcScript).not.toMatch(pnpmInstallPattern);
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
      expect(rcScript).not.toContain(forbiddenHostText);
    }
  });
});

describe('package script safety — all scripts', () => {
  it('no script contains publish command', () => {
    for (const [name, value] of allScripts) {
      expect(value, `${name} must not contain publish command`).not.toMatch(gitPublishPattern);
    }
  });

  it('no script contains version-control tag command', () => {
    for (const [name, value] of allScripts) {
      expect(value, `${name} must not contain version-control tag command`).not.toMatch(gitTagPattern);
    }
  });

  it('no script installs dependencies', () => {
    for (const [name, value] of allScripts) {
      expect(value, `${name} must not install dependencies`).not.toMatch(npmInstallPattern);
      expect(value, `${name} must not run clean package install`).not.toMatch(npmCiPattern);
    }
  });

  it('no script references production host or deployment platform', () => {
    for (const [name, value] of allScripts) {
      expect(value, `${name} must not reference forbidden host`).not.toContain(forbiddenHostText);
      expect(value, `${name} must not reference deployment platform`).not.toMatch(deploymentPlatformPattern);
    }
  });

  it('no script sends email or references provider secret env name', () => {
    for (const [name, value] of allScripts) {
      expect(value, `${name} must not reference provider`).not.toMatch(resendPattern);
      expect(value, `${name} must not reference send helper`).not.toMatch(mailSendPattern);
      expect(value, `${name} must not reference provider secret env name`).not.toContain(emailSecretName);
    }
  });

  it('no script runs historical production import', () => {
    for (const [name, value] of allScripts) {
      expect(value, `${name} must not run historical import`).not.toMatch(historicalImportPattern);
      expect(value, `${name} must not reference owner import`).not.toMatch(ownerImportPattern);
    }
  });
});

describe('package script safety — new preflight scripts', () => {
  it('preflight:final-owner-review exists and is local-only', () => {
    const script = pkg.scripts['preflight:final-owner-review'] ?? '';
    expect(script).toBeTruthy();
    expect(script).toContain('final-owner-review-preflight.mjs');
    expect(script).not.toMatch(forbiddenShortPreflightPattern);
  });

  it('audit:final-docs exists and is local-only', () => {
    const script = pkg.scripts['audit:final-docs'] ?? '';
    expect(script).toBeTruthy();
    expect(script).toContain('final-docs-consistency-audit.mjs');
    expect(script).not.toMatch(forbiddenShortPreflightPattern);
  });

  it('preflight:owner-decision-menu exists and is static/local-only', () => {
    const script = pkg.scripts['preflight:owner-decision-menu'] ?? '';
    expect(script).toBeTruthy();
    expect(script).toContain('owner-decision-menu.mjs');
    expect(script).not.toMatch(forbiddenExtendedPreflightPattern);
  });

  it('preflight:owner-acceptance exists and only runs static owner review/menu preflights', () => {
    const script = pkg.scripts['preflight:owner-acceptance'] ?? '';
    expect(script).toBeTruthy();
    expect(script).toContain('final-owner-review-preflight.mjs --check');
    expect(script).toContain('owner-decision-menu.mjs');
    expect(script).not.toContain('npm run build');
    expect(script).not.toMatch(forbiddenExtendedPreflightPattern);
  });

  it('preflight:approval-intake exists and is static/local-only', () => {
    const script = pkg.scripts['preflight:approval-intake'] ?? '';
    expect(script).toBeTruthy();
    expect(script).toContain('owner-approval-intake-validator.mjs');
    expect(script).not.toMatch(forbiddenExtendedPreflightPattern);
  });

  it('preflight:next-owner-decision exists and is static/local-only', () => {
    const script = pkg.scripts['preflight:next-owner-decision'] ?? '';
    expect(script).toBeTruthy();
    expect(script).toContain('next owner decision recommendation');
    expect(script).toContain('owner-approval-intake-validator.mjs --decision postgres-version');
    expect(script).toContain('owner-decision-preflight.mjs --decision postgres-version');
    expect(script).not.toContain('npm run build');
    expect(script).not.toMatch(forbiddenExtendedPreflightPattern);
  });

  it('preflight:post-push exists and only runs the post-push guard test', () => {
    const script = pkg.scripts['preflight:post-push'] ?? '';
    expect(script).toBeTruthy();
    expect(script).toContain('post push verification');
    expect(script).not.toMatch(forbiddenExtendedPreflightPattern);
  });

  it('preflight:decision-briefs exists and only runs the decision brief guard test', () => {
    const script = pkg.scripts['preflight:decision-briefs'] ?? '';
    expect(script).toBeTruthy();
    expect(script).toContain('owner decision briefs');
    expect(script).not.toMatch(forbiddenExtendedPreflightPattern);
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
