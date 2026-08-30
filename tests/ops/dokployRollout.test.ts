import { describe, expect, it, vi } from 'vitest';
import { runDokployRollout } from '../../scripts/dokploy-rollout.mjs';

const APP_ID = 'finance-app';
const API_KEY = 'test-key';
const TARGET_SHA = '9efd4d2c5ef64204b6788d16b701785b1654064d';
const TARGET_IMAGE = `ghcr.io/yeshuaacademy/finance:${TARGET_SHA}`;

const jsonResponse = (status: number, body: unknown) => ({
  ok: status >= 200 && status < 300,
  status,
  json: vi.fn(async () => body),
});

const createFetch = (handler: (url: string, init?: RequestInit) => unknown) =>
  vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const result = handler(String(input), init);
    return result as Response;
  });

describe('Dokploy rollout helper', () => {
  it('normalizes a pinned same-repository image, redeploys, and verifies exact SHA', async () => {
    const requests: Array<{ url: string; init?: RequestInit }> = [];
    const fetchImpl = createFetch((url, init) => {
      requests.push({ url, init });
      if (url.includes('/application.one')) {
        return jsonResponse(200, {
          sourceType: 'docker',
          dockerImage: 'ghcr.io/yeshuaacademy/finance@sha256:old-digest',
          username: 'registry-user',
          password: 'registry-password',
          registryUrl: 'ghcr.io',
        });
      }
      if (url.endsWith('/application.saveDockerProvider') || url.endsWith('/application.redeploy')) {
        return jsonResponse(200, {});
      }
      if (url.endsWith('/api/deployment-info')) {
        return jsonResponse(200, { buildSha: TARGET_SHA });
      }
      if (url.endsWith('/api/health')) {
        return jsonResponse(200, { status: 'ok' });
      }
      throw new Error(`Unexpected URL ${url}`);
    });

    const result = await runDokployRollout({
      apiKey: API_KEY,
      applicationId: APP_ID,
      expectedImage: TARGET_IMAGE,
      expectedBuildSha: TARGET_SHA,
      fetchImpl,
      sleepImpl: vi.fn(),
      attempts: 1,
      log: vi.fn(),
    });

    expect(result).toEqual({ buildSha: TARGET_SHA, healthOk: true, imageChanged: true });
    const update = requests.find((request) => request.url.endsWith('/application.saveDockerProvider'));
    expect(JSON.parse(String(update?.init?.body))).toEqual({
      applicationId: APP_ID,
      dockerImage: TARGET_IMAGE,
      username: 'registry-user',
      password: 'registry-password',
      registryUrl: 'ghcr.io',
    });
    expect(requests.some((request) => request.url.endsWith('/application.redeploy'))).toBe(true);
  });

  it('omits registry credentials when Dokploy does not return them', async () => {
    const requests: Array<{ url: string; init?: RequestInit }> = [];
    const fetchImpl = createFetch((url, init) => {
      requests.push({ url, init });
      if (url.includes('/application.one')) {
        return jsonResponse(200, {
          sourceType: 'docker',
          dockerImage: 'ghcr.io/yeshuaacademy/finance@sha256:old-digest',
        });
      }
      if (url.endsWith('/application.saveDockerProvider') || url.endsWith('/application.redeploy')) {
        return jsonResponse(200, {});
      }
      if (url.endsWith('/api/deployment-info')) return jsonResponse(200, { buildSha: TARGET_SHA });
      if (url.endsWith('/api/health')) return jsonResponse(200, { status: 'ok' });
      throw new Error(`Unexpected URL ${url}`);
    });

    await runDokployRollout({
      apiKey: API_KEY,
      applicationId: APP_ID,
      expectedImage: TARGET_IMAGE,
      expectedBuildSha: TARGET_SHA,
      fetchImpl,
      sleepImpl: vi.fn(),
      attempts: 1,
      log: vi.fn(),
    });

    const update = requests.find((request) => request.url.endsWith('/application.saveDockerProvider'));
    expect(JSON.parse(String(update?.init?.body))).toEqual({
      applicationId: APP_ID,
      dockerImage: TARGET_IMAGE,
    });
  });

  it('does not rewrite an already-correct Docker image', async () => {
    const requests: string[] = [];
    const fetchImpl = createFetch((url) => {
      requests.push(url);
      if (url.includes('/application.one')) {
        return jsonResponse(200, { sourceType: 'docker', dockerImage: TARGET_IMAGE });
      }
      if (url.endsWith('/application.redeploy')) return jsonResponse(200, {});
      if (url.endsWith('/api/deployment-info')) return jsonResponse(200, { buildSha: TARGET_SHA });
      if (url.endsWith('/api/health')) return jsonResponse(200, { status: 'ok' });
      throw new Error(`Unexpected URL ${url}`);
    });

    await runDokployRollout({
      apiKey: API_KEY,
      applicationId: APP_ID,
      expectedImage: TARGET_IMAGE,
      expectedBuildSha: TARGET_SHA,
      fetchImpl,
      sleepImpl: vi.fn(),
      attempts: 1,
      log: vi.fn(),
    });

    expect(requests.some((url) => url.endsWith('/application.saveDockerProvider'))).toBe(false);
  });

  it('refuses to change a non-Docker provider', async () => {
    const fetchImpl = createFetch((url) => {
      if (url.includes('/application.one')) {
        return jsonResponse(200, {
          sourceType: 'github',
          dockerImage: 'ghcr.io/yeshuaacademy/finance@sha256:old-digest',
        });
      }
      throw new Error(`Unexpected URL ${url}`);
    });

    await expect(
      runDokployRollout({
        apiKey: API_KEY,
        applicationId: APP_ID,
        expectedImage: TARGET_IMAGE,
        expectedBuildSha: TARGET_SHA,
        fetchImpl,
        sleepImpl: vi.fn(),
        attempts: 1,
        log: vi.fn(),
      }),
    ).rejects.toThrow('sourceType must be docker');

    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('refuses a Docker image from a different repository', async () => {
    const fetchImpl = createFetch((url) => {
      if (url.includes('/application.one')) {
        return jsonResponse(200, {
          sourceType: 'docker',
          dockerImage: 'ghcr.io/other/project:main',
        });
      }
      throw new Error(`Unexpected URL ${url}`);
    });

    await expect(
      runDokployRollout({
        apiKey: API_KEY,
        applicationId: APP_ID,
        expectedImage: TARGET_IMAGE,
        expectedBuildSha: TARGET_SHA,
        fetchImpl,
        sleepImpl: vi.fn(),
        attempts: 1,
        log: vi.fn(),
      }),
    ).rejects.toThrow('Refusing cross-repository mutation');
  });

  it('fails when production never converges to the expected SHA', async () => {
    const fetchImpl = createFetch((url) => {
      if (url.includes('/application.one')) {
        return jsonResponse(200, { sourceType: 'docker', dockerImage: TARGET_IMAGE });
      }
      if (url.endsWith('/application.redeploy')) return jsonResponse(200, {});
      if (url.endsWith('/api/deployment-info')) return jsonResponse(200, { buildSha: 'old-sha' });
      if (url.endsWith('/api/health')) return jsonResponse(200, { status: 'ok' });
      throw new Error(`Unexpected URL ${url}`);
    });

    await expect(
      runDokployRollout({
        apiKey: API_KEY,
        applicationId: APP_ID,
        expectedImage: TARGET_IMAGE,
        expectedBuildSha: TARGET_SHA,
        fetchImpl,
        sleepImpl: vi.fn(),
        attempts: 2,
        delayMs: 0,
        log: vi.fn(),
      }),
    ).rejects.toThrow('Production did not converge');
  });
});
