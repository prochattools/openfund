import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../server/prismaClient';

const PRODUCTION_WORKSPACE_ID = process.env.DEFAULT_WORKSPACE_ID?.trim() || '00000000-0000-4000-8000-000000000001';
const CONFIGURED_DEFAULT_USER_ID = process.env.DEFAULT_USER_ID?.trim();
let cachedDefaultDataOwnerId: string | undefined;

type JsonBody = unknown;

type ExpressLikeRequest = {
  header: (name: string) => string | undefined;
  query: Record<string, string | string[]>;
  params: Record<string, string>;
  body?: unknown;
};

type ExpressLikeResponse = {
  status: (code: number) => ExpressLikeResponse;
  json: (body: JsonBody) => ExpressLikeResponse;
};

type ExpressJsonHandler = (req: any, res: any) => Promise<unknown> | unknown;

const resolveDataOwnerId = async (request: NextRequest): Promise<string | undefined> => {
  const requestedUserId = request.headers.get('x-user-id')?.trim() || CONFIGURED_DEFAULT_USER_ID;
  if (!requestedUserId) {
    return undefined;
  }

  const directUser = await prisma.user.findFirst({
    where: {
      isActive: true,
      OR: [{ id: requestedUserId }, { email: requestedUserId }],
    },
    select: { id: true },
  });

  if (directUser) {
    return directUser.id;
  }

  const isConfiguredDefault = requestedUserId === CONFIGURED_DEFAULT_USER_ID;
  if (!isConfiguredDefault) {
    return requestedUserId;
  }

  if (cachedDefaultDataOwnerId) {
    return cachedDefaultDataOwnerId;
  }

  const adminMembership = await prisma.workspaceMembership.findFirst({
    where: {
      workspaceId: PRODUCTION_WORKSPACE_ID,
      role: 'ADMIN',
      isActive: true,
      user: { isActive: true },
    },
    orderBy: { createdAt: 'asc' },
    select: { userId: true },
  });

  cachedDefaultDataOwnerId = adminMembership?.userId;
  if (cachedDefaultDataOwnerId) {
    console.info('[identity] resolved configured data owner to workspace admin user');
    return cachedDefaultDataOwnerId;
  }

  return requestedUserId;
};

const readQuery = (request: NextRequest): Record<string, string | string[]> => {
  const query: Record<string, string | string[]> = {};

  request.nextUrl.searchParams.forEach((value, key) => {
    const existing = query[key];
    if (existing == null) {
      query[key] = value;
      return;
    }
    query[key] = Array.isArray(existing) ? [...existing, value] : [existing, value];
  });

  return query;
};

export const invokeExpressJsonHandler = async (
  request: NextRequest,
  handler: ExpressJsonHandler,
  options: { params?: Record<string, string>; body?: unknown } = {},
) => {
  let statusCode = 200;
  let responseBody: JsonBody = null;
  const resolvedDataOwnerId = await resolveDataOwnerId(request);

  const req: ExpressLikeRequest = {
    header: (name) =>
      name.toLowerCase() === 'x-user-id'
        ? resolvedDataOwnerId
        : request.headers.get(name) ?? undefined,
    query: readQuery(request),
    params: options.params ?? {},
    body: options.body,
  };

  const res: ExpressLikeResponse = {
    status: (code) => {
      statusCode = code;
      return res;
    },
    json: (body) => {
      responseBody = body;
      return res;
    },
  };

  await handler(req, res);

  return NextResponse.json(responseBody, { status: statusCode });
};
