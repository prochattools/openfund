import { NextRequest } from 'next/server';
import { invokeExpressJsonHandler } from '@/app/api/_express-adapter';
import { updateTransactionCategory } from '../../../../../../server/routes/review';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function PATCH(
  request: NextRequest,
  context: { params: { id: string } },
) {
  let body: unknown = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  return invokeExpressJsonHandler(request, updateTransactionCategory, {
    params: { id: context.params.id },
    body,
  });
}
