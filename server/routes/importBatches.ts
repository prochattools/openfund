import { Request, Response } from 'express';
import { prisma } from '../prismaClient';
import { getRequestActor } from '../auth/requestContext';

const readLimit = (value: unknown): number => {
  const parsed = Number(value);
  if (Number.isInteger(parsed) && parsed > 0 && parsed <= 100) {
    return parsed;
  }
  return 25;
};

export const listImportBatches = async (req: Request, res: Response) => {
  const { userId } = getRequestActor(req);
  const limit = readLimit(req.query.limit);

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
