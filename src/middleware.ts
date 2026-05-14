import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { CLERK_RUNTIME_ENABLED, ORY_ENABLED, getOryBaseUrl, getOryLoginUrl } from "@/utils/auth";

/* eslint-disable @typescript-eslint/no-var-requires */
let clerkExports: any = null;

if (CLERK_RUNTIME_ENABLED) {
  clerkExports = require("@clerk/nextjs/server");
}

const publicRoutes = [
  "/sign-in(.*)",
  "/api/health",
  "/api/health(.*)",
];

const isPublicRoute =
  CLERK_RUNTIME_ENABLED && clerkExports
    ? clerkExports.createRouteMatcher(publicRoutes)
    : () => true;

const oryHandler = (request: NextRequest) => {
  const sessionCookie = request.cookies.get("ory_kratos_session") ?? request.cookies.get("ory_session");
  if (sessionCookie) {
    return NextResponse.next();
  }

  const oryBaseUrl = getOryBaseUrl();
  const loginPath = getOryLoginUrl();
  const redirectTo = request.nextUrl.pathname + request.nextUrl.search;
  const loginUrl = oryBaseUrl
    ? new URL(loginPath, oryBaseUrl)
    : new URL("/sign-in", request.url);

  loginUrl.searchParams.set("return_to", new URL(redirectTo, request.url).toString());
  return NextResponse.redirect(loginUrl);
};

const handler = CLERK_RUNTIME_ENABLED
  ? clerkExports!.clerkMiddleware((auth: any, request: NextRequest) => {
      if (isPublicRoute(request)) {
        return;
      }

      auth().protect();
    })
  : ORY_ENABLED
  ? ((request: NextRequest) => oryHandler(request))
  : (() => NextResponse.next());

export default handler;

export const config = {
  matcher: [
    "/((?!.+\\.[\\w]+$|_next).*)",
    "/(api|trpc)(.*)",
  ],
};
