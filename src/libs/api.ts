const rawEnvBase = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();

const resolveApiBaseUrl = (): string => {
  if (rawEnvBase && rawEnvBase.length > 0) {
    return rawEnvBase.replace(/\/+$/, '');
  }
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin.replace(/\/+$/, '');
  }
  return 'http://localhost:4000';
};

const API_BASE_URL = resolveApiBaseUrl();
const DEFAULT_USER_ID = process.env.NEXT_PUBLIC_API_USER_ID ?? 'demo-user';
const DEFAULT_USER_ROLE = process.env.NEXT_PUBLIC_API_USER_ROLE === 'viewer' ? 'viewer' : 'admin';

export type ClientRole = 'admin' | 'viewer';
export const getClientRole = (): ClientRole => DEFAULT_USER_ROLE;
export const isClientAdmin = () => getClientRole() === 'admin';

const getApiUrl = (path: string): string => {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE_URL}${cleanPath}`;
};

const withUserHeader = (init: RequestInit = {}): RequestInit => {
  const headers = new Headers(init.headers);
  headers.set('x-user-id', DEFAULT_USER_ID);
  headers.set('x-user-role', DEFAULT_USER_ROLE);

  return { ...init, headers };
};

export const fetchLedger = async () => {
  const response = await fetch(getApiUrl('/api/ledger'), withUserHeader({ cache: 'no-store' }));

  if (!response.ok) {
    throw new Error('Het grootboek kon niet worden geladen.');
  }

  return response.json();
};

export const fetchReview = async () => {
  const response = await fetch(getApiUrl('/api/review'), withUserHeader({ cache: 'no-store' }));

  if (!response.ok) {
    throw new Error('De beoordelingsrij kon niet worden geladen.');
  }

  return response.json();
};

export const clearReviewQueue = async () => {
  const response = await fetch(getApiUrl('/api/review/clear'), withUserHeader({
    method: 'POST',
  }));

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'De beoordelingsrij kon niet worden afgerond.' }));
    throw new Error(error.error ?? 'De beoordelingsrij kon niet worden afgerond.');
  }

  return response.json();
};

export const uploadImportFile = async (formData: FormData) => {
  const response = await fetch(getApiUrl('/api/upload'), withUserHeader({
    method: 'POST',
    body: formData,
  }));

  if (!response.ok) {
    const error = await response.json().catch(() => ({
      error: 'De import is niet gelukt. Controleer het bestand en probeer het opnieuw.',
    }));
    throw new Error(error.error ?? 'De import is niet gelukt. Controleer het bestand en probeer het opnieuw.');
  }

  return response.json();
};

export const updateCategory = async (id: string, payload: { categoryId?: string | null; categoryName?: string }) => {
  const response = await fetch(getApiUrl(`/api/transactions/${id}/category`), withUserHeader({
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  }));

  if (!response.ok) {
    throw new Error('De categorie kon niet worden bijgewerkt.');
  }

  return response.json();
};

export const fetchAccounts = async () => {
  const response = await fetch(getApiUrl('/api/accounts'), withUserHeader({ cache: 'no-store' }));

  if (!response.ok) {
    throw new Error('Rekeningen konden niet worden geladen.');
  }

  return response.json();
};

export const saveOpeningBalance = async (accountId: string, payload: {
  effectiveDate: string;
  amount: number | string;
  currency?: string;
  note?: string;
}) => {
  const response = await fetch(getApiUrl(`/api/accounts/${accountId}/opening-balance`), withUserHeader({
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  }));

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Beginbalans kon niet worden opgeslagen.' }));
    throw new Error(error.error ?? 'Beginbalans kon niet worden opgeslagen.');
  }

  return response.json();
};

export const lockOpeningBalance = async (balanceId: string) => {
  const response = await fetch(getApiUrl(`/api/opening-balances/${balanceId}/lock`), withUserHeader({
    method: 'POST',
  }));

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Beginbalans kon niet worden vergrendeld.' }));
    throw new Error(error.error ?? 'Beginbalans kon niet worden vergrendeld.');
  }

  return response.json();
};

export const fetchReconciliation = async (params: {
  accountId: string;
  month?: number;
  year?: number;
  start?: string;
  end?: string;
}) => {
  const query = new URLSearchParams();
  query.set('accountId', params.accountId);
  if (params.month) query.set('month', String(params.month));
  if (params.year) query.set('year', String(params.year));
  if (params.start) query.set('start', params.start);
  if (params.end) query.set('end', params.end);

  const response = await fetch(getApiUrl(`/api/reconciliation?${query.toString()}`), withUserHeader({ cache: 'no-store' }));

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Reconciliatiegegevens konden niet worden geladen.' }));
    throw new Error(error.error ?? 'Reconciliatiegegevens konden niet worden geladen.');
  }

  return response.json();
};

export const lockLedgerPeriod = async (ledgerId: string, payload?: { note?: string }) => {
  const response = await fetch(getApiUrl(`/api/ledger/${ledgerId}/lock`), withUserHeader({
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: payload ? JSON.stringify(payload) : undefined,
  }));

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Maand kon niet worden vergrendeld.' }));
    throw new Error(error.error ?? 'Maand kon niet worden vergrendeld.');
  }

  return response.json();
};

export const unlockLedgerPeriod = async (ledgerId: string) => {
  const response = await fetch(getApiUrl(`/api/ledger/${ledgerId}/unlock`), withUserHeader({
    method: 'POST',
  }));

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Maand kon niet worden ontgrendeld.' }));
    throw new Error(error.error ?? 'Maand kon niet worden ontgrendeld.');
  }

  return response.json();
};

type RulePayload = {
  label: string;
  pattern?: string;
  categoryId: string;
  matchType?: string;
  matchField?: string;
  conditions?: unknown;
  priority?: number;
  isActive?: boolean;
};

export const fetchCategorizationRules = async () => {
  const response = await fetch(getApiUrl('/api/rules'), withUserHeader({ cache: 'no-store' }));

  if (!response.ok) {
    throw new Error('Categorisatieregels konden niet worden geladen.');
  }

  return response.json();
};

export const createCategorizationRule = async (payload: RulePayload) => {
  const response = await fetch(getApiUrl('/api/rules'), withUserHeader({
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  }));

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Categorisatieregel kon niet worden gemaakt.' }));
    throw new Error(error.error ?? 'Categorisatieregel kon niet worden gemaakt.');
  }

  return response.json();
};

export const updateCategorizationRule = async (id: string, payload: Partial<RulePayload>) => {
  const response = await fetch(getApiUrl(`/api/rules/${id}`), withUserHeader({
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  }));

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Categorisatieregel kon niet worden bijgewerkt.' }));
    throw new Error(error.error ?? 'Categorisatieregel kon niet worden bijgewerkt.');
  }

  return response.json();
};

export const deleteCategorizationRule = async (id: string): Promise<void> => {
  const response = await fetch(getApiUrl(`/api/rules/${id}`), withUserHeader({
    method: 'DELETE',
  }));

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Categorisatieregel kon niet worden verwijderd.' }));
    throw new Error(error.error ?? 'Categorisatieregel kon niet worden verwijderd.');
  }

  return;
};

export const previewRule = async (id: string, scope: 'review-queue' | { importBatchId: string }) => {
  const url = getApiUrl(`/api/rules/${id}/preview`);
  const response = await fetch(url, withUserHeader({
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(scope === 'review-queue' ? { scope } : { scope: 'import-batch', importBatchId: scope.importBatchId }),
  }));

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Voorbeeld van regel kon niet worden geladen.' }));
    console.error('Voorbeeld van regel kon niet worden geladen', { url, status: response.status, error });
    throw new Error(error.error ?? 'Voorbeeld van regel kon niet worden geladen.');
  }

  return response.json();
};

export const applyRule = async (id: string, transactionIds: string[]) => {
  const url = getApiUrl(`/api/rules/${id}/apply`);
  const response = await fetch(url, withUserHeader({
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ transactionIds }),
  }));

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Categorisatieregel kon niet worden toegepast.' }));
    console.error('Categorisatieregel kon niet worden toegepast', { url, status: response.status, error });
    throw new Error(error.error ?? 'Categorisatieregel kon niet worden toegepast.');
  }

  return response.json();
};


export const fetchReportSummary = async (params: { year: number; month?: number | null }) => {
  const query = new URLSearchParams();
  query.set('year', String(params.year));
  if (params.month) {
    query.set('month', String(params.month));
  }

  const response = await fetch(getApiUrl(`/api/reports/summary?${query.toString()}`), withUserHeader({ cache: 'no-store' }));

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Het rapport kon niet worden geladen.' }));
    throw new Error(error.error ?? 'Het rapport kon niet worden geladen.');
  }

  return response.json();
};

export type AuditLogEntry = {
  id: string;
  actorId: string | null;
  actorEmail: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  before: unknown;
  after: unknown;
  metadata: unknown;
  createdAt: string;
};

export const fetchAuditLogs = async (limit = 25): Promise<AuditLogEntry[]> => {
  const query = new URLSearchParams();
  query.set('limit', String(limit));

  const response = await fetch(getApiUrl(`/api/audit-log?${query.toString()}`), withUserHeader({ cache: 'no-store' }));

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'De auditlog kon niet worden geladen.' }));
    throw new Error(error.error ?? 'De auditlog kon niet worden geladen.');
  }

  return response.json();
};

export type EmailRecipient = {
  id: string;
  email: string;
  name: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export const fetchEmailRecipients = async (): Promise<EmailRecipient[]> => {
  const response = await fetch(getApiUrl('/api/email-recipients'), withUserHeader({ cache: 'no-store' }));

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'E-mailontvangers konden niet worden geladen.' }));
    throw new Error(error.error ?? 'E-mailontvangers konden niet worden geladen.');
  }

  return response.json();
};

export const saveEmailRecipient = async (payload: { email: string; name?: string | null }): Promise<EmailRecipient> => {
  const response = await fetch(getApiUrl('/api/email-recipients'), withUserHeader({
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }));

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'E-mailontvanger kon niet worden opgeslagen.' }));
    throw new Error(error.error ?? 'E-mailontvanger kon niet worden opgeslagen.');
  }

  return response.json();
};

export const deactivateEmailRecipient = async (id: string): Promise<EmailRecipient> => {
  const response = await fetch(getApiUrl(`/api/email-recipients/${id}`), withUserHeader({ method: 'DELETE' }));

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'E-mailontvanger kon niet worden gedeactiveerd.' }));
    throw new Error(error.error ?? 'E-mailontvanger kon niet worden gedeactiveerd.');
  }

  return response.json();
};

export type ImportBatchSummary = {
  id: string;
  filename: string;
  fileType: string | null;
  status: 'pending' | 'completed' | 'failed';
  totalRows: number;
  importedRows: number;
  duplicateRows: number;
  errorRows: number;
  autoCategorizedRows: number;
  reviewRows: number;
  startedAt: string;
  completedAt: string | null;
};

export const fetchImportBatches = async (limit = 25): Promise<ImportBatchSummary[]> => {
  const query = new URLSearchParams();
  query.set('limit', String(limit));

  const response = await fetch(getApiUrl(`/api/import-batches?${query.toString()}`), withUserHeader({ cache: 'no-store' }));

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Importgeschiedenis kon niet worden geladen.' }));
    throw new Error(error.error ?? 'Importgeschiedenis kon niet worden geladen.');
  }

  return response.json();
};