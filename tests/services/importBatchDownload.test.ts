import { describe, expect, it } from 'vitest';
import { buildImportFileDownload, getImportFileContentType } from '../../server/services/importBatchDownload';

describe('import batch download service', () => {
  it('builds a CSV download payload with checksum metadata', () => {
    const body = Buffer.from('Account;Amount\nNL00;1.00', 'utf-8');
    const download = buildImportFileDownload({
      filename: 'ing.csv',
      fileType: 'csv_ing',
      originalFile: body,
      fileSha256: 'abc123',
    });

    expect(download).toEqual({
      contentType: 'text/csv; charset=utf-8',
      filename: 'ing.csv',
      sha256: 'abc123',
      body,
    });
  });

  it('builds an XLSX content type for initial workbook imports', () => {
    expect(getImportFileContentType('xlsx_initial')).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  });

  it('returns null when no original file is stored', () => {
    const download = buildImportFileDownload({
      filename: 'old-import.csv',
      fileType: 'csv_ing',
      originalFile: null,
      fileSha256: null,
    });

    expect(download).toBeNull();
  });
});
