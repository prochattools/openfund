import { NextRequest } from 'next/server';
import { invokeExpressJsonHandler } from '@/app/api/_express-adapter';
import { listEmailRecipients, upsertEmailRecipient } from '../../../../server/routes/emailRecipients';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  return invokeExpressJsonHandler(request, listEmailRecipients);
}



export async function POST(request: NextRequest) {
  let body: unknown = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  return invokeExpressJsonHandler(request, upsertEmailRecipient, { body });
}
