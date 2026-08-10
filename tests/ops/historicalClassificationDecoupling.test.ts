import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(__dirname, '../../server');
const read = (rel: string) => readFileSync(resolve(root, rel), 'utf-8');

const reviewDecisionService = read('services/reviewDecisionService.ts');
const manualBookingReopenService = read('services/manualBookingReopenService.ts');
const reportReconciliationService = read('services/reportReconciliationService.ts');
const importService = read('services/importService.ts');
const monthlySendRoute = read('routes/monthlySendReport.ts');

describe('bank-truth / categorization decoupling', () => {
  describe('A — classification change after closed PeriodClose', () => {
    it('reviewDecisionService does not check PeriodClose state', () => {
      expect(reviewDecisionService).not.toContain('PeriodClose');
      expect(reviewDecisionService).not.toContain('periodClose');
      expect(reviewDecisionService).not.toContain('PeriodCloseStatus');
    });

    it('manualBookingReopenService does not check PeriodClose state', () => {
      expect(manualBookingReopenService).not.toContain('PeriodClose');
      expect(manualBookingReopenService).not.toContain('periodCloseStatus');
    });
  });

  describe('B — recategorization does not alter old snapshots', () => {
    it('reviewDecisionService does not touch ReportSnapshot or ReportArtifact', () => {
      expect(reviewDecisionService).not.toContain('reportSnapshot');
      expect(reviewDecisionService).not.toContain('ReportSnapshot');
      expect(reviewDecisionService).not.toContain('reportArtifact');
      expect(reviewDecisionService).not.toContain('ReportArtifact');
    });

    it('manualBookingReopenService does not touch ReportSnapshot or ReportArtifact', () => {
      expect(manualBookingReopenService).not.toContain('reportSnapshot');
      expect(manualBookingReopenService).not.toContain('ReportSnapshot');
      expect(manualBookingReopenService).not.toContain('reportArtifact');
    });
  });

  describe('C — subsequent report uses corrected current classification', () => {
    it('monthly send generates a LIVE snapshot from current data each time', () => {
      expect(monthlySendRoute).toContain('generateLiveMonthlyReportSnapshot');
    });

    it('monthly send reconciles bank controls independently of classification', () => {
      expect(monthlySendRoute).toContain('reconcileMonthlyReport');
      expect(reportReconciliationService).toContain('classificationReadiness');
      expect(reportReconciliationService).not.toContain('throw.*UNBOOKED');
    });

    it('bank controls in reconciliation are independent of project/type/category', () => {
      expect(reportReconciliationService).not.toContain('projectId');
      expect(reportReconciliationService).not.toContain('transactionTypeId');
      expect(reportReconciliationService).not.toContain('categoryId');
    });
  });

  describe('D — bank-fact lock remains for import protection', () => {
    it('importService still checks ledger lock before import', () => {
      expect(importService).toContain('lockedAt');
      expect(importService).toMatch(/LOCKS_ENABLED.*lockedAt|lockedAt.*LOCKS_ENABLED/);
    });

    it('importService protects financial data on locked ledger', () => {
      expect(importService).toContain('lockedAt: now');
    });
  });

  describe('classification mutation paths have no Ledger.lockedAt gate', () => {
    it('reviewDecisionService has no lockedAt check', () => {
      expect(reviewDecisionService).not.toContain('lockedAt');
      expect(reviewDecisionService).not.toContain('assertUnlockedLedger');
    });

    it('manualBookingReopenService no longer gates on lockedAt', () => {
      expect(manualBookingReopenService).not.toContain('LEDGER_LOCKED');
      expect(manualBookingReopenService).toContain('Classification correction is always allowed');
    });
  });

  describe('immutable bank facts vs mutable classification', () => {
    it('manualBookingReopenService declares it does not mutate imported bank facts', () => {
      expect(manualBookingReopenService).toContain('mutatesImportedBankFacts: false');
    });

    it('manualBookingReopenService resets classification only', () => {
      expect(manualBookingReopenService).toContain('resetsTransactionClassification: true');
    });

    it('reviewDecisionService updates only classification fields on transaction', () => {
      expect(reviewDecisionService).toContain('classificationSource');
      expect(reviewDecisionService).not.toContain('amountMinor:');
      expect(reviewDecisionService).not.toContain("direction:");
    });
  });
});
