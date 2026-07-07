/**
 * Production readiness verification script integrity tests.
 *
 * Verifies the script exists, reads only DATABASE_URL, does not print credentials,
 * and does not mutate production or commit secrets.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const scriptPath = resolve(process.cwd(), 'scripts/production-readiness-verify.mjs');
const scriptContent = existsSync(scriptPath) ? readFileSync(scriptPath, 'utf-8') : '';

describe('productionReadinessVerify — script exists', () => {
  it('production-readiness-verify.mjs exists', () => {
    expect(existsSync(scriptPath)).toBe(true);
  });
});

describe('productionReadinessVerify — reads only DATABASE_URL', () => {
  it('reads DATABASE_URL from environment', () => {
    expect(scriptContent).toContain('process.env.DATABASE_URL');
  });

  it('does not read SYSTEM_DATABASE_URL', () => {
    expect(scriptContent).not.toContain('SYSTEM_DATABASE_URL');
  });

  it('does not read .env files directly', () => {
    expect(scriptContent).not.toMatch(/readFileSync.*\.env/);
    expect(scriptContent).not.toMatch(/require.*\.env/);
  });
});

describe('productionReadinessVerify — no credential output', () => {
  it('does not print the DATABASE_URL value', () => {
    expect(scriptContent).not.toMatch(/console\.log.*DATABASE_URL/);
  });

  it('does not print passwords or host', () => {
    expect(scriptContent).not.toMatch(/console\.log.*password/i);
    expect(scriptContent).not.toMatch(/console\.log.*parsed\.host/i);
  });

  it('credentials not printed message is present', () => {
    expect(scriptContent).toContain('credentials not printed');
  });
});

describe('productionReadinessVerify — no mutation', () => {
  it('does not send email', () => {
    expect(scriptContent).not.toMatch(/resend|sendgrid|nodemailer/i);
  });

  it('does not generate PDF', () => {
    expect(scriptContent).not.toMatch(/require.*puppeteer|require.*playwright|require.*chromium|import.*puppeteer|import.*playwright|import.*chromium/i);
  });

  it('does not write to production', () => {
    expect(scriptContent).not.toMatch(/INSERT INTO|UPDATE |DELETE FROM|DROP TABLE/i);
  });

  it('does not read owner files', () => {
    expect(scriptContent).not.toMatch(/\.xlsx|\.csv|Documents|Administratie/i);
  });
});

describe('productionReadinessVerify — target assertions present', () => {
  it('asserts username is finance_user', () => {
    expect(scriptContent).toContain('finance_user');
  });

  it('asserts port is 5433', () => {
    expect(scriptContent).toContain('5433');
  });

  it('asserts database is finance', () => {
    expect(scriptContent).toContain('/finance');
  });
});
