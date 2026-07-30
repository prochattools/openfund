const base = 'https://finance.yeshua.academy';
const paths = ['/api/deployment-info','/api/health','/api/ledger','/api/review?page=1&pageSize=25','/api/reference-data/projects'];
for (const path of paths) {
  try {
    const response = await fetch(`${base}${path}`, { headers: { 'cache-control': 'no-cache', pragma: 'no-cache' }, redirect: 'manual' });
    const contentType = response.headers.get('content-type') ?? '';
    const summary = { path, status: response.status, contentType };
    if (contentType.includes('application/json')) {
      const body = await response.json();
      summary.keys = body && typeof body === 'object' ? Object.keys(body).sort() : [];
      for (const key of ['total','count','totalCount','pageSize']) if (typeof body?.[key] === 'number') summary[key] = body[key];
      for (const key of ['transactions','items','data','projects']) if (Array.isArray(body?.[key])) summary[key] = body[key].length;
      for (const key of ['commitSha','sha','buildSha','buildRef','authProvider']) if (typeof body?.[key] === 'string') summary[key] = body[key];
      for (const key of ['apiProxyEnabled','productionAuthBypassEnabled','productionAuthBypassConfigured','workspaceConfigured','hasDatabaseUrl']) if (typeof body?.[key] === 'boolean') summary[key] = body[key];
    }
    console.log(JSON.stringify(summary));
  } catch (error) {
    console.log(JSON.stringify({ path, error: error instanceof Error ? error.name : 'UnknownError' }));
  }
}
