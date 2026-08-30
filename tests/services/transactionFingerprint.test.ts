import { describe, expect, it } from 'vitest';
import { buildImportFingerprint } from '../../server/services/transactionFingerprint';

const baseInput = {
  accountIdentifier: 'NL89 INGB 0006 3699 60',
  date: new Date(Date.UTC(2026, 0, 15)),
  amountMinor: 12345n,
  description: 'Gift Yeshua Academy',
  counterparty: 'Donor Name',
  reference: 'REF-1',
};

describe('transaction import fingerprint', () => {
  it('normalizes account identifiers, whitespace, and case', () => {
    const first = buildImportFingerprint(baseInput);
    const second = buildImportFingerprint({
      ...baseInput,
      accountIdentifier: 'nl89ingb0006369960',
      description: '  gift   yeshua   academy  ',
      counterparty: 'donor name',
      reference: ' ref-1 ',
    });

    expect(second).toBe(first);
  });

  it('includes direct ING notification text in the fingerprint', () => {
    const withoutNotification = buildImportFingerprint(baseInput);
    const withNotification = buildImportFingerprint({
      ...baseInput,
      raw: { Notifications: 'Kenmerk 123' },
    });

    expect(withNotification).not.toBe(withoutNotification);
    expect(withNotification).toBe(buildImportFingerprint({
      ...baseInput,
      raw: { Notification: 'Kenmerk 123' },
    }));
  });

  it('reads notification text from normalized raw row columns', () => {
    const direct = buildImportFingerprint({
      ...baseInput,
      raw: { Notifications: 'Omschrijving uit kolom' },
    });
    const nested = buildImportFingerprint({
      ...baseInput,
      raw: { columns: { Notifications: 'Omschrijving uit kolom' } },
    });

    expect(nested).toBe(direct);
  });

  it('changes when amount or date changes', () => {
    const base = buildImportFingerprint(baseInput);

    expect(buildImportFingerprint({ ...baseInput, amountMinor: 12346n })).not.toBe(base);
    expect(buildImportFingerprint({ ...baseInput, date: new Date(Date.UTC(2026, 0, 16)) })).not.toBe(base);
  });

  it('includes non-duplicate source fields and distinguishes repeated occurrences', () => {
    const first = buildImportFingerprint({ ...baseInput, raw: { Code: 'TRF' }, occurrence: 1 });
    expect(buildImportFingerprint({ ...baseInput, raw: { Code: 'PIN' }, occurrence: 1 })).not.toBe(first);
    expect(buildImportFingerprint({ ...baseInput, raw: { Code: 'TRF' }, occurrence: 2 })).not.toBe(first);
  });
});
