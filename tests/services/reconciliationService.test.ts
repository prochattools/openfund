import { describe, expect, it } from 'vitest';
import { extractStatementBalance } from '../../server/services/reconciliationService';

describe('reconciliation service', () => {
  it('extracts ING resulting balance from the raw imported row', () => {
    const balance = extractStatementBalance({
      'Resulting balance': '12.345,67',
    });

    expect(balance).toBe(1234567n);
  });

  it('extracts ING resulting balance from normalized raw row columns', () => {
    const balance = extractStatementBalance({
      columns: {
        'Resulting balance': '987,65',
      },
    });

    expect(balance).toBe(98765n);
  });
});
