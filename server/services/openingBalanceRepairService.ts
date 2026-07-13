import type { PrismaClient } from '@prisma/client';
import { createAuditLog } from './auditLogService';
import { DEFAULT_ACCOUNTING_ACCOUNT_IDENTIFIER } from './accountingAuditService';

export const APPROVED_OPENING_BALANCE_MINOR = 172186n;
export const APPROVED_OPENING_BALANCE_DATE = new Date('2024-01-01T00:00:00.000Z');
export const OPENING_BALANCE_REPAIR_VERSION = 'opening-balance-repair-v1';

export type OpeningBalanceRepairStatus =
  | 'WOULD_CREATE'
  | 'CREATED'
  | 'ALREADY_CORRECT'
  | 'CONFLICT'
  | 'ACCOUNT_NOT_FOUND'
  | 'EXECUTION_NOT_ALLOWED'
  | 'CONFIRMATION_REQUIRED';

export type OpeningBalanceRepairResult = {
  status: OpeningBalanceRepairStatus;
  dryRun: boolean;
  writesPerformed: boolean;
  account: {
    id: string;
    identifier: string;
    name: string;
    currency: string;
  } | null;
  approvedControl: {
    effectiveDate: string;
    amountMinor: string;
    currency: 'EUR';
  };
  existing: {
    id: string;
    amountMinor: string;
    effectiveDate: string;
    locked: boolean;
  } | null;
  sideEffects: {
    createsOpeningBalance: boolean;
    createsAuditLog: boolean;
    createsTransactionBooking: false;
    closesPeriod: false;
  };
};

type OpeningBalanceRepairDb = Pick<
  PrismaClient,
  'account' | 'openingBalance' | '$transaction'
>;

export type OpeningBalanceRepairInput = {
  userId: string;
  actorId?: string | null;
  actorEmail?: string | null;
  accountIdentifier?: string;
  execute?: boolean;
  executionAllowed?: boolean;
  confirmApprovedControl?: boolean;
};

const approvedControl = {
  effectiveDate: APPROVED_OPENING_BALANCE_DATE.toISOString(),
  amountMinor: APPROVED_OPENING_BALANCE_MINOR.toString(),
  currency: 'EUR' as const,
};

const toExisting = (existing: {
  id: string;
  amountMinor: bigint;
  effectiveDate: Date;
  lockedAt: Date | null;
} | null) => existing
  ? {
      id: existing.id,
      amountMinor: existing.amountMinor.toString(),
      effectiveDate: existing.effectiveDate.toISOString(),
      locked: Boolean(existing.lockedAt),
    }
  : null;

const result = (
  status: OpeningBalanceRepairStatus,
  dryRun: boolean,
  account: OpeningBalanceRepairResult['account'],
  existing: OpeningBalanceRepairResult['existing'],
  writesPerformed = false,
): OpeningBalanceRepairResult => ({
  status,
  dryRun,
  writesPerformed,
  account,
  approvedControl,
  existing,
  sideEffects: {
    createsOpeningBalance: status === 'CREATED',
    createsAuditLog: status === 'CREATED',
    createsTransactionBooking: false,
    closesPeriod: false,
  },
});

const readState = async (
  db: Pick<PrismaClient, 'account' | 'openingBalance'>,
  userId: string,
  accountIdentifier: string,
) => {
  const account = await db.account.findUnique({
    where: {
      userId_identifier: { userId, identifier: accountIdentifier },
    },
    select: { id: true, identifier: true, name: true, currency: true },
  });
  if (!account) return { account: null, existing: null };

  const existing = await db.openingBalance.findUnique({
    where: {
      accountId_effectiveDate: {
        accountId: account.id,
        effectiveDate: APPROVED_OPENING_BALANCE_DATE,
      },
    },
    select: { id: true, amountMinor: true, effectiveDate: true, lockedAt: true },
  });
  return { account, existing };
};

const classifyState = (
  account: OpeningBalanceRepairResult['account'],
  existing: OpeningBalanceRepairResult['existing'],
): OpeningBalanceRepairStatus => {
  if (!account) return 'ACCOUNT_NOT_FOUND';
  if (!existing) return 'WOULD_CREATE';
  if (existing.amountMinor === APPROVED_OPENING_BALANCE_MINOR.toString()) return 'ALREADY_CORRECT';
  return 'CONFLICT';
};

export const repairApprovedOpeningBalance = async (
  db: OpeningBalanceRepairDb,
  input: OpeningBalanceRepairInput,
): Promise<OpeningBalanceRepairResult> => {
  const accountIdentifier = input.accountIdentifier
    ?? process.env.ACCOUNTING_AUDIT_ACCOUNT_IDENTIFIER?.trim()
    ?? DEFAULT_ACCOUNTING_ACCOUNT_IDENTIFIER;
  const execute = input.execute === true;
  const dryRun = !execute;
  const initial = await readState(db, input.userId, accountIdentifier);
  const initialAccount = initial.account;
  const initialExisting = toExisting(initial.existing);
  const initialStatus = classifyState(initialAccount, initialExisting);

  if (dryRun || initialStatus !== 'WOULD_CREATE') {
    return result(initialStatus, dryRun, initialAccount, initialExisting);
  }
  if (input.executionAllowed !== true) {
    return result('EXECUTION_NOT_ALLOWED', false, initialAccount, initialExisting);
  }
  if (input.confirmApprovedControl !== true) {
    return result('CONFIRMATION_REQUIRED', false, initialAccount, initialExisting);
  }

  try {
    return await db.$transaction(async (tx) => {
      const current = await readState(tx as Pick<PrismaClient, 'account' | 'openingBalance'>, input.userId, accountIdentifier);
      const currentAccount = current.account;
      const currentExisting = toExisting(current.existing);
      const currentStatus = classifyState(currentAccount, currentExisting);
      if (currentStatus !== 'WOULD_CREATE' || !currentAccount) {
        return result(currentStatus, false, currentAccount, currentExisting);
      }

      const created = await tx.openingBalance.create({
        data: {
          accountId: currentAccount.id,
          effectiveDate: APPROVED_OPENING_BALANCE_DATE,
          amountMinor: APPROVED_OPENING_BALANCE_MINOR,
          currency: 'EUR',
          note: 'Goedgekeurde historische openingscontrole 2024; idempotente reparatie.',
          createdBy: input.actorEmail ?? input.actorId ?? 'system',
        },
        select: { id: true, amountMinor: true, effectiveDate: true, lockedAt: true },
      });

      await createAuditLog(tx, {
        userId: input.userId,
        actorId: input.actorId,
        actorEmail: input.actorEmail,
        action: 'opening-balance.approved-control-created',
        entityType: 'OpeningBalance',
        entityId: created.id,
        before: null,
        after: {
          accountId: currentAccount.id,
          effectiveDate: approvedControl.effectiveDate,
          amountMinor: approvedControl.amountMinor,
          currency: approvedControl.currency,
        },
        metadata: {
          repairVersion: OPENING_BALANCE_REPAIR_VERSION,
          accountIdentifier: currentAccount.identifier,
          ownerApprovedControl: true,
        },
      });

      return result('CREATED', false, currentAccount, toExisting(created), true);
    });
  } catch (error) {
    if ((error as { code?: string } | null)?.code !== 'P2002') {
      throw error;
    }

    const concurrent = await readState(db, input.userId, accountIdentifier);
    const concurrentAccount = concurrent.account;
    const concurrentExisting = toExisting(concurrent.existing);
    return result(
      classifyState(concurrentAccount, concurrentExisting),
      false,
      concurrentAccount,
      concurrentExisting,
    );
  }
};
