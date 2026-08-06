/**
 * POST /api/reports/monthly/send
 *
 * Stable end-to-end idempotent report dispatch workflow:
 *
 * 1. Validate request and configuration.
 * 2. Verify all statement periods for the month are CLOSED.
 * 3. Load active recipients and normalize them canonically.
 * 4. Compute delivery key from immutable evidence (workspace, period closes with versions, recipients).
 * 5. Check for existing dispatch with same delivery key (duplicate prevention).
 * 6. If new: create snapshot, artifacts, approval, and dispatch (all in one transaction).
 * 7. Send via Resend outside the transaction.
 * 8. Update dispatch status to SENT or FAILED.
 *
 * A second identical request with the same month, same CLOSED periods, and same active recipients
 * will receive HTTP 409 without creating new records or calling the provider.
 *
 * Never returns recipient email addresses in any response or log.
 */

import { Request, Response } from 'express';
import { prisma } from '../prismaClient';
import { requireAdmin } from '../auth/requestContext';
import { generateMonthlyReportSnapshot } from '../services/reportSnapshotService';
import { generateAndStoreReportArtifacts, type ArtifactSnapshotInput } from '../services/reportArtifactService';
import {
  approveSnapshot,
  prepareDispatch,
  executeDispatch,
  ReportApprovalError,
} from '../services/reportApprovalDispatchService';
import { ResendReportEmailProvider } from '../services/reportEmailProvider';
import { hashEvidence } from '../services/reviewDecisionService';
import { normalizeRecipients } from '../services/recipientNormalization';
import { computeDeliveryKey } from '../services/deliveryKeyService';
import { DispatchStatus } from '@prisma/client';

const CANONICAL_FROM_ADDRESS = 'rapport@yeshuaacademy.nl';

export const postMonthlySendReport = async (req: Request, res: Response) => {
  const actor = await requireAdmin(req, res);
  if (!actor) return;

  const { year, month, confirmed } = req.body as {
    year?: unknown;
    month?: unknown;
    confirmed?: unknown;
  };

  if (typeof year !== 'number' || !Number.isInteger(year) || year < 2000 || year > 2100) {
    return res.status(400).json({ error: 'year moet een geldig geheel getal zijn (2000–2100).' });
  }
  if (typeof month !== 'number' || !Number.isInteger(month) || month < 1 || month > 12) {
    return res.status(400).json({ error: 'month moet een geheel getal zijn tussen 1 en 12.' });
  }
  if (confirmed !== true) {
    return res.status(400).json({ error: 'confirmed=true is vereist.' });
  }

  // Guard: Resend must be configured before any DB writes
  if (!process.env.RESEND_API_KEY?.trim()) {
    return res.status(503).json({ error: 'Resend is niet geconfigureerd op deze server.' });
  }

  const { userId, workspaceId } = actor;

  try {
    // Step 1: Verify ALL canonical statement periods overlapping this month are CLOSED
    const periodStart = new Date(Date.UTC(year, month - 1, 1));
    const periodEnd = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));

    const statementPeriods = await prisma.statementPeriod.findMany({
      where: {
        workspaceId,
        account: { userId },
        periodStart: { lte: periodEnd },
        periodEnd: { gte: periodStart },
      },
      select: { id: true },
    });

    if (statementPeriods.length === 0) {
      return res.status(409).json({
        error: `Maand ${year}-${String(month).padStart(2, '0')} heeft geen bankafschriften.`,
      });
    }

    // Verify each statement period's LATEST close is CLOSED (not reopened or partial)
    const periodCloseRecords: Array<{ id: string; version: number }> = [];
    for (const sp of statementPeriods) {
      const latestClose = await prisma.periodClose.findFirst({
        where: {
          statementPeriodId: sp.id,
        },
        select: { id: true, status: true, version: true },
        orderBy: { version: 'desc' },
      });

      if (!latestClose || latestClose.status !== 'CLOSED') {
        const reason = !latestClose ? 'niet afgesloten' : `status ${latestClose.status} (niet CLOSED)`;
        return res.status(409).json({
          error: `Afschriftperiode ${sp.id} is ${reason}. Sluit alle perioden voor maand ${year}-${String(month).padStart(2, '0')} af voordat u het rapport verzendt.`,
        });
      }

      periodCloseRecords.push({ id: latestClose.id, version: latestClose.version });
    }

    // Step 2: Load active recipients and normalize canonically
    const rawRecipients = await prisma.emailRecipient.findMany({
      where: { userId, isActive: true },
      select: { email: true, name: true },
    });

    if (rawRecipients.length === 0) {
      return res.status(400).json({
        error: 'Er zijn geen actieve e-mailontvangers ingesteld. Voeg ontvangers toe in Instellingen.',
      });
    }

    const { recipients, recipientHash } = normalizeRecipients(
      rawRecipients.map((r) => ({ email: r.email, name: r.name })),
    );

    // Step 3: Compute delivery key (immutable dispatch identity)
    const deliveryKey = computeDeliveryKey({
      workspaceId,
      kind: 'MONTHLY',
      year,
      month,
      periodCloses: periodCloseRecords,
      recipientHash,
    });

    // Step 4: Check for existing dispatch with same delivery key (EARLY duplicate check)
    const existingDispatch = await prisma.reportDispatch.findFirst({
      where: {
        deliveryKey,
        status: { in: [DispatchStatus.PENDING, DispatchStatus.SENT, DispatchStatus.FAILED] },
      },
      select: { id: true, status: true },
    });

    if (existingDispatch) {
      return res.status(409).json({
        error: 'Dit rapport is al ingediend. Als u het rapport opnieuw wilt versturen, wijzig alstublieft de ontvangers of de inhoud.',
      });
    }

    const fromAddress = process.env.REPORT_EMAIL_FROM?.trim() || CANONICAL_FROM_ADDRESS;
    const subject = `Maandrapport ${year}-${String(month).padStart(2, '0')}`;

    // Step 5: Create all immutable records in one transaction
    const prepared = await prisma.$transaction(async (tx) => {
      const snapshotResult = await generateMonthlyReportSnapshot(tx, {
        actor: { userId, role: actor.role },
        workspaceId,
        year,
        month,
      });

      const snapshotLines = await tx.reportSnapshotLine.findMany({
        where: { reportSnapshotId: snapshotResult.snapshotId },
        orderBy: { sortOrder: 'asc' },
      });

      const artifactInput: ArtifactSnapshotInput = {
        snapshotId: snapshotResult.snapshotId,
        snapshotHash: snapshotResult.snapshotHash,
        kind: snapshotResult.kind,
        year: snapshotResult.year,
        month: snapshotResult.month,
        openingBalanceMinor: snapshotResult.openingBalanceMinor,
        incomeMinor: snapshotResult.incomeMinor,
        expenseMinor: snapshotResult.expenseMinor,
        netMinor: snapshotResult.netMinor,
        closingBalanceMinor: snapshotResult.closingBalanceMinor,
        transactionCount: snapshotResult.transactionCount,
        generatedBy: snapshotResult.generatedBy,
        generatedAt: snapshotResult.generatedAt,
        lines: snapshotLines.map((l) => ({
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

      const artifactResult = await generateAndStoreReportArtifacts(tx, artifactInput);

      const approval = await approveSnapshot(tx, {
        actor: { userId, role: actor.role },
        workspaceId,
        reportSnapshotId: snapshotResult.snapshotId,
        expectedSnapshotHash: snapshotResult.snapshotHash,
      });

      // Compute content hash from artifact SHA-256 digests (not IDs)
      const artifacts = await Promise.all([
        tx.reportArtifact.findUnique({
          where: { id: artifactResult.htmlArtifactId },
          select: { sha256: true },
        }),
        tx.reportArtifact.findUnique({
          where: { id: artifactResult.xlsxArtifactId },
          select: { sha256: true },
        }),
        tx.reportArtifact.findUnique({
          where: { id: artifactResult.pdfArtifactId },
          select: { sha256: true },
        }),
      ]);

      const contentHash = hashEvidence({
        artifacts: [
          { format: 'HTML', sha256: artifacts[0]?.sha256 },
          { format: 'XLSX', sha256: artifacts[1]?.sha256 },
          { format: 'PDF', sha256: artifacts[2]?.sha256 },
        ],
      });

      const dispatch = await prepareDispatch(tx, {
        actor: { userId, role: actor.role },
        workspaceId,
        reportSnapshotId: snapshotResult.snapshotId,
        reportApprovalId: approval.approvalId,
        deliveryKey,
        fromAddress,
        subject,
        recipients,
        recipientHash,
        contentHash,
      });

      // Load HTML content while still in transaction
      const htmlArtifact = await tx.reportArtifact.findUnique({
        where: { id: artifactResult.htmlArtifactId },
        select: { content: true },
      });

      if (!htmlArtifact) {
        throw new Error('HTML-artefact niet gevonden na aanmaken.');
      }

      const htmlContent = Buffer.isBuffer(htmlArtifact.content)
        ? htmlArtifact.content.toString('utf-8')
        : typeof htmlArtifact.content === 'string'
          ? htmlArtifact.content
          : Buffer.from(htmlArtifact.content).toString('utf-8');

      return {
        snapshotId: snapshotResult.snapshotId,
        snapshotHash: snapshotResult.snapshotHash,
        approvalId: approval.approvalId,
        dispatchId: dispatch.dispatchId,
        contentHash,
        htmlContent,
      };
    });

    // Step 6: Send email outside the transaction (avoid holding DB connection during HTTP call)
    const provider = new ResendReportEmailProvider();
    const sendResult = await executeDispatch(prisma, {
      actor: { userId, role: actor.role },
      workspaceId,
      reportSnapshotId: prepared.snapshotId,
      reportApprovalId: prepared.approvalId,
      dispatchId: prepared.dispatchId,
      fromAddress,
      subject,
      recipients,
      contentHash: prepared.contentHash,
      html: prepared.htmlContent,
      provider,
    });

    return res.json({
      status: sendResult.status,
      month: `${year}-${String(month).padStart(2, '0')}`,
      recipientCount: recipients.length,
      snapshotId: prepared.snapshotId,
      dispatchId: prepared.dispatchId,
    });
  } catch (err: unknown) {
    console.error('[POST /api/reports/monthly/send]', err instanceof Error ? err.message : String(err));

    // Handle ReportApprovalError (service-layer validation)
    if (err instanceof ReportApprovalError) {
      return res.status(err.statusCode).json({ error: err.message });
    }

    // Handle Prisma unique constraint violation on deliveryKey (concurrent duplicate race)
    if (
      err &&
      typeof err === 'object' &&
      'code' in err &&
      err.code === 'P2002' &&
      'meta' in err &&
      typeof err.meta === 'object' &&
      err.meta !== null &&
      'target' in err.meta &&
      Array.isArray(err.meta.target) &&
      err.meta.target.includes('deliveryKey')
    ) {
      return res.status(409).json({
        error: 'Dit rapport is al ingediend. Als u het rapport opnieuw wilt versturen, wijzig alstublieft de ontvangers of de inhoud.',
      });
    }

    const message = err instanceof Error ? err.message : 'Onbekende fout.';
    // Sanitize any PII from error messages before returning
    const sanitized = message.replace(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g, '[EMAIL]');
    return res.status(500).json({ error: `Rapport verzenden mislukt: ${sanitized}` });
  }
};
