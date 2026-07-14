import { NextResponse } from 'next/server';
import { resolveRequestActor } from '@/../server/auth/requestContext';
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

export async function POST(request: Request) {
  const resolution = await resolveRequestActor(request.headers.get('cookie'));
  if (!resolution.actor) {
    const status = resolution.error === 'forbidden' ? 403 : resolution.error === 'misconfigured' ? 503 : 401;
    return NextResponse.json(
      {
        error:
          resolution.error === 'forbidden'
            ? 'Geen toegang tot deze financiële werkruimte.'
            : resolution.error === 'misconfigured'
              ? 'Authenticatie is tijdelijk niet beschikbaar.'
              : 'Authenticatie vereist.',
      },
      { status },
    );
  }

  if (resolution.actor.role !== 'admin') {
    return NextResponse.json({ error: 'Alleen beheerders mogen financiële samenvattingen verzenden.' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const explicitRecipients = Array.isArray(body.recipients) ? normalizeEmailRecipients(body.recipients) : [];
    const userId = resolution.actor.userId;
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
