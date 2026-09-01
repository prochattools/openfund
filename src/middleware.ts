import { NextResponse } from "next/server";
import type { NextFetchEvent, NextRequest } from "next/server";
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { CLERK_RUNTIME_ENABLED } from "@/utils/auth";
import { isProductionAuthBypassEnabled } from "@/utils/production-auth-bypass";
import { isProductionAuthEnforced } from "@/utils/session-auth";

const publicRoutes = [
  "/sign-in(.*)",
  "/api/health",
  "/api/health(.*)",
  "/api/deployment-info",
  "/api/deployment-info(.*)",
];

const isPublicRoute = createRouteMatcher(publicRoutes);

const productionFallbackHandler = (request: NextRequest) => {
  if (isProductionAuthBypassEnabled()) {
    return NextResponse.next();
  }
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

  if (request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Authenticatie vereist." }, { status: 401 });
  }

  const redirectTo = request.nextUrl.pathname + request.nextUrl.search;
  const loginUrl = new URL("/sign-in", request.url);
  loginUrl.searchParams.set("redirect_url", redirectTo);
  return NextResponse.redirect(loginUrl);
};

const clerkHandler = clerkMiddleware((auth, request, _event) => {
  if (isPublicRoute(request)) {
    return NextResponse.next();
  }

  const authState = auth();
  if (authState.userId) {
    return NextResponse.next();
  }

  if (request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Authenticatie vereist." }, { status: 401 });
  }

  return authState.redirectToSignIn();
});

const handler = async (request: NextRequest, event?: NextFetchEvent): Promise<NextResponse> => {
  if (isProductionAuthBypassEnabled()) {
    return NextResponse.next();
  }

  // Production normally selects Clerk middleware. The runtime secret is read by
  // Clerk at request time, never during Docker image construction.
  if (isProductionAuthEnforced() || CLERK_RUNTIME_ENABLED) {
    try {
      return (await clerkHandler(request, event as NextFetchEvent)) as NextResponse;
    } catch {
      // Missing or invalid runtime Clerk configuration fails closed without
      // exposing provider or configuration details to the caller.
      return productionFallbackHandler(request);
    }
  }

  return productionFallbackHandler(request);
};

export default handler;

export const config = {
  matcher: [
    "/((?!.+\\.[\\w]+$|_next).*)",
    "/(api|trpc)(.*)",
  ],
};
