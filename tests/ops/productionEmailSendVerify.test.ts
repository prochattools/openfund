import { describe, expect, it } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const SCRIPT_PATH = resolve(__dirname, '../../scripts/production-email-send-verify.mjs');

describe('production email send verify script', () => {
  const scriptContent = existsSync(SCRIPT_PATH) ? readFileSync(SCRIPT_PATH, 'utf-8') : '';

  it('script exists', () => {
    expect(existsSync(SCRIPT_PATH)).toBe(true);
  });

  it('requires --send-one-test-email flag', () => {
    expect(scriptContent).toContain('--send-one-test-email');
    expect(scriptContent).toMatch(/GEWEIGERD.*--send-one-test-email/);
  });

  it('requires confirmation token', () => {
    expect(scriptContent).toContain('YESHUA_FINANCE_SEND_ONE_TEST_EMAIL');
    expect(scriptContent).toContain('--confirm-send');
  });

  it('refuses multiple recipients', () => {
    expect(scriptContent).toMatch(/,|;/);
    expect(scriptContent).toMatch(/GEWEIGERD.*één ontvanger/);
  });

  it('refuses missing API key', () => {
    expect(scriptContent).toContain('RESEND_API_KEY');
    expect(scriptContent).toMatch(/GEWEIGERD.*RESEND_API_KEY/);
  });

  it('refuses missing from address gracefully with default', () => {
    expect(scriptContent).toContain('EMAIL_FROM_ADDRESS');
    expect(scriptContent).toContain('info@yeshua.academy');
  });

  it('does not print API key', () => {
    expect(scriptContent).not.toMatch(/console\.(log|info)\(.*apiKey/);
    expect(scriptContent).not.toMatch(/console\.(log|info)\(.*RESEND_API_KEY/);
    expect(scriptContent).toContain('Credentials: NIET afgedrukt');
    expect(scriptContent).toContain('credentials afgedrukt: NEE');
  });

  it('does not print provider payload', () => {
    expect(scriptContent).toContain('Provider payloads: NIET afgedrukt');
    expect(scriptContent).toContain('provider payloads afgedrukt: NEE');
  });

  it('does not include secrets in test fixtures', () => {
    expect(scriptContent).not.toMatch(/re_[A-Za-z0-9]{10,}/);
    expect(scriptContent).not.toContain('postgresql://');
    expect(scriptContent).not.toContain('DATABASE_URL');
  });

  it('does not read .env files directly', () => {
    expect(scriptContent).not.toMatch(/readFileSync.*\.env/);
    expect(scriptContent).not.toMatch(/dotenv/);
    expect(scriptContent).not.toMatch(/require.*dotenv/);
  });

  it('sends at most one message by design', () => {
    expect(scriptContent).toContain('e-mails verzonden: 1');
    expect(scriptContent).toMatch(/to:\s*\[recipient/);
  });

  it('does not use unsafe shell execution', () => {
    expect(scriptContent).not.toContain(['child', '_', 'process'].join(''));
    expect(scriptContent).not.toMatch(/exec\(/);
    expect(scriptContent).not.toMatch(/execSync/);
    expect(scriptContent).not.toMatch(/spawn\(/);
  });

  it('sanitizes provider errors', () => {
    expect(scriptContent).toContain('REDACTED');
    expect(scriptContent).toMatch(/re_\[A-Za-z0-9_\]\+/);
  });
});
