/**
 * Program Phase 3.1 Merchant Knowledge contract documentation guard.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const architecture = readFileSync(
  resolve(process.cwd(), 'docs/architecture/MERCHANT_KNOWLEDGE_ARCHITECTURE.md'),
  'utf-8',
);
const plan = readFileSync(resolve(process.cwd(), 'docs/IMPLEMENTATION_PLAN.md'), 'utf-8');

describe('merchant knowledge contract documentation', () => {
  it('defines all ten Phase 3.1 domain contracts', () => {
    for (const heading of [
      'Contract 1 — Merchant identity',
      'Contract 2 — Merchant alias',
      'Contract 3 — Merchant fingerprint',
      'Contract 4 — Merchant-resolution result',
      'Contract 5 — Merchant conflict',
      'Contract 6 — Merge and split decision',
      'Contract 7 — Audit and provenance',
      'Contract 8 — Workspace isolation',
      'Contract 9 — Retrieval-anchor contract',
      'Contract 10 — Dry-run backfill result',
    ]) {
      expect(architecture).toContain(heading);
    }
  });

  it('requires workspace isolation and immutable raw facts', () => {
    expect(architecture).toContain('Workspace identity is established server-side');
    expect(architecture).toContain('no update of raw `Transaction` facts or `rawRow`');
    expect(architecture).toContain('Cross-workspace candidates, statistics, aliases, and retrieval examples are prohibited.');
  });

  it('restricts retrieval to confirmed bookings and abstains on conflict', () => {
    expect(architecture).toContain('retrieval examples remain restricted to confirmed `TransactionBooking` outcomes');
    expect(architecture).toContain('open conflict forces merchant-resolution abstention and human review');
    expect(architecture).toContain('only weak text or amount similarity is available');
  });

  it('declares dry-run merchant planning side-effect free', () => {
    expect(architecture).toContain('writesMerchantKnowledge: false');
    expect(architecture).toContain('createsTransactionBooking: false');
    expect(architecture).toContain('mutatesBankFacts: false');
    expect(architecture).toContain('changesTrustedHistory: false');
  });

  it('keeps merchant fingerprints separate from import deduplication fingerprints', () => {
    expect(architecture).toContain('must not be reused as merchant fingerprints');
  });

  it('ties Phase 3.1 to categorization quality for the corrected benchmark', () => {
    expect(architecture).toContain('Connection to the corrected 221-transaction benchmark');
    expect(architecture).toContain('improved, measurable categorization precision');
    expect(plan).toContain('3.1 Domain and data-contract design — COMPLETE');
    expect(plan).toContain('Phase 3.3 deterministic fingerprint extraction is the exact next task');
  });
});
