import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  INFERENCE_MAX_CANDIDATE_DISPLAY_LABEL_LENGTH,
  INFERENCE_MAX_CANDIDATE_ID_LENGTH,
  INFERENCE_MAX_CANDIDATES_PER_DIMENSION,
  INFERENCE_MAX_TOTAL_CANDIDATES,
  INFERENCE_REQUEST_MAX_BYTES,
  INFERENCE_RESPONSE_MAX_BYTES,
  ProviderClassificationRequestSchema,
  ProviderDeclaredAbstentionReasonSchema,
  RawProviderClassificationResponseSchema,
  parseProviderResponseText,
  type ProviderClassificationRequest,
  type ProviderDeclaredAbstentionReason,
} from '../../server/services/inferenceContractService';

const projectCandidate = {
  candidateId: 'project-synthetic-alpha',
  rank: 1,
  displayLabel: 'Synthetic Project Alpha',
  supportingEvidenceCount: 4,
  conflictingEvidenceCount: 0,
};

const transactionTypeCandidate = {
  candidateId: 'type-synthetic-income',
  rank: 1,
  displayLabel: 'Synthetic Income Type',
  transactionTypeDirection: 'credit' as const,
  supportingEvidenceCount: 3,
  conflictingEvidenceCount: 1,
};

const categoryCandidate = {
  candidateId: 'category-synthetic-general',
  rank: 1,
  displayLabel: 'Synthetic General Category',
};

const validRequest: ProviderClassificationRequest = {
  direction: 'credit',
  candidates: {
    projects: [projectCandidate],
    transactionTypes: [transactionTypeCandidate],
    categories: [categoryCandidate],
  },
};

const validProposedResponse = {
  outcome: 'PROPOSED' as const,
  projectId: projectCandidate.candidateId,
  transactionTypeId: transactionTypeCandidate.candidateId,
  categoryId: categoryCandidate.candidateId,
};

const providerDeclaredReasons: ProviderDeclaredAbstentionReason[] = [
  'INSUFFICIENT_CONTEXT',
  'AMBIGUOUS_EVIDENCE',
  'CONFLICTING_EVIDENCE',
  'MISSING_VALID_CANDIDATES',
];

const internalOnlyReasons = [
  'PROVIDER_DISABLED',
  'PROVIDER_UNAVAILABLE',
  'MALFORMED_PROVIDER_OUTPUT',
  'INVALID_CANDIDATE_SELECTION',
  'STALE_CANDIDATE_SET',
] as const;

describe('Program Phase 5.2 provider-neutral inference contracts', () => {
  describe('provider-bound request contract', () => {
    it('accepts a valid request with direction and grouped candidates', () => {
      expect(ProviderClassificationRequestSchema.safeParse(validRequest).success).toBe(true);
    });

    it('accepts a request without amount and currency', () => {
      const result = ProviderClassificationRequestSchema.safeParse(validRequest);
      expect(result.success).toBe(true);
    });

    it('accepts a request with both amountMinor and currency', () => {
      const result = ProviderClassificationRequestSchema.safeParse({
        ...validRequest,
        amountMinor: '-12500',
        currency: 'EUR',
      });
      expect(result.success).toBe(true);
    });

    it('rejects amountMinor without currency', () => {
      const result = ProviderClassificationRequestSchema.safeParse({
        ...validRequest,
        amountMinor: '12500',
      });
      expect(result.success).toBe(false);
    });

    it('rejects currency without amountMinor', () => {
      const result = ProviderClassificationRequestSchema.safeParse({
        ...validRequest,
        currency: 'EUR',
      });
      expect(result.success).toBe(false);
    });

    it('rejects a numeric amountMinor', () => {
      const result = ProviderClassificationRequestSchema.safeParse({
        ...validRequest,
        amountMinor: 12500,
        currency: 'EUR',
      });
      expect(result.success).toBe(false);
    });

    it('rejects a floating-point amount string', () => {
      const result = ProviderClassificationRequestSchema.safeParse({
        ...validRequest,
        amountMinor: '125.50',
        currency: 'EUR',
      });
      expect(result.success).toBe(false);
    });

    it('rejects uppercase direction', () => {
      const result = ProviderClassificationRequestSchema.safeParse({
        ...validRequest,
        direction: 'CREDIT',
      });
      expect(result.success).toBe(false);
    });

    it('rejects unknown request fields', () => {
      const result = ProviderClassificationRequestSchema.safeParse({
        ...validRequest,
        unexpectedField: 'synthetic',
      });
      expect(result.success).toBe(false);
    });

    it('rejects a candidate label above the approved bound', () => {
      const result = ProviderClassificationRequestSchema.safeParse({
        ...validRequest,
        candidates: {
          ...validRequest.candidates,
          projects: [{ ...projectCandidate, displayLabel: 'L'.repeat(INFERENCE_MAX_CANDIDATE_DISPLAY_LABEL_LENGTH + 1) }],
        },
      });
      expect(result.success).toBe(false);
    });

    it('rejects a candidate ID above the approved bound', () => {
      const result = ProviderClassificationRequestSchema.safeParse({
        ...validRequest,
        candidates: {
          ...validRequest.candidates,
          projects: [{ ...projectCandidate, candidateId: 'p'.repeat(INFERENCE_MAX_CANDIDATE_ID_LENGTH + 1) }],
        },
      });
      expect(result.success).toBe(false);
    });

    it('rejects rank below one', () => {
      const result = ProviderClassificationRequestSchema.safeParse({
        ...validRequest,
        candidates: {
          ...validRequest.candidates,
          projects: [{ ...projectCandidate, rank: 0 }],
        },
      });
      expect(result.success).toBe(false);
    });

    it('rejects rank above ten', () => {
      const result = ProviderClassificationRequestSchema.safeParse({
        ...validRequest,
        candidates: {
          ...validRequest.candidates,
          projects: [{ ...projectCandidate, rank: INFERENCE_MAX_CANDIDATES_PER_DIMENSION + 1 }],
        },
      });
      expect(result.success).toBe(false);
    });

    it('rejects fractional rank', () => {
      const result = ProviderClassificationRequestSchema.safeParse({
        ...validRequest,
        candidates: {
          ...validRequest.candidates,
          projects: [{ ...projectCandidate, rank: 1.5 }],
        },
      });
      expect(result.success).toBe(false);
    });

    it('rejects negative evidence counts', () => {
      const result = ProviderClassificationRequestSchema.safeParse({
        ...validRequest,
        candidates: {
          ...validRequest.candidates,
          projects: [{ ...projectCandidate, supportingEvidenceCount: -1 }],
        },
      });
      expect(result.success).toBe(false);
    });

    it('rejects fractional evidence counts', () => {
      const result = ProviderClassificationRequestSchema.safeParse({
        ...validRequest,
        candidates: {
          ...validRequest.candidates,
          projects: [{ ...projectCandidate, conflictingEvidenceCount: 0.5 }],
        },
      });
      expect(result.success).toBe(false);
    });

    it('rejects invalid transaction-type direction', () => {
      const result = ProviderClassificationRequestSchema.safeParse({
        ...validRequest,
        candidates: {
          ...validRequest.candidates,
          transactionTypes: [{ ...transactionTypeCandidate, transactionTypeDirection: 'both' }],
        },
      });
      expect(result.success).toBe(false);
    });

    it('rejects more than ten candidates in one dimension', () => {
      const projects = Array.from(
        { length: INFERENCE_MAX_CANDIDATES_PER_DIMENSION + 1 },
        (_, index) => ({ ...projectCandidate, candidateId: `project-synthetic-${index}`, rank: Math.min(index + 1, 10) }),
      );
      const result = ProviderClassificationRequestSchema.safeParse({
        ...validRequest,
        candidates: { ...validRequest.candidates, projects },
      });
      expect(result.success).toBe(false);
    });

    it('enforces the total candidate descriptor bound', () => {
      const makeCandidates = (prefix: string, count: number) => Array.from(
        { length: count },
        (_, index) => ({
          ...projectCandidate,
          candidateId: `${prefix}-${index}`,
          rank: index + 1,
        }),
      );
      const result = ProviderClassificationRequestSchema.safeParse({
        ...validRequest,
        candidates: {
          projects: makeCandidates('project', 10),
          transactionTypes: makeCandidates('type', 10),
          categories: makeCandidates('category', 11),
        },
      });
      expect(INFERENCE_MAX_TOTAL_CANDIDATES).toBe(30);
      expect(result.success).toBe(false);
    });

    it('rejects a serialized request above the byte limit', () => {
      const result = ProviderClassificationRequestSchema.safeParse({
        ...validRequest,
        amountMinor: '1'.repeat(INFERENCE_REQUEST_MAX_BYTES),
        currency: 'EUR',
      });
      expect(result.success).toBe(false);
    });

    it.each([
      ['workspaceId', 'workspace-synthetic'],
      ['targetTransactionId', 'transaction-synthetic'],
      ['transactionFactHash', 'fact-hash-synthetic'],
      ['candidateSetHash', 'candidate-hash-synthetic'],
      ['contractVersion', 'contract-synthetic-v1'],
    ])('rejects internal-envelope field %s', (field, value) => {
      const result = ProviderClassificationRequestSchema.safeParse({
        ...validRequest,
        [field]: value,
      });
      expect(result.success).toBe(false);
    });
  });

  describe('raw provider response contract', () => {
    it('accepts a valid complete PROPOSED response', () => {
      expect(RawProviderClassificationResponseSchema.safeParse(validProposedResponse).success).toBe(true);
    });

    it.each(providerDeclaredReasons)('accepts ABSTAINED reason %s', (abstentionReason) => {
      expect(RawProviderClassificationResponseSchema.safeParse({
        outcome: 'ABSTAINED',
        abstentionReason,
      }).success).toBe(true);
    });

    it.each(['projectId', 'transactionTypeId', 'categoryId'])('rejects PROPOSED without %s', (field) => {
      const candidate = { ...validProposedResponse } as Record<string, unknown>;
      delete candidate[field];
      expect(RawProviderClassificationResponseSchema.safeParse(candidate).success).toBe(false);
    });

    it.each(['projectId', 'transactionTypeId', 'categoryId'])('rejects ABSTAINED containing %s', (field) => {
      expect(RawProviderClassificationResponseSchema.safeParse({
        outcome: 'ABSTAINED',
        abstentionReason: 'INSUFFICIENT_CONTEXT',
        [field]: 'synthetic-id',
      }).success).toBe(false);
    });

    it('rejects unknown response fields', () => {
      expect(RawProviderClassificationResponseSchema.safeParse({
        ...validProposedResponse,
        unexpectedField: true,
      }).success).toBe(false);
    });

    it('rejects response IDs above the approved bound', () => {
      expect(RawProviderClassificationResponseSchema.safeParse({
        ...validProposedResponse,
        projectId: 'p'.repeat(INFERENCE_MAX_CANDIDATE_ID_LENGTH + 1),
      }).success).toBe(false);
    });

    it('rejects invalid outcomes', () => {
      expect(RawProviderClassificationResponseSchema.safeParse({
        outcome: 'UNKNOWN',
      }).success).toBe(false);
    });

    it.each(internalOnlyReasons)('rejects internal-only abstention reason %s', (abstentionReason) => {
      expect(ProviderDeclaredAbstentionReasonSchema.safeParse(abstentionReason).success).toBe(false);
      expect(RawProviderClassificationResponseSchema.safeParse({
        outcome: 'ABSTAINED',
        abstentionReason,
      }).success).toBe(false);
    });

    it.each(['contractVersion', 'candidateSetHash', 'confidence', 'rationale'])('rejects prohibited response field %s', (field) => {
      expect(RawProviderClassificationResponseSchema.safeParse({
        ...validProposedResponse,
        [field]: 'synthetic-value',
      }).success).toBe(false);
    });
  });

  describe('non-throwing provider response parser', () => {
    it('returns ok for valid proposed text', () => {
      expect(parseProviderResponseText(JSON.stringify(validProposedResponse))).toEqual({
        ok: true,
        value: validProposedResponse,
      });
    });

    it('returns ok for valid abstained text', () => {
      const response = {
        outcome: 'ABSTAINED' as const,
        abstentionReason: 'AMBIGUOUS_EVIDENCE' as const,
      };
      expect(parseProviderResponseText(JSON.stringify(response))).toEqual({ ok: true, value: response });
    });

    it('returns malformed for invalid JSON', () => {
      expect(parseProviderResponseText('{')).toEqual({
        ok: false,
        reason: 'MALFORMED_PROVIDER_OUTPUT',
      });
    });

    it('returns malformed for structurally invalid JSON', () => {
      expect(parseProviderResponseText(JSON.stringify({ outcome: 'PROPOSED' }))).toEqual({
        ok: false,
        reason: 'MALFORMED_PROVIDER_OUTPUT',
      });
    });

    it('returns malformed for unknown fields', () => {
      expect(parseProviderResponseText(JSON.stringify({
        ...validProposedResponse,
        extra: 'synthetic',
      }))).toEqual({
        ok: false,
        reason: 'MALFORMED_PROVIDER_OUTPUT',
      });
    });

    it('returns malformed before parsing text above the byte limit', () => {
      const oversized = JSON.stringify({
        ...validProposedResponse,
        extra: 'x'.repeat(INFERENCE_RESPONSE_MAX_BYTES),
      });
      expect(Buffer.byteLength(oversized, 'utf8')).toBeGreaterThan(INFERENCE_RESPONSE_MAX_BYTES);
      expect(parseProviderResponseText(oversized)).toEqual({
        ok: false,
        reason: 'MALFORMED_PROVIDER_OUTPUT',
      });
    });

    it('never throws for malformed provider text', () => {
      expect(() => parseProviderResponseText('not-json')).not.toThrow();
    });

    it('returns exactly MALFORMED_PROVIDER_OUTPUT on parser failure', () => {
      const result = parseProviderResponseText('[]');
      expect(result).toEqual({ ok: false, reason: 'MALFORMED_PROVIDER_OUTPUT' });
    });
  });

  describe('structural safety', () => {
    it('contains no provider, database, environment, network, or runtime integration hooks', () => {
      const source = fs.readFileSync(
        path.join(process.cwd(), 'server/services/inferenceContractService.ts'),
        'utf8',
      );
      const forbiddenFragments = [
        ['process', 'env'].join('.'),
        ['@aws', 'sdk'].join('-'),
        ['aws', 'sdk'].join('-'),
        ['pr', 'isma'].join(''),
        ['fetch', '('].join(''),
        ['axios'].join(''),
        ['bedrock', 'InferenceAdapter'].join(''),
        ['deterministic', 'DecisionOrchestrationService'].join(''),
      ];
      for (const fragment of forbiddenFragments) {
        expect(source.toLowerCase()).not.toContain(fragment.toLowerCase());
      }
    });

    it('is not imported by any existing runtime module', () => {
      const projectRoot = process.cwd();
      const roots = ['server', 'src', 'lib', 'app', 'pages'];
      const serviceBasename = 'inferenceContractService';

      for (const root of roots) {
        const rootPath = path.join(projectRoot, root);
        if (!fs.existsSync(rootPath)) continue;
        for (const file of collectTsFiles(rootPath)) {
          if (file.endsWith('server/services/inferenceContractService.ts')) continue;
          const content = fs.readFileSync(file, 'utf8');
          const runtimeContent = content.replace(
            /import\s+type\s+(?:\{[\s\S]*?\}|[A-Za-z_$][\w$]*)\s+from\s+['"][^'"]+['"]\s*;?/g,
            '',
          );
          expect(runtimeContent, `${file} must not import ${serviceBasename} at runtime`).not.toContain(
            serviceBasename,
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
