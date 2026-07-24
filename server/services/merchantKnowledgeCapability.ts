export const MERCHANT_KNOWLEDGE_READ_ONLY_EFFECTS = Object.freeze({
  readOnly: true as const,
  createsTransactionBooking: false as const,
  mutatesBankFacts: false as const,
});

export const isMerchantKnowledgeReadEnabled = (
  env: NodeJS.ProcessEnv = process.env,
): boolean => env.MERCHANT_KNOWLEDGE_READS_ENABLED?.trim().toLowerCase() === 'true';

export const merchantKnowledgeCapability = (env: NodeJS.ProcessEnv = process.env) => ({
  enabled: isMerchantKnowledgeReadEnabled(env),
  ...MERCHANT_KNOWLEDGE_READ_ONLY_EFFECTS,
});

export const MERCHANT_KNOWLEDGE_PREVIEW_EFFECTS = Object.freeze({
  previewOnly: true as const,
  readOnly: true as const,
  createsTransactionBooking: false as const,
  mutatesBankFacts: false as const,
  persistsMerchantKnowledge: false as const,
});

export const isMerchantKnowledgePreviewEnabled = (
  env: NodeJS.ProcessEnv = process.env,
): boolean => env.MERCHANT_KNOWLEDGE_PREVIEWS_ENABLED?.trim().toLowerCase() === 'true';

export const MERCHANT_ALIAS_DEPRECATION_CONFIRMATION_EFFECTS = Object.freeze({
  confirmed: true as const,
  action: 'DEPRECATE_ALIAS' as const,
  persistsMerchantKnowledge: true as const,
  writesMerchantIdentityDecision: true as const,
  writesMerchantAuditEvent: true as const,
  createsTransactionBooking: false as const,
  mutatesBankFacts: false as const,
  mutatesFinancialRecords: false as const,
});

export const isMerchantAliasDeprecationConfirmationEnabled = (
  env: NodeJS.ProcessEnv = process.env,
): boolean => env.MERCHANT_ALIAS_DEPRECATION_CONFIRMATION_ENABLED?.trim().toLowerCase() === 'true';

export const MERCHANT_DEPRECATION_CONFIRMATION_EFFECTS = Object.freeze({
  confirmed: true as const,
  action: 'DEPRECATE_MERCHANT' as const,
  persistsMerchantKnowledge: true as const,
  writesMerchantIdentityDecision: true as const,
  writesMerchantAuditEvent: true as const,
  cascadesAliases: false as const,
  cascadesFingerprints: false as const,
  createsTransactionBooking: false as const,
  mutatesBankFacts: false as const,
  mutatesFinancialRecords: false as const,
});

export const isMerchantDeprecationConfirmationEnabled = (
  env: NodeJS.ProcessEnv = process.env,
): boolean => env.MERCHANT_DEPRECATION_CONFIRMATION_ENABLED?.trim().toLowerCase() === 'true';



export const MERCHANT_CONFLICT_CONFIRMATION_EFFECTS = Object.freeze({
  confirmed: true as const,
  action: 'RESOLVE_CONFLICT' as const,
  persistsMerchantKnowledge: true as const,
  writesMerchantResolution: true as const,
  writesMerchantIdentityDecision: true as const,
  writesMerchantAuditEvent: true as const,
  trustsAliases: false as const,
  trustsFingerprints: false as const,
  mutatesMerchants: false as const,
  createsTransactionBooking: false as const,
  mutatesBankFacts: false as const,
  mutatesFinancialRecords: false as const,
});

export const isMerchantConflictConfirmationEnabled = (
  env: NodeJS.ProcessEnv = process.env,
): boolean => env.MERCHANT_CONFLICT_CONFIRMATION_ENABLED?.trim().toLowerCase() === 'true';
