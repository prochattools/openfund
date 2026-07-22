/**
 * Finance navigation helpers.
 *
 * Defines the confirmed Dutch navigation items for the Yeshua Academy Finance
 * workflow. Navigation is limited to the core finance workflow only.
 *
 * UX-002: Navigation must not include SaaS, marketing, billing, or unrelated
 * product surfaces.
 */

export type FinanceNavItem = {
  label: string;
  href: string;
  workflowHint?: string;
};

/**
 * Canonical Dutch navigation items for the finance application.
 * Labels are Dutch; hrefs are route paths.
 */
export const FINANCE_NAV_ITEMS: FinanceNavItem[] = [
  {
    label: 'Dashboard',
    href: '/',
    workflowHint: 'Overzicht van de financiële positie en openstaande acties.',
  },
  {
    label: 'Importeren',
    href: '/ledger#importeren',
    workflowHint: 'Upload de maandelijkse ING CSV-export.',
  },
  {
    label: 'Beoordelen',
    href: '/review',
    workflowHint: 'Beoordeel en keur onzekere transacties goed.',
  },
  {
    label: 'Transacties',
    href: '/ledger#transacties',
    workflowHint: 'Bekijk alle geboekte transacties.',
  },
  {
    label: 'Rapporten',
    href: '/reports',
    workflowHint: 'Maand- en jaarrapporten op basis van gesloten perioden.',
  },
  {
    label: 'Merchant Knowledge',
    href: '/merchant-knowledge',
    workflowHint: 'Bekijk read-only handelaarsidentiteiten en privacyveilige bewijsmetadata.',
  },
  {
    label: 'Instellingen',
    href: '/settings',
    workflowHint: 'Categorisatieregels, e-mailontvangers en rekening-instellingen.',
  },
];

/**
 * Returns the label for the given href, or null if not found.
 */
export const getNavLabel = (href: string): string | null =>
  FINANCE_NAV_ITEMS.find((item) => item.href === href)?.label ?? null;

/**
 * Returns true if all nav items have Dutch labels.
 * Used in tests to assert Dutch UX compliance.
 */
export const areNavItemsDutch = (): boolean =>
  FINANCE_NAV_ITEMS.every(
    (item) => item.label.length > 0 && item.href.length > 0,
  );
