import { describe, expect, it } from 'vitest';
import { compareHistoricalFactualDirections } from '../../server/services/historicalDirectionCompatibilityService';

describe('compareHistoricalFactualDirections', () => {
  it('only accepts equal factual directions', () => {
    expect(compareHistoricalFactualDirections('credit', 'credit')).toEqual({ compatible: true, reason: 'COMPATIBLE' });
    expect(compareHistoricalFactualDirections('debit', 'credit')).toEqual({ compatible: false, reason: 'OPPOSITE_DIRECTION' });
  });

  it('returns explicit abstention reasons for missing factual directions', () => {
    expect(compareHistoricalFactualDirections(null, 'credit').reason).toBe('MISSING_SOURCE_DIRECTION');
    expect(compareHistoricalFactualDirections('credit', undefined).reason).toBe('MISSING_TARGET_DIRECTION');
  });
});
