import { Request, Response } from 'express';
import { LockedPeriodError, processImportBuffer } from '../services/importService';
import { LedgerMismatchError, MissingOpeningBalanceError } from '../services/reconciliationService';
import { requireAdmin } from '../auth/requestContext';

const DEFAULT_USER_ID = process.env.DEFAULT_USER_ID ?? 'demo-user';
const ALLOWED_MIME_TYPES = new Set([
  'text/csv',
  'application/csv',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]);

const isAllowedUpload = (file: Express.Multer.File): boolean => {
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

export const handleImportUpload = async (req: Request, res: Response) => {
  const actor = requireAdmin(req, res);
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

    return res.json({
      ...summary,
      message: buildImportMessage(summary),
    });
  } catch (error) {
    console.error('Import upload failed', error);
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
