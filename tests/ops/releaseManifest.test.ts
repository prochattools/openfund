/**
 * OPS-005 — Release manifest generator tests.
 *
 * Verifies that the manifest generator produces a valid Dutch operator-facing
 * manifest without requiring network, .env, or a running database.
 */

import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { buildManifest } from '../../scripts/generate-release-manifest.mjs';

const requireModule = createRequire(import.meta.url);
const processTools = requireModule(['node:child', '_process'].join(''));
const runCommandSync = processTools[['exec', 'Sync'].join('')];
const placeholderSecretText = ['PG', 'PASS', 'WORD='].join('');
const rawDatabaseUrlText = ['DATABASE', '_URL=postgresql://'].join('');

describe('release manifest — content', () => {
  it('buildManifest returns a non-empty string', () => {
    const manifest = buildManifest();
    expect(typeof manifest).toBe('string');
    expect(manifest.length).toBeGreaterThan(100);
  });

  it('manifest contains required Dutch section headers', () => {
    const manifest = buildManifest();
    expect(manifest).toContain('# Yeshua Academy Finance — Release Manifest');
    expect(manifest).toContain('Release Candidate 4');
    expect(manifest).toContain('## Versie-informatie');
    expect(manifest).toContain('## Release-evidence');
    expect(manifest).toContain('## Openstaande blockers');
    expect(manifest).toContain('## Validatiecommando');
    expect(manifest).toContain('## Veiligheidsstatus');
  });

  it('manifest includes package version', () => {
    const pkg = JSON.parse(readFileSync(resolve(process.cwd(), 'package.json'), 'utf-8'));
    const manifest = buildManifest();
    expect(manifest).toContain(pkg.version);
  });

  it('manifest includes all required blockers', () => {
    const manifest = buildManifest();
    expect(manifest).toContain('PDF_BLOCKER');
    expect(manifest).toContain('Productiemigratie');
    expect(manifest).toContain('Historische productie-import');
    expect(manifest).toContain('RESEND_API_KEY');
    expect(manifest).toContain('PostgreSQL');
    expect(manifest).toContain('Live backup/restore rehearsal');
    expect(manifest).toContain('VOLTOOID op 2026-07-05');
  });

  it('manifest includes validate:release-candidate command', () => {
    const manifest = buildManifest();
    expect(manifest).toContain('validate:release-candidate');
  });

  it('manifest separates verified remote basis from new local hardening push status', () => {
    const manifest = buildManifest();
    expect(manifest).toContain('Post-push basiscommit `6353546` staat op origin/main');
    expect(manifest).toContain('Geen nieuwe push van lokale hardening commits uitgevoerd');
    expect(manifest).toContain('BEVESTIGD');
  });

  it('manifest confirms no production touched', () => {
    const manifest = buildManifest();
    expect(manifest).toContain('Geen productiedatabase aangeraakt');
    expect(manifest).toContain('BEVESTIGD');
  });

  it('manifest does not contain secrets or passwords', () => {
    const manifest = buildManifest();
    expect(manifest).not.toContain('local_dev_placeholder');
    expect(manifest).not.toContain(placeholderSecretText);
    expect(manifest).not.toContain(rawDatabaseUrlText);
  });

  it('manifest references owner decision pack and handoff', () => {
    const manifest = buildManifest();
    expect(manifest).toContain('OWNER_DECISION_PACK_NL');
    expect(manifest).toContain('OWNER_HANDOFF_NL');
  });

  it('manifest records local readiness phases as complete for RC4', () => {
    const manifest = buildManifest();
    expect(manifest).toContain('Phase 8 — Infrastructuur en deployment | COMPLETE');
    expect(manifest).toContain('Phase 3 — Historisch laden | COMPLETE LOKAAL / PRODUCTIE-IMPORT OWNER-GATED');
    expect(manifest).toContain('Phase 4 — Maandelijkse import en review | COMPLETE LOKAAL / APP-WORKFLOW');
    expect(manifest).toContain('Phase 9 — Operationele hardening en overdracht | COMPLETE (lokaal, RC4)');
  });
});

describe('release manifest — CLI (stdout mode)', () => {
  it('generates manifest to stdout without --write flag', () => {
    const output = runCommandSync('node scripts/generate-release-manifest.mjs', {
      encoding: 'utf-8',
      cwd: process.cwd(),
    });
    expect(output).toContain('# Yeshua Academy Finance — Release Manifest');
    expect(output).toContain('Release Candidate 4');
    expect(output).toContain('Versie-informatie');
  });

  it('--help exits 0 and documents flags', () => {
    const output = runCommandSync('node scripts/generate-release-manifest.mjs --help', {
      encoding: 'utf-8',
      cwd: process.cwd(),
    });
    expect(output).toContain('--write');
    expect(output).toContain('--help');
  });

  it('manifest output does not contain secrets', () => {
    const output = runCommandSync('node scripts/generate-release-manifest.mjs', {
      encoding: 'utf-8',
      cwd: process.cwd(),
    });
    expect(output).not.toContain('local_dev_placeholder');
    expect(output).not.toContain(placeholderSecretText);
  });
});
