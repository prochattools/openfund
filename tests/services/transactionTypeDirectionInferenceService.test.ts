import { describe, expect, it } from 'vitest';
import {
  DIRECTION_INFERENCE_VERSION,
  inferTransactionTypeDirections,
} from '../../server/services/transactionTypeDirectionInferenceService';

const WORKSPACE_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const OTHER_WORKSPACE_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

type FakeType = { id: string; literalName: string; direction: 'credit' | 'debit' | null };
type FakeBooking = { transactionTypeId: string; workspaceId: string; transaction: { direction: 'credit' | 'debit' } };

const makePrisma = (types: FakeType[], bookings: FakeBooking[]) => ({
  transactionType: {
    findMany: async ({ where }: { where: { workspaceId: string } }) =>
      types.filter((t) => {
        void where;
        return true;
      }).map((t) => ({ id: t.id, literalName: t.literalName, direction: t.direction })),
  },
  transactionBooking: {
    findMany: async ({ where }: { where: { workspaceId: string } }) =>
      bookings.filter((b) => b.workspaceId === where.workspaceId),
  },
});

describe('inferTransactionTypeDirections', () => {
  it('classifies a type as unambiguous when all bookings are credit', async () => {
    const db = makePrisma(
      [{ id: 'type-1', literalName: 'Gift', direction: null }],
      [
        { transactionTypeId: 'type-1', workspaceId: WORKSPACE_ID, transaction: { direction: 'credit' } },
        { transactionTypeId: 'type-1', workspaceId: WORKSPACE_ID, transaction: { direction: 'credit' } },
      ],
    );

    const plan = await inferTransactionTypeDirections(db as never, { workspaceId: WORKSPACE_ID });

    expect(plan.counts.unambiguous).toBe(1);
    expect(plan.counts.conflicting).toBe(0);
    const entry = plan.entries.find((e) => e.transactionTypeId === 'type-1')!;
    expect(entry.outcome).toBe('unambiguous');
    expect(entry.proposedDirection).toBe('credit');
    expect(entry.creditCount).toBe(2);
    expect(entry.debitCount).toBe(0);
  });

  it('classifies a type as unambiguous when all bookings are debit', async () => {
    const db = makePrisma(
      [{ id: 'type-2', literalName: 'Kosten', direction: null }],
      [{ transactionTypeId: 'type-2', workspaceId: WORKSPACE_ID, transaction: { direction: 'debit' } }],
    );

    const plan = await inferTransactionTypeDirections(db as never, { workspaceId: WORKSPACE_ID });

    const entry = plan.entries.find((e) => e.transactionTypeId === 'type-2')!;
    expect(entry.outcome).toBe('unambiguous');
    expect(entry.proposedDirection).toBe('debit');
  });

  it('classifies a type as conflicting when bookings span both directions', async () => {
    const db = makePrisma(
      [{ id: 'type-3', literalName: 'Rente', direction: null }],
      [
        { transactionTypeId: 'type-3', workspaceId: WORKSPACE_ID, transaction: { direction: 'credit' } },
        { transactionTypeId: 'type-3', workspaceId: WORKSPACE_ID, transaction: { direction: 'debit' } },
      ],
    );

    const plan = await inferTransactionTypeDirections(db as never, { workspaceId: WORKSPACE_ID });

    const entry = plan.entries.find((e) => e.transactionTypeId === 'type-3')!;
    expect(entry.outcome).toBe('conflicting');
    expect(entry.proposedDirection).toBeNull();
    expect(plan.counts.conflicting).toBe(1);
  });

  it('classifies a type with no bookings and no direction as unknown', async () => {
    const db = makePrisma([{ id: 'type-4', literalName: 'Nieuw', direction: null }], []);

    const plan = await inferTransactionTypeDirections(db as never, { workspaceId: WORKSPACE_ID });

    const entry = plan.entries.find((e) => e.transactionTypeId === 'type-4')!;
    expect(entry.outcome).toBe('unknown');
    expect(entry.proposedDirection).toBeNull();
    expect(plan.counts.unknown).toBe(1);
  });

  it('classifies a type with no bookings but an existing direction as unused', async () => {
    const db = makePrisma([{ id: 'type-5', literalName: 'OudType', direction: 'credit' }], []);

    const plan = await inferTransactionTypeDirections(db as never, { workspaceId: WORKSPACE_ID });

    const entry = plan.entries.find((e) => e.transactionTypeId === 'type-5')!;
    expect(entry.outcome).toBe('unused');
    expect(entry.currentDirection).toBe('credit');
    expect(plan.counts.unused).toBe(1);
  });

  it('is scoped to workspaceId — bookings from another workspace are excluded', async () => {
    const db = makePrisma(
      [{ id: 'type-6', literalName: 'Donatie', direction: null }],
      [
        { transactionTypeId: 'type-6', workspaceId: OTHER_WORKSPACE_ID, transaction: { direction: 'credit' } },
        { transactionTypeId: 'type-6', workspaceId: OTHER_WORKSPACE_ID, transaction: { direction: 'debit' } },
      ],
    );

    const plan = await inferTransactionTypeDirections(db as never, { workspaceId: WORKSPACE_ID });

    const entry = plan.entries.find((e) => e.transactionTypeId === 'type-6')!;
    expect(entry.outcome).toBe('unknown');
    expect(entry.bookingCount).toBe(0);
  });

  it('returns sideEffects.writesPerformed = false', async () => {
    const db = makePrisma([], []);
    const plan = await inferTransactionTypeDirections(db as never, { workspaceId: WORKSPACE_ID });
    expect(plan.sideEffects.writesPerformed).toBe(false);
  });

  it('returns a deterministic planHash for identical inputs', async () => {
    const types: FakeType[] = [
      { id: 'type-7', literalName: 'A', direction: null },
      { id: 'type-8', literalName: 'B', direction: null },
    ];
    const bookings: FakeBooking[] = [
      { transactionTypeId: 'type-7', workspaceId: WORKSPACE_ID, transaction: { direction: 'credit' } },
    ];
    const db = makePrisma(types, bookings);

    const plan1 = await inferTransactionTypeDirections(db as never, { workspaceId: WORKSPACE_ID });
    const plan2 = await inferTransactionTypeDirections(db as never, { workspaceId: WORKSPACE_ID });

    expect(plan1.planHash).toBe(plan2.planHash);
    expect(plan1.planHash).toHaveLength(64);
  });

  it('returns a different planHash when booking distribution changes', async () => {
    const types: FakeType[] = [{ id: 'type-9', literalName: 'C', direction: null }];

    const dbCredit = makePrisma(types, [
      { transactionTypeId: 'type-9', workspaceId: WORKSPACE_ID, transaction: { direction: 'credit' } },
    ]);
    const dbDebit = makePrisma(types, [
      { transactionTypeId: 'type-9', workspaceId: WORKSPACE_ID, transaction: { direction: 'debit' } },
    ]);

    const planCredit = await inferTransactionTypeDirections(dbCredit as never, { workspaceId: WORKSPACE_ID });
    const planDebit = await inferTransactionTypeDirections(dbDebit as never, { workspaceId: WORKSPACE_ID });

    expect(planCredit.planHash).not.toBe(planDebit.planHash);
  });

  it('embeds the algorithmVersion in the result', async () => {
    const db = makePrisma([], []);
    const plan = await inferTransactionTypeDirections(db as never, { workspaceId: WORKSPACE_ID });
    expect(plan.algorithmVersion).toBe(DIRECTION_INFERENCE_VERSION);
  });

  it('counts.total equals the number of entries returned', async () => {
    const db = makePrisma(
      [
        { id: 'ta', literalName: 'A', direction: null },
        { id: 'tb', literalName: 'B', direction: null },
        { id: 'tc', literalName: 'C', direction: 'credit' },
      ],
      [{ transactionTypeId: 'ta', workspaceId: WORKSPACE_ID, transaction: { direction: 'credit' } }],
    );

    const plan = await inferTransactionTypeDirections(db as never, { workspaceId: WORKSPACE_ID });

    expect(plan.counts.total).toBe(3);
    expect(plan.entries).toHaveLength(3);
  });
});
