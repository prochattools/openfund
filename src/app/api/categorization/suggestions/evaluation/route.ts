import { NextRequest } from 'next/server';
import { invokeExpressJsonHandler } from '@/app/api/_express-adapter';
import { getSuggestionEvaluation } from '../../../../../../server/routes/suggestionEvaluation';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  return invokeExpressJsonHandler(request, getSuggestionEvaluation);
}
