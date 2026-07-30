const internalApiOrigin = (process.env.INTERNAL_API_ORIGIN ?? 'http://127.0.0.1:4000').replace(/\/+$/, '');
const apiProxyEnabled = process.env.ENABLE_API_PROXY !== 'false';

/** @type {import('next').NextConfig} */
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
    remotePatterns: [{ protocol: 'https', hostname: 'img.clerk.com' }],
  },
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

export { apiProxyEnabled, internalApiOrigin };
export default nextConfig;
