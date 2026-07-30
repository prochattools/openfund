import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const userId = process.env.DEFAULT_USER_ID?.trim();
const workspaceId = process.env.DEFAULT_WORKSPACE_ID?.trim();

if (!userId || !workspaceId) {
  console.error(JSON.stringify({
    ok: false,
    configuredUserPresent: Boolean(userId),
    configuredWorkspacePresent: Boolean(workspaceId),
    error: 'Required bypass configuration is incomplete.',
  }));
  process.exitCode = 1;
} else {
  try {
    const openWhere = {
      userId,
      OR: [
        { transactionBooking: null },
        { categoryId: null },
        { projectId: null },
        { transactionTypeId: null },
        { classificationSource: 'none' },
        { classificationSource: 'import' },
      ],
    };

    const [
      activeWorkspaces,
      configuredWorkspace,
      configuredUser,
      configuredMembership,
      transactions,
      openReviewRows,
      projects,
      categories,
      transactionTypes,
      pendingSuggestions,
    ] = await Promise.all([
      prisma.financeWorkspace.count({ where: { isActive: true } }),
      prisma.financeWorkspace.count({ where: { id: workspaceId, isActive: true } }),
      prisma.user.count({ where: { id: userId, isActive: true } }),
      prisma.workspaceMembership.count({
        where: {
          workspaceId,
          userId,
          role: 'ADMIN',
          isActive: true,
          workspace: { isActive: true },
          user: { isActive: true },
        },
      }),
      prisma.transaction.count({ where: { userId } }),
      prisma.transaction.count({ where: openWhere }),
      prisma.project.count({ where: { workspaceId } }),
      prisma.category.count({ where: { workspaceId } }),
      prisma.transactionType.count({ where: { workspaceId } }),
      prisma.categorizationSuggestion.count({ where: { workspaceId, status: 'PENDING' } }),
    ]);

    const candidateAdmins = await prisma.user.findMany({
      where: {
        isActive: true,
        memberships: {
          some: {
            workspaceId,
            role: 'ADMIN',
            isActive: true,
            workspace: { isActive: true },
          },
        },
      },
      select: {
        id: true,
        _count: { select: { transactions: true } },
      },
    });

    const matchingAdminCandidates = candidateAdmins.filter(
      (candidate) => candidate._count.transactions === 902,
    );

    const result = {
      ok:
        activeWorkspaces === 1 &&
        configuredWorkspace === 1 &&
        configuredUser === 1 &&
        configuredMembership === 1 &&
        transactions === 902 &&
        openReviewRows === 221,
      activeWorkspaces,
      configuredWorkspaceValid: configuredWorkspace === 1,
      configuredUserValid: configuredUser === 1,
      configuredAdminMembershipValid: configuredMembership === 1,
      activeAdminCandidates: candidateAdmins.length,
      matchingAdminCandidates: matchingAdminCandidates.length,
      uniqueRepairCandidateExists: matchingAdminCandidates.length === 1,
      transactions,
      openReviewRows,
      projects,
      categories,
      transactionTypes,
      pendingSuggestions,
    };

    console.log(JSON.stringify(result));
    if (!result.ok) process.exitCode = 1;
  } catch (error) {
    console.error(JSON.stringify({
      ok: false,
      error: error instanceof Error ? error.name : 'UnknownError',
    }));
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}
