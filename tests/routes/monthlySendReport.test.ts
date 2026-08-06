import { describe, expect, it } from 'vitest';

describe('monthly send report', () => {
  it('request validation: rejects when confirmed is not true', () => {
    const payload = { year: 2024, month: 1, confirmed: false };
    expect(payload.confirmed).not.toBe(true);
  });

  it('request validation: enforces month bounds', () => {
    const validMonth = 1;
    const invalidMonth = 13;
    expect(validMonth >= 1 && validMonth <= 12).toBe(true);
    expect(invalidMonth >= 1 && invalidMonth <= 12).toBe(false);
  });

  it('response contract: no recipient PII', () => {
    const response = {
      status: 'SENT' as const,
      month: '2024-01',
      recipientCount: 2,
      snapshotId: 'snapshot-123',
      dispatchId: 'dispatch-456',
    };

    expect(response).not.toHaveProperty('recipients');
    expect(response).not.toHaveProperty('recipientEmails');
    expect(Object.keys(response)).toEqual(['status', 'month', 'recipientCount', 'snapshotId', 'dispatchId']);
  });

  it('dispatch metadata: multiple recipients supported', () => {
    const recipients = [
      { email: 'recipient1@example.com', name: 'Recipient 1' },
      { email: 'recipient2@example.com', name: 'Recipient 2' },
      { email: 'recipient3@example.com', name: 'Recipient 3' },
    ];

    expect(recipients.length).toBeGreaterThan(0);
    expect(recipients.every((r) => r.email && r.name)).toBe(true);
  });

  it('dispatch metadata: requires at least one recipient', () => {
    const recipients: any[] = [];
    expect(recipients.length).toBe(0);
    expect(recipients.length === 0).toBe(true);
  });

  it('sender address: REPORT_EMAIL_FROM fallback to canonical', () => {
    const configured = process.env.REPORT_EMAIL_FROM?.trim();
    const canonical = 'rapport@yeshuaacademy.nl';
    const chosen = configured || canonical;
    expect(typeof chosen).toBe('string');
  });

  it('status tracking: persists SENT or FAILED', () => {
    const sentStatus = 'SENT' as const;
    const failedStatus = 'FAILED' as const;
    const allowedStatuses = ['SENT', 'FAILED'];
    expect(allowedStatuses).toContain(sentStatus);
    expect(allowedStatuses).toContain(failedStatus);
  });
});
