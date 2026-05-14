import type { Prisma } from '@prisma/client';

type TxClient = Prisma.TransactionClient;

export type AuditLogInput = {
  userId: string;
  actorId?: string | null;
  actorEmail?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  before?: Prisma.InputJsonValue | null;
  after?: Prisma.InputJsonValue | null;
  metadata?: Prisma.InputJsonValue | null;
};

const toNullableJson = (value: Prisma.InputJsonValue | null | undefined) =>
  value === undefined ? undefined : value;

export const createAuditLog = async (tx: TxClient, input: AuditLogInput) => {
  return tx.auditLog.create({
    data: {
      userId: input.userId,
      actorId: input.actorId ?? null,
      actorEmail: input.actorEmail ?? null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      before: toNullableJson(input.before),
      after: toNullableJson(input.after),
      metadata: toNullableJson(input.metadata),
    },
  });
};
