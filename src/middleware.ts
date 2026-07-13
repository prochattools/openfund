import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { CLERK_RUNTIME_ENABLED, ORY_ENABLED, getOryBaseUrl, getOryLoginUrl } from "@/utils/auth";
import { hasAuthSessionCookie, isProductionAuthEnforced, isProductionSessionAuthenticated } from "@/utils/session-auth";

/* eslint-disable @typescript-eslint/no-var-requires */
let clerkExports: any = null;

if (CLERK_RUNTIME_ENABLED) {
  clerkExports = require("@clerk/nextjs/server");
}

const publicRoutes = [
  "/sign-in(.*)",
  "/api/health",
  "/api/health(.*)",
  "/api/deployment-info",
  "/api/deployment-info(.*)",
];

const isPublicRoute =
  CLERK_RUNTIME_ENABLED && clerkExports
    ? clerkExports.createRouteMatcher(publicRoutes)
    : () => true;

const oryHandler = async (request: NextRequest) => {
  const sessionCookie = request.cookies.get("ory_kratos_session") ?? request.cookies.get("ory_session");
  if (await isProductionSessionAuthenticated(sessionCookie?.value ? request.headers.get("cookie") : null)) {
    return NextResponse.next();
  }

  if (request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Authenticatie vereist." }, { status: 401 });
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

const productionFallbackHandler = (request: NextRequest) => {
  if (!isProductionAuthEnforced()) {
    return NextResponse.next();
  }

  if (
    request.nextUrl.pathname.startsWith("/sign-in") ||
    request.nextUrl.pathname.startsWith("/api/health") ||
    request.nextUrl.pathname.startsWith("/api/deployment-info")
  ) {
    return NextResponse.next();
  }

  if (hasAuthSessionCookie(request.headers.get("cookie"))) {
    return NextResponse.next();
  }

  if (request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Authenticatie vereist." }, { status: 401 });
  }

  const redirectTo = request.nextUrl.pathname + request.nextUrl.search;
  const loginUrl = new URL("/sign-in", request.url);
  loginUrl.searchParams.set("redirect_url", redirectTo);
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
  : ((request: NextRequest) => productionFallbackHandler(request));

export default handler;

export const config = {
  matcher: [
    "/((?!.+\\.[\\w]+$|_next).*)",
    "/(api|trpc)(.*)",
  ],
};
