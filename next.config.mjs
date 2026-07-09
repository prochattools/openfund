const internalApiOrigin = (process.env.INTERNAL_API_ORIGIN ?? 'http://127.0.0.1:4000').replace(/\/+$/, '');
const apiProxyEnabled = process.env.ENABLE_API_PROXY === 'true';

/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    if (!apiProxyEnabled) {
      return [];
    }

    return {
      fallback: [
        {
          source: '/api/:path*',
          destination: `${internalApiOrigin}/api/:path*`,
        },
        {
          source: '/healthz',
          destination: `${internalApiOrigin}/healthz`,
        },
      ],
    };
  },
};

export default nextConfig;
