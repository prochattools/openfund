import {
  DispatchStatus,
  PeriodCloseStatus,
  ReportArtifactFormat,
  ReportKind,
  ReportLineKind,
  StatementCoverageStatus,
  type Prisma,
} from '@prisma/client';
import { canonicalizeEvidence, hashEvidence } from './reviewDecisionService';
import { assertStatementTotals, type StatementTotalsInput } from './statementControlService';

export class PeriodCloseError extends Error {
  statusCode: number;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = 'PeriodCloseError';
    this.statusCode = statusCode;
  }
}

type TxClient = Prisma.TransactionClient;

type BigIntLike = bigint | number;

export type BalancedReconciliationEvidence = {
  status: 'BALANCED' | 'UNBALANCED' | 'INCOMPLETE';
  coverageStatus: StatementCoverageStatus;
  balanceDifferenceMinor: BigIntLike;
  categoryIncomeDifferenceMinor: BigIntLike;
  categoryExpenseDifferenceMinor: BigIntLike;
  runningBalanceErrorCount: number;
  transactionCount: number;
  bookedTransactionCount: number;
  unresolvedTransactionCount: number;
  validatorVersion: string;
};

export type CreatePeriodCloseInput = StatementTotalsInput & {
  workspaceId: string;
  ledgerId: string;
  statementId: string;
  statementPeriodId: string;
  periodStart: Date;
  periodEnd: Date;
  transactionCount: number;
  closedBy: string;
  reconciliationEvidence: BalancedReconciliationEvidence;
  classificationEvidence?: unknown;
  sourceDataEvidence?: unknown;
};

export type ReopenPeriodCloseInput = {
  closeId: string;
  reopenedBy: string;
  reason: string;
  auditUserId: string;
  actorEmail?: string | null;
};

export type ReportLineInput = {
  lineKind: ReportLineKind;
  projectId?: string | null;
  transactionTypeId?: string | null;
  categoryId?: string | null;
  literalProjectLabel?: string | null;
  literalTypeLabel?: string | null;
  literalCategoryLabel?: string | null;
  direction?: 'credit' | 'debit' | null;
  reportingClass?: string | null;
  amountMinor: BigIntLike;
  transactionCount: number;
  sortOrder: number;
};

export type ReportArtifactInput = {
  format: ReportArtifactFormat;
  filename: string;
  mediaType: string;
  content: Buffer | Uint8Array | string;
};

export type CreateReportSnapshotInput = StatementTotalsInput & {
  workspaceId: string;
  kind: ReportKind;
  year: number;
  month?: number | null;
  version?: number;
  transactionCount: number;
  generatedBy: string;
  periodCloseIds: string[];
  lines?: ReportLineInput[];
};

export type ApproveReportSnapshotInput = {
  reportSnapshotId: string;
  approvedBy: string;
};

export type CreateReportDispatchInput = {
  reportSnapshotId: string;
  reportApprovalId: string;
  deliveryKey: string;
  fromAddress: string;
  subject: string;
  recipients: Array<{ email: string; name: string | null }>;
  recipientHash: string;
  contentHash: string;
  sentBy: string;
};

const toBigInt = (value: BigIntLike): bigint => BigInt(value);

const toInputJson = (value: unknown): Prisma.InputJsonValue =>
  JSON.parse(canonicalizeEvidence(value)) as Prisma.InputJsonValue;

const requireZero = (value: BigIntLike, message: string) => {
  if (toBigInt(value) !== 0n) {
    throw new PeriodCloseError(message);
  }
};

export const assertCanClose = (evidence: BalancedReconciliationEvidence) => {
  if (evidence.status !== 'BALANCED') {
    throw new PeriodCloseError('Alleen een gebalanceerde reconciliatie kan worden gesloten.');
  }

  if (evidence.coverageStatus !== StatementCoverageStatus.COMPLETE) {
    throw new PeriodCloseError('Een gedeeltelijke periode kan niet worden gesloten.');
  }

  requireZero(evidence.balanceDifferenceMinor, 'Het bankverschil moet nul zijn voordat de periode sluit.');
  requireZero(evidence.categoryIncomeDifferenceMinor, 'Het inkomstenverschil moet nul zijn voordat de periode sluit.');
  requireZero(evidence.categoryExpenseDifferenceMinor, 'Het uitgavenverschil moet nul zijn voordat de periode sluit.');

  if (evidence.unresolvedTransactionCount !== 0) {
    throw new PeriodCloseError('Alle transacties moeten geboekt zijn voordat de periode sluit.');
  }

  if (evidence.runningBalanceErrorCount !== 0) {
    throw new PeriodCloseError('De periode bevat nog running-balance fouten.');
  }

  if (evidence.bookedTransactionCount !== evidence.transactionCount) {
    throw new PeriodCloseError('Het aantal geboekte transacties moet exact gelijk zijn aan het aantal brontransacties.');
  }
};

const normalizeHashEvidence = (fallback: unknown, explicit?: unknown): string =>
  hashEvidence(explicit ?? fallback);

export const createPeriodClose = async (db: TxClient, input: CreatePeriodCloseInput) => {
  assertCanClose(input.reconciliationEvidence);
  const totals = assertStatementTotals(input);

  const latest = await db.periodClose.findFirst({
    where: {
      ledgerId: input.ledgerId,
    },
    orderBy: {
      version: 'desc',
    },
  });
  const version = latest ? latest.version + 1 : 1;

  const classificationHash = normalizeHashEvidence({
    ledgerId: input.ledgerId,
    statementPeriodId: input.statementPeriodId,
    transactionCount: input.transactionCount,
  }, input.classificationEvidence);
  const sourceDataHash = normalizeHashEvidence({
    statementId: input.statementId,
    statementPeriodId: input.statementPeriodId,
    ...totals,
    transactionCount: input.transactionCount,
  }, input.sourceDataEvidence);

  return db.periodClose.create({
    data: {
      workspaceId: input.workspaceId,
      ledgerId: input.ledgerId,
      statementId: input.statementId,
      statementPeriodId: input.statementPeriodId,
      version,
      status: PeriodCloseStatus.CLOSED,
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
      ...totals,
      transactionCount: input.transactionCount,
      classificationHash,
      sourceDataHash,
      closedBy: input.closedBy,
      reconciliationEvidence: toInputJson(input.reconciliationEvidence),
    },
  });
};

export const reopenPeriodClose = async (db: TxClient, input: ReopenPeriodCloseInput) => {
  const reason = input.reason.trim();
  if (!reason) {
    throw new PeriodCloseError('Een heropenreden is verplicht.');
  }

  const reopenedAt = new Date();
  const close = await db.periodClose.update({
    where: {
      id: input.closeId,
    },
    data: {
      status: PeriodCloseStatus.REOPENED,
      reopenedBy: input.reopenedBy,
      reopenedAt,
      reopenReason: reason,
    },
  });

  await db.auditLog.create({
    data: {
      userId: input.auditUserId,
      actorId: input.reopenedBy,
      actorEmail: input.actorEmail ?? null,
      action: 'period.close.reopened',
      entityType: 'periodClose',
      entityId: input.closeId,
      before: toInputJson({ status: PeriodCloseStatus.CLOSED }),
      after: toInputJson({ status: PeriodCloseStatus.REOPENED, reopenedAt, reason }),
      metadata: toInputJson({ source: 'period-close-service' }),
    },
  });

  return close;
};

const assertReportLines = (lines: ReportLineInput[] = []) => {
  for (const line of lines) {
    if (!Number.isInteger(line.transactionCount) || line.transactionCount < 0) {
      throw new PeriodCloseError('Rapportregels moeten een geldig transactietotaal hebben.');
    }

    if (!Number.isInteger(line.sortOrder) || line.sortOrder < 0) {
      throw new PeriodCloseError('Rapportregels moeten een geldige sorteervolgorde hebben.');
    }

    if (line.lineKind === ReportLineKind.PROJECT && !line.projectId) {
      throw new PeriodCloseError('Een projectregel vereist een Klant.');
    }
    if (line.lineKind === ReportLineKind.TRANSACTION_TYPE && !line.transactionTypeId) {
      throw new PeriodCloseError('Een typeregel vereist een Type.');
    }
    if (line.lineKind === ReportLineKind.CATEGORY && !line.categoryId) {
      throw new PeriodCloseError('Een categorierregel vereist een Categorie.');
    }
    if (line.lineKind === ReportLineKind.REPORTING_CLASS && !line.reportingClass) {
      throw new PeriodCloseError('Een rapportageklasse-regel vereist een rapportageklasse.');
    }
  }
};

export const createReportSnapshot = async (db: TxClient, input: CreateReportSnapshotInput) => {
  if (!input.periodCloseIds.length) {
    throw new PeriodCloseError('Een rapportage-snapshot vereist minimaal één gesloten periode.');
  }
  assertReportLines(input.lines);
  const totals = assertStatementTotals(input);
  const version = input.version ?? 1;
  const snapshotHash = hashEvidence({
    kind: input.kind,
    year: input.year,
    month: input.month ?? null,
    version,
    periodCloseIds: input.periodCloseIds,
    totals,
    transactionCount: input.transactionCount,
    lines: input.lines ?? [],
  });

  return db.reportSnapshot.create({
    data: {
      workspaceId: input.workspaceId,
      kind: input.kind,
      year: input.year,
      month: input.month ?? null,
      version,
      ...totals,
      transactionCount: input.transactionCount,
      snapshotHash,
      generatedBy: input.generatedBy,
      periodCloseLinks: {
        create: input.periodCloseIds.map((periodCloseId, index) => ({
          periodCloseId,
          sortOrder: index + 1,
        })),
      },
      lines: input.lines?.length ? {
        create: input.lines.map((line) => ({
          ...line,
          amountMinor: toBigInt(line.amountMinor),
          projectId: line.projectId ?? null,
          transactionTypeId: line.transactionTypeId ?? null,
          categoryId: line.categoryId ?? null,
          literalProjectLabel: line.literalProjectLabel ?? null,
          literalTypeLabel: line.literalTypeLabel ?? null,
          literalCategoryLabel: line.literalCategoryLabel ?? null,
          direction: line.direction ?? null,
          reportingClass: line.reportingClass ?? null,
        })),
      } : undefined,
    },
  });
};

export const approveReportSnapshot = async (db: TxClient, input: ApproveReportSnapshotInput) => {
  const snapshot = await db.reportSnapshot.findUnique({
    where: { id: input.reportSnapshotId },
  });
  if (!snapshot) {
    throw new PeriodCloseError('Rapportage-snapshot niet gevonden.', 404);
  }

  return db.reportApproval.create({
    data: {
      reportSnapshotId: snapshot.id,
      approvedBy: input.approvedBy,
      snapshotHash: snapshot.snapshotHash,
    },
  });
};

export const createReportDispatch = async (db: TxClient, input: CreateReportDispatchInput) => {
  if (!input.recipients.length) {
    throw new PeriodCloseError('Rapportverzending vereist minimaal één ontvanger.');
  }

  const approval = await db.reportApproval.findFirst({
    where: {
      id: input.reportApprovalId,
      reportSnapshotId: input.reportSnapshotId,
      revokedAt: null,
    },
  });

  if (!approval) {
    throw new PeriodCloseError('Rapportverzending vereist een actieve goedkeuring.', 409);
  }

  return db.reportDispatch.create({
    data: {
      reportSnapshotId: input.reportSnapshotId,
      reportApprovalId: input.reportApprovalId,
      deliveryKey: input.deliveryKey,
      status: DispatchStatus.PENDING,
      fromAddress: input.fromAddress,
      subject: input.subject,
      recipientHash: input.recipientHash,
      contentHash: input.contentHash,
      sentBy: input.sentBy,
      recipients: {
        create: input.recipients.map((recipient) => ({
          email: recipient.email,
          name: recipient.name,
        })),
      },
    },
  });
};

export const hashReportArtifact = (artifact: ReportArtifactInput): { sha256: string; sizeBytes: number; content: Buffer } => {
  const content = Buffer.isBuffer(artifact.content) ? Buffer.from(artifact.content) : Buffer.from(artifact.content);
  return {
    sha256: hashEvidence({ format: artifact.format, contentSha256: hashEvidence(content.toString('base64')) }),
    sizeBytes: content.byteLength,
    content,
  };
};
