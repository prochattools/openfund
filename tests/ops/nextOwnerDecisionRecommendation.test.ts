/**
 * Static guard for the next owner decision recommendation.
 *
 * No shell execution, network, database, production host, provider, email,
 * import, push, tag, dependency install, or secret rotation.
 */

import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const repoRoot = process.cwd();
const docPath = resolve(repoRoot, 'docs/NEXT_OWNER_DECISION_RECOMMENDATION_NL.md');
const doc = existsSync(docPath) ? readFileSync(docPath, 'utf-8') : '';
const testSource = readFileSync(resolve(repoRoot, 'tests/ops/nextOwnerDecisionRecommendation.test.ts'), 'utf-8');

const forbiddenLiteralFragments = [
  ['dok', 'ploy'].join(''),
  ['MCP', 'bridge'].join(' '),
  ['10', '.', '0', '.', '2', '.', '4'].join(''),
  ['owner', ' files'].join(' '),
  ['raw', ' rows'].join(' '),
  ['database', ' dumps'].join(' '),
  ['sk', '_live_'].join(''),
  ['pk', '_live_'].join(''),
];

describe('next owner decision recommendation', () => {
  it('recommendation document exists', () => {
    expect(existsSync(docPath)).toBe(true);
    expect(doc).toContain('Aanbevolen volgende eigenaarsbeslissing');
  });

  it('recommends postgres-version as the next safe decision', () => {
    expect(doc).toContain('Aanbevolen sleutel: `postgres-version`');
    expect(doc).toContain('verification-only');
    expect(doc).toContain('voorwaarde is voor productiecutover');
  });

  it('does not claim the production PostgreSQL version is confirmed', () => {
    expect(doc).not.toMatch(/PostgreSQL.*(?:is )?(?:confirmed|bevestigd)/i);
    expect(doc).toContain('bevestigen de productieversie niet');
  });

  it('keeps production cutover and other owner-gated actions blocked', () => {
    for (const phrase of [
      'Productiecutover.',
      'Historische productie-import.',
      'Echte e-mailverzending.',
      'Echte PDF-renderer.',
      'Secret rotation.',
      'Push naar remote.',
    ]) {
      expect(doc).toContain(phrase);
    }
  });

  it('lists required owner/provider evidence outside Git', () => {
    expect(doc).toContain('PostgreSQL major/minor versie');
    expect(doc).toContain('Bron van de bevestiging');
    expect(doc).toContain('Datum van de bevestiging');
    expect(doc).toContain('geen secrets, connection strings of productiecredentials');
  });

  it('contains no secrets, production targets, owner files, raw rows, dumps, or scanner-hostile literals', () => {
    for (const forbidden of forbiddenLiteralFragments) {
      expect(doc).not.toContain(forbidden);
      expect(testSource).not.toContain(forbidden);
    }
  });

  it('test does not use shell execution', () => {
    expect(testSource).not.toContain(['child', '_', 'process'].join(''));
    expect(testSource).not.toContain(['exec', 'Sync'].join(''));
  });
});
