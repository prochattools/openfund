-- MODEL-002: add the approved workspace and explicit financial dimensions.
-- This migration is additive: it preserves all existing columns, category labels, and transactions.

-- CreateEnum
CREATE TYPE "WorkspaceRole" AS ENUM ('ADMIN', 'VIEWER');

-- CreateTable
CREATE TABLE "FinanceWorkspace" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "defaultCurrency" TEXT NOT NULL DEFAULT 'EUR',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FinanceWorkspace_pkey" PRIMARY KEY ("id")
);

-- Seed the single approved Yeshua Academy workspace used by the current private application.
INSERT INTO "FinanceWorkspace" (
    "id", "name", "slug", "defaultCurrency", "isActive", "createdAt", "updatedAt"
) VALUES (
    '00000000-0000-4000-8000-000000000001',
    'Yeshua Academy',
    'yeshua-academy',
    'EUR',
    true,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
);

-- AddColumns
ALTER TABLE "User"
ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateTable
CREATE TABLE "WorkspaceMembership" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "WorkspaceRole" NOT NULL DEFAULT 'ADMIN',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkspaceMembership_pkey" PRIMARY KEY ("id")
);

-- Backfill one administrator membership per existing user without changing actor identities.
INSERT INTO "WorkspaceMembership" (
    "id", "workspaceId", "userId", "role", "isActive", "createdAt", "updatedAt"
)
SELECT
    "id",
    '00000000-0000-4000-8000-000000000001',
    "id",
    'ADMIN'::"WorkspaceRole",
    true,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "User";

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isHistorical" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TransactionType" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "literalName" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isHistorical" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TransactionType_pkey" PRIMARY KEY ("id")
);

-- Add the workspace scope and metadata to existing categories without renaming or merging labels.
ALTER TABLE "Category"
ADD COLUMN "workspaceId" TEXT NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001',
ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "isHistorical" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "sortOrder" INTEGER,
ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Add optional references so a transaction can carry Klant, Type, and Category independently.
ALTER TABLE "Transaction"
ADD COLUMN "projectId" TEXT,
ADD COLUMN "transactionTypeId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "FinanceWorkspace_slug_key" ON "FinanceWorkspace"("slug");
CREATE UNIQUE INDEX "WorkspaceMembership_workspaceId_userId_key" ON "WorkspaceMembership"("workspaceId", "userId");
CREATE INDEX "WorkspaceMembership_userId_isActive_idx" ON "WorkspaceMembership"("userId", "isActive");
CREATE INDEX "WorkspaceMembership_workspaceId_role_isActive_idx" ON "WorkspaceMembership"("workspaceId", "role", "isActive");
CREATE UNIQUE INDEX "Project_workspaceId_code_key" ON "Project"("workspaceId", "code");
CREATE INDEX "Project_workspaceId_isActive_idx" ON "Project"("workspaceId", "isActive");
CREATE UNIQUE INDEX "TransactionType_workspaceId_literalName_key" ON "TransactionType"("workspaceId", "literalName");
CREATE INDEX "TransactionType_workspaceId_isActive_sortOrder_idx" ON "TransactionType"("workspaceId", "isActive", "sortOrder");
CREATE UNIQUE INDEX "Category_workspaceId_name_key" ON "Category"("workspaceId", "name");
CREATE INDEX "Category_workspaceId_isActive_sortOrder_idx" ON "Category"("workspaceId", "isActive", "sortOrder");
CREATE INDEX "Transaction_projectId_idx" ON "Transaction"("projectId");
CREATE INDEX "Transaction_transactionTypeId_idx" ON "Transaction"("transactionTypeId");

-- AddForeignKey
ALTER TABLE "WorkspaceMembership" ADD CONSTRAINT "WorkspaceMembership_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "FinanceWorkspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkspaceMembership" ADD CONSTRAINT "WorkspaceMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Project" ADD CONSTRAINT "Project_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "FinanceWorkspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TransactionType" ADD CONSTRAINT "TransactionType_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "FinanceWorkspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Category" ADD CONSTRAINT "Category_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "FinanceWorkspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_transactionTypeId_fkey" FOREIGN KEY ("transactionTypeId") REFERENCES "TransactionType"("id") ON DELETE SET NULL ON UPDATE CASCADE;
