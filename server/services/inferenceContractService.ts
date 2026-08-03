import { Buffer } from 'node:buffer';
import { z } from 'zod';

export const INFERENCE_REQUEST_MAX_BYTES = 16_384;
export const INFERENCE_RESPONSE_MAX_BYTES = 4_096;
export const INFERENCE_MAX_CANDIDATES_PER_DIMENSION = 10;
export const INFERENCE_MAX_TOTAL_CANDIDATES = 30;
export const INFERENCE_MAX_CANDIDATE_ID_LENGTH = 128;
export const INFERENCE_MAX_CANDIDATE_DISPLAY_LABEL_LENGTH = 128;

export const InferenceTransactionDirectionSchema = z.enum(['credit', 'debit']);
export type InferenceTransactionDirection = z.infer<typeof InferenceTransactionDirectionSchema>;

const boundedIdentifierSchema = z
  .string()
  .min(1)
  .max(INFERENCE_MAX_CANDIDATE_ID_LENGTH);

const evidenceCountSchema = z
  .number()
  .int()
  .nonnegative()
  .refine(Number.isSafeInteger, 'Evidence counts must be safe integers');

const baseCandidateDescriptorShape = {
  candidateId: boundedIdentifierSchema,
  rank: z.number().int().min(1).max(INFERENCE_MAX_CANDIDATES_PER_DIMENSION),
  displayLabel: z
    .string()
    .min(1)
    .max(INFERENCE_MAX_CANDIDATE_DISPLAY_LABEL_LENGTH),
  supportingEvidenceCount: evidenceCountSchema.optional(),
  conflictingEvidenceCount: evidenceCountSchema.optional(),
};

export const ProjectCandidateDescriptorSchema = z
  .object(baseCandidateDescriptorShape)
  .strict();
export type ProjectCandidateDescriptor = z.infer<typeof ProjectCandidateDescriptorSchema>;

export const TransactionTypeCandidateDescriptorSchema = z
  .object({
    ...baseCandidateDescriptorShape,
    transactionTypeDirection: InferenceTransactionDirectionSchema.optional(),
  })
  .strict();
export type TransactionTypeCandidateDescriptor = z.infer<
  typeof TransactionTypeCandidateDescriptorSchema
>;

export const CategoryCandidateDescriptorSchema = z
  .object(baseCandidateDescriptorShape)
  .strict();
export type CategoryCandidateDescriptor = z.infer<typeof CategoryCandidateDescriptorSchema>;

export const InferenceCandidateGroupsSchema = z
  .object({
    projects: z
      .array(ProjectCandidateDescriptorSchema)
      .max(INFERENCE_MAX_CANDIDATES_PER_DIMENSION),
    transactionTypes: z
      .array(TransactionTypeCandidateDescriptorSchema)
      .max(INFERENCE_MAX_CANDIDATES_PER_DIMENSION),
    categories: z
      .array(CategoryCandidateDescriptorSchema)
      .max(INFERENCE_MAX_CANDIDATES_PER_DIMENSION),
  })
  .strict()
  .superRefine((groups, context) => {
    const total =
      groups.projects.length + groups.transactionTypes.length + groups.categories.length;
    if (total > INFERENCE_MAX_TOTAL_CANDIDATES) {
      context.addIssue({
        code: 'custom',
        message: `Candidate descriptors must not exceed ${INFERENCE_MAX_TOTAL_CANDIDATES} total`,
      });
    }
  });
export type InferenceCandidateGroups = z.infer<typeof InferenceCandidateGroupsSchema>;

const amountMinorSchema = z.string().regex(/^-?(?:0|[1-9]\d*)$/);
const currencySchema = z.string().regex(/^[A-Z]{3}$/);

export const ProviderClassificationRequestSchema = z
  .object({
    direction: InferenceTransactionDirectionSchema,
    amountMinor: amountMinorSchema.optional(),
    currency: currencySchema.optional(),
    candidates: InferenceCandidateGroupsSchema,
  })
  .strict()
  .superRefine((request, context) => {
    const hasAmount = request.amountMinor !== undefined;
    const hasCurrency = request.currency !== undefined;
    if (hasAmount !== hasCurrency) {
      context.addIssue({
        code: 'custom',
        message: 'amountMinor and currency must either both be present or both be absent',
      });
    }

    const serializedBytes = Buffer.byteLength(JSON.stringify(request), 'utf8');
    if (serializedBytes > INFERENCE_REQUEST_MAX_BYTES) {
      context.addIssue({
        code: 'custom',
        message: `Serialized request exceeds ${INFERENCE_REQUEST_MAX_BYTES} UTF-8 bytes`,
      });
    }
  });
export type ProviderClassificationRequest = z.infer<typeof ProviderClassificationRequestSchema>;

export const ProviderDeclaredAbstentionReasonSchema = z.enum([
  'INSUFFICIENT_CONTEXT',
  'AMBIGUOUS_EVIDENCE',
  'CONFLICTING_EVIDENCE',
  'MISSING_VALID_CANDIDATES',
]);
export type ProviderDeclaredAbstentionReason = z.infer<
  typeof ProviderDeclaredAbstentionReasonSchema
>;

export const ProposedProviderClassificationResponseSchema = z
  .object({
    outcome: z.literal('PROPOSED'),
    projectId: boundedIdentifierSchema,
    transactionTypeId: boundedIdentifierSchema,
    categoryId: boundedIdentifierSchema,
  })
  .strict();

export const AbstainedProviderClassificationResponseSchema = z
  .object({
    outcome: z.literal('ABSTAINED'),
    abstentionReason: ProviderDeclaredAbstentionReasonSchema,
  })
  .strict();

export const RawProviderClassificationResponseSchema = z.discriminatedUnion('outcome', [
  ProposedProviderClassificationResponseSchema,
  AbstainedProviderClassificationResponseSchema,
]);
export type RawProviderClassificationResponse = z.infer<
  typeof RawProviderClassificationResponseSchema
>;

export type ProviderResponseParseResult =
  | Readonly<{
      ok: true;
      value: RawProviderClassificationResponse;
    }>
  | Readonly<{
      ok: false;
      reason: 'MALFORMED_PROVIDER_OUTPUT';
    }>;

const malformedProviderOutput = (): ProviderResponseParseResult => ({
  ok: false,
  reason: 'MALFORMED_PROVIDER_OUTPUT',
});

export const parseProviderResponseText = (
  rawText: string,
): ProviderResponseParseResult => {
  if (Buffer.byteLength(rawText, 'utf8') > INFERENCE_RESPONSE_MAX_BYTES) {
    return malformedProviderOutput();
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    return malformedProviderOutput();
  }

  const validated = RawProviderClassificationResponseSchema.safeParse(parsed);
  if (!validated.success) {
    return malformedProviderOutput();
  }

  return { ok: true, value: validated.data };
};
