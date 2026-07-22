import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  MERCHANT_KNOWLEDGE_PAGE_SIZES,
  MERCHANT_KNOWLEDGE_STATUS_OPTIONS,
  classifyMerchantKnowledgeError,
  normalizeMerchantKnowledgePageSize,
  normalizeMerchantKnowledgeQuery,
} from '../../src/helpers/merchantKnowledgeAdmin';
import { FINANCE_NAV_ITEMS } from '../../src/helpers/navigation';

const pageSource = fs.readFileSync(
  path.join(process.cwd(), 'src/ui/MerchantKnowledgeAdminPage.tsx'),
  'utf8',
);
const routeSource = fs.readFileSync(
  path.join(process.cwd(), 'src/app/merchant-knowledge/page.tsx'),
  'utf8',
);

describe('Program Phase 3.8B Merchant Knowledge administrator page', () => {
  it('is placed in the authenticated finance shell and canonical navigation', () => {
    expect(pageSource).toContain('<FinanceAppFrame');
    expect(pageSource).toContain('activeHref="/merchant-knowledge"');
    expect(routeSource).toContain('<MerchantKnowledgeAdminPage />');
    expect(FINANCE_NAV_ITEMS).toContainEqual(expect.objectContaining({
      label: 'Merchant Knowledge',
      href: '/merchant-knowledge',
    }));
  });

  it('preserves administrator and viewer reads by adding no client-role gate', () => {
    expect(pageSource).not.toContain('isClientAdmin');
    expect(pageSource).not.toContain('getClientRole');
    expect(pageSource).toContain('fetchMerchantKnowledgeSummary');
    expect(pageSource).toContain('fetchMerchantKnowledgeMerchants');
    expect(pageSource).toContain('fetchMerchantKnowledgeMerchantDetail');
  });

  it('provides stable disabled, unavailable, loading, empty, and detail-not-found states', () => {
    expect(classifyMerchantKnowledgeError('Merchant Knowledge-leestoegang is uitgeschakeld.')).toBe('disabled');
    expect(classifyMerchantKnowledgeError('Geen toegang tot deze financiële werkruimte.')).toBe('unavailable');
    expect(pageSource).toContain('Merchant Knowledge laden…');
    expect(pageSource).toContain('Geen handelaars gevonden');
    expect(pageSource).toContain('Selecteer een handelaar om privacyveilige details te bekijken.');
    expect(pageSource).toContain('merchant: null');
  });

  it('renders summary counts and explicit zero-side-effect messaging', () => {
    for (const label of ['Handelaars', 'Aliassen', 'Vingerafdrukken', 'Open conflicten']) {
      expect(pageSource).toContain(label);
    }
    expect(pageSource).toContain('Deze pagina maakt geen transactieboeking en wijzigt geen bankfeiten.');
    expect(pageSource).toContain('readOnly: true');
    expect(pageSource).toContain('createsTransactionBooking: false');
    expect(pageSource).toContain('mutatesBankFacts: false');
  });

  it('limits filters and deterministic pagination controls to approved values', () => {
    expect(MERCHANT_KNOWLEDGE_PAGE_SIZES).toEqual([25, 50, 100]);
    expect(normalizeMerchantKnowledgePageSize(50)).toBe(50);
    expect(normalizeMerchantKnowledgePageSize(999)).toBe(25);
    expect(normalizeMerchantKnowledgeQuery(`  ${'x'.repeat(120)}  `)).toBe('x'.repeat(100));
    expect(MERCHANT_KNOWLEDGE_STATUS_OPTIONS.map((option) => option.value)).toEqual([
      '', 'PROPOSED', 'ACTIVE', 'CONFLICTED', 'MERGED', 'DEPRECATED',
    ]);
    expect(pageSource).toContain('setPage((value) => Math.max(1, value - 1))');
    expect(pageSource).toContain('setPage((value) => value + 1)');
    expect(pageSource).toContain('page > listResponse.pagination.totalPages');
  });

  it('renders only privacy-safe evidence fields and preserves IBAN masking from Phase 3.8A', () => {
    expect(pageSource).toContain('item.displayValue');
    expect(pageSource).toContain('Bronwaarde afgeschermd');
    expect(pageSource).toContain('item.valueHash');
    expect(pageSource).toContain('item.evidenceHash');
    expect(pageSource).toContain('item.normalizationVersion ?? item.extractionVersion');
    expect(pageSource).not.toContain('normalizedValue');
    expect(pageSource).not.toContain('rawEvidence');
  });

  it('uses accessible labels and keyboard-operable native controls', () => {
    for (const label of [
      'Zoek handelaars',
      'Filter op status',
      'Aantal handelaars per pagina',
      'Paginering Merchant Knowledge',
      'Handelaarslijst',
    ]) {
      expect(pageSource).toContain(label);
    }
    expect(pageSource).toContain("event.key === 'Enter'");
    expect(pageSource).toContain('aria-label={`Bekijk details van ${merchant.canonicalName}`}');
    expect(pageSource).toContain('aria-live="polite"');
  });

  it('introduces no mutation control, request, route, bridge, or direct Prisma access', () => {
    expect(pageSource).not.toMatch(/\b(create|update|delete|upsert|merge|split|approve|reject|retry|resolve)MerchantKnowledge/i);
    expect(pageSource).not.toMatch(/method:\s*['"](POST|PATCH|PUT|DELETE)['"]/);
    expect(pageSource).not.toContain('prisma');
    expect(pageSource).not.toContain('fetch(');
    expect(pageSource).not.toMatch(/>\s*(Aanmaken|Bewerken|Samenvoegen|Splitsen|Goedkeuren|Afwijzen|Verwijderen)\s*</i);
  });
});
