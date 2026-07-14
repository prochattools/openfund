import { Request, Response } from 'express';
import { prisma } from '../prismaClient';
import { requireAuthenticatedRequest } from '../auth/requestContext';
import { readRouteParam } from './routeParams';
import { buildContentDisposition, buildImportFileDownload } from '../services/importBatchDownload';
import { readListLimit } from './queryParams';

export const readImportBatchLimit = readListLimit;

export type ImportBatchResponseInput = {
  id: string;
  filename: string;
  fileType: string | null;
  status: string;
  totalRows: number;
  importedRows: number;
  duplicateRows: number;
  errorRows: number;
  fileSizeBytes: number | null;
  fileSha256: string | null;
  originalFile: unknown;
  autoCategorizedRows: number;
  startedAt: Date;
  completedAt: Date | null;
};

export const serializeImportBatchSummary = (batch: ImportBatchResponseInput) => ({
  id: batch.id,
  filename: batch.filename,
  fileType: batch.fileType,
  status: batch.status,
  totalRows: batch.totalRows,
  importedRows: batch.importedRows,
  duplicateRows: batch.duplicateRows,
  errorRows: batch.errorRows,
  fileSizeBytes: batch.fileSizeBytes,
  fileSha256: batch.fileSha256,
  hasOriginalFile: Boolean(batch.originalFile),
  autoCategorizedRows: batch.autoCategorizedRows,
  reviewRows: Math.max(0, batch.importedRows - batch.autoCategorizedRows),
  startedAt: batch.startedAt.toISOString(),
  completedAt: batch.completedAt ? batch.completedAt.toISOString() : null,
});

export const listImportBatches = async (req: Request, res: Response) => {
  const actor = await requireAuthenticatedRequest(req, res);
  if (!actor) return;
  const { userId } = actor;
  const limit = readImportBatchLimit(req.query.limit);

  try {
    const batches = await prisma.importBatch.findMany({
      where: { userId },
      orderBy: { startedAt: 'desc' },
      take: limit,
    });

    return res.json(batches.map(serializeImportBatchSummary));
  } catch (error) {
    console.error('Import batch fetch failed', error);
    return res.status(500).json({ error: 'Importgeschiedenis kon niet worden geladen.' });
  }
};


export const downloadImportBatchFile = async (req: Request, res: Response) => {
  const actor = await requireAuthenticatedRequest(req, res);
  if (!actor) return;
  const { userId } = actor;
  const batchId = readRouteParam(req, 'id');

  if (!batchId) {
    return res.status(400).json({ error: 'Import id ontbreekt.' });
  }

  try {
    const batch = await prisma.importBatch.findFirst({
      where: { id: batchId, userId },
      select: {
        filename: true,
        fileType: true,
        originalFile: true,
        fileSha256: true,
      },
    });

    if (!batch) {
      return res.status(404).json({ error: 'Importbestand niet gevonden.' });
    }

    const download = buildImportFileDownload(batch);
    if (!download) {
      return res.status(404).json({ error: 'Het originele importbestand is niet opgeslagen voor deze import.' });
    }

    res.setHeader('Content-Type', download.contentType);
    res.setHeader('Content-Disposition', buildContentDisposition(download.filename));
    if (download.sha256) {
      res.setHeader('X-File-Sha256', download.sha256);
    }

    return res.send(download.body);
  } catch (error) {
    console.error('Import batch download failed', error);
    return res.status(500).json({ error: 'Importbestand kon niet worden gedownload.' });
  }
};
