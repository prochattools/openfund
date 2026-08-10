import { Request, Response } from 'express';
import { LockedPeriodError, processImportBuffer } from '../services/importService';
import { LedgerMismatchError, MissingOpeningBalanceError } from '../services/reconciliationService';
import { requireAdmin } from '../auth/requestContext';
import { prisma } from '../prismaClient';
import { importMonthlyStatementPackage, MonthlyStatementPackageError } from '../services/monthlyStatementPackageService';
import { IngStatementPdfError } from '../services/ingStatementPdfService';
import {
  buildMonthlyImportPreview,
  MonthlyImportPreviewError,
  type MonthlyImportPreview,
} from '../services/monthlyImportPreviewService';

const ALLOWED_MIME_TYPES = new Set([
  'text/csv',
  'application/csv',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]);

export const isAllowedUpload = (file: Pick<Express.Multer.File, 'originalname' | 'mimetype'>): boolean => {
  const filename = file.originalname.toLowerCase();
  const extensionAllowed =
    filename.endsWith('.csv') ||
    filename.endsWith('.xlsx') ||
    filename.endsWith('.xlsm') ||
    filename.endsWith('.xls');

  if (!file.mimetype) {
    return extensionAllowed;
  }

  return ALLOWED_MIME_TYPES.has(file.mimetype) || extensionAllowed;
};

export const isAllowedStatementCsvUpload = (file: Pick<Express.Multer.File, 'originalname' | 'mimetype'>): boolean => {
  const filename = file.originalname.toLowerCase();
  const mediaType = (file.mimetype ?? '').toLowerCase().split(';')[0]?.trim() ?? '';
  return filename.endsWith('.csv') && (!mediaType || ['text/csv', 'application/csv', 'application/vnd.ms-excel'].includes(mediaType));
};

export const isAllowedStatementPdfUpload = (file: Pick<Express.Multer.File, 'originalname' | 'mimetype'>): boolean => {
  const filename = file.originalname.toLowerCase();
  const mediaType = (file.mimetype ?? '').toLowerCase().split(';')[0]?.trim() ?? '';
  return filename.endsWith('.pdf') && (!mediaType || mediaType === 'application/pdf');
};

export const isAllowedMonthlyImportPreviewUpload = (
  file: Pick<Express.Multer.File, 'originalname' | 'mimetype'>,
): boolean => {
  const filename = file.originalname.toLowerCase();
  const mediaType = (file.mimetype ?? '').toLowerCase().split(';')[0]?.trim() ?? '';
  return filename.endsWith('.csv') && ['text/csv', 'application/csv', 'application/vnd.ms-excel'].includes(mediaType);
};

const getDutchErrorMessage = (error: unknown): string => {
  if (error instanceof LockedPeriodError) {
    return 'Deze maand is vergrendeld. Ontgrendel de maand voordat je opnieuw importeert.';
  }
  if (error instanceof MissingOpeningBalanceError) {
    return 'De beginbalans ontbreekt. Vul eerst de beginbalans in voordat je deze maand importeert.';
  }
  if (error instanceof LedgerMismatchError) {
    return 'De totalen sluiten niet aan op het verwachte saldo. Controleer de import en de beginbalans.';
  }
  if (error instanceof Error && /parse|header|column|csv|xlsx|row/i.test(error.message)) {
    return 'Dit bestand kan niet worden ingelezen. Upload een ING-exportbestand in het juiste formaat.';
  }
  return 'De import is niet gelukt. Controleer het bestand en probeer het opnieuw.';
};

export type ImportUploadResponseSummary = {
  importedCount: number;
  duplicateCount: number;
  errorCount: number;
  autoCategorizedCount: number;
  pendingReviewCount: number;
};

export const buildImportUploadResponse = <T extends ImportUploadResponseSummary>(summary: T): T & { message: string } => ({
  ...summary,
  message: buildImportMessage(summary),
});

export const buildMonthlyImportPreviewUploadResponse = (preview: MonthlyImportPreview) => ({
  preview,
  message: 'Importvoorbeeld gemaakt. Er zijn nog geen transacties geboekt.',
});

const parseOptionalDate = (value: unknown): Date | null => {
  if (typeof value !== 'string' || !value.trim()) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

export const handleStatementPackageImport = async (req: Request, res: Response) => {
  const actor = await requireAdmin(req, res);
  if (!actor) return;

  const files = req.files as Record<string, Express.Multer.File[]> | undefined;
  const csv = files?.csv?.[0];
  const pdf = files?.pdf?.[0];

  if (!csv) return res.status(400).json({ error: 'Selecteer eerst de ING CSV met transacties.', code: 'CSV_REQUIRED' });
  if (!pdf) return res.status(400).json({ error: 'Selecteer eerst het bijbehorende ING PDF-bankafschrift.', code: 'PDF_REQUIRED' });
  if (!isAllowedStatementCsvUpload(csv)) return res.status(400).json({ error: 'Het transactiebestand moet een ING CSV-bestand zijn.', code: 'CSV_TYPE_INVALID' });
  if (!isAllowedStatementPdfUpload(pdf)) return res.status(400).json({ error: 'Het bankafschrift moet een PDF-bestand zijn.', code: 'PDF_TYPE_INVALID' });
  if (!csv.buffer?.length) return res.status(400).json({ error: 'Het CSV-bestand is leeg.', code: 'CSV_EMPTY' });
  if (!pdf.buffer?.length) return res.status(400).json({ error: 'Het PDF-bankafschrift is leeg.', code: 'PDF_EMPTY' });

  try {
    const result = await prisma.$transaction((tx) => importMonthlyStatementPackage({
      db: tx,
      userId: actor.userId,
      workspaceId: actor.workspaceId,
      csv: { buffer: csv.buffer, filename: csv.originalname, mediaType: csv.mimetype },
      pdf: { buffer: pdf.buffer, filename: pdf.originalname, mediaType: pdf.mimetype },
    }), { timeout: 60_000 });

    const message = result.status === 'ALREADY_IMPORTED'
      ? 'Dit bankafschrift is al geïmporteerd. Er zijn geen nieuwe transacties toegevoegd.'
      : result.status === 'EVIDENCE_BACKFILLED'
        ? 'Bankafschriftbewijs toegevoegd aan de bestaande transacties. Er zijn geen transacties gewijzigd.'
        : `Maandafschrift geïmporteerd. ${result.importedCount} transacties toegevoegd en banktotalen exact gecontroleerd.`;

    return res.json({
      ...result,
      message,
      periodStart: result.periodStart.toISOString(),
      periodEnd: result.periodEnd.toISOString(),
    });
  } catch (error) {
    const statusCode = error instanceof MonthlyStatementPackageError
      ? error.statusCode
      : error instanceof IngStatementPdfError
        ? error.statusCode
        : 500;
    const message = error instanceof MonthlyStatementPackageError || error instanceof IngStatementPdfError
      ? error.message
      : 'Het maandafschrift kon niet veilig worden verwerkt.';
    const code = error instanceof MonthlyStatementPackageError ? error.code : undefined;
    console.error('Maandafschriftpakket kon niet worden verwerkt', { code, message });
    return res.status(statusCode).json({ error: message, code });
  }
};

export const handleImportUpload = async (req: Request, res: Response) => {
  const actor = await requireAdmin(req, res);
  if (!actor) {
    return;
  }

  if (!req.file) {
    return res.status(400).json({
      error: 'Upload eerst een ING-exportbestand.',
    });
  }

  if (!isAllowedUpload(req.file)) {
    return res.status(400).json({
      error: 'Dit bestandstype wordt niet ondersteund. Upload een ING CSV- of Excel-exportbestand.',
    });
  }

  if (!req.file.buffer?.length) {
    return res.status(400).json({
      error: 'Dit bestand is leeg. Upload een ING-exportbestand met transacties.',
    });
  }

  const userId = actor.userId;

  try {
    const summary = await processImportBuffer({
      buffer: req.file.buffer,
      filename: req.file.originalname,
      userId,
    });

    return res.json(buildImportUploadResponse(summary));
  } catch (error) {
    console.error('Import upload kon niet worden verwerkt', error);
    const message = getDutchErrorMessage(error);

    if (error instanceof LockedPeriodError) {
      return res.status(423).json({ error: message });
    }
    if (error instanceof MissingOpeningBalanceError) {
      return res.status(400).json({ error: message, details: error.details });
    }
    if (error instanceof LedgerMismatchError) {
      return res.status(409).json({ error: message, details: error.details });
    }

    return res.status(400).json({ error: message });
  }
};

export const handleMonthlyImportPreviewUpload = async (req: Request, res: Response) => {
  const actor = await requireAdmin(req, res);
  if (!actor) {
    return;
  }

  if (!req.file) {
    return res.status(400).json({
      error: 'Upload eerst een ING CSV-bestand.',
    });
  }

  if (!isAllowedMonthlyImportPreviewUpload(req.file)) {
    return res.status(400).json({
      error: 'Dit bestandstype wordt niet ondersteund. Upload een ING CSV-bestand.',
    });
  }

  if (!req.file.buffer?.length) {
    return res.status(400).json({
      error: 'Dit CSV-bestand is leeg.',
    });
  }

  try {
    const accountId = typeof req.body?.accountId === 'string' && req.body.accountId.trim()
      ? req.body.accountId.trim()
      : null;
    const accountIdentifier = typeof req.body?.accountIdentifier === 'string' && req.body.accountIdentifier.trim()
      ? req.body.accountIdentifier.trim()
      : null;
    const preview = await buildMonthlyImportPreview({
      workspaceId: actor.userId,
      accountId,
      accountIdentifier,
      actorId: actor.actorId,
      originalFilename: req.file.originalname,
      mediaType: req.file.mimetype,
      retainedCsvBytes: req.file.buffer,
      expectedPeriodStart: parseOptionalDate(req.body?.periodStart),
      expectedPeriodEnd: parseOptionalDate(req.body?.periodEnd),
    }, {
      findExistingImportFingerprints: async ({ workspaceId, accountId: scopedAccountId, fingerprints }) => {
        const existing = await prisma.transaction.findMany({
          where: {
            userId: workspaceId,
            importFingerprint: {
              in: fingerprints,
            },
            ...(scopedAccountId ? { accountId: scopedAccountId } : {}),
          },
          select: {
            importFingerprint: true,
          },
        });
        return existing
          .map((transaction) => transaction.importFingerprint)
          .filter((fingerprint): fingerprint is string => Boolean(fingerprint));
      },
    });

    return res.json(buildMonthlyImportPreviewUploadResponse(preview));
  } catch (error) {
    const message = error instanceof MonthlyImportPreviewError
      ? error.message
      : 'Het importvoorbeeld kon niet worden gemaakt. Controleer het ING CSV-bestand.';
    const statusCode = error instanceof MonthlyImportPreviewError ? error.statusCode : 400;
    console.error('Importvoorbeeld kon niet worden verwerkt', { message });
    return res.status(statusCode).json({ error: message });
  }
};

export const buildImportMessage = (summary: {
  importedCount: number;
  duplicateCount: number;
  errorCount: number;
  autoCategorizedCount: number;
  pendingReviewCount: number;
}) => {
  const parts: string[] = [];

  if (summary.importedCount === 1) {
    parts.push('1 transactie toegevoegd');
  } else {
    parts.push(`${summary.importedCount} transacties toegevoegd`);
  }

  if (summary.autoCategorizedCount === 1) {
    parts.push('1 transactie automatisch gecategoriseerd');
  } else if (summary.autoCategorizedCount > 1) {
    parts.push(`${summary.autoCategorizedCount} transacties automatisch gecategoriseerd`);
  }

  if (summary.pendingReviewCount === 1) {
    parts.push('1 transactie staat klaar om te beoordelen');
  } else if (summary.pendingReviewCount > 1) {
    parts.push(`${summary.pendingReviewCount} transacties staan klaar om te beoordelen`);
  }

  if (summary.duplicateCount === 1) {
    parts.push('1 dubbele transactie genegeerd');
  } else if (summary.duplicateCount > 1) {
    parts.push(`${summary.duplicateCount} dubbele transacties genegeerd`);
  }

  if (summary.errorCount === 1) {
    parts.push('1 rij kon niet worden verwerkt');
  } else if (summary.errorCount > 1) {
    parts.push(`${summary.errorCount} rijen konden niet worden verwerkt`);
  }

  return `Import voltooid. ${parts.join('. ')}.`;
};
