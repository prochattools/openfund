/**
 * POST /api/reports/monthly/send
 *
 * Stable end-to-end idempotent report dispatch workflow:
 *
 * 1. Validate request and configuration.
 * 2. Load active recipients and normalize them canonically.
 * 3. Inside a single transaction:
 *    a. Generate a live snapshot from current transaction/booking data.
 *    b. Load snapshot lines.
 *    c. Compute report evidence hash (derived from snapshot content).
 *    d. Compute delivery key from evidence hash + recipients.
 *    e. Check for existing dispatch with same delivery key (duplicate prevention).
 *    f. Generate artifacts, approval, dispatch.
 *    g. Load HTML content.
 * 4. Send via Resend outside the transaction.
 * 5. Update dispatch status to SENT or FAILED.
 *
 * Period close is NOT required. All transactions for the month must be booked.
 *
 * A second identical request with the same month content and same active recipients
 * will receive HTTP 409 without creating new records or calling the provider.
 *
 * Never returns recipient email addresses in any response or log.
 */

import { Request, Response } from 'express';
import { prisma } from '../prismaClient';
import { requireAdmin } from '../auth/requestContext';
import { generateLiveMonthlyReportSnapshot, ReportSnapshotError } from '../services/reportSnapshotService';
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
import { computeDeliveryKey, computeReportEvidenceHash } from '../services/deliveryKeyService';
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
    // Step 1: Load active recipients and normalize canonically
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

    const fromAddress = process.env.REPORT_EMAIL_FROM?.trim() || CANONICAL_FROM_ADDRESS;
    const subject = `Maandrapport ${year}-${String(month).padStart(2, '0')}`;

    // Step 2: Create all immutable records in one transaction
    const prepared = await prisma.$transaction(async (tx) => {
      // 2a. Generate live snapshot
      const snapshotResult = await generateLiveMonthlyReportSnapshot(tx, {
        actor: { userId, role: actor.role },
        workspaceId,
        year,
        month,
      });

      // 2b. Load snapshot lines
      const snapshotLines = await tx.reportSnapshotLine.findMany({
        where: { reportSnapshotId: snapshotResult.snapshotId },
        orderBy: { sortOrder: 'asc' },
      });

      // 2c. Compute report evidence hash from snapshot content
      const reportEvidenceHash = computeReportEvidenceHash({
        kind: snapshotResult.kind,
        year: snapshotResult.year,
        month: snapshotResult.month,
        openingBalanceMinor: snapshotResult.openingBalanceMinor,
        incomeMinor: snapshotResult.incomeMinor,
        expenseMinor: snapshotResult.expenseMinor,
        netMinor: snapshotResult.netMinor,
        closingBalanceMinor: snapshotResult.closingBalanceMinor,
        transactionCount: snapshotResult.transactionCount,
        lines: snapshotLines.map((l) => ({
          lineKind: l.lineKind,
          projectId: l.projectId,
          transactionTypeId: l.transactionTypeId,
          categoryId: l.categoryId,
          literalProjectLabel: l.literalProjectLabel,
          literalTypeLabel: l.literalTypeLabel,
          literalCategoryLabel: l.literalCategoryLabel,
          direction: l.direction,
          amountMinor: l.amountMinor,
          transactionCount: l.transactionCount,
          sortOrder: l.sortOrder,
        })),
      });

      // 2d. Compute delivery key from evidence hash + recipients
      const deliveryKey = computeDeliveryKey({
        workspaceId,
        kind: 'MONTHLY',
        year,
        month,
        periodCloses: [],
        recipientHash,
        reportEvidenceHash,
      });

      // 2e. Check for existing dispatch (duplicate check — inside transaction so concurrent
      //     duplicates roll back cleanly; unique constraint on deliveryKey catches races)
      const existingDispatch = await tx.reportDispatch.findFirst({
        where: {
          deliveryKey,
          status: { in: [DispatchStatus.PENDING, DispatchStatus.SENT, DispatchStatus.FAILED] },
        },
        select: { id: true, status: true },
      });

      if (existingDispatch) {
        throw Object.assign(new Error('DUPLICATE_DISPATCH'), { isDuplicate: true });
      }

      // 2f. Generate artifacts
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

      // 2f cont. Approve snapshot
      const approval = await approveSnapshot(tx, {
        actor: { userId, role: actor.role },
        workspaceId,
        reportSnapshotId: snapshotResult.snapshotId,
        expectedSnapshotHash: snapshotResult.snapshotHash,
      });

      // 2g. Compute content hash from artifact SHA-256 digests (not IDs)
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

      // 2h. Load HTML content while still in transaction
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

    // Step 3: Send email outside the transaction (avoid holding DB connection during HTTP call)
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

    // Handle duplicate dispatch sentinel (set inside transaction)
    if (err && typeof err === 'object' && 'isDuplicate' in err && (err as { isDuplicate: boolean }).isDuplicate) {
      return res.status(409).json({
        error: 'Dit rapport is al ingediend. Als u het rapport opnieuw wilt versturen, wijzig alstublieft de ontvangers of de inhoud.',
      });
    }

    // Handle ReportSnapshotError (e.g. unbooked transactions)
    if (err instanceof ReportSnapshotError) {
      return res.status(err.statusCode).json({ error: err.message });
    }

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
