import { NextRequest } from 'next/server';
import { invokeExpressJsonHandler } from '@/app/api/_express-adapter';
import { listImportBatches } from '../../../../server/routes/importBatches';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  return invokeExpressJsonHandler(request, listImportBatches);
}
