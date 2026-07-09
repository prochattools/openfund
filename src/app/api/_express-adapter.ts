import { NextRequest, NextResponse } from 'next/server';

type JsonBody = unknown;

type ExpressLikeRequest = {
  header: (name: string) => string | undefined;
  query: Record<string, string | string[]>;
  params: Record<string, string>;
};

type ExpressLikeResponse = {
  status: (code: number) => ExpressLikeResponse;
  json: (body: JsonBody) => ExpressLikeResponse;
};

type ExpressJsonHandler = (req: any, res: any) => Promise<unknown> | unknown;

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
  options: { params?: Record<string, string> } = {},
) => {
  let statusCode = 200;
  let responseBody: JsonBody = null;

  const req: ExpressLikeRequest = {
    header: (name) => request.headers.get(name) ?? undefined,
    query: readQuery(request),
    params: options.params ?? {},
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
