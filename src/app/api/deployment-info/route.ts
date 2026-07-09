import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    buildSha: process.env.BUILD_SHA ?? process.env.GITHUB_SHA ?? null,
    buildRef: process.env.BUILD_REF ?? null,
    nodeEnv: process.env.NODE_ENV ?? null,
    hasDatabaseUrl: Boolean(process.env.DATABASE_URL),
    defaultUserId: process.env.DEFAULT_USER_ID ?? null,
    nextPublicApiUserId: process.env.NEXT_PUBLIC_API_USER_ID ?? null,
    apiProxyEnabled: process.env.ENABLE_API_PROXY === 'true',
    directRoutes: [
      '/api/ledger',
      '/api/reports/summary',
      '/api/import-batches',
      '/api/audit-log',
      '/api/email-recipients',
      '/api/accounts',
      '/api/rules',
      '/api/review',
      '/api/reconciliation',
    ],
  });
}
