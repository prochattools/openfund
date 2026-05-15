import type { LedgerTransaction } from '@/helpers/api-transaction-mapper';

const normalizeValue = (value?: string | null): string | null => {
  if (value === undefined || value === null) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
};

const valuesMatch = (a: string | null, b: string | null): boolean => {
  if (!a || !b) {
    return false;
  }
  return a.trim().toLowerCase() === b.trim().toLowerCase();
};

export const buildTransactionTooltip = (tx: LedgerTransaction): string | null => {
  const parts: string[] = [];
  const dedupe = new Set<string>();

  const push = (label: string | null) => {
    if (!label) {
      return;
    }
    const normalized = label.toLowerCase();
    if (dedupe.has(normalized)) {
      return;
    }
    dedupe.add(normalized);
    parts.push(label);
  };

  const notification = normalizeValue(tx.notificationDetail);
  const description = normalizeValue(tx.description);
  const source = normalizeValue(tx.source);
  const accountLabel = normalizeValue(tx.accountLabel);
  const accountIdentifier = normalizeValue(tx.accountIdentifier);

  push(notification);

  if (source && !valuesMatch(source, description)) {
    push(source);
  }

  if (accountLabel) {
    push(`Account: ${accountLabel}`);
  }

  if (accountIdentifier && !valuesMatch(accountIdentifier, accountLabel)) {
    push(`Identifier: ${accountIdentifier}`);
  }

  if (!parts.length) {
    push(description);
  }

  return parts.length ? parts.join(' • ') : null;
};
