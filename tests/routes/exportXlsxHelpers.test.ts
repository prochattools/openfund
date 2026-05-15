import { describe, expect, it } from 'vitest';
import {
  buildLedgerBackupContentDisposition,
  buildLedgerBackupFilename,
  deriveDebitCredit,
  ensureRawRecord,
  formatDateAsIsoDay,
  formatDateAsNumeric,
  parseAmount,
  readRawValue,
  splitCategoryLabel,
} from '../../src/app/api/ledger/export-xlsx/exportHelpers';

describe('export XLSX helpers', () => {
  it('guards raw records and nested columns safely', () => {
    expect(ensureRawRecord(null)).toBeNull();
    expect(ensureRawRecord([])).toBeNull();
    expect(ensureRawRecord({ columns: { Date: 20260515 } })).toEqual({ columns: { Date: 20260515 } });
    expect(readRawValue({ columns: { Date: 20260515, Active: true } }, 'Date')).toBe('20260515');
    expect(readRawValue({ columns: { Active: true } }, 'Active')).toBe('true');
    expect(readRawValue({ columns: { Amount: Number.NaN } }, 'Amount')).toBeNull();
  });

  it('formats UTC dates for ING rows and deterministic backup filenames', () => {
    const date = new Date('2026-05-15T22:30:00.000Z');

    expect(formatDateAsNumeric(date)).toBe('20260515');
    expect(formatDateAsIsoDay(date)).toBe('2026-05-15');
    expect(buildLedgerBackupFilename(date)).toBe('finance-admin-ledger-backup-2026-05-15.xlsx');
    expect(buildLedgerBackupContentDisposition(date)).toBe('attachment; filename="finance-admin-ledger-backup-2026-05-15.xlsx"');
  });

  it('parses exported amount text while rejecting invalid values', () => {
    expect(parseAmount('€ 1.234,56')).toBe(1234.56);
    expect(parseAmount('1,234.56')).toBe(1234.56);
    expect(parseAmount('-25,50')).toBe(-25.5);
    expect(parseAmount('geen bedrag')).toBeNull();
    expect(parseAmount(null)).toBeNull();
  });

  it('splits main and subcategory labels for export columns', () => {
    expect(splitCategoryLabel('Inkomsten — Giften — Zending')).toEqual({ main: 'Inkomsten', sub: 'Giften — Zending' });
    expect(splitCategoryLabel('Bankkosten')).toEqual({ main: 'Bankkosten', sub: 'Bankkosten' });
    expect(splitCategoryLabel('   ')).toEqual({ main: null, sub: null });
  });

  it('derives debit and credit labels from transaction direction', () => {
    expect(deriveDebitCredit('debit')).toBe('Debit');
    expect(deriveDebitCredit('Debit transfer')).toBe('Debit');
    expect(deriveDebitCredit('credit')).toBe('Credit');
    expect(deriveDebitCredit(null)).toBe('Credit');
  });
});
