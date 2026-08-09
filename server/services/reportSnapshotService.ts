/**
 * REPORT-001 / REPORT-002: Snapshot-based monthly and yearly report generation.
 *
 * Closed-period snapshot APIs still require immutable CLOSED PeriodClose evidence and
 * reject open, partial, or reopened periods. Live monthly e-mail dispatch uses
 * generateLiveMonthlyReportSnapshot instead, deriving an immutable snapshot from the
 * current fully booked Transaction/TransactionBooking state with no periodCloseLinks.
 * Period close remains optional for monthly e-mail reporting.
 *
 * No approvals, artifacts, dispatches, or emails are created by this service.
 */

import { PeriodCloseStatus, ReportKind, ReportLineKind, type Prisma } from '@prisma/client';
import { hashEvidence } from './reviewDecisionService';
import { createReportSnapshot } from './periodCloseService';
import type { ReportLineInput } from './periodCloseService';

export class ReportSnapshotError extends Error {
  statusCode: number;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = 'ReportSnapshotError';
    this.statusCode = statusCode;
  }
}

type TxClient = Prisma.TransactionClient;

// ─── Input types ────────────────────────────────────────────────────────────

export type MonthlyReportActor = {
  userId: string;
  role?: string;
  actorId?: string | null;
};

export type MonthlyReportInput = {
  actor: MonthlyReportActor;
  workspaceId: string;
  year: number;
  month: number;
  /** Explicit periodCloseIds to include; if omitted the service queries for the
   *  single CLOSED record for the given year/month. */
  periodCloseIds?: string[];
};

export type YearlyReportInput = {
  actor: MonthlyReportActor;
  workspaceId: string;
  year: number;
  /** Explicit periodCloseIds for all months; if omitted the service queries for
   *  all CLOSED records for the year. */
  periodCloseIds?: string[];
};

// ─── Result types ────────────────────────────────────────────────────────────

export type ReportSnapshotResult = {
  snapshotId: string;
  snapshotHash: string;
  kind: ReportKind;
  year: number;
  month: number | null;
  version: number;
  openingBalanceMinor: string;
  incomeMinor: string;
  expenseMinor: string;
  netMinor: string;
  closingBalanceMinor: string;
  transactionCount: number;
  periodCloseIds: string[];
  generatedBy: string;
  generatedAt: Date;
  lines: ReportLineInput[];
  missingMonths?: number[];
  sideEffects: {
    createsReportSnapshot: true;
    createsReportApproval: false;
    createsReportArtifact: false;
    dispatchesReport: false;
  };
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

const assertAdminActor = (actor: MonthlyReportActor) => {
  if (actor.role && actor.role !== 'admin') {
    throw new ReportSnapshotError('Alleen beheerders mogen rapporten aanmaken.', 403);
  }
};

const toBigInt = (v: bigint | number): bigint => BigInt(v);

type RawClose = {
  id: string;
  workspaceId: string;
  status: PeriodCloseStatus;
  periodStart: Date;
  periodEnd: Date;
  openingBalanceMinor: bigint;
  incomeMinor: bigint;
  expenseMinor: bigint;
  netMinor: bigint;
  closingBalanceMinor: bigint;
  transactionCount: number;
  classificationHash: string;
  sourceDataHash: string;
};

type RawBooking = {
  projectId: string;
  transactionTypeId: string;
  categoryId: string;
  literalProjectLabel: string;
  literalTypeLabel: string;
  literalCategoryLabel: string;
  amountMinor: bigint;
  direction: string;
};

/**
 * Verify all provided PeriodClose ids are CLOSED in the workspace and return
 * them in order. Throws a Dutch error for any that are not CLOSED.
 */
const loadAndValidateCloses = async (
  db: TxClient,
  workspaceId: string,
  closeIds: string[],
): Promise<RawClose[]> => {
  const closes = await db.periodClose.findMany({
    where: {
      id: { in: closeIds },
      workspaceId,
    },
    orderBy: { periodStart: 'asc' },
  });

  const foundIds = new Set(closes.map((c) => c.id));
  for (const id of closeIds) {
    if (!foundIds.has(id)) {
      throw new ReportSnapshotError(
        `Periode-afsluiting '${id}' niet gevonden in werkruimte.`,
        404,
      );
    }
  }

  const nonClosed = closes.filter((c) => c.status !== PeriodCloseStatus.CLOSED);
  if (nonClosed.length > 0) {
    const descriptions = nonClosed
      .map((c) => `${c.id} (status: ${c.status})`)
      .join(', ');
    throw new ReportSnapshotError(
      `Alleen gesloten periodes kunnen worden opgenomen in een rapport. ` +
      `De volgende periodes zijn niet gesloten: ${descriptions}`,
    );
  }

  return closes;
};

/**
 * Build report lines from TransactionBooking records in a set of closed periods.
 *
 * Lines are grouped by (projectId, transactionTypeId, categoryId, direction) and
 * include literal Klant/Type/Category labels. This provides the CATEGORY-level
 * breakdown required by REPORT-001.
 */
const buildReportLines = async (
  db: TxClient,
  closes: RawClose[],
  actor: MonthlyReportActor,
): Promise<ReportLineInput[]> => {
  if (closes.length === 0) return [];

  // Determine overall date range
  const periodStart = closes[0].periodStart;
  const periodEnd = closes[closes.length - 1].periodEnd;

  // Load all booked transactions in the date range via TransactionBooking
  const bookings = await db.transactionBooking.findMany({
    where: {
      workspaceId: closes[0].workspaceId,
      transaction: {
        userId: actor.userId,
        date: {
          gte: periodStart,
          lte: periodEnd,
        },
      },
    },
    select: {
      projectId: true,
      transactionTypeId: true,
      categoryId: true,
      literalProjectLabel: true,
      literalTypeLabel: true,
      literalCategoryLabel: true,
      transaction: {
        select: {
          amountMinor: true,
          direction: true,
        },
      },
    },
  });

  // Group by (project, type, category, direction)
  type LineKey = string;
  type LineAcc = {
    projectId: string;
    transactionTypeId: string;
    categoryId: string;
    literalProjectLabel: string;
    literalTypeLabel: string;
    literalCategoryLabel: string;
    direction: 'credit' | 'debit';
    amountMinor: bigint;
    transactionCount: number;
  };

  const lineMap = new Map<LineKey, LineAcc>();

  for (const b of bookings) {
    const dir = b.transaction.direction as 'credit' | 'debit';
    const key = [b.projectId, b.transactionTypeId, b.categoryId, dir].join('\x00');
    const existing = lineMap.get(key);
    const amount = toBigInt(b.transaction.amountMinor);
    if (existing) {
      existing.amountMinor += amount;
      existing.transactionCount += 1;
    } else {
      lineMap.set(key, {
        projectId: b.projectId,
        transactionTypeId: b.transactionTypeId,
        categoryId: b.categoryId,
        literalProjectLabel: b.literalProjectLabel,
        literalTypeLabel: b.literalTypeLabel,
        literalCategoryLabel: b.literalCategoryLabel,
        direction: dir,
        amountMinor: amount,
        transactionCount: 1,
      });
    }
  }

  // Sort deterministically: project → type → category → direction
  const sorted = Array.from(lineMap.values()).sort((a, b) => {
    const pc = a.literalProjectLabel.localeCompare(b.literalProjectLabel, 'nl');
    if (pc !== 0) return pc;
    const tc = a.literalTypeLabel.localeCompare(b.literalTypeLabel, 'nl');
    if (tc !== 0) return tc;
    const cc = a.literalCategoryLabel.localeCompare(b.literalCategoryLabel, 'nl');
    if (cc !== 0) return cc;
    return a.direction < b.direction ? -1 : a.direction > b.direction ? 1 : 0;
  });

  return sorted.map((acc, index) => ({
    lineKind: ReportLineKind.CATEGORY,
    projectId: acc.projectId,
    transactionTypeId: acc.transactionTypeId,
    categoryId: acc.categoryId,
    literalProjectLabel: acc.literalProjectLabel,
    literalTypeLabel: acc.literalTypeLabel,
    literalCategoryLabel: acc.literalCategoryLabel,
    direction: acc.direction,
    amountMinor: acc.amountMinor,
    transactionCount: acc.transactionCount,
    sortOrder: index + 1,
  }));
};

/**
 * Sum totals across a set of closes.
 */
const sumCloseTotals = (closes: RawClose[]) => {
  let opening = 0n;
  let income = 0n;
  let expense = 0n;
  let txCount = 0;

  for (let i = 0; i < closes.length; i++) {
    const c = closes[i];
    if (i === 0) opening = toBigInt(c.openingBalanceMinor);
    income += toBigInt(c.incomeMinor);
    expense += toBigInt(c.expenseMinor);
    txCount += c.transactionCount;
  }

  const net = income - expense;
  const closing = opening + net;

  return {
    openingBalanceMinor: opening,
    incomeMinor: income,
    expenseMinor: expense,
    netMinor: net,
    closingBalanceMinor: closing,
    transactionCount: txCount,
  };
};

// ─── REPORT-001: Monthly report snapshot ─────────────────────────────────────

/**
 * Query the single CLOSED PeriodClose for a given workspace/year/month.
 * Returns null if no CLOSED close exists for this period.
 */
const findMonthlyClose = async (
  db: TxClient,
  workspaceId: string,
  year: number,
  month: number,
): Promise<RawClose | null> => {
  const periodStart = new Date(Date.UTC(year, month - 1, 1));
  const periodEnd = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));

  return db.periodClose.findFirst({
    where: {
      workspaceId,
      status: PeriodCloseStatus.CLOSED,
      periodStart: { gte: periodStart },
      periodEnd: { lte: periodEnd },
    },
    orderBy: { version: 'desc' },
  });
};

export const generateMonthlyReportSnapshot = async (
  db: TxClient,
  input: MonthlyReportInput,
): Promise<ReportSnapshotResult> => {
  assertAdminActor(input.actor);

  // Resolve close IDs
  let closeIds = input.periodCloseIds ?? [];
  if (!closeIds.length) {
    const found = await findMonthlyClose(db, input.workspaceId, input.year, input.month);
    if (!found) {
      throw new ReportSnapshotError(
        `Geen gesloten periode gevonden voor ${input.year}-${String(input.month).padStart(2, '0')}. ` +
        `Sluit de periode eerst af voordat u een rapport aanmaakt.`,
        422,
      );
    }
    closeIds = [found.id];
  }

  const closes = await loadAndValidateCloses(db, input.workspaceId, closeIds);

  // Validate all closes fall within the given month
  for (const c of closes) {
    const closeYear = c.periodStart.getUTCFullYear();
    const closeMonth = c.periodStart.getUTCMonth() + 1;
    if (closeYear !== input.year || closeMonth !== input.month) {
      throw new ReportSnapshotError(
        `Periode-afsluiting '${c.id}' valt buiten ${input.year}-${String(input.month).padStart(2, '0')}.`,
      );
    }
  }

  const totals = sumCloseTotals(closes);
  const lines = await buildReportLines(db, closes, input.actor);

  // Reject if a snapshot already exists for this period/version to prevent
  // unintended duplicates (schema unique constraint enforces workspace/kind/year/month/version).
  const existingVersion = await db.reportSnapshot.findFirst({
    where: {
      workspaceId: input.workspaceId,
      kind: ReportKind.MONTHLY,
      year: input.year,
      month: input.month,
    },
    orderBy: { version: 'desc' },
    select: { version: true },
  });
  const version = existingVersion ? existingVersion.version + 1 : 1;

  const snapshot = await createReportSnapshot(db, {
    workspaceId: input.workspaceId,
    kind: ReportKind.MONTHLY,
    year: input.year,
    month: input.month,
    version,
    ...totals,
    generatedBy: input.actor.actorId ?? input.actor.userId,
    periodCloseIds: closes.map((c) => c.id),
    lines,
  });

  return {
    snapshotId: snapshot.id,
    snapshotHash: snapshot.snapshotHash,
    kind: ReportKind.MONTHLY,
    year: input.year,
    month: input.month,
    version,
    openingBalanceMinor: totals.openingBalanceMinor.toString(),
    incomeMinor: totals.incomeMinor.toString(),
    expenseMinor: totals.expenseMinor.toString(),
    netMinor: totals.netMinor.toString(),
    closingBalanceMinor: totals.closingBalanceMinor.toString(),
    transactionCount: totals.transactionCount,
    periodCloseIds: closes.map((c) => c.id),
    generatedBy: input.actor.actorId ?? input.actor.userId,
    generatedAt: snapshot.generatedAt,
    lines,
    sideEffects: {
      createsReportSnapshot: true,
      createsReportApproval: false,
      createsReportArtifact: false,
      dispatchesReport: false,
    },
  };
};

// ─── REPORT-002: Yearly report snapshot ──────────────────────────────────────

/**
 * Find all CLOSED PeriodClose records for a full calendar year (Jan–Dec).
 */
const findYearlyCloses = async (
  db: TxClient,
  workspaceId: string,
  year: number,
): Promise<RawClose[]> => {
  const yearStart = new Date(Date.UTC(year, 0, 1));
  const yearEnd = new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999));

  return db.periodClose.findMany({
    where: {
      workspaceId,
      status: PeriodCloseStatus.CLOSED,
      periodStart: { gte: yearStart },
      periodEnd: { lte: yearEnd },
    },
    orderBy: { periodStart: 'asc' },
  });
};

const getMonthFromDate = (d: Date): number => d.getUTCMonth() + 1;

export const generateYearlyReportSnapshot = async (
  db: TxClient,
  input: YearlyReportInput,
): Promise<ReportSnapshotResult> => {
  assertAdminActor(input.actor);

  // Resolve close IDs
  let closes: RawClose[];
  if (input.periodCloseIds?.length) {
    closes = await loadAndValidateCloses(db, input.workspaceId, input.periodCloseIds);
  } else {
    closes = await findYearlyCloses(db, input.workspaceId, input.year);
  }

  if (!closes.length) {
    throw new ReportSnapshotError(
      `Geen gesloten periodes gevonden voor jaar ${input.year}. ` +
      `Sluit minimaal één maand af voordat u een jaarrapport aanmaakt.`,
      422,
    );
  }

  // Determine which months are closed and which are missing
  const closedMonths = new Set(closes.map((c) => getMonthFromDate(c.periodStart)));
  const missingMonths: number[] = [];
  for (let m = 1; m <= 12; m++) {
    if (!closedMonths.has(m)) missingMonths.push(m);
  }

  const totals = sumCloseTotals(closes);
  const lines = await buildReportLines(db, closes, input.actor);

  // Version: find highest existing version for this year
  const existingVersion = await db.reportSnapshot.findFirst({
    where: {
      workspaceId: input.workspaceId,
      kind: ReportKind.YEARLY,
      year: input.year,
    },
    orderBy: { version: 'desc' },
    select: { version: true },
  });
  const version = existingVersion ? existingVersion.version + 1 : 1;

  const snapshot = await createReportSnapshot(db, {
    workspaceId: input.workspaceId,
    kind: ReportKind.YEARLY,
    year: input.year,
    month: null,
    version,
    ...totals,
    generatedBy: input.actor.actorId ?? input.actor.userId,
    periodCloseIds: closes.map((c) => c.id),
    lines,
  });

  return {
    snapshotId: snapshot.id,
    snapshotHash: snapshot.snapshotHash,
    kind: ReportKind.YEARLY,
    year: input.year,
    month: null,
    version,
    openingBalanceMinor: totals.openingBalanceMinor.toString(),
    incomeMinor: totals.incomeMinor.toString(),
    expenseMinor: totals.expenseMinor.toString(),
    netMinor: totals.netMinor.toString(),
    closingBalanceMinor: totals.closingBalanceMinor.toString(),
    transactionCount: totals.transactionCount,
    periodCloseIds: closes.map((c) => c.id),
    generatedBy: input.actor.actorId ?? input.actor.userId,
    generatedAt: snapshot.generatedAt,
    lines,
    missingMonths,
    sideEffects: {
      createsReportSnapshot: true,
      createsReportApproval: false,
      createsReportArtifact: false,
      dispatchesReport: false,
    },
  };
};

// ─── REPORT-003: Operating vs transfer presentation classification ─────────────

/**
 * Reporting classification for operating vs non-operating presentation.
 *
 * These labels match the historical Dutch taxonomy from PHILOSOPHY.md:
 * - OPERATING: ordinary income/expense transactions
 * - TRANSFER: internal transfers and savings movements
 * - DEPOSIT: deposits and returned deposits
 * - REFUND: refunds and reversals
 * - RESTRICTED: restricted-purpose receipts and payments
 */
export type ReportLinePresentation = 'OPERATING' | 'TRANSFER' | 'DEPOSIT' | 'REFUND' | 'RESTRICTED';

export type ClassifiedReportLine = ReportLineInput & {
  presentation: ReportLinePresentation;
};

/**
 * Deterministically classify a report line as operating, transfer, deposit,
 * refund, or restricted based on the literal Dutch category/type labels.
 *
 * This classification is presentation-only: it never removes money from reports.
 * All lines remain drilldown-visible regardless of classification.
 *
 * The classification uses keyword matching on the literal historical labels
 * as preserved in the administration (PHILOSOPHY.md section on accounting treatment).
 */
export const classifyReportLinePresentation = (
  literalTypeLabel: string | null | undefined,
  literalCategoryLabel: string | null | undefined,
): ReportLinePresentation => {
  const type = (literalTypeLabel ?? '').toLowerCase();
  const cat = (literalCategoryLabel ?? '').toLowerCase();
  const combined = `${type} ${cat}`;

  // Transfer / savings keywords (Dutch: Spaarrekening, kruispost, internal transfer)
  if (
    combined.includes('spaarrekening') ||
    combined.includes('kruispost') ||
    combined.includes('overboeking') ||
    type.includes('spaarrekening') ||
    type.includes('kruispost')
  ) {
    return 'TRANSFER';
  }

  // Deposit keywords (Dutch: storting, borg, depot, waarborgsom)
  if (
    combined.includes('storting') ||
    combined.includes('waarborgsom') ||
    combined.includes('borg') ||
    combined.includes('depot')
  ) {
    return 'DEPOSIT';
  }

  // Refund / reversal keywords (Dutch: teruggave, terugboeking, stornering, restitutie)
  if (
    combined.includes('teruggave') ||
    combined.includes('terugboeking') ||
    combined.includes('stornering') ||
    combined.includes('restitutie') ||
    combined.includes('refund') ||
    combined.includes('terugbetaling')
  ) {
    return 'REFUND';
  }

  return 'OPERATING';
};

/**
 * Apply presentation classification to a list of report lines.
 *
 * Operating subtotals exclude TRANSFER, DEPOSIT, REFUND, and RESTRICTED lines.
 * Grand totals always include all lines — no money disappears.
 */
export const classifyReportLines = (lines: ReportLineInput[]): ClassifiedReportLine[] =>
  lines.map((line) => ({
    ...line,
    presentation: classifyReportLinePresentation(line.literalTypeLabel, line.literalCategoryLabel),
  }));

// ─── REPORT-001b: Live monthly report snapshot (no period close required) ────

/**
 * Generate a monthly report snapshot from live transaction/booking data, without
 * requiring any PeriodClose records to be CLOSED first.
 *
 * All transactions in the month must have a TransactionBooking in the workspace;
 * unbooked transactions cause a 422 error with a Dutch message.
 *
 * The opening balance is taken from the most recent CLOSED PeriodClose whose
 * periodEnd falls before this month. If none exists, opening balance = 0.
 *
 * periodCloseLinks are NOT created (live snapshot has no period close evidence).
 */
export const generateLiveMonthlyReportSnapshot = async (
  db: TxClient,
  input: MonthlyReportInput,
): Promise<ReportSnapshotResult> => {
  assertAdminActor(input.actor);

  const periodStart = new Date(Date.UTC(input.year, input.month - 1, 1));
  const periodEnd = new Date(Date.UTC(input.year, input.month, 0, 23, 59, 59, 999));

  // Step 1: All transactions for the month belonging to this user
  const transactions = await db.transaction.findMany({
    where: {
      userId: input.actor.userId,
      date: { gte: periodStart, lte: periodEnd },
    },
    select: { id: true, amountMinor: true, direction: true },
    orderBy: { date: 'asc' },
  });

  // Step 2: All bookings for those transactions in this workspace
  const bookings = await db.transactionBooking.findMany({
    where: {
      workspaceId: input.workspaceId,
      transactionId: { in: transactions.map((t) => t.id) },
    },
    select: {
      transactionId: true,
      projectId: true,
      transactionTypeId: true,
      categoryId: true,
      literalProjectLabel: true,
      literalTypeLabel: true,
      literalCategoryLabel: true,
      transaction: { select: { amountMinor: true, direction: true } },
    },
  });

  // Step 3: Every transaction must be booked
  if (bookings.length !== transactions.length) {
    const monthLabel = `${input.year}-${String(input.month).padStart(2, '0')}`;
    throw new ReportSnapshotError(
      `Er zijn ${transactions.length - bookings.length} ongeboekte transacties in ${monthLabel}. Alle transacties moeten geboekt zijn.`,
      422,
    );
  }

  // Step 4: Compute totals directly from transactions
  let income = 0n;
  let expense = 0n;
  for (const t of transactions) {
    const amount = toBigInt(t.amountMinor);
    if (t.direction === 'credit') {
      income += amount;
    } else {
      expense += amount;
    }
  }
  const net = income - expense;

  // Opening balance: most recent CLOSED PeriodClose ending before this month
  const precedingClose = await db.periodClose.findFirst({
    where: {
      workspaceId: input.workspaceId,
      status: 'CLOSED',
      periodEnd: { lt: periodStart },
    },
    orderBy: { periodEnd: 'desc' },
    select: { closingBalanceMinor: true },
  });
  const opening = precedingClose ? toBigInt(precedingClose.closingBalanceMinor) : 0n;
  const closing = opening + net;

  const totals = {
    openingBalanceMinor: opening,
    incomeMinor: income,
    expenseMinor: expense,
    netMinor: net,
    closingBalanceMinor: closing,
    transactionCount: transactions.length,
  };

  // Step 5: Build report lines from bookings
  type LineKey = string;
  type LineAcc = {
    projectId: string;
    transactionTypeId: string;
    categoryId: string;
    literalProjectLabel: string;
    literalTypeLabel: string;
    literalCategoryLabel: string;
    direction: 'credit' | 'debit';
    amountMinor: bigint;
    transactionCount: number;
  };

  const lineMap = new Map<LineKey, LineAcc>();

  for (const b of bookings) {
    const dir = b.transaction.direction as 'credit' | 'debit';
    const key = [b.projectId, b.transactionTypeId, b.categoryId, dir].join('\x00');
    const existing = lineMap.get(key);
    const amount = toBigInt(b.transaction.amountMinor);
    if (existing) {
      existing.amountMinor += amount;
      existing.transactionCount += 1;
    } else {
      lineMap.set(key, {
        projectId: b.projectId,
        transactionTypeId: b.transactionTypeId,
        categoryId: b.categoryId,
        literalProjectLabel: b.literalProjectLabel,
        literalTypeLabel: b.literalTypeLabel,
        literalCategoryLabel: b.literalCategoryLabel,
        direction: dir,
        amountMinor: amount,
        transactionCount: 1,
      });
    }
  }

  const sortedLineAccs = Array.from(lineMap.values()).sort((a, b) => {
    const pc = a.literalProjectLabel.localeCompare(b.literalProjectLabel, 'nl');
    if (pc !== 0) return pc;
    const tc = a.literalTypeLabel.localeCompare(b.literalTypeLabel, 'nl');
    if (tc !== 0) return tc;
    const cc = a.literalCategoryLabel.localeCompare(b.literalCategoryLabel, 'nl');
    if (cc !== 0) return cc;
    return a.direction < b.direction ? -1 : a.direction > b.direction ? 1 : 0;
  });

  const lines: ReportLineInput[] = sortedLineAccs.map((acc, index) => ({
    lineKind: ReportLineKind.CATEGORY,
    projectId: acc.projectId,
    transactionTypeId: acc.transactionTypeId,
    categoryId: acc.categoryId,
    literalProjectLabel: acc.literalProjectLabel,
    literalTypeLabel: acc.literalTypeLabel,
    literalCategoryLabel: acc.literalCategoryLabel,
    direction: acc.direction,
    amountMinor: acc.amountMinor,
    transactionCount: acc.transactionCount,
    sortOrder: index + 1,
  }));

  // Step 6: Determine version
  const existingVersion = await db.reportSnapshot.findFirst({
    where: {
      workspaceId: input.workspaceId,
      kind: ReportKind.MONTHLY,
      year: input.year,
      month: input.month,
    },
    orderBy: { version: 'desc' },
    select: { version: true },
  });
  const version = existingVersion ? existingVersion.version + 1 : 1;

  // Step 7: Compute snapshot hash
  const snapshotHash = hashEvidence({
    kind: ReportKind.MONTHLY,
    year: input.year,
    month: input.month,
    version,
    periodCloseIds: [],
    totals: {
      openingBalanceMinor: totals.openingBalanceMinor,
      incomeMinor: totals.incomeMinor,
      expenseMinor: totals.expenseMinor,
      netMinor: totals.netMinor,
      closingBalanceMinor: totals.closingBalanceMinor,
    },
    transactionCount: totals.transactionCount,
    lines,
  });

  // Step 8: Write snapshot directly (no periodCloseLinks)
  const snapshot = await db.reportSnapshot.create({
    data: {
      workspaceId: input.workspaceId,
      kind: ReportKind.MONTHLY,
      year: input.year,
      month: input.month,
      version,
      openingBalanceMinor: totals.openingBalanceMinor,
      incomeMinor: totals.incomeMinor,
      expenseMinor: totals.expenseMinor,
      netMinor: totals.netMinor,
      closingBalanceMinor: totals.closingBalanceMinor,
      transactionCount: totals.transactionCount,
      snapshotHash,
      generatedBy: input.actor.actorId ?? input.actor.userId,
      lines: lines.length ? {
        create: lines.map((line) => ({
          lineKind: line.lineKind,
          projectId: line.projectId ?? null,
          transactionTypeId: line.transactionTypeId ?? null,
          categoryId: line.categoryId ?? null,
          literalProjectLabel: line.literalProjectLabel ?? null,
          literalTypeLabel: line.literalTypeLabel ?? null,
          literalCategoryLabel: line.literalCategoryLabel ?? null,
          direction: line.direction ?? null,
          reportingClass: line.reportingClass ?? null,
          amountMinor: line.amountMinor,
          transactionCount: line.transactionCount,
          sortOrder: line.sortOrder,
        })),
      } : undefined,
      // No periodCloseLinks — live snapshot
    },
  });

  return {
    snapshotId: snapshot.id,
    snapshotHash: snapshot.snapshotHash,
    kind: ReportKind.MONTHLY,
    year: input.year,
    month: input.month,
    version,
    openingBalanceMinor: totals.openingBalanceMinor.toString(),
    incomeMinor: totals.incomeMinor.toString(),
    expenseMinor: totals.expenseMinor.toString(),
    netMinor: totals.netMinor.toString(),
    closingBalanceMinor: totals.closingBalanceMinor.toString(),
    transactionCount: totals.transactionCount,
    periodCloseIds: [],
    generatedBy: input.actor.actorId ?? input.actor.userId,
    generatedAt: snapshot.generatedAt,
    lines,
    sideEffects: {
      createsReportSnapshot: true,
      createsReportApproval: false,
      createsReportArtifact: false,
      dispatchesReport: false,
    },
  };
};

/**
 * Compute operating subtotals (OPERATING-class only) and grand totals (all classes).
 * Returns both so callers can show both in reports.
 */
export const computePresentationTotals = (classifiedLines: ClassifiedReportLine[]) => {
  let operatingIncome = 0n;
  let operatingExpense = 0n;
  let grandIncome = 0n;
  let grandExpense = 0n;
  let operatingCount = 0;
  let grandCount = 0;

  for (const line of classifiedLines) {
    const amount = toBigInt(line.amountMinor);
    grandCount += line.transactionCount;
    if (line.direction === 'credit') {
      grandIncome += amount;
      if (line.presentation === 'OPERATING') {
        operatingIncome += amount;
        operatingCount += line.transactionCount;
      }
    } else {
      grandExpense += amount;
      if (line.presentation === 'OPERATING') {
        operatingExpense += amount;
        operatingCount += line.transactionCount;
      }
    }
  }

  return {
    operating: {
      incomeMinor: operatingIncome.toString(),
      expenseMinor: operatingExpense.toString(),
      netMinor: (operatingIncome - operatingExpense).toString(),
      transactionCount: operatingCount,
    },
    grand: {
      incomeMinor: grandIncome.toString(),
      expenseMinor: grandExpense.toString(),
      netMinor: (grandIncome - grandExpense).toString(),
      transactionCount: grandCount,
    },
  };
};
