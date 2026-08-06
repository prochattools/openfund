/**
 * POST /api/reports/monthly/send
 *
 * Admin-only endpoint that:
 *   1. Requires a CLOSED period for the given year/month.
 *   2. Loads active EmailRecipient records for actor.userId.
 *   3. Rejects with Dutch message if zero recipients.
 *   4. Verifies RESEND_API_KEY is present (throws before any DB writes).
 *   5. Creates/reuses immutable snapshot.
 *   6. Generates HTML/XLSX/PDF artifacts.
 *   7. Approves the snapshot hash.
 *   8. Prepares dispatch metadata (PENDING).
 *   9. Sends via real ResendReportEmailProvider — outside the DB transaction.
 *  10. Persists SENT or sanitized FAILED status via a second DB write.
 *
 * Never returns recipient email addresses in any response or log.
 */

import { Request, Response } from 'express';
import { prisma } from '../prismaClient';
import { requireAdmin } from '../auth/requestContext';
import { generateMonthlyReportSnapshot } from '../services/reportSnapshotService';
import { generateAndStoreReportArtifacts, type ArtifactSnapshotInput } from '../services/reportArtifactService';
import { approveSnapshot, prepareDispatch, executeDispatch } from '../services/reportApprovalDispatchService';
import { ResendReportEmailProvider } from '../services/reportEmailProvider';
import { hashEvidence } from '../services/reviewDecisionService';
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
    // Verify ALL canonical statement periods overlapping this month are CLOSED
    const periodStart = new Date(Date.UTC(year, month - 1, 1));
    const periodEnd = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));

    // Find all canonical statement periods for this month
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

    // Verify each statement period has a latest CLOSED PeriodClose
    for (const sp of statementPeriods) {
      const latestClose = await prisma.periodClose.findFirst({
        where: {
          statementPeriodId: sp.id,
          status: 'CLOSED',
        },
        select: { id: true },
        orderBy: { version: 'desc' },
      });

      if (!latestClose) {
        return res.status(409).json({
          error: `Afschriftperiode ${sp.id} is niet afgesloten. Sluit alle perioden voor maand ${year}-${String(month).padStart(2, '0')} af voordat u het rapport verzendt.`,
        });
      }
    }

    // Load active recipients
    const recipients = await prisma.emailRecipient.findMany({
      where: { userId, isActive: true },
      select: { id: true, email: true, name: true },
    });

    if (recipients.length === 0) {
      return res.status(400).json({
        error: 'Er zijn geen actieve e-mailontvangers ingesteld. Voeg ontvangers toe in Instellingen.',
      });
    }

    const fromAddress = process.env.REPORT_EMAIL_FROM?.trim() || CANONICAL_FROM_ADDRESS;
    const subject = `Maandrapport ${year}-${String(month).padStart(2, '0')}`;

    // Phase 1: Create snapshot + artifacts + approval + dispatch preparation in one transaction
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

      const contentHash = hashEvidence({
        htmlArtifactId: artifactResult.htmlArtifactId,
        xlsxArtifactId: artifactResult.xlsxArtifactId,
        pdfArtifactId: artifactResult.pdfArtifactId,
      });

      const dispatch = await prepareDispatch(tx, {
        actor: { userId, role: actor.role },
        workspaceId,
        reportSnapshotId: snapshotResult.snapshotId,
        reportApprovalId: approval.approvalId,
        fromAddress,
        subject,
        recipients: recipients.map((r) => ({ email: r.email, name: r.name || undefined })),
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

    // Phase 2: Send email outside the transaction (avoid holding DB connection during HTTP call)
    const provider = new ResendReportEmailProvider();
    const sendResult = await executeDispatch(prisma, {
      actor: { userId, role: actor.role },
      workspaceId,
      reportSnapshotId: prepared.snapshotId,
      reportApprovalId: prepared.approvalId,
      dispatchId: prepared.dispatchId,
      fromAddress,
      subject,
      recipients: recipients.map((r) => ({ email: r.email, name: r.name || undefined })),
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
    const message = err instanceof Error ? err.message : 'Onbekende fout.';
    // Sanitize any PII from error messages before returning
    const sanitized = message.replace(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g, '[EMAIL]');
    return res.status(500).json({ error: `Rapport verzenden mislukt: ${sanitized}` });
  }
};
