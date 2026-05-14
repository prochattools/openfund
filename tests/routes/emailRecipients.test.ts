import { describe, expect, it } from 'vitest';
import { isEmailRecipientAddress } from '../../server/routes/emailRecipients';

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
});
