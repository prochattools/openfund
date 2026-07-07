/**
 * Production runtime database credential finalization evidence tests.
 *
 * Verifies the evidence document exists and contains required content
 * without including any forbidden credential material.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const evidencePath = resolve(
  process.cwd(),
  'docs/PRODUCTION_RUNTIME_DATABASE_CREDENTIAL_EVIDENCE_NL.md'
);
const evidenceContent = existsSync(evidencePath)
  ? readFileSync(evidencePath, 'utf-8')
  : '';

// ─── 1. Document exists ───────────────────────────────────────────────────────

describe('productionRuntimeDatabaseCredentialEvidence — document exists', () => {
  it('PRODUCTION_RUNTIME_DATABASE_CREDENTIAL_EVIDENCE_NL.md exists', () => {
    expect(existsSync(evidencePath)).toBe(true);
  });
});

// ─── 2. Credential finalization ───────────────────────────────────────────────

describe('productionRuntimeDatabaseCredentialEvidence — credential finalized', () => {
  it('states why final credential finalization was needed', () => {
    expect(evidenceContent).toMatch(/niet.*bewaard|niet.*bewaard.*runtime|gegenereerd.*wachtwoord/i);
  });

  it('states final retained credential was applied', () => {
    expect(evidenceContent).toMatch(/finaal.*credential.*aangemaakt|credential.*gefinaliseerd|rotati.*uitgevoerd/i);
  });

  it('states old credential was rejected', () => {
    expect(evidenceContent).toMatch(/oud.*credential.*afgewezen/i);
  });

  it('states new credential connectivity was verified', () => {
    expect(evidenceContent).toMatch(/nieuw.*credential.*connectiviteit.*geverifieerd/i);
  });

  it('states production readiness totals were verified', () => {
    expect(evidenceContent).toMatch(/historische.*totalen.*geverifieerd/i);
  });
});

// ─── 3. Runtime update ───────────────────────────────────────────────────────

describe('productionRuntimeDatabaseCredentialEvidence — runtime updated', () => {
  it('states Dokploy env was updated', () => {
    expect(evidenceContent).toMatch(/dokploy.*bijgewerkt|runtime.*env.*bijgewerkt/i);
  });

  it('states app health was verified', () => {
    expect(evidenceContent).toMatch(/health|gezondheid/i);
  });
});

// ─── 4. Production identification ────────────────────────────────────────────

describe('productionRuntimeDatabaseCredentialEvidence — production identification', () => {
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

  it('references starting commit 90c0b24', () => {
    expect(evidenceContent).toContain('90c0b24');
  });
});

// ─── 5. Forbidden content absent ─────────────────────────────────────────────

describe('productionRuntimeDatabaseCredentialEvidence — no forbidden content', () => {
  it('does not contain DATABASE_URL', () => {
    expect(evidenceContent).not.toContain('DATABASE_URL');
  });

  it('does not contain SYSTEM_DATABASE_URL', () => {
    expect(evidenceContent).not.toContain('SYSTEM_DATABASE_URL');
  });

  it('does not contain FINAL_FINANCE_DATABASE_URL', () => {
    expect(evidenceContent).not.toContain('FINAL_FINANCE_DATABASE_URL');
  });

  it('does not contain FINAL_FINANCE_PASSWORD', () => {
    expect(evidenceContent).not.toContain('FINAL_FINANCE_PASSWORD');
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

  it('does not contain provider payloads', () => {
    expect(evidenceContent).not.toMatch(/resend|sendgrid|mailgun/i);
  });
});

// ─── 6. Remaining blockers declared ──────────────────────────────────────────

describe('productionRuntimeDatabaseCredentialEvidence — remaining blockers', () => {
  it('states real PDF remains blocked', () => {
    expect(evidenceContent).toMatch(/echte PDF|real.*PDF/i);
  });

  it('states real email remains blocked', () => {
    expect(evidenceContent).toMatch(/echte e-mail|real.*email/i);
  });
});
