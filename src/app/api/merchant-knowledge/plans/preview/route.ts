import { NextRequest } from 'next/server';
import { invokeExpressJsonHandler } from '@/app/api/_express-adapter';
import { previewMerchantKnowledgePlanRoute } from '../../../../../../server/routes/merchantKnowledge';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  return invokeExpressJsonHandler(request, previewMerchantKnowledgePlanRoute);
}
