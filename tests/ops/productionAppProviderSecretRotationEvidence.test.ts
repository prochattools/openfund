/**
 * Production app/provider secret rotation evidence tests.
 *
 * Verifies the evidence document exists and records sanitized status only.
 */

import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const evidencePath = resolve(
  process.cwd(),
  'docs/PRODUCTION_APP_PROVIDER_SECRET_ROTATION_EVIDENCE_NL.md'
);
const evidenceContent = existsSync(evidencePath)
  ? readFileSync(evidencePath, 'utf-8')
  : '';

describe('productionAppProviderSecretRotationEvidence — document exists', () => {
  it('PRODUCTION_APP_PROVIDER_SECRET_ROTATION_EVIDENCE_NL.md exists', () => {
    expect(existsSync(evidencePath)).toBe(true);
  });
});

describe('productionAppProviderSecretRotationEvidence — required statuses', () => {
  it('states the exposure reason', () => {
    expect(evidenceContent).toMatch(/Dokploy.*omgevingsoutput|geheimen.*verschenen/i);
  });

  it('references branch and starting commit', () => {
    expect(evidenceContent).toContain('main');
    expect(evidenceContent).toContain('7816c0c');
  });

  it('states Clerk status without a value', () => {
    expect(evidenceContent).toMatch(/Clerk Secret Key.*Handmatig openstaand/i);
  });

  it('states Resend status without a value', () => {
    expect(evidenceContent).toMatch(/Resend API Key.*Handmatig openstaand/i);
  });

  it('states New Relic status without a value', () => {
    expect(evidenceContent).toMatch(/New Relic License Key.*Handmatig openstaand/i);
  });

  it('states Request Access Secret was generated and applied', () => {
    expect(evidenceContent).toMatch(/Request Access Secret.*Gegenereerd en toegepast/i);
  });

  it('states shadow database runtime credential status', () => {
    expect(evidenceContent).toMatch(/Shadow database runtime credential.*afgedekt/i);
  });

  it('states redeploy, health, and readiness status', () => {
    expect(evidenceContent).toMatch(/redeploy.*BEVESTIGD/i);
    expect(evidenceContent).toMatch(/health.*BEVESTIGD/i);
    expect(evidenceContent).toMatch(/readiness.*BEVESTIGD/i);
  });

  it('states production aggregate totals', () => {
    expect(evidenceContent).toContain('902');
    expect(evidenceContent).toContain('681');
    expect(evidenceContent).toContain('PARTIAL');
  });
});

describe('productionAppProviderSecretRotationEvidence — forbidden content absent', () => {
  it('does not contain runtime URL variable names', () => {
    expect(evidenceContent).not.toContain('DATABASE_URL');
    expect(evidenceContent).not.toContain('SYSTEM_DATABASE_URL');
    expect(evidenceContent).not.toContain('SHADOW_DATABASE_URL');
  });

  it('does not contain provider key prefixes or connection schemes', () => {
    expect(evidenceContent).not.toContain('sk_live_');
    expect(evidenceContent).not.toContain('sk_test_');
    expect(evidenceContent).not.toContain('re_');
    expect(evidenceContent).not.toContain('postgresql://');
    expect(evidenceContent).not.toContain('postgres://');
  });

  it('does not contain host addresses or password-shaped content', () => {
    expect(evidenceContent).not.toContain('10.0.2.4');
    expect(evidenceContent).not.toMatch(/:[A-Za-z0-9+/=_-]{20,}@/);
  });

  it('does not contain owner paths, raw rows, or dumps', () => {
    expect(evidenceContent).not.toContain('/Users/Office');
    expect(evidenceContent).not.toMatch(/NL\d{2}[A-Z]{4}/);
    expect(evidenceContent).not.toMatch(/tegenpartij|omschrijving|betalingskenmerk|payment purpose/i);
    expect(evidenceContent).not.toContain('INSERT INTO');
    expect(evidenceContent).not.toContain('COPY ');
    expect(evidenceContent).not.toContain('pg_dump');
  });

  it('does not contain provider payload shapes', () => {
    expect(evidenceContent).not.toMatch(/"api_key"|"license_key"|"secret"/i);
  });
});

describe('productionAppProviderSecretRotationEvidence — blockers remain', () => {
  it('states real PDF remains blocked', () => {
    expect(evidenceContent).toMatch(/Echte PDF.*Geblokkeerd/i);
  });

  it('states real email remains blocked', () => {
    expect(evidenceContent).toMatch(/Echte e-mail.*Geblokkeerd/i);
  });
});
