/**
 * Read-only best-prefill comparison with owner-history-v2 dry-run projection.
 *
 * Uses exact same policy implementation as production (imported from reviewQueueService).
 * Invokes dry-run owner-history-v2 proposal plan in-memory.
 * Outputs aggregate counts only — no PII, no transaction IDs, no credentials.
 *
 * Safety guards:
 *   - Does NOT mutate any suggestion, booking, or decision
 *   - Uses buildReviewQueueTransactionWhere for production-parity cohort
 *   - Requires DEFAULT_WORKSPACE_ID and DEFAULT_USER_ID — fails closed if absent
 *   - Resolves workspaceId via exact env var, not findFirst()
 *   - Exits 1 if DATABASE_URL or env assertions fail
 *   - Exits 1 if --expected-total / --expected-complete-prefills / --expected-none assertions fail
 */

import { loadEnvConfig } from '@next/env';
import { PrismaClient } from '@prisma/client';
import { buildOwnerHistoryProposalPlan } from '../services/ownerHistoryProposalEvidenceService';
import {
  checkPrefillEligibility,
  classifyProducerTier,
  selectReviewPrefill,
  buildReviewQueueTransactionWhere,
  type ReviewEvidenceAlternative,
  type ReviewPrefillSelectionInput,
  type ReviewPrefillTrustedContext,
  OWNER_HISTORY_PRODUCER_KEY,
  OWNER_HISTORY_PRODUCER_VERSION,
} from '../services/reviewQueueService';

type ValidateDatabaseUrlResult = { valid: true } | { valid: false; errorCode: string };

const validateDatabaseUrl = (url: string | undefined): ValidateDatabaseUrlResult => {
  if (!url) {
    return { valid: false, errorCode: 'DATABASE_URL_MISSING' };
  }
  try {
    const parsed = new URL(url);
    const failures: string[] = [];
    if (!['postgresql:', 'postgres:'].includes(parsed.protocol)) failures.push('protocol must be postgresql');
    if (parsed.username !== 'finance_user') failures.push('username must be finance_user');
    if (parsed.pathname !== '/finance') failures.push('database must be /finance');
    if (parsed.port !== '5433') failures.push('port must be 5433');
    if (parsed.searchParams.get('schema') !== 'finance') failures.push('schema must be finance');
    if (failures.length > 0) {
      return { valid: false, errorCode: 'DATABASE_URL_INVALID' };
    }
    return { valid: true };
  } catch {
    return { valid: false, errorCode: 'DATABASE_URL_UNPARSEABLE' };
  }
};

type ParseArgResult = { ok: true; value: number | null } | { ok: false; errorCode: string };

const parseExpectedArg = (args: string[], flag: string): ParseArgResult => {
  const idx = args.indexOf(flag);
  if (idx === -1) return { ok: true, value: null };
  const val = args[idx + 1];
  const n = val !== undefined ? parseInt(val, 10) : NaN;
  if (isNaN(n)) {
    return { ok: false, errorCode: `ARG_INVALID_${flag.replace(/^--/, '').toUpperCase().replace(/-/g, '_')}` };
  }
  return { ok: true, value: n };
};

export const runBestPrefillComparisonCli = async (input: {
  args: string[];
  env: NodeJS.ProcessEnv;
  createDb: () => Promise<{ db: PrismaClient; disconnect: () => Promise<void> }>;
  write: (value: string) => void;
}): Promise<number> => {
  const { args, env, createDb, write } = input;

  if (!env.DATABASE_URL?.trim()) {
    write(JSON.stringify({ ok: false, errorCode: 'DATABASE_URL_REQUIRED' }));
    return 2;
  }
  if (!env.DEFAULT_WORKSPACE_ID?.trim() || !env.DEFAULT_USER_ID?.trim()) {
    write(JSON.stringify({ ok: false, errorCode: 'WORKSPACE_OR_USER_REQUIRED' }));
    return 2;
  }

  const workspaceId = env.DEFAULT_WORKSPACE_ID.trim();
  const userId = env.DEFAULT_USER_ID.trim();
  const jsonMode = args.includes('--json');

  const parsedTotal = parseExpectedArg(args, '--expected-total');
  if (parsedTotal.ok === false) {
    write(JSON.stringify({ ok: false, errorCode: parsedTotal.errorCode }));
    return 2;
  }
  const parsedCompletePrefills = parseExpectedArg(args, '--expected-complete-prefills');
  if (parsedCompletePrefills.ok === false) {
    write(JSON.stringify({ ok: false, errorCode: parsedCompletePrefills.errorCode }));
    return 2;
  }
  const parsedNone = parseExpectedArg(args, '--expected-none');
  if (parsedNone.ok === false) {
    write(JSON.stringify({ ok: false, errorCode: parsedNone.errorCode }));
    return 2;
  }

  const expectedTotal = parsedTotal.value;
  const expectedCompletePrefills = parsedCompletePrefills.value;
  const expectedNone = parsedNone.value;

  let disconnect: (() => Promise<void>) | null = null;
  try {
    const connection = await createDb();
    disconnect = connection.disconnect;
    const prisma = connection.db;

    // Fail-closed workspace existence and active check
    const workspace = await prisma.financeWorkspace.findUnique({
      where: { id: workspaceId },
      select: { id: true, isActive: true },
    });
    if (!workspace) {
      write(JSON.stringify({ ok: false, errorCode: 'WORKSPACE_NOT_FOUND' }));
      return 1;
    }
    if (!workspace.isActive) {
      write(JSON.stringify({ ok: false, errorCode: 'WORKSPACE_INACTIVE' }));
      return 1;
    }

    // Fail-closed user existence and active check
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, isActive: true },
    });
    if (!user) {
      write(JSON.stringify({ ok: false, errorCode: 'USER_NOT_FOUND' }));
      return 1;
    }
    if (!user.isActive) {
      write(JSON.stringify({ ok: false, errorCode: 'USER_INACTIVE' }));
      return 1;
    }

    // Fail-closed membership check using composite unique key
    const membership = await prisma.workspaceMembership.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId,
          userId,
        },
      },
      select: {
        id: true,
        isActive: true,
        workspaceId: true,
        userId: true,
        workspace: { select: { isActive: true } },
        user: { select: { isActive: true } },
      },
    });
    if (!membership) {
      write(JSON.stringify({ ok: false, errorCode: 'USER_NOT_MEMBER_OF_WORKSPACE' }));
      return 1;
    }
    if (!membership.isActive) {
      write(JSON.stringify({ ok: false, errorCode: 'MEMBERSHIP_INACTIVE' }));
      return 1;
    }
    if (membership.workspaceId !== workspaceId || membership.userId !== userId) {
      write(JSON.stringify({ ok: false, errorCode: 'MEMBERSHIP_SCOPE_MISMATCH' }));
      return 1;
    }
    if (!membership.workspace.isActive) {
      write(JSON.stringify({ ok: false, errorCode: 'MEMBERSHIP_WORKSPACE_INACTIVE' }));
      return 1;
    }
    if (!membership.user.isActive) {
      write(JSON.stringify({ ok: false, errorCode: 'MEMBERSHIP_USER_INACTIVE' }));
      return 1;
    }

    // Production-parity cohort: exact same WHERE clause as review service
    const transactionWhere = buildReviewQueueTransactionWhere(userId);
    const unresolvedTxs = await prisma.transaction.findMany({
      where: transactionWhere,
      select: {
        id: true,
        direction: true,
        // Authoritative transaction classification
        projectId: true,
        transactionTypeId: true,
        categoryId: true,
        project: { select: { id: true, code: true, name: true, isActive: true, workspaceId: true } },
        transactionType: { select: { id: true, literalName: true, isActive: true, direction: true, workspaceId: true } },
        category: { select: { id: true, name: true, isActive: true, workspaceId: true } },
        // Existing booking
        transactionBooking: {
          select: {
            id: true,
            projectId: true,
            transactionTypeId: true,
            categoryId: true,
            literalProjectLabel: true,
            literalTypeLabel: true,
            literalCategoryLabel: true,
            project: { select: { code: true } },
            transactionType: { select: { literalName: true } },
            category: { select: { name: true } },
          },
        },
        categorizationSuggestions: {
          select: {
            id: true,
            workspaceId: true,
            transactionId: true,
            projectId: true,
            transactionTypeId: true,
            categoryId: true,
            producerKey: true,
            producerVersion: true,
            rank: true,
            confidence: true,
            matcher: true,
            scoreBasisPoints: true,
            evidenceHash: true,
            status: true,
            project: { select: { id: true, isActive: true, workspaceId: true } },
            transactionType: { select: { id: true, isActive: true, direction: true, workspaceId: true } },
            category: { select: { id: true, isActive: true, workspaceId: true } },
          },
          where: { status: 'PENDING' },
          orderBy: [{ rank: 'asc' }],
        },
      },
    });

    const totalUnresolved = unresolvedTxs.length;

    // Build v2 dry-run proposal plan (in-memory only)
    const v2Plan = await buildOwnerHistoryProposalPlan(prisma, { workspaceId, userId });
    if (v2Plan.sideEffects.writesPerformed) {
      write(JSON.stringify({ ok: false, errorCode: 'DRY_RUN_REPORTED_WRITES' }));
      return 1;
    }

    // Index proposals by transactionId for fast lookup in the main loop
    type ProposalRank1 = NonNullable<(typeof v2Plan.proposals)[number]['rank1']>;
    const v2ProposalsByTx = new Map<string, ProposalRank1>();
    for (const proposal of v2Plan.proposals) {
      if (proposal.rank1) v2ProposalsByTx.set(proposal.transactionId, proposal.rank1);
    }

    // Pre-load all unique project/transactionType/category records needed for v2 eligibility checks
    const uniqueProjectIds = [...new Set([...v2ProposalsByTx.values()].map((r) => r.projectId))];
    const uniqueTypeIds = [...new Set([...v2ProposalsByTx.values()].map((r) => r.transactionTypeId))];
    const uniqueCategoryIds = [...new Set([...v2ProposalsByTx.values()].map((r) => r.categoryId))];

    const [projectRecords, typeRecords, categoryRecords] = await Promise.all([
      prisma.project.findMany({ where: { id: { in: uniqueProjectIds } }, select: { id: true, isActive: true, workspaceId: true } }),
      prisma.transactionType.findMany({ where: { id: { in: uniqueTypeIds } }, select: { id: true, isActive: true, direction: true, workspaceId: true } }),
      prisma.category.findMany({ where: { id: { in: uniqueCategoryIds } }, select: { id: true, isActive: true, workspaceId: true } }),
    ]);

    const projectMap = new Map(projectRecords.map((r) => [r.id, r]));
    const typeMap = new Map(typeRecords.map((r) => [r.id, r]));
    const categoryMap = new Map(categoryRecords.map((r) => [r.id, r]));

    // Per-transaction policy counters
    let v2ProjectedCount = 0;
    let v2EligibleCount = 0;
    let v2IneligibleCount = 0;
    let policyAuthoritativeCount = 0;
    let policyBookingCount = 0;
    let policyV2Count = 0;
    let policyLegacyCount = 0;
    let policyNoneCount = 0;
    let tripleAgreementCount = 0;
    let tripleDisagreementCount = 0;

    // Legacy inventory counters
    let totalEligibleLegacyCount = 0;
    let totalInvalidLegacyCount = 0;

    for (const tx of unresolvedTxs) {
      const trustedCtx: ReviewPrefillTrustedContext = {
        expectedWorkspaceId: workspaceId,
        expectedTransactionId: tx.id,
        transactionDirection: tx.direction as 'credit' | 'debit',
      };

      const legacyAlts: ReviewEvidenceAlternative[] = [];

      // Build legacy alternatives (PENDING already filtered by query)
      for (const rawSg of tx.categorizationSuggestions) {
        const eligibility = checkPrefillEligibility(rawSg as any, trustedCtx);
        legacyAlts.push({
          suggestionId: rawSg.id,
          rank: rawSg.rank,
          matcher: rawSg.matcher,
          confidence: rawSg.confidence,
          confidenceLabel: '',
          reason: '',
          matchedRuleIds: [],
          historicalRecordIds: [],
          evidenceHashes: [rawSg.evidenceHash],
          evidenceHash: rawSg.evidenceHash,
          producerKey: rawSg.producerKey,
          producerVersion: rawSg.producerVersion,
          scoreBasisPoints: rawSg.scoreBasisPoints,
          projectId: rawSg.projectId,
          projectCode: null,
          projectLabel: null,
          transactionTypeId: rawSg.transactionTypeId,
          transactionTypeLabel: null,
          categoryId: rawSg.categoryId,
          categoryLabel: null,
          complete: Boolean(rawSg.projectId && rawSg.transactionTypeId && rawSg.categoryId),
          eligible: eligibility.eligible,
        });

        // Count eligible/invalid legacy suggestions
        if (rawSg.producerKey === null && rawSg.producerVersion === null) {
          if (eligibility.eligible) totalEligibleLegacyCount++;
          else totalInvalidLegacyCount++;
        }
      }

      // Build projected v2 alternative if covered
      const v2Rank1 = v2ProposalsByTx.get(tx.id);
      let v2Alt: ReviewEvidenceAlternative | null = null;
      if (v2Rank1) {
        const syntheticSuggestion = {
          id: `v2-projected-${tx.id}`,
          workspaceId,
          transactionId: tx.id,
          projectId: v2Rank1.projectId,
          transactionTypeId: v2Rank1.transactionTypeId,
          categoryId: v2Rank1.categoryId,
          producerKey: OWNER_HISTORY_PRODUCER_KEY,
          producerVersion: OWNER_HISTORY_PRODUCER_VERSION,
          project: projectMap.get(v2Rank1.projectId) ?? null,
          transactionType: typeMap.get(v2Rank1.transactionTypeId) ?? null,
          category: categoryMap.get(v2Rank1.categoryId) ?? null,
          rank: 1,
          confidence: v2Rank1.confidence,
          matcher: v2Rank1.matcher,
          scoreBasisPoints: v2Rank1.scoreBasisPoints,
          evidenceHash: v2Rank1.evidenceHash,
          status: 'PENDING' as const,
        };
        const eligibility = checkPrefillEligibility(syntheticSuggestion as any, trustedCtx);
        v2Alt = {
          suggestionId: `v2-projected-${tx.id}`,
          rank: 1,
          matcher: v2Rank1.matcher,
          confidence: v2Rank1.confidence,
          confidenceLabel: '',
          reason: '',
          matchedRuleIds: [],
          historicalRecordIds: [],
          evidenceHashes: [v2Rank1.evidenceHash],
          evidenceHash: v2Rank1.evidenceHash,
          producerKey: OWNER_HISTORY_PRODUCER_KEY,
          producerVersion: OWNER_HISTORY_PRODUCER_VERSION,
          scoreBasisPoints: v2Rank1.scoreBasisPoints,
          projectId: v2Rank1.projectId,
          projectCode: null,
          projectLabel: null,
          transactionTypeId: v2Rank1.transactionTypeId,
          transactionTypeLabel: null,
          categoryId: v2Rank1.categoryId,
          categoryLabel: null,
          complete: Boolean(v2Rank1.projectId && v2Rank1.transactionTypeId && v2Rank1.categoryId),
          eligible: eligibility.eligible,
        };
        v2ProjectedCount++;
        if (v2Alt.eligible) v2EligibleCount++;
        else v2IneligibleCount++;
      }

      const allAlts: ReviewEvidenceAlternative[] = v2Alt ? [v2Alt, ...legacyAlts] : legacyAlts;

      // Build canonical prefill selection input
      const selectionInput: ReviewPrefillSelectionInput = {
        authoritativeTransaction: {
          projectId: tx.projectId,
          projectCode: tx.project?.code ?? null,
          projectLabel: tx.project?.name ?? null,
          transactionTypeId: tx.transactionTypeId,
          transactionTypeLabel: tx.transactionType?.literalName ?? null,
          categoryId: tx.categoryId,
          categoryLabel: tx.category?.name ?? null,
        },
        existingBooking: tx.transactionBooking
          ? {
              projectId: tx.transactionBooking.projectId,
              projectCode: tx.transactionBooking.project?.code ?? null,
              projectLabel: tx.transactionBooking.literalProjectLabel,
              transactionTypeId: tx.transactionBooking.transactionTypeId,
              transactionTypeLabel: tx.transactionBooking.transactionType?.literalName ?? null,
              categoryId: tx.transactionBooking.categoryId,
              categoryLabel: tx.transactionBooking.category?.name ?? null,
            }
          : null,
        alternatives: allAlts,
      };

      const { prefill } = selectReviewPrefill(selectionInput);

      // Count by source
      switch (prefill.source) {
        case 'AUTHORITATIVE_TRANSACTION': policyAuthoritativeCount++; break;
        case 'EXISTING_BOOKING': policyBookingCount++; break;
        case 'OWNER_HISTORY_V2': policyV2Count++; break;
        case 'LEGACY_HISTORY_FALLBACK': policyLegacyCount++; break;
        case 'NONE': policyNoneCount++; break;
      }

      // Triple agreement check (only when projected v2 and legacy rank-1 both exist)
      const legacyRank1 = tx.categorizationSuggestions.find(
        (s) => s.producerKey === null && s.rank === 1 && s.projectId && s.transactionTypeId && s.categoryId,
      );
      if (legacyRank1 && v2Alt) {
        const legacyKey = `${legacyRank1.projectId}|${legacyRank1.transactionTypeId}|${legacyRank1.categoryId}`;
        const v2Key = `${v2Alt.projectId}|${v2Alt.transactionTypeId}|${v2Alt.categoryId}`;
        if (legacyKey === v2Key) tripleAgreementCount++;
        else tripleDisagreementCount++;
      }
    }

    // Assertion checks (fail-closed)
    const assertionFailures: string[] = [];
    if (expectedTotal !== null && totalUnresolved !== expectedTotal) {
      assertionFailures.push(`--expected-total ${expectedTotal} but got ${totalUnresolved}`);
    }
    const completePrefills = policyAuthoritativeCount + policyBookingCount + policyV2Count + policyLegacyCount;
    if (expectedCompletePrefills !== null && completePrefills !== expectedCompletePrefills) {
      assertionFailures.push(`--expected-complete-prefills ${expectedCompletePrefills} but got ${completePrefills}`);
    }
    if (expectedNone !== null && policyNoneCount !== expectedNone) {
      assertionFailures.push(`--expected-none ${expectedNone} but got ${policyNoneCount}`);
    }
    if (assertionFailures.length > 0) {
      write(JSON.stringify({
        ok: false,
        errorCode: 'ASSERTION_FAILED',
        assertionFailures,
        aggregateCounts: { totalUnresolved, completePrefills, policyNoneCount },
      }));
      return 1;
    }

    const output = {
      schemaVersion: 'best-prefill-comparison-v4',
      safetyGuards: {
        writesPerformed: false,
        dryRunOnly: true,
        usedProductionParityCohort: true,
        scopedByExactWorkspaceAndUser: true,
      },
      aggregateCounts: {
        totalUnresolvedTransactions: totalUnresolved,
        v2ProposalPlanCovered: v2Plan.counts.covered,
        v2ProposalPlanAbstained: v2Plan.counts.abstained,
        eligibleLegacySuggestionsCount: totalEligibleLegacyCount,
        invalidLegacySuggestionsCount: totalInvalidLegacyCount,
        v2ProjectedRank1Count: v2ProjectedCount,
        v2EligibleAfterCurrentDbCheck: v2EligibleCount,
        v2IneligibleAfterCurrentDbCheck: v2IneligibleCount,
        legacyV2TripleAgreementCount: tripleAgreementCount,
        legacyV2TripleDisagreementCount: tripleDisagreementCount,
      },
      policySelectionCounts: {
        selectedAuthoritativeTransaction: policyAuthoritativeCount,
        selectedExistingBooking: policyBookingCount,
        selectedOwnerHistoryV2: policyV2Count,
        selectedLegacyFallback: policyLegacyCount,
        selectedNone: policyNoneCount,
        total: totalUnresolved,
        allTransactionsPrefilled: completePrefills === totalUnresolved,
      },
      assertionsPassed: assertionFailures.length === 0,
    };

    if (jsonMode) {
      write(JSON.stringify(output, null, 2));
    } else {
      write('\n=== Best-Prefill Comparison (Production-Parity Dry-Run with v2 Projection) ===');
      write('Safety: no writes, no PII, aggregate counts only\n');
      write('--- Cohort ---');
      write(`  Unresolved transactions:               ${totalUnresolved}`);
      write(`  v2 plan: covered / abstained:          ${v2Plan.counts.covered} / ${v2Plan.counts.abstained}\n`);
      write('--- Legacy Inventory ---');
      write(`  Eligible legacy suggestions:           ${totalEligibleLegacyCount}`);
      write(`  Invalid legacy suggestions:            ${totalInvalidLegacyCount}\n`);
      write('--- Projected v2 Eligibility (Current DB Records) ---');
      write(`  v2 projected rank-1 triples:           ${v2ProjectedCount}`);
      write(`  v2 eligible (current DB):              ${v2EligibleCount}`);
      write(`  v2 ineligible (current DB):            ${v2IneligibleCount}\n`);
      write('--- Triple Agreement (v2 vs legacy rank-1) ---');
      write(`  Triple agreement:                      ${tripleAgreementCount}`);
      write(`  Triple disagreement:                   ${tripleDisagreementCount}\n`);
      write('--- Policy Selection (canonical selectReviewPrefill) ---');
      write(`  Authoritative transaction:             ${policyAuthoritativeCount}`);
      write(`  Existing booking:                      ${policyBookingCount}`);
      write(`  Selected owner-history-v2:             ${policyV2Count}`);
      write(`  Selected legacy fallback:              ${policyLegacyCount}`);
      write(`  Selected none:                         ${policyNoneCount}`);
      write(`  Total prefilled:                       ${completePrefills}/${totalUnresolved}`);
      write(`\n  All transactions prefilled:            ${completePrefills === totalUnresolved ? 'YES' : 'NO'}`);
      write('\n=== Done. No writes performed. ===\n');
    }

    return 0;
  } catch (err) {
    write(JSON.stringify({ ok: false, errorCode: 'UNEXPECTED_ERROR' }));
    return 1;
  } finally {
    if (disconnect) await disconnect();
  }
};

const main = async (): Promise<void> => {
  loadEnvConfig(process.cwd());

  // Validate database URL before doing anything else
  const urlValidation = validateDatabaseUrl(process.env.DATABASE_URL);
  if (urlValidation.valid === false) {
    console.error(`STOP: DATABASE_URL validation failed (${urlValidation.errorCode})`);
    process.exitCode = 1;
    return;
  }

  const exitCode = await runBestPrefillComparisonCli({
    args: process.argv.slice(2),
    env: process.env,
    createDb: async () => {
      const { prisma } = await import('../prismaClient');
      return { db: prisma, disconnect: () => prisma.$disconnect() };
    },
    write: (value) => process.stdout.write(`${value}\n`),
  });
  process.exitCode = exitCode;
};

if (require.main === module) void main();
