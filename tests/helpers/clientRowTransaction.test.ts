import { describe, expect, it, vi } from 'vitest';
import { buildTransactionFromRow, createLedgerId } from '../../src/helpers/client-row-transaction';

describe('client row transaction helper', () => {
  it('builds a prepared ledger transaction from ING-style row columns', () => {
    const tx = buildTransactionFromRow(
      {
        Date: '20260515',
        'Name / Description': ' Gift voor zending! ',
        'Amount (EUR)': '25,50',
        Counterparty: 'NL89INGB0006369960 Vila Solidária',
        'Debit/credit': 'Credit',
        Notifications: 'Name: Donor Naam',
      },
      () => 'fixed-id',
      () => new Date('2026-05-16T10:00:00.000Z'),
    );

    expect(tx).toEqual({
      id: 'fixed-id',
      date: '2026-05-15T00:00:00.000Z',
      description: 'Gift voor zending!',
      amount: 25.5,
      direction: 'credit',
      source: 'NL89INGB0006369960 Vila Solidária',
      accountLabel: 'Vila Solidária',
      accountIdentifier: 'NL89INGB0006369960',
      normalizedKey: 'gift voor zending',
      notificationDetail: 'Donor Naam',
      counterpartyAccount: 'NL89INGB0006369960 Vila Solidária',
      ledgerMonth: 5,
      ledgerYear: 2026,
      createdAt: '2026-05-16T10:00:00.000Z',
    });
  });

  it('builds debit transactions and falls back to description as source', () => {
    const tx = buildTransactionFromRow(
      {
        'Booking date': '15-05-2026',
        Description: 'Bankkosten',
        Amount: '7,50',
        'Debit Credit': 'Debit',
      },
      () => 'debit-id',
      () => new Date('2026-05-16T10:00:00.000Z'),
    );

    expect(tx).toMatchObject({
      id: 'debit-id',
      amount: -7.5,
      direction: 'debit',
      source: 'Bankkosten',
      accountLabel: null,
      accountIdentifier: null,
      counterpartyAccount: null,
    });
  });

  it('returns null for incomplete or unparsable rows', () => {
    expect(buildTransactionFromRow({ Date: '20260515', Description: 'Geen bedrag' })).toBeNull();
    expect(buildTransactionFromRow({ Date: 'geen datum', Description: 'Test', Amount: '1,00' })).toBeNull();
    expect(buildTransactionFromRow({ Date: '20260515', Description: 'Test', Amount: 'geen bedrag' })).toBeNull();
  });

  it('creates stable random UUID ids when crypto.randomUUID is available', () => {
    const originalCrypto = globalThis.crypto;
    vi.stubGlobal('crypto', { randomUUID: () => 'uuid-123' });

    expect(createLedgerId()).toBe('uuid-123');

    vi.stubGlobal('crypto', originalCrypto);
  });
});
