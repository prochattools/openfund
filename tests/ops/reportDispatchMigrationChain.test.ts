import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const schema = readFileSync('prisma/schema.prisma', 'utf8');
const correctiveMigration = readFileSync(
  'prisma/migrations/20260807085500_drop_obsolete_dispatch_identity/migration.sql',
  'utf8',
);

describe('ReportDispatch migration-chain correction', () => {
  it('keeps deliveryKey unique and removes obsolete composite uniqueness from the final schema', () => {
    expect(schema).toContain('deliveryKey       String                    @unique');
    expect(schema).not.toContain('@@unique([reportSnapshotId, recipientHash, contentHash])');
  });

  it('drops the obsolete constraint idempotently', () => {
    expect(correctiveMigration).toContain(
      'DROP CONSTRAINT IF EXISTS "ReportDispatch_unique_dispatch_identity"',
    );
  });

  it('does not modify financial or report data', () => {
    const executableSql = correctiveMigration
      .split('\n')
      .filter((line) => !line.trim().startsWith('--'))
      .join('\n')
      .toUpperCase();

    expect(executableSql).not.toMatch(/\b(UPDATE|DELETE|INSERT|TRUNCATE)\b/);
    expect(executableSql).not.toContain('"TRANSACTION"');
    expect(executableSql).not.toContain('"TRANSACTIONBOOKING"');
    expect(executableSql).not.toContain('"REVIEWDECISION"');
  });
});
