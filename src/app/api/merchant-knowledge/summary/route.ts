import { NextRequest } from 'next/server';
import { invokeExpressJsonHandler } from '@/app/api/_express-adapter';
import { getMerchantKnowledgeSummaryRoute } from '../../../../../server/routes/merchantKnowledge';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  return invokeExpressJsonHandler(request, getMerchantKnowledgeSummaryRoute);
}
