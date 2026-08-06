import { createHash } from 'node:crypto';

export type NormalizedRecipient = {
  email: string;
  name: string | null;
};

export type RecipientNormalizationResult = {
  recipients: NormalizedRecipient[];
  recipientHash: string;
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateEmail(email: string): boolean {
  return EMAIL_REGEX.test(email);
}

/**
 * Normalizes a list of recipients into a canonical form and computes a deterministic hash.
 *
 * Normalization:
 * - Trims and lowercases all email addresses.
 * - Validates email format.
 * - Normalizes names: whitespace-only or empty becomes null; otherwise trimmed.
 * - Removes duplicate recipients (by email; first occurrence wins for name).
 * - Sorts deterministically by email (ASC), then by name (ASC, nulls first).
 *
 * Returns both the normalized recipient list and a deterministic SHA-256 hash
 * of the canonical form. Two calls with the same recipients (in any order,
 * with any casing or whitespace) will produce the same hash.
 */
export function normalizeRecipients(
  raw: Array<{ email: string; name?: string | null }>,
): RecipientNormalizationResult {
  if (!Array.isArray(raw)) {
    throw new Error('Recipients must be an array');
  }

  // Step 1: Normalize each recipient
  const normalized: Map<string, NormalizedRecipient> = new Map();

  for (const r of raw) {
    if (!r.email || typeof r.email !== 'string') {
      throw new Error('Each recipient must have an email string');
    }

    const email = r.email.trim().toLowerCase();

    if (!validateEmail(email)) {
      throw new Error(`Invalid email address: ${email}`);
    }

    // Skip if we've already seen this email
    if (normalized.has(email)) {
      continue;
    }

    // Normalize name: blank/whitespace-only becomes null
    let name: string | null = null;
    if (r.name && typeof r.name === 'string') {
      const trimmedName = r.name.trim();
      if (trimmedName) {
        name = trimmedName;
      }
    }

    normalized.set(email, { email, name });
  }

  // Step 2: Convert to array and sort deterministically
  const recipients: NormalizedRecipient[] = Array.from(normalized.values()).sort((a, b) => {
    // Sort by email first
    const emailCmp = a.email.localeCompare(b.email);
    if (emailCmp !== 0) return emailCmp;

    // Then by name, with nulls first
    if (a.name === null && b.name === null) return 0;
    if (a.name === null) return -1;
    if (b.name === null) return 1;
    return a.name.localeCompare(b.name);
  });

  // Step 3: Compute deterministic hash
  const evidence = {
    recipients: recipients.map((r) => ({
      email: r.email,
      name: r.name,
    })),
  };

  const evidenceJson = JSON.stringify(evidence, null, 2);
  const recipientHash = createHash('sha256').update(evidenceJson, 'utf-8').digest('hex');

  return {
    recipients,
    recipientHash,
  };
}
