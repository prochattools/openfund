import crypto from 'node:crypto';

export type DeterministicCategorizationStatus =
  | 'finalized'
  | 'review_suggested'
  | 'unmatched'
  | 'conflict';

export type DeterministicCategorizationSource =
  | 'rule'
  | 'historical_replay'
  | 'rule_and_historical_replay';

export type DeterministicConfidence = 'deterministic' | 'exact';

export type NonDeterministicConfidence = 'fuzzy' | 'overall' | 'default' | 'partial' | 'unknown';

export type DimensionTriple = {
  projectId: string | null;
  transactionTypeId: string | null;
  categoryId: string | null;
};

export type DeterministicTransactionFacts = {
  transactionId?: string | null;
  importFingerprint?: string | null;
  exactReplayKey?: string | null;
};

export type DeterministicRuleCandidate = DimensionTriple & {
  ruleId: string;
  active: boolean;
  approved: boolean;
  confidence?: DeterministicConfidence | NonDeterministicConfidence;
  evidenceHash?: string | null;
};

export type DeterministicHistoricalReplayCandidate = DimensionTriple & {
  historicalRecordId: string;
  evidenceHash: string;
  exactReplayKey?: string | null;
  importFingerprint?: string | null;
  confidence: DeterministicConfidence | NonDeterministicConfidence;
};

export type DeterministicCategorizationInput = {
  transaction: DeterministicTransactionFacts;
  ruleCandidates?: DeterministicRuleCandidate[];
  historicalReplayCandidates?: DeterministicHistoricalReplayCandidate[];
};

export type DeterministicCategorizationSuggestion = DimensionTriple & {
  source: 'rule' | 'historical_replay';
  ruleIds: string[];
  historicalRecordIds: string[];
  evidenceHashes: string[];
  reason: string;
};

export type DeterministicCategorizationEvidence = {
  matchedRuleIds: string[];
  historicalRecordIds: string[];
  historicalEvidenceHashes: string[];
  ruleEvidenceHashes: string[];
  matchedImportFingerprint: string | null;
  matchedExactReplayKey: string | null;
  reason: string;
};

export type DeterministicCategorizationResult = {
  status: DeterministicCategorizationStatus;
  source: DeterministicCategorizationSource | null;
  projectId: string | null;
  transactionTypeId: string | null;
  categoryId: string | null;
  evidence: DeterministicCategorizationEvidence;
  evidenceHash: string;
  suggestions: DeterministicCategorizationSuggestion[];
  sideEffects: {
    createsTransactionBooking: false;
    closesPeriod: false;
  };
};

type CompleteTriple = {
  projectId: string;
  transactionTypeId: string;
  categoryId: string;
};

type SafeRuleMatch = {
  triple: CompleteTriple;
  candidates: DeterministicRuleCandidate[];
};

type SafeHistoricalMatch = {
  triple: CompleteTriple;
  candidates: DeterministicHistoricalReplayCandidate[];
};

const isCompleteTriple = <T extends DimensionTriple>(candidate: T): candidate is T & CompleteTriple =>
  Boolean(candidate.projectId && candidate.transactionTypeId && candidate.categoryId);

const tripleKey = (candidate: DimensionTriple): string =>
  [candidate.projectId ?? '', candidate.transactionTypeId ?? '', candidate.categoryId ?? ''].join('|');

const sameTriple = (left: DimensionTriple, right: DimensionTriple): boolean =>
  tripleKey(left) === tripleKey(right);

const isDeterministicConfidence = (confidence: DeterministicConfidence | NonDeterministicConfidence | undefined): boolean =>
  confidence === undefined || confidence === 'deterministic' || confidence === 'exact';

const stableValue = (value: unknown): unknown => {
  if (value === undefined) return null;
  if (value === null) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'bigint') return value.toString();
  if (Array.isArray(value)) return value.map(stableValue);
  if (typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, entryValue]) => entryValue !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entryValue]) => [key, stableValue(entryValue)]),
    );
  }
  return value;
};

const hashEvidence = (value: unknown): string =>
  crypto.createHash('sha256').update(JSON.stringify(stableValue(value))).digest('hex');

const baseEvidence = (
  transaction: DeterministicTransactionFacts,
  reason: string,
  ruleCandidates: DeterministicRuleCandidate[],
  historicalCandidates: DeterministicHistoricalReplayCandidate[],
): DeterministicCategorizationEvidence => ({
  matchedRuleIds: ruleCandidates.map((rule) => rule.ruleId).sort(),
  historicalRecordIds: historicalCandidates.map((candidate) => candidate.historicalRecordId).sort(),
  historicalEvidenceHashes: historicalCandidates.map((candidate) => candidate.evidenceHash).sort(),
  ruleEvidenceHashes: ruleCandidates
    .map((rule) => rule.evidenceHash)
    .filter((value): value is string => Boolean(value))
    .sort(),
  matchedImportFingerprint: transaction.importFingerprint ?? historicalCandidates.find((candidate) => candidate.importFingerprint)?.importFingerprint ?? null,
  matchedExactReplayKey: transaction.exactReplayKey ?? historicalCandidates.find((candidate) => candidate.exactReplayKey)?.exactReplayKey ?? null,
  reason,
});

const result = (
  input: {
    status: DeterministicCategorizationStatus;
    source: DeterministicCategorizationSource | null;
    triple?: DimensionTriple | null;
    evidence: DeterministicCategorizationEvidence;
    suggestions?: DeterministicCategorizationSuggestion[];
  },
): DeterministicCategorizationResult => {
  const payloadForHash = {
    evidence: input.evidence,
    source: input.source,
    status: input.status,
    triple: input.triple ?? null,
  };
  return {
    status: input.status,
    source: input.source,
    projectId: input.triple?.projectId ?? null,
    transactionTypeId: input.triple?.transactionTypeId ?? null,
    categoryId: input.triple?.categoryId ?? null,
    evidence: input.evidence,
    evidenceHash: hashEvidence(payloadForHash),
    suggestions: input.suggestions ?? [],
    sideEffects: {
      createsTransactionBooking: false,
      closesPeriod: false,
    },
  };
};

const buildRuleSuggestion = (rule: DeterministicRuleCandidate, reason: string): DeterministicCategorizationSuggestion => ({
  source: 'rule',
  projectId: rule.projectId,
  transactionTypeId: rule.transactionTypeId,
  categoryId: rule.categoryId,
  ruleIds: [rule.ruleId],
  historicalRecordIds: [],
  evidenceHashes: rule.evidenceHash ? [rule.evidenceHash] : [],
  reason,
});

const buildHistoricalSuggestion = (
  candidate: DeterministicHistoricalReplayCandidate,
  reason: string,
): DeterministicCategorizationSuggestion => ({
  source: 'historical_replay',
  projectId: candidate.projectId,
  transactionTypeId: candidate.transactionTypeId,
  categoryId: candidate.categoryId,
  ruleIds: [],
  historicalRecordIds: [candidate.historicalRecordId],
  evidenceHashes: [candidate.evidenceHash],
  reason,
});

const evaluateRuleMatches = (rules: DeterministicRuleCandidate[]): {
  safe: SafeRuleMatch | null;
  suggestions: DeterministicCategorizationSuggestion[];
  reason: string | null;
} => {
  const activeApproved = rules.filter((rule) => rule.active && rule.approved && isDeterministicConfidence(rule.confidence));
  const suggestions = [
    ...rules
      .filter((rule) => rule.active && rule.approved && !isDeterministicConfidence(rule.confidence))
      .map((rule) => buildRuleSuggestion(rule, 'Rule confidence is not deterministic.')),
    ...activeApproved
      .filter((rule) => !isCompleteTriple(rule))
      .map((rule) => buildRuleSuggestion(rule, 'Rule match is missing project, type, or category.')),
  ];

  const complete = activeApproved.filter(isCompleteTriple);
  if (!complete.length) {
    return {
      safe: null,
      suggestions,
      reason: activeApproved.length || suggestions.length ? 'No complete deterministic rule match.' : null,
    };
  }
  if (complete.length > 1) {
    return {
      safe: null,
      suggestions: complete.map((rule) => buildRuleSuggestion(rule, 'Multiple matching rules require review.')),
      reason: 'Multiple matching rules require review.',
    };
  }
  return {
    safe: {
      triple: {
        projectId: complete[0].projectId,
        transactionTypeId: complete[0].transactionTypeId,
        categoryId: complete[0].categoryId,
      },
      candidates: complete,
    },
    suggestions,
    reason: null,
  };
};

const evaluateHistoricalMatches = (candidates: DeterministicHistoricalReplayCandidate[]): {
  safe: SafeHistoricalMatch | null;
  suggestions: DeterministicCategorizationSuggestion[];
  reason: string | null;
} => {
  const deterministic = candidates.filter((candidate) => isDeterministicConfidence(candidate.confidence));
  const suggestions = [
    ...candidates
      .filter((candidate) => !isDeterministicConfidence(candidate.confidence))
      .map((candidate) => buildHistoricalSuggestion(candidate, 'Historical replay confidence is not exact.')),
    ...deterministic
      .filter((candidate) => !isCompleteTriple(candidate))
      .map((candidate) => buildHistoricalSuggestion(candidate, 'Historical replay is missing project, type, or category.')),
  ];
  const complete = deterministic.filter(isCompleteTriple);
  if (!complete.length) {
    return {
      safe: null,
      suggestions,
      reason: deterministic.length || suggestions.length ? 'No complete exact historical replay match.' : null,
    };
  }

  const uniqueTriples = new Map<string, DeterministicHistoricalReplayCandidate[]>();
  for (const candidate of complete) {
    const key = tripleKey(candidate);
    uniqueTriples.set(key, [...(uniqueTriples.get(key) ?? []), candidate]);
  }

  if (uniqueTriples.size > 1) {
    return {
      safe: null,
      suggestions: complete.map((candidate) => buildHistoricalSuggestion(
        candidate,
        'Multiple historical replay dimension triples require review.',
      )),
      reason: 'Multiple historical replay dimension triples require review.',
    };
  }

  const grouped = [...uniqueTriples.values()][0]!;
  return {
    safe: {
      triple: {
        projectId: grouped[0].projectId,
        transactionTypeId: grouped[0].transactionTypeId,
        categoryId: grouped[0].categoryId,
      },
      candidates: grouped,
    },
    suggestions,
    reason: null,
  };
};

export const decideDeterministicCategorization = (
  input: DeterministicCategorizationInput,
): DeterministicCategorizationResult => {
  const ruleCandidates = input.ruleCandidates ?? [];
  const historicalCandidates = input.historicalReplayCandidates ?? [];
  const ruleEvaluation = evaluateRuleMatches(ruleCandidates);
  const historicalEvaluation = evaluateHistoricalMatches(historicalCandidates);
  const suggestions = [...ruleEvaluation.suggestions, ...historicalEvaluation.suggestions];

  if (suggestions.length) {
    return result({
      status: 'review_suggested',
      source: null,
      evidence: baseEvidence(
        input.transaction,
        ruleEvaluation.reason
          ?? historicalEvaluation.reason
          ?? 'Categorization has incomplete, ambiguous, or non-deterministic evidence and requires review.',
        ruleCandidates.filter((rule) => rule.active && rule.approved),
        historicalCandidates,
      ),
      suggestions,
    });
  }

  if (ruleEvaluation.safe && historicalEvaluation.safe) {
    if (!sameTriple(ruleEvaluation.safe.triple, historicalEvaluation.safe.triple)) {
      return result({
        status: 'conflict',
        source: null,
        evidence: baseEvidence(
          input.transaction,
          'Rule and historical replay disagree.',
          ruleEvaluation.safe.candidates,
          historicalEvaluation.safe.candidates,
        ),
        suggestions: [
          ...ruleEvaluation.safe.candidates.map((rule) => buildRuleSuggestion(rule, 'Rule conflicts with historical replay.')),
          ...historicalEvaluation.safe.candidates.map((candidate) => buildHistoricalSuggestion(
            candidate,
            'Historical replay conflicts with rule.',
          )),
        ],
      });
    }

    return result({
      status: 'finalized',
      source: 'rule_and_historical_replay',
      triple: ruleEvaluation.safe.triple,
      evidence: baseEvidence(
        input.transaction,
        'Approved rule and exact historical replay agree.',
        ruleEvaluation.safe.candidates,
        historicalEvaluation.safe.candidates,
      ),
    });
  }

  if (ruleEvaluation.safe) {
    return result({
      status: 'finalized',
      source: 'rule',
      triple: ruleEvaluation.safe.triple,
      evidence: baseEvidence(
        input.transaction,
        'One approved complete deterministic rule matched.',
        ruleEvaluation.safe.candidates,
        [],
      ),
      suggestions,
    });
  }

  if (historicalEvaluation.safe) {
    return result({
      status: 'finalized',
      source: 'historical_replay',
      triple: historicalEvaluation.safe.triple,
      evidence: baseEvidence(
        input.transaction,
        'One complete exact historical replay matched.',
        [],
        historicalEvaluation.safe.candidates,
      ),
      suggestions,
    });
  }

  if (suggestions.length || ruleEvaluation.reason || historicalEvaluation.reason) {
    return result({
      status: 'review_suggested',
      source: null,
      evidence: baseEvidence(
        input.transaction,
        ruleEvaluation.reason ?? historicalEvaluation.reason ?? 'Categorization requires review.',
        ruleCandidates.filter((rule) => rule.active && rule.approved),
        historicalCandidates,
      ),
      suggestions,
    });
  }

  return result({
    status: 'unmatched',
    source: null,
    evidence: baseEvidence(input.transaction, 'No deterministic categorization evidence matched.', [], []),
  });
};
