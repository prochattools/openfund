import { describe, expect, it } from 'vitest';
import { buildImportMessage } from '../../server/routes/upload';

describe('upload route import message', () => {
  it('builds a complete Dutch success message with all counters', () => {
    const message = buildImportMessage({
      importedCount: 3,
      autoCategorizedCount: 2,
      pendingReviewCount: 1,
      duplicateCount: 4,
      errorCount: 5,
    });

    expect(message).toBe(
      'Import voltooid. 3 transacties toegevoegd. 2 transacties automatisch gecategoriseerd. 1 transactie staat klaar om te beoordelen. 4 dubbele transacties genegeerd. 5 rijen konden niet worden verwerkt.',
    );
  });

  it('uses singular Dutch labels for one-count summaries', () => {
    const message = buildImportMessage({
      importedCount: 1,
      autoCategorizedCount: 1,
      pendingReviewCount: 1,
      duplicateCount: 1,
      errorCount: 1,
    });

    expect(message).toBe(
      'Import voltooid. 1 transactie toegevoegd. 1 transactie automatisch gecategoriseerd. 1 transactie staat klaar om te beoordelen. 1 dubbele transactie genegeerd. 1 rij kon niet worden verwerkt.',
    );
  });

  it('omits zero-count optional sections', () => {
    const message = buildImportMessage({
      importedCount: 0,
      autoCategorizedCount: 0,
      pendingReviewCount: 0,
      duplicateCount: 0,
      errorCount: 0,
    });

    expect(message).toBe('Import voltooid. 0 transacties toegevoegd.');
  });
});
