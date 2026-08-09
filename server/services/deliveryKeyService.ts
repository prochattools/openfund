import { createHash } from 'node:crypto';

export type DeliveryKeyInput = {
  workspaceId: string;
  kind: 'MONTHLY' | 'YEARLY';
  year: number;
  month: number | null;
  periodCloses: Array<{ id: string; version: number }>;
  recipientHash: string;
  /** When present (live path), replaces periodClosesEvidence in the key. */
  reportEvidenceHash?: string;
};

/**
 * Computes a stable delivery key for legacy/idempotent report-dispatch callers.
 *
 * Closed-period mode derives the key from workspace, report kind, year/month,
 * sorted PeriodClose IDs + versions, and recipientHash.
 *
 * Live-evidence mode (for callers that still opt into content idempotency) replaces
 * PeriodClose evidence with reportEvidenceHash plus recipientHash. The evidence hash
 * should exclude generated IDs/timestamps so unchanged report content remains stable.
 *
 * Monthly e-mail sending no longer uses this helper as a user-facing resend restriction:
 * each explicit send attempt is keyed to its fresh immutable snapshot/dispatch attempt.
 */
export function computeDeliveryKey(input: DeliveryKeyInput): string {
  const { workspaceId, kind, year, month, periodCloses, recipientHash } = input;

  let evidence: object;

  if (input.reportEvidenceHash !== undefined) {
    // Live path: key is derived from the snapshot content hash, not period closes
    evidence = {
      workspaceId,
      kind,
      year,
      month,
      reportEvidenceHash: input.reportEvidenceHash,
      recipientHash,
    };
  } else {
    // Existing path: key is derived from sorted period closes with versions
    const sortedCloses = [...periodCloses].sort((a, b) => a.id.localeCompare(b.id));
    evidence = {
      workspaceId,
      kind,
      year,
      month,
      periodClosesEvidence: sortedCloses.map((c) => ({
        id: c.id,
        version: c.version,
      })),
      recipientHash,
    };
  }

  const evidenceJson = JSON.stringify(evidence, null, 2);
  const deliveryKey = createHash('sha256').update(evidenceJson, 'utf-8').digest('hex');

  return deliveryKey;
}

/**
 * Compute a stable content hash for a report snapshot (independent of snapshot ID or version).
 *
 * Used on the live path to derive a delivery key that is tied to what the report contains
 * rather than which period closes were used to generate it.
 */
export function computeReportEvidenceHash(snapshot: {
  kind: string;
  year: number;
  month: number | null;
  openingBalanceMinor: string | bigint;
  incomeMinor: string | bigint;
  expenseMinor: string | bigint;
  netMinor: string | bigint;
  closingBalanceMinor: string | bigint;
  transactionCount: number;
  lines: Array<{
    lineKind: string;
    projectId?: string | null;
    transactionTypeId?: string | null;
    categoryId?: string | null;
    literalProjectLabel?: string | null;
    literalTypeLabel?: string | null;
    literalCategoryLabel?: string | null;
    direction?: string | null;
    amountMinor: string | bigint;
    transactionCount: number;
    sortOrder: number;
  }>;
}): string {
  const sorted = [...snapshot.lines].sort((a, b) => a.sortOrder - b.sortOrder);
  const evidence = {
    kind: snapshot.kind,
    year: snapshot.year,
    month: snapshot.month,
    openingBalanceMinor: String(snapshot.openingBalanceMinor),
    incomeMinor: String(snapshot.incomeMinor),
    expenseMinor: String(snapshot.expenseMinor),
    netMinor: String(snapshot.netMinor),
    closingBalanceMinor: String(snapshot.closingBalanceMinor),
    transactionCount: snapshot.transactionCount,
    lines: sorted.map((l) => ({
      lineKind: l.lineKind,
      projectId: l.projectId ?? null,
      transactionTypeId: l.transactionTypeId ?? null,
      categoryId: l.categoryId ?? null,
      literalProjectLabel: l.literalProjectLabel ?? null,
      literalTypeLabel: l.literalTypeLabel ?? null,
      literalCategoryLabel: l.literalCategoryLabel ?? null,
      direction: l.direction ?? null,
      amountMinor: String(l.amountMinor),
      transactionCount: l.transactionCount,
      sortOrder: l.sortOrder,
    })),
  };
  return createHash('sha256').update(JSON.stringify(evidence), 'utf-8').digest('hex');
}
