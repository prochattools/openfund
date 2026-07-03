import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const readRepoFile = (relativePath: string): string =>
  fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');

const schema = readRepoFile('prisma/schema.prisma');
const migrationPath =
  'prisma/migrations/20260703193000_add_classification_records/migration.sql';
const migration = readRepoFile(migrationPath);

const modelBlock = (name: string): string => {
  const match = schema.match(new RegExp(`model ${name} \\{[\\s\\S]*?\\n\\}`));
  if (!match) throw new Error(`Missing model ${name}`);
  return match[0];
};

const enumBlock = (name: string): string => {
  const match = schema.match(new RegExp(`enum ${name} \\{[\\s\\S]*?\\n\\}`));
  if (!match) throw new Error(`Missing enum ${name}`);
  return match[0];
};

describe('MODEL-003 additive classification records', () => {
  it('adds the approved enums without changing legacy classification source values', () => {
    expect(enumBlock('BookingSource')).toContain('HISTORICAL');
    expect(enumBlock('BookingSource')).toContain('RULE');
    expect(enumBlock('BookingSource')).toContain('MANUAL');
    expect(enumBlock('SuggestionConfidence')).toContain('EXACT_FALLBACK');
    expect(enumBlock('SuggestionMatcher')).toContain('RULE_CANDIDATE');
    expect(enumBlock('SuggestionStatus')).toContain('PENDING');
    expect(enumBlock('SuggestionStatus')).toContain('EXPIRED');
    expect(enumBlock('ReviewDecisionAction')).toContain('ACCEPT_SUGGESTION');
    expect(enumBlock('ReviewDecisionAction')).toContain('REMOVE_BOOKING');

    const legacySource = enumBlock('TransactionClassificationSource');
    expect(legacySource).toContain('none');
    expect(legacySource).toContain('rule');
    expect(legacySource).toContain('history');
    expect(legacySource).toContain('import');
    expect(legacySource).toContain('manual');
  });

  it('models TransactionBooking as one current final three-dimension booking per transaction', () => {
    const booking = modelBlock('TransactionBooking');

    expect(booking).toMatch(/transactionId\s+String\s+@unique/);
    expect(booking).toMatch(/projectId\s+String\b/);
    expect(booking).toMatch(/transactionTypeId\s+String\b/);
    expect(booking).toMatch(/categoryId\s+String\b/);
    expect(booking).toMatch(/source\s+BookingSource/);
    expect(booking).toMatch(/evidence\s+Json/);
    expect(booking).toMatch(/evidenceHash\s+String/);
    expect(booking).toMatch(/literalProjectLabel\s+String/);
    expect(booking).toMatch(/literalTypeLabel\s+String/);
    expect(booking).toMatch(/literalCategoryLabel\s+String/);
    expect(booking).toMatch(/@@index\(\[workspaceId, source, confirmedAt\]\)/);
    expect(booking).toMatch(/@@index\(\[transactionId, evidenceHash\]\)/);
  });

  it('models CategorizationSuggestion as ranked non-final evidence', () => {
    const suggestion = modelBlock('CategorizationSuggestion');

    expect(suggestion).toMatch(/projectId\s+String\?/);
    expect(suggestion).toMatch(/transactionTypeId\s+String\?/);
    expect(suggestion).toMatch(/categoryId\s+String\?/);
    expect(suggestion).toMatch(/confidence\s+SuggestionConfidence/);
    expect(suggestion).toMatch(/matcher\s+SuggestionMatcher/);
    expect(suggestion).toMatch(/rank\s+Int/);
    expect(suggestion).toMatch(/scoreBasisPoints\s+Int\?/);
    expect(suggestion).toMatch(/evidence\s+Json/);
    expect(suggestion).toMatch(/status\s+SuggestionStatus\s+@default\(PENDING\)/);
    expect(suggestion).toMatch(/resolvedAt\s+DateTime\?/);
    expect(suggestion).toMatch(/@@index\(\[workspaceId, transactionId, status, rank\]\)/);
    expect(suggestion).toMatch(/@@index\(\[transactionId, matcher, evidenceHash\]\)/);
  });

  it('models ReviewDecision as immutable administrator decision history', () => {
    const decision = modelBlock('ReviewDecision');

    expect(decision).toMatch(/action\s+ReviewDecisionAction/);
    expect(decision).toMatch(/beforeBookingId\s+String\?/);
    expect(decision).toMatch(/afterBookingId\s+String\?/);
    expect(decision).toMatch(/beforeProjectId\s+String\?/);
    expect(decision).toMatch(/afterProjectId\s+String\?/);
    expect(decision).toMatch(/beforeTypeId\s+String\?/);
    expect(decision).toMatch(/afterTypeId\s+String\?/);
    expect(decision).toMatch(/beforeCategoryId\s+String\?/);
    expect(decision).toMatch(/afterCategoryId\s+String\?/);
    expect(decision).toMatch(/actorId\s+String\b/);
    expect(decision).toMatch(/actorEmail\s+String\?/);
    expect(decision).toMatch(/evidence\s+Json/);
    expect(decision).toMatch(/evidenceHash\s+String/);
    expect(decision).toMatch(/@@index\(\[workspaceId, transactionId, decidedAt\]\)/);
    expect(decision).toMatch(/@@index\(\[workspaceId, actorId, decidedAt\]\)/);
    expect(decision).toMatch(/@@index\(\[workspaceId, action, decidedAt\]\)/);
  });

  it('keeps legacy transaction classification fields during the additive compatibility phase', () => {
    const transaction = modelBlock('Transaction');

    expect(transaction).toMatch(/categoryId\s+String\?/);
    expect(transaction).toMatch(/projectId\s+String\?/);
    expect(transaction).toMatch(/transactionTypeId\s+String\?/);
    expect(transaction).toMatch(/classificationSource\s+TransactionClassificationSource\s+@default\(none\)/);
    expect(transaction).toMatch(/classificationRuleId\s+String\?/);
    expect(transaction).toMatch(/transactionBooking\s+TransactionBooking\?/);
    expect(transaction).toMatch(/categorizationSuggestions\s+CategorizationSuggestion\[\]/);
    expect(transaction).toMatch(/reviewDecisions\s+ReviewDecision\[\]/);
  });

  it('ships an additive migration with no data import or destructive changes', () => {
    expect(migration).toContain('CREATE TYPE "BookingSource"');
    expect(migration).toContain('CREATE TYPE "SuggestionConfidence"');
    expect(migration).toContain('CREATE TYPE "SuggestionMatcher"');
    expect(migration).toContain('CREATE TYPE "SuggestionStatus"');
    expect(migration).toContain('CREATE TYPE "ReviewDecisionAction"');
    expect(migration).toContain('CREATE TABLE "TransactionBooking"');
    expect(migration).toContain('CREATE TABLE "CategorizationSuggestion"');
    expect(migration).toContain('CREATE TABLE "ReviewDecision"');
    expect(migration).toContain('CREATE UNIQUE INDEX "TransactionBooking_transactionId_key"');
    expect(migration).toContain('ALTER TABLE "ReviewDecision" ADD CONSTRAINT "ReviewDecision_suggestionId_fkey"');

    expect(migration).not.toMatch(/DROP\s+(TABLE|COLUMN|TYPE|INDEX)/i);
    expect(migration).not.toMatch(/ALTER\s+TABLE\s+"Transaction"\s+DROP/i);
    expect(migration).not.toMatch(/ALTER\s+TABLE\s+"Transaction"\s+ALTER/i);
    expect(migration).not.toMatch(/INSERT\s+INTO/i);
    expect(migration).not.toMatch(/UPDATE\s+"?Transaction"?/i);
    expect(migration).not.toMatch(/DELETE\s+FROM/i);
  });
});
