export const SHEET_NAME = 'transacties 2025';

export const HEADERS = [
  'Date',
  'Name / Description',
  'Account',
  'Counterparty',
  'Code',
  'Debit/credit',
  'Amount (EUR)',
  'Transaction type',
  'Categorie',
  'bestemming',
  'Notifications',
];

export type RawRecord = Record<string, unknown>;

export const ensureRawRecord = (value: unknown): RawRecord | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  return value as RawRecord;
};

export const readRawValue = (raw: RawRecord | null, key: string): string | null => {
  if (!raw) return null;
  const fromRecord = raw[key];
  const columns = ensureRawRecord(raw.columns);
  const fromColumns = columns ? columns[key] : undefined;
  const candidate = fromRecord ?? fromColumns;
  if (candidate == null) {
    return null;
  }
  if (typeof candidate === 'string') {
    return candidate;
  }
  if (typeof candidate === 'number') {
    if (Number.isNaN(candidate)) return null;
    return candidate.toString();
  }
  if (typeof candidate === 'boolean') {
    return candidate ? 'true' : 'false';
  }
  return null;
};

export const formatDateAsNumeric = (date: Date): string => {
  const year = date.getUTCFullYear();
  const month = `${date.getUTCMonth() + 1}`.padStart(2, '0');
  const day = `${date.getUTCDate()}`.padStart(2, '0');
  return `${year}${month}${day}`;
};

export const formatDateAsIsoDay = (date: Date): string => {
  const year = date.getUTCFullYear();
  const month = `${date.getUTCMonth() + 1}`.padStart(2, '0');
  const day = `${date.getUTCDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const buildLedgerBackupFilename = (date: Date = new Date()): string =>
  `finance-admin-ledger-backup-${formatDateAsIsoDay(date)}.xlsx`;

export const buildLedgerBackupContentDisposition = (date: Date = new Date()): string =>
  `attachment; filename="${buildLedgerBackupFilename(date)}"`;

export const parseAmount = (value: string | null): number | null => {
  if (!value) return null;
  const stripped = value.replace(/[^\d.,-]/g, '');
  if (!stripped) return null;

  const lastComma = stripped.lastIndexOf(',');
  const lastDot = stripped.lastIndexOf('.');
  const decimalSeparator = lastComma > lastDot ? ',' : lastDot > -1 ? '.' : null;
  const sign = stripped.trim().startsWith('-') ? '-' : '';
  const unsigned = stripped.replace(/-/g, '');

  const normalized = decimalSeparator
    ? `${sign}${unsigned.slice(0, unsigned.lastIndexOf(decimalSeparator)).replace(/[.,]/g, '')}.${unsigned.slice(unsigned.lastIndexOf(decimalSeparator) + 1).replace(/[.,]/g, '')}`
    : `${sign}${unsigned.replace(/[.,]/g, '')}`;

  const parsed = Number(normalized);
  if (Number.isNaN(parsed)) {
    return null;
  }
  return parsed;
};

export const splitCategoryLabel = (
  value?: string | null,
): { main: string | null; sub: string | null } => {
  if (!value) {
    return { main: null, sub: null };
  }
  const parts = value.split(' — ');
  if (parts.length === 1) {
    const trimmed = parts[0]!.trim();
    const safe = trimmed.length ? trimmed : null;
    return { main: safe, sub: safe };
  }
  const main = parts[0]!.trim();
  const sub = parts.slice(1).join(' — ').trim();
  return {
    main: main.length ? main : null,
    sub: sub.length ? sub : main.length ? main : null,
  };
};

export const deriveDebitCredit = (direction: string | null | undefined): 'Debit' | 'Credit' => {
  if (!direction) return 'Credit';
  return direction.toLowerCase().startsWith('debit') ? 'Debit' : 'Credit';
};
