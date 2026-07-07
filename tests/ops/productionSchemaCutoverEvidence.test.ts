import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { describe, it, expect } from 'vitest';

const EVIDENCE_PATH = join(process.cwd(), 'docs/PRODUCTION_SCHEMA_CUTOVER_EVIDENCE_NL.md');

describe('production schema cutover evidence', () => {
  it('evidence doc exists', () => {
    expect(existsSync(EVIDENCE_PATH)).toBe(true);
  });

  it('says production schema cutover completed', () => {
    const content = readFileSync(EVIDENCE_PATH, 'utf-8');
    expect(content).toContain('Productie schema cutover voltooid');
  });

  it('references finance database and finance schema', () => {
    const content = readFileSync(EVIDENCE_PATH, 'utf-8');
    expect(content).toContain('finance');
    expect(content).toContain('Productie database');
    expect(content).toContain('Productie schema');
  });

  it('references finance_user and port 5433', () => {
    const content = readFileSync(EVIDENCE_PATH, 'utf-8');
    expect(content).toContain('finance_user');
    expect(content).toContain('5433');
  });

  it('does not contain DATABASE_URL', () => {
    const content = readFileSync(EVIDENCE_PATH, 'utf-8');
    expect(content).not.toContain('DATABASE_URL');
  });

  it('does not contain a host address', () => {
    const content = readFileSync(EVIDENCE_PATH, 'utf-8');
    expect(content).not.toContain('10.0.2.4');
  });

  it('does not contain password-shaped content', () => {
    const content = readFileSync(EVIDENCE_PATH, 'utf-8');
    // Check for base64-like or long random strings typical of passwords
    expect(content).not.toMatch(/:[A-Za-z0-9+/=]{20,}@/);
  });

  it('does not contain provider payloads or raw credentials', () => {
    const content = readFileSync(EVIDENCE_PATH, 'utf-8');
    expect(content).not.toContain('postgresql://');
    expect(content).not.toContain('postgres://');
  });

  it('does not contain owner files, raw rows, database dumps, or secrets', () => {
    const content = readFileSync(EVIDENCE_PATH, 'utf-8');
    expect(content).not.toContain('INSERT INTO');
    expect(content).not.toContain('COPY ');
    expect(content).not.toContain('.xlsx');
    expect(content).not.toContain('.csv');
    expect(content).not.toContain('pg_dump');
  });

  it('says historical import, real email, real PDF, and secret rotation remain blocked', () => {
    const content = readFileSync(EVIDENCE_PATH, 'utf-8');
    expect(content).toContain('Historische productie-import');
    expect(content).toContain('Echte e-mail');
    expect(content).toContain('Echte PDF');
    expect(content).toContain('Geheimrotatie');
  });
});
