import type { Prisma, PrismaClient } from '@prisma/client';
import {
  finalizeStagedMonthlyStatement,
  importMonthlyStatementEvidence,
  type MonthlyStatementEvidenceInput,
  type MonthlyStatementEvidenceResult,
  type MonthlyStatementPackageResult,
} from './monthlyStatementPackageService';

type StatementImportClient = Pick<PrismaClient, '$transaction'>;

export type StatementImportTransactionInput = Omit<MonthlyStatementEvidenceInput, 'db'>;

export type StatementImportTransactionResult =
  | MonthlyStatementEvidenceResult
  | MonthlyStatementPackageResult;

const canFinalize = (status: StatementImportTransactionResult['status']): boolean =>
  status === 'CSV_IMPORTED' || status === 'CSV_STAGED' || status === 'PDF_STAGED';

/**
 * Owns the database boundary for one statement upload request.
 *
 * A one-file upload may intentionally commit as staged evidence when its
 * counterpart is not available. If pairing is attempted in this request,
 * however, the staged write and the final package import share this same
 * transaction so every failure rolls back the current request atomically.
 */
export const runStatementImportTransaction = (
  client: StatementImportClient,
  input: StatementImportTransactionInput,
): Promise<StatementImportTransactionResult> => client.$transaction(async (tx: Prisma.TransactionClient) => {
  let result = await importMonthlyStatementEvidence({ db: tx, ...input });

  if (canFinalize(result.status)) {
    const finalized = await finalizeStagedMonthlyStatement({
      db: tx,
      userId: input.userId,
      workspaceId: input.workspaceId,
      expectedMonthKey: input.expectedMonthKey,
    });
    if (finalized) result = finalized;
  }

  return result;
}, { timeout: 60_000 });
