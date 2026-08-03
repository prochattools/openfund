import type { Request, Response } from 'express';
import { prisma } from '../prismaClient';
import { requireAdmin } from '../auth/requestContext';
import {
  executeDirectionInferencePlan,
  inferTransactionTypeDirections,
} from '../services/transactionTypeDirectionInferenceService';
import {
  buildOwnerHistoryProposalPlan,
  executeOwnerHistoryProposalPlan,
} from '../services/ownerHistoryProposalEvidenceService';
import { auditHistoricalTransactionTypeDirections } from '../services/transactionTypeDirectionUsageAuditService';

const resolveWorkspace = (res: Response): string | null => {
  const workspaceId = process.env.DEFAULT_WORKSPACE_ID?.trim();
  if (!workspaceId) {
    res.status(503).json({ error: 'Werkruimte niet geconfigureerd.' });
    return null;
  }
  return workspaceId;
};

// POST /api/operator/direction-inference
// Dry-run or guarded execution of direction inference.
// Body: { execute?: boolean, confirmedPlanHash?: string }
// Requires: admin + ALLOW_DIRECTION_INFERENCE_EXECUTION=true env var for writes.
export const postDirectionInference = async (req: Request, res: Response) => {
  const actor = await requireAdmin(req, res);
  if (!actor) return;

  const workspaceId = resolveWorkspace(res);
  if (!workspaceId) return;

  const body = (req.body ?? {}) as { execute?: boolean; confirmedPlanHash?: string };
  const execute = body.execute === true;

  try {
    if (!execute) {
      const plan = await inferTransactionTypeDirections(prisma, { workspaceId });
      return res.json({
        status: 'DRY_RUN_COMPLETE',
        dryRun: true,
        writesPerformed: false,
        algorithmVersion: plan.algorithmVersion,
        planHash: plan.planHash,
        counts: plan.counts,
        sideEffects: plan.sideEffects,
      });
    }

    const result = await executeDirectionInferencePlan(prisma, {
      workspaceId,
      execute,
      executionAllowed: process.env.ALLOW_DIRECTION_INFERENCE_EXECUTION === 'true',
      confirmedPlanHash: body.confirmedPlanHash?.trim() || null,
    });

    const statusCode = result.status === 'APPLIED' ? 200
      : result.status === 'HASH_DRIFT' ? 409
      : result.status === 'EXECUTION_NOT_ALLOWED' ? 403
      : result.status === 'CONFIRMATION_REQUIRED' ? 422
      : 200;

    return res.status(statusCode).json({
      status: result.status,
      dryRun: result.dryRun,
      writesPerformed: result.writesPerformed,
      updatedCount: result.updatedCount,
      skippedAlreadySetCount: result.skippedAlreadySetCount,
      algorithmVersion: result.plan.algorithmVersion,
      planHash: result.plan.planHash,
      counts: result.plan.counts,
      sideEffects: result.sideEffects,
    });
  } catch (error) {
    console.error('Direction inference failed', error);
    return res.status(500).json({
      error: 'De richtingsinferentie kon niet worden berekend.',
      writesPerformed: false,
    });
  }
};

// POST /api/operator/owner-history-proposals
// Dry-run or guarded execution of owner-history suggestion seeding.
// Body: { execute?: boolean, confirmedPlanHash?: string }
// Requires: admin + ALLOW_OWNER_HISTORY_PROPOSAL_EXECUTION=true env var for writes.
export const postOwnerHistoryProposals = async (req: Request, res: Response) => {
  const actor = await requireAdmin(req, res);
  if (!actor) return;

  const workspaceId = resolveWorkspace(res);
  if (!workspaceId) return;

  const body = (req.body ?? {}) as { execute?: boolean; confirmedPlanHash?: string };
  const execute = body.execute === true;

  try {
    if (!execute) {
      const plan = await buildOwnerHistoryProposalPlan(prisma, { workspaceId, userId: actor.userId });
      return res.json({
        status: 'DRY_RUN_COMPLETE',
        dryRun: true,
        writesPerformed: false,
        algorithmVersion: plan.algorithmVersion,
        planHash: plan.planHash,
        counts: plan.counts,
        matcherDistribution: plan.matcherDistribution,
        confidenceDistribution: plan.confidenceDistribution,
        persistence: plan.persistence,
        provenanceProof: plan.provenanceProof,
        sideEffects: plan.sideEffects,
      });
    }

    const result = await executeOwnerHistoryProposalPlan(prisma, {
      workspaceId,
      userId: actor.userId,
      execute,
      executionAllowed: process.env.ALLOW_OWNER_HISTORY_PROPOSAL_EXECUTION === 'true',
      confirmedPlanHash: body.confirmedPlanHash?.trim() || null,
    });

    const statusCode = result.status === 'CREATED' ? 201
      : result.status === 'HASH_DRIFT' ? 409
      : result.status === 'EXECUTION_NOT_ALLOWED' ? 403
      : result.status === 'CONFIRMATION_REQUIRED' ? 422
      : 200;

    return res.status(statusCode).json({
      status: result.status,
      dryRun: result.dryRun,
      writesPerformed: result.writesPerformed,
      expiredSuggestionCount: result.expiredSuggestionCount,
      createdSuggestionCount: result.createdSuggestionCount,
      algorithmVersion: result.plan.algorithmVersion,
      planHash: result.plan.planHash,
      counts: result.plan.counts,
      matcherDistribution: result.plan.matcherDistribution,
      confidenceDistribution: result.plan.confidenceDistribution,
      persistence: result.plan.persistence,
      provenanceProof: result.plan.provenanceProof,
      sideEffects: result.sideEffects,
    });
  } catch (error) {
    console.error('Owner history proposal failed', error);
    return res.status(500).json({
      error: 'De eigenaar-geschiedenis-voorstellen konden niet worden berekend.',
      writesPerformed: false,
    });
  }
};

// POST /api/operator/transaction-type-direction-usage-audit
// Read-only, privacy-safe aggregate audit of factual historical directions.
export const postTransactionTypeDirectionUsageAudit = async (req: Request, res: Response) => {
  const actor = await requireAdmin(req, res);
  if (!actor) return;

  const workspaceId = resolveWorkspace(res);
  if (!workspaceId) return;

  try {
    const audit = await auditHistoricalTransactionTypeDirections(prisma, { workspaceId });
    return res.json({
      status: 'DRY_RUN_COMPLETE',
      dryRun: true,
      writesPerformed: false,
      algorithmVersion: audit.algorithmVersion,
      scopeHash: audit.scopeHash,
      reportHash: audit.reportHash,
      totals: audit.totals,
      buckets: audit.buckets,
      sideEffects: audit.sideEffects,
    });
  } catch (error) {
    console.error('Transaction type direction usage audit failed', error);
    return res.status(500).json({
      error: 'De richtingsaudit kon niet worden berekend.',
      writesPerformed: false,
    });
  }
};
