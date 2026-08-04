import { describe, expect, it } from 'vitest';
import {
  canConfirmReviewRow,
  getReviewConfirmLabel,
  getReviewReliability,
  getReviewSelectionValidity,
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
  prefill: {
    source: 'NONE' as const,
    complete: false,
    weakFallback: false,
    scoreBasisPoints: null,
    confidence: null,
    matcher: null,
  },
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

  it('requires visible project, type, and category options before confirmation is allowed', () => {
    const validity = getReviewSelectionValidity({
      admin: true,
      busy: false,
      projectId: 'project-1',
      transactionTypeId: 'type-credit',
      categoryId: 'category-1',
      projects: [{ id: 'project-1', code: 'YA', name: 'Yeshua Academy' }],
      transactionTypes: [
        { id: 'type-credit', literalName: 'Schenking in', direction: 'credit' },
        { id: 'type-debit', literalName: 'Bankkosten', direction: 'debit' },
      ],
      compatibleTransactionTypes: [
        { id: 'type-credit', literalName: 'Schenking in', direction: 'credit' },
      ],
      categories: [{ id: 'category-1', name: 'Giften' }],
    });

    expect(validity.canConfirm).toBe(true);
    expect(validity.projectVisible).toBe(true);
    expect(validity.transactionTypeVisible).toBe(true);
    expect(validity.categoryVisible).toBe(true);
    expect(validity.issues).toEqual([]);
  });

  it('blocks missing project IDs with a deterministic warning', () => {
    const validity = getReviewSelectionValidity({
      admin: true,
      busy: false,
      projectId: '',
      transactionTypeId: 'type-credit',
      categoryId: 'category-1',
      projects: [{ id: 'project-1', code: 'YA', name: 'Yeshua Academy' }],
      transactionTypes: [{ id: 'type-credit', literalName: 'Schenking in', direction: 'credit' }],
      compatibleTransactionTypes: [{ id: 'type-credit', literalName: 'Schenking in', direction: 'credit' }],
      categories: [{ id: 'category-1', name: 'Giften' }],
    });

    expect(validity.canConfirm).toBe(false);
    expect(validity.issues).toEqual([
      expect.objectContaining({
        field: 'project',
        code: 'missing-project-id',
        message: 'Kies een geldige Klant.',
        rawId: null,
      }),
    ]);
  });

  it('blocks project IDs that are not available in the current project options', () => {
    const validity = getReviewSelectionValidity({
      admin: true,
      busy: false,
      projectId: 'project-missing',
      transactionTypeId: 'type-credit',
      categoryId: 'category-1',
      projects: [{ id: 'project-1', code: 'YA', name: 'Yeshua Academy' }],
      transactionTypes: [{ id: 'type-credit', literalName: 'Schenking in', direction: 'credit' }],
      compatibleTransactionTypes: [{ id: 'type-credit', literalName: 'Schenking in', direction: 'credit' }],
      categories: [{ id: 'category-1', name: 'Giften' }],
    });

    expect(validity.canConfirm).toBe(false);
    expect(validity.issues[0]).toMatchObject({
      field: 'project',
      code: 'unavailable-project',
      message: 'De voorgestelde Klant is niet meer beschikbaar. Kies een geldige Klant.',
      rawId: 'project-missing',
    });
  });

  it('blocks category IDs that are not available in the current category options', () => {
    const validity = getReviewSelectionValidity({
      admin: true,
      busy: false,
      projectId: 'project-1',
      transactionTypeId: 'type-credit',
      categoryId: 'category-missing',
      projects: [{ id: 'project-1', code: 'YA', name: 'Yeshua Academy' }],
      transactionTypes: [{ id: 'type-credit', literalName: 'Schenking in', direction: 'credit' }],
      compatibleTransactionTypes: [{ id: 'type-credit', literalName: 'Schenking in', direction: 'credit' }],
      categories: [{ id: 'category-1', name: 'Giften' }],
    });

    expect(validity.canConfirm).toBe(false);
    expect(validity.issues[0]).toMatchObject({
      field: 'category',
      code: 'unavailable-category',
      message: 'De voorgestelde categorie is niet meer beschikbaar. Kies een geldige categorie.',
      rawId: 'category-missing',
    });
  });

  it('blocks transaction types that are missing from the compatible options', () => {
    const validity = getReviewSelectionValidity({
      admin: true,
      busy: false,
      projectId: 'project-1',
      transactionTypeId: 'type-missing',
      categoryId: 'category-1',
      projects: [{ id: 'project-1', code: 'YA', name: 'Yeshua Academy' }],
      transactionTypes: [{ id: 'type-credit', literalName: 'Schenking in', direction: 'credit' }],
      compatibleTransactionTypes: [{ id: 'type-credit', literalName: 'Schenking in', direction: 'credit' }],
      categories: [{ id: 'category-1', name: 'Giften' }],
    });

    expect(validity.canConfirm).toBe(false);
    expect(validity.issues[0]).toMatchObject({
      field: 'transactionType',
      code: 'unavailable-transaction-type',
      message: 'Het voorgestelde transactietype is niet meer beschikbaar. Kies een geldig transactietype.',
      rawId: 'type-missing',
    });
  });

  it('blocks transaction types that exist but are not compatible with the transaction direction', () => {
    const validity = getReviewSelectionValidity({
      admin: true,
      busy: false,
      projectId: 'project-1',
      transactionTypeId: 'type-debit',
      categoryId: 'category-1',
      projects: [{ id: 'project-1', code: 'YA', name: 'Yeshua Academy' }],
      transactionTypes: [
        { id: 'type-credit', literalName: 'Schenking in', direction: 'credit' },
        { id: 'type-debit', literalName: 'Bankkosten', direction: 'debit' },
      ],
      compatibleTransactionTypes: [{ id: 'type-credit', literalName: 'Schenking in', direction: 'credit' }],
      categories: [{ id: 'category-1', name: 'Giften' }],
    });

    expect(validity.canConfirm).toBe(false);
    expect(validity.issues[0]).toMatchObject({
      field: 'transactionType',
      code: 'wrong-direction-transaction-type',
      message: 'Het voorgestelde transactietype is niet beschikbaar voor deze richting. Kies een geldig transactietype voordat je bevestigt.',
      rawId: 'type-debit',
    });
  });

  it('keeps viewer and busy rows blocked even when the visible options are valid', () => {
    const validInput = {
      projectId: 'project-1',
      transactionTypeId: 'type-credit',
      categoryId: 'category-1',
      projects: [{ id: 'project-1', code: 'YA', name: 'Yeshua Academy' }],
      transactionTypes: [{ id: 'type-credit', literalName: 'Schenking in', direction: 'credit' as const }],
      compatibleTransactionTypes: [{ id: 'type-credit', literalName: 'Schenking in', direction: 'credit' as const }],
      categories: [{ id: 'category-1', name: 'Giften' }],
    };

    expect(getReviewSelectionValidity({ admin: false, busy: false, ...validInput }).canConfirm).toBe(false);
    expect(getReviewSelectionValidity({ admin: true, busy: true, ...validInput }).canConfirm).toBe(false);
  });

  it('accepts null-direction (both) types as compatible with credit transactions', () => {
    const validity = getReviewSelectionValidity({
      admin: true,
      busy: false,
      projectId: 'project-1',
      transactionTypeId: 'type-both',
      categoryId: 'category-1',
      projects: [{ id: 'project-1', code: 'FTK', name: 'FTK' }],
      transactionTypes: [{ id: 'type-both', literalName: 'Schenking', direction: null }],
      compatibleTransactionTypes: [{ id: 'type-both', literalName: 'Schenking', direction: null }],
      categories: [{ id: 'category-1', name: 'schenking FTK' }],
    });
    expect(validity.canConfirm).toBe(true);
    expect(validity.issues).toEqual([]);
  });

  it('accepts null-direction (both) types as compatible with debit transactions', () => {
    const validity = getReviewSelectionValidity({
      admin: true,
      busy: false,
      projectId: 'project-1',
      transactionTypeId: 'type-both',
      categoryId: 'category-1',
      projects: [{ id: 'project-1', code: 'FTK', name: 'FTK' }],
      transactionTypes: [{ id: 'type-both', literalName: 'Ondersteuning', direction: null }],
      compatibleTransactionTypes: [{ id: 'type-both', literalName: 'Ondersteuning', direction: null }],
      categories: [{ id: 'category-1', name: 'Ondersteuning Zambia' }],
    });
    expect(validity.canConfirm).toBe(true);
    expect(validity.issues).toEqual([]);
  });

  it('uses Klant terminology in missing-project-id message', () => {
    const validity = getReviewSelectionValidity({
      admin: true,
      busy: false,
      projectId: '',
      transactionTypeId: 'type-both',
      categoryId: 'category-1',
      projects: [{ id: 'project-1', code: 'FTK', name: 'FTK' }],
      transactionTypes: [{ id: 'type-both', literalName: 'Schenking', direction: null }],
      compatibleTransactionTypes: [{ id: 'type-both', literalName: 'Schenking', direction: null }],
      categories: [{ id: 'category-1', name: 'schenking FTK' }],
    });
    expect(validity.issues[0]).toMatchObject({ field: 'project', code: 'missing-project-id', message: 'Kies een geldige Klant.' });
  });

  it('keeps the changed label separate from confirmation eligibility and reliability', () => {
    expect(getReviewConfirmLabel({ admin: true, busy: false, changed: false })).toBe('Bevestigen');
    expect(getReviewConfirmLabel({ admin: true, busy: false, changed: true })).toBe('Wijzigingen bevestigen');
    expect(getReviewReliability(makeItem({
      deterministicStatus: 'conflict',
      alternatives: [{ confidence: 'EXACT_FALLBACK' } as EvidenceRichReviewItem['alternatives'][number]],
    }))).toMatchObject({ band: 'red', score: 60, label: 'Onzeker' });
  });
});
