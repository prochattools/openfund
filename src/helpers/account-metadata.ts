export type AccountLabelEntry = {
  keys: string[];
  label: string;
  altLabel?: string;
  altPattern?: RegExp;
  identifier?: string;
};

export const ACCOUNT_LABEL_ENTRIES: AccountLabelEntry[] = [
  {
    keys: ['NL89INGB0006369960'],
    label: 'Yeshua Academy',
    identifier: 'NL89INGB0006369960',
    altLabel: 'Vila Solidária',
    altPattern: /VILA|SOLIDARIA/i,
  },
  {
    keys: ['R 951-98945', 'R95198945'],
    label: 'Fellowship Renswoude',
    identifier: 'R 951-98945',
  },
  {
    keys: ['K 577-97642', 'K57797642'],
    label: 'Fellowship Veluwe',
    identifier: 'K 577-97642',
  },
  {
    keys: ['C 951-98936', 'C95198936'],
    label: 'Fellowship Barneveld',
    identifier: 'C 951-98936',
  },
  {
    keys: ['F 951-98948', 'F95198948'],
    label: 'Yeshua Academy Savings',
    identifier: 'F 951-98948',
  },
];

export const normalizeAccountKey = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Z0-9]/gi, '')
    .toUpperCase();

const ACCOUNT_LABEL_LOOKUP: Map<string, AccountLabelEntry> = ACCOUNT_LABEL_ENTRIES.reduce(
  (acc, entry) => {
    entry.keys.forEach((key) => acc.set(normalizeAccountKey(key), entry));
    return acc;
  },
  new Map<string, AccountLabelEntry>(),
);

export const resolveAccountMetadata = (
  rawValue: string | null | undefined,
): { label: string | null; identifier: string | null } => {
  if (!rawValue) {
    return { label: null, identifier: null };
  }
  const trimmed = rawValue.trim();
  if (!trimmed) {
    return { label: null, identifier: null };
  }

  const normalized = normalizeAccountKey(trimmed);
  let entry = ACCOUNT_LABEL_LOOKUP.get(normalized);
  if (!entry) {
    for (const candidate of ACCOUNT_LABEL_ENTRIES) {
      if (candidate.keys.some((key) => normalized.includes(normalizeAccountKey(key)))) {
        entry = candidate;
        break;
      }
    }
  }
  if (!entry) {
    return { label: null, identifier: null };
  }

  let label = entry.label;
  if (
    entry.altLabel &&
    entry.altPattern &&
    (entry.altPattern.test(trimmed) || entry.altPattern.test(normalized))
  ) {
    label = entry.altLabel;
  }

  return {
    label,
    identifier: entry.identifier ?? trimmed,
  };
};
