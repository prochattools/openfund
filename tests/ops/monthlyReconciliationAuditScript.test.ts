import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const SCRIPT_PATH = path.resolve(__dirname, '../../scripts/monthly-reconciliation-audit.mjs');

describe('monthly reconciliation audit script', () => {
  it('defaults to dry-run and keeps sensitive data out of output paths', () => {
    const content = fs.readFileSync(SCRIPT_PATH, 'utf8');

    expect(content).toContain("mode === 'dry-run'");
    expect(content).toContain('DATABASE_URL');
    expect(content).toContain('audit passed');
    expect(content).not.toContain('console.log(rawRow');
    expect(content).not.toContain('raw transaction rows');
    expect(content).not.toContain('postgresql://');
    expect(content).not.toContain('sk_live_');
    expect(content).not.toContain('re_');
  });
});
