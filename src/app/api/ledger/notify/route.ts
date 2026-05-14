import { NextResponse } from 'next/server';
import { resendService } from '@/libs/resend';
import config from '@/config';
import type { ExportEmailContext } from '@/helpers/export-utils';

type AttachmentPayload = {
  filename: string;
  mimeType?: string;
  content: string;
};

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const recipients = Array.isArray(body.recipients) ? body.recipients : [];
    const attachment = body.attachment as AttachmentPayload | undefined;
    const rawHtml = typeof body.html === 'string' ? body.html : '';
    const context = body.context as ExportEmailContext | undefined;

    if (!recipients.length) {
      return NextResponse.json({ error: 'Vul minimaal één ontvanger in.' }, { status: 400 });
    }

    const emailHtml = buildEmailHtml(rawHtml, context);
    const subject = buildSubject(context, attachment?.filename);

    await resendService.sendEmail(
      {
        from: config.resend.fromAdmin,
        to: recipients,
        subject,
        html: emailHtml,
        ...(attachment?.filename && attachment.content
          ? {
              attachments: [
                {
                  filename: attachment.filename,
                  content: attachment.content,
                  contentType: attachment.mimeType ?? 'application/octet-stream',
                },
              ],
            }
          : {}),
      },
      'monthly finance summary notification',
    );

    return NextResponse.json({ ok: true, message: 'Financiële samenvatting verzonden.' });
  } catch (error) {
    console.error('Notify export failed', error);
    return NextResponse.json({ error: 'De financiële samenvatting kon niet worden verzonden.' }, { status: 500 });
  }
}

const buildSubject = (context?: ExportEmailContext, filename?: string): string => {
  if (context?.view === 'monthly') {
    return `Financieel maandoverzicht ${context.periodLabel}`;
  }
  if (context?.view === 'cashflow') {
    return `Financiële geldstroom ${context.periodLabel}`;
  }
  if (context?.view === 'dashboard') {
    return `Financiële samenvatting ${context.periodLabel ?? ''}`.trim();
  }
  if (filename) {
    return `Financiële export: ${filename}`;
  }
  return 'Financiële samenvatting Yeshua Academy';
};

const buildEmailHtml = (summaryHtml: string, context?: ExportEmailContext): string => {
  const intro = buildIntroHtml(context);
  const body = summaryHtml || '<p>De financiële samenvatting staat klaar in Yeshua Academy Finance.</p>';

  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size:14px; line-height:1.6; color:#251f1a; background:#f5f1ea; padding:24px;">
      <div style="max-width:720px; margin:0 auto; background:#fbf8f2; border:1px solid #ded5c8; border-radius:24px; padding:24px;">
        ${intro}
        <div style="margin:24px 0; padding:16px; border:1px solid #ded5c8; border-radius:16px; background:#ffffff;">
          ${body}
        </div>
        ${buildClosingHtml()}
      </div>
    </div>
  `;
};

const buildIntroHtml = (context?: ExportEmailContext): string => {
  if (!context) {
    return '<p>Beste lezer,</p><p>Hierbij ontvang je de financiële samenvatting van Yeshua Academy.</p>';
  }

  switch (context.view) {
    case 'monthly':
      return `<p>Beste lezer,</p><p>Hierbij ontvang je het financiële maandoverzicht voor ${context.accountLabel} over ${context.periodLabel}.</p>`;
    case 'transactions':
      return `<p>Beste lezer,</p><p>Hierbij ontvang je het transactieoverzicht voor ${context.description}.</p>`;
    case 'cashflow':
      return `<p>Beste lezer,</p><p>Hierbij ontvang je het overzicht van de geldstroom over ${context.periodLabel}.</p>`;
    case 'dashboard':
      return `<p>Beste lezer,</p><p>Hierbij ontvang je de financiële samenvatting${context.periodLabel ? ` over ${context.periodLabel}` : ''}.</p>`;
    default:
      return '<p>Beste lezer,</p><p>Hierbij ontvang je de financiële samenvatting van Yeshua Academy.</p>';
  }
};

const buildClosingHtml = () => `
  <p style="margin-top:24px;">Hartelijke groet,<br/>Yeshua Academy Finance</p>
  <p style="font-size:12px; color:#7d6d5a;">Deze e-mail is verstuurd vanuit de interne financiële administratie.</p>
`;
