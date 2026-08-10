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
  const normalized = value
    .replace(/\s/g, '')
    .replace(/EUR/gi, '')
    .replace(/\./g, '')
    .replace(',', '.')
    .replace(/[^0-9.-]/g, '');
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
  let match = trimmed.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
  if (match) return new Date(Date.UTC(Number(match[3]), Number(match[2]) - 1, Number(match[1])));
  match = trimmed.match(/^(\d{1,2})\s+([a-zé]+)\s+(\d{4})$/i);
  if (match) {
    const month = DUTCH_MONTHS[match[2]];
    if (month != null) return new Date(Date.UTC(Number(match[3]), month, Number(match[1])));
  }
  throw new IngStatementPdfError(`Datum kon niet uit het PDF-bankafschrift worden gelezen: ${value}`);
};

const findMoney = (text: string, labels: RegExp[]): bigint | null => {
  for (const label of labels) {
    const match = text.match(new RegExp(`${label.source}[^\d-]{0,40}(-?[\d.]+,\d{2})`, 'i'));
    if (match?.[1]) return parseMoneyMinor(match[1]);
  }
  return null;
};

export const parseIngStatementPdfText = (rawText: string): IngStatementPdfControls => {
  const text = rawText.replace(/\u00a0/g, ' ').replace(/[ \t]+/g, ' ');
  const ibanMatch = text.match(/\bNL\s*\d{2}\s*INGB(?:\s*\d{4}){2,3}\b/i)
    ?? text.match(/\bNL\d{2}INGB\d{10}\b/i);
  if (!ibanMatch) throw new IngStatementPdfError('Het rekeningnummer kon niet uit het PDF-bankafschrift worden gelezen.');

  const periodMatch = text.match(/(?:periode|afschriftperiode)[^\d]{0,25}(\d{1,2}[\/-]\d{1,2}[\/-]\d{4})\s*(?:t\/m|tot|[-–])\s*(\d{1,2}[\/-]\d{1,2}[\/-]\d{4})/i)
    ?? text.match(/(\d{1,2}\s+[a-zé]+\s+\d{4})\s*(?:t\/m|tot|[-–])\s*(\d{1,2}\s+[a-zé]+\s+\d{4})/i);
  if (!periodMatch) throw new IngStatementPdfError('De afschriftperiode kon niet uit het PDF-bankafschrift worden gelezen.');

  const opening = findMoney(text, [/beginsaldo/i, /saldo\s+begin/i, /openingssaldo/i]);
  const income = findMoney(text, [/totaal\s+bij/i, /totaal\s+inkomsten/i, /bijgeschreven/i]);
  const expense = findMoney(text, [/totaal\s+af/i, /totaal\s+uitgaven/i, /afgeschreven/i]);
  const closing = findMoney(text, [/eindsaldo/i, /saldo\s+einde/i, /slotsaldo/i]);

  if (opening == null) throw new IngStatementPdfError('Het openingssaldo kon niet uit het PDF-bankafschrift worden gelezen.');
  if (income == null) throw new IngStatementPdfError('Het totaal aan inkomsten kon niet uit het PDF-bankafschrift worden gelezen.');
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
