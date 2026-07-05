import { describe, expect, it } from 'vitest';
import {
  activateRuleCreation,
  previewRuleCreation,
  RuleCreationError,
  type RuleCreationCondition,
} from '../../server/services/ruleCreationService';

const workspaceId = '00000000-0000-4000-8000-000000000001';

const conditions: RuleCreationCondition[] = [
  { field: 'paymentPurpose', matchType: 'contains', value: 'Gift voor mei' },
  { field: 'counterparty', matchType: 'contains', value: 'Donor A' },
];

const makeTransaction = (overrides: Record<string, any> = {}) => ({
  id: 'tx-1',
  userId: 'user-1',
  description: 'Donor A',
  normalizedKey: 'donor a',
  source: 'ING CSV',
  counterparty: 'Donor A',
  reference: 'Gift voor mei',
  amountMinor: 5000n,
  rawRow: { Notifications: 'Gift voor mei' },
  projectId: 'project-1',
  transactionTypeId: 'type-1',
  categoryId: 'cat-1',
  classificationSource: 'manual',
  transactionBooking: {
    id: 'booking-1',
    projectId: 'project-1',
    transactionTypeId: 'type-1',
    categoryId: 'cat-1',
  },
  ...overrides,
});

const makeDb = (overrides: Record<string, any> = {}) => {
  const calls: any[] = [];
  const transaction = overrides.transaction ?? makeTransaction();
  const candidateTransactions = overrides.candidateTransactions ?? [transaction];
  const activeRules = overrides.activeRules ?? [];
  const project = overrides.project ?? { id: 'project-1', workspaceId, name: 'Yeshua Academy' };
  const transactionType = overrides.transactionType ?? { id: 'type-1', workspaceId, literalName: 'Schenking in' };
  const category = overrides.category ?? { id: 'cat-1', workspaceId, name: 'Giften' };

  const db = {
    transaction: {
      findFirst: async (args: any) => {
        calls.push({ model: 'transaction', method: 'findFirst', args });
        return transaction;
      },
      findMany: async (args: any) => {
        calls.push({ model: 'transaction', method: 'findMany', args });
        return candidateTransactions;
      },
    },
    reviewDecision: {
      findFirst: async (args: any) => {
        calls.push({ model: 'reviewDecision', method: 'findFirst', args });
        return overrides.reviewDecision ?? null;
      },
    },
    project: {
      findUnique: async (args: any) => {
        calls.push({ model: 'project', method: 'findUnique', args });
        return project;
      },
    },
    transactionType: {
      findUnique: async (args: any) => {
        calls.push({ model: 'transactionType', method: 'findUnique', args });
        return transactionType;
      },
    },
    category: {
      findUnique: async (args: any) => {
        calls.push({ model: 'category', method: 'findUnique', args });
        return category;
      },
    },
    categorizationRule: {
      findMany: async (args: any) => {
        calls.push({ model: 'categorizationRule', method: 'findMany', args });
        return activeRules;
      },
      create: async (args: any) => {
        calls.push({ model: 'categorizationRule', method: 'create', args });
        return {
          id: 'rule-1',
          userId: args.data.userId,
          ...args.data,
        };
      },
    },
  } as any;

  return { calls, db };
};

const baseInput = {
  actor: {
    userId: 'user-1',
    role: 'admin' as const,
    actorId: 'actor-1',
    actorEmail: 'finance@example.test',
  },
  transactionId: 'tx-1',
  projectId: 'project-1',
  transactionTypeId: 'type-1',
  categoryId: 'cat-1',
  label: 'Giften Donor A',
  conditions,
  confidence: 'exact',
};

describe('rule creation service', () => {
  it('previews an explicit rule from an approved decision without writing bookings or rules', async () => {
    const { calls, db } = makeDb();

    const preview = await previewRuleCreation(db, baseInput);

    expect(preview).toMatchObject({
      transactionId: 'tx-1',
      label: 'Giften Donor A',
      activationAllowed: true,
      rejectionReasons: [],
      expected: {
        projectId: 'project-1',
        projectLabel: 'Yeshua Academy',
        transactionTypeId: 'type-1',
        transactionTypeLabel: 'Schenking in',
        categoryId: 'cat-1',
        categoryLabel: 'Giften',
      },
      matchedTransactionIds: ['tx-1'],
      sideEffects: {
        createsTransactionBooking: false,
        closesPeriod: false,
      },
    });
    expect(preview.previewHash).toHaveLength(64);
    expect(calls.some((call) => call.method === 'create')).toBe(false);
    expect(calls.some((call) => call.model === 'transactionBooking')).toBe(false);
  });

  it('activates exactly one safe rule only after explicit confirmation with the current preview hash', async () => {
    const { calls, db } = makeDb();
    const preview = await previewRuleCreation(db, baseInput);

    const result = await activateRuleCreation(db, {
      ...baseInput,
      previewHash: preview.previewHash,
      explicitConfirmation: true,
    });

    const createCall = calls.filter((call) => call.model === 'categorizationRule' && call.method === 'create');
    expect(createCall).toHaveLength(1);
    expect(createCall[0].args.data).toMatchObject({
      userId: 'user-1',
      categoryId: 'cat-1',
      label: 'Giften Donor A',
      isActive: true,
      createdBy: 'finance@example.test',
      conditions,
    });
    expect(result.sideEffects).toEqual({
      createsTransactionBooking: false,
      closesPeriod: false,
    });
    expect(calls.some((call) => call.model === 'transactionBooking')).toBe(false);
  });

  it('rejects broad or ambiguous rules before activation', async () => {
    const { calls, db } = makeDb({
      candidateTransactions: [
        makeTransaction(),
        makeTransaction({
          id: 'tx-2',
          description: 'Donor A',
          rawRow: { Notifications: 'Gift voor mei' },
          transactionBooking: {
            id: 'booking-2',
            projectId: 'project-2',
            transactionTypeId: 'type-1',
            categoryId: 'cat-1',
          },
        }),
      ],
    });

    const preview = await previewRuleCreation(db, {
      ...baseInput,
      conditions: [
        { field: 'description', matchType: 'regex', value: '.*' },
      ],
    });

    expect(preview.activationAllowed).toBe(false);
    expect(preview.rejectionReasons).toContain('De regelvoorwaarde is te breed om veilig te activeren.');
    expect(preview.rejectionReasons).toContain('De regel matcht transacties met een andere Klant, Type of Categorie.');
    expect(calls.some((call) => call.method === 'create')).toBe(false);
  });

  it('rejects conflicting existing active rules and stale activation hashes', async () => {
    const { db } = makeDb({
      activeRules: [{
        id: 'rule-conflict',
        userId: 'user-1',
        importBatchId: null,
        ledgerId: null,
        categoryId: 'cat-other',
        label: 'Andere regel',
        pattern: 'Gift voor mei',
        matchType: 'contains',
        matchField: 'description',
        conditions: [{ field: 'paymentPurpose', matchType: 'contains', value: 'Gift voor mei' }],
        priority: 100,
        isActive: true,
        createdBy: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastMatchedAt: null,
      }],
    });

    const preview = await previewRuleCreation(db, baseInput);

    expect(preview.activationAllowed).toBe(false);
    expect(preview.rejectionReasons).toContain('Er bestaat al een actieve regel die dezelfde transactie anders categoriseert.');
    await expect(activateRuleCreation(db, {
      ...baseInput,
      previewHash: 'stale',
      explicitConfirmation: true,
    })).rejects.toMatchObject({ statusCode: 409 });
  });

  it('rejects viewer actors before reading or writing data', async () => {
    const { calls, db } = makeDb();

    await expect(previewRuleCreation(db, {
      ...baseInput,
      actor: { userId: 'user-1', role: 'viewer' },
    })).rejects.toBeInstanceOf(RuleCreationError);

    expect(calls).toHaveLength(0);
  });
});
