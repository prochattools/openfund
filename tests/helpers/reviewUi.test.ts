import { describe, expect, it } from 'vitest';
import {
  canConfirmReviewRow,
  getReviewConfirmLabel,
  getReviewReliability,
} from '../../src/helpers/review-ui';
import type { EvidenceRichReviewItem } from '../../src/libs/api';

const makeItem = (overrides: Partial<EvidenceRichReviewItem> = {}): EvidenceRichReviewItem => ({
  id: 'tx-1',
  transactionId: 'tx-1',
  previewFingerprint: null,
  displayDate: '2026-07-01T00:00:00.000Z',
  rawIngDate: '2026-07-01',
  counterparty: 'Vendor',
  counterpartyIban: null,
  accountIdentifier: null,
  accountName: null,
  amount: -10,
  amountMinor: '1000',
  currency: 'EUR',
  direction: 'debit',
  directionLabel: 'Afschrijving',
  description: 'Test transaction',
  paymentPurpose: null,
  source: 'test',
  deterministicStatus: 'unmatched',
  statusLabel: 'Geen match',
  reason: 'Handmatige controle nodig',
  proposed: null,
  alternatives: [],
  evidence: {
    matchedRuleIds: [],
    historicalRecordIds: [],
    evidenceHashes: [],
    importFingerprint: null,
    exactReplayKey: null,
    reason: 'Handmatige controle nodig',
  },
  safeDeterministicCandidate: false,
  requiresAdministratorApproval: true,
  sideEffects: {
    createsTransactionBooking: false,
    closesPeriod: false,
  },
  ...overrides,
});

describe('review UI helpers', () => {
  it('shows conflicting suggestions as uncertain even when the first alternative is exact', () => {
    const reliability = getReviewReliability(makeItem({
      deterministicStatus: 'conflict',
      alternatives: [{ confidence: 'EXACT_FALLBACK' } as EvidenceRichReviewItem['alternatives'][number]],
    }));

    expect(reliability).toMatchObject({ band: 'red', score: 60, label: 'Onzeker' });
  });

  it('uses text labels for every reliability band', () => {
    expect(getReviewReliability(makeItem()).label).toBe('Onvoldoende bewijs');
    expect(getReviewReliability(makeItem({ deterministicStatus: 'finalized' })).label).toBe('Zeer betrouwbaar');
    expect(getReviewReliability(makeItem({ alternatives: [{ confidence: 'OVERALL' } as EvidenceRichReviewItem['alternatives'][number]] })).label).toBe('Controleer zorgvuldig');
    expect(getReviewReliability(makeItem({ alternatives: [{ confidence: 'FUZZY' } as EvidenceRichReviewItem['alternatives'][number]] })).label).toBe('Onzeker');
  });

  it('blocks viewers, busy rows, and incomplete classifications', () => {
    const complete = { projectId: 'project-1', transactionTypeId: 'type-1', categoryId: 'category-1' };
    expect(canConfirmReviewRow({ admin: false, busy: false, ...complete })).toBe(false);
    expect(canConfirmReviewRow({ admin: true, busy: true, ...complete })).toBe(false);
    expect(canConfirmReviewRow({ admin: true, busy: false, ...complete, categoryId: '' })).toBe(false);
    expect(canConfirmReviewRow({ admin: true, busy: false, ...complete })).toBe(true);
  });

  it('communicates viewer, saving, unchanged, and changed states', () => {
    expect(getReviewConfirmLabel({ admin: false, busy: false, changed: false })).toBe('Alleen beheerder');
    expect(getReviewConfirmLabel({ admin: true, busy: true, changed: false })).toBe('Opslaan…');
    expect(getReviewConfirmLabel({ admin: true, busy: false, changed: false })).toBe('Bevestigen');
    expect(getReviewConfirmLabel({ admin: true, busy: false, changed: true })).toBe('Wijzigingen bevestigen');
  });
});
