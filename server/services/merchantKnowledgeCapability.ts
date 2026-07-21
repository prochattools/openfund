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
