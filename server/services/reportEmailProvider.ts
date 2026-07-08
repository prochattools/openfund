import { Resend } from 'resend';

export type ReportEmailPayload = {
  from: string;
  to: string[];
  subject: string;
  html: string;
};

export type ReportEmailResult = {
  success: boolean;
  providerMessageId: string | null;
  errorMessage: string | null;
};

export interface ReportEmailProvider {
  send(payload: ReportEmailPayload): Promise<ReportEmailResult>;
}

export class NoSendProvider implements ReportEmailProvider {
  public calls: ReportEmailPayload[] = [];

  async send(payload: ReportEmailPayload): Promise<ReportEmailResult> {
    this.calls.push(payload);
    return { success: true, providerMessageId: 'no-send-sim', errorMessage: null };
  }
}

export class ResendReportEmailProvider implements ReportEmailProvider {
  private client: Resend;

  constructor() {
    const resendRuntimeValue = process.env.RESEND_API_KEY;
    if (!resendRuntimeValue) {
      throw new Error('RESEND_API_KEY is niet beschikbaar in de runtime-omgeving.');
    }
    this.client = new Resend(resendRuntimeValue);
  }

  async send(payload: ReportEmailPayload): Promise<ReportEmailResult> {
    try {
      const { data, error } = await this.client.emails.send({
        from: payload.from,
        to: payload.to,
        subject: payload.subject,
        html: payload.html,
      });

      if (error) {
        return {
          success: false,
          providerMessageId: null,
          errorMessage: sanitizeProviderError(error),
        };
      }

      return {
        success: true,
        providerMessageId: data?.id ?? null,
        errorMessage: null,
      };
    } catch (err: unknown) {
      return {
        success: false,
        providerMessageId: null,
        errorMessage: sanitizeProviderError(err),
      };
    }
  }
}

function sanitizeProviderError(err: unknown): string {
  if (err && typeof err === 'object' && 'message' in err) {
    const msg = String((err as { message: unknown }).message);
    return msg.replace(/re_[A-Za-z0-9_]+/g, '[REDACTED]').slice(0, 200);
  }
  return 'Provider call mislukt (details geredigeerd).';
}
