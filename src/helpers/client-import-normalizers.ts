export const normaliseDescription = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

export const parseDateString = (value: string): Date | null => {
  const trimmed = value.trim();

  if (/^\d{8}$/.test(trimmed)) {
    const year = Number(trimmed.slice(0, 4));
    const month = Number(trimmed.slice(4, 6)) - 1;
    const day = Number(trimmed.slice(6, 8));
    return new Date(Date.UTC(year, month, day));
  }

  if (/^\d{2}[/-]\d{2}[/-]\d{4}$/.test(trimmed)) {
    const [d, m, y] = trimmed.replace(/-/g, '/').split('/');
    return new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));
  }

  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export const parseAmount = (value: string, debitCredit?: string): number | null => {
  if (value == null) return null;
  const trimmed = String(value).trim();
  if (!trimmed) return null;

  const cleaned = trimmed.replace(/\u00A0/g, '').replace(/[^0-9.,-]/g, '');
  if (!cleaned) return null;

  const dotCount = (cleaned.match(/\./g) ?? []).length;
  const commaCount = (cleaned.match(/,/g) ?? []).length;
  const lastComma = cleaned.lastIndexOf(',');
  const lastDot = cleaned.lastIndexOf('.');
  let normalized: string;

  if (commaCount > 0 && (dotCount === 0 || lastComma > lastDot)) {
    normalized = cleaned.replace(/\./g, '').replace(',', '.');
  } else if (dotCount > 0 && commaCount === 0) {
    if (dotCount > 1) {
      normalized = cleaned.replace(/\./g, '');
    } else {
      const decimals = cleaned.length - lastDot - 1;
      normalized = decimals === 3 ? cleaned.replace(/\./g, '') : cleaned;
    }
  } else if (dotCount > 0 && commaCount > 0 && lastDot > lastComma) {
    normalized = cleaned.replace(/,/g, '');
  } else {
    normalized = cleaned.replace(/[.,]/g, '');
  }

  normalized = normalized.replace(/(?!^)-/g, '');

  if (!normalized || normalized === '-' || normalized === '.') return null;

  const amount = Number(normalized);
  if (Number.isNaN(amount)) return null;

  const indicator = debitCredit?.trim().toLowerCase();
  if (indicator && (indicator.startsWith('debit') || indicator === 'af' || indicator === 'd')) {
    return amount * -1;
  }

  return amount;
};

export const sanitizeNotification = (value?: string | null): string | null => {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const withoutPrefix = trimmed.replace(/^Name:\s*/i, '').trim();
  return withoutPrefix.length ? withoutPrefix : null;
};
