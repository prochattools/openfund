import type { Request, Response } from 'express';
import { requireAuthenticatedRequest } from '../auth/requestContext';
import {
  MerchantKnowledgeAccessError,
  getMerchantKnowledgeMerchantDetail,
  getMerchantKnowledgeSummary,
  listMerchantKnowledgeMerchants,
} from '../services/merchantKnowledgeQueryService';
import { readRouteParam } from './routeParams';

const sendMerchantKnowledgeError = (res: Response, error: unknown) => {
  if (error instanceof MerchantKnowledgeAccessError) {
    const status = error.code === 'disabled' || error.code === 'misconfigured' ? 503 : 403;
    return res.status(status).json({
      error: error.message,
      code: error.code,
      readOnly: true,
      createsTransactionBooking: false,
      mutatesBankFacts: false,
    });
  }
  console.error('Merchant Knowledge kon niet worden gelezen', error);
  return res.status(500).json({ error: 'Merchant Knowledge kon niet worden gelezen.' });
};

export const getMerchantKnowledgeSummaryRoute = async (req: Request, res: Response) => {
  const actor = await requireAuthenticatedRequest(req, res);
  if (!actor) return;
  try {
    return res.json(await getMerchantKnowledgeSummary(actor));
  } catch (error) {
    return sendMerchantKnowledgeError(res, error);
  }
};

export const listMerchantKnowledgeMerchantsRoute = async (req: Request, res: Response) => {
  const actor = await requireAuthenticatedRequest(req, res);
  if (!actor) return;
  try {
    return res.json(await listMerchantKnowledgeMerchants(actor, {
      page: req.query.page,
      pageSize: req.query.pageSize,
      status: req.query.status,
      query: req.query.query,
    }));
  } catch (error) {
    return sendMerchantKnowledgeError(res, error);
  }
};

export const getMerchantKnowledgeMerchantDetailRoute = async (req: Request, res: Response) => {
  const actor = await requireAuthenticatedRequest(req, res);
  if (!actor) return;
  const merchantId = readRouteParam(req, 'id');
  if (!merchantId) return res.status(400).json({ error: 'Merchant-id ontbreekt.' });
  try {
    const result = await getMerchantKnowledgeMerchantDetail(actor, merchantId);
    if (!result.merchant) return res.status(404).json(result);
    return res.json(result);
  } catch (error) {
    return sendMerchantKnowledgeError(res, error);
  }
};
