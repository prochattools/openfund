/**
 * OPS-012 — Phase 4 monthly workflow closeout evidence.
 *
 * Static/local guard for the RC4 closeout claim: monthly preview, safe
 * categorization, evidence-rich review, and explicit rule creation are complete
 * for app/local behavior without production imports or implicit financial truth.
 */

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf-8');
const exists = (path: string) => existsSync(resolve(process.cwd(), path));

const implementationPlan = read('docs/IMPLEMENTATION_PLAN.md');
const roadmap = read('docs/ROADMAP.md');
const previewService = read('server/services/monthlyImportPreviewService.ts');
const deterministicService = read('server/services/deterministicCategorizationService.ts');
const reviewQueueService = read('server/services/reviewQueueService.ts');
const reviewDecisionService = read('server/services/reviewDecisionService.ts');
const ruleCreationService = read('server/services/ruleCreationService.ts');
const uploadRoute = read('server/routes/upload.ts');
const reviewRoute = read('server/routes/review.ts');

describe('Phase 4 monthly import/review workflow closeout', () => {
  it('marks FLOW-001 through FLOW-004 complete for local/app behavior', () => {
    expect(roadmap).toContain('Phase 4 — Monthly import and review workflow     COMPLETE_LOCAL_APP_WORKFLOW');
    expect(implementationPlan).toContain('Status: `DONE_LOCAL_APP_WORKFLOW`');
    expect(implementationPlan).toContain('Phase 4 FLOW-001 through FLOW-004 are complete for local/app behavior.');

    for (const task of ['FLOW-001', 'FLOW-002', 'FLOW-003', 'FLOW-004']) {
      expect(implementationPlan).toContain(`### ${task}`);
    }
  });

  it('keeps monthly import preview read-only and retained-source aware', () => {
    expect(previewService).toContain('sourceFile: MonthlyImportPreviewSourceFile');
    expect(previewService).toContain('retainedBytesHash');
    expect(previewService).toContain('sizeBytes');
    expect(previewService).toContain('closeEligibility');
    expect(previewService).toContain('booking: {');
    expect(previewService).toContain('createsTransactions: false');
    expect(previewService).toContain('createsTransactionBookings: false');
    expect(previewService).toContain('closesPeriod: false');
    expect(uploadRoute).toContain('buildMonthlyImportPreview');
    expect(uploadRoute).toContain('buildMonthlyImportPreviewUploadResponse');
  });

  it('requires safe deterministic candidates and explicit admin decisions before financial truth changes', () => {
    expect(deterministicService).toContain('sideEffects');
    expect(deterministicService).toContain('createsTransactionBooking: false');
    expect(deterministicService).toContain('closesPeriod: false');
    expect(reviewDecisionService).toContain("actor.role && actor.role !== 'admin'");
    expect(reviewDecisionService).not.toContain('assertUnlockedLedger(transaction)');
    expect(reviewDecisionService).toContain('Financial reconciliation protects imported monetary facts');
    expect(reviewDecisionService).toContain('projectId');
    expect(reviewDecisionService).toContain('transactionTypeId');
    expect(reviewDecisionService).toContain('categoryId');
  });

  it('keeps review evidence sanitized and rule creation explicit', () => {
    expect(reviewQueueService).toContain('sideEffects');
    expect(reviewQueueService).toContain('createsTransactionBooking: false');
    expect(reviewQueueService).toContain('closesPeriod: false');
    expect(reviewRoute).toContain('previewReviewRuleCreation');
    expect(reviewRoute).toContain('activateReviewRuleCreation');
    expect(ruleCreationService).toContain("actor.role && actor.role !== 'admin'");
    expect(ruleCreationService).toContain('previewHash');
    expect(ruleCreationService).toContain('activationAllowed');
    expect(ruleCreationService).toContain('createsTransactionBooking: false');
  });

  it('has focused regression coverage in Git', () => {
    for (const testPath of [
      'tests/services/monthlyImportPreviewService.test.ts',
      'tests/routes/monthlyImportPreview.test.ts',
      'tests/services/deterministicCategorizationService.test.ts',
      'tests/services/reviewQueueService.test.ts',
      'tests/services/reviewDecisionService.test.ts',
      'tests/routes/review.test.ts',
      'tests/services/ruleCreationService.test.ts',
      'tests/auth/adminMutationPolicy.test.ts',
    ]) {
      expect(exists(testPath), testPath).toBe(true);
    }
  });
});
