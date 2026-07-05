/**
 * REPORT-004: Generate HTML, XLSX, and PDF report artifacts from one immutable snapshot.
 *
 * All formats derive from the same snapshot object and include:
 *   - snapshot id and hash
 *   - same totals and period
 *   - same generation timestamp
 *
 * Artifacts are stored in ReportArtifact with sha256 of retained bytes.
 * Original source bank files remain separate SourceFile downloads — never mixed here.
 *
 * PDF NOTE: No PDF library exists in package.json. Generating a real PDF requires
 * either `puppeteer` (large), `pdfmake`, or similar. Rather than install a new
 * dependency, PDF artifact generation produces a placeholder byte payload
 * that makes the sha256 deterministic and the artifact storable, while documenting
 * the exact blocker. A real PDF renderer must be added in a future task with
 * explicit owner approval for the dependency.
 *
 * No email sending is done here.
 */

import crypto from 'node:crypto';
import * as XLSX from 'xlsx';
import type { Prisma, ReportSnapshotLine, ReportArtifactFormat } from '@prisma/client';
import { hashEvidence } from './reviewDecisionService';
import type { ReportLineInput } from './periodCloseService';

export class ReportArtifactError extends Error {
  statusCode: number;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = 'ReportArtifactError';
    this.statusCode = statusCode;
  }
}

type TxClient = Prisma.TransactionClient;

// ─── Snapshot shape used by artifact generators ──────────────────────────────

export type ArtifactSnapshotInput = {
  snapshotId: string;
  snapshotHash: string;
  kind: 'MONTHLY' | 'YEARLY';
  year: number;
  month: number | null;
  openingBalanceMinor: string | bigint;
  incomeMinor: string | bigint;
  expenseMinor: string | bigint;
  netMinor: string | bigint;
  closingBalanceMinor: string | bigint;
  transactionCount: number;
  generatedBy: string;
  generatedAt: Date;
  lines: ReportLineInput[];
};

export type ArtifactGenerationResult = {
  snapshotId: string;
  snapshotHash: string;
  htmlArtifactId: string;
  xlsxArtifactId: string;
  pdfArtifactId: string | null;
  pdfBlocker: string | null;
  sideEffects: {
    createsReportArtifact: true;
    createsReportApproval: false;
    dispatchesReport: false;
  };
};

// ─── Money formatting ─────────────────────────────────────────────────────────

const centsToEuro = (v: string | bigint | number): string => {
  const cents = typeof v === 'bigint' ? v : BigInt(v);
  const sign = cents < 0n ? '-' : '';
  const abs = cents < 0n ? -cents : cents;
  const euros = abs / 100n;
  const remainder = abs % 100n;
  return `${sign}EUR ${euros}.${String(remainder).padStart(2, '0')}`;
};

const DUTCH_MONTHS = [
  'januari', 'februari', 'maart', 'april', 'mei', 'juni',
  'juli', 'augustus', 'september', 'oktober', 'november', 'december',
];

const periodLabel = (kind: 'MONTHLY' | 'YEARLY', year: number, month: number | null): string => {
  if (kind === 'MONTHLY' && month) {
    return `${DUTCH_MONTHS[month - 1]} ${year}`;
  }
  return `Jaar ${year}`;
};

// ─── HTML generation ──────────────────────────────────────────────────────────

const escapeHtml = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export const generateHtmlArtifact = (snapshot: ArtifactSnapshotInput): Buffer => {
  const period = periodLabel(snapshot.kind, snapshot.year, snapshot.month);
  const generatedAt = snapshot.generatedAt.toISOString();

  const incomeLines = snapshot.lines.filter((l) => l.direction === 'credit');
  const expenseLines = snapshot.lines.filter((l) => l.direction === 'debit');

  const renderLines = (lines: ReportLineInput[]): string =>
    lines
      .map(
        (l) =>
          `<tr>
            <td>${escapeHtml(l.literalProjectLabel ?? '')}</td>
            <td>${escapeHtml(l.literalTypeLabel ?? '')}</td>
            <td>${escapeHtml(l.literalCategoryLabel ?? '')}</td>
            <td>${l.transactionCount}</td>
            <td>${centsToEuro(l.amountMinor)}</td>
          </tr>`,
      )
      .join('\n');

  const html = `<!DOCTYPE html>
<html lang="nl">
<head>
  <meta charset="UTF-8">
  <title>Financieel Rapport — ${escapeHtml(period)}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 2rem; color: #333; }
    h1 { color: #1a1a1a; }
    table { border-collapse: collapse; width: 100%; margin-bottom: 1.5rem; }
    th, td { border: 1px solid #ccc; padding: 0.4rem 0.6rem; text-align: left; }
    th { background: #f0f0f0; }
    .totals { font-weight: bold; }
    .meta { font-size: 0.85rem; color: #666; margin-top: 2rem; }
  </style>
</head>
<body>
  <h1>Financieel Rapport — ${escapeHtml(period)}</h1>

  <table class="totals">
    <tr><th>Openingsaldo</th><td>${centsToEuro(snapshot.openingBalanceMinor)}</td></tr>
    <tr><th>Inkomsten</th><td>${centsToEuro(snapshot.incomeMinor)}</td></tr>
    <tr><th>Uitgaven</th><td>${centsToEuro(snapshot.expenseMinor)}</td></tr>
    <tr><th>Netto</th><td>${centsToEuro(snapshot.netMinor)}</td></tr>
    <tr><th>Eindsaldo</th><td>${centsToEuro(snapshot.closingBalanceMinor)}</td></tr>
    <tr><th>Transacties</th><td>${snapshot.transactionCount}</td></tr>
  </table>

  <h2>Inkomsten per categorie</h2>
  <table>
    <thead>
      <tr><th>Klant</th><th>Type</th><th>Categorie</th><th>Aantal</th><th>Bedrag</th></tr>
    </thead>
    <tbody>
      ${incomeLines.length ? renderLines(incomeLines) : '<tr><td colspan="5">Geen inkomsten.</td></tr>'}
    </tbody>
  </table>

  <h2>Uitgaven per categorie</h2>
  <table>
    <thead>
      <tr><th>Klant</th><th>Type</th><th>Categorie</th><th>Aantal</th><th>Bedrag</th></tr>
    </thead>
    <tbody>
      ${expenseLines.length ? renderLines(expenseLines) : '<tr><td colspan="5">Geen uitgaven.</td></tr>'}
    </tbody>
  </table>

  <div class="meta">
    <p>Snapshot-ID: ${escapeHtml(snapshot.snapshotId)}</p>
    <p>Snapshot-hash: ${escapeHtml(snapshot.snapshotHash)}</p>
    <p>Aangemaakt door: ${escapeHtml(snapshot.generatedBy)}</p>
    <p>Aangemaakt op: ${escapeHtml(generatedAt)}</p>
  </div>
</body>
</html>`;

  return Buffer.from(html, 'utf-8');
};

// ─── XLSX generation ───────────────────────────────────────────────────────────

export const generateXlsxArtifact = (snapshot: ArtifactSnapshotInput): Buffer => {
  const period = periodLabel(snapshot.kind, snapshot.year, snapshot.month);

  // Summary sheet
  const summaryData: (string | number)[][] = [
    ['Yeshua Academy — Financieel Rapport'],
    ['Periode', period],
    [],
    ['Openingsaldo', centsToEuro(snapshot.openingBalanceMinor)],
    ['Inkomsten', centsToEuro(snapshot.incomeMinor)],
    ['Uitgaven', centsToEuro(snapshot.expenseMinor)],
    ['Netto', centsToEuro(snapshot.netMinor)],
    ['Eindsaldo', centsToEuro(snapshot.closingBalanceMinor)],
    ['Transacties', snapshot.transactionCount],
    [],
    ['Snapshot-ID', snapshot.snapshotId],
    ['Snapshot-hash', snapshot.snapshotHash],
    ['Aangemaakt door', snapshot.generatedBy],
    ['Aangemaakt op', snapshot.generatedAt.toISOString()],
  ];

  const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);

  // Detail sheet — income
  const incomeLines = snapshot.lines.filter((l) => l.direction === 'credit');
  const incomeData: (string | number)[][] = [
    ['Klant', 'Type', 'Categorie', 'Richting', 'Aantal', 'Bedrag'],
    ...incomeLines.map((l) => [
      l.literalProjectLabel ?? '',
      l.literalTypeLabel ?? '',
      l.literalCategoryLabel ?? '',
      'Inkomsten',
      l.transactionCount,
      centsToEuro(l.amountMinor),
    ]),
  ];
  const incomeSheet = XLSX.utils.aoa_to_sheet(incomeData);

  // Detail sheet — expenses
  const expenseLines = snapshot.lines.filter((l) => l.direction === 'debit');
  const expenseData: (string | number)[][] = [
    ['Klant', 'Type', 'Categorie', 'Richting', 'Aantal', 'Bedrag'],
    ...expenseLines.map((l) => [
      l.literalProjectLabel ?? '',
      l.literalTypeLabel ?? '',
      l.literalCategoryLabel ?? '',
      'Uitgaven',
      l.transactionCount,
      centsToEuro(l.amountMinor),
    ]),
  ];
  const expenseSheet = XLSX.utils.aoa_to_sheet(expenseData);

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, summarySheet, 'Overzicht');
  XLSX.utils.book_append_sheet(wb, incomeSheet, 'Inkomsten');
  XLSX.utils.book_append_sheet(wb, expenseSheet, 'Uitgaven');

  return Buffer.from(XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' }) as Uint8Array);
};

// ─── PDF generation ───────────────────────────────────────────────────────────

/**
 * PDF BLOCKER:
 *
 * No PDF rendering library is present in package.json. Available options are:
 *   - puppeteer / playwright: Chromium-based, ~300 MB, renders HTML to PDF
 *   - pdfmake: Pure JS PDF generation
 *   - jsPDF: Browser-oriented, limited server support
 *   - @react-pdf/renderer: React-based PDF
 *
 * None of these are currently installed. Installing a new dependency requires
 * explicit owner approval per the project constraints.
 *
 * This function generates a deterministic placeholder PDF-like buffer that:
 *   1. Contains the snapshot id and hash as a recognizable marker
 *   2. Has a deterministic sha256 based on snapshot content
 *   3. Is NOT a valid PDF file
 *
 * A real PDF renderer must be added in a future task after owner approval.
 */
export const PDF_BLOCKER = 'PDF-artifact vereist een PDF-bibliotheek die nog niet aanwezig is in package.json. ' +
  'Installatie vereist expliciete eigenaargoedkeuring. ' +
  'Vervang de placeholder door een echte PDF-renderer zodra een geschikte bibliotheek is goedgekeurd.';

export const generatePdfPlaceholder = (snapshot: ArtifactSnapshotInput): Buffer => {
  const marker = JSON.stringify({
    type: 'PDF_PLACEHOLDER',
    snapshotId: snapshot.snapshotId,
    snapshotHash: snapshot.snapshotHash,
    period: periodLabel(snapshot.kind, snapshot.year, snapshot.month),
    generatedAt: snapshot.generatedAt.toISOString(),
    blocker: PDF_BLOCKER,
  });
  return Buffer.from(marker, 'utf-8');
};

// ─── Artifact sha256 ──────────────────────────────────────────────────────────

export const sha256OfBuffer = (buf: Buffer): string =>
  crypto.createHash('sha256').update(buf).digest('hex');

// ─── Store artifacts ──────────────────────────────────────────────────────────

const storeArtifact = async (
  db: TxClient,
  snapshotId: string,
  format: ReportArtifactFormat,
  filename: string,
  mediaType: string,
  content: Buffer,
) => {
  const sha256 = sha256OfBuffer(content);
  // Ensure we pass a plain Buffer (Prisma Bytes field requires Buffer<ArrayBuffer>)
  const safeContent = Buffer.from(content);
  return db.reportArtifact.create({
    data: {
      reportSnapshotId: snapshotId,
      format,
      filename,
      mediaType,
      sizeBytes: safeContent.byteLength,
      sha256,
      content: safeContent,
    },
  });
};

/**
 * Generate and store HTML, XLSX, and PDF placeholder artifacts from one snapshot.
 *
 * All artifacts share the same snapshotId, snapshotHash, totals, and period.
 * The sha256 of each artifact equals the sha256 of the retained content bytes.
 */
export const generateAndStoreReportArtifacts = async (
  db: TxClient,
  snapshot: ArtifactSnapshotInput,
): Promise<ArtifactGenerationResult> => {
  // Verify snapshot exists
  const existing = await db.reportSnapshot.findUnique({
    where: { id: snapshot.snapshotId },
    select: { id: true, snapshotHash: true },
  });
  if (!existing) {
    throw new ReportArtifactError('Rapportage-snapshot niet gevonden.', 404);
  }
  if (existing.snapshotHash !== snapshot.snapshotHash) {
    throw new ReportArtifactError(
      'De opgegeven snapshot-hash komt niet overeen met de opgeslagen snapshot. ' +
      'Haal de snapshot opnieuw op voordat u artefacten genereert.',
      409,
    );
  }

  const period = periodLabel(snapshot.kind, snapshot.year, snapshot.month);
  const safePeriod = period.replace(/\s+/g, '_').replace(/[^a-z0-9_]/gi, '');

  // Generate HTML
  const htmlContent = generateHtmlArtifact(snapshot);
  const htmlArtifact = await storeArtifact(
    db,
    snapshot.snapshotId,
    'HTML',
    `rapport_${safePeriod}.html`,
    'text/html; charset=utf-8',
    htmlContent,
  );

  // Generate XLSX
  const xlsxContent = generateXlsxArtifact(snapshot);
  const xlsxArtifact = await storeArtifact(
    db,
    snapshot.snapshotId,
    'XLSX',
    `rapport_${safePeriod}.xlsx`,
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    xlsxContent,
  );

  // PDF: placeholder only — no real PDF library available
  const pdfContent = generatePdfPlaceholder(snapshot);
  const pdfArtifact = await storeArtifact(
    db,
    snapshot.snapshotId,
    'PDF',
    `rapport_${safePeriod}.pdf`,
    'application/octet-stream',
    pdfContent,
  );

  return {
    snapshotId: snapshot.snapshotId,
    snapshotHash: snapshot.snapshotHash,
    htmlArtifactId: htmlArtifact.id,
    xlsxArtifactId: xlsxArtifact.id,
    pdfArtifactId: pdfArtifact.id,
    pdfBlocker: PDF_BLOCKER,
    sideEffects: {
      createsReportArtifact: true,
      createsReportApproval: false,
      dispatchesReport: false,
    },
  };
};
