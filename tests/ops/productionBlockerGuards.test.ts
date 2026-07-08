/**
 * OPS-006 — Production blocker guard audit.
 *
 * Verifies that all production blockers remain active and that no code path
 * silently bypasses the declared guards. All tests are pure unit tests —
 * no database connections, no production access, no network.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// ─── 1. Historical production import blocks production by default ─────────────

import {
  buildHistoricalOwnerImportCommand,
} from '../../server/services/historicalOwnerImportCommandService';

describe('production blocker guards — historical owner import', () => {
  it('defaults to dry-run when no mode is specified', async () => {
    const result = await buildHistoricalOwnerImportCommand({
      repoRoot: process.cwd(),
      sources: [],
    });
    expect(result.defaultedToDryRun).toBe(true);
    expect(result.writesDatabase).toBe(false);
    expect(result.productionExecutionPerformed).toBe(false);
  });

  it('production mode is always blocked', async () => {
    const result = await buildHistoricalOwnerImportCommand({
      repoRoot: process.cwd(),
      sources: [],
      requestedMode: 'production',
      productionOptionConfirmed: true,
      dryRunSummaryAccepted: true,
      operatorConfirmationToken: 'I_UNDERSTAND_THIS_WOULD_IMPORT_OWNER_HISTORY',
    });
    expect(result.mode).toBe('production-blocked');
    expect(result.productionExecutionPerformed).toBe(false);
    expect(result.writesDatabase).toBe(false);
    expect(result.executionBlockedReasons.length).toBeGreaterThan(0);
    expect(result.executionBlockedReasons.some((r) => r.includes('blocked'))).toBe(true);
  });

  it('blocks 10.0.2.4 as a forbidden database target', async () => {
    const result = await buildHistoricalOwnerImportCommand({
      repoRoot: process.cwd(),
      sources: [],
      databaseUrl: 'postgresql://u:p@10.0.2.4:5432/finance',
    });
    expect(result.databaseTarget.classification).toBe('forbidden');
    expect(result.executionBlockedReasons.length).toBeGreaterThan(0);
    expect(result.productionExecutionPerformed).toBe(false);
  });

  it('blocks non-local host for rehearsal mode', async () => {
    const result = await buildHistoricalOwnerImportCommand({
      repoRoot: process.cwd(),
      sources: [],
      requestedMode: 'rehearsal',
      databaseUrl: 'postgresql://u:p@db.external.example.com:5432/finance',
    });
    expect(result.databaseTarget.classification).toBe('non-local');
    expect(result.executionBlockedReasons.some((r) => r.includes('localhost'))).toBe(true);
    expect(result.productionExecutionPerformed).toBe(false);
  });
});

// ─── 2. Report dispatch metadata-only, no external provider ──────────────────

import {
  prepareDispatch,
} from '../../server/services/reportApprovalDispatchService';

const makeDispatchDb = () => ({
  reportSnapshot: {
    findFirst: async () => ({
      id: 'snapshot-guard-1',
      snapshotHash: 'a'.repeat(64),
      periodCloseLinks: [{ periodClose: { id: 'close-1', status: 'CLOSED' } }],
    }),
    findUnique: async () => ({ id: 'snapshot-guard-1', snapshotHash: 'a'.repeat(64) }),
  },
  reportApproval: {
    findFirst: async (args: any) => {
      if (args?.where?.id !== undefined) {
        return { id: 'approval-guard-1', reportSnapshotId: 'snapshot-guard-1' };
      }
      return null;
    },
    create: async (args: any) => ({ id: 'approval-new', ...args.data, revokedAt: null }),
  },
  reportDispatch: {
    create: async (args: any) => ({
      id: 'dispatch-guard-1',
      status: 'PENDING',
      ...args.data,
      recipients: { create: args.data.recipients?.create ?? [] },
    }),
  },
} as any);

describe('production blocker guards — report dispatch', () => {
  it('dispatch sends no email and calls no external provider', async () => {
    const result = await prepareDispatch(makeDispatchDb(), {
      actor: { userId: 'u1', role: 'admin', actorId: 'a1' },
      workspaceId: 'ws-1',
      reportSnapshotId: 'snapshot-guard-1',
      reportApprovalId: 'approval-guard-1',
      fromAddress: 'finance@example.test',
      subject: 'Test',
      recipients: [{ email: 'admin@example.test' }],
      contentHash: 'x'.repeat(64),
    });
    expect(result.sideEffects.sendsEmail).toBe(false);
    expect(result.sideEffects.callsExternalProvider).toBe(false);
    expect(result.status).toBe('PENDING');
  });

  it('dispatch recipient hash does not contain plain email addresses', async () => {
    const result = await prepareDispatch(makeDispatchDb(), {
      actor: { userId: 'u1', role: 'admin', actorId: 'a1' },
      workspaceId: 'ws-1',
      reportSnapshotId: 'snapshot-guard-1',
      reportApprovalId: 'approval-guard-1',
      fromAddress: 'finance@example.test',
      subject: 'Test',
      recipients: [{ email: 'admin@example.test' }],
      contentHash: 'x'.repeat(64),
    });
    expect(result.recipientHash).toHaveLength(64);
    expect(result.recipientHash).not.toContain('@');
  });
});

// ─── 3. PDF generation is local report-artifact only ─────────────────────────

import {
  generatePdfArtifact,
} from '../../server/services/reportArtifactService';

import { ReportLineKind } from '@prisma/client';

const dummySnapshot = {
  snapshotId: 'snap-guard-1',
  snapshotHash: 'b'.repeat(64),
  kind: 'MONTHLY' as const,
  year: 2026,
  month: 1,
  openingBalanceMinor: '0',
  incomeMinor: '0',
  expenseMinor: '0',
  netMinor: '0',
  closingBalanceMinor: '0',
  transactionCount: 0,
  generatedBy: 'actor-1',
  generatedAt: new Date('2026-07-05T00:00:00Z'),
  lines: [],
};

describe('production blocker guards — PDF artifact renderer', () => {
  it('PDF artifact is generated locally as real PDF bytes', async () => {
    const buf = await generatePdfArtifact(dummySnapshot);
    const content = buf.toString('utf-8');
    expect(buf.subarray(0, 4).toString('utf-8')).toBe('%PDF');
    expect(content).not.toContain('PDF_PLACEHOLDER');
    expect(content).not.toContain('PDF_BLOCKER');
  });

  it('PDF artifact contains the snapshot id without production access', async () => {
    const buf = await generatePdfArtifact(dummySnapshot);
    const content = buf.toString('utf-8');
    expect(content).toContain('snap-guard-1');
  });
});

// ─── 4. Backup rehearsal rejects 10.0.2.4 and non-local hosts ────────────────

import {
  assertLocalDbUrl,
} from '../../scripts/backup-restore-rehearsal.mjs';

describe('production blocker guards — backup rehearsal host rejection', () => {
  it('rejects 10.0.2.4', () => {
    expect(() =>
      assertLocalDbUrl('postgresql://u:p@10.0.2.4:5432/finance')
    ).toThrow('GUARD');
  });

  it('rejects external hostname', () => {
    expect(() =>
      assertLocalDbUrl('postgresql://u:p@db.dokploy.internal:5432/finance')
    ).toThrow('GUARD');
  });

  it('rejects production-like database names', () => {
    expect(() =>
      assertLocalDbUrl('postgresql://u:p@localhost:5432/finance_production')
    ).toThrow('GUARD');
  });

  it('accepts localhost with rehearsal-prefixed database', () => {
    expect(() =>
      assertLocalDbUrl('postgresql://u:p@localhost:5432/yaf_rehearsal_tgt_123')
    ).not.toThrow();
  });
});

// ─── 5. Package scripts contain no production deploy/push commands ────────────

const pkg = JSON.parse(
  readFileSync(resolve(process.cwd(), 'package.json'), 'utf-8'),
) as { scripts: Record<string, string> };

describe('production blocker guards — package scripts', () => {
  it('no script contains git push', () => {
    for (const [name, script] of Object.entries(pkg.scripts)) {
      expect(`${name}:${script}`).not.toMatch(/git\s+push/);
    }
  });

  it('no script references 10.0.2.4', () => {
    for (const [name, script] of Object.entries(pkg.scripts)) {
      expect(`${name}:${script}`).not.toContain('10.0.2.4');
    }
  });

  it('no script references Dokploy or production deploy', () => {
    for (const [name, script] of Object.entries(pkg.scripts)) {
      expect(`${name}:${script}`).not.toMatch(/dokploy/i);
    }
  });

  it('no script sends real email', () => {
    for (const [name, script] of Object.entries(pkg.scripts)) {
      expect(`${name}:${script}`).not.toMatch(/RESEND_API_KEY=[^p]/);
    }
  });
});

// ─── 6. Owner decision pack lists all blockers ───────────────────────────────

describe('production blocker guards — owner decision pack', () => {
  it('OWNER_DECISION_PACK_NL.md exists and lists all required decisions', () => {
    const content = readFileSync(
      resolve(process.cwd(), 'docs/OWNER_DECISION_PACK_NL.md'),
      'utf-8',
    );
    expect(content).toContain('PDF');
    expect(content).toContain('Productiemigratie');
    expect(content).toContain('Historische');
    expect(content).toContain('e-mail');
    expect(content).toContain('PostgreSQL');
    expect(content).toContain('backup');
  });
});

// ─── 7. Production cutover plan is documentation-only ────────────────────────

describe('production blocker guards — production cutover plan', () => {
  it('PRODUCTION_CUTOVER_PLAN_NL.md is documentation-only (no executable production commands)', () => {
    const content = readFileSync(
      resolve(process.cwd(), 'docs/PRODUCTION_CUTOVER_PLAN_NL.md'),
      'utf-8',
    );
    // Must declare itself documentation-only
    expect(content).toMatch(/documentatie-alleen|documentation-only/i);
    // Must not contain 10.0.2.4 (actual production host)
    expect(content).not.toContain('10.0.2.4');
    // Must state no production commands were executed
    expect(content).toContain('geen productiecommando');
  });
});

// ─── 8. Backup rehearsal default invocation is safe ──────────────────────────

describe('production blocker guards — backup rehearsal safe default', () => {
  it('script requires an explicit safe mode before live DB commands can run', () => {
    const content = readFileSync(
      resolve(process.cwd(), 'scripts/backup-restore-rehearsal.mjs'),
      'utf-8',
    );
    expect(content).toContain('Geen geldig uitvoermodus opgegeven');
    expect(content).toContain('--dry-run');
    expect(content).toContain('--live-local');
    expect(content).toContain('--confirm-disposable');
    expect(content).toContain('process.exit(1)');
    expect(content).toContain('Use --dry-run for a safe guard-check without a database.');
  });
});

// ─── 9. No script references exposed production host ─────────────────────────

describe('production blocker guards — no production host in release scripts', () => {
  it('generate-release-manifest.mjs does not construct connections to 10.0.2.4 or Dokploy', () => {
    const content = readFileSync(
      resolve(process.cwd(), 'scripts/generate-release-manifest.mjs'),
      'utf-8',
    );
    // Must not use these hosts in actual connection strings
    expect(content).not.toMatch(/postgresql:\/\/[^@]*@10\.0\.2\.4/);
    expect(content).not.toMatch(/postgresql:\/\/[^@]*@[a-z.]*dokploy/i);
  });

  it('backup-restore-rehearsal.mjs does not reference external production hosts inline', () => {
    const content = readFileSync(
      resolve(process.cwd(), 'scripts/backup-restore-rehearsal.mjs'),
      'utf-8',
    );
    // The BLOCKED_HOSTS array may mention '10.0.2.4' as a guard pattern — that is allowed
    // What we check: no actual URL construction uses a non-local host
    expect(content).not.toMatch(/postgresql:\/\/[^@]*@10\.0\.2\.4/);
    expect(content).not.toMatch(/postgresql:\/\/[^@]*@[a-z]+\.dokploy/i);
  });
});

// ─── 10. No .env path read by release scripts ────────────────────────────────

describe('production blocker guards — release scripts do not read .env', () => {
  it('generate-release-manifest.mjs does not read .env', () => {
    const content = readFileSync(
      resolve(process.cwd(), 'scripts/generate-release-manifest.mjs'),
      'utf-8',
    );
    expect(content).not.toMatch(/readFileSync\([^)]*\.env/);
    expect(content).not.toMatch(/require\([^)]*\.env/);
    expect(content).not.toMatch(/dotenv/);
  });

  it('backup-restore-rehearsal.mjs does not read .env', () => {
    const content = readFileSync(
      resolve(process.cwd(), 'scripts/backup-restore-rehearsal.mjs'),
      'utf-8',
    );
    expect(content).not.toMatch(/readFileSync\([^)]*\.env/);
    expect(content).not.toMatch(/dotenv/);
  });
});



// ─── 11. Owner-review scripts remain plan/preflight only ─────────────────────

describe('production blocker guards — owner-review scripts are non-executing', () => {
  const ownerScriptPaths = [
    'scripts/owner-decision-preflight.mjs',
    'scripts/push-readiness-preflight.mjs',
    'scripts/owner-approved-action-plan.mjs',
  ];

  it('owner scripts do not execute production, publish, install, email, or historical import actions', () => {
    for (const scriptPath of ownerScriptPaths) {
      const content = readFileSync(resolve(process.cwd(), scriptPath), 'utf-8');
      expect(content, scriptPath).not.toMatch(/execSync\([^)]*git\s+push/i);
      expect(content, scriptPath).not.toMatch(/execSync\([^)]*git\s+tag/i);
      expect(content, scriptPath).not.toMatch(/execSync\([^)]*npm\s+(install|ci)/i);
      expect(content, scriptPath).not.toMatch(/execSync\([^)]*pnpm\s+install/i);
      expect(content, scriptPath).not.toMatch(/execSync\([^)]*yarn\s+install/i);
      expect(content, scriptPath).not.toMatch(/resend\.emails\.send|sendMail/i);
      expect(content, scriptPath).not.toMatch(/execSync\([^)]*historical.*production/i);
      expect(content, scriptPath).not.toMatch(/postgresql:\/\/[^@]*@10\.0\.2\.4/i);
      expect(content, scriptPath).not.toMatch(/postgresql:\/\/[^@]*@[^\s]*dokploy/i);
    }
  });

  it('owner scripts do not read .env or mutate files except documented write outputs', () => {
    for (const scriptPath of ownerScriptPaths) {
      const content = readFileSync(resolve(process.cwd(), scriptPath), 'utf-8');
      expect(content, scriptPath).not.toMatch(/readFileSync\([^)]*\.env/);
      expect(content, scriptPath).not.toMatch(/dotenv/);
    }

    expect(readFileSync(resolve(process.cwd(), 'scripts/owner-decision-preflight.mjs'), 'utf-8'))
      .toContain('docs/OWNER_DECISION_PREFLIGHT_NL.md');
    expect(readFileSync(resolve(process.cwd(), 'scripts/owner-approved-action-plan.mjs'), 'utf-8'))
      .toContain('docs/OWNER_APPROVED_ACTION_PLAN_NL.md');
  });
});
