import config from '@/config';
import { Resend } from 'resend';

type EmailPayload = Parameters<Resend['emails']['send']>[0];

class ResendService {
  private client: Resend | null = null;

  private get resend() {
    if (this.client) {
      return this.client;
    }

    const resendToken = process.env.RESEND_API_KEY;
    if (!resendToken) {
      return null;
    }

    this.client = new Resend(resendToken);
    return this.client;
  }

  private ensureResendAvailable(action: string) {
    if (!this.resend && process.env.NODE_ENV !== 'production') {
      console.warn(`Resend API key ontbreekt – ${action} wordt lokaal overgeslagen.`);
    }
  }

  public async sendEmail(payload: EmailPayload, action: string) {
    if (!this.resend) {
      this.ensureResendAvailable(action);
      return { id: `resend-mock-${Date.now()}` };
    }

    const { data, error } = await this.resend.emails.send({
      replyTo: config.resend.forwardRepliesTo,
      ...payload,
    });

    if (error) {
      throw error;
    }

    return data;
  }
}

export const resendService = new ResendService();
