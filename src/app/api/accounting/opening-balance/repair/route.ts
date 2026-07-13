import { NextRequest } from 'next/server';
import { invokeExpressJsonHandler } from '@/app/api/_express-adapter';
import { postOpeningBalanceRepair } from '../../../../../../server/routes/openingBalanceRepair';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  let body: unknown = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  return invokeExpressJsonHandler(request, postOpeningBalanceRepair, { body });
}
