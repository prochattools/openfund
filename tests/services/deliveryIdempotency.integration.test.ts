import { describe, expect, it, vi } from 'vitest';
import { normalizeRecipients } from '../../server/services/recipientNormalization';
import { computeDeliveryKey } from '../../server/services/deliveryKeyService';

describe('Delivery key idempotency', () => {
  describe('delivery key computation', () => {
    it('produces identical key for same month, same periods, same recipients', () => {
      const recipients = [
        { email: 'alice@example.com', name: 'Alice' },
        { email: 'bob@example.com', name: 'Bob' },
      ];

      const { recipientHash: recipientHash1 } = normalizeRecipients(recipients);
      const { recipientHash: recipientHash2 } = normalizeRecipients(recipients);

      expect(recipientHash1).toBe(recipientHash2);

      const key1 = computeDeliveryKey({
        workspaceId: 'workspace-1',
        kind: 'MONTHLY',
        year: 2024,
        month: 1,
        periodCloses: [
          { id: 'close-1', version: 1 },
          { id: 'close-2', version: 1 },
        ],
        recipientHash: recipientHash1,
      });

      const key2 = computeDeliveryKey({
        workspaceId: 'workspace-1',
        kind: 'MONTHLY',
        year: 2024,
        month: 1,
        periodCloses: [
          { id: 'close-1', version: 1 },
          { id: 'close-2', version: 1 },
        ],
        recipientHash: recipientHash2,
      });

      expect(key1).toBe(key2);
    });

    it('produces identical key when period closes are in different order', () => {
      const { recipientHash } = normalizeRecipients([
        { email: 'alice@example.com', name: 'Alice' },
      ]);

      const key1 = computeDeliveryKey({
        workspaceId: 'workspace-1',
        kind: 'MONTHLY',
        year: 2024,
        month: 1,
        periodCloses: [
          { id: 'close-2', version: 1 },
          { id: 'close-1', version: 1 },
        ],
        recipientHash,
      });

      const key2 = computeDeliveryKey({
        workspaceId: 'workspace-1',
        kind: 'MONTHLY',
        year: 2024,
        month: 1,
        periodCloses: [
          { id: 'close-1', version: 1 },
          { id: 'close-2', version: 1 },
        ],
        recipientHash,
      });

      expect(key1).toBe(key2);
    });

    it('produces identical key when recipients are in different order', () => {
      const recipients1 = [
        { email: 'alice@example.com', name: 'Alice' },
        { email: 'bob@example.com', name: 'Bob' },
      ];

      const recipients2 = [
        { email: 'bob@example.com', name: 'Bob' },
        { email: 'alice@example.com', name: 'Alice' },
      ];

      const { recipientHash: hash1 } = normalizeRecipients(recipients1);
      const { recipientHash: hash2 } = normalizeRecipients(recipients2);

      expect(hash1).toBe(hash2);

      const closes = [{ id: 'close-1', version: 1 }];

      const key1 = computeDeliveryKey({
        workspaceId: 'workspace-1',
        kind: 'MONTHLY',
        year: 2024,
        month: 1,
        periodCloses: closes,
        recipientHash: hash1,
      });

      const key2 = computeDeliveryKey({
        workspaceId: 'workspace-1',
        kind: 'MONTHLY',
        year: 2024,
        month: 1,
        periodCloses: closes,
        recipientHash: hash2,
      });

      expect(key1).toBe(key2);
    });

    it('produces identical key with email casing variations', () => {
      const recipients1 = [{ email: 'alice@example.com', name: 'Alice' }];
      const recipients2 = [{ email: 'ALICE@EXAMPLE.COM', name: 'Alice' }];

      const { recipientHash: hash1 } = normalizeRecipients(recipients1);
      const { recipientHash: hash2 } = normalizeRecipients(recipients2);

      expect(hash1).toBe(hash2);
    });

    it('produces identical key with email whitespace variations', () => {
      const recipients1 = [{ email: 'alice@example.com', name: 'Alice' }];
      const recipients2 = [{ email: '  ALICE@EXAMPLE.COM  ', name: 'Alice' }];

      const { recipientHash: hash1 } = normalizeRecipients(recipients1);
      const { recipientHash: hash2 } = normalizeRecipients(recipients2);

      expect(hash1).toBe(hash2);
    });

    it('produces different key for different recipients', () => {
      const recipients1 = [{ email: 'alice@example.com', name: 'Alice' }];
      const recipients2 = [{ email: 'bob@example.com', name: 'Bob' }];

      const { recipientHash: hash1 } = normalizeRecipients(recipients1);
      const { recipientHash: hash2 } = normalizeRecipients(recipients2);

      const closes = [{ id: 'close-1', version: 1 }];

      const key1 = computeDeliveryKey({
        workspaceId: 'workspace-1',
        kind: 'MONTHLY',
        year: 2024,
        month: 1,
        periodCloses: closes,
        recipientHash: hash1,
      });

      const key2 = computeDeliveryKey({
        workspaceId: 'workspace-1',
        kind: 'MONTHLY',
        year: 2024,
        month: 1,
        periodCloses: closes,
        recipientHash: hash2,
      });

      expect(key1).not.toBe(key2);
    });

    it('produces different key when a recipient is added', () => {
      const recipients1 = [{ email: 'alice@example.com', name: 'Alice' }];
      const recipients2 = [
        { email: 'alice@example.com', name: 'Alice' },
        { email: 'bob@example.com', name: 'Bob' },
      ];

      const { recipientHash: hash1 } = normalizeRecipients(recipients1);
      const { recipientHash: hash2 } = normalizeRecipients(recipients2);

      const closes = [{ id: 'close-1', version: 1 }];

      const key1 = computeDeliveryKey({
        workspaceId: 'workspace-1',
        kind: 'MONTHLY',
        year: 2024,
        month: 1,
        periodCloses: closes,
        recipientHash: hash1,
      });

      const key2 = computeDeliveryKey({
        workspaceId: 'workspace-1',
        kind: 'MONTHLY',
        year: 2024,
        month: 1,
        periodCloses: closes,
        recipientHash: hash2,
      });

      expect(key1).not.toBe(key2);
    });

    it('produces different key when period version increments (e.g., after reopen)', () => {
      const { recipientHash } = normalizeRecipients([
        { email: 'alice@example.com', name: 'Alice' },
      ]);

      const key1 = computeDeliveryKey({
        workspaceId: 'workspace-1',
        kind: 'MONTHLY',
        year: 2024,
        month: 1,
        periodCloses: [{ id: 'close-1', version: 1 }],
        recipientHash,
      });

      const key2 = computeDeliveryKey({
        workspaceId: 'workspace-1',
        kind: 'MONTHLY',
        year: 2024,
        month: 1,
        periodCloses: [{ id: 'close-1', version: 2 }],
        recipientHash,
      });

      expect(key1).not.toBe(key2);
    });

    it('produces different key for different workspaces', () => {
      const { recipientHash } = normalizeRecipients([
        { email: 'alice@example.com', name: 'Alice' },
      ]);

      const closes = [{ id: 'close-1', version: 1 }];

      const key1 = computeDeliveryKey({
        workspaceId: 'workspace-1',
        kind: 'MONTHLY',
        year: 2024,
        month: 1,
        periodCloses: closes,
        recipientHash,
      });

      const key2 = computeDeliveryKey({
        workspaceId: 'workspace-2',
        kind: 'MONTHLY',
        year: 2024,
        month: 1,
        periodCloses: closes,
        recipientHash,
      });

      expect(key1).not.toBe(key2);
    });

    it('produces different key for different months', () => {
      const { recipientHash } = normalizeRecipients([
        { email: 'alice@example.com', name: 'Alice' },
      ]);

      const closes = [{ id: 'close-1', version: 1 }];

      const key1 = computeDeliveryKey({
        workspaceId: 'workspace-1',
        kind: 'MONTHLY',
        year: 2024,
        month: 1,
        periodCloses: closes,
        recipientHash,
      });

      const key2 = computeDeliveryKey({
        workspaceId: 'workspace-1',
        kind: 'MONTHLY',
        year: 2024,
        month: 2,
        periodCloses: closes,
        recipientHash,
      });

      expect(key1).not.toBe(key2);
    });

    it('produces consistent hash (deterministic, no randomness)', () => {
      const { recipientHash } = normalizeRecipients([
        { email: 'alice@example.com', name: 'Alice' },
      ]);

      const closes = [{ id: 'close-1', version: 1 }];

      const key1 = computeDeliveryKey({
        workspaceId: 'workspace-1',
        kind: 'MONTHLY',
        year: 2024,
        month: 1,
        periodCloses: closes,
        recipientHash,
      });

      // Call 100 times with identical input
      for (let i = 0; i < 100; i++) {
        const keyN = computeDeliveryKey({
          workspaceId: 'workspace-1',
          kind: 'MONTHLY',
          year: 2024,
          month: 1,
          periodCloses: closes,
          recipientHash,
        });

        expect(keyN).toBe(key1);
      }
    });
  });
});
