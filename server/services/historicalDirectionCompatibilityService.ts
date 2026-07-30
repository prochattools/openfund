import type { TransactionDirection } from '@prisma/client';

export type HistoricalDirectionCompatibilityReason =
  | 'COMPATIBLE'
  | 'MISSING_SOURCE_DIRECTION'
  | 'MISSING_TARGET_DIRECTION'
  | 'OPPOSITE_DIRECTION';

export type HistoricalDirectionCompatibility = {
  compatible: boolean;
  reason: HistoricalDirectionCompatibilityReason;
};

const isDirection = (value: unknown): value is TransactionDirection =>
  value === 'credit' || value === 'debit';

/**
 * Historical Type labels are direction-neutral classifications. Compatibility is
 * exclusively a comparison of immutable factual bank directions.
 */
export const compareHistoricalFactualDirections = (
  sourceDirection: TransactionDirection | null | undefined,
  targetDirection: TransactionDirection | null | undefined,
): HistoricalDirectionCompatibility => {
  if (!isDirection(sourceDirection)) return { compatible: false, reason: 'MISSING_SOURCE_DIRECTION' };
  if (!isDirection(targetDirection)) return { compatible: false, reason: 'MISSING_TARGET_DIRECTION' };
  if (sourceDirection !== targetDirection) return { compatible: false, reason: 'OPPOSITE_DIRECTION' };
  return { compatible: true, reason: 'COMPATIBLE' };
};
