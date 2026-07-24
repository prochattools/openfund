import type { Prisma } from '@prisma/client';
import { canonicalizeEvidence } from './reviewDecisionService';

type TxClient = Prisma.TransactionClient;

export type MerchantKnowledgeAuditInput = {
  id: string;
  workspaceId: string;
  entityType: 'MERCHANT_ALIAS' | 'MERCHANT';
  entityId: string;
  action: 'DEPRECATE_ALIAS' | 'DEPRECATE_MERCHANT';
  actorId: string;
  requestId: string;
  beforeState: unknown;
  afterState: unknown;
  evidenceHash: string;
  schemaVersion: string;
};

const toInputJson = (value: unknown): Prisma.InputJsonValue =>
  JSON.parse(canonicalizeEvidence(value)) as Prisma.InputJsonValue;

export const createMerchantKnowledgeAuditEvent = async (
  tx: TxClient,
  input: MerchantKnowledgeAuditInput,
) => tx.merchantAuditEvent.create({
  data: {
    id: input.id,
    workspaceId: input.workspaceId,
    entityType: input.entityType,
    entityId: input.entityId,
    action: input.action,
    actorId: input.actorId,
    requestId: input.requestId,
    beforeState: toInputJson(input.beforeState),
    afterState: toInputJson(input.afterState),
    evidenceHash: input.evidenceHash,
    schemaVersion: input.schemaVersion,
  },
});
