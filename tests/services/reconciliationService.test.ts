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

  it('extracts Dutch Saldo and generic Balance fields', () => {
    expect(extractStatementBalance({ Saldo: '1.234,56' })).toBe(123456n);
    expect(extractStatementBalance({ columns: { Balance: '432.10' } })).toBe(43210n);
  });

  it('returns null for invalid or missing statement balance data', () => {
    expect(extractStatementBalance(null)).toBeNull();
    expect(extractStatementBalance([] as any)).toBeNull();
    expect(extractStatementBalance({ columns: { Other: '123,45' } })).toBeNull();
    expect(extractStatementBalance({ 'Resulting balance': 'geen bedrag' })).toBeNull();
  });
});