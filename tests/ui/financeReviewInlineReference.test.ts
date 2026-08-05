import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const pageSource = fs.readFileSync(
  path.join(process.cwd(), 'src/ui/FinanceReviewPage.tsx'),
  'utf8',
);

describe('Finance review inline reference creation', () => {
  it('uses the exact Klant, Type, and Category labels', () => {
    expect(pageSource).toContain('aria-label="Klant"');
    expect(pageSource).toContain('aria-label="Transactietype"');
    expect(pageSource).toContain('aria-label="Category"');
    expect(pageSource).toContain('<span>Klant</span><span>Type</span><span>Category</span>');
  });

  it('offers administrator inline creation beside all three dropdowns', () => {
    expect(pageSource).toContain('+ Nieuwe Klant');
    expect(pageSource).toContain('+ Nieuw Type');
    expect(pageSource).toContain('+ Nieuwe Category');
    expect(pageSource).toContain('createReferenceProject');
    expect(pageSource).toContain('createReferenceTransactionType');
    expect(pageSource).toContain('createReferenceCategory');
  });

  it('selects each newly created value without confirming the transaction', () => {
    expect(pageSource).toContain('setProjectId(project.id)');
    expect(pageSource).toContain('setTransactionTypeId(transactionType.id)');
    expect(pageSource).toContain('setCategoryId(category.id)');
    expect(pageSource).toContain('Bevestigen blijft een aparte handeling.');
    expect(pageSource).toContain('await updateCategory(item.transactionId');
  });

  it('supports debit, credit, and both-direction transaction types', () => {
    expect(pageSource).toContain('<option value="debit">Afschrijving</option>');
    expect(pageSource).toContain('<option value="credit">Bijschrijving</option>');
    expect(pageSource).toContain('<option value="both">Beide richtingen</option>');
    expect(pageSource).toContain("inlineTypeDirection === 'both' ? null : inlineTypeDirection");
    expect(pageSource).toContain('type.direction === null || type.direction === item.direction');
  });

  it('updates shared option lists so new values are available to every review row', () => {
    expect(pageSource).toContain('setData((current) => current ? {');
    expect(pageSource).toContain('projects: [...current.projects.filter');
    expect(pageSource).toContain('transactionTypes: [...current.transactionTypes.filter');
    expect(pageSource).toContain('categories: [...current.categories.filter');
  });
});
