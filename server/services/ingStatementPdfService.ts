import { createUtcCalendarDate } from '../../lib/import/normalizers';

const DUTCH_MONTHS: Record<string, number> = {
  januari: 0,
  februari: 1,
  maart: 2,
  april: 3,
  mei: 4,
  juni: 5,
  juli: 6,
  augustus: 7,
  september: 8,
  oktober: 9,
  november: 10,
  december: 11,
};

export class IngStatementPdfError extends Error {
  statusCode: number;

  constructor(message: string, statusCode = 422) {
    super(message);
    this.name = 'IngStatementPdfError';
    this.statusCode = statusCode;
  }
}

export type IngStatementPdfControls = {
  bankAccountIdentifier: string;
  periodStart: Date;
  periodEnd: Date;
  openingBalanceMinor: bigint;
  incomeMinor: bigint;
  expenseMinor: bigint;
  closingBalanceMinor: bigint;
};

const normalizeIban = (value: string): string => value.replace(/\s+/g, '').toUpperCase();

const parseMoneyMinor = (value: string): bigint => {
  const cleaned = value.replace(/\s/g, '').replace(/EUR/gi, '');
  let normalized: string;
  // Detect format by what follows the last separator:
  // Dutch:   period=thousands, comma=decimal  (e.g. "9.390,82")  → ends with ,\d{1,2}
  // English: comma=thousands,  period=decimal (e.g. "9,390.82")  → ends with .\d{1,2}
  if (/,\d{1,2}$/.test(cleaned)) {
    // Dutch format: remove periods (thousands sep), replace comma with period (decimal)
    normalized = cleaned.replace(/\./g, '').replace(',', '.').replace(/[^0-9.-]/g, '');
  } else if (/\.\d{1,2}$/.test(cleaned)) {
    // English format: remove commas (thousands sep), keep period as decimal
    normalized = cleaned.replace(/,/g, '').replace(/[^0-9.-]/g, '');
  } else {
    // Fallback: assume Dutch
    normalized = cleaned.replace(/\./g, '').replace(',', '.').replace(/[^0-9.-]/g, '');
  }
  if (!normalized || !/^-?\d+(?:\.\d{1,2})?$/.test(normalized)) {
    throw new IngStatementPdfError(`Bedrag kon niet uit het PDF-bankafschrift worden gelezen: ${value}`);
  }
  const negative = normalized.startsWith('-');
  const [wholeRaw, fractionRaw = ''] = normalized.replace('-', '').split('.');
  const minor = BigInt(wholeRaw) * 100n + BigInt((fractionRaw + '00').slice(0, 2));
  return negative ? -minor : minor;
};

const parseDutchDate = (value: string): Date => {
  const trimmed = value.trim().toLowerCase();
  let match = trimmed.match(/^(\d{1,2})[-\x2f](\d{1,2})[-\x2f](\d{4})$/);
  if (match) {
    const date = createUtcCalendarDate(Number(match[3]), Number(match[2]), Number(match[1]));
    if (date) return date;
  }
  match = trimmed.match(/^(\d{1,2})\s+([a-zé]+)\s+(\d{4})$/i);
  if (match) {
    const month = DUTCH_MONTHS[match[2]];
    const date = month == null
      ? null
      : createUtcCalendarDate(Number(match[3]), month + 1, Number(match[1]));
    if (date) return date;
  }
  throw new IngStatementPdfError(`Datum kon niet uit het PDF-bankafschrift worden gelezen: ${value}`);
};

export const parseIngStatementPdfText = (rawText: string): IngStatementPdfControls => {
  // Normalize: preserve newlines, collapse other whitespace
  const text = rawText.replace(/\u00a0/g, ' ').replace(/[ \t]+/g, ' ');
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);

  // Helper: find the value on the next non-empty line after a line matching labelPattern
  const findNextLineAfter = (labelPattern: RegExp): string | null => {
    for (let i = 0; i < lines.length - 1; i++) {
      if (labelPattern.test(lines[i])) return lines[i + 1];
    }
    return null;
  };

  // Helper: try to parse money from the next line after any matching label
  const findMoneyNextLine = (labelPatterns: RegExp[]): bigint | null => {
    for (const pat of labelPatterns) {
      const val = findNextLineAfter(pat);
      if (val) {
        try { return parseMoneyMinor(val); } catch { /* try next */ }
      }
    }
    return null;
  };

  // Helper: find money inline after a label (legacy Dutch layout)
  const findMoneyInline = (labelPatterns: RegExp[]): bigint | null => {
    for (const label of labelPatterns) {
      // Strip ^ and $ anchors — they are used in line-matching but break inline search
      const src = label.source.replace(/^\^/, '').replace(/\$$/, '');
      // Match Dutch format (X.XXX,XX) or English format (X,XXX.XX) inline after label
      const match = text.match(new RegExp(src + '[^\\d-]{0,40}(-?[\\d.,]+)', 'i'));
      if (match?.[1]) {
        try { return parseMoneyMinor(match[1]); } catch { /* try next */ }
      }
    }
    return null;
  };

  // IBAN: look on next line after "Account number", or search full text.
  // Use [\s\d]{10,14} to flexibly handle spaced groups like "0006 3699 60" (last group may be 2 digits).
  const ibanLineValue = findNextLineAfter(/^account\s+number$/i);
  const ibanSearchText = ibanLineValue ? ibanLineValue + '\n' + text : text;
  const ibanMatch = ibanSearchText.match(/\bNL\s*\d{2}\s*INGB[\s\d]{10,14}\b/i)
    ?? ibanSearchText.match(/\bNL\d{2}INGB\d{10}\b/i);
  if (!ibanMatch) throw new IngStatementPdfError('Het rekeningnummer kon niet uit het PDF-bankafschrift worden gelezen.');

  // Period: look on next line after "Period" / "Periode", or search full text inline
  const periodLineValue = findNextLineAfter(/^period$/i) ?? findNextLineAfter(/^periou?de?$/i);
  const periodSource = periodLineValue ?? text;
  const periodMatch = periodSource.match(/(\d{1,2}[-\x2f]\d{1,2}[-\x2f]\d{4})\s*(?:t\/m|till|tot|[-–])\s*(\d{1,2}[-\x2f]\d{1,2}[-\x2f]\d{4})/i)
    ?? text.match(/(?:periode|afschriftperiode|period)[^\d]{0,25}(\d{1,2}[-\x2f]\d{1,2}[-\x2f]\d{4})\s*(?:t\/m|till|tot|[-–])\s*(\d{1,2}[-\x2f]\d{1,2}[-\x2f]\d{4})/i)
    ?? text.match(/(\d{1,2}\s+[a-zé]+\s+\d{4})\s*(?:t\/m|tot|[-–])\s*(\d{1,2}\s+[a-zé]+\s+\d{4})/i);
  if (!periodMatch) throw new IngStatementPdfError('De afschriftperiode kon niet uit het PDF-bankafschrift worden gelezen.');

  const openingPatterns = [/^opening\s+balance(\s+\(eur\))?$/i, /^beginsaldo$/i, /^saldo\s+begin$/i, /^openingssaldo$/i];
  const incomePatterns  = [/^total\s+in(\s+\(eur\))?$/i, /^totaal\s+bij$/i, /^totaal\s+inkomsten$/i, /^bijgeschreven$/i];
  const expensePatterns = [/^total\s+out(\s+\(eur\))?$/i, /^totaal\s+af$/i, /^totaal\s+uitgaven$/i, /^afgeschreven$/i];
  const closingPatterns = [/^closing\s+balance(\s+\(eur\))?$/i, /^eindsaldo$/i, /^saldo\s+einde$/i, /^slotsaldo$/i];

  const opening = findMoneyNextLine(openingPatterns) ?? findMoneyInline(openingPatterns);
  const income  = findMoneyNextLine(incomePatterns)  ?? findMoneyInline(incomePatterns);
  const expense = findMoneyNextLine(expensePatterns) ?? findMoneyInline(expensePatterns);
  const closing = findMoneyNextLine(closingPatterns) ?? findMoneyInline(closingPatterns);

  if (opening == null) throw new IngStatementPdfError('Het openingssaldo kon niet uit het PDF-bankafschrift worden gelezen.');
  if (income == null)  throw new IngStatementPdfError('Het totaal aan inkomsten kon niet uit het PDF-bankafschrift worden gelezen.');
  if (expense == null) throw new IngStatementPdfError('Het totaal aan uitgaven kon niet uit het PDF-bankafschrift worden gelezen.');
  if (closing == null) throw new IngStatementPdfError('Het eindsaldo kon niet uit het PDF-bankafschrift worden gelezen.');
  if (opening + income - expense !== closing) {
    throw new IngStatementPdfError('De saldi in het PDF-bankafschrift sluiten niet exact aan: begin + inkomsten - uitgaven is niet gelijk aan einde.');
  }

  return {
    bankAccountIdentifier: normalizeIban(ibanMatch[0]),
    periodStart: parseDutchDate(periodMatch[1]),
    periodEnd: parseDutchDate(periodMatch[2]),
    openingBalanceMinor: opening,
    incomeMinor: income < 0n ? -income : income,
    expenseMinor: expense < 0n ? -expense : expense,
    closingBalanceMinor: closing,
  };
};

export const extractIngStatementPdfControls = async (buffer: Buffer): Promise<IngStatementPdfControls> => {
  // Dynamic loading keeps the parser isolated from the browser bundle and avoids native dependencies.
  const dynamicImport = new Function('specifier', 'return import(specifier)') as (specifier: string) => Promise<any>;
  let PDFParse: any;
  try {
    ({ PDFParse } = await dynamicImport('pdf-parse'));
  } catch {
    throw new IngStatementPdfError('PDF-parser is niet beschikbaar in deze deployment.', 500);
  }
  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getText();
    return parseIngStatementPdfText(String(result?.text ?? ''));
  } finally {
    await parser.destroy?.();
  }
};
