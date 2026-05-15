import { describe, expect, it } from 'vitest';
import { isEmailRecipientAddress, serializeEmailRecipient } from '../../server/routes/emailRecipients';

describe('email recipient routes', () => {
  it('accepts normal email recipient addresses', () => {
    expect(isEmailRecipientAddress('admin@example.org')).toBe(true);
    expect(isEmailRecipientAddress(' finance+monthly@yeshua.academy ')).toBe(true);
  });

  it('rejects missing or malformed email recipient addresses', () => {
    expect(isEmailRecipientAddress('')).toBe(false);
    expect(isEmailRecipientAddress('not-an-email')).toBe(false);
    expect(isEmailRecipientAddress('missing-domain@')).toBe(false);
    expect(isEmailRecipientAddress('@missing-local.test')).toBe(false);
    expect(isEmailRecipientAddress('space inside@example.org')).toBe(false);
  });

  it('serializes recipient timestamps for API responses', () => {
    expect(serializeEmailRecipient({
      id: 'recipient-1',
      email: 'finance@example.test',
      name: 'Finance team',
      isActive: true,
      createdAt: new Date('2026-05-15T10:00:00.000Z'),
      updatedAt: new Date('2026-05-16T11:30:00.000Z'),
    })).toEqual({
      id: 'recipient-1',
      email: 'finance@example.test',
      name: 'Finance team',
      isActive: true,
      createdAt: '2026-05-15T10:00:00.000Z',
      updatedAt: '2026-05-16T11:30:00.000Z',
    });
  });
});
