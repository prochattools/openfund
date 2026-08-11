/**
 * POST /api/reports/monthly/send
 *
 * Explicit monthly report dispatch workflow:
 *
 * 1. Validate request and configuration.
 * 2. Load active recipients and normalize them canonically.
 * 3. Inside a single transaction:
 *    a. Generate a fresh live snapshot from current transaction/booking data.
 *    b. Generate immutable artifacts and approval records.
 *    c. Create a uniquely keyed dispatch record for this explicit send attempt.
 *    d. Load HTML content.
 * 4. Send via Resend outside the transaction.
 * 5. Update dispatch status to SENT or FAILED.
 *
 * Period close is NOT required. All transactions for the month must be booked.
 * Repeated explicit sends are always allowed, including identical content and recipients;
 * each attempt remains independently auditable through its own snapshot/dispatch records.
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
import { ResendReportEmailProvider, type ReportEmailAttachment } from '../services/reportEmailProvider';
import { hashEvidence } from '../services/reviewDecisionService';
import { normalizeRecipients } from '../services/recipientNormalization';
import { reconcileMonthlyReport, ReportReconciliationError } from '../services/reportReconciliationService';
import { formatReportSubject } from '../utils/dutchPeriodFormatter';

const CANONICAL_FROM_ADDRESS = 'rapport@yeshua.academy';

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
    const subject = formatReportSubject(year, month);

    // Step 2: Create all immutable records in one transaction
    const prepared = await prisma.$transaction(async (tx) => {
      // 2a-pre. Reconcile against authoritative bank statement controls
      const reconciliation = await reconcileMonthlyReport(tx, {
        workspaceId,
        userId,
        year,
        month,
      });

      if (!reconciliation.classificationReadiness.complete) {
        throw Object.assign(new Error('CLASSIFICATION_INCOMPLETE'), {
          code: 'CLASSIFICATION_INCOMPLETE',
          statusCode: 422,
          unbookedTransactionCount: reconciliation.classificationReadiness.unbookedTransactionCount,
        });
      }

      // 2a. Generate live snapshot (now with correct absolute-value arithmetic)
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

      // 2c. Give every explicit send attempt its own unique audit key.
      // The live snapshot is freshly created/versioned for every attempt, so using its
      // immutable identity preserves ReportDispatch.deliveryKey uniqueness without
      // blocking repeat sends of identical report content to identical recipients.
      const deliveryKey = hashEvidence({
        workspaceId,
        kind: 'MONTHLY',
        year,
        month,
        reportSnapshotId: snapshotResult.snapshotId,
        snapshotHash: snapshotResult.snapshotHash,
        recipientHash,
      });

      // 2d. Generate artifacts (with counterparty summary from reconciliation)
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
        customers: reconciliation.customers,
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

      // 2i. Load original bank statement source files for attachment
      const csvSourceFile = await tx.sourceFile.findUnique({
        where: { id: reconciliation.sourceFileId },
        select: { filename: true, content: true, mediaType: true },
      });
      if (!csvSourceFile) {
        throw new ReportReconciliationError(
          'Het originele bankafschrift (CSV) ontbreekt in de database. Upload dit bestand opnieuw.',
          'MISSING_CSV_ATTACHMENT',
          'CSV SourceFile aanwezig',
          'niet gevonden',
        );
      }

      let pdfSourceFile: { filename: string; content: Buffer | Uint8Array; mediaType: string } | null = null;
      if (reconciliation.supportingPdfFileId) {
        pdfSourceFile = await tx.sourceFile.findUnique({
          where: { id: reconciliation.supportingPdfFileId },
          select: { filename: true, content: true, mediaType: true },
        });
      }
      if (!pdfSourceFile) {
        throw new ReportReconciliationError(
          'Het ondersteunende bankafschrift (PDF) ontbreekt in de database. Upload dit bestand opnieuw.',
          'MISSING_PDF_ATTACHMENT',
          'PDF SourceFile aanwezig',
          'niet gevonden',
        );
      }

      const attachments: ReportEmailAttachment[] = [
        { filename: csvSourceFile.filename, content: Buffer.from(csvSourceFile.content) },
        { filename: pdfSourceFile.filename, content: Buffer.from(pdfSourceFile.content) },
      ];

      return {
        snapshotId: snapshotResult.snapshotId,
        snapshotHash: snapshotResult.snapshotHash,
        approvalId: approval.approvalId,
        dispatchId: dispatch.dispatchId,
        contentHash,
        htmlContent,
        attachments,
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
      attachments: prepared.attachments,
    });

    if (sendResult.status === 'FAILED') {
      const providerReason = (sendResult.errorMessage || 'onbekende providerfout.')
        .replace(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g, '[EMAIL]')
        .slice(0, 500);
      return res.status(502).json({
        error: `E-mail kon niet worden verzonden via Resend: ${providerReason}`,
        status: sendResult.status,
        month: `${year}-${String(month).padStart(2, '0')}`,
        recipientCount: recipients.length,
        snapshotId: prepared.snapshotId,
        dispatchId: prepared.dispatchId,
      });
    }

    return res.json({
      status: sendResult.status,
      month: `${year}-${String(month).padStart(2, '0')}`,
      recipientCount: recipients.length,
      snapshotId: prepared.snapshotId,
      dispatchId: prepared.dispatchId,
    });
  } catch (err: unknown) {
    console.error('[POST /api/reports/monthly/send]', err instanceof Error ? err.message : String(err));

    if (
      err &&
      typeof err === 'object' &&
      'code' in err &&
      err.code === 'CLASSIFICATION_INCOMPLETE'
    ) {
      const count = 'unbookedTransactionCount' in err && typeof err.unbookedTransactionCount === 'number'
        ? err.unbookedTransactionCount
        : 0;
      return res.status(422).json({
        error: `Er zijn nog ${count} ongecategoriseerde transacties. Categoriseer deze transacties voordat je het maandrapport verstuurt.`,
        code: 'CLASSIFICATION_INCOMPLETE',
      });
    }

    // Defensive snapshot-level classification check.
    if (err instanceof ReportSnapshotError) {
      return res.status(err.statusCode).json({ error: err.message });
    }

    // Handle ReportReconciliationError (bank statement control mismatch)
    if (err instanceof ReportReconciliationError) {
      return res.status(err.statusCode).json({
        error: err.message,
        invariant: err.invariant,
        expected: err.expected,
        actual: err.actual,
      });
    }

    // Handle ReportApprovalError (service-layer validation)
    if (err instanceof ReportApprovalError) {
      return res.status(err.statusCode).json({ error: err.message });
    }

    const message = err instanceof Error ? err.message : 'Onbekende fout.';
    // Sanitize any PII from error messages before returning
    const sanitized = message.replace(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g, '[EMAIL]');
    return res.status(500).json({ error: `Rapport verzenden mislukt: ${sanitized}` });
  }
};
