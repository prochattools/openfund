import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  validateProviderClassificationResponse,
  type TrustedInferenceInvocationEnvelope,
} from '../../server/services/inferenceCandidateValidationService';
import type { RawProviderClassificationResponse } from '../../server/services/inferenceContractService';
import type {
  RestrictedCandidateDimension,
  RestrictedRetrievalCandidate,
  RestrictedRetrievalCandidateResult,
} from '../../server/services/restrictedRetrievalCandidateService';

const workspaceId = 'workspace-synthetic';
const targetTransactionId = 'transaction-synthetic';
const candidateSetHash = 'candidate-set-hash-synthetic';

const buildCandidate = (
  dimension: RestrictedCandidateDimension,
  candidateId: string,
  overrides: Record<string, unknown> = {},
): RestrictedRetrievalCandidate =>
  ({
    candidateVersion: 'restricted-retrieval-candidates-v1',
    dimension,
    candidateId,
    rank: 1,
    active: true,
    directionCompatible: true,
    reasonCodes: ['ACTIVE_WORKSPACE_MATCH', 'DIRECTION_COMPATIBLE'],
    supportingEvidenceCount: 2,
    conflictingEvidenceCount: 0,
    retrievalHash: `retrieval-${candidateId}`,
    evidenceHash: `evidence-${candidateId}`,
    provenanceHashes: [`provenance-${candidateId}`],
    candidateHash: `candidate-${candidateId}`,
    ...overrides,
  }) as unknown as RestrictedRetrievalCandidate;

const buildCandidateSet = (
  overrides: Partial<RestrictedRetrievalCandidateResult> = {},
): RestrictedRetrievalCandidateResult =>
  ({
    candidateVersion: 'restricted-retrieval-candidates-v1',
    evidenceVersion: 'deterministic-retrieval-evidence-v1',
    scorerVersion: 'deterministic-history-retrieval-v1',
    eligibilityVersion: 'confirmed-history-eligibility-v1',
    workspaceId,
    targetTransactionId,
    status: 'MATCHED',
    abstentionReason: null,
    bounds: {
      maximumProjectCandidates: 5,
      maximumTransactionTypeCandidates: 5,
      maximumCategoryCandidates: 5,
      maximumEvidenceAlternativesPerDimension: 10,
    },
    projectCandidates: [buildCandidate('PROJECT', 'project-alpha')],
    transactionTypeCandidates: [buildCandidate('TRANSACTION_TYPE', 'type-alpha')],
    categoryCandidates: [buildCandidate('CATEGORY', 'category-alpha')],
    diagnostics: [],
    candidateSetHash,
    sideEffects: {
      readOnly: true,
      previewOnly: true,
      createsTransactionBooking: false,
      createsCategorizationSuggestion: false,
      mutatesBankFacts: false,
      mutatesReviewDecisions: false,
      mutatesPeriodState: false,
      mutatesLedgerRecords: false,
    },
    ...overrides,
  }) as unknown as RestrictedRetrievalCandidateResult;

const buildEnvelope = (
  overrides: Partial<TrustedInferenceInvocationEnvelope> = {},
): TrustedInferenceInvocationEnvelope => ({
  contractVersion: 'inference-contract-v1',
  workspaceId,
  targetTransactionId,
  transactionFactHash: 'transaction-fact-hash-synthetic',
  candidateSetHash,
  ...overrides,
});

const proposal: RawProviderClassificationResponse = {
  outcome: 'PROPOSED',
  projectId: 'project-alpha',
  transactionTypeId: 'type-alpha',
  categoryId: 'category-alpha',
};

const providerAbstention: RawProviderClassificationResponse = {
  outcome: 'ABSTAINED',
  abstentionReason: 'AMBIGUOUS_EVIDENCE',
};

const validate = (
  response: RawProviderClassificationResponse = proposal,
  candidateSet: RestrictedRetrievalCandidateResult = buildCandidateSet(),
  envelope: TrustedInferenceInvocationEnvelope = buildEnvelope(),
) => validateProviderClassificationResponse({ envelope, candidateSet, response });

describe('Program Phase 5.3 inference candidate semantic validation', () => {
  describe('accepted results', () => {
    it('accepts a valid complete proposal', () => {
      expect(validate()).toEqual({ ok: true, value: proposal });
    });

    it('passes a valid provider-declared abstention through unchanged', () => {
      const candidateSet = buildCandidateSet({
        status: 'ABSTAINED',
        abstentionReason: 'INSUFFICIENT_EVIDENCE',
      });

      const result = validate(providerAbstention, candidateSet);
      expect(result).toEqual({ ok: true, value: providerAbstention });
    });

    it('is deterministic for repeated identical validation', () => {
      const candidateSet = buildCandidateSet();
      const envelope = buildEnvelope();

      expect(validate(proposal, candidateSet, envelope)).toEqual(
        validate(proposal, candidateSet, envelope),
      );
    });

    it('does not mutate the envelope, candidate set, or response', () => {
      const candidateSet = buildCandidateSet();
      const envelope = buildEnvelope();
      const response = { ...proposal };
      const before = JSON.stringify({ candidateSet, envelope, response });

      validate(response, candidateSet, envelope);

      expect(JSON.stringify({ candidateSet, envelope, response })).toBe(before);
    });
  });

  describe('stale trusted context', () => {
    it('rejects a candidate-set hash mismatch', () => {
      expect(validate(proposal, buildCandidateSet(), buildEnvelope({ candidateSetHash: 'stale' })))
        .toEqual({
          ok: false,
          abstention: { outcome: 'ABSTAINED', reason: 'STALE_CANDIDATE_SET' },
        });
    });

    it('rejects a workspace mismatch', () => {
      expect(validate(proposal, buildCandidateSet(), buildEnvelope({ workspaceId: 'other' })))
        .toEqual({
          ok: false,
          abstention: { outcome: 'ABSTAINED', reason: 'STALE_CANDIDATE_SET' },
        });
    });

    it('rejects a target transaction mismatch', () => {
      expect(
        validate(
          proposal,
          buildCandidateSet(),
          buildEnvelope({ targetTransactionId: 'other-transaction' }),
        ),
      ).toEqual({
        ok: false,
        abstention: { outcome: 'ABSTAINED', reason: 'STALE_CANDIDATE_SET' },
      });
    });

    it('checks stale context before provider abstention passthrough', () => {
      expect(
        validate(
          providerAbstention,
          buildCandidateSet(),
          buildEnvelope({ candidateSetHash: 'stale' }),
        ),
      ).toEqual({
        ok: false,
        abstention: { outcome: 'ABSTAINED', reason: 'STALE_CANDIDATE_SET' },
      });
    });
  });

  describe('proposal membership', () => {
    it('rejects an unknown project ID', () => {
      expect(validate({ ...proposal, projectId: 'project-unknown' })).toEqual({
        ok: false,
        abstention: { outcome: 'ABSTAINED', reason: 'INVALID_CANDIDATE_SELECTION' },
      });
    });

    it('rejects an unknown transaction-type ID', () => {
      expect(validate({ ...proposal, transactionTypeId: 'type-unknown' })).toEqual({
        ok: false,
        abstention: { outcome: 'ABSTAINED', reason: 'INVALID_CANDIDATE_SELECTION' },
      });
    });

    it('rejects an unknown category ID', () => {
      expect(validate({ ...proposal, categoryId: 'category-unknown' })).toEqual({
        ok: false,
        abstention: { outcome: 'ABSTAINED', reason: 'INVALID_CANDIDATE_SELECTION' },
      });
    });

    it('rejects a project candidate returned as category', () => {
      const candidateSet = buildCandidateSet({
        projectCandidates: [
          buildCandidate('PROJECT', 'project-alpha'),
          buildCandidate('PROJECT', 'project-for-category'),
        ],
      });

      expect(validate({ ...proposal, categoryId: 'project-for-category' }, candidateSet)).toEqual({
        ok: false,
        abstention: { outcome: 'ABSTAINED', reason: 'INVALID_CANDIDATE_SELECTION' },
      });
    });

    it('rejects a category candidate returned as transaction type', () => {
      const candidateSet = buildCandidateSet({
        categoryCandidates: [
          buildCandidate('CATEGORY', 'category-alpha'),
          buildCandidate('CATEGORY', 'category-for-type'),
        ],
      });

      expect(
        validate({ ...proposal, transactionTypeId: 'category-for-type' }, candidateSet),
      ).toEqual({
        ok: false,
        abstention: { outcome: 'ABSTAINED', reason: 'INVALID_CANDIDATE_SELECTION' },
      });
    });

    it('rejects a transaction-type candidate returned as project', () => {
      const candidateSet = buildCandidateSet({
        transactionTypeCandidates: [
          buildCandidate('TRANSACTION_TYPE', 'type-alpha'),
          buildCandidate('TRANSACTION_TYPE', 'type-for-project'),
        ],
      });

      expect(validate({ ...proposal, projectId: 'type-for-project' }, candidateSet)).toEqual({
        ok: false,
        abstention: { outcome: 'ABSTAINED', reason: 'INVALID_CANDIDATE_SELECTION' },
      });
    });

    it('rejects duplicate selected IDs', () => {
      const corrupted = {
        outcome: 'PROPOSED',
        projectId: 'shared-selection',
        transactionTypeId: 'shared-selection',
        categoryId: 'category-alpha',
      } as unknown as RawProviderClassificationResponse;

      expect(validate(corrupted)).toEqual({
        ok: false,
        abstention: { outcome: 'ABSTAINED', reason: 'INVALID_CANDIDATE_SELECTION' },
      });
    });

    it('rejects a candidate ID appearing in more than one trusted dimension', () => {
      const candidateSet = buildCandidateSet({
        projectCandidates: [buildCandidate('PROJECT', 'shared-candidate')],
        categoryCandidates: [
          buildCandidate('CATEGORY', 'category-alpha'),
          buildCandidate('CATEGORY', 'shared-candidate'),
        ],
      });

      expect(validate({ ...proposal, projectId: 'shared-candidate' }, candidateSet)).toEqual({
        ok: false,
        abstention: { outcome: 'ABSTAINED', reason: 'INVALID_CANDIDATE_SELECTION' },
      });
    });

    it('rejects a proposal against an abstained candidate set', () => {
      const candidateSet = buildCandidateSet({
        status: 'ABSTAINED',
        abstentionReason: 'MATERIAL_CONFLICT',
      });

      expect(validate(proposal, candidateSet)).toEqual({
        ok: false,
        abstention: { outcome: 'ABSTAINED', reason: 'INVALID_CANDIDATE_SELECTION' },
      });
    });

    it('rejects a proposal against empty candidate arrays', () => {
      const candidateSet = buildCandidateSet({
        projectCandidates: [],
        transactionTypeCandidates: [],
        categoryCandidates: [],
      });

      expect(validate(proposal, candidateSet)).toEqual({
        ok: false,
        abstention: { outcome: 'ABSTAINED', reason: 'INVALID_CANDIDATE_SELECTION' },
      });
    });
  });

  describe('candidate integrity and defensive validation', () => {
    it('rejects a selected candidate that is not active', () => {
      const candidateSet = buildCandidateSet({
        projectCandidates: [buildCandidate('PROJECT', 'project-alpha', { active: false })],
      });

      expect(validate(proposal, candidateSet)).toEqual({
        ok: false,
        abstention: { outcome: 'ABSTAINED', reason: 'INVALID_CANDIDATE_SELECTION' },
      });
    });

    it('rejects a selected candidate that is not direction compatible', () => {
      const candidateSet = buildCandidateSet({
        transactionTypeCandidates: [
          buildCandidate('TRANSACTION_TYPE', 'type-alpha', { directionCompatible: false }),
        ],
      });

      expect(validate(proposal, candidateSet)).toEqual({
        ok: false,
        abstention: { outcome: 'ABSTAINED', reason: 'INVALID_CANDIDATE_SELECTION' },
      });
    });

    it('rejects a selected candidate with an incorrect dimension', () => {
      const candidateSet = buildCandidateSet({
        projectCandidates: [
          buildCandidate('PROJECT', 'project-alpha', { dimension: 'CATEGORY' }),
        ],
      });

      expect(validate(proposal, candidateSet)).toEqual({
        ok: false,
        abstention: { outcome: 'ABSTAINED', reason: 'INVALID_CANDIDATE_SELECTION' },
      });
    });

    it('rejects an empty proposal ID supplied through a cast', () => {
      const corrupted = {
        ...proposal,
        projectId: '',
      } as unknown as RawProviderClassificationResponse;

      expect(validate(corrupted)).toEqual({
        ok: false,
        abstention: { outcome: 'ABSTAINED', reason: 'INVALID_CANDIDATE_SELECTION' },
      });
    });

    it('rejects a partial proposal supplied through a cast', () => {
      const corrupted = {
        outcome: 'PROPOSED',
        projectId: 'project-alpha',
        transactionTypeId: 'type-alpha',
      } as unknown as RawProviderClassificationResponse;

      expect(validate(corrupted)).toEqual({
        ok: false,
        abstention: { outcome: 'ABSTAINED', reason: 'INVALID_CANDIDATE_SELECTION' },
      });
    });
  });

  describe('structural isolation', () => {
    it('contains no forbidden runtime dependencies or side effects', () => {
      const source = fs.readFileSync(
        path.join(process.cwd(), 'server/services/inferenceCandidateValidationService.ts'),
        'utf8',
      );

      expect(source).not.toContain('process.env');
      expect(source).not.toContain('@aws-sdk');
      expect(source).not.toContain('aws-sdk');
      expect(source).not.toContain('fetch(');
      expect(source).not.toContain('node:fs');
      expect(source).not.toContain('node:http');
      expect(source).not.toContain('node:https');
      expect(source).not.toContain('axios');
      expect(source).not.toMatch(/\bprisma\b/i);
      expect(source).not.toContain('console.');
      expect(source).not.toContain('Orchestration');
      expect(source).not.toContain('/routes/');
    });

    it('is not imported by any existing runtime module', () => {
      const projectRoot = process.cwd();
      const dirsToSearch = ['server', 'src', 'lib'];
      const validatorBasename = 'inferenceCandidateValidationService';

      for (const dir of dirsToSearch) {
        const dirPath = path.join(projectRoot, dir);
        if (!fs.existsSync(dirPath)) continue;
        for (const file of collectTsFiles(dirPath)) {
          if (file.endsWith('inferenceCandidateValidationService.ts')) continue;
          const content = fs.readFileSync(file, 'utf8');
          expect(content, `${file} must not import ${validatorBasename}`).not.toContain(
            validatorBasename,
          );
        }
      }
    });
  });
});

function collectTsFiles(dir: string): string[] {
  const results: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectTsFiles(fullPath));
    } else if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) {
      results.push(fullPath);
    }
  }
  return results;
}
