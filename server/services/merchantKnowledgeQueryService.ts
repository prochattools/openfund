import type { PrismaClient } from '@prisma/client';
import { isValidWorkspaceId } from '../../src/utils/auth';
import type { RequestActor } from '../auth/requestContext';
import { prisma } from '../prismaClient';
import {
  MERCHANT_KNOWLEDGE_READ_ONLY_EFFECTS,
  isMerchantKnowledgeReadEnabled,
} from './merchantKnowledgeCapability';

const PAGE_SIZES = new Set([25, 50, 100]);
const MERCHANT_STATUSES = new Set(['PROPOSED', 'ACTIVE', 'CONFLICTED', 'MERGED', 'DEPRECATED']);
const MAX_QUERY_LENGTH = 100;

export class MerchantKnowledgeAccessError extends Error {
  constructor(
    public readonly code: 'disabled' | 'misconfigured' | 'forbidden',
    message: string,
  ) {
    super(message);
  }
}

export type MerchantKnowledgeListInput = {
  page?: unknown;
  pageSize?: unknown;
  status?: unknown;
  query?: unknown;
};

export const parseMerchantKnowledgeListInput = (input: MerchantKnowledgeListInput) => {
  const parsedPage = Number(input.page);
  const parsedPageSize = Number(input.pageSize);
  const page = Number.isInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1;
  const pageSize = PAGE_SIZES.has(parsedPageSize) ? parsedPageSize : 25;
  const status = typeof input.status === 'string' && MERCHANT_STATUSES.has(input.status)
    ? input.status
    : null;
  const query = typeof input.query === 'string'
    ? input.query.trim().slice(0, MAX_QUERY_LENGTH) || null
    : null;
  return { page, pageSize, status, query };
};

const maskIban = (value: string | null): string | null => {
  if (!value) return null;
  const compact = value.replace(/\s+/g, '');
  if (compact.length < 8) return '••••';
  return `${compact.slice(0, 4)}••••••${compact.slice(-4)}`;
};

const resolveWorkspaceId = async (
  actor: RequestActor,
  client: PrismaClient,
  env: NodeJS.ProcessEnv,
): Promise<string> => {
  const workspaceId = env.DEFAULT_WORKSPACE_ID?.trim();
  if (!isValidWorkspaceId(workspaceId)) {
    throw new MerchantKnowledgeAccessError('misconfigured', 'Merchant Knowledge workspace is niet geconfigureerd.');
  }
  const membership = await client.workspaceMembership.findFirst({
    where: {
      userId: actor.userId,
      workspaceId,
      isActive: true,
      workspace: { isActive: true },
    },
    select: { id: true },
  });
  if (!membership) {
    throw new MerchantKnowledgeAccessError('forbidden', 'Geen toegang tot deze financiële werkruimte.');
  }
  return workspaceId;
};

const requireReadContext = async (
  actor: RequestActor,
  client: PrismaClient,
  env: NodeJS.ProcessEnv,
): Promise<string> => {
  if (!isMerchantKnowledgeReadEnabled(env)) {
    throw new MerchantKnowledgeAccessError('disabled', 'Merchant Knowledge-leestoegang is uitgeschakeld.');
  }
  return resolveWorkspaceId(actor, client, env);
};

const baseResponse = () => ({ ...MERCHANT_KNOWLEDGE_READ_ONLY_EFFECTS });

export const getMerchantKnowledgeSummary = async (
  actor: RequestActor,
  client: PrismaClient = prisma,
  env: NodeJS.ProcessEnv = process.env,
) => {
  const workspaceId = await requireReadContext(actor, client, env);
  const [merchants, aliases, fingerprints, openConflicts] = await Promise.all([
    client.merchant.count({ where: { workspaceId } }),
    client.merchantAlias.count({ where: { workspaceId } }),
    client.merchantFingerprint.count({ where: { workspaceId } }),
    client.merchantConflict.count({ where: { workspaceId, status: 'OPEN' } }),
  ]);
  return { ...baseResponse(), workspaceId, counts: { merchants, aliases, fingerprints, openConflicts } };
};

export const listMerchantKnowledgeMerchants = async (
  actor: RequestActor,
  input: MerchantKnowledgeListInput,
  client: PrismaClient = prisma,
  env: NodeJS.ProcessEnv = process.env,
) => {
  const workspaceId = await requireReadContext(actor, client, env);
  const { page, pageSize, status, query } = parseMerchantKnowledgeListInput(input);
  const where = {
    workspaceId,
    ...(status ? { status: status as never } : {}),
    ...(query
      ? {
          OR: [
            { canonicalName: { contains: query, mode: 'insensitive' as const } },
            { normalizedCanonicalName: { contains: query, mode: 'insensitive' as const } },
          ],
        }
      : {}),
  };
  const [totalItems, rows] = await Promise.all([
    client.merchant.count({ where }),
    client.merchant.findMany({
      where,
      select: {
        id: true,
        canonicalName: true,
        status: true,
        version: true,
        mergedIntoMerchantId: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { aliases: true, fingerprints: true, resolutions: true } },
      },
      orderBy: [{ normalizedCanonicalName: 'asc' }, { id: 'asc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);
  const totalPages = totalItems === 0 ? 0 : Math.ceil(totalItems / pageSize);
  return {
    ...baseResponse(),
    merchants: rows.map((row) => ({
      id: row.id,
      canonicalName: row.canonicalName,
      status: row.status,
      version: row.version,
      mergedIntoMerchantId: row.mergedIntoMerchantId,
      counts: row._count,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    })),
    pagination: {
      page,
      pageSize,
      totalItems,
      totalPages,
      hasPreviousPage: page > 1 && totalItems > 0,
      hasNextPage: page < totalPages,
    },
    filters: { status, query },
  };
};

export const getMerchantKnowledgeMerchantDetail = async (
  actor: RequestActor,
  merchantId: string,
  client: PrismaClient = prisma,
  env: NodeJS.ProcessEnv = process.env,
) => {
  const workspaceId = await requireReadContext(actor, client, env);
  const merchant = await client.merchant.findFirst({
    where: { id: merchantId, workspaceId },
    select: {
      id: true,
      canonicalName: true,
      status: true,
      version: true,
      mergedIntoMerchantId: true,
      createdAt: true,
      updatedAt: true,
      aliases: {
        select: {
          id: true,
          signalType: true,
          status: true,
          valueHash: true,
          evidenceHash: true,
          normalizationVersion: true,
          normalizedValue: true,
          confidenceBasisPoints: true,
          createdAt: true,
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      },
      fingerprints: {
        select: {
          id: true,
          signalType: true,
          status: true,
          strength: true,
          valueHash: true,
          evidenceHash: true,
          extractionVersion: true,
          normalizedValue: true,
          createdAt: true,
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      },
    },
  });
  if (!merchant) return { ...baseResponse(), merchant: null };
  return {
    ...baseResponse(),
    merchant: {
      id: merchant.id,
      canonicalName: merchant.canonicalName,
      status: merchant.status,
      version: merchant.version,
      mergedIntoMerchantId: merchant.mergedIntoMerchantId,
      createdAt: merchant.createdAt.toISOString(),
      updatedAt: merchant.updatedAt.toISOString(),
      aliases: merchant.aliases.map(({ normalizedValue, ...alias }) => ({
        ...alias,
        displayValue: alias.signalType === 'IBAN' ? maskIban(normalizedValue) : null,
        createdAt: alias.createdAt.toISOString(),
      })),
      fingerprints: merchant.fingerprints.map(({ normalizedValue, ...fingerprint }) => ({
        ...fingerprint,
        displayValue: fingerprint.signalType === 'IBAN' ? maskIban(normalizedValue) : null,
        createdAt: fingerprint.createdAt.toISOString(),
      })),
    },
  };
};
