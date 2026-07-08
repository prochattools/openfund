import { describe, expect, it } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const EVIDENCE_PATH = resolve(__dirname, '../../docs/REAL_EMAIL_SENDING_EVIDENCE_NL.md');

describe('realEmailSendingEvidence', () => {
  const content = existsSync(EVIDENCE_PATH) ? readFileSync(EVIDENCE_PATH, 'utf-8') : '';

  it('evidence doc exists', () => {
    expect(existsSync(EVIDENCE_PATH)).toBe(true);
    expect(content.length).toBeGreaterThan(100);
  });

  it('references Resend as provider', () => {
    expect(content).toContain('Resend');
    expect(content).toMatch(/Provider.*Resend/);
  });

  it('states bounded one-email verification status', () => {
    expect(content).toMatch(/begrensde.*single-email|single-email.*verificatie|1 e-mail maximaal/i);
  });

  it('records the approved closeout starting commit', () => {
    expect(content).toContain('Startcommit: 84ef8d0');
  });

  it('states production send verification completed', () => {
    expect(content).toMatch(/real email sending completed/i);
    expect(content).toMatch(/GESLAAGD.*precies 1 e-mail verzonden/i);
  });

  it('states no bulk send', () => {
    expect(content).toMatch(/Geen bulk e-mail/);
  });

  it('states exactly one bounded production email was sent', () => {
    expect(content).toMatch(/precies 1 e-mail verzonden/i);
    expect(content).toMatch(/Geen bulk e-mail/);
  });

  it('states no raw rows', () => {
    expect(content).toMatch(/Geen ruwe transactierijen/);
  });

  it('states no attachments', () => {
    expect(content).toMatch(/Geen attachments verzonden/i);
  });

  it('states no provider payloads', () => {
    expect(content).toMatch(/Geen providerpayloads/);
  });

  it('states no secrets', () => {
    expect(content).toMatch(/Geen geheimwaarden/);
  });

  it('states no .env edit', () => {
    expect(content).toMatch(/Geen \.env gewijzigd/);
  });

  it('states no migrations', () => {
    expect(content).toMatch(/Geen migraties/);
  });

  it('states PDF remains complete', () => {
    expect(content).toMatch(/PDF.*compleet|PDF-renderer.*compleet/);
  });

  // Security assertions — no secrets leaked into evidence
  it('contains no DATABASE_URL', () => {
    expect(content).not.toContain('DATABASE_URL=');
    expect(content).not.toMatch(/DATABASE_URL\s*[:=]\s*\S/);
  });

  it('contains no SYSTEM_DATABASE_URL', () => {
    expect(content).not.toContain('SYSTEM_DATABASE_URL');
  });

  it('contains no SHADOW_DATABASE_URL', () => {
    expect(content).not.toContain('SHADOW_DATABASE_URL');
  });

  it('contains no RESEND_API_KEY value', () => {
    expect(content).not.toMatch(/RESEND_API_KEY\s*[:=]\s*\S/);
    expect(content).not.toMatch(/RESEND_API_KEY=re_/);
  });

  it('contains no re_ provider secret prefixes', () => {
    expect(content).not.toMatch(/re_[A-Za-z0-9]{10,}/);
  });

  it('contains no postgresql:// or postgres://', () => {
    expect(content).not.toContain('postgresql://');
    expect(content).not.toContain('postgres://');
  });

  it('contains no host address', () => {
    expect(content).not.toMatch(/\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/);
    expect(content).not.toMatch(/\.hetzner\./);
    expect(content).not.toMatch(/\.dokploy\./);
  });

  it('contains no password-shaped content', () => {
    expect(content).not.toMatch(/password\s*[:=]\s*\S{8,}/i);
    expect(content).not.toMatch(/wachtwoord\s*[:=]\s*\S{8,}/i);
  });

  it('contains no owner absolute paths', () => {
    expect(content).not.toContain('/Users/');
    expect(content).not.toContain('/home/');
    expect(content).not.toMatch(/C:\\/);
  });

  it('contains no transaction descriptions, counterparties, or references', () => {
    expect(content).not.toMatch(/NL\d{2}[A-Z]{4}\d{10}/);
    expect(content).not.toMatch(/IBAN/);
    expect(content).not.toMatch(/tegenrekening/i);
  });

  it('must not use unsafe shell execution', () => {
    expect(content).not.toContain(['child', '_', 'process'].join(''));
    expect(content).not.toMatch(/exec\(/);
  });
});
