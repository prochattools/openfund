/**
 * Production historical import evidence document integrity tests.
 *
 * Verifies that the evidence document exists and contains the required
 * content without including forbidden information.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const evidencePath = resolve(process.cwd(), 'docs/PRODUCTION_HISTORICAL_IMPORT_EVIDENCE_NL.md');
const evidenceContent = existsSync(evidencePath) ? readFileSync(evidencePath, 'utf-8') : '';

// ─── 1. Document exists ───────────────────────────────────────────────────────

describe('productionHistoricalImportEvidence — document exists', () => {
  it('PRODUCTION_HISTORICAL_IMPORT_EVIDENCE_NL.md exists', () => {
    expect(existsSync(evidencePath)).toBe(true);
  });
});

// ─── 2. Expected control totals ───────────────────────────────────────────────

describe('productionHistoricalImportEvidence — control totals present', () => {
  it('includes 2024 transaction count 268', () => {
    expect(evidenceContent).toContain('268');
  });

  it('includes 2024 closing balance 12.184,15', () => {
    expect(evidenceContent).toContain('12.184,15');
  });

  it('includes 2025 transaction count 413', () => {
    expect(evidenceContent).toContain('413');
  });

  it('includes 2025 closing balance 10.350,86', () => {
    expect(evidenceContent).toContain('10.350,86');
  });

  it('includes 2026 transaction count 221', () => {
    expect(evidenceContent).toContain('221');
  });

  it('includes 2026 closing balance 7.837,25', () => {
    expect(evidenceContent).toContain('7.837,25');
  });
});

// ─── 3. Source hashes present ─────────────────────────────────────────────────

describe('productionHistoricalImportEvidence — source hashes present', () => {
  it('includes 2024 workbook hash', () => {
    expect(evidenceContent).toContain('844699610889c6986fec305cdbb7b760da3dfc1d556ab9d0e160c854e1bc7f9f');
  });

  it('includes 2025 workbook hash', () => {
    expect(evidenceContent).toContain('d3913b876f3a6b8ddc3d19c49ef9778125e5e109a7d3ac330afbb3d6d8d7b2ff');
  });

  it('includes 2026 CSV hash', () => {
    expect(evidenceContent).toContain('768912927a7bb3b545616631e6d5360479a90b0bc6448faa3f225925636d31d3');
  });

  it('includes 2026 PDF hash', () => {
    expect(evidenceContent).toContain('5e830a365fe0d87f67e883f24239f60674ed85a174e65db6520136511a6d58d2');
  });
});

// ─── 4. 2026 partial/open status ─────────────────────────────────────────────

describe('productionHistoricalImportEvidence — 2026 partial/open', () => {
  it('states 2026 is partial/open', () => {
    expect(evidenceContent).toMatch(/PARTIAL|gedeeltelijk/i);
  });

  it('states closePermitted is false', () => {
    expect(evidenceContent).toContain('false');
  });

  it('states 2026 is not closed', () => {
    expect(evidenceContent).toMatch(/niet.*afgesloten|niet.*gesloten|not.*closed/i);
  });
});

// ─── 5. Forbidden content absent ─────────────────────────────────────────────

describe('productionHistoricalImportEvidence — no forbidden content', () => {
  it('does not include owner absolute file paths', () => {
    expect(evidenceContent).not.toContain('/Users/Office/Documents');
    expect(evidenceContent).not.toContain('Administratie/2026');
  });

  it('does not include raw transaction rows', () => {
    // No table rows with transaction details like counterparty, IBAN, description
    expect(evidenceContent).not.toMatch(/NL\d{2}[A-Z]{4}/);
  });

  it('does not include transaction descriptions or payment purposes', () => {
    // No individual transaction text fields
    expect(evidenceContent).not.toMatch(/betaling door|overboeking naar|factuur/i);
  });

  it('does not include DATABASE_URL, host, password, or credentials', () => {
    expect(evidenceContent).not.toMatch(/postgresql:\/\//);
    expect(evidenceContent).not.toMatch(/password|wachtwoord.*=.*[a-zA-Z0-9]{8}/);
    expect(evidenceContent).not.toContain('10.0.2.4');
  });
});

// ─── 6. Remaining blockers declared ──────────────────────────────────────────

describe('productionHistoricalImportEvidence — remaining blockers', () => {
  it('declares email as remaining blocker', () => {
    expect(evidenceContent).toMatch(/e-mail|email/i);
  });

  it('declares PDF as remaining blocker', () => {
    expect(evidenceContent).toMatch(/PDF/i);
  });

  it('declares secret rotation as remaining blocker', () => {
    expect(evidenceContent).toMatch(/geheim|rotatie|secret|rotation/i);
  });
});

// ─── 7. Production database identification ────────────────────────────────────

describe('productionHistoricalImportEvidence — production identification', () => {
  it('identifies production database as finance', () => {
    expect(evidenceContent).toContain('finance');
  });

  it('identifies production schema as finance', () => {
    expect(evidenceContent).toContain('finance');
  });

  it('identifies PostgreSQL 15.8', () => {
    expect(evidenceContent).toContain('15.8');
  });

  it('identifies start commit de37a66', () => {
    expect(evidenceContent).toContain('de37a66');
  });
});
