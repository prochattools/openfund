import { Request, Response } from 'express';
import { prisma } from '../prismaClient';
import { getRequestActor } from '../auth/requestContext';
import { readRouteParam } from './routeParams';

export const readImportBatchLimit = (value: unknown): number => {
  const parsed = Number(value);
  if (Number.isInteger(parsed) && parsed > 0 && parsed <= 100) {
    return parsed;
  }
  return 25;
};

export const listImportBatches = async (req: Request, res: Response) => {
  const { userId } = getRequestActor(req);
  const limit = readImportBatchLimit(req.query.limit);

  try {
    const batches = await prisma.importBatch.findMany({
      where: { userId },
      orderBy: { startedAt: 'desc' },
      take: limit,
    });

    return res.json(
      batches.map((batch) => ({
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
      })),
    );
  } catch (error) {
    console.error('Import batch fetch failed', error);
    return res.status(500).json({ error: 'Importgeschiedenis kon niet worden geladen.' });
  }
};


export const downloadImportBatchFile = async (req: Request, res: Response) => {
  const { userId } = getRequestActor(req);
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

    if (!batch.originalFile) {
      return res.status(404).json({ error: 'Het originele importbestand is niet opgeslagen voor deze import.' });
    }

    const contentType = batch.fileType === 'xlsx_initial'
      ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      : 'text/csv; charset=utf-8';

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(batch.filename)}"`);
    if (batch.fileSha256) {
      res.setHeader('X-File-Sha256', batch.fileSha256);
    }

    return res.send(Buffer.from(batch.originalFile));
  } catch (error) {
    console.error('Import batch download failed', error);
    return res.status(500).json({ error: 'Importbestand kon niet worden gedownload.' });
  }
};