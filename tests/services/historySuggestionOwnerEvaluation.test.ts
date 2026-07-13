import { describe, expect, it } from 'vitest';
import { buildOwnerHistoricalLocalRehearsal } from '../../lib/import/historicalOwnerLocalRehearsal';
import type { HistoricalTransactionPlan } from '../../lib/import/historicalImportPlanner';
import {
  evaluateHistorySuggestions,
} from '../../server/services/historySuggestionEvaluationService';
import type { ApprovedHistoryBooking } from '../../server/services/historySuggestionService';
import { readSuggestionRawString } from '../../server/services/transactionSuggestionFacts';
import {
  OWNER_HISTORICAL_SOURCES,
  ownerHistoricalFilesAvailable,
} from '../fixtures/ownerHistoricalSources';

const toApprovedBooking = (transaction: HistoricalTransactionPlan): ApprovedHistoryBooking => {
  if (!transaction.klant || !transaction.type || !transaction.category) {
    throw new Error(`Historical booking ${transaction.fingerprint} is missing a complete dimension triple.`);
  }

  return {
    transactionId: transaction.fingerprint,
    date: new Date(transaction.date),
    accountId: transaction.accountIdentifier,
    direction: transaction.direction,
    amountMinor: transaction.amountMinor,
    counterparty: transaction.counterparty,
    counterpartyIban: readSuggestionRawString(transaction.rawRow, [
      'Counterparty IBAN',
      'CounterpartyIban',
      'Counterparty account',
      'IBAN/BBAN',
    ]),
    description: transaction.paymentPurpose
      ?? transaction.reference
      ?? transaction.counterparty
      ?? transaction.code
      ?? transaction.fingerprint,
    paymentPurpose: transaction.paymentPurpose,
    bookingId: `booking-${transaction.fingerprint}`,
    projectId: transaction.klant,
    transactionTypeId: transaction.type,
    categoryId: transaction.category,
    bookingEvidenceHash: transaction.fingerprint,
  };
};

describe('history suggestion owner evaluation', () => {
  const ownerEvaluation = ownerHistoricalFilesAvailable() ? it : it.skip;

  ownerEvaluation(
    'measures chronological and safe leave-one-out quality over all 681 approved bookings',
    async () => {
      const bundle = await buildOwnerHistoricalLocalRehearsal({
        repoRoot: process.cwd(),
        sources: OWNER_HISTORICAL_SOURCES,
      });
      const approvedBookings = [
        ...bundle.plans.concluded2024.workbook.transactions,
        ...bundle.plans.concluded2025.workbook.transactions,
      ].map(toApprovedBooking);

      expect(approvedBookings).toHaveLength(681);

      const chronological = evaluateHistorySuggestions(approvedBookings, {
        mode: 'chronological',
      });
      const leaveOneOut = evaluateHistorySuggestions(approvedBookings, {
        mode: 'leave-one-out',
      });

      expect(chronological.sampleCount).toBe(681);
      expect(leaveOneOut.sampleCount).toBe(681);
      expect(chronological.coveredCount).toBeGreaterThanOrEqual(679);
      expect(leaveOneOut.coveredCount).toBeGreaterThanOrEqual(679);
      expect(chronological.topThreeAccuracyBasisPoints).toBeGreaterThanOrEqual(
        chronological.topOneAccuracyBasisPoints,
      );
      expect(leaveOneOut.topThreeAccuracyBasisPoints).toBeGreaterThanOrEqual(
        leaveOneOut.topOneAccuracyBasisPoints,
      );
      expect(chronological.safeguards).toEqual({
        futureEvidenceExcluded: true,
        createsCategorizationSuggestion: false,
        createsTransactionBooking: false,
        mutatesBankFacts: false,
      });
      expect(leaveOneOut.safeguards).toEqual(chronological.safeguards);

      console.info('history suggestion owner evaluation', JSON.stringify({
        chronological,
        leaveOneOut,
      }));
    },
    180_000,
  );
});
