import { NextResponse } from 'next/server';
import { resendService } from '@/libs/resend';
import prisma from '@/libs/prisma';
import config from '@/config';
import type { ExportEmailContext } from '@/helpers/export-utils';
import { buildEmailHtml, buildSubject, normalizeEmailRecipients } from './emailHelpers';

type AttachmentPayload = {
  filename: string;
  mimeType?: string;
  content: string;
};

const isAdminRequest = (request: Request) => {
  const role = request.headers.get('x-user-role') ?? process.env.DEFAULT_USER_ROLE ?? 'admin';
  return role.toLowerCase() === 'admin';
};

export async function POST(request: Request) {
  if (!isAdminRequest(request)) {
    return NextResponse.json({ error: 'Alleen beheerders mogen financiële samenvattingen verzenden.' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const explicitRecipients = Array.isArray(body.recipients) ? normalizeEmailRecipients(body.recipients) : [];
    const userId = request.headers.get('x-user-id') ?? process.env.DEFAULT_USER_ID ?? 'demo-user';
    const storedRecipients = explicitRecipients.length
      ? []
      : await prisma.emailRecipient.findMany({
          where: { userId, isActive: true },
          select: { email: true },
          orderBy: { email: 'asc' },
        });
    const recipients = explicitRecipients.length
      ? explicitRecipients
      : normalizeEmailRecipients(storedRecipients.map((recipient) => recipient.email));
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
      'financiële maandsamenvatting verzenden',
    );

    return NextResponse.json({ ok: true, message: 'Financiële samenvatting verzonden.' });
  } catch (error) {
    console.error('Financiële samenvatting kon niet worden verzonden', error);
    return NextResponse.json({ error: 'De financiële samenvatting kon niet worden verzonden.' }, { status: 500 });
  }
}
