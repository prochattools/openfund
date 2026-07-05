/**
 * UX-002 — Navigation simplification tests.
 *
 * Validates that:
 * - Navigation is limited to the confirmed finance workflow.
 * - All navigation labels are Dutch.
 * - No SaaS, marketing, billing, or unrelated surfaces are included.
 * - Core workflow hrefs are present.
 */

import { describe, expect, it } from 'vitest';
import { FINANCE_NAV_ITEMS, getNavLabel, areNavItemsDutch } from '../../src/helpers/navigation';

describe('navigation — Dutch workflow only', () => {
  it('exports a non-empty nav items array', () => {
    expect(Array.isArray(FINANCE_NAV_ITEMS)).toBe(true);
    expect(FINANCE_NAV_ITEMS.length).toBeGreaterThan(0);
  });

  it('all nav items have non-empty label and href', () => {
    for (const item of FINANCE_NAV_ITEMS) {
      expect(item.label.length).toBeGreaterThan(0);
      expect(item.href.length).toBeGreaterThan(0);
    }
  });

  it('areNavItemsDutch returns true', () => {
    expect(areNavItemsDutch()).toBe(true);
  });

  it('includes core workflow nav items', () => {
    const labels = FINANCE_NAV_ITEMS.map((i) => i.label);
    expect(labels).toContain('Importeren');
    expect(labels).toContain('Beoordelen');
    expect(labels).toContain('Rapporten');
    expect(labels).toContain('Instellingen');
  });

  it('does not include SaaS, marketing, or unrelated English labels', () => {
    const labels = FINANCE_NAV_ITEMS.map((i) => i.label);
    const disallowed = ['Pricing', 'Billing', 'Subscription', 'Marketing', 'Blog', 'Users', 'Tenants', 'Organizations'];
    for (const label of disallowed) {
      expect(labels).not.toContain(label);
    }
  });

  it('all hrefs are internal paths or anchors', () => {
    for (const item of FINANCE_NAV_ITEMS) {
      expect(item.href).toMatch(/^\//);
    }
  });
});

describe('navigation — getNavLabel helper', () => {
  it('returns the label for a known href', () => {
    const label = getNavLabel('/review');
    expect(label).toBe('Beoordelen');
  });

  it('returns the label for the root path', () => {
    const label = getNavLabel('/');
    expect(label).toBe('Dashboard');
  });

  it('returns null for an unknown href', () => {
    expect(getNavLabel('/pricing')).toBeNull();
    expect(getNavLabel('/billing')).toBeNull();
    expect(getNavLabel('/admin/users')).toBeNull();
  });
});

describe('navigation — workflow completeness', () => {
  it('includes the import workflow path', () => {
    const hrefs = FINANCE_NAV_ITEMS.map((i) => i.href);
    const hasImport = hrefs.some((h) => h.includes('ledger') || h.includes('importeren'));
    expect(hasImport).toBe(true);
  });

  it('includes the review queue path', () => {
    const hrefs = FINANCE_NAV_ITEMS.map((i) => i.href);
    expect(hrefs).toContain('/review');
  });

  it('includes the reports path', () => {
    const hrefs = FINANCE_NAV_ITEMS.map((i) => i.href);
    expect(hrefs).toContain('/reports');
  });

  it('includes the settings path', () => {
    const hrefs = FINANCE_NAV_ITEMS.map((i) => i.href);
    expect(hrefs).toContain('/settings');
  });
});
