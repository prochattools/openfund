import type { PrismaClient } from '@prisma/client';
import {
  HISTORY_SUGGESTION_ALGORITHM_VERSION,
  rankHistorySuggestions,
  type ApprovedHistoryBooking,
  type HistorySuggestionFacts,
  type RankedHistorySuggestion,
} from './historySuggestionService';
import { toHistorySuggestionFacts } from './transactionSuggestionFacts';

export type HistoryEvaluationMode = 'chronological' | 'leave-one-out';

export type EvaluationBand = {
  predictions: number;
  correctTopOne: number;
  accuracyBasisPoints: number;
};

export type HistorySuggestionEvaluationResult = {
  algorithmVersion: string;
  mode: HistoryEvaluationMode;
  sampleCount: number;
  coveredCount: number;
  uncoveredCount: number;
  coverageBasisPoints: number;
  topOneCorrectCount: number;
  topOneAccuracyBasisPoints: number;
  topThreeCorrectCount: number;
  topThreeAccuracyBasisPoints: number;
  confidenceCalibration: Record<string, EvaluationBand>;
  matcherBreakdown: Record<string, EvaluationBand>;
  safeguards: {
    futureEvidenceExcluded: true;
    createsCategorizationSuggestion: false;
    createsTransactionBooking: false;
    mutatesBankFacts: false;
  };
};

const factsFromBooking = (booking: ApprovedHistoryBooking): HistorySuggestionFacts => ({
  transactionId: booking.transactionId,
  date: booking.date,
  accountId: booking.accountId,
  direction: booking.direction,
  amountMinor: booking.amountMinor,
  counterparty: booking.counterparty,
  counterpartyIban: booking.counterpartyIban,
  description: booking.description,
  paymentPurpose: booking.paymentPurpose,
});

const sameTriple = (
  candidate: Pick<RankedHistorySuggestion, 'projectId' | 'transactionTypeId' | 'categoryId'>,
  expected: Pick<ApprovedHistoryBooking, 'projectId' | 'transactionTypeId' | 'categoryId'>,
): boolean =>
  candidate.projectId === expected.projectId
  && candidate.transactionTypeId === expected.transactionTypeId
  && candidate.categoryId === expected.categoryId;

const accuracyBasisPoints = (correct: number, total: number): number =>
  total === 0 ? 0 : Math.round((correct * 10000) / total);

const addBand = (
  bands: Record<string, { predictions: number; correctTopOne: number }>,
  key: string,
  correct: boolean,
) => {
  const band = bands[key] ?? { predictions: 0, correctTopOne: 0 };
  band.predictions += 1;
  if (correct) band.correctTopOne += 1;
  bands[key] = band;
};

const finalizeBands = (
  bands: Record<string, { predictions: number; correctTopOne: number }>,
): Record<string, EvaluationBand> => Object.fromEntries(
  Object.entries(bands)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, band]) => [key, {
      ...band,
      accuracyBasisPoints: accuracyBasisPoints(band.correctTopOne, band.predictions),
    }]),
);

const sortedSamples = (samples: ApprovedHistoryBooking[]): ApprovedHistoryBooking[] =>
  [...samples].sort((left, right) => {
    const dateDifference = left.date.getTime() - right.date.getTime();
    if (dateDifference !== 0) return dateDifference;
    return left.transactionId.localeCompare(right.transactionId);
  });

const historyForTarget = (
  samples: ApprovedHistoryBooking[],
  target: ApprovedHistoryBooking,
  mode: HistoryEvaluationMode,
): ApprovedHistoryBooking[] => samples.filter((candidate) => {
  if (candidate.transactionId === target.transactionId) return false;
  const candidateTime = candidate.date.getTime();
  const targetTime = target.date.getTime();
  if (candidateTime < targetTime) return true;
  if (candidateTime > targetTime) return false;
  if (mode === 'leave-one-out') return true;
  return candidate.transactionId.localeCompare(target.transactionId) < 0;
});

export const evaluateHistorySuggestions = (
  approvedBookings: ApprovedHistoryBooking[],
  options: {
    mode?: HistoryEvaluationMode;
    algorithmVersion?: string;
  } = {},
): HistorySuggestionEvaluationResult => {
  const mode = options.mode ?? 'chronological';
  const algorithmVersion = options.algorithmVersion ?? HISTORY_SUGGESTION_ALGORITHM_VERSION;
  const samples = sortedSamples(approvedBookings);
  const confidenceBands: Record<string, { predictions: number; correctTopOne: number }> = {};
  const matcherBands: Record<string, { predictions: number; correctTopOne: number }> = {};
  let coveredCount = 0;
  let topOneCorrectCount = 0;
  let topThreeCorrectCount = 0;

  for (const target of samples) {
    const availableHistory = historyForTarget(samples, target, mode);
    const ranked = rankHistorySuggestions(factsFromBooking(target), availableHistory, {
      algorithmVersion,
      limit: 3,
    });
    const rankOne = ranked[0];
    if (!rankOne) continue;

    coveredCount += 1;
    const topOneCorrect = sameTriple(rankOne, target);
    const topThreeCorrect = ranked.some((candidate) => sameTriple(candidate, target));
    if (topOneCorrect) topOneCorrectCount += 1;
    if (topThreeCorrect) topThreeCorrectCount += 1;
    addBand(confidenceBands, rankOne.confidence, topOneCorrect);
    addBand(matcherBands, rankOne.matcher, topOneCorrect);
  }

  return {
    algorithmVersion,
    mode,
    sampleCount: samples.length,
    coveredCount,
    uncoveredCount: samples.length - coveredCount,
    coverageBasisPoints: accuracyBasisPoints(coveredCount, samples.length),
    topOneCorrectCount,
    topOneAccuracyBasisPoints: accuracyBasisPoints(topOneCorrectCount, coveredCount),
    topThreeCorrectCount,
    topThreeAccuracyBasisPoints: accuracyBasisPoints(topThreeCorrectCount, coveredCount),
    confidenceCalibration: finalizeBands(confidenceBands),
    matcherBreakdown: finalizeBands(matcherBands),
    safeguards: {
      futureEvidenceExcluded: true,
      createsCategorizationSuggestion: false,
      createsTransactionBooking: false,
      mutatesBankFacts: false,
    },
  };
};




type HistoryEvaluationDb = Pick<PrismaClient, 'transaction'>;

export const evaluateHistorySuggestionsForUser = async (
  db: HistoryEvaluationDb,
  input: {
    userId: string;
    mode?: HistoryEvaluationMode;
    algorithmVersion?: string;
  },
): Promise<HistorySuggestionEvaluationResult> => {
  const records = await db.transaction.findMany({
    where: {
      userId: input.userId,
      transactionBooking: { isNot: null },
    },
    orderBy: [{ date: 'asc' }, { id: 'asc' }],
    select: {
      id: true,
      date: true,
      accountId: true,
      direction: true,
      amountMinor: true,
      counterparty: true,
      reference: true,
      description: true,
      rawRow: true,
      transactionBooking: {
        select: {
          id: true,
          projectId: true,
          transactionTypeId: true,
          categoryId: true,
          evidenceHash: true,
        },
      },
    },
  });

  const approvedBookings: ApprovedHistoryBooking[] = [];
  for (const record of records) {
    if (!record.transactionBooking) continue;
    approvedBookings.push({
      ...toHistorySuggestionFacts(record),
      bookingId: record.transactionBooking.id,
      projectId: record.transactionBooking.projectId,
      transactionTypeId: record.transactionBooking.transactionTypeId,
      categoryId: record.transactionBooking.categoryId,
      bookingEvidenceHash: record.transactionBooking.evidenceHash,
    });
  }

  return evaluateHistorySuggestions(approvedBookings, {
    mode: input.mode,
    algorithmVersion: input.algorithmVersion,
  });
};
