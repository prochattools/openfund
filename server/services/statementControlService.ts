import crypto from 'node:crypto';
import type { Prisma, StatementCoverageStatus } from '@prisma/client';

export class StatementControlError extends Error {
  statusCode: number;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = 'StatementControlError';
    this.statusCode = statusCode;
  }
}

type TxClient = Prisma.TransactionClient;

type ByteInput = Buffer | Uint8Array | string;

export type StatementTotalsInput = {
  openingBalanceMinor: bigint | number;
  incomeMinor: bigint | number;
  expenseMinor: bigint | number;
  closingBalanceMinor: bigint | number;
};

export type StoreSourceFileInput = {
  workspaceId: string;
  filename: string;
  mediaType: string;
  content: ByteInput;
  uploadedBy?: string | null;
};

export type StatementPeriodInput = StatementTotalsInput & {
  accountId: string;
  periodStart: Date;
  periodEnd: Date;
  coverageStatus: StatementCoverageStatus;
  transactionCount: number;
};

export type AcceptBankStatementInput = StatementTotalsInput & {
  workspaceId: string;
  accountId: string;
  sourceFileId: string;
  supportingPdfFileId?: string | null;
  importBatchId?: string | null;
  periodStart: Date;
  periodEnd: Date;
  coverageStatus: StatementCoverageStatus;
  currency?: string;
  transactionCount: number;
  bankAccountIdentifier: string;
  acceptedBy?: string | null;
  acceptedAt?: Date | null;
  periods?: StatementPeriodInput[];
};

const toBigInt = (value: bigint | number): bigint => BigInt(value);

export const toSourceBuffer = (content: ByteInput): Buffer => {
  if (Buffer.isBuffer(content)) return Buffer.from(content);
  if (typeof content === 'string') return Buffer.from(content);
  return Buffer.from(content);
};

export const hashSourceContent = (content: ByteInput): string =>
  crypto.createHash('sha256').update(toSourceBuffer(content)).digest('hex');

export const assertStatementTotals = (totals: StatementTotalsInput) => {
  const opening = toBigInt(totals.openingBalanceMinor);
  const income = toBigInt(totals.incomeMinor);
  const expense = toBigInt(totals.expenseMinor);
  const closing = toBigInt(totals.closingBalanceMinor);
  const net = income - expense;

  if (opening + net !== closing) {
    throw new StatementControlError('Opening plus inkomsten min uitgaven moet exact gelijk zijn aan het eindsaldo.');
  }

  return {
    openingBalanceMinor: opening,
    incomeMinor: income,
    expenseMinor: expense,
    netMinor: net,
    closingBalanceMinor: closing,
  };
};

const assertPositiveRowCount = (transactionCount: number) => {
  if (!Number.isInteger(transactionCount) || transactionCount < 0) {
    throw new StatementControlError('Het aantal transacties moet een geldig niet-negatief geheel getal zijn.');
  }
};

export const storeSourceFile = async (db: TxClient, input: StoreSourceFileInput) => {
  const content = toSourceBuffer(input.content);
  const retainedContent = new Uint8Array(content.byteLength);
  retainedContent.set(content);
  const sha256 = hashSourceContent(content);

  return db.sourceFile.upsert({
    where: {
      workspaceId_sha256: {
        workspaceId: input.workspaceId,
        sha256,
      },
    },
    create: {
      workspaceId: input.workspaceId,
      filename: input.filename,
      mediaType: input.mediaType,
      sizeBytes: content.byteLength,
      sha256,
      content: retainedContent,
      uploadedBy: input.uploadedBy ?? null,
    },
    update: {},
  });
};

export const readSourceFileBytes = async (
  db: TxClient,
  params: { workspaceId: string; sourceFileId: string },
): Promise<Buffer> => {
  const sourceFile = await db.sourceFile.findFirst({
    where: {
      id: params.sourceFileId,
      workspaceId: params.workspaceId,
    },
  });

  if (!sourceFile) {
    throw new StatementControlError('Bronbestand niet gevonden.', 404);
  }

  return toSourceBuffer(sourceFile.content);
};

const normalizePeriodCreate = (period: StatementPeriodInput, fallback: { workspaceId: string }) => {
  assertPositiveRowCount(period.transactionCount);
  const totals = assertStatementTotals(period);

  return {
    workspaceId: fallback.workspaceId,
    accountId: period.accountId,
    periodStart: period.periodStart,
    periodEnd: period.periodEnd,
    coverageStatus: period.coverageStatus,
    ...totals,
    transactionCount: period.transactionCount,
  };
};

export const acceptBankStatement = async (db: TxClient, input: AcceptBankStatementInput) => {
  assertPositiveRowCount(input.transactionCount);
  const totals = assertStatementTotals(input);

  const existing = await db.bankStatement.findUnique({
    where: {
      sourceFileId: input.sourceFileId,
    },
  });

  if (existing) {
    throw new StatementControlError('Dit bronbestand is al als bankafschrift geaccepteerd.', 409);
  }

  const periods = input.periods?.map((period) => normalizePeriodCreate(period, { workspaceId: input.workspaceId })) ?? [];

  return db.bankStatement.create({
    data: {
      workspaceId: input.workspaceId,
      accountId: input.accountId,
      sourceFileId: input.sourceFileId,
      supportingPdfFileId: input.supportingPdfFileId ?? null,
      importBatchId: input.importBatchId ?? null,
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
      coverageStatus: input.coverageStatus,
      currency: input.currency ?? 'EUR',
      ...totals,
      transactionCount: input.transactionCount,
      bankAccountIdentifier: input.bankAccountIdentifier,
      acceptedBy: input.acceptedBy ?? null,
      acceptedAt: input.acceptedAt ?? null,
      periods: periods.length ? { create: periods } : undefined,
    },
    include: {
      periods: true,
      sourceFile: true,
    },
  });
};
