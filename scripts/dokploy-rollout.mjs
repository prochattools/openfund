#!/usr/bin/env node

const DEFAULT_DOKPLOY_API_BASE = 'https://dokploy.prochat.tools/api';
const DEFAULT_PRODUCTION_ORIGIN = 'https://finance.yeshua.academy';

const unwrapPayload = (payload) => {
  if (!payload || typeof payload !== 'object') return payload;
  if (payload.result?.data?.json && typeof payload.result.data.json === 'object') return payload.result.data.json;
  if (payload.result?.data && typeof payload.result.data === 'object') return payload.result.data;
  if (payload.data?.json && typeof payload.data.json === 'object') return payload.data.json;
  if (payload.data && typeof payload.data === 'object') return payload.data;
  return payload;
};

const imageRepository = (image) => {
  if (typeof image !== 'string' || image.trim() === '') return null;
  const withoutDigest = image.trim().split('@')[0];
  const lastSlash = withoutDigest.lastIndexOf('/');
  const lastColon = withoutDigest.lastIndexOf(':');
  return lastColon > lastSlash ? withoutDigest.slice(0, lastColon) : withoutDigest;
};

const requireValue = (value, name) => {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (!normalized) throw new Error(`${name} is required.`);
  return normalized;
};

export async function runDokployRollout({
  apiKey,
  applicationId,
  expectedImage,
  expectedBuildSha,
  dokployApiBase = DEFAULT_DOKPLOY_API_BASE,
  productionOrigin = DEFAULT_PRODUCTION_ORIGIN,
  fetchImpl = fetch,
  sleepImpl = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  attempts = 30,
  delayMs = 10_000,
  log = console.log,
} = {}) {
  const key = requireValue(apiKey, 'DOKPLOY_API_KEY');
  const appId = requireValue(applicationId, 'DOKPLOY_APP_ID');
  const targetImage = requireValue(expectedImage, 'DOKPLOY_EXPECTED_IMAGE');
  const targetSha = requireValue(expectedBuildSha, 'EXPECTED_BUILD_SHA');
  const expectedRepository = imageRepository(targetImage);

  const dokployRequest = async (path, { method = 'GET', body } = {}) => {
    const response = await fetchImpl(`${dokployApiBase}${path}`, {
      method,
      headers: {
        'x-api-key': key,
        ...(body ? { 'content-type': 'application/json' } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    if (!response.ok) {
      throw new Error(`Dokploy ${path} returned HTTP ${response.status}.`);
    }
    const payload = await response.json().catch(() => ({}));
    return unwrapPayload(payload);
  };

  const application = await dokployRequest(`/application.one?applicationId=${encodeURIComponent(appId)}`);
  const sourceType = typeof application?.sourceType === 'string' ? application.sourceType : null;
  const currentImage = typeof application?.dockerImage === 'string' ? application.dockerImage.trim() : null;

  log(`Dokploy preflight: sourceType=${sourceType ?? 'unknown'}, dockerImage=${currentImage ?? 'unset'}.`);

  if (sourceType !== 'docker') {
    throw new Error(`Dokploy application sourceType must be docker; received ${sourceType ?? 'unknown'}. Refusing provider mutation.`);
  }

  if (imageRepository(currentImage) !== expectedRepository) {
    throw new Error(`Dokploy dockerImage repository does not match ${expectedRepository}. Refusing cross-repository mutation.`);
  }

  if (currentImage !== targetImage) {
    const providerUpdate = {
      applicationId: appId,
      dockerImage: targetImage,
      ...(typeof application?.username === 'string' && application.username ? { username: application.username } : {}),
      ...(typeof application?.password === 'string' && application.password ? { password: application.password } : {}),
      ...(typeof application?.registryUrl === 'string' && application.registryUrl ? { registryUrl: application.registryUrl } : {}),
    };
    await dokployRequest('/application.saveDockerProvider', {
      method: 'POST',
      body: providerUpdate,
    });
    log(`Dokploy dockerImage normalized to ${targetImage}.`);
  } else {
    log('Dokploy dockerImage already matches the expected floating tag.');
  }

  const deployResponse = await dokployRequest('/application.deploy', {
    method: 'POST',
    body: {
      applicationId: appId,
    },
  });
  if (deployResponse?.error || deployResponse?.success === false) {
    throw new Error(`Dokploy /application.deploy failed: ${JSON.stringify(deployResponse)}.`);
  }
  log('Dokploy deploy accepted; verifying production convergence.');

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    let buildSha = null;
    let healthOk = false;
    try {
      const deploymentResponse = await fetchImpl(`${productionOrigin}/api/deployment-info`, {
        headers: { accept: 'application/json' },
      });
      if (deploymentResponse.ok) {
        const deployment = await deploymentResponse.json();
        buildSha = typeof deployment?.buildSha === 'string' ? deployment.buildSha : null;
      }

      const healthResponse = await fetchImpl(`${productionOrigin}/api/health`, {
        headers: { accept: 'application/json' },
      });
      healthOk = healthResponse.status === 200;
    } catch {
      // A rolling deployment may temporarily make the public endpoint unavailable.
    }

    log(`Production verify ${attempt}/${attempts}: sha=${buildSha ?? 'unavailable'}, health=${healthOk ? 'ok' : 'pending'}.`);
    if (buildSha === targetSha && healthOk) {
      return { buildSha, healthOk, imageChanged: currentImage !== targetImage };
    }
    if (attempt < attempts) await sleepImpl(delayMs);
  }

  throw new Error(`Production did not converge to ${targetSha} after ${attempts} verification attempts.`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runDokployRollout({
    apiKey: process.env.DOKPLOY_API_KEY,
    applicationId: process.env.DOKPLOY_APP_ID,
    expectedImage: process.env.DOKPLOY_EXPECTED_IMAGE,
    expectedBuildSha: process.env.EXPECTED_BUILD_SHA,
    dokployApiBase: process.env.DOKPLOY_API_BASE || DEFAULT_DOKPLOY_API_BASE,
    productionOrigin: process.env.PRODUCTION_ORIGIN || DEFAULT_PRODUCTION_ORIGIN,
  }).catch((error) => {
    console.error(error instanceof Error ? error.message : 'Dokploy rollout failed.');
    process.exitCode = 1;
  });
}
