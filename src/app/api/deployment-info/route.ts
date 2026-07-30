import { NextResponse } from 'next/server';
import {
  AUTH_PROVIDER,
  isValidPublishableKey,
  isValidSecretKey,
  isValidWorkspaceId,
} from '@/utils/auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    buildSha: process.env.BUILD_SHA ?? process.env.GITHUB_SHA ?? null,
    buildRef: process.env.BUILD_REF ?? null,
    nodeEnv: process.env.NODE_ENV ?? null,
    hasDatabaseUrl: Boolean(process.env.DATABASE_URL),
    authProvider: AUTH_PROVIDER,
    productionAuthBypassEnabled: process.env.ALLOW_PRODUCTION_AUTH_BYPASS === 'true',
    productionAuthBypassConfigured: Boolean(process.env.DEFAULT_USER_ID?.trim() && process.env.DEFAULT_WORKSPACE_ID?.trim()),
    clerkPublishableKeyConfigured: isValidPublishableKey(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY),
    clerkSecretConfigured: isValidSecretKey(process.env.CLERK_SECRET_KEY),
    workspaceConfigured: isValidWorkspaceId(process.env.DEFAULT_WORKSPACE_ID),
    apiProxyEnabled: process.env.ENABLE_API_PROXY !== 'false',
    internalApiOriginConfigured: Boolean(process.env.INTERNAL_API_ORIGIN?.trim()),
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
