import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const readRepoFile = (relativePath: string): string =>
  fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');

const schema = readRepoFile('prisma/schema.prisma');
const migrationPath =
  'prisma/migrations/20260719095000_add_merchant_knowledge/migration.sql';
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

const runtimeFiles = [
  ...fs.readdirSync(path.join(process.cwd(), 'server/services'))
    .filter((name) => name.endsWith('.ts'))
    .map((name) => `server/services/${name}`),
  ...fs.readdirSync(path.join(process.cwd(), 'server/routes'))
    .filter((name) => name.endsWith('.ts'))
    .map((name) => `server/routes/${name}`),
  'src/libs/api.ts',
].map(readRepoFile).join('\n');

describe('Merchant Knowledge additive schema', () => {
  it('defines every approved model and supporting enum', () => {
    const models = [
      'Merchant',
      'MerchantAlias',
      'MerchantFingerprint',
      'MerchantResolution',
      'MerchantConflict',
      'MerchantIdentityDecision',
      'MerchantAuditEvent',
      'MerchantBackfillRun',
      'MerchantBackfillResult',
    ];
    const enums = [
      'MerchantStatus',
      'MerchantKnowledgeSignalType',
      'MerchantAliasStatus',
      'MerchantFingerprintStatus',
      'MerchantFingerprintStrength',
      'MerchantResolutionStatus',
      'MerchantConflictStatus',
      'MerchantIdentityDecisionAction',
      'MerchantBackfillRunStatus',
    ];

    for (const model of models) expect(modelBlock(model)).toContain('workspaceId');
    for (const enumName of enums) expect(enumBlock(enumName)).toBeTruthy();
  });

  it('keeps Merchant identity separate from accounting defaults', () => {
    const merchant = modelBlock('Merchant');
    expect(merchant).not.toMatch(/projectId|transactionTypeId|categoryId/);
    expect(merchant).toMatch(/status\s+MerchantStatus\s+@default\(PROPOSED\)/);
    expect(merchant).toMatch(/mergedIntoMerchantId\s+String\?/);
    expect(merchant).toMatch(/onDelete: Restrict/);
  });

  it('uses restrictive evidence relations and append-only history models', () => {
    expect(modelBlock('MerchantResolution')).toMatch(/generatedAt\s+DateTime\s+@default\(now\(\)\)/);
    expect(modelBlock('MerchantAuditEvent')).toMatch(/createdAt\s+DateTime\s+@default\(now\(\)\)/);
    expect(modelBlock('MerchantAuditEvent')).not.toMatch(/updatedAt|deletedAt/);
    expect(modelBlock('MerchantIdentityDecision')).toMatch(/beforeState\s+Json/);
    expect(modelBlock('MerchantIdentityDecision')).toMatch(/afterState\s+Json/);
    expect(schema).toMatch(/MerchantResolution[\s\S]*onDelete: Restrict/);
    expect(schema).toMatch(/MerchantConflict[\s\S]*onDelete: Restrict/);
  });

  it('keeps drift-sensitive Prisma declarations aligned with PostgreSQL-safe migration names', () => {
    const alignedIndexes = [
      ['@@unique([workspaceId, sourceTransactionId, signalType, extractionVersion, valueHash])', 'MerchantFingerprint_workspaceId_sourceTransactionId_signalT_key'],
      ['@@unique([workspaceId, transactionId, engineVersion, inputHash])', 'MerchantResolution_workspaceId_transactionId_engineVersion__key'],
      ['@@index([workspaceId, merchantId, status, generatedAt])', 'MerchantResolution_workspaceId_merchantId_status_generatedA_idx'],
      ['@@index([workspaceId, entityType, entityId, createdAt])', 'MerchantAuditEvent_workspaceId_entityType_entityId_createdA_idx'],
      ['@@index([workspaceId, resolutionStatus, knownMerchant])', 'MerchantBackfillResult_workspaceId_resolutionStatus_knownMe_idx'],
      ['@@index([workspaceId, conflictDetected, fingerprintCollision])', 'MerchantBackfillResult_workspaceId_conflictDetected_fingerp_idx'],
    ] as const;

    for (const [declaration, migrationName] of alignedIndexes) {
      expect(schema).toContain(declaration);
      expect(migration).toContain(`"${migrationName}"`);
    }
  });

  it('creates only additive enums, tables, indexes, and foreign keys', () => {
    expect(migration).toContain('CREATE TABLE "Merchant"');
    expect(migration).toContain('CREATE TABLE "MerchantAuditEvent"');
    expect(migration).not.toMatch(/\bDROP\b/i);
    expect(migration).not.toMatch(/\bRENAME\b/i);
    expect(migration).not.toMatch(/\bINSERT\s+INTO\b/i);
    expect(migration).not.toMatch(/\bUPDATE\s+"(?:Transaction|TransactionBooking|ReviewDecision|CategorizationSuggestion)"/i);
    expect(migration).not.toMatch(/\bDELETE\s+FROM\b/i);
  });

  it('defines the approved PostgreSQL partial unique indexes', () => {
    expect(migration).toContain('MerchantAlias_active_workspace_signal_value_key');
    expect(migration).toContain('WHERE "status" IN (\'APPROVED\', \'TRUSTED\') AND "deprecatedAt" IS NULL');
    expect(migration).toContain('MerchantFingerprint_active_strong_workspace_signal_value_key');
    expect(migration).toContain('WHERE "status" = \'MATCHED\' AND "strength" = \'STRONG\' AND "deprecatedAt" IS NULL');
    expect(migration).toContain('MerchantConflict_open_workspace_transaction_key');
    expect(migration).toContain('WHERE "status" = \'OPEN\'');
  });

  it('keeps workspace scope in uniqueness and lookup indexes', () => {
    expect(migration).toContain('ON "MerchantAlias"("workspaceId", "signalType", "valueHash")');
    expect(migration).toContain('ON "MerchantFingerprint"("workspaceId", "signalType", "valueHash")');
    expect(migration).toContain('ON "MerchantConflict"("workspaceId", "transactionId", "conflictKey")');
    expect(modelBlock('MerchantBackfillRun')).toMatch(/@@unique\(\[workspaceId, runKey\]\)/);
  });

  it('does not let application services consume the new Prisma delegates yet', () => {
    const forbiddenDelegates = [
      'prisma.merchant.',
      'prisma.merchantAlias.',
      'prisma.merchantFingerprint.',
      'prisma.merchantResolution.',
      'prisma.merchantConflict.',
      'prisma.merchantIdentityDecision.',
      'prisma.merchantAuditEvent.',
      'prisma.merchantBackfillRun.',
      'prisma.merchantBackfillResult.',
    ];

    for (const delegate of forbiddenDelegates) expect(runtimeFiles).not.toContain(delegate);
  });
});
