import { createHash } from 'node:crypto';

export type DeliveryKeyInput = {
  workspaceId: string;
  kind: 'MONTHLY' | 'YEARLY';
  year: number;
  month: number | null;
  periodCloses: Array<{ id: string; version: number }>;
  recipientHash: string;
};

/**
 * Computes a stable delivery key that uniquely identifies a report dispatch intent.
 *
 * The key is derived from:
 * - workspace ID (scopes to tenant)
 * - report kind (MONTHLY or YEARLY)
 * - year and month (time period)
 * - sorted PeriodClose records with their versions (immutable evidence)
 * - recipient hash (who receives it)
 *
 * The key does NOT include snapshot ID, snapshot version, artifact IDs, or content hashes.
 * Those are byproducts of the dispatch. If the same month, same closed periods, and same
 * recipients are delivered again, the key will match and the dispatch will be rejected as a duplicate.
 *
 * If a period is reopened and re-closed, its version increments, producing a new key.
 * If recipients change, the hash changes, producing a new key. Both behaviors are correct.
 */
export function computeDeliveryKey(input: DeliveryKeyInput): string {
  const { workspaceId, kind, year, month, periodCloses, recipientHash } = input;

  // Sort period closes deterministically by ID for consistent hashing
  const sortedCloses = [...periodCloses].sort((a, b) => a.id.localeCompare(b.id));

  const evidence = {
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

  const evidenceJson = JSON.stringify(evidence, null, 2);
  const deliveryKey = createHash('sha256').update(evidenceJson, 'utf-8').digest('hex');

  return deliveryKey;
}
