/**
 * Transaction Review and Intelligence Program documentation consistency.
 *
 * Guards only the future Phase 3–7 roadmap and implementation-plan contract.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const readDoc = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf-8');

const roadmap = readDoc('docs/ROADMAP.md');
const implementationPlan = readDoc('docs/IMPLEMENTATION_PLAN.md');
const combined = `${roadmap}\n${implementationPlan}`;

const phaseNames = [
  'Program Phase 3 — Merchant Knowledge Layer',
  'Program Phase 4 — Retrieval and Decision Foundation',
  'Program Phase 5 — AI Decision Engine',
  'Program Phase 6 — Evaluation, Calibration, and Observability',
  'Program Phase 7 — Controlled Rollout',
];

const architectureRefs = [
  'docs/architecture/ARCHITECTURAL_INVARIANTS.md',
  'docs/architecture/SYSTEM_ARCHITECTURE.md',
  'docs/architecture/MERCHANT_KNOWLEDGE_ARCHITECTURE.md',
  'docs/architecture/DECISION_ENGINE_ARCHITECTURE.md',
];

describe('transaction intelligence program documentation consistency', () => {
  it('preserves Program Phase 2 status', () => {
    expect(roadmap).toContain('Program Phase 2 — Review-table redesign and pagination');
    expect(roadmap).toContain('IMPLEMENTED');
    expect(implementationPlan).toContain('Program Phase 2');
  });

  it('uses the approved future Phase 3–7 names in both documents', () => {
    for (const phaseName of phaseNames) {
      expect(roadmap).toContain(phaseName);
      expect(implementationPlan).toContain(phaseName.replace(' — ', ': '));
    }
  });

  it('does not restore the superseded future phase names', () => {
    for (const oldName of [
      'Program Phase 3 — Merchant normalization',
      'Program Phase 4 — Confirmed-history retrieval',
      'Program Phase 5 — Bedrock Haiku classifier',
      'Program Phase 6 — Sonnet fallback',
      'Program Phase 7 — Calibration and rollout',
    ]) {
      expect(combined).not.toContain(oldName);
    }
  });

  it('references every approved intelligence architecture document', () => {
    for (const reference of architectureRefs) {
      expect(roadmap).toContain(reference);
      expect(implementationPlan).toContain(reference);
    }
  });

  it('keeps the program focused on the corrected 221-transaction benchmark', () => {
    expect(roadmap).toContain('corrected 221-transaction benchmark');
    expect(implementationPlan).toContain('221 unresolved transactions');
    expect(implementationPlan).toContain('221-transaction benchmark');
  });

  it('preserves human confirmation and excludes default automatic booking', () => {
    expect(combined).toContain('confirmed-outcomes-only learning');
    expect(combined).toContain('administrator-only confirmation');
    expect(combined).toContain('Automatic booking remains outside the default Program Phase 3–7 scope.');
  });
});
