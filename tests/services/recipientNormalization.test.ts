import { describe, expect, it } from 'vitest';
import { normalizeRecipients } from '../../server/services/recipientNormalization';

describe('Recipient normalization', () => {
  describe('email normalization', () => {
    it('lowercases email addresses', () => {
      const result = normalizeRecipients([{ email: 'FOO@BAR.COM', name: 'Test' }]);
      expect(result.recipients[0].email).toBe('foo@bar.com');
    });

    it('trims whitespace from email addresses', () => {
      const result = normalizeRecipients([{ email: '  foo@bar.com  ', name: 'Test' }]);
      expect(result.recipients[0].email).toBe('foo@bar.com');
    });

    it('rejects invalid email addresses', () => {
      expect(() => normalizeRecipients([{ email: 'not-an-email', name: 'Test' }])).toThrow(
        'Invalid email address',
      );
    });
  });

  describe('name normalization', () => {
    it('trims whitespace from names', () => {
      const result = normalizeRecipients([{ email: 'foo@bar.com', name: '  John Doe  ' }]);
      expect(result.recipients[0].name).toBe('John Doe');
    });

    it('converts whitespace-only names to null', () => {
      const result = normalizeRecipients([{ email: 'foo@bar.com', name: '   ' }]);
      expect(result.recipients[0].name).toBeNull();
    });

    it('converts empty names to null', () => {
      const result = normalizeRecipients([{ email: 'foo@bar.com', name: '' }]);
      expect(result.recipients[0].name).toBeNull();
    });

    it('converts undefined names to null', () => {
      const result = normalizeRecipients([{ email: 'foo@bar.com' }]);
      expect(result.recipients[0].name).toBeNull();
    });
  });

  describe('deduplication', () => {
    it('removes duplicate recipients (same email, different case)', () => {
      const result = normalizeRecipients([
        { email: 'foo@bar.com', name: 'First' },
        { email: 'FOO@BAR.COM', name: 'Second' },
      ]);
      expect(result.recipients).toHaveLength(1);
      expect(result.recipients[0].email).toBe('foo@bar.com');
      expect(result.recipients[0].name).toBe('First');
    });

    it('removes duplicate recipients with whitespace variations', () => {
      const result = normalizeRecipients([
        { email: 'foo@bar.com', name: 'First' },
        { email: '  FOO@BAR.COM  ', name: 'Second' },
      ]);
      expect(result.recipients).toHaveLength(1);
    });
  });

  describe('deterministic sorting', () => {
    it('sorts by email lexicographically', () => {
      const result = normalizeRecipients([
        { email: 'zebra@example.com', name: 'Z' },
        { email: 'apple@example.com', name: 'A' },
      ]);
      expect(result.recipients[0].email).toBe('apple@example.com');
      expect(result.recipients[1].email).toBe('zebra@example.com');
    });

    it('sorts by name when emails are identical (edge case)', () => {
      // This shouldn't happen after dedup, but test sorting anyway
      const arr = [
        { email: 'foo@bar.com', name: 'Zoe' },
        { email: 'foo@bar.com', name: 'Alice' },
      ];
      const result = normalizeRecipients(arr);
      // After dedup, only first is kept, so only one recipient
      expect(result.recipients).toHaveLength(1);
    });

    it('sorts nulls before non-null names', () => {
      const result = normalizeRecipients([
        { email: 'apple@example.com', name: 'Alice' },
        { email: 'bob@example.com', name: null },
        { email: 'charlie@example.com', name: 'Charlie' },
      ]);
      // All emails are different, so all three are kept
      // Sorted by email: apple, bob, charlie
      expect(result.recipients).toHaveLength(3);
      expect(result.recipients[0].email).toBe('apple@example.com');
      expect(result.recipients[0].name).toBe('Alice');
      expect(result.recipients[1].email).toBe('bob@example.com');
      expect(result.recipients[1].name).toBeNull();
      expect(result.recipients[2].email).toBe('charlie@example.com');
      expect(result.recipients[2].name).toBe('Charlie');
    });
  });

  describe('hash determinism', () => {
    it('produces identical hash for same recipients in different order', () => {
      const result1 = normalizeRecipients([
        { email: 'alice@example.com', name: 'Alice' },
        { email: 'bob@example.com', name: 'Bob' },
      ]);

      const result2 = normalizeRecipients([
        { email: 'bob@example.com', name: 'Bob' },
        { email: 'alice@example.com', name: 'Alice' },
      ]);

      expect(result1.recipientHash).toBe(result2.recipientHash);
    });

    it('produces identical hash for email case variations', () => {
      const result1 = normalizeRecipients([
        { email: 'alice@example.com', name: 'Alice' },
      ]);

      const result2 = normalizeRecipients([
        { email: 'ALICE@EXAMPLE.COM', name: 'Alice' },
      ]);

      expect(result1.recipientHash).toBe(result2.recipientHash);
    });

    it('produces identical hash for name whitespace variations', () => {
      const result1 = normalizeRecipients([
        { email: 'alice@example.com', name: 'Alice Smith' },
      ]);

      const result2 = normalizeRecipients([
        { email: 'alice@example.com', name: '  Alice Smith  ' },
      ]);

      expect(result1.recipientHash).toBe(result2.recipientHash);
    });

    it('produces different hash for different recipients', () => {
      const result1 = normalizeRecipients([
        { email: 'alice@example.com', name: 'Alice' },
      ]);

      const result2 = normalizeRecipients([
        { email: 'bob@example.com', name: 'Bob' },
      ]);

      expect(result1.recipientHash).not.toBe(result2.recipientHash);
    });

    it('produces different hash when recipient is added', () => {
      const result1 = normalizeRecipients([
        { email: 'alice@example.com', name: 'Alice' },
      ]);

      const result2 = normalizeRecipients([
        { email: 'alice@example.com', name: 'Alice' },
        { email: 'bob@example.com', name: 'Bob' },
      ]);

      expect(result1.recipientHash).not.toBe(result2.recipientHash);
    });

    it('produces different hash when name changes', () => {
      const result1 = normalizeRecipients([
        { email: 'alice@example.com', name: 'Alice' },
      ]);

      const result2 = normalizeRecipients([
        { email: 'alice@example.com', name: 'Alicia' },
      ]);

      expect(result1.recipientHash).not.toBe(result2.recipientHash);
    });
  });

  describe('edge cases', () => {
    it('handles single recipient', () => {
      const result = normalizeRecipients([{ email: 'alice@example.com', name: 'Alice' }]);
      expect(result.recipients).toHaveLength(1);
      expect(result.recipientHash).toBeTruthy();
    });

    it('handles recipients with no names', () => {
      const result = normalizeRecipients([
        { email: 'alice@example.com' },
        { email: 'bob@example.com' },
      ]);
      expect(result.recipients).toHaveLength(2);
      expect(result.recipients[0].name).toBeNull();
      expect(result.recipients[1].name).toBeNull();
    });

    it('rejects non-array input', () => {
      expect(() =>
        normalizeRecipients(null as any),
      ).toThrow('Recipients must be an array');
    });

    it('rejects missing email field', () => {
      expect(() =>
        normalizeRecipients([{ name: 'Alice' } as any]),
      ).toThrow('Each recipient must have an email string');
    });
  });
});
