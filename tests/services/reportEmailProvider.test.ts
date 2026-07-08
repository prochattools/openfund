import { describe, expect, it } from 'vitest';
import { NoSendProvider } from '../../server/services/reportEmailProvider';
import type { ReportEmailPayload, ReportEmailProvider, ReportEmailResult } from '../../server/services/reportEmailProvider';

describe('reportEmailProvider', () => {
  const payload: ReportEmailPayload = {
    from: 'Yeshua Academy Finance <info@yeshua.academy>',
    to: ['test@example.test'],
    subject: 'Testbericht',
    html: '<p>Verificatie</p>',
  };

  describe('NoSendProvider', () => {
    it('returns success without calling any external provider', async () => {
      const provider = new NoSendProvider();
      const result = await provider.send(payload);

      expect(result.success).toBe(true);
      expect(result.providerMessageId).toBe('no-send-sim');
      expect(result.errorMessage).toBeNull();
    });

    it('records all calls for test inspection', async () => {
      const provider = new NoSendProvider();
      await provider.send(payload);
      await provider.send({ ...payload, to: ['other@example.test'] });

      expect(provider.calls).toHaveLength(2);
      expect(provider.calls[0].to).toEqual(['test@example.test']);
      expect(provider.calls[1].to).toEqual(['other@example.test']);
    });

    it('does not include any API key or secret in results', async () => {
      const provider = new NoSendProvider();
      const result = await provider.send(payload);
      const serialized = JSON.stringify(result);

      expect(serialized).not.toContain('re_');
      expect(serialized).not.toContain('RESEND');
      expect(serialized).not.toContain('API_KEY');
    });
  });

  describe('ReportEmailProvider interface', () => {
    it('type contract enforces send method returning ReportEmailResult', async () => {
      const mockProvider: ReportEmailProvider = {
        send: async (_payload: ReportEmailPayload): Promise<ReportEmailResult> => ({
          success: false,
          providerMessageId: null,
          errorMessage: 'Test fout',
        }),
      };

      const result = await mockProvider.send(payload);
      expect(result.success).toBe(false);
      expect(result.errorMessage).toBe('Test fout');
    });

    it('provider failure returns sanitized error without secrets', async () => {
      const failProvider: ReportEmailProvider = {
        send: async (): Promise<ReportEmailResult> => ({
          success: false,
          providerMessageId: null,
          errorMessage: 'Provider call mislukt (details geredigeerd).',
        }),
      };

      const result = await failProvider.send(payload);
      expect(result.errorMessage).not.toContain('re_');
      expect(result.errorMessage).not.toContain('API_KEY');
      expect(result.errorMessage).not.toContain('postgresql://');
    });
  });

  describe('ResendReportEmailProvider', () => {
    it('refuses to instantiate without RESEND_API_KEY', async () => {
      const originalKey = process.env.RESEND_API_KEY;
      delete process.env.RESEND_API_KEY;

      try {
        const { ResendReportEmailProvider } = await import('../../server/services/reportEmailProvider');
        expect(() => new ResendReportEmailProvider()).toThrow('RESEND_API_KEY');
      } finally {
        if (originalKey) process.env.RESEND_API_KEY = originalKey;
      }
    });
  });
});
