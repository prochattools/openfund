import { hashEvidence } from './reviewDecisionService';

export type MerchantConfirmationState = {
  id: string;
  workspaceId: string;
  status: string;
  mergedIntoMerchantId: string | null;
  version: number;
  updatedById: string | null;
  updatedAt: Date | string;
  deprecatedAt: Date | string | null;
};

const iso = (value: Date | string): string =>
  value instanceof Date ? value.toISOString() : new Date(value).toISOString();

export const hashMerchantConfirmationState = (
  merchant: MerchantConfirmationState,
): string => hashEvidence({
  id: merchant.id,
  workspaceId: merchant.workspaceId,
  status: merchant.status,
  mergedIntoMerchantId: merchant.mergedIntoMerchantId,
  version: merchant.version,
  updatedById: merchant.updatedById,
  updatedAt: iso(merchant.updatedAt),
  deprecatedAt: merchant.deprecatedAt ? iso(merchant.deprecatedAt) : null,
});
