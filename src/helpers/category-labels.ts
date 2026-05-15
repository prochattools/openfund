export const slugify = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

export const deriveMainCategoryId = (value: string | null | undefined): string | null => {
  if (!value) return null;
  const slug = slugify(value);
  if (!slug) return null;
  return `main:${slug}`;
};

export const splitCategoryLabel = (
  value?: string | null,
): { main: string | null; sub: string | null } => {
  if (!value) {
    return { main: null, sub: null };
  }

  const parts = value.split(' — ');
  if (parts.length === 1) {
    const trimmed = parts[0]!.trim();
    const safe = trimmed.length ? trimmed : null;
    return { main: safe, sub: safe };
  }

  const main = parts[0]!.trim();
  const sub = parts.slice(1).join(' — ').trim();
  return {
    main: main.length ? main : null,
    sub: sub.length ? sub : (main.length ? main : null),
  };
};

export const firstNonEmpty = (values: Array<string | null | undefined>): string | null => {
  for (const value of values) {
    if (!value) continue;
    const trimmed = value.trim();
    if (trimmed.length) return trimmed;
  }
  return null;
};

export const distinctFrom = (value: string | null, other: string | null): string | null => {
  if (!value) return null;
  if (!other) return value;
  return value.trim() === other.trim() ? null : value;
};
