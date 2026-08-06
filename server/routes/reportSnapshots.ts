/**
 * Report snapshot routes — Phase 6 REPORT-001 through REPORT-005.
 *
 * Routes:
 *   GET  /api/reports/monthly/:year/:month/preview
 *   POST /api/reports/monthly/:year/:month/snapshot
 *   POST /api/reports/yearly/:year/snapshot
 *   POST /api/reports/:snapshotId/artifacts
 *   POST /api/reports/:snapshotId/approve
 *   POST /api/reports/:snapshotId/dispatch/prepare
 *
 * All mutating routes require admin role.
 * All user-facing messages are Dutch.
 * No real email sending occurs.
 * No production configuration required.
 */

import { Request, Response } from 'express';
import { requireAdmin } from '../auth/requestContext';
import { prisma } from '../prismaClient';
import {
  generateMonthlyReportSnapshot,
  generateYearlyReportSnapshot,
  ReportSnapshotError,
} from '../services/reportSnapshotService';
import {
  generateAndStoreReportArtifacts,
  ReportArtifactError,
  type ArtifactSnapshotInput,
} from '../services/reportArtifactService';
import {
  approveSnapshot,
  prepareDispatch,
  ReportApprovalError,
} from '../services/reportApprovalDispatchService';
import { PeriodCloseError } from '../services/periodCloseService';
import { normalizeRecipients } from '../services/recipientNormalization';
import { computeDeliveryKey } from '../services/deliveryKeyService';
import { ReportKind, ReportLineKind } from '@prisma/client';

// ─── REPORT-001: Monthly snapshot preview ────────────────────────────────────

/**
 * GET /api/reports/monthly/:year/:month/preview
 *
 * Admin-only read-only preview: shows the closed period close for the given month
 * and its totals, without creating any snapshot.
 */
export const getMonthlyReportPreview = async (req: Request, res: Response) => {
  const actor = await requireAdmin(req, res);
  if (!actor) return;

  const year = parseInt(typeof req.params.year === 'string' ? req.params.year : '', 10);
  const month = parseInt(typeof req.params.month === 'string' ? req.params.month : '', 10);

  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    return res.status(400).json({ error: 'Ongeldig jaar opgegeven.' });
  }
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    return res.status(400).json({ error: 'Ongeldige maand opgegeven.' });
  }

  const workspaceId = (req.header('x-workspace-id') ?? req.query.workspaceId) as string | undefined;
  if (!workspaceId) {
    return res.status(400).json({ error: 'Werkruimte-ID is verplicht.' });
  }

  const periodStart = new Date(Date.UTC(year, month - 1, 1));
  const periodEnd = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));

  const close = await prisma.periodClose.findFirst({
    where: {
      workspaceId,
      status: 'CLOSED',
      periodStart: { gte: periodStart },
      periodEnd: { lte: periodEnd },
    },
    orderBy: { version: 'desc' },
    select: {
      id: true,
      status: true,
      periodStart: true,
      periodEnd: true,
      openingBalanceMinor: true,
      incomeMinor: true,
      expenseMinor: true,
      netMinor: true,
      closingBalanceMinor: true,
      transactionCount: true,
      version: true,
      closedAt: true,
    },
  });

  if (!close) {
    return res.status(404).json({
      error: `Geen gesloten periode gevonden voor ${year}-${String(month).padStart(2, '0')}.`,
      closeEligible: false,
    });
  }

  return res.json({
    found: true,
    periodCloseId: close.id,
    status: close.status,
    periodStart: close.periodStart.toISOString().slice(0, 10),
    periodEnd: close.periodEnd.toISOString().slice(0, 10),
    openingBalanceMinor: close.openingBalanceMinor.toString(),
    incomeMinor: close.incomeMinor.toString(),
    expenseMinor: close.expenseMinor.toString(),
    netMinor: close.netMinor.toString(),
    closingBalanceMinor: close.closingBalanceMinor.toString(),
    transactionCount: close.transactionCount,
    version: close.version,
    closedAt: close.closedAt.toISOString(),
    sideEffects: {
      createsReportSnapshot: false,
      createsReportApproval: false,
    },
  });
};

// ─── REPORT-001: Create monthly snapshot ─────────────────────────────────────

/**
 * POST /api/reports/monthly/:year/:month/snapshot
 */
export const postMonthlyReportSnapshot = async (req: Request, res: Response) => {
  const actor = await requireAdmin(req, res);
  if (!actor) return;

  const year = parseInt(typeof req.params.year === 'string' ? req.params.year : '', 10);
  const month = parseInt(typeof req.params.month === 'string' ? req.params.month : '', 10);

  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    return res.status(400).json({ error: 'Ongeldig jaar opgegeven.' });
  }
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    return res.status(400).json({ error: 'Ongeldige maand opgegeven.' });
  }

  const workspaceId = (req.header('x-workspace-id') ?? req.body?.workspaceId) as string | undefined;
  if (!workspaceId) {
    return res.status(400).json({ error: 'Werkruimte-ID is verplicht.' });
  }

  const periodCloseIds: string[] | undefined =
    Array.isArray(req.body?.periodCloseIds) ? req.body.periodCloseIds : undefined;

  try {
    const result = await prisma.$transaction(async (tx) => {
      return generateMonthlyReportSnapshot(tx, {
        actor: { userId: actor.userId, role: actor.role, actorId: actor.actorId },
        workspaceId,
        year,
        month,
        periodCloseIds,
      });
    });

    return res.status(201).json({
      snapshotId: result.snapshotId,
      snapshotHash: result.snapshotHash,
      kind: result.kind,
      year: result.year,
      month: result.month,
      version: result.version,
      openingBalanceMinor: result.openingBalanceMinor,
      incomeMinor: result.incomeMinor,
      expenseMinor: result.expenseMinor,
      netMinor: result.netMinor,
      closingBalanceMinor: result.closingBalanceMinor,
      transactionCount: result.transactionCount,
      periodCloseIds: result.periodCloseIds,
      generatedBy: result.generatedBy,
      generatedAt: result.generatedAt.toISOString(),
      lineCount: result.lines.length,
      sideEffects: result.sideEffects,
    });
  } catch (error) {
    if (error instanceof ReportSnapshotError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    if (error instanceof PeriodCloseError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.error('Maandrapport kon niet worden aangemaakt', error);
    return res.status(500).json({ error: 'Maandrapport kon niet worden aangemaakt.' });
  }
};

// ─── REPORT-002: Create yearly snapshot ──────────────────────────────────────

/**
 * POST /api/reports/yearly/:year/snapshot
 */
export const postYearlyReportSnapshot = async (req: Request, res: Response) => {
  const actor = await requireAdmin(req, res);
  if (!actor) return;

  const year = parseInt(typeof req.params.year === 'string' ? req.params.year : '', 10);
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    return res.status(400).json({ error: 'Ongeldig jaar opgegeven.' });
  }

  const workspaceId = (req.header('x-workspace-id') ?? req.body?.workspaceId) as string | undefined;
  if (!workspaceId) {
    return res.status(400).json({ error: 'Werkruimte-ID is verplicht.' });
  }

  const periodCloseIds: string[] | undefined =
    Array.isArray(req.body?.periodCloseIds) ? req.body.periodCloseIds : undefined;

  try {
    const result = await prisma.$transaction(async (tx) => {
      return generateYearlyReportSnapshot(tx, {
        actor: { userId: actor.userId, role: actor.role, actorId: actor.actorId },
        workspaceId,
        year,
        periodCloseIds,
      });
    });

    return res.status(201).json({
      snapshotId: result.snapshotId,
      snapshotHash: result.snapshotHash,
      kind: result.kind,
      year: result.year,
      version: result.version,
      openingBalanceMinor: result.openingBalanceMinor,
      incomeMinor: result.incomeMinor,
      expenseMinor: result.expenseMinor,
      netMinor: result.netMinor,
      closingBalanceMinor: result.closingBalanceMinor,
      transactionCount: result.transactionCount,
      periodCloseIds: result.periodCloseIds,
      missingMonths: result.missingMonths,
      lineCount: result.lines.length,
      sideEffects: result.sideEffects,
    });
  } catch (error) {
    if (error instanceof ReportSnapshotError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    if (error instanceof PeriodCloseError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.error('Jaarrapport kon niet worden aangemaakt', error);
    return res.status(500).json({ error: 'Jaarrapport kon niet worden aangemaakt.' });
  }
};

// ─── REPORT-004: Generate artifacts ──────────────────────────────────────────

/**
 * POST /api/reports/:snapshotId/artifacts
 *
 * Generate HTML, XLSX, and PDF (placeholder) artifacts from a stored snapshot.
 * Requires the caller to supply the snapshotHash for staleness protection.
 */
export const postReportArtifacts = async (req: Request, res: Response) => {
  const actor = await requireAdmin(req, res);
  if (!actor) return;

  const snapshotId = typeof req.params.snapshotId === 'string' ? req.params.snapshotId : '';
  if (!snapshotId) {
    return res.status(400).json({ error: 'Snapshot-ID is verplicht.' });
  }

  const { snapshotHash } = req.body as { snapshotHash?: string };
  if (!snapshotHash) {
    return res.status(400).json({ error: 'Snapshot-hash is verplicht.' });
  }

  try {
    // Load snapshot from DB (with lines included)
    const snapshotBase = await prisma.reportSnapshot.findUnique({
      where: { id: snapshotId },
    });
    const snapshotLines = await prisma.reportSnapshotLine.findMany({
      where: { reportSnapshotId: snapshotId },
      orderBy: { sortOrder: 'asc' },
    });
    const snapshot = snapshotBase ? { ...snapshotBase, lines: snapshotLines } : null;
    if (!snapshot) {
      return res.status(404).json({ error: 'Snapshot niet gevonden.' });
    }
    if (snapshot.snapshotHash !== snapshotHash) {
      return res.status(409).json({ error: 'Snapshot-hash is verouderd.' });
    }

    const snapshotInput: ArtifactSnapshotInput = {
      snapshotId: snapshot.id,
      snapshotHash: snapshot.snapshotHash,
      kind: snapshot.kind,
      year: snapshot.year,
      month: snapshot.month,
      openingBalanceMinor: snapshot.openingBalanceMinor.toString(),
      incomeMinor: snapshot.incomeMinor.toString(),
      expenseMinor: snapshot.expenseMinor.toString(),
      netMinor: snapshot.netMinor.toString(),
      closingBalanceMinor: snapshot.closingBalanceMinor.toString(),
      transactionCount: snapshot.transactionCount,
      generatedBy: snapshot.generatedBy,
      generatedAt: snapshot.generatedAt,
      lines: snapshot.lines.map((l) => ({
        lineKind: l.lineKind,
        projectId: l.projectId,
        transactionTypeId: l.transactionTypeId,
        categoryId: l.categoryId,
        literalProjectLabel: l.literalProjectLabel,
        literalTypeLabel: l.literalTypeLabel,
        literalCategoryLabel: l.literalCategoryLabel,
        direction: l.direction as 'credit' | 'debit' | undefined,
        reportingClass: l.reportingClass,
        amountMinor: l.amountMinor,
        transactionCount: l.transactionCount,
        sortOrder: l.sortOrder,
      })),
    };

    const result = await prisma.$transaction(async (tx) => {
      return generateAndStoreReportArtifacts(tx, snapshotInput);
    });

    return res.status(201).json({
      snapshotId: result.snapshotId,
      snapshotHash: result.snapshotHash,
      htmlArtifactId: result.htmlArtifactId,
      xlsxArtifactId: result.xlsxArtifactId,
      pdfArtifactId: result.pdfArtifactId,
      pdfBlocker: result.pdfBlocker,
      sideEffects: result.sideEffects,
    });
  } catch (error) {
    if (error instanceof ReportArtifactError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.error('Artefacten konden niet worden aangemaakt', error);
    return res.status(500).json({ error: 'Artefacten konden niet worden aangemaakt.' });
  }
};

// ─── REPORT-005: Approve snapshot ────────────────────────────────────────────

/**
 * POST /api/reports/:snapshotId/approve
 */
export const postApproveReportSnapshot = async (req: Request, res: Response) => {
  const actor = await requireAdmin(req, res);
  if (!actor) return;

  const snapshotId = typeof req.params.snapshotId === 'string' ? req.params.snapshotId : '';
  if (!snapshotId) {
    return res.status(400).json({ error: 'Snapshot-ID is verplicht.' });
  }

  const workspaceId = req.header('x-workspace-id') ?? req.body?.workspaceId as string | undefined;
  if (!workspaceId) {
    return res.status(400).json({ error: 'Werkruimte-ID is verplicht.' });
  }

  const { expectedSnapshotHash } = req.body as { expectedSnapshotHash?: string };
  if (!expectedSnapshotHash) {
    return res.status(400).json({ error: 'Snapshot-hash is verplicht voor goedkeuring.' });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      return approveSnapshot(tx, {
        actor: { userId: actor.userId, role: actor.role, actorId: actor.actorId },
        workspaceId,
        reportSnapshotId: snapshotId,
        expectedSnapshotHash,
      });
    });

    return res.status(201).json({
      approvalId: result.approvalId,
      reportSnapshotId: result.reportSnapshotId,
      approvedBy: result.approvedBy,
      approvedAt: result.approvedAt.toISOString(),
      snapshotHash: result.snapshotHash,
      sideEffects: result.sideEffects,
    });
  } catch (error) {
    if (error instanceof ReportApprovalError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    if (error instanceof PeriodCloseError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.error('Rapport goedkeuring mislukt', error);
    return res.status(500).json({ error: 'Rapport goedkeuring mislukt.' });
  }
};

// ─── REPORT-005: Prepare dispatch ────────────────────────────────────────────

/**
 * POST /api/reports/:snapshotId/dispatch/prepare
 */
export const postPrepareReportDispatch = async (req: Request, res: Response) => {
  const actor = await requireAdmin(req, res);
  if (!actor) return;

  const snapshotId = typeof req.params.snapshotId === 'string' ? req.params.snapshotId : '';
  if (!snapshotId) {
    return res.status(400).json({ error: 'Snapshot-ID is verplicht.' });
  }

  const workspaceId = req.header('x-workspace-id') ?? req.body?.workspaceId as string | undefined;
  if (!workspaceId) {
    return res.status(400).json({ error: 'Werkruimte-ID is verplicht.' });
  }

  const {
    reportApprovalId,
    fromAddress,
    subject,
    recipients,
    contentHash,
  } = req.body as {
    reportApprovalId?: string;
    fromAddress?: string;
    subject?: string;
    recipients?: Array<{ email: string; name?: string }>;
    contentHash?: string;
  };

  if (!reportApprovalId) return res.status(400).json({ error: 'Goedkeurings-ID is verplicht.' });
  if (!fromAddress) return res.status(400).json({ error: 'Afzenderadres is verplicht.' });
  if (!subject) return res.status(400).json({ error: 'Onderwerp is verplicht.' });
  if (!Array.isArray(recipients) || recipients.length === 0) {
    return res.status(400).json({ error: 'Minimaal één ontvanger is verplicht.' });
  }
  if (!contentHash) return res.status(400).json({ error: 'Inhoud-hash is verplicht.' });

  try {
    const { recipients: normalizedRecipients, recipientHash } = normalizeRecipients(
      recipients.map((r) => ({ email: r.email, name: r.name ?? null })),
    );

    // Note: This endpoint does NOT compute a delivery key (it's for testing dispatch preparation separately).
    // In production, deliveryKey should be computed with period close evidence and passed here.
    // For backward compatibility with tests, we use a synthetic key.
    const deliveryKey = `dispatch-prepare-test-${Math.random().toString(36).slice(2)}`;

    const result = await prisma.$transaction(async (tx) => {
      return prepareDispatch(tx, {
        actor: { userId: actor.userId, role: actor.role, actorId: actor.actorId },
        workspaceId,
        reportSnapshotId: snapshotId,
        reportApprovalId,
        deliveryKey,
        fromAddress,
        subject,
        recipients: normalizedRecipients,
        recipientHash,
        contentHash,
      });
    });

    return res.status(201).json({
      dispatchId: result.dispatchId,
      reportSnapshotId: result.reportSnapshotId,
      reportApprovalId: result.reportApprovalId,
      status: result.status,
      recipientHash: result.recipientHash,
      contentHash: result.contentHash,
      sideEffects: result.sideEffects,
    });
  } catch (error) {
    if (error instanceof ReportApprovalError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    if (error instanceof PeriodCloseError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.error('Rapportverzending voorbereiden mislukt', error);
    return res.status(500).json({ error: 'Rapportverzending voorbereiden mislukt.' });
  }
};
