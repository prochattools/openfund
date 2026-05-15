import { describe, expect, it } from 'vitest';
import {
  buildDutchImportMessage,
  getImportFeedbackCounts,
  getImportFeedbackMessage,
} from '../../src/helpers/import-feedback';

describe('import feedback helpers', () => {
  it('normalizes import feedback counts from old and new response fields', () => {
    expect(getImportFeedbackCounts({
      importedCount: 2,
      autoCategorizedCount: 1,
      pendingReviewCount: 3,
      duplicateCount: 4,
      errorCount: 5,
    })).toEqual({
      imported: 2,
      auto: 1,
      review: 3,
      duplicates: 4,
      errors: 5,
    });

    expect(getImportFeedbackCounts({
      importedCount: 1,
      autoCategorized: 2,
      reviewCount: 3,
    })).toMatchObject({ auto: 2, review: 3 });
  });

  it('builds Dutch fallback import feedback with singular wording', () => {
    expect(buildDutchImportMessage({
      importedCount: 1,
      autoCategorized: 1,
      reviewCount: 1,
      duplicateCount: 1,
      errorCount: 1,
    })).toBe('Import voltooid. 1 transactie toegevoegd. 1 automatisch gecategoriseerd. 1 te beoordelen. 1 dubbele transactie genegeerd. 1 rij overgeslagen.');
  });

  it('builds Dutch fallback import feedback with plural wording and omits zero sections', () => {
    expect(buildDutchImportMessage({
      importedCount: 2,
      autoCategorized: 0,
      reviewCount: 4,
      duplicateCount: 0,
      errorCount: 3,
    })).toBe('Import voltooid. 2 transacties toegevoegd. 4 te beoordelen. 3 rijen overgeslagen.');
  });

  it('preserves server-provided Dutch messages', () => {
    expect(getImportFeedbackMessage({ importedCount: 0, message: 'Servermelding.' })).toBe('Servermelding.');
    expect(getImportFeedbackMessage({ importedCount: 0 })).toBe('Import voltooid. 0 transacties toegevoegd.');
  });
});
