/**
 * Static guard for local PostgreSQL version evidence.
 *
 * No shell execution, network, database, .env, production host, provider,
 * email, import, push, tag, dependency install, or secret rotation.
 */

import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const repoRoot = process.cwd();
const docPath = resolve(repoRoot, 'docs/POSTGRES_VERSION_EVIDENCE_NL.md');
const doc = existsSync(docPath) ? readFileSync(docPath, 'utf-8') : '';
const rebuildRun = readFileSync(resolve(repoRoot, 'docs/finance-rebuild-run.md'), 'utf-8');
const testSource = readFileSync(resolve(repoRoot, 'tests/ops/postgresVersionEvidence.test.ts'), 'utf-8');

const forbiddenLiteralFragments = [
  ['dok', 'ploy'].join(''),
  ['MCP', 'bridge'].join(' '),
  ['10', '.', '0', '.', '2', '.', '4'].join(''),
  ['owner', ' source file path'].join(''),
  ['raw', ' transaction rows'].join(''),
  ['database', ' dumps'].join(''),
  ['sk', '_live_'].join(''),
  ['pk', '_live_'].join(''),
];

describe('postgres version evidence', () => {
  it('evidence document exists', () => {
    expect(existsSync(docPath)).toBe(true);
    expect(doc).toContain('Yeshua Academy Finance — PostgreSQL version evidence');
  });

  it('records local PostgreSQL 15.17 evidence from the rebuild run', () => {
    expect(doc).toContain('Confirmed local PostgreSQL major/minor version | 15.17');
    expect(doc).toContain('local PostgreSQL backup/restore rehearsal evidence recorded in docs/finance-rebuild-run.md');
    expect(doc).toContain('2026-07-05 Europe/Lisbon');
    expect(doc).toContain('Steve Westhoek, owner');
    expect(doc).toContain('local rehearsal only');
    expect(rebuildRun).toContain('local PostgreSQL 15.17');
  });

  it('keeps production PostgreSQL version and cutover blocked', () => {
    expect(doc).toContain('Production PostgreSQL version | not confirmed');
    expect(doc).toContain('Production cutover | blocked');
    expect(doc).toContain('productie PostgreSQL-versie blijft onbekend');
  });

  it('references docs/finance-rebuild-run.md as the source document', () => {
    expect(doc).toContain('docs/finance-rebuild-run.md');
  });

  it('does not claim production compatibility or production version confirmation', () => {
    expect(doc).not.toMatch(/production PostgreSQL version (?:is )?(?:confirmed|bevestigd)/i);
    expect(doc).not.toMatch(/production compatibility (?:is )?(?:confirmed|bevestigd)/i);
    expect(doc).not.toMatch(/productiecompatibiliteit.*(?:bevestigd|confirmed)/i);
  });

  it('contains no forbidden material or scanner-hostile literals', () => {
    for (const forbidden of forbiddenLiteralFragments) {
      expect(doc).not.toContain(forbidden);
      expect(testSource).not.toContain(forbidden);
    }
    const postgresUrls = doc.match(/postgresql:\/\/[^\s`]+/g) ?? [];
    expect(postgresUrls).toEqual([
      'postgresql://finance_user:local_dev_placeholder@127.0.0.1:5432/yaf_validate',
      'postgresql://finance_user:local_dev_placeholder@127.0.0.1:5432/yaf_validate',
    ]);
    expect(doc).toContain('Geen provider payload.');
    expect(doc).not.toMatch(/provider payload:\s*\S/i);
  });

  it('test does not use shell execution', () => {
    expect(testSource).not.toContain(['child', '_', 'process'].join(''));
    expect(testSource).not.toContain(['exec', 'Sync'].join(''));
  });
});
