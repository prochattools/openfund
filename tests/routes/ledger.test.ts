import { describe, expect, it } from 'vitest';
import { serializeLedgerSnapshot } from '../../server/routes/ledger';

describe('ledger route helpers', () => {
  it('serializes locked ledger snapshots with ISO timestamps', () => {
    expect(serializeLedgerSnapshot({
      id: 'ledger-1',
      month: 5,
      year: 2026,
      lockedAt: new Date('2026-05-31T22:00:00.000Z'),
      lockedBy: 'admin-1',
      lockNote: 'Maand gecontroleerd',
    })).toEqual({
      id: 'ledger-1',
      month: 5,
      year: 2026,
      lockedAt: '2026-05-31T22:00:00.000Z',
      lockedBy: 'admin-1',
      lockNote: 'Maand gecontroleerd',
    });
  });

  it('serializes unlocked ledger snapshots with null lock fields', () => {
    expect(serializeLedgerSnapshot({
      id: 'ledger-2',
      month: 6,
      year: 2026,
      lockedAt: null,
      lockedBy: null,
      lockNote: null,
    })).toEqual({
      id: 'ledger-2',
      month: 6,
      year: 2026,
      lockedAt: null,
      lockedBy: null,
      lockNote: null,
    });
  });
});
