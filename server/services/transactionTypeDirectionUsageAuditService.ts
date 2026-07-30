import crypto from 'node:crypto';
import type { PrismaClient, TransactionDirection } from '@prisma/client';

export const TRANSACTION_TYPE_DIRECTION_USAGE_AUDIT_VERSION = 'transaction-type-direction-usage-audit-v1';

export type TransactionTypeDirectionUsageBucket = {
  anonymousKey: string;
  historicalUsageCount: number;
  debitCount: number;
  creditCount: number;
  unknownCount: number;
  classification: 'single-direction' | 'mixed-direction' | 'unknown-only' | 'unused';
};

export type TransactionTypeDirectionUsageAudit = {
  algorithmVersion: string;
  scopeHash: string;
  reportHash: string;
  totals: { historicalEvidence: number; bucketUsageCount: number; debitCount: number; creditCount: number; unknownCount: number };
  buckets: TransactionTypeDirectionUsageBucket[];
  sideEffects: { writesPerformed: false; createsTransactionBooking: false; createsReviewDecision: false; mutatesBankFacts: false };
};

type AuditInput = {
  workspaceId: string;
  types: Array<{ id: string }>;
  historicalBookings: Array<{ transactionTypeId: string; direction: TransactionDirection | null | undefined }>;
};

type AuditDb = Pick<PrismaClient, 'transactionType' | 'transactionBooking'>;

const sha256 = (value: unknown): string => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
const direction = (value: unknown): TransactionDirection | null => value === 'credit' || value === 'debit' ? value : null;

export const buildTransactionTypeDirectionUsageAudit = (input: AuditInput): TransactionTypeDirectionUsageAudit => {
  const scopeHash = sha256({ scope: input.workspaceId });
  const orderedTypes = [...input.types].sort((left, right) =>
    sha256({ scopeHash, typeId: left.id }).localeCompare(sha256({ scopeHash, typeId: right.id })),
  );
  const buckets = orderedTypes.map((type, index) => {
    const usages = input.historicalBookings.filter((booking) => booking.transactionTypeId === type.id);
    const creditCount = usages.filter((booking) => direction(booking.direction) === 'credit').length;
    const debitCount = usages.filter((booking) => direction(booking.direction) === 'debit').length;
    const unknownCount = usages.length - creditCount - debitCount;
    const classification: TransactionTypeDirectionUsageBucket['classification'] = usages.length === 0
      ? 'unused'
      : creditCount > 0 && debitCount > 0
        ? 'mixed-direction'
        : creditCount + debitCount > 0
          ? 'single-direction'
          : 'unknown-only';
    return { anonymousKey: `TYPE_${String(index + 1).padStart(2, '0')}`, historicalUsageCount: usages.length, debitCount, creditCount, unknownCount, classification };
  });
  const totals = buckets.reduce((total, bucket) => ({
    historicalEvidence: total.historicalEvidence + bucket.historicalUsageCount,
    bucketUsageCount: total.bucketUsageCount + bucket.historicalUsageCount,
    debitCount: total.debitCount + bucket.debitCount,
    creditCount: total.creditCount + bucket.creditCount,
    unknownCount: total.unknownCount + bucket.unknownCount,
  }), { historicalEvidence: 0, bucketUsageCount: 0, debitCount: 0, creditCount: 0, unknownCount: 0 });
  if (totals.historicalEvidence !== input.historicalBookings.length) throw new Error('Historical direction audit cannot reconcile all evidence to a transaction type bucket.');
  const reportHash = sha256({ algorithmVersion: TRANSACTION_TYPE_DIRECTION_USAGE_AUDIT_VERSION, scopeHash, totals, buckets });
  return { algorithmVersion: TRANSACTION_TYPE_DIRECTION_USAGE_AUDIT_VERSION, scopeHash, reportHash, totals, buckets, sideEffects: { writesPerformed: false, createsTransactionBooking: false, createsReviewDecision: false, mutatesBankFacts: false } };
};

export const auditHistoricalTransactionTypeDirections = async (
  db: AuditDb,
  input: { workspaceId: string },
): Promise<TransactionTypeDirectionUsageAudit> => {
  const [types, historicalBookings] = await Promise.all([
    db.transactionType.findMany({ where: { workspaceId: input.workspaceId }, select: { id: true } }),
    db.transactionBooking.findMany({ where: { workspaceId: input.workspaceId, source: 'HISTORICAL' }, select: { transactionTypeId: true, transaction: { select: { direction: true } } } }),
  ]);
  return buildTransactionTypeDirectionUsageAudit({
    workspaceId: input.workspaceId,
    types,
    historicalBookings: historicalBookings.map((booking) => ({ transactionTypeId: booking.transactionTypeId, direction: booking.transaction.direction })),
  });
};
