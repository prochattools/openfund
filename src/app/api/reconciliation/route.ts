import { NextRequest } from 'next/server';
import { invokeExpressJsonHandler } from '@/app/api/_express-adapter';
import { getReconciliation } from '../../../../server/routes/reconciliation';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  return invokeExpressJsonHandler(request, getReconciliation);
}
