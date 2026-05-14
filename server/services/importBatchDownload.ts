export type StoredImportFile = {
  filename: string;
  fileType: string | null;
  originalFile: Uint8Array | Buffer | null;
  fileSha256: string | null;
};

export const getImportFileContentType = (fileType: string | null | undefined): string =>
  fileType === 'xlsx_initial'
    ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    : 'text/csv; charset=utf-8';

export const buildImportFileDownload = (batch: StoredImportFile) => {
  if (!batch.originalFile) {
    return null;
  }

  return {
    contentType: getImportFileContentType(batch.fileType),
    filename: batch.filename,
    sha256: batch.fileSha256,
    body: Buffer.from(batch.originalFile),
  };
};
