import { describe, expect, it } from 'vitest';
import {
  buildLedgerSummary,
  buildRunningBalanceMap,
  extractCounterpartyAccount,
  extractLedgerSuggestionMetadata,
  extractNotificationDetail,
  formatRunningBalanceAmount,
  formatRunningBalanceMinor,
  getLedgerAccountIds,
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

  it('extracts suggestion metadata and raw category fallbacks from raw rows', () => {
    expect(extractLedgerSuggestionMetadata({
      mainCategoryName: 'Inkomsten',
      categoryName: 'Giften',
      suggestion: {
        confidence: 0.92,
        mainCategoryName: 'Voorgesteld hoofd',
        categoryName: 'Voorgestelde sub',
      },
    })).toEqual({
      suggestionConfidence: '0.92',
      suggestedMainCategoryName: 'Voorgesteld hoofd',
      suggestedSubCategoryName: 'Voorgestelde sub',
      rawMainCategoryName: 'Inkomsten',
      rawSubCategoryName: 'Giften',
    });
    expect(extractLedgerSuggestionMetadata({ suggestion: 'geen object' })).toEqual({
      suggestionConfidence: null,
      suggestedMainCategoryName: null,
      suggestedSubCategoryName: null,
      rawMainCategoryName: null,
      rawSubCategoryName: null,
    });
    expect(extractLedgerSuggestionMetadata(null).rawMainCategoryName).toBeNull();
  });

  it('calculates signed ledger amounts from debit and credit minor units', () => {
    expect(getSignedLedgerAmount(12345n, 'credit')).toBe(123.45);
    expect(getSignedLedgerAmount(12345n, 'debit')).toBe(-123.45);
    expect(getSignedLedgerAmount(-12345n, 'debit')).toBe(-123.45);
    expect(getSignedLedgerAmount(-12345n, 'credit')).toBe(123.45);
  });

  it('extracts unique ledger account IDs and ignores missing account IDs', () => {
    expect(getLedgerAccountIds([
      { accountId: 'acc-1' },
      { accountId: null },
      { accountId: 'acc-2' },
      { accountId: 'acc-1' },
    ])).toEqual(['acc-1', 'acc-2']);
  });

  it('formats running balance response values from minor units', () => {
    expect(formatRunningBalanceMinor(12345n)).toBe('12345');
    expect(formatRunningBalanceMinor(undefined)).toBeNull();
    expect(formatRunningBalanceAmount(12345n)).toBe(123.45);
    expect(formatRunningBalanceAmount(undefined)).toBeNull();
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

  it('builds running balances per account using opening balances and transaction order', () => {
    const balances = buildRunningBalanceMap([
      { id: 'late', accountId: 'acc-1', date: '2026-05-02T00:00:00.000Z', createdAt: new Date('2026-05-02T09:00:00.000Z'), amountMinor: -2500n },
      { id: 'early', accountId: 'acc-1', date: '2026-05-01T00:00:00.000Z', createdAt: new Date('2026-05-01T09:00:00.000Z'), amountMinor: 10000n },
      { id: 'same-day-second', accountId: 'acc-1', date: '2026-05-01T00:00:00.000Z', createdAt: new Date('2026-05-01T10:00:00.000Z'), amountMinor: -1000n },
      { id: 'other-account', accountId: 'acc-2', date: '2026-05-01T00:00:00.000Z', createdAt: new Date('2026-05-01T09:00:00.000Z'), amountMinor: 500n },
      { id: 'no-account', accountId: null, date: '2026-05-01T00:00:00.000Z', createdAt: new Date('2026-05-01T09:00:00.000Z'), amountMinor: 700n },
    ], [
      { accountId: 'acc-1', effectiveDate: new Date('2026-05-01T00:00:00.000Z'), amountMinor: 50000n },
      { accountId: 'acc-2', effectiveDate: new Date('2026-05-01T00:00:00.000Z'), amountMinor: 1000n },
    ]);

    expect(balances.get('early')).toBe(60000n);
    expect(balances.get('same-day-second')).toBe(59000n);
    expect(balances.get('late')).toBe(56500n);
    expect(balances.get('other-account')).toBe(1500n);
    expect(balances.get('no-account')).toBe(700n);
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
