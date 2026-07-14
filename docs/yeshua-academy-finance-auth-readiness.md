# Yeshua Academy Finance - Auth Readiness

Status: Clerk-only production authentication standardization prepared locally; not deployed
Date: 2026-07-14

## Goal

The app is private-only. Clerk is the only supported production identity
provider. The server maps a verified Clerk identity to an active local `User`
and active `WorkspaceMembership`; the membership role is authoritative for
administrator/viewer authorization.

## Configuration

GitHub Actions build-time configuration must provide:

```text
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
```

The workflow validates that this is a non-empty `pk_live_` or `pk_test_`
value before Docker execution. The value is public and is passed only as the
Docker build argument needed by the browser bundle.

Dokploy production runtime configuration must provide:

```bash
AUTH_PROVIDER=clerk
NEXT_PUBLIC_AUTH_PROVIDER=clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=<publishable-key>
CLERK_SECRET_KEY=<runtime-secret-key>
DEFAULT_WORKSPACE_ID=<finance-workspace-id>
```

`CLERK_SECRET_KEY` is runtime-only. It is never a GitHub build secret, Docker
build argument, image-layer value, public variable, or logged payload. The
workspace value must be the real active finance workspace UUID; missing,
malformed, or placeholder values fail closed.

Local development may explicitly use the server-side bypass:

```bash
AUTH_PROVIDER=disabled
NEXT_PUBLIC_AUTH_PROVIDER=disabled
DEFAULT_USER_ID=<local-user-id>
DEFAULT_WORKSPACE_ID=<finance-workspace-id>
```

`disabled` is local-only. Production always selects the statically imported
Clerk middleware. Missing or invalid runtime Clerk configuration fails closed
with a safe response. Ory is inactive and removed from the production
authentication path; no Ory cookie or generic cookie fallback authenticates a
request.

Provisioning requires the Clerk primary email to match an active local `User`
and an active `WorkspaceMembership` in the configured active finance
workspace. `ADMIN` memberships map to administrator access; other supported
active memberships map to viewer access. Unknown, inactive, or unprovisioned
users receive `403`.

## Authorization contract

1. API routes require a verified Clerk `__session` cookie and return `401`
   JSON when it is absent or invalid.
2. A verified identity without an active local user or workspace membership
   receives `403`.
3. Active `ADMIN` membership permits mutations; active `VIEWER` membership
   permits reads only.
4. Review, accounting, and evaluation reads never create financial records.
5. Browser pages redirect unauthenticated users to `/sign-in`.
6. Client-supplied `x-user-id`, `x-user-role`, `x-actor-id`, and `x-user-email`
   headers are ignored.

The sign-in redirect accepts only internal single-slash paths. External and
protocol-relative redirect targets fall back to `/ledger`.

Administrators may import, review, categorize, send summaries, and manage
settings. Viewers may read dashboard, reports, ledger, review, accounting,
and evaluation data, but cannot submit mutations.

## Safety note

Do not make the app public. Do not use client identity headers as a fallback,
and do not restore Ory or generic provider selection. Rollback is an
authentication-only operation: restore the last verified Clerk image and
matching Clerk runtime variables, then repeat the unauthenticated and
authenticated smoke tests. Do not change financial data during rollback.

This authentication cutover changes no financial records. The 221 unresolved
transactions, 663 review-only suggestions, cash/classification/close controls,
and all booking and review-decision records remain unchanged.
