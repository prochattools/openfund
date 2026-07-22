export const MERCHANT_KNOWLEDGE_PAGE_SIZES = [25, 50, 100] as const;
export type MerchantKnowledgePageSize = (typeof MERCHANT_KNOWLEDGE_PAGE_SIZES)[number];

export const MERCHANT_KNOWLEDGE_STATUS_OPTIONS = [
  { value: '', label: 'Alle statussen' },
  { value: 'PROPOSED', label: 'Voorgesteld' },
  { value: 'ACTIVE', label: 'Actief' },
  { value: 'CONFLICTED', label: 'Conflict' },
  { value: 'MERGED', label: 'Samengevoegd' },
  { value: 'DEPRECATED', label: 'Verouderd' },
] as const;

export type MerchantKnowledgePageState = 'ready' | 'disabled' | 'unavailable';

export const classifyMerchantKnowledgeError = (message: string): MerchantKnowledgePageState => {
  const normalized = message.toLowerCase();
  if (normalized.includes('uitgeschakeld') || normalized.includes('disabled')) return 'disabled';
  return 'unavailable';
};

export const normalizeMerchantKnowledgeQuery = (value: string): string =>
  value.trim().slice(0, 100);

export const normalizeMerchantKnowledgePageSize = (value: number): MerchantKnowledgePageSize =>
  MERCHANT_KNOWLEDGE_PAGE_SIZES.includes(value as MerchantKnowledgePageSize)
    ? value as MerchantKnowledgePageSize
    : 25;



export type MerchantKnowledgeStatusFilter = (typeof MERCHANT_KNOWLEDGE_STATUS_OPTIONS)[number]['value'];

export const normalizeMerchantKnowledgeStatus = (value: string): MerchantKnowledgeStatusFilter =>
  MERCHANT_KNOWLEDGE_STATUS_OPTIONS.some((option) => option.value === value)
    ? value as MerchantKnowledgeStatusFilter
    : '';
