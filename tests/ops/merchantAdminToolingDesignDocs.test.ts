import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const design = readFileSync(
  resolve(process.cwd(), 'docs/MERCHANT_ADMIN_TOOLING_DESIGN.md'),
  'utf-8',
);
const architecture = readFileSync(
  resolve(process.cwd(), 'docs/architecture/MERCHANT_KNOWLEDGE_ARCHITECTURE.md'),
  'utf-8',
);
const plan = readFileSync(
  resolve(process.cwd(), 'docs/IMPLEMENTATION_PLAN.md'),
  'utf-8',
);

describe('merchant administrator tooling readiness documentation', () => {
  it('keeps merchant maintenance separate from transaction booking review', () => {
    expect(design).toContain('/settings/merchant-knowledge');
    expect(design).toContain('Do not embed merchant identity maintenance inside `/review`');
    expect(design).toContain('must never create or rewrite a `TransactionBooking`');
  });

  it('requires authenticated reads and server-authoritative administrator mutations', () => {
    expect(design).toContain('Every mutation route must call `requireAdmin`');
    expect(design).toContain('forbidden (`403`)');
    expect(design).toContain('server `requireAdmin` remains authoritative');
  });

  it('prohibits bulk operations and requires individual confirmation', () => {
    expect(design).toContain('No checkbox selection, multi-select, “apply all”, “merge selected”, bulk approval, or bulk deprecation may exist.');
    expect(design).toContain('one explicit action only');
    expect(design).toContain('administratorConfirmationRequired: true');
  });

  it('requires evidence, rollback, audit, and workspace isolation', () => {
    expect(design).toContain('before and after snapshots');
    expect(design).toContain('rollback plan');
    expect(design).toContain('dedicated workspace-scoped `MerchantAuditEvent`');
    expect(design).toContain('resolve workspace from request context, never request body authority');
  });

  it('defines responsive and accessible evidence and confirmation behavior', () => {
    expect(design).toContain('full-width and reachable on mobile');
    expect(design).toContain('Radix `Dialog`/`Sheet` semantics');
    expect(design).toContain('color is supplemental');
    expect(design).toContain('aria-busy');
  });

  it('keeps exposure disabled and implementation blocked until persistence prerequisites exist', () => {
    expect(design).toContain('MERCHANT_KNOWLEDGE_ADMIN_ENABLED');
    expect(design).toContain('default `false`');
    expect(design).toContain('Phase 3.8 mutation code is blocked until');
    expect(plan).toContain('READINESS DESIGN COMPLETE; IMPLEMENTATION BLOCKED');
    expect(architecture).toContain('Program Phase 3.8 — Administrator tooling readiness design');
  });

  it('preserves locked-period accounting protections without blocking knowledge-only evidence changes', () => {
    expect(design).toContain('Merchant Knowledge maintenance is a separate knowledge-domain operation');
    expect(design).toContain('any attempted financial mutation: reject');
    expect(design).toContain('does not change historical booked accounting');
  });
});
