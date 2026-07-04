import { normalizeWhitespace } from './normalizers';

export type VerduidelijkingEvidenceRow = {
  rowNumber: number;
  rawRow: Record<string, unknown>;
  label: string | null;
  referenceText: string | null;
  note: string | null;
};

const toText = (value: unknown): string | null => {
  if (value == null) return null;
  const text = normalizeWhitespace(String(value));
  return text.length ? text : null;
};

export const parseVerduidelijkingRows = (rows: Record<string, unknown>[]): VerduidelijkingEvidenceRow[] =>
  rows.map((row, index) => ({
    rowNumber: index + 1,
    rawRow: row,
    label: toText(row.Label ?? row.Klant ?? row.Type ?? row.Category ?? row.Omschrijving),
    referenceText: toText(row.Reference ?? row.Referentie ?? row['Reference text']),
    note: toText(row.Note ?? row.Opmerking ?? row.Comment),
  }));

