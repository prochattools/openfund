import type { Request, Response } from 'express';
import { requireAdmin, requireAuthenticatedRequest } from '../auth/requestContext';
import {
  MerchantKnowledgeAccessError,
  getMerchantKnowledgeMerchantDetail,
  getMerchantKnowledgeSummary,
  listMerchantKnowledgeMerchants,
} from '../services/merchantKnowledgeQueryService';
import {
  MerchantKnowledgePreviewError,
  previewMerchantKnowledgePlan,
  type MerchantKnowledgePreviewRequest,
} from '../services/merchantKnowledgePreviewService';
import {
  MerchantAliasDeprecationError,
  confirmMerchantAliasDeprecation,
  type MerchantAliasDeprecationConfirmationRequest,
} from '../services/merchantAliasDeprecationDecisionService';
import {
  MerchantDeprecationError,
  confirmMerchantDeprecation,
  type MerchantDeprecationConfirmationRequest,
} from '../services/merchantDeprecationDecisionService';
import {
  MerchantConflictDecisionError,
  confirmMerchantConflictResolution,
  type MerchantConflictConfirmationRequest,
} from '../services/merchantConflictDecisionService';
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

export const previewMerchantKnowledgePlanRoute = async (req: Request, res: Response) => {
  const actor = await requireAdmin(req, res);
  if (!actor) return;
  try {
    return res.json(await previewMerchantKnowledgePlan(actor, req.body as MerchantKnowledgePreviewRequest));
  } catch (error) {
    if (error instanceof MerchantKnowledgePreviewError) {
      const status = error.code === 'invalid_input' ? 400
        : error.code === 'not_found' ? 404
          : error.code === 'forbidden' ? 403
            : 503;
      return res.status(status).json({
        error: error.message,
        code: error.code,
        previewOnly: true,
        readOnly: true,
        createsTransactionBooking: false,
        mutatesBankFacts: false,
        persistsMerchantKnowledge: false,
      });
    }
    console.error('Merchant Knowledge-planpreview kon niet worden opgebouwd', error);
    return res.status(500).json({ error: 'Merchant Knowledge-planpreview kon niet worden opgebouwd.' });
  }
};

export const confirmMerchantAliasDeprecationRoute = async (req: Request, res: Response) => {
  const actor = await requireAdmin(req, res);
  if (!actor) return;

  const aliasId = readRouteParam(req, 'aliasId');
  if (!aliasId) return res.status(400).json({ error: 'Alias-ID ontbreekt.', code: 'invalid_input' });

  try {
    const result = await confirmMerchantAliasDeprecation(actor, {
      ...(req.body as MerchantAliasDeprecationConfirmationRequest),
      aliasId,
    });
    return res.status(200).json({
      ...result,
      deprecatedAt: result.deprecatedAt.toISOString(),
    });
  } catch (error) {
    if (error instanceof MerchantAliasDeprecationError) {
      return res.status(error.statusCode).json({
        error: error.message,
        code: error.code,
        action: 'DEPRECATE_ALIAS',
        confirmed: false,
        persistsMerchantKnowledge: false,
        createsTransactionBooking: false,
        mutatesBankFacts: false,
        mutatesFinancialRecords: false,
      });
    }
    console.error('Aliasdeprecatie kon niet worden bevestigd', error);
    return res.status(500).json({
      error: 'Aliasdeprecatie kon niet worden bevestigd.',
      code: 'internal_error',
      confirmed: false,
      createsTransactionBooking: false,
      mutatesBankFacts: false,
      mutatesFinancialRecords: false,
    });
  }
};

export const confirmMerchantDeprecationRoute = async (req: Request, res: Response) => {
  const actor = await requireAdmin(req, res);
  if (!actor) return;

  const merchantId = readRouteParam(req, 'merchantId') || readRouteParam(req, 'id');
  if (!merchantId) return res.status(400).json({ error: 'Merchant-ID ontbreekt.', code: 'invalid_input' });

  try {
    const result = await confirmMerchantDeprecation(actor, {
      ...(req.body as MerchantDeprecationConfirmationRequest),
      merchantId,
    });
    return res.status(200).json({
      ...result,
      deprecatedAt: result.deprecatedAt.toISOString(),
    });
  } catch (error) {
    if (error instanceof MerchantDeprecationError) {
      return res.status(error.statusCode).json({
        error: error.message,
        code: error.code,
        action: 'DEPRECATE_MERCHANT',
        confirmed: false,
        persistsMerchantKnowledge: false,
        cascadesAliases: false,
        cascadesFingerprints: false,
        createsTransactionBooking: false,
        mutatesBankFacts: false,
        mutatesFinancialRecords: false,
      });
    }
    console.error('Merchantdeprecatie kon niet worden bevestigd', error);
    return res.status(500).json({
      error: 'Merchantdeprecatie kon niet worden bevestigd.',
      code: 'internal_error',
      confirmed: false,
      cascadesAliases: false,
      cascadesFingerprints: false,
      createsTransactionBooking: false,
      mutatesBankFacts: false,
      mutatesFinancialRecords: false,
    });
  }
};




export const confirmMerchantConflictResolutionRoute = async (req: Request, res: Response) => {
  const actor = await requireAdmin(req, res);
  if (!actor) return;

  const conflictId = readRouteParam(req, 'conflictId') || readRouteParam(req, 'id');
  if (!conflictId) return res.status(400).json({ error: 'Conflict-ID ontbreekt.', code: 'invalid_input' });

  try {
    const result = await confirmMerchantConflictResolution(actor, {
      ...(req.body as MerchantConflictConfirmationRequest),
      conflictId,
    });
    return res.status(200).json({
      ...result,
      resolvedAt: result.resolvedAt.toISOString(),
    });
  } catch (error) {
    if (error instanceof MerchantConflictDecisionError) {
      return res.status(error.statusCode).json({
        error: error.message,
        code: error.code,
        action: 'RESOLVE_CONFLICT',
        confirmed: false,
        persistsMerchantKnowledge: false,
        trustsAliases: false,
        trustsFingerprints: false,
        mutatesMerchants: false,
        createsTransactionBooking: false,
        mutatesBankFacts: false,
        mutatesFinancialRecords: false,
      });
    }
    console.error('Conflictbevestiging kon niet worden uitgevoerd', error);
    return res.status(500).json({
      error: 'Conflictbevestiging kon niet worden uitgevoerd.',
      code: 'internal_error',
      confirmed: false,
      trustsAliases: false,
      trustsFingerprints: false,
      mutatesMerchants: false,
      createsTransactionBooking: false,
      mutatesBankFacts: false,
      mutatesFinancialRecords: false,
    });
  }
};
