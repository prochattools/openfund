import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ImportSummary } from '../../lib/import/types';
import { processImportBufferWithClient } from '../../server/services/importService';
import * as categorizationService from '../../server/services/categorizationService';
import * as reconciliationService from '../../server/services/reconciliationService';
import { normalizeDescription } from '../../lib/import/normalizers';
import {
  buildExactMatchIndex,
  buildLedgerMatchCandidates,
  normalizeMatchableTransaction,
  findExactLedgerMatch,
} from '../../server/services/transactionMatching';

type StoredTransaction = {
  id: string;
  userId: string;
  hash: string;
  importFingerprint: string | null;
  amountMinor: bigint;
  source: string;
  sourceFile?: string | null;
  normalizedKey: string;
  date: Date;
  categoryId: string | null;
  accountId?: string | null;
  rawRow?: Record<string, unknown> | null;
  classificationSource?: string;
  classificationRuleId?: string | null;
};

class FakePrismaClient {
  accounts: Array<{ id: string; userId: string; identifier: string; name: string; currency: string }> = [];
  ledgers: Array<{ id: string; userId: string; month: number; year: number; lockedAt: Date | null; lockedBy: string | null }> = [];
  transactions: StoredTransaction[] = [];
  importBatches: Array<{
    id: string;
    userId: string;
    filename?: string;
    fileSizeBytes?: number;
    fileSha256?: string;
    originalFile?: Uint8Array;
  }> = [];
  rules: Array<{ id: string; userId: string; isActive: boolean; priority: number; updatedAt: Date }> = [];
  openingBalances: Array<{ accountId: string; amountMinor: bigint; effectiveDate: Date }> = [];
  categories: Array<{ id: string; name: string }> = [];

  async $transaction<T>(callback: (tx: ReturnType<FakePrismaClient['createTx']>) => Promise<T>): Promise<T> {
    const tx = this.createTx();
    return callback(tx);
  }

  private createTx() {
    const outer = this;
    return {
      account: {
        upsert: async ({ where, update, create }: any) => {
          const existing = this.accounts.find(
            (account) => account.userId === where.userId_identifier.userId && account.identifier === where.userId_identifier.identifier,
          );

          if (existing) {
            existing.name = update.name;
            return existing;
          }

          const record = {
            id: crypto.randomUUID(),
            userId: create.userId,
            identifier: create.identifier,
            name: create.name,
            currency: create.currency,
          };
          this.accounts.push(record);
          this.openingBalances.push({
            accountId: record.id,
            amountMinor: 0n,
            effectiveDate: new Date('2024-01-01T00:00:00Z'),
          });
          return record;
        },
        findFirst: async ({ where }: any) => {
          if (!where?.id || !where?.userId) {
            return null;
          }
          return this.accounts.find(
            (account) => account.id === where.id && account.userId === where.userId,
          ) ?? null;
        },
      },
      ledger: {
        findUnique: async ({ where }: any) => {
          return this.ledgers.find(
            (ledger) =>
              ledger.userId === where.userId_month_year.userId &&
              ledger.month === where.userId_month_year.month &&
              ledger.year === where.userId_month_year.year,
          ) ?? null;
        },
        upsert: async ({ where, create }: any) => {
          const existing = this.ledgers.find(
            (ledger) =>
              ledger.userId === where.userId_month_year.userId &&
              ledger.month === where.userId_month_year.month &&
              ledger.year === where.userId_month_year.year,
          );

          if (existing) {
            return existing;
          }

          const record = {
            id: crypto.randomUUID(),
            userId: create.userId,
            month: create.month,
            year: create.year,
            lockedAt: null as Date | null,
            lockedBy: null as string | null,
          };
          this.ledgers.push(record);
          return record;
        },
        create: async ({ data }: any) => {
          const record = {
            id: crypto.randomUUID(),
            userId: data.userId,
            month: data.month,
            year: data.year,
            lockedAt: null as Date | null,
            lockedBy: null as string | null,
          };
          this.ledgers.push(record);
          return record;
        },
      },
      transaction: {
        findMany: async ({ where, select }: any = {}) => {
          const matches = this.transactions.filter((tx) => {
            if (where?.hash?.in && !where.hash.in.includes(tx.hash)) return false;
            if (where?.userId && tx.userId !== where.userId) return false;
            if (where?.source && tx.source !== where.source) return false;
            if (where?.categoryId?.not === null && tx.categoryId === null) return false;
            if (where?.classificationSource && tx.classificationSource !== where.classificationSource) return false;
            return true;
          });

          return matches.map((tx) => mapSelectedTransaction(tx, select));
        },
        findFirst: async ({ where, orderBy, select }: any) => {
          const matches = this.transactions
            .filter((tx) => {
              if (tx.userId !== where.userId) return false;
              if (where.source && tx.source !== where.source) return false;
              if (where.normalizedKey && tx.normalizedKey !== where.normalizedKey) return false;
              if (where.categoryId?.not === null && tx.categoryId === null) return false;

              if (where.amountMinor) {
                const gte = where.amountMinor.gte as bigint;
                const lte = where.amountMinor.lte as bigint;
                if (tx.amountMinor < gte || tx.amountMinor > lte) {
                  return false;
                }
              }

              return true;
            })
            .sort((a, b) => {
              if (orderBy?.date === 'desc') {
                return b.date.getTime() - a.date.getTime();
              }
              return a.date.getTime() - b.date.getTime();
            });

          const first = matches[0];
          if (!first) return null;

          return mapSelectedTransaction(first, select);
        },
        createMany: async ({ data, skipDuplicates }: any) => {
          let count = 0;
          data.forEach((entry: any) => {
            const exists = this.transactions.find((tx) => tx.hash === entry.hash);
            if (exists && skipDuplicates) {
              return;
            }
            this.transactions.push({
              id: entry.id ?? crypto.randomUUID(),
              userId: entry.userId,
              hash: entry.hash,
              importFingerprint: entry.importFingerprint ?? null,
              amountMinor: BigInt(entry.amountMinor),
              source: entry.source,
              sourceFile: entry.sourceFile ?? null,
              normalizedKey: entry.normalizedKey,
              date: entry.date instanceof Date ? entry.date : new Date(entry.date),
              categoryId: entry.categoryId ?? null,
              accountId: entry.accountId ?? null,
              rawRow: entry.rawRow ?? null,
              classificationSource: entry.classificationSource ?? 'none',
              classificationRuleId: entry.classificationRuleId ?? null,
            });
            count += 1;
          });

          return { count };
        },
        update: async ({ where, data }: any) => {
          const record = this.transactions.find((tx) => tx.id === where.id);
          if (!record) {
            return null;
          }
          if (data.categoryId !== undefined) {
            record.categoryId = data.categoryId;
          }
          if (data.classificationSource) {
            record.classificationSource = data.classificationSource;
          }
          if (data.classificationRuleId !== undefined) {
            record.classificationRuleId = data.classificationRuleId;
          }
          if (data.rawRow !== undefined) {
            record.rawRow = data.rawRow;
          }
          if (data.importFingerprint) {
            record.importFingerprint = data.importFingerprint;
          }
          return record;
        },
      },
      category: {
        findMany: async ({ select }: any = {}) => {
          return this.categories.map((category) => {
            if (!select) {
              return category;
            }
            const record: Record<string, unknown> = {};
            Object.entries(select).forEach(([field, include]) => {
              if (include) {
                record[field] = (category as any)[field];
              }
            });
            return record;
          });
        },
        upsert: async ({ where, create }: any) => {
          const existing = this.categories.find((category) => category.name === where.name);
          if (existing) {
            return existing;
          }
          const record = {
            id: create?.id ?? `category-${where.name}`,
            name: create?.name ?? where.name,
          };
          this.categories.push(record);
          return record;
        },
      },
      importBatch: {
        create: async ({ data }: any) => {
          const record = {
            id: crypto.randomUUID(),
            userId: data.userId,
            filename: data.filename,
            fileSizeBytes: data.fileSizeBytes,
            fileSha256: data.fileSha256,
            originalFile: data.originalFile,
          };
          this.importBatches.push(record);
          return record;
        },
        update: async () => undefined,
      },
      openingBalance: {
        findMany: async ({ where }: any) => {
          const accountId = where?.accountId;
          const effectiveDate = where?.effectiveDate?.lte
            ? new Date(where.effectiveDate.lte)
            : new Date();
          return this.openingBalances
            .filter((entry) => (!accountId || entry.accountId === accountId) && entry.effectiveDate <= effectiveDate)
            .sort((a, b) => a.effectiveDate.getTime() - b.effectiveDate.getTime())
            .map((entry) => ({
              id: crypto.randomUUID(),
              accountId: entry.accountId,
              amountMinor: entry.amountMinor,
              effectiveDate: entry.effectiveDate,
              currency: 'EUR',
              note: null,
              createdBy: 'test',
              createdAt: new Date(),
              lockedAt: null,
              lockedBy: null,
            }));
        },
      },
      categorizationRule: {
        findMany: async () => [],
        update: async () => null,
        create: async () => null,
      },
    };

    function mapSelectedTransaction(record: StoredTransaction, select: any) {
      if (!select) {
        return record;
      }
      const result: Record<string, unknown> = {};
      Object.entries(select).forEach(([field, value]) => {
        if (value === true) {
          (result as any)[field] = (record as any)[field];
          return;
        }
        if (field === 'account' && value && typeof value === 'object' && value.select) {
          const account = outer.accounts.find((acct) => acct.id === record.accountId) ?? null;
          if (!account) {
            result.account = null;
            return;
          }
          const accountSelection: Record<string, unknown> = {};
          Object.entries(value.select).forEach(([acctField, include]) => {
            if (include) {
              accountSelection[acctField] = (account as any)[acctField];
            }
          });
          result.account = accountSelection;
        }
      });

      if (!Object.keys(result).length) {
        return record;
      }
      return result;
    }
  }
}

const csvBuffer = fs.readFileSync(
  path.resolve(__dirname, '../../sheets/NL89INGB0006369960_2025-06-01_2025-06-30.csv'),
);

describe('import pipeline integration', () => {
  let prisma: FakePrismaClient;

  beforeEach(() => {
    prisma = new FakePrismaClient();
    vi.spyOn(reconciliationService, 'validateLedgerBalance').mockResolvedValue({ status: 'ok' } as any);
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  const runImport = (filename: string): Promise<ImportSummary> =>
    processImportBufferWithClient(prisma as any, {
      buffer: csvBuffer,
      filename,
      userId: 'demo-user',
    });

  it('reprocesses pending transactions on re-import without creating duplicates', async () => {
    const categorizeSpy = vi.spyOn(categorizationService, 'categorizeTransaction').mockResolvedValue({
      categoryId: 'cat-initial',
      classificationSource: 'rule',
      ruleId: 'rule-1',
    } as any);

    const first = await runImport('statement.csv');
    expect(first.importedCount).toBeGreaterThan(0);
    expect(prisma.transactions).toHaveLength(first.importedCount);

    categorizeSpy.mockResolvedValue({
      categoryId: 'cat-updated',
      classificationSource: 'rule',
      ruleId: 'rule-2',
    });

    const second = await runImport('statement.csv');
    expect(second.importedCount).toBe(0);
    expect(second.duplicateCount).toBe(0);
    expect(prisma.transactions).toHaveLength(first.importedCount);
    expect(prisma.transactions.every((tx) => typeof tx.importFingerprint === 'string' && tx.importFingerprint.length > 0)).toBe(true);
  });

  it('stores original import file bytes, size, and checksum on the batch', async () => {
    await runImport('statement.csv');

    const batch = prisma.importBatches[0];
    expect(batch).toBeTruthy();
    expect(batch.filename).toBe('statement.csv');
    expect(batch.fileSizeBytes).toBe(csvBuffer.byteLength);
    expect(batch.fileSha256).toBe(crypto.createHash('sha256').update(csvBuffer).digest('hex'));
    expect(Buffer.from(batch.originalFile ?? [])).toEqual(csvBuffer);
  });

  it('preserves manual overrides when re-importing the same CSV', async () => {
    vi.spyOn(categorizationService, 'categorizeTransaction').mockResolvedValue({
      categoryId: 'cat-auto',
      classificationSource: 'rule',
      ruleId: 'rule-1',
    } as any);

    await runImport('statement.csv');
    const manualTx = prisma.transactions[0];
    manualTx.classificationSource = 'manual';
    manualTx.categoryId = 'cat-manual';

    (categorizationService.categorizeTransaction as any).mockResolvedValue({
      categoryId: 'cat-next',
      classificationSource: 'rule',
      ruleId: 'rule-2',
    });

    const second = await runImport('statement.csv');
    expect(second.importedCount).toBe(0);
    expect(manualTx.categoryId).toBe('cat-manual');
    expect(manualTx.classificationSource).toBe('manual');
  });

  it('allows clearing queue and re-importing with updated rules', async () => {
    const categorizeSpy = vi.spyOn(categorizationService, 'categorizeTransaction').mockResolvedValue({
      categoryId: 'cat-first',
      classificationSource: 'rule',
      ruleId: 'rule-1',
    } as any);

    const first = await runImport('statement.csv');
    expect(prisma.transactions).toHaveLength(first.importedCount);

    // Simulate clearing review queue
    prisma.transactions = [];

    categorizeSpy.mockResolvedValue({
      categoryId: 'cat-second',
      classificationSource: 'rule',
      ruleId: 'rule-2',
    });

    const second = await runImport('statement.csv');
    expect(second.importedCount).toBe(first.importedCount);
    expect(prisma.transactions).toHaveLength(first.importedCount);
  });

  it('auto categorizes new imports when matching ledger history exists', async () => {
    await runImport('seed.csv');
    const template =
      prisma.transactions.find(
        (tx) => typeof tx.rawRow === 'object' && tx.rawRow !== null && (tx.rawRow as Record<string, any>).columns?.Counterparty,
      ) ?? prisma.transactions[0];
    expect(template).toBeTruthy();
    template!.classificationSource = 'manual';
    template!.categoryId = 'cat-history';

    const columns = (template!.rawRow as Record<string, any>).columns ?? {};
    const accountRecord = prisma.accounts.find((acct) => acct.id === template!.accountId);
    const accountIdentifier = columns.Account ?? accountRecord?.identifier ?? '';
    const templateDirection = (template!.direction ?? 'credit').toLowerCase();
    const isDebit = templateDirection === 'debit';
    const absoluteMinor = template!.amountMinor < 0n ? template!.amountMinor * -1n : template!.amountMinor;
    const description = columns['Name / Description'] ?? template!.description ?? '';
    const counterparty = columns.Counterparty ?? '';
    const code = columns.Code ?? '';
    const debitCredit = columns['Debit/credit'] ?? (isDebit ? 'Debit' : 'Credit');
    const amount = columns['Amount (EUR)'] ?? String(Number(absoluteMinor) / 100);
    const transactionType = columns['Transaction type'] ?? 'Online Banking';
    const notifications = columns.Notifications ?? '';

    const amountMinorNormalized = BigInt(Math.round(Number(String(amount).replace(',', '.')) * 100));

    const ledgerCandidates = buildLedgerMatchCandidates([
      {
        transactionId: template!.id,
        categoryId: 'cat-history',
        description,
        amountMinor: template!.amountMinor,
        direction: templateDirection === 'debit' ? 'debit' : 'credit',
        accountIdentifier,
        counterparty,
        raw: template!.rawRow ?? null,
        createdAt: template!.date,
      },
    ]);
    const ledgerNormalized = normalizeMatchableTransaction({
      description,
      amountMinor: template!.amountMinor,
      direction: templateDirection === 'debit' ? 'debit' : 'credit',
      accountIdentifier,
      counterparty,
      raw: template!.rawRow ?? null,
    });
    const normalizedMatcher = normalizeMatchableTransaction({
      description,
      amountMinor: isDebit ? amountMinorNormalized * -1n : amountMinorNormalized,
      direction: isDebit ? 'debit' : 'credit',
      accountIdentifier,
      counterparty,
      notifications,
    });
    expect(ledgerNormalized).not.toBeNull();
    expect(normalizedMatcher).not.toBeNull();
    expect(findExactLedgerMatch(normalizedMatcher!, buildExactMatchIndex(ledgerCandidates))).toBeTruthy();

    const csvContent = [
      'Account;Name / Description;Counterparty;Code;Date;Debit/credit;Amount (EUR);Transaction type;Notifications',
      `${accountIdentifier};${description};${counterparty};${code};31-10-2025;${debitCredit};${amount};${transactionType};"${notifications}"`,
    ].join('\n');

    const summary = await processImportBufferWithClient(prisma as any, {
      buffer: Buffer.from(csvContent, 'utf-8'),
      filename: 'match.csv',
      userId: 'demo-user',
    });

    expect(summary.importedCount).toBe(1);
    const inserted = prisma.transactions.find((tx) => tx.sourceFile === 'match.csv');
    expect(inserted).toBeTruthy();
    expect(inserted?.categoryId).toBe('cat-history');
    const suggestion = (inserted?.rawRow as Record<string, any>)?.suggestion;
    expect(suggestion?.confidence).toBeDefined();
    expect(suggestion?.confidence).not.toBe('review');
  });

  it('suggests history-based categories when only account and counterparty match', async () => {
    prisma.categories.push({ id: 'cat-history', name: 'Inkomsten — Tienden' });
    await runImport('seed.csv');
    const template =
      prisma.transactions.find(
        (tx) => typeof tx.rawRow === 'object' && tx.rawRow !== null && (tx.rawRow as Record<string, any>).columns?.Counterparty,
      ) ?? prisma.transactions[0];
    expect(template).toBeTruthy();
    template!.classificationSource = 'manual';
    template!.categoryId = 'cat-history';

    const columns = (template!.rawRow as Record<string, any>).columns ?? {};
    const accountRecord = prisma.accounts.find((acct) => acct.id === template!.accountId);
    const accountIdentifier = columns.Account ?? accountRecord?.identifier ?? '';
    const templateDirection = (template!.direction ?? 'credit').toLowerCase();
    const isDebit = templateDirection === 'debit';
    const absoluteMinor = template!.amountMinor < 0n ? template!.amountMinor * -1n : template!.amountMinor;
    const counterparty = columns.Counterparty ?? '';
    const code = columns.Code ?? '';
    const debitCredit = columns['Debit/credit'] ?? (isDebit ? 'Debit' : 'Credit');
    const amount = columns['Amount (EUR)'] ?? String(Number(absoluteMinor) / 100);
    const transactionType = columns['Transaction type'] ?? 'Online Banking';

    const csvContent = [
      'Account;Name / Description;Counterparty;Code;Date;Debit/credit;Amount (EUR);Transaction type;Notifications',
      `${accountIdentifier};Completely different description;${counterparty};${code};01-11-2025;${debitCredit};${amount};${transactionType};"History guess"`,
    ].join('\n');

    const summary = await processImportBufferWithClient(prisma as any, {
      buffer: Buffer.from(csvContent, 'utf-8'),
      filename: 'history-guess.csv',
      userId: 'demo-user',
    });

    expect(summary.importedCount).toBe(1);
    const inserted = prisma.transactions.find((tx) => tx.sourceFile === 'history-guess.csv');
    expect(inserted).toBeTruthy();
    expect(inserted?.categoryId).toBe('cat-history');
    const suggestion = (inserted?.rawRow as Record<string, any>)?.suggestion;
    expect(suggestion?.confidence).toBe('fuzzy');
    expect(suggestion?.categoryName).toBe('Tienden');
  });

  it('falls back to direction defaults when no ledger history exists', async () => {
    const creditCsv = [
      'Account;Name / Description;Counterparty;Code;Date;Debit/credit;Amount (EUR);Transaction type;Notifications',
      'NL89INGB0006369960;Support gift;Donor One;AB12;05-11-2025;Credit;250.00;Online Banking;New income',
    ].join('\n');

    const creditSummary = await processImportBufferWithClient(prisma as any, {
      buffer: Buffer.from(creditCsv, 'utf-8'),
      filename: 'no-history-credit.csv',
      userId: 'demo-user',
    });

    expect(creditSummary.importedCount).toBe(1);
    expect(creditSummary.autoCategorizedCount).toBe(0);
    expect(creditSummary.pendingReviewCount).toBe(1);

    const creditTx = prisma.transactions.find((tx) => tx.sourceFile === 'no-history-credit.csv');
    expect(creditTx).toBeTruthy();
    const creditSuggestion = (creditTx?.rawRow as Record<string, any>)?.suggestion;
    expect(creditSuggestion?.categoryName).toBe('Tienden');
    expect(creditSuggestion?.confidence).toBe('fuzzy');

    const debitCsv = [
      'Account;Name / Description;Counterparty;Code;Date;Debit/credit;Amount (EUR);Transaction type;Notifications',
      'NL89INGB0006369960;New vendor purchase;Vendor One;XY34;06-11-2025;Debit;175.00;Card Payment;Project expense',
    ].join('\n');

    await processImportBufferWithClient(prisma as any, {
      buffer: Buffer.from(debitCsv, 'utf-8'),
      filename: 'no-history-debit.csv',
      userId: 'demo-user',
    });

    const debitTx = prisma.transactions.find((tx) => tx.sourceFile === 'no-history-debit.csv');
    expect(debitTx).toBeTruthy();
    const debitSuggestion = (debitTx?.rawRow as Record<string, any>)?.suggestion;
    expect(debitSuggestion?.categoryName).toBe('Blessings diversen');
    expect(debitSuggestion?.confidence).toBe('fuzzy');
  });
});
