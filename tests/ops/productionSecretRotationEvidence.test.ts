/**
 * Production secret rotation evidence document integrity tests.
 *
 * Verifies that the evidence document exists and contains required content
 * without including any forbidden credential material.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const evidencePath = resolve(process.cwd(), 'docs/PRODUCTION_SECRET_ROTATION_EVIDENCE_NL.md');
const evidenceContent = existsSync(evidencePath) ? readFileSync(evidencePath, 'utf-8') : '';

// ─── 1. Document exists ───────────────────────────────────────────────────────

describe('productionSecretRotationEvidence — document exists', () => {
  it('PRODUCTION_SECRET_ROTATION_EVIDENCE_NL.md exists', () => {
    expect(existsSync(evidencePath)).toBe(true);
  });
});

// ─── 2. Rotation status ───────────────────────────────────────────────────────

describe('productionSecretRotationEvidence — rotation completed', () => {
  it('says credential rotation completed', () => {
    expect(evidenceContent).toMatch(/rotati[ae].*voltooid|credential.*rotat/i);
  });

  it('states the reason was credential exposure in chat/log output', () => {
    expect(evidenceContent).toMatch(/chat|log.*uitvoer|output/i);
  });

  it('states new credential connectivity was verified', () => {
    expect(evidenceContent).toMatch(/nieuw.*credential.*geverifieerd|connectiviteit.*geverifieerd/i);
  });

  it('states old credential was rejected', () => {
    expect(evidenceContent).toMatch(/oud.*credential.*afgewezen|afgewezen.*na.*rotatie/i);
  });

  it('states historical totals were verified after rotation', () => {
    expect(evidenceContent).toMatch(/historische.*totalen.*geverifieerd|totalen.*geverifieerd.*na.*rotatie/i);
  });
});

// ─── 3. Production identification ────────────────────────────────────────────

describe('productionSecretRotationEvidence — production identification', () => {
  it('references finance database', () => {
    expect(evidenceContent).toContain('finance');
    expect(evidenceContent).toContain('Productie database');
  });

  it('references finance schema', () => {
    expect(evidenceContent).toContain('Productie schema');
  });

  it('references finance_user', () => {
    expect(evidenceContent).toContain('finance_user');
  });

  it('references port 5433', () => {
    expect(evidenceContent).toContain('5433');
  });

  it('references starting commit 4994279', () => {
    expect(evidenceContent).toContain('4994279');
  });

  it('references rotation date 2026-07-07', () => {
    expect(evidenceContent).toContain('2026-07-07');
  });
});

// ─── 4. Forbidden content absent ─────────────────────────────────────────────

describe('productionSecretRotationEvidence — no forbidden content', () => {
  it('does not contain DATABASE_URL', () => {
    expect(evidenceContent).not.toContain('DATABASE_URL');
  });

  it('does not contain SYSTEM_DATABASE_URL', () => {
    expect(evidenceContent).not.toContain('SYSTEM_DATABASE_URL');
  });

  it('does not contain postgresql:// or postgres://', () => {
    expect(evidenceContent).not.toContain('postgresql://');
    expect(evidenceContent).not.toContain('postgres://');
  });

  it('does not contain a host address', () => {
    expect(evidenceContent).not.toContain('10.0.2.4');
  });

  it('does not contain password-shaped content', () => {
    expect(evidenceContent).not.toMatch(/:[A-Za-z0-9+/=_\-]{20,}@/);
  });

  it('does not contain owner absolute paths', () => {
    expect(evidenceContent).not.toContain('/Users/Office/Documents');
    expect(evidenceContent).not.toContain('Administratie/');
  });

  it('does not contain raw transaction rows', () => {
    expect(evidenceContent).not.toMatch(/NL\d{2}[A-Z]{4}/);
    expect(evidenceContent).not.toContain('INSERT INTO');
    expect(evidenceContent).not.toContain('COPY ');
  });

  it('does not contain transaction descriptions or payment purposes', () => {
    expect(evidenceContent).not.toMatch(/betaling door|overboeking naar|factuur/i);
  });

  it('does not contain database dumps', () => {
    expect(evidenceContent).not.toContain('pg_dump');
    expect(evidenceContent).not.toContain('.sql');
  });

  it('does not contain provider payloads', () => {
    expect(evidenceContent).not.toMatch(/resend|sendgrid|mailgun/i);
  });
});

// ─── 5. Remaining blockers declared ──────────────────────────────────────────

describe('productionSecretRotationEvidence — remaining blockers', () => {
  it('states real email remains blocked', () => {
    expect(evidenceContent).toMatch(/echte e-mail|real.*email/i);
  });

  it('states real PDF remains blocked', () => {
    expect(evidenceContent).toMatch(/echte PDF|real.*PDF/i);
  });
});
