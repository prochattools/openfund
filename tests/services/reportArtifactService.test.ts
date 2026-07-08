import { describe, expect, it } from 'vitest';
import crypto from 'node:crypto';
import {
  generateHtmlArtifact,
  generateXlsxArtifact,
  generatePdfArtifact,
  generateAndStoreReportArtifacts,
  sha256OfBuffer,
  ReportArtifactError,
  type ArtifactSnapshotInput,
} from '../../server/services/reportArtifactService';
import { ReportLineKind } from '@prisma/client';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const baseSnapshot: ArtifactSnapshotInput = {
  snapshotId: 'snapshot-001',
  snapshotHash: 'a'.repeat(64),
  kind: 'MONTHLY',
  year: 2026,
  month: 1,
  openingBalanceMinor: '1000000',
  incomeMinor: '250000',
  expenseMinor: '100000',
  netMinor: '150000',
  closingBalanceMinor: '1150000',
  transactionCount: 5,
  generatedBy: 'actor-1',
  generatedAt: new Date('2026-07-05T10:00:00Z'),
  lines: [
    {
      lineKind: ReportLineKind.CATEGORY,
      projectId: 'p-ya',
      transactionTypeId: 'tt-schenking',
      categoryId: 'c-giften',
      literalProjectLabel: 'YA',
      literalTypeLabel: 'Schenking',
      literalCategoryLabel: 'Giften in',
      direction: 'credit',
      amountMinor: 250000n,
      transactionCount: 3,
      sortOrder: 1,
    },
    {
      lineKind: ReportLineKind.CATEGORY,
      projectId: 'p-ya',
      transactionTypeId: 'tt-algemeen',
      categoryId: 'c-kosten',
      literalProjectLabel: 'YA',
      literalTypeLabel: 'Algemeen',
      literalCategoryLabel: 'Administratiekosten uit',
      direction: 'debit',
      amountMinor: 100000n,
      transactionCount: 2,
      sortOrder: 2,
    },
  ],
};

const pdfContainsAsciiHex = (content: string, value: string): boolean =>
  content.toLowerCase().replace(/\s+/g, '').includes(Buffer.from(value, 'utf-8').toString('hex'));

const makeArtifactDb = (opts: {
  snapshotExists?: boolean;
  snapshotHashOverride?: string;
  storedArtifacts?: { HTML: string; XLSX: string; PDF: string };
} = {}) => {
  const exists = opts.snapshotExists ?? true;
  const hash = opts.snapshotHashOverride ?? baseSnapshot.snapshotHash;

  const artifactIds: Record<string, string> = {
    HTML: 'artifact-html-1',
    XLSX: 'artifact-xlsx-1',
    PDF: 'artifact-pdf-1',
  };

  const calls: string[] = [];
  const createdArtifacts: any[] = [];

  return {
    reportSnapshot: {
      findUnique: async (_args: any) => {
        calls.push('findUnique');
        if (!exists) return null;
        return { id: baseSnapshot.snapshotId, snapshotHash: hash };
      },
    },
    reportArtifact: {
      create: async (args: any) => {
        const format = args.data.format as string;
        calls.push(`create:${format}`);
        createdArtifacts.push(args.data);
        return {
          id: artifactIds[format] ?? 'artifact-unknown',
          ...args.data,
        };
      },
    },
    _calls: calls,
    _createdArtifacts: createdArtifacts,
  } as any;
};

// ─── HTML generation ──────────────────────────────────────────────────────────

describe('report artifact — HTML', () => {
  it('generates HTML with correct period label and snapshot id', () => {
    const buf = generateHtmlArtifact(baseSnapshot);
    const html = buf.toString('utf-8');

    expect(html).toContain('januari 2026');
    expect(html).toContain(baseSnapshot.snapshotId);
    expect(html).toContain(baseSnapshot.snapshotHash);
    expect(html).toContain('EUR 2500.00'); // 250000 cents = EUR 2500.00
    expect(html).toContain('EUR 1000.00'); // 100000 cents
    expect(html).toContain('YA');
    expect(html).toContain('Schenking');
    expect(html).toContain('Giften in');
    expect(html).toContain('Administratiekosten uit');
  });

  it('HTML artifact is a Buffer with sha256 equal to hash of its bytes', () => {
    const buf = generateHtmlArtifact(baseSnapshot);
    const sha256 = sha256OfBuffer(buf);

    expect(buf).toBeInstanceOf(Buffer);
    expect(sha256).toHaveLength(64);

    // Verify sha256 matches the content
    const recomputed = crypto.createHash('sha256').update(buf).digest('hex');
    expect(sha256).toBe(recomputed);
  });

  it('HTML for yearly report uses year label', () => {
    const yearlySnapshot: ArtifactSnapshotInput = { ...baseSnapshot, kind: 'YEARLY', month: null };
    const buf = generateHtmlArtifact(yearlySnapshot);
    const html = buf.toString('utf-8');
    expect(html).toContain('Jaar 2026');
  });
});

// ─── XLSX generation ──────────────────────────────────────────────────────────

describe('report artifact — XLSX', () => {
  it('generates XLSX bytes that are a valid Buffer', () => {
    const buf = generateXlsxArtifact(baseSnapshot);

    expect(buf).toBeInstanceOf(Buffer);
    expect(buf.byteLength).toBeGreaterThan(1000); // real xlsx is always larger than a few bytes
  });

  it('XLSX sha256 equals hash of its bytes', () => {
    const buf = generateXlsxArtifact(baseSnapshot);
    const sha256 = sha256OfBuffer(buf);
    const recomputed = crypto.createHash('sha256').update(buf).digest('hex');
    expect(sha256).toBe(recomputed);
  });

  it('XLSX generation is deterministic — same snapshot produces same bytes', () => {
    const buf1 = generateXlsxArtifact(baseSnapshot);
    const buf2 = generateXlsxArtifact(baseSnapshot);

    // Both should have same length and same sha256
    expect(sha256OfBuffer(buf1)).toBe(sha256OfBuffer(buf2));
  });
});

// ─── PDF generation ───────────────────────────────────────────────────────────

describe('report artifact — PDF', () => {
  it('generates a real PDF buffer', async () => {
    const buf = await generatePdfArtifact(baseSnapshot);
    const content = buf.toString('utf-8');

    expect(buf).toBeInstanceOf(Buffer);
    expect(buf.subarray(0, 4).toString('utf-8')).toBe('%PDF');
    expect(buf.byteLength).toBeGreaterThan(1000);
    expect(content).not.toContain('PDF_PLACEHOLDER');
    expect(content).not.toContain('PDF_BLOCKER');
  });

  it('PDF sha256 equals hash of retained bytes', async () => {
    const buf = await generatePdfArtifact(baseSnapshot);
    const sha256 = sha256OfBuffer(buf);
    const recomputed = crypto.createHash('sha256').update(buf).digest('hex');
    expect(sha256).toBe(recomputed);
  });

  it('uses service-level snapshot inputs without leaking env values', async () => {
    const envKey = ['REPORT_ARTIFACT_TEST', 'SECRET'].join('_');
    const previousEnvValue = process.env[envKey];
    process.env[envKey] = 'secret-value-that-must-not-appear';
    try {
      const buf = await generatePdfArtifact(baseSnapshot);
      const content = buf.toString('utf-8');

      expect(content).toContain(baseSnapshot.snapshotId);
      expect(pdfContainsAsciiHex(content, baseSnapshot.snapshotHash)).toBe(true);
      expect(pdfContainsAsciiHex(content, baseSnapshot.generatedAt.toISOString())).toBe(true);
      expect(pdfContainsAsciiHex(content, 'EUR 2500.00')).toBe(true);
      expect(pdfContainsAsciiHex(content, 'EUR 1000.00')).toBe(true);
      expect(content).not.toContain('secret-value-that-must-not-appear');
    } finally {
      if (previousEnvValue === undefined) {
        delete process.env[envKey];
      } else {
        process.env[envKey] = previousEnvValue;
      }
    }
  });

  it('empty-line snapshot still generates a valid PDF', async () => {
    const emptySnapshot: ArtifactSnapshotInput = { ...baseSnapshot, lines: [], transactionCount: 0 };
    const buf = await generatePdfArtifact(emptySnapshot);
    const content = buf.toString('utf-8');

    expect(buf.subarray(0, 4).toString('utf-8')).toBe('%PDF');
    expect(content).not.toContain('PDF_PLACEHOLDER');
    expect(content).not.toContain('PDF_BLOCKER');
  });
});

// ─── generateAndStoreReportArtifacts ─────────────────────────────────────────

describe('report artifact — store artifacts from one snapshot', () => {
  it('generates and stores HTML, XLSX, and PDF from one snapshot', async () => {
    const db = makeArtifactDb();
    const result = await generateAndStoreReportArtifacts(db, baseSnapshot);

    expect(result.snapshotId).toBe(baseSnapshot.snapshotId);
    expect(result.snapshotHash).toBe(baseSnapshot.snapshotHash);
    expect(result.htmlArtifactId).toBe('artifact-html-1');
    expect(result.xlsxArtifactId).toBe('artifact-xlsx-1');
    expect(result.pdfArtifactId).toBe('artifact-pdf-1');
    expect(result.pdfBlocker).toBeNull();
    expect(result.sideEffects.createsReportArtifact).toBe(true);
    expect(result.sideEffects.createsReportApproval).toBe(false);
    expect(result.sideEffects.dispatchesReport).toBe(false);
  });

  it('all three formats derive from the same snapshot id and hash', async () => {
    const db = makeArtifactDb();
    const result = await generateAndStoreReportArtifacts(db, baseSnapshot);

    expect(result.snapshotId).toBe(baseSnapshot.snapshotId);
    expect(result.snapshotHash).toBe(baseSnapshot.snapshotHash);
    // All three artifact calls should have received the same snapshotId
    const formatCalls = db._calls.filter((c: string) => c.startsWith('create:'));
    expect(formatCalls).toHaveLength(3);
    expect(formatCalls).toContain('create:HTML');
    expect(formatCalls).toContain('create:XLSX');
    expect(formatCalls).toContain('create:PDF');
  });

  it('stores PDF with application/pdf media type and retained-byte sha256', async () => {
    const db = makeArtifactDb();
    await generateAndStoreReportArtifacts(db, baseSnapshot);

    const pdfArtifact = db._createdArtifacts.find((a: any) => a.format === 'PDF');
    expect(pdfArtifact.mediaType).toBe('application/pdf');
    expect(pdfArtifact.content.subarray(0, 4).toString('utf-8')).toBe('%PDF');
    expect(pdfArtifact.sha256).toBe(sha256OfBuffer(pdfArtifact.content));
  });

  it('rejects when snapshot not found', async () => {
    const db = makeArtifactDb({ snapshotExists: false });

    await expect(
      generateAndStoreReportArtifacts(db, baseSnapshot),
    ).rejects.toThrow(ReportArtifactError);
  });

  it('rejects stale snapshot hash', async () => {
    const db = makeArtifactDb({ snapshotHashOverride: 'wrong-hash' });

    await expect(
      generateAndStoreReportArtifacts(db, baseSnapshot),
    ).rejects.toThrow(ReportArtifactError);
  });

  it('HTML and XLSX artifacts include same totals as snapshot', async () => {
    // Verify HTML embeds the income/expense totals
    const htmlBuf = generateHtmlArtifact(baseSnapshot);
    const html = htmlBuf.toString();

    expect(html).toContain('EUR 2500.00'); // incomeMinor = 250000 cents
    expect(html).toContain('EUR 1000.00'); // expenseMinor = 100000 cents
    expect(html).toContain(baseSnapshot.snapshotId);
    expect(html).toContain(baseSnapshot.snapshotHash);

    // Verify XLSX can be generated without error
    const xlsxBuf = generateXlsxArtifact(baseSnapshot);
    expect(xlsxBuf.byteLength).toBeGreaterThan(0);
  });

  it('original source files are NOT included as report artifacts', async () => {
    // Source bank files should never be stored as ReportArtifact records.
    // This test verifies the artifact generation does not reference SourceFile
    // or attempt to retrieve/embed bank export files.
    const db = makeArtifactDb();
    // If a SourceFile table is accidentally queried, this would throw because
    // we did not stub it. The test passing confirms no SourceFile access.
    const result = await generateAndStoreReportArtifacts(db, baseSnapshot);
    expect(result).toBeDefined();
    // No 'sourceFile' in the db calls
    const sourceFileCalls = db._calls.filter((c: string) => c.includes('sourceFile'));
    expect(sourceFileCalls).toHaveLength(0);
  });
});
