export const encodeApiPathSegment = (value: string): string => encodeURIComponent(value);

export const buildLimitQuery = (limit: number): string => {
  const query = new URLSearchParams();
  query.set('limit', String(limit));
  return query.toString();
};

export const buildReportSummaryQuery = (params: { year: number; month?: number | null }): string => {
  const query = new URLSearchParams();
  query.set('year', String(params.year));
  if (params.month) {
    query.set('month', String(params.month));
  }
  return query.toString();
};

export const buildReconciliationQuery = (params: {
  accountId: string;
  month?: number;
  year?: number;
  start?: string;
  end?: string;
}): string => {
  const query = new URLSearchParams();
  query.set('accountId', params.accountId);
  if (params.month) query.set('month', String(params.month));
  if (params.year) query.set('year', String(params.year));
  if (params.start) query.set('start', params.start);
  if (params.end) query.set('end', params.end);
  return query.toString();
};
