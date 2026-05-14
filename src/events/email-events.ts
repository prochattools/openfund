import { EventEmitter } from 'events';
import config from '@/config';
import { resendService } from '../libs/resend';

const emailEvents = new EventEmitter();

emailEvents.on('sendMonthlyFinanceSummary', async (payload: { to: string[]; subject?: string; html: string }) => {
  await resendService.sendEmail(
    {
      from: config.resend.fromAdmin,
      to: payload.to,
      subject: payload.subject ?? config.resend.subjects?.monthlySummary ?? 'Financieel maandoverzicht Yeshua Academy',
      html: payload.html,
    },
    'monthly finance summary event',
  );
});

export default emailEvents;
