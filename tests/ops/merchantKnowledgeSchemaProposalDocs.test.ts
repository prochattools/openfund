/**
 * Program Phase 3.2 Merchant Knowledge schema proposal documentation guard.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const proposal = readFileSync(
  resolve(process.cwd(), 'docs/MERCHANT_KNOWLEDGE_SCHEMA_PROPOSAL.md'),
  'utf-8',
);
const architecture = readFileSync(
  resolve(process.cwd(), 'docs/architecture/MERCHANT_KNOWLEDGE_ARCHITECTURE.md'),
  'utf-8',
);
const plan = readFileSync(resolve(process.cwd(), 'docs/IMPLEMENTATION_PLAN.md'), 'utf-8');

describe('merchant knowledge schema proposal documentation', () => {
  it('remains a proposal and does not authorize schema or migration execution', () => {
    expect(proposal).toContain('This document is an implementation-ready proposal only.');
    expect(proposal).toContain('It does not modify `prisma/schema.prisma`');
    expect(proposal).toContain('This proposal does not authorize implementation');
  });

  it('defines the complete proposed merchant persistence set', () => {
    for (const model of [
      '### Merchant',
      '### MerchantAlias',
      '### MerchantFingerprint',
      '### MerchantResolution',
      '### MerchantConflict',
      '### MerchantIdentityDecision',
      '### MerchantAuditEvent',
      '### MerchantBackfillRun',
      '### MerchantBackfillResult',
    ]) {
      expect(proposal).toContain(model);
    }
  });

  it('requires workspace-scoped conditional uniqueness', () => {
    expect(proposal).toContain('MerchantAlias_workspace_type_value_active_key');
    expect(proposal).toContain('MerchantFingerprint_workspace_type_hash_active_key');
    expect(proposal).toContain('MerchantConflict_workspace_transaction_key_open_key');
    expect(proposal).toContain('Prisma schema declarations cannot express all required conditional uniqueness');
  });

  it('preserves immutable transactions, bookings, reviews, and suggestion purity', () => {
    expect(proposal).toContain('no `INSERT`, `UPDATE`, or `DELETE` against `Transaction`, `TransactionBooking`, `ReviewDecision`, or `CategorizationSuggestion`');
    expect(proposal).toContain('suggestion-to-merchant seed');
    expect(proposal).toContain('Merchant knowledge must not contain project, transaction-type, or category defaults');
  });

  it('defines safe disable, rollback, and disposable replay validation', () => {
    expect(proposal).toContain('remain fully compatible while every merchant table is empty and no service reads it');
    expect(proposal).toContain('disposable local PostgreSQL database');
    expect(proposal).toContain('prisma migrate deploy');
    expect(proposal).toContain('database-to-schema diff');
  });

  it('supports the required 221-transaction metrics without accounting defaults', () => {
    for (const metric of [
      'known merchant coverage',
      'new merchant rate',
      'alias consolidation',
      'fingerprint collision rate',
      'merchant conflict rate',
      'unresolved merchant rate',
      'correction reuse',
      'known-versus-new categorization accuracy',
      'false merchant merge rate',
      'retrieval-anchor coverage',
    ]) {
      expect(proposal).toContain(metric);
    }
    expect(proposal).toContain('no project/type/category fields');
  });

  it('records Phase 3.2 completion and Phase 3.3 as the next task', () => {
    expect(architecture).toContain('Program Phase 3.2 — Approved schema and migration design');
    expect(plan).toContain('3.2 Additive schema and migration planning — COMPLETE');
    expect(plan).toContain('Phase 3.3 deterministic fingerprint extraction is the exact next task');
  });
});
