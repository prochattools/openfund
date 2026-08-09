import { describe, it, expect } from 'vitest';
import { generateHtmlArtifact, type ArtifactSnapshotInput } from '../../server/services/reportArtifactService';
import type { CounterpartySummary } from '../../server/services/reportReconciliationService';

const buildJuneSnapshot = (overrides?: Partial<ArtifactSnapshotInput>): ArtifactSnapshotInput => ({
  snapshotId: 'snap-test-001',
  snapshotHash: 'abc123def456',
  kind: 'MONTHLY',
  year: 2026,
  month: 6,
  openingBalanceMinor: 939082n,
  incomeMinor: 1305798n,
  expenseMinor: 1303656n,
  netMinor: 2142n,
  closingBalanceMinor: 941224n,
  transactionCount: 37,
  generatedBy: 'user-test-001',
  generatedAt: new Date('2026-07-01T10:00:00.000Z'),
  lines: [
    {
      lineKind: 'CATEGORY_TOTAL',
      projectId: null,
      transactionTypeId: null,
      categoryId: 'cat-001',
      literalProjectLabel: 'Yeshua Academy',
      literalTypeLabel: 'Cursusgeld',
      literalCategoryLabel: 'Onderwijs',
      direction: 'credit',
      reportingClass: 'INCOME',
      amountMinor: '1305798',
      transactionCount: 20,
      sortOrder: 1,
    },
    {
      lineKind: 'CATEGORY_TOTAL',
      projectId: null,
      transactionTypeId: null,
      categoryId: 'cat-002',
      literalProjectLabel: 'Yeshua Academy',
      literalTypeLabel: 'Materiaalkosten',
      literalCategoryLabel: 'Inkoop',
      direction: 'debit',
      reportingClass: 'EXPENSE',
      amountMinor: '1303656',
      transactionCount: 17,
      sortOrder: 2,
    },
  ],
  counterparties: [
    {
      counterparty: 'Student A',
      incomeMinor: 700000n,
      expenseMinor: 0n,
      differenceMinor: 700000n,
      transactionCount: 10,
    },
    {
      counterparty: 'Student B',
      incomeMinor: 605798n,
      expenseMinor: 0n,
      differenceMinor: 605798n,
      transactionCount: 10,
    },
    {
      counterparty: 'Leverancier X',
      incomeMinor: 0n,
      expenseMinor: 800000n,
      differenceMinor: -800000n,
      transactionCount: 10,
    },
    {
      counterparty: 'Leverancier Y',
      incomeMinor: 0n,
      expenseMinor: 503656n,
      differenceMinor: -503656n,
      transactionCount: 7,
    },
  ],
  ...overrides,
});

describe('generateHtmlArtifact — public report content', () => {
  it('does NOT include Snapshot-ID in the HTML', () => {
    const html = generateHtmlArtifact(buildJuneSnapshot()).toString('utf-8');
    expect(html).not.toContain('Snapshot-ID');
    expect(html).not.toContain('snap-test-001');
  });

  it('does NOT include snapshot hash in the HTML', () => {
    const html = generateHtmlArtifact(buildJuneSnapshot()).toString('utf-8');
    expect(html).not.toContain('abc123def456');
  });

  it('does NOT include UUID-style technical identifiers', () => {
    const html = generateHtmlArtifact(buildJuneSnapshot()).toString('utf-8');
    expect(html).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/);
  });

  it('does NOT include technical timestamp', () => {
    const html = generateHtmlArtifact(buildJuneSnapshot()).toString('utf-8');
    expect(html).not.toContain('2026-07-01T10:00:00.000Z');
    expect(html).not.toContain('Aangemaakt');
  });

  it('contains "Met vriendelijke groet" signature', () => {
    const html = generateHtmlArtifact(buildJuneSnapshot()).toString('utf-8');
    expect(html).toContain('Met vriendelijke groet');
  });

  it('contains Steve signature', () => {
    const html = generateHtmlArtifact(buildJuneSnapshot()).toString('utf-8');
    expect(html).toContain('<strong>Steve</strong>');
  });

  it('has correct title "Financieel Rapport — Juni 2026"', () => {
    const html = generateHtmlArtifact(buildJuneSnapshot()).toString('utf-8');
    expect(html).toContain('<title>Financieel Rapport — Juni 2026</title>');
  });

  it('has capitalized Dutch month in H1 heading', () => {
    const html = generateHtmlArtifact(buildJuneSnapshot()).toString('utf-8');
    expect(html).toContain('Financieel Rapport — Juni 2026');
    // Must NOT have lowercase juni
    expect(html).not.toContain('juni 2026');
  });

  it('includes counterparty section heading', () => {
    const html = generateHtmlArtifact(buildJuneSnapshot()).toString('utf-8');
    expect(html).toContain('Inkomsten en uitgaven per klant');
  });

  it('includes counterparty names in HTML', () => {
    const html = generateHtmlArtifact(buildJuneSnapshot()).toString('utf-8');
    expect(html).toContain('Student A');
    expect(html).toContain('Leverancier X');
  });

  it('colors positive difference green and negative red', () => {
    const html = generateHtmlArtifact(buildJuneSnapshot()).toString('utf-8');
    expect(html).toContain('#2e7d32');
    expect(html).toContain('#c62828');
  });

  it('renders opening balance as EUR format', () => {
    const html = generateHtmlArtifact(buildJuneSnapshot()).toString('utf-8');
    expect(html).toContain('EUR 9390.82');
  });

  it('renders closing balance as EUR format', () => {
    const html = generateHtmlArtifact(buildJuneSnapshot()).toString('utf-8');
    expect(html).toContain('EUR 9412.24');
  });

  it('renders net as EUR format', () => {
    const html = generateHtmlArtifact(buildJuneSnapshot()).toString('utf-8');
    expect(html).toContain('EUR 21.42');
  });

  it('shows empty counterparty placeholder when no counterparties provided', () => {
    const html = generateHtmlArtifact(buildJuneSnapshot({ counterparties: [] })).toString('utf-8');
    expect(html).toContain('Geen klantgegevens');
  });

  it('renders December 2026 correctly', () => {
    const html = generateHtmlArtifact(buildJuneSnapshot({ month: 12 })).toString('utf-8');
    expect(html).toContain('Financieel Rapport — December 2026');
  });
});
