import { Request, Response } from 'express';
import { getRequestActor } from '../auth/requestContext';
import { computeReconciliation } from '../services/reconciliationService';

export const getReconciliation = async (req: Request, res: Response) => {
  const { userId } = getRequestActor(req);
  const accountId = req.query.accountId;

  if (typeof accountId !== 'string' || !accountId) {
    return res.status(400).json({ error: 'Rekening is verplicht voor reconciliatie.' });
  }

  const month = req.query.month ? Number(req.query.month) : undefined;
  const year = req.query.year ? Number(req.query.year) : undefined;
  const { start, end } = req.query;

  try {
    const result = await computeReconciliation({
      userId,
      accountId,
      month: Number.isFinite(month) ? month : undefined,
      year: Number.isFinite(year) ? year : undefined,
      start: typeof start === 'string' ? start : undefined,
      end: typeof end === 'string' ? end : undefined,
    });

    return res.json(result);
  } catch (error) {
    console.error('Reconciliatie kon niet worden berekend', error);
    return res.status(500).json({ error: 'Reconciliatie kon niet worden berekend.' });
  }
};
