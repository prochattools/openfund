import Papa, { ParseResult } from 'papaparse';
import type { ParsedRow } from './client-row-transaction';

const parseCsvText = (content: string, delimiter?: string): ParseResult<ParsedRow> =>
  Papa.parse<ParsedRow>(content, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header) => header.trim(),
    delimiter,
  });

export const parseCsvFile = async (file: File): Promise<ParsedRow[]> => {
  const content = await file.text();
  const primary = parseCsvText(content);
  const primaryRows = primary.data ?? [];

  if (!primaryRows.length) {
    return parseCsvText(content, ';').data ?? [];
  }

  return primaryRows;
};
