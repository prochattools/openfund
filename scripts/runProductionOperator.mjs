const base = 'https://finance.yeshua.academy';
const operation = process.argv[2];
const execute = process.argv[3] === '--execute';
const confirmedPlanHash = process.argv[4] ?? null;

const routes = {
  direction: '/api/operator/direction-inference',
  proposals: '/api/operator/owner-history-proposals',
  'direction-usage-audit': '/api/operator/transaction-type-direction-usage-audit',
};

if (!(operation in routes)) {
  console.error(JSON.stringify({ ok: false, error: 'Unknown operation.' }));
  process.exit(1);
}

if (execute && !confirmedPlanHash) {
  console.error(JSON.stringify({ ok: false, error: 'Execution requires a confirmed plan hash.' }));
  process.exit(1);
}

const response = await fetch(`${base}${routes[operation]}`, {
  method: 'POST',
  headers: {
    'content-type': 'application/json',
    'cache-control': 'no-cache',
    pragma: 'no-cache',
  },
  body: JSON.stringify(execute ? { execute: true, confirmedPlanHash } : {}),
});

const body = await response.json();
const summary = {
  httpStatus: response.status,
  status: body.status ?? null,
  dryRun: body.dryRun ?? null,
  writesPerformed: body.writesPerformed ?? null,
  planHash: body.planHash ?? null,
  reportHash: body.reportHash ?? null,
  counts: body.counts ?? null,
  totals: body.totals ?? null,
  buckets: body.buckets ?? null,
  matcherDistribution: body.matcherDistribution ?? null,
  confidenceDistribution: body.confidenceDistribution ?? null,
  persistence: body.persistence ?? null,
  updatedCount: body.updatedCount ?? null,
  skippedAlreadySetCount: body.skippedAlreadySetCount ?? null,
  expiredSuggestionCount: body.expiredSuggestionCount ?? null,
  createdSuggestionCount: body.createdSuggestionCount ?? null,
  sideEffects: body.sideEffects ?? null,
  error: body.error ?? null,
};

console.log(JSON.stringify(summary));
if (!response.ok) process.exitCode = 1;
