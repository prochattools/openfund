import { NextRequest, NextResponse } from 'next/server';
import { resolveRequestActor, setRequestActor } from '../../../server/auth/requestContext';

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
  const resolution = await resolveRequestActor(request.headers.get('cookie'));
  if (!resolution.actor) {
    const status = resolution.error === 'forbidden' ? 403 : resolution.error === 'misconfigured' ? 503 : 401;
    return NextResponse.json(
      {
        error:
          resolution.error === 'forbidden'
            ? 'Geen toegang tot deze financiële werkruimte.'
            : resolution.error === 'misconfigured'
              ? 'Authenticatie is tijdelijk niet beschikbaar.'
              : 'Authenticatie vereist.',
      },
      { status },
    );
  }

  let statusCode = 200;
  let responseBody: JsonBody = null;

  const req: ExpressLikeRequest = {
    header: (name) => request.headers.get(name) ?? undefined,
    query: readQuery(request),
    params: options.params ?? {},
    body: options.body,
  };
  setRequestActor(req, resolution.actor);

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
