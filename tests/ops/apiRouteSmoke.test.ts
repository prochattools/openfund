/**
 * OPS-007 — API route smoke coverage.
 *
 * Validates route registration and contract invariants by reading server/index.ts
 * as text. No database, no network, no production access.
 *
 * Coverage:
 * - All major finance routes are registered
 * - Mutation routes are present (admin enforcement verified separately in adminMutationPolicy.test.ts)
 * - Strict close and reopen routes are present
 * - Report snapshot/artifact/approval/dispatch routes are present
 * - Upload and review and rule routes are present
 * - No production host references in server/index.ts
 * - No raw Resend API key usage in server/index.ts
 * - No hard-coded owner data or production credentials in server/index.ts
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const serverIndex = readFileSync(
  resolve(process.cwd(), 'server/index.ts'),
  'utf-8',
);

// ─── Route registration ───────────────────────────────────────────────────────

describe('API route smoke — route registration', () => {
  it('registers upload route', () => {
    expect(serverIndex).toContain('/api/upload');
  });

  it('registers ledger route', () => {
    expect(serverIndex).toContain('/api/ledger');
  });

  it('registers review routes', () => {
    expect(serverIndex).toContain('/api/review');
  });

  it('registers accounts routes', () => {
    expect(serverIndex).toContain('/api/accounts');
  });

  it('registers reconciliation route', () => {
    expect(serverIndex).toContain('/api/reconciliation');
  });

  it('registers reports summary route', () => {
    expect(serverIndex).toContain('/api/reports/summary');
  });

  it('registers audit-log route', () => {
    expect(serverIndex).toContain('/api/audit-log');
  });

  it('registers import-batches routes', () => {
    expect(serverIndex).toContain('/api/import-batches');
  });

  it('registers email-recipients routes', () => {
    expect(serverIndex).toContain('/api/email-recipients');
  });

  it('registers rules routes', () => {
    expect(serverIndex).toContain('/api/rules');
  });

  it('registers strict period close route', () => {
    expect(serverIndex).toContain('close');
    expect(serverIndex).toContain('postStrictPeriodClose');
  });

  it('registers audited period reopen route', () => {
    expect(serverIndex).toContain('reopen');
    expect(serverIndex).toContain('postAuditedPeriodReopen');
  });
});

// ─── Phase 6 report routes ────────────────────────────────────────────────────

describe('API route smoke — report snapshot and distribution routes', () => {
  it('registers monthly report preview route', () => {
    expect(serverIndex).toContain('getMonthlyReportPreview');
  });

  it('registers monthly report snapshot route', () => {
    expect(serverIndex).toContain('postMonthlyReportSnapshot');
  });

  it('registers yearly report snapshot route', () => {
    expect(serverIndex).toContain('postYearlyReportSnapshot');
  });

  it('registers report artifacts route', () => {
    expect(serverIndex).toContain('postReportArtifacts');
  });

  it('registers report approval route', () => {
    expect(serverIndex).toContain('postApproveReportSnapshot');
  });

  it('registers report dispatch prepare route', () => {
    expect(serverIndex).toContain('postPrepareReportDispatch');
  });
});

// ─── Production safety in server entrypoint ───────────────────────────────────

describe('API route smoke — production host safety', () => {
  it('does not reference production host 10.0.2.4', () => {
    expect(serverIndex).not.toContain('10.0.2.4');
  });

  it('does not reference Dokploy host', () => {
    expect(serverIndex.toLowerCase()).not.toContain('dokploy');
  });

  it('does not hard-code a production database URL', () => {
    expect(serverIndex).not.toMatch(/postgresql:\/\/[^"']*10\.0\.2\.4/);
  });
});

// ─── Email provider safety ────────────────────────────────────────────────────

describe('API route smoke — email provider safety', () => {
  it('does not reference a hard-coded Resend API key in server/index.ts', () => {
    expect(serverIndex).not.toMatch(/re_[A-Za-z0-9_]{10,}/);
  });

  it('does not import Resend directly in the server entrypoint', () => {
    // Email dispatch is delegated to reportApprovalDispatchService, not the entrypoint
    expect(serverIndex).not.toMatch(/from ['"]resend['"]/);
  });
});

// ─── Health endpoint ──────────────────────────────────────────────────────────

describe('API route smoke — health endpoint', () => {
  it('registers /healthz endpoint', () => {
    expect(serverIndex).toContain('/healthz');
  });
});
