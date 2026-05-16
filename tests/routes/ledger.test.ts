import { describe, expect, it } from 'vitest';
import {
  buildLedgerSummary,
  extractCounterpartyAccount,
  extractNotificationDetail,
  getSignedLedgerAmount,
  isPlainObject,
  readLedgerRawValue,
  serializeLedgerSnapshot,
} from '../../server/routes/ledger';

describe('ledger route helpers', () => {
  it('detects plain objects and reads raw ING values from direct and column fields', () => {
    expect(isPlainObject({})).toBe(true);
    expect(isPlainObject(null)).toBe(false);
    expect(isPlainObject([])).toBe(false);
    expect(readLedgerRawValue({ Notifications: 'Direct detail' }, 'Notifications')).toBe('Direct detail');
    expect(readLedgerRawValue({ columns: { Notifications: 'Column detail' } }, 'Notifications')).toBe('Column detail');
    expect(readLedgerRawValue({ columns: { Notifications: 123 } }, 'Notifications')).toBeNull();
  });

  it('extracts cleaned notification details and counterparty accounts from raw rows', () => {
    expect(extractNotificationDetail({ Notifications: 'Name: Yeshua Academy gift' })).toBe('Yeshua Academy gift');
    expect(extractNotificationDetail({ Notification: '  ' })).toBeNull();
    expect(extractNotificationDetail({ columns: { notifications: 'Column notification' } })).toBe('Column notification');
    expect(extractCounterpartyAccount({ Counterparty: ' NL12BANK0123456789 ' })).toBe('NL12BANK0123456789');
    expect(extractCounterpartyAccount({ columns: { counterparty: ' NL99BANK ' } })).toBe('NL99BANK');
    expect(extractCounterpartyAccount({ Counterparty: '   ' })).toBeNull();
  });

  it('calculates signed ledger amounts from debit and credit minor units', () => {
    expect(getSignedLedgerAmount(12345n, 'credit')).toBe(123.45);
    expect(getSignedLedgerAmount(12345n, 'debit')).toBe(-123.45);
    expect(getSignedLedgerAmount(-12345n, 'debit')).toBe(-123.45);
    expect(getSignedLedgerAmount(-12345n, 'credit')).toBe(123.45);
  });

  it('builds ledger summary counts and total amount', () => {
    expect(buildLedgerSummary([
      { amountMinor: 10000n, direction: 'credit', categoryId: 'cat-1', classificationSource: 'history' },
      { amountMinor: 2500n, direction: 'debit', categoryId: null, classificationSource: 'import' },
      { amountMinor: 5000n, direction: 'credit', categoryId: 'cat-2', classificationSource: 'rule' },
      { amountMinor: 1000n, direction: 'debit', categoryId: 'cat-3', classificationSource: 'none' },
    ])).toEqual({
      total: 4,
      reviewCount: 2,
      autoCategorized: 2,
      totalAmount: 115,
    });
  });

  it('serializes locked ledger snapshots with ISO timestamps', () => {
    expect(serializeLedgerSnapshot({
      id: 'ledger-1',
      month: 5,
      year: 2026,
      lockedAt: new Date('2026-05-31T22:00:00.000Z'),
      lockedBy: 'admin-1',
      lockNote: 'Maand gecontroleerd',
    })).toEqual({
      id: 'ledger-1',
      month: 5,
      year: 2026,
      lockedAt: '2026-05-31T22:00:00.000Z',
      lockedBy: 'admin-1',
      lockNote: 'Maand gecontroleerd',
    });
  });

  it('serializes unlocked ledger snapshots with null lock fields', () => {
    expect(serializeLedgerSnapshot({
      id: 'ledger-2',
      month: 6,
      year: 2026,
      lockedAt: null,
      lockedBy: null,
      lockNote: null,
    })).toEqual({
      id: 'ledger-2',
      month: 6,
      year: 2026,
      lockedAt: null,
      lockedBy: null,
      lockNote: null,
    });
  });
});
