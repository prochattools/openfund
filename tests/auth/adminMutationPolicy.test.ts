/**
 * AUTH-001 — Administrator mutation policy tests.
 *
 * Verifies that all mutation routes and admin-only operations
 * require the admin role and reject viewers with a Dutch 403.
 *
 * Per PHILOSOPHY.md § 6:
 * "Only administrators may categorize transactions, approve suggestions,
 *  create or change categorization rules, reopen a closed period, and
 *  approve and send reports. All other users have viewing rights only.
 *  Server-side authorization is authoritative."
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ─── Shared test helpers ──────────────────────────────────────────────────────

const makeAdminRequest = (body: unknown = {}, params: Record<string, string> = {}) => ({
  body,
  params,
  header: (name: string) => {
    if (name === 'x-user-id') return 'admin-user';
    if (name === 'x-user-role') return 'admin';
    if (name === 'x-actor-id') return 'actor-1';
    if (name === 'x-user-email') return 'admin@example.test';
    if (name === 'x-workspace-id') return 'workspace-1';
    return undefined;
  },
  query: {} as Record<string, string>,
});

const makeViewerRequest = (body: unknown = {}, params: Record<string, string> = {}) => ({
  body,
  params,
  header: (name: string) => {
    if (name === 'x-user-id') return 'viewer-user';
    if (name === 'x-user-role') return 'viewer';
    if (name === 'x-actor-id') return null;
    if (name === 'x-user-email') return null;
    if (name === 'x-workspace-id') return 'workspace-1';
    return undefined;
  },
  query: {} as Record<string, string>,
});

const makeRes = () => {
  const res = {
    statusCode: 200,
    body: undefined as unknown,
    status(code: number) { this.statusCode = code; return this; },
    json(payload: unknown) { this.body = payload; return this; },
    send() { return this; },
  };
  return res;
};

const ADMIN_ONLY_403 = { error: 'Alleen beheerders mogen deze actie uitvoeren.' };

// ─── Upload routes ────────────────────────────────────────────────────────────

const uploadMocks = vi.hoisted(() => ({
  processImportBuffer: vi.fn(),
  buildMonthlyImportPreview: vi.fn(),
  prismaTransaction: vi.fn().mockImplementation((cb: (db: unknown) => unknown) => cb({})),
  prismaFindMany: vi.fn().mockResolvedValue([]),
}));

vi.mock('../../server/services/importService', () => ({
  processImportBuffer: uploadMocks.processImportBuffer,
  LockedPeriodError: class extends Error {},
}));

vi.mock('../../server/services/monthlyImportPreviewService', () => ({
  buildMonthlyImportPreview: uploadMocks.buildMonthlyImportPreview,
  MonthlyImportPreviewError: class extends Error { statusCode = 400; },
}));

vi.mock('../../server/services/reconciliationService', () => ({
  LedgerMismatchError: class extends Error {},
  MissingOpeningBalanceError: class extends Error {},
}));

vi.mock('../../server/prismaClient', () => ({
  prisma: {
    $transaction: uploadMocks.prismaTransaction,
    transaction: { findMany: uploadMocks.prismaFindMany },
  },
}));

import { handleImportUpload, handleMonthlyImportPreviewUpload } from '../../server/routes/upload';

describe('admin mutation policy — upload routes', () => {
  beforeEach(() => {
    uploadMocks.processImportBuffer.mockReset();
    uploadMocks.buildMonthlyImportPreview.mockReset();
    uploadMocks.prismaFindMany.mockResolvedValue([]);
  });

  it('POST /api/upload requires admin', async () => {
    const req = { ...makeViewerRequest(), file: { buffer: Buffer.from('csv'), originalname: 'test.csv', mimetype: 'text/csv' } };
    const res = makeRes();
    await handleImportUpload(req as any, res as any);
    expect(res.statusCode).toBe(403);
    expect(res.body).toEqual(ADMIN_ONLY_403);
    expect(uploadMocks.processImportBuffer).not.toHaveBeenCalled();
  });

  it('POST /api/upload/preview requires admin', async () => {
    const req = { ...makeViewerRequest(), file: { buffer: Buffer.from('csv'), originalname: 'test.csv', mimetype: 'text/csv' } };
    const res = makeRes();
    await handleMonthlyImportPreviewUpload(req as any, res as any);
    expect(res.statusCode).toBe(403);
    expect(res.body).toEqual(ADMIN_ONLY_403);
    expect(uploadMocks.buildMonthlyImportPreview).not.toHaveBeenCalled();
  });
});

// ─── Review routes ────────────────────────────────────────────────────────────

const reviewMocks = vi.hoisted(() => ({
  getEvidenceRichReviewQueue: vi.fn(),
  assignManualBooking: vi.fn(),
  clearReviewQueueForUser: vi.fn(),
  previewRuleCreation: vi.fn(),
  activateRuleCreation: vi.fn(),
  prismaTransaction2: vi.fn().mockImplementation((cb: (db: unknown) => unknown) => cb({})),
}));

vi.mock('../../server/services/reviewQueueService', () => ({
  getEvidenceRichReviewQueue: reviewMocks.getEvidenceRichReviewQueue,
  clearReviewQueue: reviewMocks.clearReviewQueueForUser,
}));

vi.mock('../../server/services/reviewDecisionService', () => ({
  assignManualBooking: reviewMocks.assignManualBooking,
  INCOMPLETE_DIMENSIONS_MESSAGE: 'Alle drie dimensies zijn verplicht.',
  isCompleteReviewAssignmentPayload: () => true,
  ReviewDecisionError: class extends Error { statusCode = 400; },
}));

vi.mock('../../server/services/ruleCreationService', () => ({
  previewRuleCreation: reviewMocks.previewRuleCreation,
  activateRuleCreation: reviewMocks.activateRuleCreation,
  RuleCreationError: class extends Error { statusCode = 400; },
}));

import {
  updateTransactionCategory,
  clearReviewQueue,
  previewReviewRuleCreation,
  activateReviewRuleCreation,
} from '../../server/routes/review';

describe('admin mutation policy — review routes', () => {
  beforeEach(() => {
    reviewMocks.getEvidenceRichReviewQueue.mockReset();
    reviewMocks.assignManualBooking.mockReset();
    reviewMocks.clearReviewQueueForUser.mockReset();
    reviewMocks.previewRuleCreation.mockReset();
    reviewMocks.activateRuleCreation.mockReset();
    reviewMocks.prismaTransaction2.mockImplementation((cb: (db: unknown) => unknown) => cb({}));
  });

  it('PATCH /api/transactions/:id/category requires admin', async () => {
    const res = makeRes();
    await updateTransactionCategory(makeViewerRequest({
      projectId: 'p-1',
      transactionTypeId: 't-1',
      categoryId: 'c-1',
    }, { id: 'tx-1' }) as any, res as any);
    expect(res.statusCode).toBe(403);
    expect(res.body).toEqual(ADMIN_ONLY_403);
  });

  it('POST /api/review/clear requires admin', async () => {
    const res = makeRes();
    await clearReviewQueue(makeViewerRequest() as any, res as any);
    expect(res.statusCode).toBe(403);
    expect(res.body).toEqual(ADMIN_ONLY_403);
  });

  it('POST /api/review/:id/rule/preview requires admin', async () => {
    const res = makeRes();
    await previewReviewRuleCreation(makeViewerRequest({}, { id: 'tx-1' }) as any, res as any);
    expect(res.statusCode).toBe(403);
    expect(res.body).toEqual(ADMIN_ONLY_403);
    expect(reviewMocks.previewRuleCreation).not.toHaveBeenCalled();
  });

  it('POST /api/review/:id/rule/activate requires admin', async () => {
    const res = makeRes();
    await activateReviewRuleCreation(makeViewerRequest({}, { id: 'tx-1' }) as any, res as any);
    expect(res.statusCode).toBe(403);
    expect(res.body).toEqual(ADMIN_ONLY_403);
    expect(reviewMocks.activateRuleCreation).not.toHaveBeenCalled();
  });
});

// ─── Account and opening balance routes ──────────────────────────────────────

const accountMocks = vi.hoisted(() => ({
  prismaAccount: vi.fn(),
  prismaBalance: vi.fn(),
  prismaTransaction3: vi.fn().mockImplementation(async (cb: (tx: unknown) => unknown) => cb({
    account: { findFirst: vi.fn().mockResolvedValue({ id: 'acc-1', identifier: 'NL89', currency: 'EUR' }) },
    openingBalance: {
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ id: 'bal-1', amountMinor: 100n, effectiveDate: new Date(), lockedAt: null, currency: 'EUR', note: null }),
      update: vi.fn(),
      findFirst: vi.fn().mockResolvedValue(null),
    },
    auditLog: { create: vi.fn() },
  })),
}));

vi.mock('../../server/prismaClient', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../server/prismaClient')>();
  return {
    ...actual,
    prisma: {
      $transaction: accountMocks.prismaTransaction3,
      account: { findMany: accountMocks.prismaAccount },
      openingBalance: { findMany: accountMocks.prismaBalance },
      auditLog: { create: vi.fn() },
    },
  };
});

import { upsertOpeningBalance, lockOpeningBalance } from '../../server/routes/accounts';

describe('admin mutation policy — account routes', () => {
  it('POST /api/accounts/:accountId/opening-balance requires admin', async () => {
    const res = makeRes();
    await upsertOpeningBalance(makeViewerRequest(
      { effectiveDate: '2026-01-01', amount: 100 },
      { accountId: 'acc-1' },
    ) as any, res as any);
    expect(res.statusCode).toBe(403);
    expect(res.body).toEqual(ADMIN_ONLY_403);
  });

  it('POST /api/opening-balances/:balanceId/lock requires admin', async () => {
    const res = makeRes();
    await lockOpeningBalance(makeViewerRequest({}, { balanceId: 'bal-1' }) as any, res as any);
    expect(res.statusCode).toBe(403);
    expect(res.body).toEqual(ADMIN_ONLY_403);
  });
});

// ─── Ledger lock/unlock routes ────────────────────────────────────────────────

import { lockLedger, unlockLedger } from '../../server/routes/ledgers';

describe('admin mutation policy — ledger routes', () => {
  it('POST /api/ledger/:ledgerId/lock requires admin', async () => {
    const res = makeRes();
    await lockLedger(makeViewerRequest({}, { ledgerId: 'ledger-1' }) as any, res as any);
    expect(res.statusCode).toBe(403);
    expect(res.body).toEqual(ADMIN_ONLY_403);
  });

  it('POST /api/ledger/:ledgerId/unlock requires admin', async () => {
    const res = makeRes();
    await unlockLedger(makeViewerRequest({}, { ledgerId: 'ledger-1' }) as any, res as any);
    expect(res.statusCode).toBe(403);
    expect(res.body).toEqual(ADMIN_ONLY_403);
  });
});

// ─── Rules routes ─────────────────────────────────────────────────────────────

const rulesMocks = vi.hoisted(() => ({
  createRule: vi.fn(),
  updateRule: vi.fn(),
  deleteRule: vi.fn(),
  applyRuleToTransactions: vi.fn(),
}));

vi.mock('../../server/services/ruleEngine', () => ({
  createRule: rulesMocks.createRule,
  updateRule: rulesMocks.updateRule,
  deleteRule: rulesMocks.deleteRule,
  previewRuleMatchesForUser: vi.fn().mockResolvedValue([]),
  applyRuleToTransactions: rulesMocks.applyRuleToTransactions,
}));

import { postRule, patchRule, removeRule, applyRule } from '../../server/routes/rules';

describe('admin mutation policy — rules routes', () => {
  it('POST /api/rules requires admin', async () => {
    const res = makeRes();
    await postRule(makeViewerRequest({ label: 'Test', categoryId: 'cat-1' }) as any, res as any);
    expect(res.statusCode).toBe(403);
    expect(res.body).toEqual(ADMIN_ONLY_403);
    expect(rulesMocks.createRule).not.toHaveBeenCalled();
  });

  it('PATCH /api/rules/:id requires admin', async () => {
    const res = makeRes();
    await patchRule(makeViewerRequest({ label: 'Updated' }, { id: 'rule-1' }) as any, res as any);
    expect(res.statusCode).toBe(403);
    expect(res.body).toEqual(ADMIN_ONLY_403);
    expect(rulesMocks.updateRule).not.toHaveBeenCalled();
  });

  it('DELETE /api/rules/:id requires admin', async () => {
    const res = makeRes();
    await removeRule(makeViewerRequest({}, { id: 'rule-1' }) as any, res as any);
    expect(res.statusCode).toBe(403);
    expect(res.body).toEqual(ADMIN_ONLY_403);
    expect(rulesMocks.deleteRule).not.toHaveBeenCalled();
  });

  it('POST /api/rules/:id/apply requires admin', async () => {
    const res = makeRes();
    await applyRule(makeViewerRequest({ transactionIds: ['tx-1'] }, { id: 'rule-1' }) as any, res as any);
    expect(res.statusCode).toBe(403);
    expect(res.body).toEqual(ADMIN_ONLY_403);
    expect(rulesMocks.applyRuleToTransactions).not.toHaveBeenCalled();
  });
});

// ─── Email recipients routes ──────────────────────────────────────────────────

import { upsertEmailRecipient, deactivateEmailRecipient } from '../../server/routes/emailRecipients';

describe('admin mutation policy — email recipients routes', () => {
  it('POST /api/email-recipients requires admin', async () => {
    const res = makeRes();
    await upsertEmailRecipient(makeViewerRequest({ email: 'test@example.test' }) as any, res as any);
    expect(res.statusCode).toBe(403);
    expect(res.body).toEqual(ADMIN_ONLY_403);
  });

  it('DELETE /api/email-recipients/:id requires admin', async () => {
    const res = makeRes();
    await deactivateEmailRecipient(makeViewerRequest({}, { id: 'recipient-1' }) as any, res as any);
    expect(res.statusCode).toBe(403);
    expect(res.body).toEqual(ADMIN_ONLY_403);
  });
});

// ─── Report snapshot routes ───────────────────────────────────────────────────

const reportMocks = vi.hoisted(() => ({
  generateMonthlyReportSnapshot: vi.fn(),
  generateYearlyReportSnapshot: vi.fn(),
  generateAndStoreReportArtifacts: vi.fn(),
  approveSnapshot: vi.fn(),
  prepareDispatch: vi.fn(),
  prismaReportSnapshot: vi.fn(),
  prismaReportSnapshotLine: vi.fn(),
  prismaTransaction4: vi.fn().mockImplementation((cb: (tx: unknown) => unknown) => cb({})),
}));

vi.mock('../../server/services/reportSnapshotService', () => ({
  generateMonthlyReportSnapshot: reportMocks.generateMonthlyReportSnapshot,
  generateYearlyReportSnapshot: reportMocks.generateYearlyReportSnapshot,
  ReportSnapshotError: class extends Error { statusCode = 400; },
}));

vi.mock('../../server/services/reportArtifactService', () => ({
  generateAndStoreReportArtifacts: reportMocks.generateAndStoreReportArtifacts,
  ReportArtifactError: class extends Error { statusCode = 400; },
}));

vi.mock('../../server/services/reportApprovalDispatchService', () => ({
  approveSnapshot: reportMocks.approveSnapshot,
  prepareDispatch: reportMocks.prepareDispatch,
  ReportApprovalError: class extends Error { statusCode = 400; },
}));

vi.mock('../../server/services/periodCloseService', () => ({
  PeriodCloseError: class extends Error { statusCode = 400; },
}));

import {
  postMonthlyReportSnapshot,
  postYearlyReportSnapshot,
  postReportArtifacts,
  postApproveReportSnapshot,
  postPrepareReportDispatch,
} from '../../server/routes/reportSnapshots';

describe('admin mutation policy — report snapshot routes', () => {
  it('POST /api/reports/monthly/:year/:month/snapshot requires admin', async () => {
    const res = makeRes();
    await postMonthlyReportSnapshot(makeViewerRequest({ workspaceId: 'ws-1' }, { year: '2026', month: '01' }) as any, res as any);
    expect(res.statusCode).toBe(403);
    expect(res.body).toEqual(ADMIN_ONLY_403);
    expect(reportMocks.generateMonthlyReportSnapshot).not.toHaveBeenCalled();
  });

  it('POST /api/reports/yearly/:year/snapshot requires admin', async () => {
    const res = makeRes();
    await postYearlyReportSnapshot(makeViewerRequest({ workspaceId: 'ws-1' }, { year: '2026' }) as any, res as any);
    expect(res.statusCode).toBe(403);
    expect(res.body).toEqual(ADMIN_ONLY_403);
    expect(reportMocks.generateYearlyReportSnapshot).not.toHaveBeenCalled();
  });

  it('POST /api/reports/:snapshotId/artifacts requires admin', async () => {
    const res = makeRes();
    await postReportArtifacts(makeViewerRequest({ snapshotHash: 'hash-1' }, { snapshotId: 'snap-1' }) as any, res as any);
    expect(res.statusCode).toBe(403);
    expect(res.body).toEqual(ADMIN_ONLY_403);
    expect(reportMocks.generateAndStoreReportArtifacts).not.toHaveBeenCalled();
  });

  it('POST /api/reports/:snapshotId/approve requires admin', async () => {
    const res = makeRes();
    await postApproveReportSnapshot(makeViewerRequest({ workspaceId: 'ws-1', expectedSnapshotHash: 'hash-1' }, { snapshotId: 'snap-1' }) as any, res as any);
    expect(res.statusCode).toBe(403);
    expect(res.body).toEqual(ADMIN_ONLY_403);
    expect(reportMocks.approveSnapshot).not.toHaveBeenCalled();
  });

  it('POST /api/reports/:snapshotId/dispatch/prepare requires admin', async () => {
    const res = makeRes();
    await postPrepareReportDispatch(makeViewerRequest({
      workspaceId: 'ws-1',
      reportApprovalId: 'approval-1',
      fromAddress: 'admin@example.test',
      subject: 'Maandrapport',
      recipients: [{ email: 'viewer@example.test' }],
      contentHash: 'hash-1',
    }, { snapshotId: 'snap-1' }) as any, res as any);
    expect(res.statusCode).toBe(403);
    expect(res.body).toEqual(ADMIN_ONLY_403);
    expect(reportMocks.prepareDispatch).not.toHaveBeenCalled();
  });
});

// ─── Period close routes ──────────────────────────────────────────────────────

const closeMocks = vi.hoisted(() => ({
  executeStrictPeriodClose: vi.fn(),
  executeAuditedReopen: vi.fn(),
}));

vi.mock('../../server/services/strictPeriodCloseService', () => ({
  executeStrictPeriodClose: closeMocks.executeStrictPeriodClose,
  StrictPeriodCloseError: class extends Error { statusCode = 400; },
}));

vi.mock('../../server/services/auditedPeriodReopenService', () => ({
  executeAuditedReopen: closeMocks.executeAuditedReopen,
  AuditedReopenError: class extends Error { statusCode = 400; },
}));

vi.mock('../../server/services/statementReconciliationControlService', () => ({
  StatementReconciliationControlError: class extends Error { statusCode = 400; },
}));

import { postStrictPeriodClose } from '../../server/routes/strictPeriodClose';
import { postAuditedPeriodReopen } from '../../server/routes/auditedPeriodReopen';

describe('admin mutation policy — period close routes', () => {
  it('POST /api/reconciliation/statement-periods/:id/close requires admin', async () => {
    const res = makeRes();
    await postStrictPeriodClose(makeViewerRequest({
      ledgerId: 'ledger-1',
      workspaceId: 'ws-1',
      confirmed: true,
    }, { id: 'period-1' }) as any, res as any);
    expect(res.statusCode).toBe(403);
    expect(res.body).toEqual(ADMIN_ONLY_403);
    expect(closeMocks.executeStrictPeriodClose).not.toHaveBeenCalled();
  });

  it('POST /api/reconciliation/period-closes/:id/reopen requires admin', async () => {
    const res = makeRes();
    await postAuditedPeriodReopen(makeViewerRequest({
      reason: 'Correctie nodig',
      workspaceId: 'ws-1',
    }, { id: 'close-1' }) as any, res as any);
    expect(res.statusCode).toBe(403);
    expect(res.body).toEqual(ADMIN_ONLY_403);
    expect(closeMocks.executeAuditedReopen).not.toHaveBeenCalled();
  });
});
