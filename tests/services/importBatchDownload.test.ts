import { describe, expect, it } from 'vitest';
import { buildContentDisposition, buildImportFileDownload, getImportFileContentType } from '../../server/services/importBatchDownload';

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

  it('builds a safe content disposition header for UTF-8 filenames', () => {
    expect(buildContentDisposition('NL89 ING maand mei.csv')).toBe("attachment; filename=\"NL89_ING_maand_mei.csv\"; filename*=UTF-8''NL89%20ING%20maand%20mei.csv");
  });

  it('falls back to a safe filename when the original name is blank', () => {
    expect(buildContentDisposition('   ')).toBe("attachment; filename=\"importbestand.csv\"; filename*=UTF-8''importbestand.csv");
  });

  it('keeps UTF-8 filename metadata while using an ASCII fallback', () => {
    expect(buildContentDisposition('maand mei – giften.csv')).toBe("attachment; filename=\"maand_mei___giften.csv\"; filename*=UTF-8''maand%20mei%20%E2%80%93%20giften.csv");
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
