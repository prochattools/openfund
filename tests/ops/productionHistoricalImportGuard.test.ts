/**
 * Production historical import guard tests.
 *
 * Verifies that the production import script enforces all required guards.
 * All tests are pure unit tests — no database connections, no network, no owner files.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const scriptPath = resolve(process.cwd(), 'scripts/production-historical-import.mjs');
const scriptContent = existsSync(scriptPath) ? readFileSync(scriptPath, 'utf-8') : '';

// ─── 1. Script existence ──────────────────────────────────────────────────────

describe('productionHistoricalImportGuard — script exists', () => {
  it('production-historical-import.mjs exists', () => {
    expect(existsSync(scriptPath)).toBe(true);
  });
});

// ─── 2. Default mode is dry-run ───────────────────────────────────────────────

describe('productionHistoricalImportGuard — default dry-run', () => {
  it('script defaults to dry-run when no mode is specified', () => {
    // Script reads mode from args, falling back to 'dry-run'
    expect(scriptContent).toContain("mode !== 'production'");
    expect(scriptContent).toContain("isDryRun");
    expect(scriptContent).toContain("'dry-run'");
  });

  it('production exit is guarded by isDryRun check', () => {
    expect(scriptContent).toContain('if (isDryRun)');
    expect(scriptContent).toContain('process.exit(0)');
  });
});

// ─── 3. Production mode requires all flags ────────────────────────────────────

describe('productionHistoricalImportGuard — production flags required', () => {
  it('requires --accept-dry-run flag', () => {
    expect(scriptContent).toContain('--accept-dry-run');
    expect(scriptContent).toContain('acceptDryRun');
  });

  it('requires --confirm-production-import token', () => {
    expect(scriptContent).toContain('--confirm-production-import');
    expect(scriptContent).toContain('YESHUA_FINANCE_IMPORT_2024_2025_2026');
    expect(scriptContent).toContain('REQUIRED_CONFIRM_TOKEN');
  });

  it('blocks production if --accept-dry-run is missing', () => {
    expect(scriptContent).toContain("if (!acceptDryRun)");
  });

  it('blocks production if confirm token is wrong', () => {
    expect(scriptContent).toContain('confirmToken !== REQUIRED_CONFIRM_TOKEN');
  });
});

// ─── 4. Database target assertion ─────────────────────────────────────────────

describe('productionHistoricalImportGuard — database target', () => {
  it('asserts finance_user as username', () => {
    expect(scriptContent).toContain("username !== 'finance_user'");
  });

  it('asserts database path /finance', () => {
    expect(scriptContent).toContain("database !== 'finance'");
  });

  it('asserts schema=finance', () => {
    expect(scriptContent).toContain("schema !== 'finance'");
  });

  it('asserts port 5433', () => {
    expect(scriptContent).toContain("port !== '5433'");
  });

  it('asserts password present', () => {
    expect(scriptContent).toContain('passwordPresent');
  });

  it('stops if DATABASE_URL is missing', () => {
    expect(scriptContent).toContain('DATABASE_URL is missing');
  });

  it('uses only process.env.DATABASE_URL and never reads env files', () => {
    expect(scriptContent).toContain('process.env.DATABASE_URL ?? null');
    expect(scriptContent).not.toContain('.env.production');
    expect(scriptContent).not.toContain('readFileSync(envFile');
  });

  it('does not print credentials on failure', () => {
    expect(scriptContent).toContain('Credential not printed.');
  });
});

// ─── 5. Hash verification ─────────────────────────────────────────────────────

describe('productionHistoricalImportGuard — hash verification', () => {
  it('verifies 2024 workbook hash', () => {
    expect(scriptContent).toContain('844699610889c6986fec305cdbb7b760da3dfc1d556ab9d0e160c854e1bc7f9f');
  });

  it('verifies 2025 workbook hash', () => {
    expect(scriptContent).toContain('d3913b876f3a6b8ddc3d19c49ef9778125e5e109a7d3ac330afbb3d6d8d7b2ff');
  });

  it('verifies 2026 CSV hash', () => {
    expect(scriptContent).toContain('768912927a7bb3b545616631e6d5360479a90b0bc6448faa3f225925636d31d3');
  });

  it('verifies 2026 PDF hash', () => {
    expect(scriptContent).toContain('5e830a365fe0d87f67e883f24239f60674ed85a174e65db6520136511a6d58d2');
  });

  it('stops on hash mismatch', () => {
    expect(scriptContent).toContain('Hash mismatch for');
    expect(scriptContent).toContain('process.exit(1)');
  });
});

// ─── 6. Control totals ────────────────────────────────────────────────────────

describe('productionHistoricalImportGuard — control totals', () => {
  it('enforces 2024 transaction count 268', () => {
    expect(scriptContent).toContain('transactionCount: 268');
  });

  it('enforces 2025 transaction count 413', () => {
    expect(scriptContent).toContain('transactionCount: 413');
  });

  it('enforces 2026 transaction count 221', () => {
    expect(scriptContent).toContain('transactionCount: 221');
  });

  it('stops on control total mismatch', () => {
    expect(scriptContent).toContain('Control total mismatch');
  });
});

// ─── 7. 2026 partial statement cannot be closed ───────────────────────────────

describe('productionHistoricalImportGuard — 2026 partial statement', () => {
  it('marks 2026 as PARTIAL with closePermitted=false', () => {
    expect(scriptContent).toContain("coverageStatus: 'PARTIAL'");
    expect(scriptContent).toContain('closePermitted: false');
  });

  it('verifies closePermitted is false in control check', () => {
    expect(scriptContent).toContain('closePermitted=false (correct, must not be closed)');
  });
});

// ─── 8. No raw rows in output ─────────────────────────────────────────────────

describe('productionHistoricalImportGuard — no raw rows', () => {
  it('does not print raw transaction rows', () => {
    expect(scriptContent).toContain('no raw rows printed');
  });

  it('sanitized output only: counts and totals', () => {
    // Script prints only counts/totals, not individual row data
    expect(scriptContent).toContain('formatEur');
    // No console.log of rawRow content
    expect(scriptContent).not.toMatch(/console\.log\([^)]*rawRow/);
  });
});

// ─── 9. No owner files copied into repo ──────────────────────────────────────

describe('productionHistoricalImportGuard — no owner files in repo', () => {
  it('reads owner files only from absolute paths outside repo', () => {
    // Script uses DEFAULT_OWNER_HISTORICAL_SOURCES which has absolute paths
    expect(scriptContent).toContain('DEFAULT_OWNER_HISTORICAL_SOURCES');
  });

  it('does not write owner files to repo', () => {
    // No fs.writeFileSync to repo-relative paths with owner file content
    expect(scriptContent).not.toMatch(/writeFileSync\([^)]*xlsx/i);
    expect(scriptContent).not.toMatch(/writeFileSync\([^)]*\.csv/i);
  });
});

// ─── 10. No credentials in script ────────────────────────────────────────────

describe('productionHistoricalImportGuard — no credentials', () => {
  it('does not hardcode DATABASE_URL or password', () => {
    expect(scriptContent).not.toMatch(/postgresql:\/\/[^:]+:[^@]{4,}@/);
  });

  it('does not print DATABASE_URL', () => {
    expect(scriptContent).not.toMatch(/console\.log\([^)]*databaseUrl/);
    expect(scriptContent).not.toMatch(/console\.log\([^)]*DATABASE_URL/);
  });
});

// ─── 11. Idempotency guard ────────────────────────────────────────────────────

describe('productionHistoricalImportGuard — idempotency', () => {
  it('stops if source files already present in production workspace', () => {
    expect(scriptContent).toContain('Historical import appears already present');
  });
});

// ─── 12. No email, no PDF, no secret rotation ────────────────────────────────

describe('productionHistoricalImportGuard — remaining blockers declared', () => {
  it('declares remaining blockers after import', () => {
    expect(scriptContent).toContain('remaining blockers: real email, real PDF, secret rotation');
  });

  it('does not call any email provider', () => {
    expect(scriptContent).not.toMatch(/resend\.emails\.send|sendMail|nodemailer/i);
  });

  it('does not add a PDF dependency', () => {
    expect(scriptContent).not.toMatch(/require\([^)]*pdf/i);
    expect(scriptContent).not.toMatch(/import.*pdf/i);
  });
});
