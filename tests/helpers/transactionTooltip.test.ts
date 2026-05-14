import { describe, expect, it } from 'vitest';
import { buildTransactionTooltip } from '../../src/helpers/transaction-tooltip';

const makeTx = (overrides: Record<string, unknown>) => overrides as any;

describe('transaction tooltip helper', () => {
  it('returns notification, source, and account details without duplicate values', () => {
    const tooltip = buildTransactionTooltip(makeTx({
      notificationDetail: 'Kenmerk gift 123',
      description: 'Gift gemeente',
      source: 'ING CSV',
      accountLabel: 'Betaalrekening',
      accountIdentifier: 'NL89INGB0006369960',
    }));

    expect(tooltip).toBe('Kenmerk gift 123 • ING CSV • Account: Betaalrekening • Identifier: NL89INGB0006369960');
  });

  it('does not repeat source or account identifier when they match existing labels', () => {
    const tooltip = buildTransactionTooltip(makeTx({
      notificationDetail: 'Gift gemeente',
      description: 'gift gemeente',
      source: 'Gift Gemeente',
      accountLabel: 'NL89INGB0006369960',
      accountIdentifier: ' nl89ingb0006369960 ',
    }));

    expect(tooltip).toBe('Gift gemeente • Account: NL89INGB0006369960');
  });

  it('falls back to the description when no detail fields are available', () => {
    const tooltip = buildTransactionTooltip(makeTx({
      description: 'Bankkosten',
      notificationDetail: ' ',
      source: null,
      accountLabel: '',
      accountIdentifier: undefined,
    }));

    expect(tooltip).toBe('Bankkosten');
  });

  it('returns null when no usable tooltip data exists', () => {
    const tooltip = buildTransactionTooltip(makeTx({
      description: ' ',
      notificationDetail: null,
      source: undefined,
      accountLabel: '',
      accountIdentifier: ' ',
    }));

    expect(tooltip).toBeNull();
  });
});
