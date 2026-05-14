/** @type {import('next').NextConfig} */
const INTERNAL_API_ORIGIN = process.env.INTERNAL_API_ORIGIN ?? 'http://127.0.0.1:4000';

const nextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  swcMinify: true,

  typescript: {
    ignoreBuildErrors: process.env.DISABLE_TS_CHECK === '1',
  },
  eslint: {
    ignoreDuringBuilds: true,
  },

  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'img.clerk.com' },
    ],
  },

  async rewrites() {
    const apiOrigin = INTERNAL_API_ORIGIN;
    return [
      { source: '/api/ledger', destination: `${apiOrigin}/api/ledger` },
      { source: '/api/review', destination: `${apiOrigin}/api/review` },
      { source: '/api/upload', destination: `${apiOrigin}/api/upload` },
      {
        source: '/api/transactions/:id/category',
        destination: `${apiOrigin}/api/transactions/:id/category`,
      },
      { source: '/api/accounts', destination: `${apiOrigin}/api/accounts` },
      {
        source: '/api/accounts/:accountId/opening-balance',
        destination: `${apiOrigin}/api/accounts/:accountId/opening-balance`,
      },
      {
        source: '/api/opening-balances/:balanceId/lock',
        destination: `${apiOrigin}/api/opening-balances/:balanceId/lock`,
      },
      { source: '/api/reconciliation', destination: `${apiOrigin}/api/reconciliation` },
      { source: '/api/reports/summary', destination: `${apiOrigin}/api/reports/summary` },
      { source: '/api/audit-log', destination: `${apiOrigin}/api/audit-log` },
      { source: '/api/import-batches', destination: `${apiOrigin}/api/import-batches` },
      { source: '/api/import-batches/:id/download', destination: `${apiOrigin}/api/import-batches/:id/download` },
      { source: '/api/email-recipients', destination: `${apiOrigin}/api/email-recipients` },
      { source: '/api/email-recipients/:id', destination: `${apiOrigin}/api/email-recipients/:id` },
      {
        source: '/api/ledger/:ledgerId/lock',
        destination: `${apiOrigin}/api/ledger/:ledgerId/lock`,
      },
      {
        source: '/api/ledger/:ledgerId/unlock',
        destination: `${apiOrigin}/api/ledger/:ledgerId/unlock`,
      },
      { source: '/api/rules', destination: `${apiOrigin}/api/rules` },
      { source: '/api/rules/:id', destination: `${apiOrigin}/api/rules/:id` },
    ];
  },
};

module.exports = nextConfig;
