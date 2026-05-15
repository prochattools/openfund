import { Request, Response } from 'express';
import { getRequestActor } from '../auth/requestContext';
import { computeReconciliation } from '../services/reconciliationService';
import { readOptionalNumber, readOptionalString } from './queryParams';

export const getReconciliation = async (req: Request, res: Response) => {
  const { userId } = getRequestActor(req);
  const accountId = req.query.accountId;

  if (typeof accountId !== 'string' || !accountId) {
    return res.status(400).json({ error: 'Rekening is verplicht voor reconciliatie.' });
  }

  const month = readOptionalNumber(req.query.month);
  const year = readOptionalNumber(req.query.year);

  try {
    const result = await computeReconciliation({
      userId,
      accountId,
      month,
      year,
      start: readOptionalString(req.query.start),
      end: readOptionalString(req.query.end),
    });

    return res.json(result);
  } catch (error) {
    console.error('Reconciliatie kon niet worden berekend', error);
    return res.status(500).json({ error: 'Reconciliatie kon niet worden berekend.' });
  }
};
