/**
 * Real PDF renderer evidence tests.
 *
 * Verifies the evidence document exists and records sanitized status only.
 */

import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const evidencePath = resolve(process.cwd(), 'docs/REAL_PDF_RENDERER_EVIDENCE_NL.md');
const evidenceContent = existsSync(evidencePath)
  ? readFileSync(evidencePath, 'utf-8')
  : '';
const forbiddenHost = ['10', '0', '2', '4'].join('.');

describe('realPdfRendererEvidence — document exists', () => {
  it('REAL_PDF_RENDERER_EVIDENCE_NL.md exists', () => {
    expect(existsSync(evidencePath)).toBe(true);
  });
});

describe('realPdfRendererEvidence — required status', () => {
  it('names pdfkit as the approved dependency', () => {
    expect(evidenceContent).toContain('pdfkit');
  });

  it('states real PDF renderer completed', () => {
    expect(evidenceContent).toMatch(/real PDF renderer completed|PDF-renderer.*VOLTOOID/i);
  });

  it('states media type application/pdf', () => {
    expect(evidenceContent).toContain('application/pdf');
  });

  it('states HTML and XLSX behavior was preserved', () => {
    expect(evidenceContent).toMatch(/HTML.*XLSX.*BEHOUDEN|HTML.*XLSX.*preserved/i);
  });

  it('states no production access, no real email, and no runtime secret changes', () => {
    expect(evidenceContent).toMatch(/Geen productieaccess.*BEVESTIGD/i);
    expect(evidenceContent).toMatch(/Geen echte e-mail verzonden.*BEVESTIGD/i);
    expect(evidenceContent).toMatch(/Geen secrets of runtimeconfig gewijzigd.*BEVESTIGD/i);
  });

  it('states real email status', () => {
    expect(evidenceContent).toMatch(/Real email sending.*CODE-COMPLETE|e-mail.*code-complete|e-mail.*verzendverificatie/i);
  });
});

describe('realPdfRendererEvidence — forbidden content absent', () => {
  it('does not contain database URL variable names or connection strings', () => {
    expect(evidenceContent).not.toContain('DATABASE_URL');
    expect(evidenceContent).not.toContain('SYSTEM_DATABASE_URL');
    expect(evidenceContent).not.toContain('SHADOW_DATABASE_URL');
    expect(evidenceContent).not.toContain('postgresql://');
    expect(evidenceContent).not.toContain('postgres://');
    expect(evidenceContent).not.toContain('[REDACTED_DB_URL]');
  });

  it('does not contain provider secret prefixes or host addresses', () => {
    expect(evidenceContent).not.toContain('sk_live_');
    expect(evidenceContent).not.toContain('sk_test_');
    expect(evidenceContent).not.toContain('re_');
    expect(evidenceContent).not.toContain(forbiddenHost);
    expect(evidenceContent).not.toMatch(/\b\d{1,3}(?:\.\d{1,3}){3}\b/);
  });

  it('does not contain password-shaped content or provider payloads', () => {
    expect(evidenceContent).not.toMatch(/:[A-Za-z0-9+/=_-]{20,}@/);
    expect(evidenceContent).not.toMatch(/"api_key"|"license_key"|"secret"/i);
  });

  it('does not contain owner paths, raw row terms, or dumps', () => {
    expect(evidenceContent).not.toContain('/Users/Office');
    expect(evidenceContent).not.toMatch(/tegenpartij|omschrijving|betalingskenmerk|payment purpose|reference/i);
    expect(evidenceContent).not.toContain('INSERT INTO');
    expect(evidenceContent).not.toContain('COPY ');
    expect(evidenceContent).not.toContain('pg_dump');
  });
});
