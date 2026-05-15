import { describe, expect, it } from 'vitest';
import { buildLedgerSummary, filterReviewTransactions } from '../../src/helpers/ledger-summary';
import type { LedgerTransaction } from '../../src/helpers/api-transaction-mapper';

const makeTx = (overrides: Partial<LedgerTransaction>): LedgerTransaction => ({
  id: 'tx-default',
  date: '2026-05-15T00:00:00.000Z',
  description: 'Test',
  amount: 0,
  direction: 'credit',
  source: 'Test',
  accountLabel: null,
  accountIdentifier: null,
  normalizedKey: 'test',
  notificationDetail: null,
  counterpartyAccount: null,
  categoryId: null,
  categoryName: null,
  mainCategoryId: null,
  mainCategoryName: null,
  ledgerMonth: 5,
  ledgerYear: 2026,
  createdAt: '2026-05-15T00:00:00.000Z',
  autoCategorized: false,
  needsManualCategory: false,
  ...overrides,
});

describe('ledger summary helpers', () => {
  it('builds totals, review count, auto-categorized count, and net amount', () => {
    const transactions = [
      makeTx({ id: 'manual-review', amount: 100, needsManualCategory: true, classificationSource: 'manual' }),
      makeTx({ id: 'history', amount: 25, classificationSource: 'history' }),
      makeTx({ id: 'rule', amount: -10, classificationSource: 'rule' }),
      makeTx({ id: 'none', amount: -5, classificationSource: 'none' }),
    ];

    expect(buildLedgerSummary(transactions)).toEqual({
      total: 4,
      reviewCount: 1,
      autoCategorized: 2,
      totalAmount: 110,
    });
  });

  it('filters transactions that still need manual review', () => {
    const transactions = [
      makeTx({ id: 'ready', needsManualCategory: false }),
      makeTx({ id: 'review', needsManualCategory: true }),
    ];

    expect(filterReviewTransactions(transactions).map((tx) => tx.id)).toEqual(['review']);
  });

  it('returns zero summary values for an empty ledger', () => {
    expect(buildLedgerSummary([])).toEqual({
      total: 0,
      reviewCount: 0,
      autoCategorized: 0,
      totalAmount: 0,
    });
  });
});
