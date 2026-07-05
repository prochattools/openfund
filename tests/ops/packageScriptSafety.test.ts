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
