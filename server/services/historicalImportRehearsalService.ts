import crypto from 'node:crypto';
import {
  BookingSource,
  StatementCoverageStatus,
  TransactionClassificationSource,
  WorkspaceRole,
  type Prisma,
} from '@prisma/client';
import type {
  HistoricalImportPlan,
  HistoricalSourceFilePlan,
  HistoricalStatementPeriodPlan,
  HistoricalStatementPlan,
  HistoricalTransactionPlan,
} from '../../lib/import/historicalImportPlanner';

type TxClient = Prisma.TransactionClient;

export type HistoricalImportRehearsalInput = {
  plan: HistoricalImportPlan;
  actorEmail?: string;
};

export type HistoricalImportRehearsalSummary = {
  workspaceId: string;
  userId: string;
  accountId: string;
  sourceFilesWritten: number;
  bankStatementsWritten: number;
  statementPeriodsWritten: number;
  transactionsWritten: number;
  bookingsWritten: number;
  duplicateFingerprints: string[];
  controlTotals: {
    workbook: HistoricalStatementPlan['totals'];
    openStatement: HistoricalStatementPlan['totals'];
  };
  closeEligibility: {
    workbook: Pick<HistoricalStatementPeriodPlan, 'coverageStatus' | 'closePermitted' | 'closeReason'>;
    openStatement: Pick<HistoricalStatementPeriodPlan, 'coverageStatus' | 'closePermitted' | 'closeReason'>;
  };
};

const WORKSPACE_SLUG = 'historical-rehearsal-fixture';
const DEFAULT_ACTOR_EMAIL = 'historical-rehearsal@example.invalid';

const stableStringify = (value: unknown): string => {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  }
  return `{${Object.entries(value as Record<string, unknown>)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, val]) => `${JSON.stringify(key)}:${stableStringify(val)}`)
    .join(',')}}`;
};

const hashEvidence = (value: unknown): string =>
  crypto.createHash('sha256').update(stableStringify(value)).digest('hex');

const syntheticSourceContent = (sourceFile: HistoricalSourceFilePlan): Uint8Array<ArrayBuffer> => {
  const encoded = new TextEncoder().encode(
    [
      'synthetic historical rehearsal source',
      `filename=${sourceFile.originalFilename}`,
      `sha256=${sourceFile.sha256}`,
      `kind=${sourceFile.kind}`,
    ].join('\n'),
  );
  const content: Uint8Array<ArrayBuffer> = new Uint8Array(encoded.byteLength);
  content.set(encoded);
  return content;
};

const toDate = (value: string | null): Date => {
  if (!value) {
    throw new Error('Historical rehearsal statement is missing a period boundary.');
  }
  return new Date(value);
};

const coverageStatus = (value: 'COMPLETE' | 'PARTIAL'): StatementCoverageStatus =>
  value === 'COMPLETE' ? StatementCoverageStatus.COMPLETE : StatementCoverageStatus.PARTIAL;

const toInputJson = (value: unknown): Prisma.InputJsonValue =>
  JSON.parse(stableStringify(value)) as Prisma.InputJsonValue;

const ensureFixtureUser = async (db: TxClient, email: string) =>
  db.user.upsert({
    where: { email },
    update: {},
    create: { email },
  });

const ensureWorkspace = async (db: TxClient) =>
  db.financeWorkspace.upsert({
    where: { slug: WORKSPACE_SLUG },
    update: {},
    create: {
      name: 'Historical Rehearsal Fixture',
      slug: WORKSPACE_SLUG,
      defaultCurrency: 'EUR',
    },
  });

const ensureMembership = async (db: TxClient, workspaceId: string, userId: string) =>
  db.workspaceMembership.upsert({
    where: {
      workspaceId_userId: {
        workspaceId,
        userId,
      },
    },
    update: { isActive: true },
    create: {
      workspaceId,
      userId,
      role: WorkspaceRole.ADMIN,
      isActive: true,
    },
  });

const ensureAccount = async (db: TxClient, userId: string, identifier: string) =>
  db.account.upsert({
    where: {
      userId_identifier: {
        userId,
        identifier,
      },
    },
    update: {
      name: 'Historical Rehearsal Fixture Account',
      currency: 'EUR',
    },
    create: {
      userId,
      identifier,
      name: 'Historical Rehearsal Fixture Account',
      currency: 'EUR',
    },
  });

const upsertSourceFile = async (
  db: TxClient,
  workspaceId: string,
  sourceFile: HistoricalSourceFilePlan,
  uploadedBy: string,
) => {
  const existing = await db.sourceFile.findUnique({
    where: {
      workspaceId_sha256: {
        workspaceId,
        sha256: sourceFile.sha256,
      },
    },
  });
  if (existing) {
    return { record: existing, created: false };
  }

  const content = syntheticSourceContent(sourceFile);
  const record = await db.sourceFile.create({
    data: {
      workspaceId,
      filename: sourceFile.originalFilename,
      mediaType: sourceFile.mediaType,
      sizeBytes: content.byteLength,
      sha256: sourceFile.sha256,
      content,
      uploadedBy,
    },
  });
  return { record, created: true };
};

const ensureStatement = async (
  db: TxClient,
  params: {
    workspaceId: string;
    accountId: string;
    sourceFileId: string;
    supportingPdfFileId: string | null;
    statement: HistoricalStatementPlan;
    bankAccountIdentifier: string;
    acceptedBy: string;
  },
) => {
  const existing = await db.bankStatement.findUnique({
    where: { sourceFileId: params.sourceFileId },
  });
  if (existing) {
    return { record: existing, created: false };
  }
  const record = await db.bankStatement.create({
    data: {
      workspaceId: params.workspaceId,
      accountId: params.accountId,
      sourceFileId: params.sourceFileId,
      supportingPdfFileId: params.supportingPdfFileId,
      periodStart: toDate(params.statement.periodStart),
      periodEnd: toDate(params.statement.periodEnd),
      coverageStatus: coverageStatus(params.statement.coverageStatus),
      openingBalanceMinor: params.statement.totals.openingBalanceMinor,
      incomeMinor: params.statement.totals.incomeMinor,
      expenseMinor: params.statement.totals.expenseMinor,
      netMinor: params.statement.totals.incomeMinor - params.statement.totals.expenseMinor,
      closingBalanceMinor: params.statement.totals.closingBalanceMinor,
      transactionCount: params.statement.rowCount,
      bankAccountIdentifier: params.bankAccountIdentifier,
      acceptedBy: params.acceptedBy,
      acceptedAt: new Date(),
    },
  });
  return { record, created: true };
};

const ensureStatementPeriod = async (
  db: TxClient,
  params: {
    workspaceId: string;
    statementId: string;
    accountId: string;
    period: HistoricalStatementPeriodPlan;
  },
) => {
  const periodStart = toDate(params.period.periodStart);
  const periodEnd = toDate(params.period.periodEnd);
  const existing = await db.statementPeriod.findUnique({
    where: {
      statementId_accountId_periodStart_periodEnd: {
        statementId: params.statementId,
        accountId: params.accountId,
        periodStart,
        periodEnd,
      },
    },
  });
  if (existing) {
    return { record: existing, created: false };
  }
  const record = await db.statementPeriod.create({
    data: {
      workspaceId: params.workspaceId,
      statementId: params.statementId,
      accountId: params.accountId,
      periodStart,
      periodEnd,
      coverageStatus: coverageStatus(params.period.coverageStatus),
      openingBalanceMinor: params.period.openingBalanceMinor,
      incomeMinor: params.period.incomeMinor,
      expenseMinor: params.period.expenseMinor,
      netMinor: params.period.netMinor,
      closingBalanceMinor: params.period.closingBalanceMinor,
      transactionCount: params.period.transactionCount,
    },
  });
  return { record, created: true };
};

const ensureDimensions = async (
  db: TxClient,
  workspaceId: string,
  tx: HistoricalTransactionPlan,
) => {
  if (!tx.klant || !tx.type || !tx.category) return null;
  const [project, transactionType, category] = await Promise.all([
    db.project.upsert({
      where: { workspaceId_code: { workspaceId, code: tx.klant } },
      update: {},
      create: {
        workspaceId,
        code: tx.klant,
        name: tx.klant,
        isHistorical: true,
      },
    }),
    db.transactionType.upsert({
      where: { workspaceId_literalName: { workspaceId, literalName: tx.type } },
      update: {},
      create: {
        workspaceId,
        literalName: tx.type,
        isHistorical: true,
      },
    }),
    db.category.upsert({
      where: { workspaceId_name: { workspaceId, name: tx.category } },
      update: {},
      create: {
        workspaceId,
        name: tx.category,
        isHistorical: true,
      },
    }),
  ]);

  return { project, transactionType, category };
};

const ensureTransaction = async (
  db: TxClient,
  params: {
    userId: string;
    accountId: string;
    sourceFilename: string;
    tx: HistoricalTransactionPlan;
    dimensionIds?: { projectId: string; transactionTypeId: string; categoryId: string } | null;
  },
) => {
  const existing = await db.transaction.findUnique({
    where: {
      userId_importFingerprint: {
        userId: params.userId,
        importFingerprint: params.tx.fingerprint,
      },
    },
  });
  if (existing) {
    return { record: existing, created: false };
  }

  const record = await db.transaction.create({
    data: {
      userId: params.userId,
      accountId: params.accountId,
      date: new Date(params.tx.date),
      description: String(params.tx.rawRow['Name / Description'] ?? 'Historical fixture transaction'),
      normalizedKey: params.tx.fingerprint,
      source: 'historical_rehearsal_fixture',
      sourceFile: params.sourceFilename,
      rawRow: toInputJson(params.tx.rawRow),
      amountMinor: params.tx.amountMinor,
      currency: 'EUR',
      direction: params.tx.direction,
      counterparty: params.tx.counterparty,
      reference: params.tx.reference,
      hash: params.tx.fingerprint,
      importFingerprint: params.tx.fingerprint,
      projectId: params.dimensionIds?.projectId ?? null,
      transactionTypeId: params.dimensionIds?.transactionTypeId ?? null,
      categoryId: params.dimensionIds?.categoryId ?? null,
      classificationSource: params.dimensionIds
        ? TransactionClassificationSource.history
        : TransactionClassificationSource.import,
    },
  });
  return { record, created: true };
};

const ensureBooking = async (
  db: TxClient,
  params: {
    workspaceId: string;
    transactionId: string;
    tx: HistoricalTransactionPlan;
    dimensionIds: { projectId: string; transactionTypeId: string; categoryId: string };
    confirmedBy: string;
  },
) => {
  const existing = await db.transactionBooking.findUnique({
    where: { transactionId: params.transactionId },
  });
  if (existing) {
    return { record: existing, created: false };
  }
  const evidence = {
    source: 'sanitized-historical-rehearsal',
    rowNumber: params.tx.rowNumber,
    fingerprint: params.tx.fingerprint,
    literalProjectLabel: params.tx.klant,
    literalTypeLabel: params.tx.type,
    literalCategoryLabel: params.tx.category,
  };
  const record = await db.transactionBooking.create({
    data: {
      workspaceId: params.workspaceId,
      transactionId: params.transactionId,
      projectId: params.dimensionIds.projectId,
      transactionTypeId: params.dimensionIds.transactionTypeId,
      categoryId: params.dimensionIds.categoryId,
      source: BookingSource.HISTORICAL,
      evidence: toInputJson(evidence),
      evidenceHash: hashEvidence(evidence),
      confirmedBy: params.confirmedBy,
      literalProjectLabel: params.tx.klant!,
      literalTypeLabel: params.tx.type!,
      literalCategoryLabel: params.tx.category!,
    },
  });
  return { record, created: true };
};

export const rehearseHistoricalImportPlan = async (
  db: TxClient,
  input: HistoricalImportRehearsalInput,
): Promise<HistoricalImportRehearsalSummary> => {
  const actor = await ensureFixtureUser(db, input.actorEmail ?? DEFAULT_ACTOR_EMAIL);
  const workspace = await ensureWorkspace(db);
  await ensureMembership(db, workspace.id, actor.id);

  const firstAccountIdentifier =
    input.plan.workbook.transactions[0]?.accountIdentifier ??
    input.plan.openStatement.transactions[0]?.accountIdentifier ??
    'HISTORICAL-REHEARSAL';
  const account = await ensureAccount(db, actor.id, firstAccountIdentifier);

  let sourceFilesWritten = 0;
  let bankStatementsWritten = 0;
  let statementPeriodsWritten = 0;
  let transactionsWritten = 0;
  let bookingsWritten = 0;

  const writeStatement = async (
    sourceFilePlan: HistoricalSourceFilePlan,
    supportingPdfFilePlan: HistoricalSourceFilePlan | null,
    statement: HistoricalStatementPlan,
    period: HistoricalStatementPeriodPlan,
  ) => {
    const sourceFile = await upsertSourceFile(db, workspace.id, sourceFilePlan, actor.id);
    if (sourceFile.created) sourceFilesWritten += 1;
    let supportingPdfFileId: string | null = null;
    if (supportingPdfFilePlan) {
      const supportingPdfFile = await upsertSourceFile(db, workspace.id, supportingPdfFilePlan, actor.id);
      if (supportingPdfFile.created) sourceFilesWritten += 1;
      supportingPdfFileId = supportingPdfFile.record.id;
    }
    const statementRecord = await ensureStatement(db, {
      workspaceId: workspace.id,
      accountId: account.id,
      sourceFileId: sourceFile.record.id,
      supportingPdfFileId,
      statement,
      bankAccountIdentifier: account.identifier,
      acceptedBy: actor.id,
    });
    if (statementRecord.created) bankStatementsWritten += 1;
    const periodRecord = await ensureStatementPeriod(db, {
      workspaceId: workspace.id,
      statementId: statementRecord.record.id,
      accountId: account.id,
      period,
    });
    if (periodRecord.created) statementPeriodsWritten += 1;
  };

  await writeStatement(
    input.plan.workbook.sourceFile,
    input.plan.workbook.statement.supportingPdfFile,
    input.plan.workbook.statement,
    input.plan.workbook.period,
  );
  await writeStatement(
    input.plan.openStatement.sourceFile,
    input.plan.openStatement.supportingPdfFile,
    input.plan.openStatement.statement,
    input.plan.openStatement.period,
  );

  const transactionPlans = [
    ...input.plan.workbook.transactions.map((tx) => ({
      tx,
      sourceFilename: input.plan.workbook.sourceFile.originalFilename,
    })),
    ...input.plan.openStatement.transactions.map((tx) => ({
      tx,
      sourceFilename: input.plan.openStatement.sourceFile.originalFilename,
    })),
  ];

  const seenInPlan = new Set<string>();
  for (const { tx, sourceFilename } of transactionPlans) {
    if (seenInPlan.has(tx.fingerprint)) {
      continue;
    }
    seenInPlan.add(tx.fingerprint);
    const dimensions = await ensureDimensions(db, workspace.id, tx);
    const dimensionIds = dimensions
      ? {
          projectId: dimensions.project.id,
          transactionTypeId: dimensions.transactionType.id,
          categoryId: dimensions.category.id,
        }
      : null;
    const transaction = await ensureTransaction(db, {
      userId: actor.id,
      accountId: account.id,
      sourceFilename,
      tx,
      dimensionIds,
    });
    if (transaction.created) transactionsWritten += 1;
    if (dimensionIds) {
      const booking = await ensureBooking(db, {
        workspaceId: workspace.id,
        transactionId: transaction.record.id,
        tx,
        dimensionIds,
        confirmedBy: actor.id,
      });
      if (booking.created) bookingsWritten += 1;
    }
  }

  return {
    workspaceId: workspace.id,
    userId: actor.id,
    accountId: account.id,
    sourceFilesWritten,
    bankStatementsWritten,
    statementPeriodsWritten,
    transactionsWritten,
    bookingsWritten,
    duplicateFingerprints: input.plan.duplicateFingerprints,
    controlTotals: {
      workbook: input.plan.workbook.statement.totals,
      openStatement: input.plan.openStatement.statement.totals,
    },
    closeEligibility: {
      workbook: {
        coverageStatus: input.plan.workbook.period.coverageStatus,
        closePermitted: input.plan.workbook.period.closePermitted,
        closeReason: input.plan.workbook.period.closeReason,
      },
      openStatement: {
        coverageStatus: input.plan.openStatement.period.coverageStatus,
        closePermitted: input.plan.openStatement.period.closePermitted,
        closeReason: input.plan.openStatement.period.closeReason,
      },
    },
  };
};
