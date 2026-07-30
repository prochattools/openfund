import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const config = readFileSync('next.config.mjs', 'utf8');
const deploymentInfo = readFileSync('src/app/api/deployment-info/route.ts', 'utf8');

describe('production API proxy configuration', () => {
  it('uses one authoritative Next.js configuration', () => {
    expect(config).toContain("output: 'standalone'");
    expect(config).toContain("process.env.ENABLE_API_PROXY !== 'false'");
    expect(config).toContain("process.env.INTERNAL_API_ORIGIN ?? 'http://127.0.0.1:4000'");
  });

  it('proxies unmatched API and health requests to the internal Express server', () => {
    expect(config).toContain("source: '/api/:path*'");
    expect(config).toContain('destination: `${internalApiOrigin}/api/:path*`');
    expect(config).toContain("source: '/healthz'");
    expect(config).toContain('destination: `${internalApiOrigin}/healthz`');
    expect(config).toContain('fallback:');
  });

  it('keeps native Next API routes available before fallback rewrites', () => {
    expect(deploymentInfo).toContain("export async function GET()");
    expect(deploymentInfo).toContain("apiProxyEnabled: process.env.ENABLE_API_PROXY !== 'false'");
    expect(deploymentInfo).toContain('internalApiOriginConfigured');
  });
});
