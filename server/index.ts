import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { handleImportUpload, handleMonthlyImportPreviewUpload } from './routes/upload';
import { getLedger } from './routes/ledger';
import {
  activateReviewRuleCreation,
  clearReviewQueue,
  getReviewTransactions,
  previewReviewRuleCreation,
  updateTransactionCategory,
} from './routes/review';
import { listAccounts, lockOpeningBalance, upsertOpeningBalance } from './routes/accounts';
import { getReconciliation } from './routes/reconciliation';
import { lockLedger, unlockLedger } from './routes/ledgers';
import { getReportSummary } from './routes/reports';
import { listAuditLogs } from './routes/audit';
import { downloadImportBatchFile, listImportBatches } from './routes/importBatches';
import { deactivateEmailRecipient, listEmailRecipients, upsertEmailRecipient } from './routes/emailRecipients';
import { getRules, postRule, patchRule, removeRule, previewRule, applyRule } from './routes/rules';
import { getStatementReconciliationPreview } from './routes/statementReconciliationPreview';
import { postStrictPeriodClose } from './routes/strictPeriodClose';
import { postAuditedPeriodReopen } from './routes/auditedPeriodReopen';
import { ensureCategorizationRuleConditionsColumn } from './db/ensureCategorizationRuleConditions';

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

app.use(cors({ origin: process.env.CORS_ORIGIN ?? '*' }));
app.use(express.json());

app.get('/healthz', (_req, res) => {
  res.json({ status: 'ok' });
});

app.post('/api/upload', upload.single('file'), handleImportUpload);
app.post('/api/upload/preview', upload.single('file'), handleMonthlyImportPreviewUpload);
app.get('/api/ledger', getLedger);
app.get('/api/review', getReviewTransactions);
app.post('/api/review/clear', clearReviewQueue);
app.post('/api/review/:id/rule/preview', previewReviewRuleCreation);
app.post('/api/review/:id/rule/activate', activateReviewRuleCreation);
app.patch('/api/transactions/:id/category', updateTransactionCategory);
app.get('/api/accounts', listAccounts);
app.post('/api/accounts/:accountId/opening-balance', upsertOpeningBalance);
app.post('/api/opening-balances/:balanceId/lock', lockOpeningBalance);
app.get('/api/reconciliation', getReconciliation);
app.get('/api/reports/summary', getReportSummary);
app.get('/api/audit-log', listAuditLogs);
app.get('/api/import-batches', listImportBatches);
app.get('/api/import-batches/:id/download', downloadImportBatchFile);
app.get('/api/email-recipients', listEmailRecipients);
app.post('/api/email-recipients', upsertEmailRecipient);
app.delete('/api/email-recipients/:id', deactivateEmailRecipient);
app.post('/api/ledger/:ledgerId/lock', lockLedger);
app.post('/api/ledger/:ledgerId/unlock', unlockLedger);
app.get('/api/rules', getRules);
app.post('/api/rules', postRule);
app.patch('/api/rules/:id', patchRule);
app.delete('/api/rules/:id', removeRule);
app.post('/api/rules/:id/preview', previewRule);
app.post('/api/rules/:id/apply', applyRule);
app.get('/api/reconciliation/statement-periods/:id/preview', getStatementReconciliationPreview);
app.post('/api/reconciliation/statement-periods/:id/close', postStrictPeriodClose);
app.post('/api/reconciliation/period-closes/:id/reopen', postAuditedPeriodReopen);

async function start() {
  try {
    await ensureCategorizationRuleConditionsColumn();
  } catch (err) {
    console.error('[Startup] Continuing without conditions column (rules may fail)', err);
  }

  const port = Number(process.env.API_PORT ?? 4000);
  app.listen(port, () => {
    console.log(`API server listening on port ${port}`);
  });
}

void start();
